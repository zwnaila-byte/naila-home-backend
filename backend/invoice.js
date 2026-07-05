const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const INVOICES_DIR = path.join(__dirname, 'invoices');
const BUSINESS = {
  name: 'Naila Home',
  address: 'Harare, Zimbabwe',
  phone: '+263 71 978 0649',
  web: 'www.nailahome.com',
};

const NAVY = '#241542';
const PURPLE = '#6E4A9E';
const SOFT = '#6B6280';
const LINE = '#E5DCF3';

function ensureDir() {
  if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

/**
 * Generates a PDF invoice for an order and writes it to disk.
 * @param {object} order - full order object (see server.js for shape)
 * @returns {string} absolute path to the generated PDF
 */
function generateInvoicePdf(order) {
  ensureDir();
  const filePath = path.join(INVOICES_DIR, `${order.invoiceId}.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // --- Header -------------------------------------------------------
  doc.fillColor(NAVY).fontSize(22).font('Helvetica-Bold').text(BUSINESS.name);
  doc
    .fillColor(SOFT)
    .fontSize(9)
    .font('Helvetica')
    .text(BUSINESS.address)
    .text(BUSINESS.phone)
    .text(BUSINESS.web);

  doc
    .fillColor(NAVY)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('INVOICE', 400, 50, { align: 'right' });
  doc
    .fillColor(SOFT)
    .fontSize(9)
    .font('Helvetica')
    .text(order.invoiceId, 400, 74, { align: 'right' })
    .text(`Order ${order.id}`, 400, 87, { align: 'right' })
    .text(new Date(order.placedAt).toLocaleDateString(), 400, 100, { align: 'right' });

  doc.moveDown(3);
  drawRule(doc);

  // --- Billed to ------------------------------------------------------
  doc.moveDown(0.8);
  doc.fillColor(SOFT).fontSize(9).font('Helvetica-Bold').text('BILLED TO', 50);
  doc.fillColor(NAVY).fontSize(11).font('Helvetica-Bold').text(order.customer.name, 50);
  doc
    .fillColor(SOFT)
    .fontSize(9.5)
    .font('Helvetica')
    .text(order.customer.phone, 50)
    .text(order.customer.address, 50);

  doc.moveDown(1.2);
  drawRule(doc);
  doc.moveDown(0.8);

  // --- Items table ------------------------------------------------------
  const tableTop = doc.y;
  doc.fillColor(SOFT).fontSize(9).font('Helvetica-Bold');
  doc.text('ITEM', 50, tableTop);
  doc.text('QTY', 330, tableTop, { width: 50, align: 'right' });
  doc.text('PRICE', 390, tableTop, { width: 60, align: 'right' });
  doc.text('TOTAL', 460, tableTop, { width: 90, align: 'right' });
  doc.moveDown(0.5);
  drawRule(doc);

  doc.font('Helvetica').fontSize(10).fillColor(NAVY);
  order.items.forEach((item) => {
    const y = doc.y + 8;
    doc.text(item.name, 50, y, { width: 260 });
    doc.text(String(item.qty), 330, y, { width: 50, align: 'right' });
    doc.text(`$${item.price.toFixed(2)}`, 390, y, { width: 60, align: 'right' });
    doc.text(`$${(item.price * item.qty).toFixed(2)}`, 460, y, { width: 90, align: 'right' });
    doc.moveDown(1.2);
  });

  drawRule(doc);
  doc.moveDown(0.6);

  // --- Totals ------------------------------------------------------
  totalLine(doc, 'Subtotal', `$${order.subtotal.toFixed(2)}`);
  totalLine(
    doc,
    `Delivery (${order.zone})`,
    order.fee !== null ? `$${order.fee.toFixed(2)}` : 'Quoted separately'
  );
  if (order.distanceKm !== null && order.distanceKm !== undefined) {
    totalLine(doc, 'Distance from CBD', `${order.distanceKm}km`, true);
  }
  doc.moveDown(0.3);
  doc.fillColor(NAVY).fontSize(13).font('Helvetica-Bold');
  totalLine(doc, 'Total', `$${order.total.toFixed(2)}`);

  doc.moveDown(1.5);
  doc
    .fillColor(PURPLE)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`Status: ${order.status}`, 50);

  doc.moveDown(2);
  doc
    .fillColor(SOFT)
    .fontSize(8.5)
    .font('Helvetica')
    .text('Thank you for supporting local and choosing Naila Home.', 50, doc.y, { width: 495, align: 'center' });

  doc.end();

  return filePath;
}

function drawRule(doc) {
  const y = doc.y;
  doc
    .strokeColor(LINE)
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(545, y)
    .stroke();
  doc.moveDown(0.3);
}

function totalLine(doc, label, value, small) {
  const y = doc.y;
  const font = small ? 9 : doc._fontSize || 10;
  doc.text(label, 350, y, { width: 100 });
  doc.text(value, 460, y, { width: 90, align: 'right' });
  doc.moveDown(0.6);
}

function invoiceFilePath(invoiceId) {
  return path.join(INVOICES_DIR, `${invoiceId}.pdf`);
}

module.exports = { generateInvoicePdf, invoiceFilePath, INVOICES_DIR };
