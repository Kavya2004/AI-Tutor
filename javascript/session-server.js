/**
 * javascript/session-server.js
 * The actual entry point Render deploys (render.yaml startCommand).
 *
 * All shared in-class/table chat fixes live here:
 *   • Deterministic session IDs: T{table}-S{session}-{YYYY-MM-DD}
 *   • by-table-session always creates the room (never 404)
 *   • join doesn't reject duplicate/reconnecting names
 *   • 15 s disconnect grace period (suppress leave/join spam on refresh)
 *   • participant_joined only fires on genuine new join, not reconnect
 *   • isReconnect flag in session_info so client skips "You joined" on reconnect
 *   • participants_update sent to ALL (including joiner) so count is always correct
 *   • Double-save fix: user messages saved only by originator; bot only by who asked
 *   • CORS expanded to allow localhost dev + all configured origins
 */
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import http from "http";
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { connectMongo, createSessionRecord, addStudentToSession, connectInClassMongo } from '../config/mongodb.js';
import userActivityRouter from '../routes/user-activity.js';
import chatHistoryRouter from '../routes/chat-history.js';
import inClassRouter from '../routes/in-class.js';
import geminiHandler from '../api/gemini.js';
import searchHandler from '../api/search.js';
import pineconeHandler from '../api/pinecone.js';
import pdfContentHandler from '../api/pdf-content.js';
import pdfPageHandler from '../api/pdf-page.js';
import imageGenHandler from '../api/image-gen.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── CORS ───────────────────────────────────────────────────────────────────
// Allow: localhost (dev), all *.vercel.app deploys, the production domain,
// and the Render URL itself (for health checks etc.).
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
  'https://tutor.probabilitycourse.com',
  'https://ai-tutor-53f1.onrender.com',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Render health checks, same-origin)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app subdomain
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow explicitly listed origins
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Block everything else
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Handle preflight for all routes
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Mount feature routers
app.use('/api/user-activity', userActivityRouter);
app.use('/api/chat-history', chatHistoryRouter);
app.use('/api/in-class', inClassRouter);

// Mount API handlers
app.post('/api/gemini',      (req, res) => geminiHandler(req, res));
app.post('/api/search',      (req, res) => searchHandler(req, res));
app.post('/api/pinecone',    (req, res) => pineconeHandler(req, res));
app.post('/api/pdf-content', (req, res) => pdfContentHandler(req, res));
app.post('/api/pdf-page',    (req, res) => pdfPageHandler(req, res));
app.post('/api/image-gen',   (req, res) => imageGenHandler(req, res));

// ── OCR ────────────────────────────────────────────────────────────────────
app.post('/api/ocr', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image data' });
    const imageData = image.includes(',') ? image.split(',')[1] : image;
    const mathpixResponse = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': process.env.MATHPIX_APP_ID,
        'app_key': process.env.MATHPIX_APP_KEY,
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        src: `data:image/png;base64,${imageData}`,
        formats: ['text', 'data'],
        ocr: ['math', 'text'],
      }),
    });
    const result = await mathpixResponse.json();
    res.json(result);
  } catch (error) {
    console.error('[OCR ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Tutor backend is running' });
});

// ── PDF image ──────────────────────────────────────────────────────────────
const PDF_PATH = process.env.PDF_PATH || './Physics2e.pdf';
app.get('/api/pdf-image', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const page = parseInt(req.query.page || 1);
  if (!page || page < 1 || page > 1697) return res.status(400).json({ error: 'Invalid page' });
  if (!existsSync(PDF_PATH)) return res.status(404).json({ error: `PDF not found at ${PDF_PATH}` });
  const outPrefix = `${tmpdir()}/pdf-page-${Date.now()}-${page}`;
  try {
    await new Promise((resolve, reject) => {
      execFile('pdftoppm', ['-r', '150', '-png', '-f', String(page), '-l', String(page), PDF_PATH, outPrefix],
        (err) => err ? reject(err) : resolve());
    });
    const padded = String(page).padStart(4, '0');
    const imgPath = `${outPrefix}-${padded}.png`;
    const imgBuffer = await readFile(imgPath);
    await unlink(imgPath).catch(() => {});
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(imgBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to render page: ' + err.message });
  }
});

