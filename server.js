import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import geminiHandler from './api/gemini.js';
import imageGenHandler from './api/image-gen.js';
import pineconeHandler from './api/pinecone.js';
import searchHandler from './api/search.js';
import pdfContentHandler from './api/pdf-content.js';
import pdfPageHandler from './api/pdf-page.js';
import pdfImageHandler from './api/pdf-image.js';
import { connectMongo, connectInClassMongo } from './config/mongodb.js';
import sessionDbRouter from './api/sessions-db.js';
import chatHistoryRouter from './routes/chat-history.js';
import userActivityRouter from './routes/user-activity.js';
import inClassRouter from './routes/in-class.js';
import professorRouter from './routes/professor.js';
import { professorConnections, broadcastToProfessors } from './lib/professor-ws.js';
import { csrfGuard } from './middleware/csrfGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));
app.use('/pages', express.static('pages'));

app.post('/api/gemini', csrfGuard, geminiHandler);
app.post('/api/image-gen', csrfGuard, imageGenHandler);
app.post('/api/pinecone', csrfGuard, pineconeHandler);
app.post('/api/search', csrfGuard, searchHandler);
app.post('/api/pdf-content', csrfGuard, pdfContentHandler);
app.post('/api/pdf-page', csrfGuard, pdfPageHandler);
app.get('/api/pdf-image', pdfImageHandler);
app.use('/api/db', sessionDbRouter);
app.use('/api/chat-history', chatHistoryRouter);
app.use('/api/user-activity', userActivityRouter);
app.use('/api/in-class', inClassRouter);
app.use('/api/professor', professorRouter);

export { broadcastToProfessors };

// ── Session store ──────────────────────────────────────────────────────────
//
// FIX: In-class rooms now use a DETERMINISTIC, date-keyed session ID of the
// form "T{table}-S{session}-{YYYY-MM-DD}".  This means:
//   • Every student who picks the same table + session on the same date will
//     derive the SAME sessionId client-side and land in the SAME WS room.
//   • No server-restart dependency: if the server restarts the room entry is
//     auto-recreated the moment the first WS client reconnects.
//   • Different dates produce different room keys (Aug 25 ≠ Aug 27).
//   • Random "create/join via HTTP" is still supported for non-in-class use.
//
// The sessions Map still lives in memory (it's ephemeral WS state), but
// in-class sessions are re-created on demand from the deterministic key so
// restart resilience is achieved.
//
const sessions = new Map();
const sessionConnections = new Map();

function generateSessionId() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

/**
 * Build the deterministic session ID for an in-class room.
 * Key: "T{tableNumber}-S{sessionNumber}-{YYYY-MM-DD}"
 * @param {number|string} tableNumber
 * @param {number|string} sessionNumber
 * @param {string} [dateKey]   – 'YYYY-MM-DD', defaults to today in UTC
 */
function inClassSessionId(tableNumber, sessionNumber, dateKey) {
  const dk = dateKey || new Date().toISOString().slice(0, 10);
  return `T${tableNumber}-S${sessionNumber}-${dk}`;
}

/**
 * Get or create a session entry in the in-memory sessions Map.
 * Used by both the HTTP endpoint and the WS handler so both paths
 * share the same room object even after a cold start.
 */
function getOrCreateSession(sessionId, sessionTitle = '') {
  if (sessions.has(sessionId)) return sessions.get(sessionId);
  const session = {
    sessionId,
    hostName: '',
    isPublic: true,
    sessionTitle,
    // Participants is a plain Map: userName → participantObject.
    // We allow name collisions (same display name) by appending a suffix if needed.
    participants: new Map(),
    messages: [],
    whiteboardActions: [],
    createdAt: new Date(),
    lastActivity: new Date(),
  };
  sessions.set(sessionId, session);
  if (!sessionConnections.has(sessionId)) sessionConnections.set(sessionId, []);
  return session;
}

/**
 * Broadcast a message to every connected WS in the session.
 * excludeWs = null  → send to ALL  (use this for participants_update, messages)
 * excludeWs = ws    → send to all EXCEPT ws  (use for participant_joined notification)
 */
