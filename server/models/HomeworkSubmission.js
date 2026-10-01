import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({ uploadId: mongoose.Schema.Types.ObjectId, name: String, url: String, mimeType: String, size: Number }, { _id: true });
const schema = new mongoose.Schema({ homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true, index: true }, studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, status: { type: String, enum: ['Не начато', 'Выполняется', 'На проверке', 'Принято', 'Нужно исправить'], default: 'Не начато' }, comment: { type: String, default: '' }, studentComment: { type: String, default: '' }, submittedAt: Date, curatorViewedAt: { type: Date, default: null, index: true }, attachments: [attachmentSchema] }, { timestamps: true });
schema.index({ homeworkId: 1, studentId: 1 }, { unique: true });
export default mongoose.model('HomeworkSubmission', schema);
