import express from 'express';
import { connectMongo, getUserActivityModel, recordLogin, recordLogout, updateConversationsOnLogout } from '../config/mongodb.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { csrfGuard } from '../middleware/csrfGuard.js';

const router = express.Router();

// POST /api/user-activity/login  — protected: only trusted clients may record logins
router.post('/login', csrfGuard, requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const activity = await recordLogin(email);
    if (!activity) return res.status(500).json({ error: 'Could not record login' });

    res.json({
      activityId: activity._id.toString(),
      loginTime:  activity.loginTime,
    });
  } catch (err) {
    console.error('[user-activity] login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user-activity/logout  — protected
router.post('/logout', csrfGuard, requireAuth, async (req, res) => {
  try {
    const { activityId } = req.body;
    if (!activityId) return res.status(400).json({ error: 'activityId is required' });

    const activity = await recordLogout(activityId);
    if (!activity) return res.status(404).json({ error: 'Activity record not found' });

    // Back-fill logout info on every conversation that was opened this session
    await updateConversationsOnLogout(activityId, activity.logoutTime, activity.durationSeconds);

    res.json({ ok: true, durationSeconds: activity.durationSeconds });
  } catch (err) {
    console.error('[user-activity] logout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/user-activity  (admin view) — protected
router.get('/', requireAuth, async (req, res) => {
  try {
    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB not connected' });

    const UserActivity = getUserActivityModel();
    const records = await UserActivity.find({}).sort({ loginTime: -1 }).limit(500).lean();
    res.json(records);
  } catch (err) {
    console.error('[user-activity] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
