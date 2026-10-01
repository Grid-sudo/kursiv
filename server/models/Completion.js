import mongoose from 'mongoose';

const completionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });
completionSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export default mongoose.model('Completion', completionSchema);
