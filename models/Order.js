const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String },
  customerName: { type: String },
  email: { type: String },
  address: { type: String },
  items: { type: Array, required: true }, // Stores the cart items array
  totalAmount: { type: Number },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);