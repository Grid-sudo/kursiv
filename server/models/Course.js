import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  cover: { type: String, default: '' },
  coverSettings: { positionX: { type: Number, default: 50 }, positionY: { type: Number, default: 50 }, scale: { type: Number, default: 1 }, width: Number, height: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export default mongoose.model('Course', courseSchema);
