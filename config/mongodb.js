import mongoose from 'mongoose';

// ── Schemas ────────────────────────────────────────────────────

const classSchema = new mongoose.Schema({
  className:     { type: String, required: true },
  professorName: { type: String, required: true },
  createdAt:     { type: Date, default: Date.now },
});

// UserActivity — tracks login/logout per visit
const userActivitySchema = new mongoose.Schema({
  email:           { type: String, required: true },
  loginTime:       { type: Date, default: Date.now },
  logoutTime:      { type: Date, default: null },
  durationSeconds: { type: Number, default: null },
}, { timestamps: false });

// ChatConversation — all messages for a user, grouped by conversation
const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'bot'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const chatConversationSchema = new mongoose.Schema({
  email:    { type: String, required: true, index: true },
  title:    { type: String, default: 'New Conversation' },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true });

const studentSchema = new mongoose.Schema({
  studentId:   { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name:        { type: String, required: true },
  email:       { type: String, required: true },
  tableNumber: { type: Number, required: true },
  joinedAt:    { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true },
  classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sessionTitle: { type: String, required: true },
  createdBy: {
    name:  { type: String, required: true },
    email: { type: String, required: true },
  },
  status:   { type: String, enum: ['active', 'ended'], default: 'active' },
  students: { type: [studentSchema], default: [] },
}, { timestamps: true });

export const Class   = mongoose.models.Class   || mongoose.model('Class',   classSchema);
export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

// Lazy model getters (safe for serverless cold-starts)
export function getUserActivityModel() {
  return mongoose.models.UserActivity || mongoose.model('UserActivity', userActivitySchema);
}

export function getChatConversationModel() {
  return mongoose.models.ChatConversation || mongoose.model('ChatConversation', chatConversationSchema);
}

// ── Connection ─────────────────────────────────────────────────

let connectPromise = null;

export function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set – session data will not be persisted');
    return Promise.resolve(false);
  }
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  if (connectPromise) return connectPromise;

  mongoose.set('bufferCommands', false);

  connectPromise = mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => { console.log('MongoDB connected'); return true; })
    .catch((err) => { console.error('MongoDB error:', err.message); connectPromise = null; return false; });

  return connectPromise;
}

// ── Helpers ────────────────────────────────────────────────────

export async function createSessionRecord({ sessionId, sessionTitle, hostName, hostEmail, className = 'Physics Class', professorName = 'Professor' }) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;

    let classDoc = await Class.findOne({ className, professorName });
    if (!classDoc) {
      classDoc = await Class.create({ className, professorName });
    }

    const existing = await Session.findOne({ sessionId });
    if (existing) return existing;

    const session = await Session.create({
      sessionId,
      classId: classDoc._id,
      sessionTitle,
      createdBy: { name: hostName, email: hostEmail || '' },
      status: 'active',
      students: [],
    });

    console.log('[MongoDB] Session created:', sessionId);
    return session;
  } catch (err) {
    console.error('[MongoDB] createSessionRecord error:', err.message);
    return null;
  }
}

export async function addStudentToSession({ sessionId, name, email, tableNumber }) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;

    const session = await Session.findOne({ sessionId });
    if (!session) return null;

    const alreadyJoined = session.students.some(s => s.email === email);
    if (alreadyJoined) return session;

    session.students.push({
      studentId: new mongoose.Types.ObjectId().toString(),
      name,
      email,
      tableNumber,
      joinedAt: new Date(),
    });

    await session.save();
    console.log('[MongoDB] Student added:', name, 'to session', sessionId);
    return session;
  } catch (err) {
    console.error('[MongoDB] addStudentToSession error:', err.message);
    return null;
  }
}

// ── UserActivity helpers ───────────────────────────────────────

export async function recordLogin(email) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;

    const UserActivity = getUserActivityModel();
    const activity = await UserActivity.create({ email, loginTime: new Date() });
    console.log('[MongoDB] Login recorded for:', email);
    return activity;
  } catch (err) {
    console.error('[MongoDB] recordLogin error:', err.message);
    return null;
  }
}

export async function recordLogout(activityId) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;

    const UserActivity = getUserActivityModel();
    const activity = await UserActivity.findById(activityId);
    if (!activity) return null;

    const logoutTime = new Date();
    const durationSeconds = Math.round((logoutTime - activity.loginTime) / 1000);
    activity.logoutTime = logoutTime;
    activity.durationSeconds = durationSeconds;
    await activity.save();

    console.log('[MongoDB] Logout recorded for:', activity.email, `(${durationSeconds}s)`);
    return activity;
  } catch (err) {
    console.error('[MongoDB] recordLogout error:', err.message);
    return null;
  }
}