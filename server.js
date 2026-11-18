require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const Contact = require("./models/Contact");
const Order = require("./models/Order");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

function clean(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

// 1. Return saved orders for the Orders page (GET /api/orders)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      customer: {
        name: order.customer?.name
      },
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total
    }));

    res.set("Cache-Control", "no-store");
    return res.status(200).json(formattedOrders);
  } catch (error) {
    return res.status(500).json({ error: "Could not fetch orders." });
  }
});

// 2. Save a contact form submission (POST /api/contact)
app.post("/api/contact", async (req, res) => {
  try {
    const body = req.body || {};

    const name = clean(body.name, 100);
    const email = clean(body.email, 200);
    const message = clean(body.message, 3000);

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      name.length < 2 ||
      !validEmail.test(email) ||
      message.length < 10
    ) {
      return res.status(400).json({
        error: "Please provide a valid name, email, and message (at least 10 characters)."
      });
    }

    const newContact = await Contact.create({
      id: `MSG-${Date.now()}`,
      createdAt: new Date().toISOString(),
      name,
      email,
      message
    });

    return res.status(201).json({
      success: true,
      id: newContact.id
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Could not save contact message."
    });
  }
});

// 3. Validate and save an order (POST /api/orders)
app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};
    const customer = body.customer || {};

    const name = clean(customer.name, 100);
    const email = clean(customer.email, 200);
    const phone = clean(customer.phone, 30);
    const address = clean(customer.address, 500);
    const paymentMethod = clean(customer.paymentMethod, 80);

    const items = Array.isArray(body.items) ? body.items : [];

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validPhone = /^[0-9+\-\s()]{10,15}$/;

    if (
      name.length < 2 ||
      !validEmail.test(email) ||
      !validPhone.test(phone) ||
      address.length < 10 ||
      !paymentMethod ||
      !items.length
    ) {
      return res.status(400).json({
        error: "Order details are incomplete or invalid."
      });
    }

    const safeItems = items.slice(0, 100).map((item) => ({
      id: clean(item.id, 300),
      name: clean(item.name, 200),
      image: clean(item.image, 500),
      price: Math.max(0, Number(item.price) || 0),
      quantity: Math.max(
        1,
        Math.min(99, Math.floor(Number(item.quantity) || 1))
      )
    }));

    const subtotal = safeItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const tax = Math.round(subtotal * 0.1 * 100) / 100;

    const newOrder = await Order.create({
      id: `ORD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customer: {
        name,
        email,
        phone,
        address,
        paymentMethod
      },
      items: safeItems,
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total: Math.round((subtotal + tax) * 100) / 100,
      note: "Academic demo only; no real payment processed."
    });

    return res.status(201).json({
      success: true,
      id: newOrder.id
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Could not save order."
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`My Store is running at http://localhost:${PORT}`);
  console.log("Database: MongoDB connected");
});