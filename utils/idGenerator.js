const { getDatabase } = require('../config/database');

function generateLoyaltyId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  const db = getDatabase();
  const check = db.prepare('SELECT id FROM customers WHERE loyalty_id = ?');

  do {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    id = `RZ-${code}`;
  } while (check.get(id));

  return id;
}

module.exports = { generateLoyaltyId };
