import mongoose from 'mongoose';

export const blockSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['text', 'heading', 'image', 'video', 'document', 'link', 'list', 'divider'] },
  content: { type: String, default: '' },
  order: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const lessonSchema = new mongoose.Schema({
  dayId: { type: mongoose.Schema.Types.ObjectId, ref: 'Day', required: true, index: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, default: '' },
  blocks: { type: [blockSchema], default: [] },
  hasHomework: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Lesson', lessonSchema);
