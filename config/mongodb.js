import mongoose from 'mongoose';

const studentSessionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  tableNumber: { type: Number, required: true },
  sessionId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const StudentSession = mongoose.models.StudentSession
  || mongoose.model('StudentSession', studentSessionSchema);

let connectPromise = null;

export function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set - student data will not be saved');
    return Promise.resolve(false);
  }
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  if (connectPromise) return connectPromise;

  mongoose.set('bufferCommands', false);

  connectPromise = mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => {
      console.log('MongoDB connected successfully');
      return true;
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      connectPromise = null;
      return false;
    });

  return connectPromise;
}

export function saveStudentSession({ name, email, tableNumber, sessionId }) {
  if (!email || !tableNumber || Number.isNaN(tableNumber)) return;

  connectMongo().then((ok) => {
    if (!ok) return;
    StudentSession.create({ name, email, tableNumber, sessionId })
      .then(() => console.log('Student session saved to MongoDB'))
      .catch((err) => console.error('MongoDB save error:', err.message));
  });
}
