import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({ uploadId: mongoose.Schema.Types.ObjectId, name: String, url: String, mimeType: String, size: Number }, { _id: true });
const homeworkSchema = new mongoose.Schema({ title: { type: String, required: true, trim: true }, description: { type: String, default: '' }, courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true }, lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, dueDate: Date, attachments: [attachmentSchema] }, { timestamps: true });
export default mongoose.model('Homework', homeworkSchema);
