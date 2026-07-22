/**
 * routes/in-class.js
 * All in-class routes — write to the separate MONGODB_URI_INCLASS database.
 */
import express from 'express';
import {
  connectInClassMongo,
  getInClassSessionModel,
  getInClassChatModel,
  getInClassUserActivityModel,
  getLabSessionModel,
  getProfessorEventModel,
  createInClassSessionRecord,
  addStudentToInClassSession,
  recordInClassLogin,
  recordInClassLogout,
} from '../config/mongodb.js';
import { broadcastToProfessors } from '../lib/professor-ws.js';

// Find the active lab session for a given sessionNumber and push a WS event
async function notifyProfessors(sessionNumber, eventType, payload = {}) {
  try {
    const LabSession = getLabSessionModel();
    const labSession = await LabSession.findOne({ status: 'active' }).lean();
    if (!labSession) return;
    const labNum = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    if (labNum !== sessionNumber) return;
    const ProfessorEvent = getProfessorEventModel();
    await ProfessorEvent.create({ labSessionId: labSession._id, type: eventType, payload });
    broadcastToProfessors(labSession._id.toString(), { event: eventType, payload });
  } catch (err) {
    console.error('[in-class] notifyProfessors error:', err.message);
  }
}

const router = express.Router();

// ── Attendance / session records ───────────────────────────────────────────