function broadcastToSession(sessionId, message, excludeWs = null) {
  const connections = sessionConnections.get(sessionId) || [];
  const payload = JSON.stringify(message);
  connections.forEach(({ ws }) => {
    if (ws !== excludeWs && ws.readyState === 1 /* OPEN */) {
      ws.send(payload);
    }
  });
}

// ── HTTP Session Endpoints ─────────────────────────────────────────────────

// POST /api/sessions/create
app.post('/api/sessions/create', csrfGuard, (req, res) => {
  const { hostName, avatar, color, isPublic = true, sessionTitle, userEmail } = req.body;
  if (!hostName || !hostName.trim()) {
    return res.status(400).json({ error: 'Host name is required' });
  }
  const sessionId = generateSessionId();
  const session = getOrCreateSession(sessionId, sessionTitle || '');
  session.hostName = hostName.trim();
  session.isPublic = isPublic;
  session.sessionTitle = sessionTitle || '';
  session.participants.set(hostName.trim(), {
    userName: hostName.trim(),
    avatar: avatar || '👨🏫',
    color: color || '#007bff',
    isHost: true,
    joinedAt: new Date(),
  });

  console.log(`[WS] Session created: ${sessionId} by ${hostName}`);
  res.json({ sessionId, message: 'Session created successfully', session: serializeSession(session) });
});

// POST /api/sessions/:sessionId/join
// FIX: Instead of rejecting duplicate names, we allow them by appending a suffix.
// This prevents the silent failure where Student B can't join if Student A has the same name.
app.post('/api/sessions/:sessionId/join', csrfGuard, (req, res) => {
  const { sessionId } = req.params;
  const { userName, avatar, color } = req.body;
  if (!userName || !userName.trim()) return res.status(400).json({ error: 'User name is required' });

  // Auto-create room if it doesn't exist yet (handles server restart)
  const session = getOrCreateSession(sessionId);

  // Resolve name collision: if the name is taken by a different WS connection,
  // append "(2)", "(3)", etc. This prevents the 400 that previously left Student B unjoined.
  let resolvedName = userName.trim();
  let suffix = 2;
  while (session.participants.has(resolvedName)) {
    resolvedName = `${userName.trim()} (${suffix++})`;
  }

  session.participants.set(resolvedName, {
    userName: resolvedName,
    avatar: avatar || '👤',
    color: color || '#6c757d',
    isHost: false,
    joinedAt: new Date(),
  });
  session.lastActivity = new Date();

  res.json({
    message: 'Joined successfully',
    resolvedName, // tell the client what name was actually assigned
    session: serializeSession(session),
  });
});

