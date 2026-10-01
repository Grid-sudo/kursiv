import mongoose from 'mongoose';

const daySchema = new mongoose.Schema({
  weekId: { type: mongoose.Schema.Types.ObjectId, ref: 'Week', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Day', daySchema);
