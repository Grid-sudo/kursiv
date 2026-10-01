import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'curator', 'teacher', 'student'], required: true },
  curatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  avatar: { type: String, default: '' },
  phone: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 1000 },
  portfolioUrl: { type: String, default: '', maxlength: 500 },
  linkedinUrl: { type: String, default: '', maxlength: 500 },
  tokenVersion: { type: Number, default: 0, select: false },
  lastActiveAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
