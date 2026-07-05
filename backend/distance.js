// Straight-line ("as the crow flies") distance from the CBD, matching the
// "Delivery fees (radius from CBD)" wording on the flyer — this is why we
// use Haversine distance rather than a routed/driving distance API.

// TODO: set this to your actual shop or warehouse coordinates.
// Current value is an approximate Harare CBD point (Africa Unity Square).
const CBD_COORDS = { lat: -17.8292, lng: 31.0522 };

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * @param {{lat:number, lng:number}} a
 * @param {{lat:number, lng:number}} b
 * @returns {number} distance in km
 */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/**
 * @param {{lat:number, lng:number}} point - customer's dropped pin / geocoded address
 * @returns {number} distance from CBD in km
 */
function distanceFromCbdKm(point) {
  if (
    typeof point?.lat !== 'number' ||
    typeof point?.lng !== 'number' ||
    Number.isNaN(point.lat) ||
    Number.isNaN(point.lng)
  ) {
    throw new Error('point must be { lat: number, lng: number }');
  }
  return haversineKm(CBD_COORDS, point);
}

module.exports = { CBD_COORDS, haversineKm, distanceFromCbdKm };
