// Delivery fee tiers — matches the "Your furniture delivered with care" flyer.
// Edit FEE_TIERS here any time your pricing changes; the API, the PDF
// invoices, and the admin dashboard all read from this single source of truth.

const { distanceFromCbdKm } = require('./distance');

const FEE_TIERS = [
  { label: 'Up to 5km from CBD', maxKm: 5, fee: 10 },
  { label: 'Up to 10km from CBD', maxKm: 10, fee: 15 },
  { label: '10–20km from CBD', maxKm: 20, fee: 20 },
];

function tierForDistance(km) {
  const tier = FEE_TIERS.find((t) => km <= t.maxKm);
  if (!tier) {
    return { tier: 'Outside Harare', fee: null, outsideServiceArea: true, distanceKm: round1(km) };
  }
  return { tier: tier.label, fee: tier.fee, outsideServiceArea: false, distanceKm: round1(km) };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Calculate a delivery fee either from a map pin (preferred — this is what
 * the mobile app sends after the customer drops a pin or searches an
 * address on Google Maps/Apple Maps) or from a raw distance in km.
 *
 * @param {{ point?: {lat:number, lng:number}, distanceKm?: number }} input
 */
function calculateDeliveryFee({ point, distanceKm }) {
  let km;
  if (point) {
    km = distanceFromCbdKm(point);
  } else if (typeof distanceKm === 'number') {
    km = distanceKm;
  } else {
    throw new Error('Provide either { point: { lat, lng } } or { distanceKm }');
  }
  if (Number.isNaN(km) || km < 0) {
    throw new Error('Resulting distance must be a non-negative number');
  }
  return tierForDistance(km);
}

module.exports = { FEE_TIERS, calculateDeliveryFee };
