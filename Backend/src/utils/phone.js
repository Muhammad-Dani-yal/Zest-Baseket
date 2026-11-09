// Normalizes Pakistani numbers to +92XXXXXXXXXX
// Accepts: 03001234567, 3001234567, 923001234567, +923001234567
function normalizePhone(input) {
  let p = String(input).replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0092")) p = p.slice(4);
  if (p.startsWith("92")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  if (!/^3\d{9}$/.test(p)) return null;
  return "+92" + p;
}
module.exports = { normalizePhone };
