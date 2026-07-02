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
  createInClassSessionRecord,
  addStudentToInClassSession,
  recordInClassLogin,
  recordInClassLogout,
} from '../config/mongodb.js';

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
  } catch (err) {
    console.error('[in-class] login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/in-class/activity/logout
router.post('/activity/logout', async (req, res) => {
  try {
    const { activityId } = req.body;
    if (!activityId) return res.status(400).json({ error: 'activityId is required' });
    const record = await recordInClassLogout(activityId);
    if (!record) return res.status(404).json({ error: 'Activity record not found' });
    res.json({ ok: true, durationSeconds: record.durationSeconds });
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
router.get('/chat/by-session/:sessionId', async (req, res) => {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).json({ error: 'In-class DB not connected' });

    const InClassChat = getInClassChatModel();
    const convo = await InClassChat.findOne({ sessionId: req.params.sessionId });
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json(convo);
  } catch (err) {
    console.error('[in-class] by-session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/in-class/chat  — list by email or sessionId
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
      { new: true, select: '_id title' }
    );
    if (!convo) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
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
