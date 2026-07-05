const express = require('express');
const cors = require('cors');
const path = require('path');
const { customAlphabet } = require('nanoid');

const db = require('./db');
const { FEE_TIERS, calculateDeliveryFee } = require('./delivery');
const { CBD_COORDS } = require('./distance');
const { generateInvoicePdf, invoiceFilePath } = require('./invoice');

const app = express();
const PORT = process.env.PORT || 4000;

// Change this before deploying! Simple shared password for the admin dashboard.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nailahome-admin';

const nanoid = customAlphabet('0123456789', 5);
const invoiceSeq = customAlphabet('0123456789', 4);
const ORDER_STATUSES = ['Order Placed', 'Processing', 'Out for Delivery', 'Delivered'];

app.use(cors());
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, 'public')));

// --- simple auth for admin-only endpoints -------------------------------
function requireAdmin(req, res, next) {
  const password = req.header('x-admin-password');
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  next();
}

// --- health check ---------------------------------------------------------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- delivery fees ---------------------------------------------------------
// The mobile app sends the lat/lng of the pin the customer dropped (or the
// geocoded result of an address search) on Google Maps (Android) / Apple
// Maps (iOS). Distance is measured from the CBD as the crow flies, matching
// the flyer's "radius from CBD" tiers.
app.get('/api/delivery-tiers', (req, res) => {
  res.json({ tiers: FEE_TIERS, cbd: CBD_COORDS });
});

app.post('/api/delivery-fee', (req, res) => {
  try {
    const { lat, lng, distanceKm } = req.body;
    const result =
      typeof lat === 'number' && typeof lng === 'number'
        ? calculateDeliveryFee({ point: { lat, lng } })
        : calculateDeliveryFee({ distanceKm });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- orders (customer-facing) ----------------------------------------------
// Create an order — also generates a PDF invoice immediately.
app.post('/api/orders', (req, res) => {
  const { customer, items, location, outsideServiceArea } = req.body;

  if (!customer || !customer.name || !customer.phone || !customer.address) {
    return res.status(400).json({ error: 'customer.name, customer.phone and customer.address are required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  let fee = null;
  let zoneLabel = 'Outside Harare (Courier Connect)';
  let distanceKm = null;

  if (!outsideServiceArea) {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ error: 'location.lat and location.lng are required unless outsideServiceArea is true' });
    }
    try {
      const result = calculateDeliveryFee({ point: location });
      fee = result.fee;
      zoneLabel = result.tier;
      distanceKm = result.distanceKm;
      if (result.outsideServiceArea) zoneLabel = 'Outside Harare (Courier Connect)';
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const now = new Date();
  const invoiceId = `INV-${now.getFullYear()}-${invoiceSeq()}`;

  const order = {
    id: 'NH-' + nanoid(),
    invoiceId,
    customer,
    items,
    location: outsideServiceArea ? null : location,
    zone: zoneLabel,
    distanceKm,
    fee,
    subtotal,
    total: fee ? subtotal + fee : subtotal,
    status: ORDER_STATUSES[0],
    statusHistory: [{ status: ORDER_STATUSES[0], at: now.toISOString() }],
    placedAt: now.toISOString(),
  };

  db.addOrder(order);

  // Generate the PDF invoice right away so it's ready to view/download.
  try {
    generateInvoicePdf(order);
  } catch (err) {
    // Order is still valid even if PDF generation hiccups — log and move on.
    console.error('Invoice generation failed for', order.id, err);
  }

  res.status(201).json(order);
});

// Track a single order — customers look this up by order ID (and ideally
// their phone number, checked below, so people can't browse each other's orders)
app.get('/api/orders/:id', (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { phone } = req.query;
  if (phone && order.customer.phone.replace(/\s/g, '') !== String(phone).replace(/\s/g, '')) {
    return res.status(403).json({ error: 'Phone number does not match this order' });
  }
  res.json(order);
});

// Order history for a customer — the mobile app's "Orders" tab calls this
// with the phone number the customer checks out with.
app.get('/api/orders', (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone query parameter is required' });
  res.json({ orders: db.getOrdersByPhone(phone) });
});

// Download/view the PDF invoice for an order.
app.get('/api/orders/:id/invoice.pdf', (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { phone } = req.query;
  if (phone && order.customer.phone.replace(/\s/g, '') !== String(phone).replace(/\s/g, '')) {
    return res.status(403).json({ error: 'Phone number does not match this order' });
  }

  const filePath = invoiceFilePath(order.invoiceId);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Invoice file not found. It may not have generated correctly.' });
    }
  });
});

// --- admin-only endpoints ----------------------------------------------
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json({ orders: db.getOrders() });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }
  const updated = db.updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
});

app.get('/api/admin/orders/:id/invoice.pdf', requireAdmin, (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.sendFile(invoiceFilePath(order.invoiceId));
});

app.listen(PORT, () => {
  console.log(`Naila Home backend running at http://localhost:${PORT}`);
  console.log(`Admin dashboard at http://localhost:${PORT}/admin  (password: ${ADMIN_PASSWORD})`);
});
