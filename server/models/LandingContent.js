import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 80, default: '' },
  value: { type: String, trim: true, maxlength: 300, default: '' },
  href: { type: String, trim: true, maxlength: 600, default: '' }
}, { _id: false });

const faqSchema = new mongoose.Schema({
  question: { type: String, trim: true, maxlength: 300, default: '' },
  answer: { type: String, trim: true, maxlength: 2000, default: '' }
}, { _id: false });

const landingContentSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'landing' },
  contacts: { type: [contactSchema], default: [] },
  faqs: { type: [faqSchema], default: [] }
}, { timestamps: true });

export default mongoose.model('LandingContent', landingContentSchema);
