// Minimal file-based "database".
// Good enough to run today; swap for Postgres/MySQL/Firestore later
// by re-implementing the functions below with the same signatures.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'orders.json');

function ensureDbFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify({ orders: [] }, null, 2));
  }
}

function readAll() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeAll(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getOrders() {
  return readAll().orders;
}

function getOrderById(id) {
  return readAll().orders.find((o) => o.id === id);
}

// Order history for a customer, most recent first — matches phone number
// since this starter app has no account/login system yet.
function getOrdersByPhone(phone) {
  const normalized = String(phone).replace(/\s/g, '');
  return readAll()
    .orders.filter((o) => o.customer.phone.replace(/\s/g, '') === normalized)
    .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
}

function addOrder(order) {
  const data = readAll();
  data.orders.unshift(order);
  writeAll(data);
  return order;
}

function updateOrderStatus(id, status) {
  const data = readAll();
  const order = data.orders.find((o) => o.id === id);
  if (!order) return null;
  order.status = status;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({ status, at: new Date().toISOString() });
  writeAll(data);
  return order;
}

module.exports = { getOrders, getOrderById, getOrdersByPhone, addOrder, updateOrderStatus };