// POST /api/in-class/sessions  — create a new attendance record
router.post('/sessions', async (req, res) => {
  try {
    const { tableNumber, sessionNumber, hostName, hostEmail } = req.body;
    if (!tableNumber || !sessionNumber) {
      return res.status(400).json({ error: 'tableNumber and sessionNumber are required' });
    }
    const record = await createInClassSessionRecord({ tableNumber, sessionNumber, hostName, hostEmail });
    if (!record) return res.status(500).json({ error: 'Could not create session record' });
    res.json({ _id: record._id.toString(), tableNumber: record.tableNumber, sessionNumber: record.sessionNumber });
  } catch (err) {
    console.error('[in-class] create session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/in-class/sessions/:id/join  — add a student to the attendance record
router.post('/sessions/:id/join', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
    const record = await addStudentToInClassSession({ sessionRecordId: req.params.id, name, email });
    if (!record) return res.status(404).json({ error: 'Session record not found' });
    res.json({ ok: true });
    setImmediate(() => notifyProfessors(record.sessionNumber, 'student_join', {
      name, email, tableNumber: record.tableNumber,
    }));
  } catch (err) {
    console.error('[in-class] join session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Activity (login / logout) ──────────────────────────────────────────────

// POST /api/in-class/activity/login
router.post('/activity/login', async (req, res) => {
  try {
    const { email, name, tableNumber, sessionNumber } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const record = await recordInClassLogin({ email, name, tableNumber, sessionNumber });
    if (!record) return res.status(500).json({ error: 'Could not record login' });
    res.json({ activityId: record._id.toString(), loginTime: record.loginTime });
    setImmediate(() => notifyProfessors(sessionNumber, 'student_join', { name, email, tableNumber }));
  } catch (err) {
    console.error('[in-class] login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/in-class/activity/logout
router.post('/activity/logout', async (req, res) => {
  try {
    const { activityId, email, name, tableNumber, sessionNumber } = req.body;
    if (!activityId) return res.status(400).json({ error: 'activityId is required' });
    const record = await recordInClassLogout(activityId);
    if (!record) return res.status(404).json({ error: 'Activity record not found' });
    res.json({ ok: true, durationSeconds: record.durationSeconds });
    const sn = sessionNumber ?? record.sessionNumber;
    setImmediate(() => notifyProfessors(sn, 'student_leave', {
      email: email ?? record.email,
      name: name ?? record.name,
      tableNumber: tableNumber ?? record.tableNumber,
    }));
  } catch (err) {
    console.error('[in-class] logout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Shared chat records ────────────────────────────────────────────────────

// POST /api/in-class/chat  — create (idempotent: reuse if exists for sessionId)
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, tableNumber, sessionNumber } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();

    // Idempotent — return existing if already created
    const existing = await InClassChat.findOne({ sessionId });
    if (existing) {
      return res.json({ _id: existing._id.toString(), sessionId: existing.sessionId, title: existing.title });
    }

    const convo = await InClassChat.create({
      sessionId,
      tableNumber: tableNumber || null,
      sessionNumber: sessionNumber || null,
      title: `Table ${tableNumber || '?'} Session ${sessionNumber || '?'}`,
      messages: [],
    });
    res.json({ _id: convo._id.toString(), sessionId: convo.sessionId, title: convo.title });
  } catch (err) {
    console.error('[in-class] create chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// GET /api/in-class/chat/by-session/:sessionId
// Find the shared session chat record by sessionId (legacy / same-day reuse).
router.get('/chat/by-session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  try {
    const Convo = await getChatModel();
    const doc = await Convo.findOne({ sessionId });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/in-class/chat/by-date/:tableNumber/:sessionNumber/:dateKey
// Find today's shared chat record for a given table+session (dateKey = YYYY-MM-DD).
router.get('/chat/by-date/:tableNumber/:sessionNumber/:dateKey', async (req, res) => {
  const { tableNumber, sessionNumber, dateKey } = req.params;
  try {
    const Convo = await getChatModel();
    const doc = await Convo.findOne({
      tableNumber: Number(tableNumber),
      sessionNumber: Number(sessionNumber),
      dateKey,
    });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// POST /api/in-class/chat
// Create the shared session chat record (one per table+session+date).
// Body: { sessionId, sessionTitle, tableNumber, sessionNumber, email, dateKey, title? }
// Idempotent — if a record for this table+session+date already exists, returns it.
router.post('/chat', async (req, res) => {
  const { sessionId, sessionTitle, tableNumber, sessionNumber, email, dateKey, title } = req.body;
  if (!sessionId || !tableNumber || !sessionNumber) {
    return res.status(400).json({ error: 'sessionId, tableNumber, sessionNumber required' });
  }
  const key = dateKey || new Date().toISOString().split('T')[0];
  try {
    const Convo = await getChatModel();
    // Return existing record for this table+session+date if already created
    const existing = await Convo.findOne({
      tableNumber: Number(tableNumber),
      sessionNumber: Number(sessionNumber),
      dateKey: key,
    });
    if (existing) return res.json(existing);
    const doc = await Convo.create({
      sessionId,
      sessionTitle: sessionTitle || `Table ${tableNumber} Session ${sessionNumber}`,
      tableNumber: Number(tableNumber),
      sessionNumber: Number(sessionNumber),
      dateKey: key,
      email: (email || '').trim().toLowerCase(),
      title: title || key,  // title = the date string e.g. "2025-07-15"
      messages: [],
    });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/in-class/chat?email=...
// List all in-class conversations for a student (no messages).

router.get('/chat', async (req, res) => {
  try {
    const { email, sessionId } = req.query;
    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();
    const filter = {};
    if (sessionId) filter.sessionId = sessionId;
    if (email) filter['messages.userName'] = email; // messages attributed by email/name

    const convos = await InClassChat.find(filter, { messages: 0 }).sort({ updatedAt: -1 }).limit(100).lean();
    res.json(convos);
  } catch (err) {
    console.error('[in-class] list chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/in-class/chat/:id  — full conversation with messages
router.get('/chat/:id', async (req, res) => {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();
    const convo = await InClassChat.findById(req.params.id).lean();
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json(convo);
  } catch (err) {
    console.error('[in-class] get chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/in-class/chat/:id/messages  — append messages
router.patch('/chat/:id/messages', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();
    const convo = await InClassChat.findByIdAndUpdate(
      req.params.id,
      { $push: { messages: { $each: messages } } },
      { new: true }
    );
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
    const lastMsg = messages[messages.length - 1];
    const eventType = lastMsg?.role === 'bot'
      ? (/hint/i.test(lastMsg.content || '') ? 'hint_given' : 'ai_response')
      : 'chat_message';
    setImmediate(() => notifyProfessors(convo.sessionNumber, eventType, {
      tableNumber: convo.tableNumber,
      messageCount: convo.messages.length,
      role: lastMsg?.role,
      preview: (lastMsg?.content || '').slice(0, 80),
    }));
  } catch (err) {
    console.error('[in-class] append messages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/in-class/chat/:id/title  — update title
router.patch('/chat/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();
    const convo = await InClassChat.findByIdAndUpdate(req.params.id, { title }, { new: true, select: '_id title' });
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, title: convo.title });
  } catch (err) {
    console.error('[in-class] update title error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/in-class/chat/:id
router.delete('/chat/:id', async (req, res) => {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();
    const result = await InClassChat.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[in-class] delete chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/in-class/dashboard  — HTML attendance table with CSV export
router.get('/dashboard', async (req, res) => {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).send('<p>In-class DB not connected</p>');

    const InClassUserActivity = getInClassUserActivityModel();
    const records = await InClassUserActivity.find({}).sort({ loginTime: -1 }).limit(500).lean();

    const csvRows = ['Name,Email,Table,Session,Login,Logout,Duration(s)'];
    records.forEach(r => {
      csvRows.push([
        r.name || '',
        r.email,
        r.tableNumber || '',
        r.sessionNumber || '',
        r.loginTime ? new Date(r.loginTime).toISOString() : '',
        r.logoutTime ? new Date(r.logoutTime).toISOString() : '',
        r.durationSeconds || '',
      ].join(','));
    });

    const rows = records.map(r => `
      <tr>
        <td>${r.name || ''}</td>
        <td>${r.email}</td>
        <td>${r.tableNumber || ''}</td>
        <td>${r.sessionNumber || ''}</td>
        <td>${r.loginTime ? new Date(r.loginTime).toLocaleString() : ''}</td>
        <td>${r.logoutTime ? new Date(r.logoutTime).toLocaleString() : '—'}</td>
        <td>${r.durationSeconds != null ? r.durationSeconds + 's' : '—'}</td>
      </tr>`).join('');

    res.send(`<!DOCTYPE html><html><head><title>In-Class Dashboard</title>
      <style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:8px 12px;text-align:left}th{background:#881c1c;color:#fff}
      tr:nth-child(even){background:#f9f9f9}a{color:#881c1c}</style></head><body>
      <h2>🏫 In-Class Attendance</h2>
      <p><a href="data:text/csv;charset=utf-8,${encodeURIComponent(csvRows.join('\n'))}" download="attendance.csv">⬇ Download CSV</a></p>
      <table><thead><tr><th>Name</th><th>Email</th><th>Table</th><th>Session</th><th>Login</th><th>Logout</th><th>Duration</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
  } catch (err) {
    console.error('[in-class] dashboard error:', err.message);
    res.status(500).send('<p>Error loading dashboard</p>');
  }
});

export default router;
