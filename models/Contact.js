const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  id: { type: String }, // Keeps compatibility with your existing "MSG-..." IDs
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contact', contactSchema);