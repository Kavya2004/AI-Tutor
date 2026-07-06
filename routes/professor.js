/**
 * routes/professor.js
 * All professor-facing endpoints for the classroom management dashboard.
 * Mounted at /api/professor
 */
import express from 'express';
import {
  connectInClassMongo,
  getLabSessionModel,
  getLabAssignmentModel,
  getProfessorEventModel,
  getInClassSessionModel,
  getInClassChatModel,
  getInClassUserActivityModel,
} from '../config/mongodb.js';
import { broadcastToProfessors } from '../lib/professor-ws.js';

const router = express.Router();

// Shared helper — ensure in-class DB is connected
async function requireDb(res) {
  const ok = await connectInClassMongo();
  if (!ok) { res.status(503).json({ error: 'In-class DB not connected' }); return false; }
  return true;
}

// ── Lab Session CRUD ───────────────────────────────────────────────────────

// POST /api/professor/lab-sessions
router.post('/lab-sessions', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const { course, labNumber, title, sections = [], tables = [], createdBy = {} } = req.body;
    if (!course || !labNumber) return res.status(400).json({ error: 'course and labNumber are required' });
    const LabSession = getLabSessionModel();
    const session = await LabSession.create({ course, labNumber, title: title || `${course} ${labNumber}`, sections, tables, createdBy });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/professor/lab-sessions  — list (active first, then recent)
router.get('/lab-sessions', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const LabSession = getLabSessionModel();
    const sessions = await LabSession.find({}).sort({ status: 1, createdAt: -1 }).limit(100).lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/professor/lab-sessions/:id
router.get('/lab-sessions/:id', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const LabSession = getLabSessionModel();
    const session = await LabSession.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/professor/lab-sessions/:id/end
router.patch('/lab-sessions/:id/end', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const LabSession = getLabSessionModel();
    const session = await LabSession.findByIdAndUpdate(req.params.id, { status: 'ended', endedAt: new Date() }, { new: true });
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/professor/lab-sessions/:id/archive
router.patch('/lab-sessions/:id/archive', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const LabSession = getLabSessionModel();
    const session = await LabSession.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/professor/lab-sessions/:id/duplicate  — clone a previous session as new active
router.post('/lab-sessions/:id/duplicate', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const LabSession = getLabSessionModel();
    const src = await LabSession.findById(req.params.id).lean();
    if (!src) return res.status(404).json({ error: 'Not found' });
    const { _id, createdAt, updatedAt, status, endedAt, assignment, ...rest } = src;
    const copy = await LabSession.create({ ...rest, status: 'active', endedAt: null, assignment: null });
    res.json(copy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Assignment Upload & Distribution ──────────────────────────────────────

// POST /api/professor/lab-sessions/:id/assignment
// Body: { files: [{name, mimeType, data (base64), size}], uploadedBy, extractedText }
router.post('/lab-sessions/:id/assignment', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const { files, uploadedBy = {}, extractedText = '' } = req.body;
    if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'files array is required' });

    const LabSession = getLabSessionModel();
    const LabAssignment = getLabAssignmentModel();

    const labSession = await LabSession.findById(req.params.id);
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    const assignment = await LabAssignment.create({ labSessionId: labSession._id, files, extractedText, uploadedBy });
    labSession.assignment = assignment._id;
    await labSession.save();

    // Emit a professor event so the WS layer can push it to all tables
    const ProfessorEvent = getProfessorEventModel();
    await ProfessorEvent.create({
      labSessionId: labSession._id,
      type: 'assignment_distributed',
      payload: { assignmentId: assignment._id.toString(), fileCount: files.length, extractedText },
    });

    res.json({ assignmentId: assignment._id.toString(), fileCount: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/professor/lab-sessions/:id/assignment
router.get('/lab-sessions/:id/assignment', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const LabSession = getLabSessionModel();
    const LabAssignment = getLabAssignmentModel();
    const labSession = await LabSession.findById(req.params.id).lean();
    if (!labSession) return res.status(404).json({ error: 'Not found' });
    if (!labSession.assignment) return res.json(null);
    const assignment = await LabAssignment.findById(labSession.assignment).lean();
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Live Classroom State ───────────────────────────────────────────────────

// GET /api/professor/classroom/:labSessionId/state
// Returns all active in-class sessions + activity for this lab session
router.get('/classroom/:labSessionId/state', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassSession = getInClassSessionModel();
    const InClassChat = getInClassChatModel();
    const InClassUserActivity = getInClassUserActivityModel();
    const LabSession = getLabSessionModel();
    const LabAssignment = getLabAssignmentModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    // All attendance records for this lab's session number
    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const attendanceRecords = await InClassSession.find({ sessionNumber }).lean();

    // All activity records (online = no logoutTime)
    const activityRecords = await InClassUserActivity.find({ sessionNumber }).lean();
    const onlineEmails = new Set(activityRecords.filter(a => !a.logoutTime).map(a => a.email));

    // All chat records for this session
    const chatRecords = await InClassChat.find({ sessionNumber }).lean();

    // Build per-table state
    const tableMap = {};
    for (const rec of attendanceRecords) {
      const t = rec.tableNumber;
      if (!tableMap[t]) tableMap[t] = { tableNumber: t, students: [], chatMessageCount: 0, lastActivity: null };
      tableMap[t].students.push(...rec.students.map(s => ({
        ...s,
        online: onlineEmails.has(s.email),
      })));
    }
    for (const chat of chatRecords) {
      const t = chat.tableNumber;
      if (tableMap[t]) {
        tableMap[t].chatMessageCount = chat.messages.length;
        tableMap[t].lastActivity = chat.updatedAt;
        tableMap[t].recentMessages = chat.messages.slice(-5);
      }
    }

    const assignment = labSession.assignment
      ? await LabAssignment.findById(labSession.assignment, { 'files.data': 0 }).lean()
      : null;

    res.json({
      labSession,
      assignment,
      tables: Object.values(tableMap),
      studentsOnline: onlineEmails.size,
      studentsTotal: activityRecords.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/professor/classroom/:labSessionId/table/:tableNumber
router.get('/classroom/:labSessionId/table/:tableNumber', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassChat = getInClassChatModel();
    const InClassSession = getInClassSessionModel();
    const InClassUserActivity = getInClassUserActivityModel();
    const LabSession = getLabSessionModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const tableNumber = parseInt(req.params.tableNumber);

    const attendance = await InClassSession.findOne({ tableNumber, sessionNumber }).lean();
    const chat = await InClassChat.findOne({ tableNumber, sessionNumber }).lean();
    const activity = await InClassUserActivity.find({ tableNumber, sessionNumber }).lean();

    res.json({ tableNumber, attendance, chat, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/professor/classroom/:labSessionId/student/:email
router.get('/classroom/:labSessionId/student/:email', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassUserActivity = getInClassUserActivityModel();
    const InClassChat = getInClassChatModel();
    const LabSession = getLabSessionModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const email = decodeURIComponent(req.params.email);

    const activity = await InClassUserActivity.find({ email, sessionNumber }).sort({ loginTime: -1 }).lean();
    const tableNumber = activity[0]?.tableNumber;
    const chat = tableNumber ? await InClassChat.findOne({ tableNumber, sessionNumber }).lean() : null;

    const studentMessages = chat
      ? chat.messages.filter(m => m.userName === activity[0]?.name || m.role === 'user')
      : [];

    res.json({ email, activity, tableNumber, messages: studentMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Professor Broadcast / Messaging ───────────────────────────────────────

// POST /api/professor/broadcast
// Body: { labSessionId, type: 'all'|'table'|'section', target, message }
router.post('/broadcast', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const { labSessionId, type, target, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const ProfessorEvent = getProfessorEventModel();
    const event = await ProfessorEvent.create({
      labSessionId: labSessionId || null,
      type: `broadcast_${type || 'all'}`,
      payload: { target, message, sentAt: new Date().toISOString() },
    });

    // The WS layer in server.js picks this up and pushes to relevant clients
    res.json({ ok: true, eventId: event._id.toString() });
    // Push updated state to any connected professor dashboards
    if (labSessionId) setImmediate(() => pushClassroomState(labSessionId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────

// GET /api/professor/analytics/:labSessionId
router.get('/analytics/:labSessionId', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassUserActivity = getInClassUserActivityModel();
    const InClassChat = getInClassChatModel();
    const InClassSession = getInClassSessionModel();
    const LabSession = getLabSessionModel();
    const ProfessorEvent = getProfessorEventModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Not found' });

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;

    const allActivity    = await InClassUserActivity.find({ sessionNumber }).lean();
    const allChats       = await InClassChat.find({ sessionNumber }).lean();
    const allAttendance  = await InClassSession.find({ sessionNumber }).lean();
    const helpEvents     = await ProfessorEvent.find({ labSessionId: labSession._id, type: 'help_request' }).lean();
    const resolvedEvents = await ProfessorEvent.find({ labSessionId: labSession._id, type: 'help_resolved' }).lean();

    const online = allActivity.filter(a => !a.logoutTime).length;
    const total  = allActivity.length;

    // ── Per-table stats ──────────────────────────────────────────────────
    const tableMap = {};
    for (const rec of allAttendance) {
      const t = rec.tableNumber;
      if (!tableMap[t]) tableMap[t] = { tableNumber: t, studentCount: 0, userMessages: 0, botMessages: 0,
        hintCount: 0, uploadCount: 0, responseTimes: [], total: 0, lastActivity: null };
      tableMap[t].studentCount += rec.students.length;
    }
    for (const chat of allChats) {
      const t = chat.tableNumber;
      if (!tableMap[t]) tableMap[t] = { tableNumber: t, studentCount: 0, userMessages: 0, botMessages: 0,
        hintCount: 0, uploadCount: 0, responseTimes: [], total: 0, lastActivity: null };
      const msgs = chat.messages;
      tableMap[t].total        = msgs.length;
      tableMap[t].lastActivity = chat.updatedAt;
      tableMap[t].userMessages = msgs.filter(m => m.role === 'user').length;
      tableMap[t].botMessages  = msgs.filter(m => m.role === 'bot').length;
      tableMap[t].hintCount    = msgs.filter(m => m.role === 'bot' && /hint/i.test(m.content)).length;
      tableMap[t].uploadCount  = msgs.filter(m => m.role === 'user' && /\[image\]|\[file\]|uploaded/i.test(m.content)).length;
      // Response time: ms between consecutive user→bot pairs
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].role === 'user' && msgs[i + 1].role === 'bot') {
          const diff = new Date(msgs[i + 1].timestamp) - new Date(msgs[i].timestamp);
          if (diff > 0 && diff < 120000) tableMap[t].responseTimes.push(diff);
        }
      }
    }

    const tableStats = Object.values(tableMap);
    const sorted     = [...tableStats].sort((a, b) => b.total - a.total);

    // ── Averages ─────────────────────────────────────────────────────────
    const n = tableStats.length || 1;
    const avgMessages  = Math.round(tableStats.reduce((s, t) => s + t.total, 0) / n);
    const avgUploads   = +(tableStats.reduce((s, t) => s + t.uploadCount, 0) / n).toFixed(1);
    const avgHints     = +(tableStats.reduce((s, t) => s + t.hintCount, 0) / n).toFixed(1);
    const allRTs       = tableStats.flatMap(t => t.responseTimes);
    const avgResponseMs = allRTs.length ? Math.round(allRTs.reduce((s, v) => s + v, 0) / allRTs.length) : 0;

    // ── Online-over-time: bucket logins by 5-min intervals ───────────────
    const loginBuckets = {};
    const logoutBuckets = {};
    for (const a of allActivity) {
      const lb = new Date(Math.floor(new Date(a.loginTime).getTime() / 300000) * 300000).toISOString();
      loginBuckets[lb] = (loginBuckets[lb] || 0) + 1;
      if (a.logoutTime) {
        const lo = new Date(Math.floor(new Date(a.logoutTime).getTime() / 300000) * 300000).toISOString();
        logoutBuckets[lo] = (logoutBuckets[lo] || 0) + 1;
      }
    }
    const allBuckets = [...new Set([...Object.keys(loginBuckets), ...Object.keys(logoutBuckets)])].sort();
    let running = 0;
    const onlineOverTime = allBuckets.map(t => {
      running += (loginBuckets[t] || 0) - (logoutBuckets[t] || 0);
      return { time: t, count: Math.max(0, running) };
    });

    // ── Participation: unique students who sent ≥1 message ───────────────
    const activeEmails = new Set();
    for (const chat of allChats) {
      for (const m of chat.messages) {
        if (m.role === 'user' && m.userName) activeEmails.add(m.userName);
      }
    }
    const participationRate = total > 0 ? Math.round((activeEmails.size / total) * 100) : 0;

    // ── Difficult questions: most-repeated user message stems ────────────
    const questionFreq = {};
    for (const chat of allChats) {
      for (const m of chat.messages) {
        if (m.role !== 'user') continue;
        const stem = m.content.trim().slice(0, 80).toLowerCase();
        questionFreq[stem] = (questionFreq[stem] || 0) + 1;
      }
    }
    const difficultQuestions = Object.entries(questionFreq)
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([q, count]) => ({ question: q, count }));

    // ── Intervention frequency: help events per table ────────────────────
    const helpByTable = {};
    for (const ev of helpEvents) {
      const t = ev.payload?.tableNumber;
      if (t) helpByTable[t] = (helpByTable[t] || 0) + 1;
    }
    const resolvedByTable = {};
    for (const ev of resolvedEvents) {
      const t = ev.payload?.tableNumber;
      if (t) resolvedByTable[t] = (resolvedByTable[t] || 0) + 1;
    }
    const interventionStats = Object.entries(helpByTable)
      .map(([t, helpCount]) => ({ tableNumber: parseInt(t), helpCount, resolvedCount: resolvedByTable[t] || 0 }))
      .sort((a, b) => b.helpCount - a.helpCount);

    // ── AI confidence proxy: ratio of hint-free bot responses ────────────
    // Higher = AI answered directly without needing hints
    const confidenceByTable = tableStats.map(t => ({
      tableNumber: t.tableNumber,
      confidence: t.botMessages > 0
        ? Math.round(((t.botMessages - t.hintCount) / t.botMessages) * 100)
        : 0,
    })).sort((a, b) => a.tableNumber - b.tableNumber);

    res.json({
      // Summary
      studentsOnline: online,
      studentsTotal: total,
      participationRate,
      activeStudents: activeEmails.size,
      totalMessages: tableStats.reduce((s, t) => s + t.total, 0),
      avgMessagesPerTable: avgMessages,
      avgUploadsPerTable: avgUploads,
      avgHintsPerTable: avgHints,
      avgResponseMs,
      // Table rankings
      tableStats: sorted,
      mostActiveTables: sorted.slice(0, 5),
      leastActiveTables: [...sorted].reverse().slice(0, 5),
      tablesNeedingIntervention: sorted.filter(t => t.total < 3),
      // Charts
      onlineOverTime,
      difficultQuestions,
      interventionStats,
      confidenceByTable,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Internal helper: fetch classroom state and push to WS subscribers ─────
async function pushClassroomState(labSessionId) {
  try {
    const InClassSession = getInClassSessionModel();
    const InClassChat = getInClassChatModel();
    const InClassUserActivity = getInClassUserActivityModel();
    const LabSession = getLabSessionModel();

    const labSession = await LabSession.findById(labSessionId).lean();
    if (!labSession) return;

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const attendanceRecords = await InClassSession.find({ sessionNumber }).lean();
    const activityRecords = await InClassUserActivity.find({ sessionNumber }).lean();
    const onlineEmails = new Set(activityRecords.filter(a => !a.logoutTime).map(a => a.email));
    const chatRecords = await InClassChat.find({ sessionNumber }).lean();

    const tableMap = {};
    for (const rec of attendanceRecords) {
      const t = rec.tableNumber;
      if (!tableMap[t]) tableMap[t] = { tableNumber: t, students: [], chatMessageCount: 0, lastActivity: null, recentMessages: [] };
      tableMap[t].students.push(...rec.students.map(s => ({ ...s, online: onlineEmails.has(s.email) })));
    }
    for (const chat of chatRecords) {
      const t = chat.tableNumber;
      if (tableMap[t]) {
        tableMap[t].chatMessageCount = chat.messages.length;
        tableMap[t].lastActivity = chat.updatedAt;
        tableMap[t].recentMessages = chat.messages.slice(-5);
      }
    }

    broadcastToProfessors(labSessionId, {
      labSession,
      tables: Object.values(tableMap),
      studentsOnline: onlineEmails.size,
      studentsTotal: activityRecords.length,
    });
  } catch (err) {
    console.error('[professor-ws] pushClassroomState error:', err.message);
  }
}

// GET /api/professor/classroom/:labSessionId/sections
// Returns tables grouped by section, with per-table stats
router.get('/classroom/:labSessionId/sections', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassSession = getInClassSessionModel();
    const InClassChat = getInClassChatModel();
    const InClassUserActivity = getInClassUserActivityModel();
    const LabSession = getLabSessionModel();
    const ProfessorEvent = getProfessorEventModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const attendanceRecords = await InClassSession.find({ sessionNumber }).lean();
    const activityRecords   = await InClassUserActivity.find({ sessionNumber }).lean();
    const chatRecords       = await InClassChat.find({ sessionNumber }).lean();
    const helpEvents        = await ProfessorEvent.find({ labSessionId: labSession._id, type: 'help_request' }).lean();
    const resolvedEvents    = await ProfessorEvent.find({ labSessionId: labSession._id, type: 'help_resolved' }).lean();
    const followUpEvents    = await ProfessorEvent.find({ labSessionId: labSession._id, type: 'follow_up' }).lean();

    const onlineEmails = new Set(activityRecords.filter(a => !a.logoutTime).map(a => a.email));
    const resolvedTables = new Set(resolvedEvents.map(e => e.payload?.tableNumber));
    const followUpTables = new Set(followUpEvents.map(e => e.payload?.tableNumber));

    // Build per-table map
    const tableMap = {};
    for (const rec of attendanceRecords) {
      const t = rec.tableNumber;
      if (!tableMap[t]) tableMap[t] = {
        tableNumber: t,
        students: [],
        chatMessageCount: 0,
        hintCount: 0,
        uploadCount: 0,
        helpRequested: false,
        followUp: false,
        lastActivity: null,
        recentMessages: [],
      };
      tableMap[t].students.push(...rec.students.map(s => ({ ...s, online: onlineEmails.has(s.email) })));
    }
    for (const chat of chatRecords) {
      const t = chat.tableNumber;
      if (!tableMap[t]) continue;
      tableMap[t].chatMessageCount = chat.messages.length;
      tableMap[t].lastActivity = chat.updatedAt;
      tableMap[t].recentMessages = chat.messages.slice(-5);
      // Hint count = bot messages that contain "hint" (case-insensitive)
      tableMap[t].hintCount = chat.messages.filter(m => m.role === 'bot' && /hint/i.test(m.content)).length;
      // Upload count = user messages that reference an image/file upload
      tableMap[t].uploadCount = chat.messages.filter(m => m.role === 'user' && /\[image\]|\[file\]|uploaded/i.test(m.content)).length;
    }
    for (const ev of helpEvents) {
      const t = ev.payload?.tableNumber;
      if (t && tableMap[t] && !resolvedTables.has(t)) tableMap[t].helpRequested = true;
    }
    for (const t of followUpTables) {
      if (tableMap[t]) tableMap[t].followUp = true;
    }

    // Assign tables to sections based on labSession.sections + labSession.tables
    const sections = labSession.sections || [];
    const allTableNums = labSession.tables || [];
    const tablesPerSection = sections.length > 0 ? Math.ceil(allTableNums.length / sections.length) : allTableNums.length;

    const sectionData = sections.length > 0
      ? sections.map((sec, si) => {
          const start = si * tablesPerSection + 1;
          const end   = start + tablesPerSection - 1;
          const sectionTables = Object.values(tableMap).filter(t => t.tableNumber >= start && t.tableNumber <= end);
          return { section: sec, tables: sectionTables.sort((a, b) => a.tableNumber - b.tableNumber) };
        })
      : [{ section: 'All', tables: Object.values(tableMap).sort((a, b) => a.tableNumber - b.tableNumber) }];

    res.json({ sections: sectionData, labSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/professor/classroom/:labSessionId/table/:tableNumber/resolve-help
router.post('/classroom/:labSessionId/table/:tableNumber/resolve-help', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const ProfessorEvent = getProfessorEventModel();
    await ProfessorEvent.create({
      labSessionId: req.params.labSessionId,
      type: 'help_resolved',
      payload: { tableNumber: parseInt(req.params.tableNumber) },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/professor/classroom/:labSessionId/table/:tableNumber/follow-up
router.post('/classroom/:labSessionId/table/:tableNumber/follow-up', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const ProfessorEvent = getProfessorEventModel();
    await ProfessorEvent.create({
      labSessionId: req.params.labSessionId,
      type: 'follow_up',
      payload: { tableNumber: parseInt(req.params.tableNumber), note: req.body.note || '' },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/professor/classroom/:labSessionId/students
// Flat roster: every student with name, email, table, section, online, joinTime, lastActivity
router.get('/classroom/:labSessionId/students', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassSession = getInClassSessionModel();
    const InClassUserActivity = getInClassUserActivityModel();
    const InClassChat = getInClassChatModel();
    const LabSession = getLabSessionModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const attendanceRecords = await InClassSession.find({ sessionNumber }).lean();
    const activityRecords   = await InClassUserActivity.find({ sessionNumber }).lean();
    const chatRecords       = await InClassChat.find({ sessionNumber }).lean();

    // Build section lookup: tableNumber → section label
    const sections = labSession.sections || [];
    const allTables = labSession.tables || [];
    const tps = sections.length > 0 ? Math.ceil(allTables.length / sections.length) : 0;
    const sectionForTable = (t) => {
      if (!sections.length || !tps) return '—';
      const idx = Math.floor((t - 1) / tps);
      return sections[idx] ?? '—';
    };

    // Online set and last-activity map per email
    const onlineEmails = new Set(activityRecords.filter(a => !a.logoutTime).map(a => a.email));
    const lastActivityByEmail = {};
    for (const chat of chatRecords) {
      for (const msg of chat.messages) {
        if (msg.role !== 'user' || !msg.userName) continue;
        // match by userName — best effort
        const existing = lastActivityByEmail[msg.userName];
        if (!existing || new Date(msg.timestamp) > new Date(existing)) {
          lastActivityByEmail[msg.userName] = msg.timestamp;
        }
      }
    }
    // Also use activity loginTime as fallback
    const loginTimeByEmail = {};
    const tableByEmail = {};
    for (const a of activityRecords) {
      if (!loginTimeByEmail[a.email] || new Date(a.loginTime) > new Date(loginTimeByEmail[a.email])) {
        loginTimeByEmail[a.email] = a.loginTime;
        tableByEmail[a.email] = a.tableNumber;
      }
    }

    // Collect unique students from attendance records
    const seen = new Set();
    const students = [];
    for (const rec of attendanceRecords) {
      for (const s of rec.students) {
        if (seen.has(s.email)) continue;
        seen.add(s.email);
        const tableNum = tableByEmail[s.email] ?? rec.tableNumber;
        students.push({
          name:         s.name,
          email:        s.email,
          tableNumber:  tableNum,
          section:      sectionForTable(tableNum),
          online:       onlineEmails.has(s.email),
          joinTime:     s.joinedAt ?? loginTimeByEmail[s.email] ?? null,
          lastActivity: lastActivityByEmail[s.name] ?? loginTimeByEmail[s.email] ?? null,
        });
      }
    }

    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json({ students, labSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/professor/classroom/:labSessionId/student/:email/move
// Body: { toTable: Number }
router.post('/classroom/:labSessionId/student/:email/move', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const InClassUserActivity = getInClassUserActivityModel();
    const InClassSession = getInClassSessionModel();
    const LabSession = getLabSessionModel();

    const labSession = await LabSession.findById(req.params.labSessionId).lean();
    if (!labSession) return res.status(404).json({ error: 'Lab session not found' });

    const sessionNumber = parseInt(labSession.labNumber.replace(/\D/g, '')) || 1;
    const email = decodeURIComponent(req.params.email);
    const toTable = parseInt(req.body.toTable);
    if (!toTable) return res.status(400).json({ error: 'toTable is required' });

    // Update the most recent activity record
    await InClassUserActivity.findOneAndUpdate(
      { email, sessionNumber, logoutTime: null },
      { tableNumber: toTable },
    );

    // Move student entry in InClassSession records
    const fromRecord = await InClassSession.findOne({ sessionNumber, 'students.email': email });
    if (fromRecord) {
      const student = fromRecord.students.find(s => s.email === email);
      fromRecord.students = fromRecord.students.filter(s => s.email !== email);
      await fromRecord.save();
      if (student) {
        let toRecord = await InClassSession.findOne({ tableNumber: toTable, sessionNumber });
        if (!toRecord) {
          toRecord = await InClassSession.create({ tableNumber: toTable, sessionNumber, students: [] });
        }
        toRecord.students.push({ ...student.toObject?.() ?? student, joinedAt: new Date() });
        await toRecord.save();
      }
    }

    res.json({ ok: true, email, toTable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/professor/classroom/:labSessionId/notify
// Called by in-class routes after any state-changing write to trigger a WS push
router.post('/classroom/:labSessionId/notify', async (req, res) => {
  if (!await requireDb(res)) return;
  await pushClassroomState(req.params.labSessionId);
  res.json({ ok: true });
});

// ── Recent Events ──────────────────────────────────────────────────────────

// GET /api/professor/events/:labSessionId
router.get('/events/:labSessionId', async (req, res) => {
  if (!await requireDb(res)) return;
  try {
    const ProfessorEvent = getProfessorEventModel();
    const events = await ProfessorEvent.find({ labSessionId: req.params.labSessionId })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
