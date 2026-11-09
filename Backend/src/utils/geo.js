const SERVICE_RADIUS_KM = Number(process.env.SERVICE_RADIUS_KM) || 3;

// Do points ke darmiyan distance (km), jab shop ka GeoJSON aur user ki lat/lng ho
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const round1 = (n) => Math.round(n * 10) / 10;

module.exports = { SERVICE_RADIUS_KM, haversineKm, round1 };
