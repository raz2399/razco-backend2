function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  // Strip leading 1 if 11 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  if (digits.length === 10) return digits;
  return null;
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(phone);
}

function formatDisplay(phone) {
  if (!isValidPhone(phone)) return phone;
  return `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}`;
}

module.exports = { normalizePhone, isValidPhone, formatDisplay };