// GET /api/sessions/by-table-session/:tableNumber/:sessionNumber
// FIX: Now accepts optional ?date=YYYY-MM-DD query param.
// Returns the deterministic session ID (creates the room entry if needed).
// No more title-scan over all sessions — key is derived directly.
app.get('/api/sessions/by-table-session/:tableNumber/:sessionNumber', (req, res) => {
  const tableNumber   = parseInt(req.params.tableNumber,   10);
  const sessionNumber = parseInt(req.params.sessionNumber, 10);
  if (isNaN(tableNumber) || isNaN(sessionNumber)) {
    return res.status(400).json({ error: 'Invalid table or session number' });
  }
  // Accept explicit date from the client (already set to local date in tutor.html);
  // fall back to today in UTC as a safe default.
  const dateKey = req.query.date || new Date().toISOString().slice(0, 10);
  const sessionId    = inClassSessionId(tableNumber, sessionNumber, dateKey);
  const sessionTitle = `Table ${tableNumber} Session ${sessionNumber}`;

  // getOrCreateSession ensures the room exists even after a cold restart.
  const session = getOrCreateSession(sessionId, sessionTitle);

  res.json({ sessionId, sessionTitle, dateKey });
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

function serializeSession(session) {
  return {
    ...session,
    participants: Array.from(session.participants.values()),
  };
}

// ── WebSocket ──────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const url   = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/');

  // ── Professor dashboard: /ws/professor/:labSessionId ──────────────────
  if (parts[1] === 'ws' && parts[2] === 'professor') {
    const labSessionId = parts[3];
    if (!labSessionId) { ws.close(1008, 'labSessionId required'); return; }
    if (!professorConnections.has(labSessionId)) professorConnections.set(labSessionId, new Set());
    professorConnections.get(labSessionId).add(ws);
    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch (_) {}
    });
    ws.on('close', () => {
      const conns = professorConnections.get(labSessionId);
      if (conns) { conns.delete(ws); if (!conns.size) professorConnections.delete(labSessionId); }
    });
    return;
  }

  // ── In-class / regular sessions: /sessions/:sessionId ─────────────────
  const sessionId = parts[2];
  if (!sessionId) { ws.close(1008, 'sessionId required'); return; }

  // FIX: Auto-create the room if it doesn't exist (handles server restarts).
  // The deterministic ID means this is idempotent: all clients with the same
  // table+session+date land in the same room even after a cold start.
  const session = getOrCreateSession(sessionId);
  if (!sessionConnections.has(sessionId)) sessionConnections.set(sessionId, []);

  let userName = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Security: verify the WS sessionId against the session's stored key so
      // a crafted message can't broadcast into a different room.
      if (msg.sessionId && msg.sessionId !== sessionId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session ID mismatch — message rejected' }));
        return;
      }

      switch (msg.type) {

        case 'join': {
          // FIX: Accept the resolvedName from the HTTP join step (handles
          // name collisions) while falling back to msg.userName.
          userName = msg.resolvedName || msg.userName;
          if (!userName) break;

          // Cancel any pending disconnect grace-period timer for this user
          // (e.g., they refreshed and are reconnecting within 15 s).
          if (session._disconnectTimers) {
            const timerKey = `${sessionId}:${userName}`;
            if (session._disconnectTimers.has(timerKey)) {
              clearTimeout(session._disconnectTimers.get(timerKey));
              session._disconnectTimers.delete(timerKey);
            }
          }

          // Update participant record if it exists, otherwise create it.
          // Track whether this is a genuine new join (vs. reconnect) so we
          // only fire participant_joined for real arrivals.
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
            const p = session.participants.get(userName);
            if (msg.avatar) p.avatar = msg.avatar;
            if (msg.color)  p.color  = msg.color;
          }

          // Register WS connection
          sessionConnections.get(sessionId).push({ ws, userName });

          // Only notify others of a join if this is NOT a reconnect.
          // Reconnects (within the 15 s grace period) are transparent to other participants.
          if (isNewJoin) {
            broadcastToSession(sessionId, {
              type: 'participant_joined',
              userName,
              timestamp: new Date().toISOString(),
            }, ws); // excludeWs = ws → everyone except the joiner
          }

          // Send session_info to the joiner — includes isReconnect flag so
          // the client can skip adding a "You joined" system message on reconnect.
          ws.send(JSON.stringify({
            type:        'session_info',
            sessionTitle: session.sessionTitle,
            isPublic:     session.isPublic,
            participants: Array.from(session.participants.values()),
            isReconnect:  !isNewJoin,
          }));

          // FIX: Broadcast participants_update to ALL (including joiner) so
          // every client's count and list updates immediately.
          broadcastToSession(sessionId, {
            type:         'participants_update',
            participants: Array.from(session.participants.values()),
          }); // excludeWs = null → everyone

          // Send existing history to the joiner so they see prior messages
          if (session.messages.length > 0) {
            ws.send(JSON.stringify({
              type:     'session_history',
              messages: session.messages,
            }));
          }
          break;
        }

        case 'message': {
          if (!userName) break;

          // FIX: Use the WS-authenticated userName (not msg.userName which is
          // client-supplied and could be spoofed to appear as another student).
          const msgObj = {
            id:        uuidv4(),
            message:   msg.message,
            sender:    msg.sender,
            userName,              // server-authoritative name, not client-supplied
            timestamp: new Date().toISOString(),
            files:     msg.files     || [],
            citations: msg.citations || [],
          };
          session.messages.push(msgObj);
          session.lastActivity = new Date();

          // FIX: Broadcast to ALL clients including sender so every client
          // renders via addSharedMessage (uniform code path).
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

        case 'leave': {
          if (!userName) break;
          // Cancel any pending grace-period disconnect timer
          if (session._disconnectTimers) {
            const timerKey = `${sessionId}:${userName}`;
            if (session._disconnectTimers.has(timerKey)) {
              clearTimeout(session._disconnectTimers.get(timerKey));
              session._disconnectTimers.delete(timerKey);
            }
          }
          session.participants.delete(userName);
          const conns = sessionConnections.get(sessionId) || [];
          const idx = conns.findIndex(c => c.ws === ws);
          if (idx > -1) conns.splice(idx, 1);

          // FIX: Send BOTH participant_left AND participants_update so every
          // remaining client gets the updated count without needing a page refresh.
          broadcastToSession(sessionId, {
            type:      'participant_left',
            userName,
            timestamp: new Date().toISOString(),
          });
          broadcastToSession(sessionId, {
            type:         'participants_update',
            participants: Array.from(session.participants.values()),
          });

          // Clean up empty rooms (non-in-class only; in-class rooms auto-recreate)
          if (session.participants.size === 0 && !sessionId.match(/^T\d+-S\d+-\d{4}-\d{2}-\d{2}$/)) {
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

        default:
          break;
      }
    } catch (e) {
      console.error('[WS] message error:', e);
    }
  });

  ws.on('close', () => {
    if (!userName) return;

    // Remove this WS connection from the connections list
    const conns = sessionConnections.get(sessionId) || [];
    const idx = conns.findIndex(c => c.ws === ws);
    if (idx > -1) conns.splice(idx, 1);

    // Check if the user still has another active connection (e.g., multiple tabs).
    const stillConnected = conns.some(c => c.userName === userName && c.ws.readyState === 1 /* OPEN */);
    if (stillConnected) return; // don't remove participant — another tab is still live

    // FIX: Grace period (15 s) before removing participant.
    // This prevents "X left / X joined" spam when a student refreshes the page
    // or when a transient network hiccup drops the WS for a few seconds.
    // Mirrors the physics_ai_tutor implementation.
    if (!session._disconnectTimers) session._disconnectTimers = new Map();
    const timerKey = `${sessionId}:${userName}`;

    // Clear any previous timer for this user (e.g., rapid reconnect)
    if (session._disconnectTimers.has(timerKey)) {
      clearTimeout(session._disconnectTimers.get(timerKey));
    }

    session._disconnectTimers.set(timerKey, setTimeout(() => {
      session._disconnectTimers.delete(timerKey);

      // Re-check: maybe the user reconnected during the grace period
      const activeConns = (sessionConnections.get(sessionId) || [])
        .filter(c => c.userName === userName && c.ws.readyState === 1 /* OPEN */);
      if (activeConns.length > 0) return; // reconnected — don't remove

      session.participants.delete(userName);

      // Broadcast BOTH participant_left AND participants_update so remaining
      // clients immediately see the updated count.
      broadcastToSession(sessionId, {
        type:      'participant_left',
        userName,
        timestamp: new Date().toISOString(),
      });
      broadcastToSession(sessionId, {
        type:         'participants_update',
        participants: Array.from(session.participants.values()),
      });

      // Only delete non-in-class rooms when empty (in-class rooms are auto-recreated)
      const isInClassRoom = /^T\d+-S\d+-\d{4}-\d{2}-\d{2}$/.test(sessionId);
      if (session.participants.size === 0 && !isInClassRoom) {
        sessions.delete(sessionId);
        sessionConnections.delete(sessionId);
      }
    }, 15000)); // 15-second grace period
  });
});

// ── Static / health ────────────────────────────────────────────────────────
const TUTOR_HTML = path.resolve(__dirname, 'tutor.html');
app.get('/', (req, res) => res.sendFile(TUTOR_HTML));
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'AI Tutor backend is running' }));

connectMongo();
connectInClassMongo();

server.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
});
