import express from 'express';
import { connectMongo, getChatConversationModel } from '../config/mongodb.js';
import { csrfGuard } from '../middleware/csrfGuard.js';

const router = express.Router();

// GET /api/chat-history?email=  — list conversations for a user (titles only)
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const ChatConversation = getChatConversationModel();
    const convos = await ChatConversation
      .find({ email }, { messages: 0 })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    res.json(convos);
  } catch (err) {
    console.error('[chat-history] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat-history
router.post('/', csrfGuard, async (req, res) => {
  try {
    const { email, activityId, loginTime } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const ChatConversation = getChatConversationModel();
    const convo = await ChatConversation.create({
      email,
      title: 'New Conversation',
      messages: [],
      loginSession: {
        activityId: activityId || null,
        loginTime:  loginTime  ? new Date(loginTime) : new Date(),
        logoutTime: null,
        durationSeconds: null,
      },
    });

    res.json({ _id: convo._id.toString(), title: convo.title });
  } catch (err) {
    console.error('[chat-history] create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat-history/:id  — fetch full conversation with messages
router.get('/:id', async (req, res) => {
  try {
    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const ChatConversation = getChatConversationModel();
    const convo = await ChatConversation.findById(req.params.id).lean();
    if (!convo) return res.status(404).json({ error: 'Not found' });

    res.json(convo);
  } catch (err) {
    console.error('[chat-history] get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/chat-history/:id/messages
router.patch('/:id/messages', csrfGuard, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const ChatConversation = getChatConversationModel();
    const convo = await ChatConversation.findByIdAndUpdate(
      req.params.id,
      { $push: { messages: { $each: messages } } },
      { new: true, select: '_id title' }
    );
    if (!convo) return res.status(404).json({ error: 'Not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[chat-history] append messages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/chat-history/:id/title
router.patch('/:id/title', csrfGuard, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const ChatConversation = getChatConversationModel();
    const convo = await ChatConversation.findByIdAndUpdate(
      req.params.id,
      { title },
      { new: true, select: '_id title' }
    );
    if (!convo) return res.status(404).json({ error: 'Not found' });

    res.json({ ok: true, title: convo.title });
  } catch (err) {
    console.error('[chat-history] update title error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat-history/:id
router.delete('/:id', csrfGuard, async (req, res) => {
  try {
    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const ChatConversation = getChatConversationModel();
    const result = await ChatConversation.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[chat-history] delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
