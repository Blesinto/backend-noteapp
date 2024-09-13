const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  title: { type: String, require: true },
  content: { type: String, require: true },
  tags: { type: [String], default: [] },
  isPinned: { type: Boolean, default: false },
  userId: { type: String, require: true },
  createdon: { type: Date, default: new Date().getTime() },
  fileUrl: {type: String}
});

module.exports = mongoose.model('Note', userSchema);