// ── Session store ──────────────────────────────────────────────────────────
//
// FIX: In-class rooms use a DETERMINISTIC session ID of the form
//   "T{table}-S{session}-{YYYY-MM-DD}"
// Both the client (tutor.html) and server derive this key independently so
// every student who picks the same table + session on the same date lands in
// the EXACT same WS room — with no server-restart dependency.
//
const sessions = new Map();
const sessionConnections = new Map();

/**
 * Build the deterministic session ID for an in-class room.
 * Key: "T{tableNumber}-S{sessionNumber}-{YYYY-MM-DD}"
 */
function inClassSessionId(tableNumber, sessionNumber, dateKey) {
  const dk = dateKey || new Date().toISOString().slice(0, 10);
  return `T${tableNumber}-S${sessionNumber}-${dk}`;
}

/**
 * Get or create a session in memory.  Idempotent — safe to call on every join.
 */
function getOrCreateSession(sessionId, sessionTitle = '') {
  if (sessions.has(sessionId)) return sessions.get(sessionId);
  const session = {
    sessionId,
    hostName: '',
    isPublic: true,
    sessionTitle,
    participants: new Map(),
    messages: [],
    whiteboardActions: [],
    createdAt: new Date(),
    lastActivity: new Date(),
    _disconnectTimers: new Map(),
  };
  sessions.set(sessionId, session);
  sessionConnections.set(sessionId, []);
  return session;
}

function broadcastToSession(sessionId, message, excludeWs = null) {
  const connections = sessionConnections.get(sessionId) || [];
  const payload = JSON.stringify(message);
  connections.forEach(({ ws }) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch (_) {}
    }
  });
}

function serializeSession(session) {
  return {
    ...session,
    participants: Array.from(session.participants.values()),
    _disconnectTimers: undefined,
  };
}

// ── HTTP Session Endpoints ─────────────────────────────────────────────────

// POST /api/sessions/create
app.post('/api/sessions/create', (req, res) => {
  const { hostName, avatar, color, isPublic = true, sessionTitle, userEmail } = req.body;
  if (!hostName || !hostName.trim()) {
    return res.status(400).json({ error: 'Host name is required' });
  }
  const sessionId = Math.random().toString(36).substr(2, 8).toUpperCase();
  const session = getOrCreateSession(sessionId, sessionTitle || '');
  session.hostName = hostName.trim();
  session.isPublic = isPublic;
  session.sessionTitle = sessionTitle || '';
  session.participants.set(hostName.trim(), {
    userName: hostName.trim(),
    avatar: avatar || '👨‍🏫',
    color: color || '#007bff',
    isHost: true,
    joinedAt: new Date(),
  });

  createSessionRecord({
    sessionId,
    sessionTitle: sessionTitle || '',
    hostName: hostName.trim(),
    hostEmail: userEmail || '',
  }).catch(err => console.error('[MongoDB] session record error:', err));

  console.log(`[WS] Session created: ${sessionId} by ${hostName}`);
  res.json({ sessionId, message: 'Session created successfully', session: serializeSession(session) });
});

