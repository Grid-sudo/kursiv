import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  cover: { type: String, default: '' },
  coverSettings: { positionX: { type: Number, default: 50 }, positionY: { type: Number, default: 50 }, scale: { type: Number, default: 1 }, width: Number, height: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'changes_requested'], default: 'approved', index: true },
  moderationComment: { type: String, default: '', maxlength: 1000 },
  moderationSubmittedAt: { type: Date, default: null },
  moderationReviewedAt: { type: Date, default: null },
  moderationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export default mongoose.model('Course', courseSchema);
