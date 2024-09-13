// const mongoose = require('mongoose');
// const { Schema } = mongoose;

// const userSchema = new Schema({
//   fullName: { type: String },
//   email: { type: String },
//   password: { type: String },
//   createdon: { type: Date, default: new Date().getTime() },
// });

// module.exports = mongoose.model('user', userSchema);
// const mongoose = require('mongoose');
// const { Schema } = mongoose;

// const userSchema = new Schema({
//   fullName: { type: String, required: true }, // Full name is required
//   email: { type: String, required: true, unique: true }, // Email is required and unique
//   password: { type: String, required: true }, // Password is required
//   role: { type: String, enum: ['admin', 'student'], default: 'student' }, // Role field with default value
//   createdon: { type: Date, default: Date.now }, // Current timestamp as default
// });

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: { type: String, default: 'student' },
});

module.exports = mongoose.model('User', userSchema); // Capitalized 'User' for convention