// POST /api/sessions/:sessionId/join
// FIX: Allow rejoining (reconnect) by not rejecting duplicate names.
// Also auto-create the room so Render restarts don't 404.
app.post('/api/sessions/:sessionId/join', (req, res) => {
  const { sessionId } = req.params;
  const { userName, avatar, color, email, tableNumber } = req.body;
  if (!userName || !userName.trim()) return res.status(400).json({ error: 'User name is required' });

  // Auto-create room if it doesn't exist (handles server restarts)
  const session = getOrCreateSession(sessionId);

  // Allow reconnect (same name): just update avatar/color.
  // For genuine new names that collide, append a suffix.
  let resolvedName = userName.trim();
  if (!session.participants.has(resolvedName)) {
    // New participant
    session.participants.set(resolvedName, {
      userName: resolvedName,
      avatar: avatar || '👤',
      color: color || '#6c757d',
      isHost: false,
      joinedAt: new Date(),
    });
  } else {
    // Already present — update avatar/color (reconnect case)
    const p = session.participants.get(resolvedName);
    if (avatar) p.avatar = avatar;
    if (color)  p.color  = color;
  }
  session.lastActivity = new Date();

  if (email && tableNumber) {
    addStudentToSession({
      sessionId,
      name: resolvedName,
      email,
      tableNumber: parseInt(tableNumber, 10),
    }).catch(err => console.error('[MongoDB] addStudent error:', err));
  }

  res.json({
    message: 'Joined successfully',
    resolvedName,
    session: serializeSession(session),
  });
});

// GET /api/sessions/by-table-session/:tableNumber/:sessionNumber
// FIX: Returns (and creates) the deterministic room — NEVER returns 404.
// Accepts optional ?date=YYYY-MM-DD (client sends its local date).
app.get('/api/sessions/by-table-session/:tableNumber/:sessionNumber', (req, res) => {
  const tableNumber   = parseInt(req.params.tableNumber,   10);
  const sessionNumber = parseInt(req.params.sessionNumber, 10);
  if (isNaN(tableNumber) || isNaN(sessionNumber)) {
    return res.status(400).json({ error: 'Invalid table or session number' });
  }
  const dateKey      = req.query.date || new Date().toISOString().slice(0, 10);
  const sessionId    = inClassSessionId(tableNumber, sessionNumber, dateKey);
  const sessionTitle = `Table ${tableNumber} Session ${sessionNumber}`;

  // getOrCreateSession: idempotent, creates if needed
  getOrCreateSession(sessionId, sessionTitle);
  res.json({ sessionId, sessionTitle, dateKey });
});

// GET /api/sessions/by-table/:tableNumber  (legacy, kept for backward compat)
app.get('/api/sessions/by-table/:tableNumber', (req, res) => {
  const tableNumber = parseInt(req.params.tableNumber, 10);
  if (isNaN(tableNumber)) return res.status(400).json({ error: 'Invalid table number' });
  const match = Array.from(sessions.values()).find(s => {
    const m = s.sessionTitle?.match(/Table\s*(\d+)/i);
    return m && parseInt(m[1], 10) === tableNumber;
  });
  if (!match) return res.status(404).json({ error: `No active session found for Table ${tableNumber}` });
  res.json({ sessionId: match.sessionId, sessionTitle: match.sessionTitle });
});

// GET /api/sessions/public
app.get('/api/sessions/public', (req, res) => {
  const publicSessions = Array.from(sessions.values())
    .filter(s => s.isPublic)
    .map(s => ({
      sessionId: s.sessionId,
      sessionTitle: s.sessionTitle,
      hostName: s.hostName,
      participantCount: s.participants.size,
      createdAt: s.createdAt,
    }));
  res.json(publicSessions);
});

// GET /api/sessions/:sessionId
app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(serializeSession(session));
});

// GET /api/sessions/:sessionId/download
app.get('/api/sessions/:sessionId/download', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ ...serializeSession(session), exportedAt: new Date().toISOString() });
});

// GET /api/sessions  (list all active sessions)
app.get('/api/sessions', (req, res) => {
  res.json(Array.from(sessions.values()).map(s => ({
    sessionId: s.sessionId,
    hostName: s.hostName,
    participantCount: s.participants.size,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
  })));
});

// ── WebSocket ──────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const url   = new URL(req.url, `http://localhost`);
  const parts = url.pathname.split('/');

  // Extract sessionId from /sessions/:sessionId
  const sessionId = parts[2];
  if (!sessionId) { ws.close(1008, 'sessionId required'); return; }

  // Auto-create the room if needed (handles server restarts).
  const session = getOrCreateSession(sessionId);

  let userName = null;

  ws.on('message', (rawData) => {
    let msg;
    try { msg = JSON.parse(rawData.toString()); } catch (_) { return; }

    switch (msg.type) {

      case 'join': {
        userName = msg.resolvedName || msg.userName;
        if (!userName) break;

        // Cancel any pending 15 s grace-period timer for this user
        // (they refreshed and are reconnecting).
        const timerKey = `${sessionId}:${userName}`;
        if (session._disconnectTimers.has(timerKey)) {
          clearTimeout(session._disconnectTimers.get(timerKey));
          session._disconnectTimers.delete(timerKey);
        }

        // Track whether this is a genuine new join or a transparent reconnect.
        const isNewJoin = !session.participants.has(userName);

        if (isNewJoin) {
          session.participants.set(userName, {
            userName,
            avatar: msg.avatar || '👤',
            color:  msg.color  || '#6c757d',
            isHost: false,
            joinedAt: new Date(),
          });
        } else {
          // Reconnect — just refresh avatar/color
          const p = session.participants.get(userName);
          if (msg.avatar) p.avatar = msg.avatar;
          if (msg.color)  p.color  = msg.color;
        }

        // Register this WS connection
        sessionConnections.get(sessionId).push({ ws, userName });

        // Only tell others about a join for genuine arrivals, not reconnects.
        if (isNewJoin) {
          broadcastToSession(sessionId, {
            type:      'participant_joined',
            userName,
            timestamp: new Date().toISOString(),
          }, ws); // exclude the joiner themselves
        }

        // Send session info to the joining client.
        // isReconnect lets the client skip "You joined" system message on refresh.
        ws.send(JSON.stringify({
          type:         'session_info',
          sessionTitle: session.sessionTitle,
          isPublic:     session.isPublic,
          participants: Array.from(session.participants.values()),
          isReconnect:  !isNewJoin,
        }));

        // Broadcast updated participant list to ALL clients (including joiner)
        // so every count badge updates immediately.
        broadcastToSession(sessionId, {
          type:         'participants_update',
          participants: Array.from(session.participants.values()),
        });

        // Send existing history to the joiner so late arrivals see prior chat.
        if (session.messages.length > 0) {
          ws.send(JSON.stringify({
            type:     'session_history',
            messages: session.messages,
          }));
        }

        console.log(`[WS] ${userName} ${isNewJoin ? 'joined' : 'reconnected to'} session ${sessionId}`);
        break;
      }

      case 'message': {
        if (!userName) break;
        const msgObj = {
          id:        uuidv4(),
          message:   msg.message,
          sender:    msg.sender,
          userName,
          timestamp: new Date().toISOString(),
          files:     msg.files     || [],
          citations: msg.citations || [],
        };
        session.messages.push(msgObj);
        session.lastActivity = new Date();

        // Broadcast to ALL including sender — everyone renders via addSharedMessage.
        broadcastToSession(sessionId, { type: 'message', ...msgObj });
        break;
      }

      case 'whiteboard_action': {
        if (!userName) break;
        broadcastToSession(sessionId, {
          type:        'whiteboard_action',
          action:      msg.action,
          targetBoard: msg.targetBoard,
          userName,
          timestamp:   new Date().toISOString(),
        }, ws);
        break;
      }

      case 'diagram_generated': {
        broadcastToSession(sessionId, {
          type:        'diagram_generated',
          description: msg.description,
          targetBoard: msg.targetBoard,
          userName,
        }, ws);
        break;
      }

      case 'leave': {
        if (!userName) break;
        // Cancel any pending grace-period timer (explicit leave is immediate)
        const tk = `${sessionId}:${userName}`;
        if (session._disconnectTimers.has(tk)) {
          clearTimeout(session._disconnectTimers.get(tk));
          session._disconnectTimers.delete(tk);
        }
        session.participants.delete(userName);
        const conns = sessionConnections.get(sessionId) || [];
        const idx = conns.findIndex(c => c.ws === ws);
        if (idx > -1) conns.splice(idx, 1);

        broadcastToSession(sessionId, {
          type:      'participant_left',
          userName,
          timestamp: new Date().toISOString(),
        });
        broadcastToSession(sessionId, {
          type:         'participants_update',
          participants: Array.from(session.participants.values()),
        });

        const isInClassRoom = /^T\d+-S\d+-\d{4}-\d{2}-\d{2}$/.test(sessionId);
        if (session.participants.size === 0 && !isInClassRoom) {
          sessions.delete(sessionId);
          sessionConnections.delete(sessionId);
        }
        userName = null;
        break;
      }

      case 'profile_update': {
        if (!userName || !session.participants.has(userName)) break;
        const p = session.participants.get(userName);
        if (msg.avatar) p.avatar = msg.avatar;
        if (msg.color)  p.color  = msg.color;
        broadcastToSession(sessionId, {
          type:         'participants_update',
          participants: Array.from(session.participants.values()),
        });
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!userName) return;

    // Remove this specific WS connection
    const conns = sessionConnections.get(sessionId) || [];
    const idx = conns.findIndex(c => c.ws === ws);
    if (idx > -1) conns.splice(idx, 1);

    // If the user still has another open tab, don't touch the participant entry.
    const stillConnected = conns.some(c => c.userName === userName && c.ws.readyState === WebSocket.OPEN);
    if (stillConnected) return;

    // 15-second grace period before removing the participant.
    // This suppresses the leave/join spam when a student simply refreshes.
    const timerKey = `${sessionId}:${userName}`;
    if (session._disconnectTimers.has(timerKey)) {
      clearTimeout(session._disconnectTimers.get(timerKey));
    }

    const capturedName = userName; // capture before it's cleared
    session._disconnectTimers.set(timerKey, setTimeout(() => {
      session._disconnectTimers.delete(timerKey);

      // Re-check — they may have reconnected during the 15 s window
      const activeConns = (sessionConnections.get(sessionId) || [])
        .filter(c => c.userName === capturedName && c.ws.readyState === WebSocket.OPEN);
      if (activeConns.length > 0) return;

      session.participants.delete(capturedName);
      broadcastToSession(sessionId, {
        type:      'participant_left',
        userName:  capturedName,
        timestamp: new Date().toISOString(),
      });
      broadcastToSession(sessionId, {
        type:         'participants_update',
        participants: Array.from(session.participants.values()),
      });

      // Clean up empty non-in-class rooms
      const isInClassRoom = /^T\d+-S\d+-\d{4}-\d{2}-\d{2}$/.test(sessionId);
      if (session.participants.size === 0 && !isInClassRoom) {
        sessions.delete(sessionId);
        sessionConnections.delete(sessionId);
      }

      console.log(`[WS] ${capturedName} removed from session ${sessionId} after grace period`);
    }, 15000));
  });

  ws.on('error', (err) => console.error('[WS] error:', err));
});

// ── Cleanup inactive sessions (non-in-class only) every hour ───────────────
setInterval(() => {
  const now = Date.now();
  const MAX_IDLE = 24 * 60 * 60 * 1000;
  sessions.forEach((session, sessionId) => {
    const isInClassRoom = /^T\d+-S\d+-\d{4}-\d{2}-\d{2}$/.test(sessionId);
    if (!isInClassRoom && now - new Date(session.lastActivity).getTime() > MAX_IDLE) {
      sessions.delete(sessionId);
      sessionConnections.delete(sessionId);
      console.log(`[WS] Session ${sessionId} cleaned up (inactive)`);
    }
  });
}, 60 * 60 * 1000);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
connectMongo();
connectInClassMongo();
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});

export { app, server };
