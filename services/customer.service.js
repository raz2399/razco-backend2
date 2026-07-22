const { getDatabase } = require('../config/database');
const { normalizePhone } = require('../utils/phone');
const { generateLoyaltyId } = require('../utils/idGenerator');
const logger = require('../utils/logger');

/**
 * Signup a customer from the kiosk.
 * Returns existing customer (updated) or creates new one.
 * NEVER returns success until DB write is verified.
 */
function signup({ name, phone, email, smsOptIn }) {
  const db = getDatabase();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw Object.assign(new Error('Invalid phone number format'), { statusCode: 422, code: 'INVALID_PHONE' });
  }

  // Check for existing customer
  const existing = db.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).get(normalizedPhone);

  if (existing) {
    return updateReturningCustomer(db, existing, { smsOptIn });
  }

  return createNewCustomer(db, { name, phone: normalizedPhone, email, smsOptIn });
}

function updateReturningCustomer(db, customer, { smsOptIn }) {
  const update = db.prepare(`
    UPDATE customers
    SET visit_count = visit_count + 1,
        last_visit  = datetime('now'),
        sms_opt_in  = ?,
        updated_at  = datetime('now')
    WHERE id = ?
  `);

  const logVisit = db.prepare(`
    INSERT INTO customer_visits (customer_id, source)
    VALUES (?, 'kiosk')
  `);

  const addPoints = db.prepare(`
    INSERT INTO reward_points (customer_id, points, reason)
    VALUES (?, ?, 'visit_checkin')
  `);

  const updatePoints = db.prepare(`
    UPDATE customers SET points = points + ?, total_points_earned = total_points_earned + ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    update.run(smsOptIn ? 1 : 0, customer.id);
    logVisit.run(customer.id);

    const visitPoints = 10;
    addPoints.run(customer.id, visitPoints);
    updatePoints.run(visitPoints, visitPoints, customer.id);
  });

  transaction();

  // Verify the update took
  const verified = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
  if (!verified) {
    throw new Error('Customer update could not be verified');
  }

  logger.info('[SIGNUP] Returning customer checked in', { customerId: customer.id, phone: customer.phone });

  return {
    isNew: false,
    customer: sanitizeCustomer(verified),
    pointsEarned: 10,
  };
}

function createNewCustomer(db, { name, phone, email, smsOptIn }) {
  const loyaltyId = generateLoyaltyId();
  const welcomePoints = getSettingInt(db, 'signup_bonus_points', 100);

  const insertCustomer = db.prepare(`
    INSERT INTO customers (loyalty_id, name, phone, email, sms_opt_in, tier_id, points, total_points_earned, visit_count, last_visit)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, datetime('now'))
  `);

  const logVisit = db.prepare(`
    INSERT INTO customer_visits (customer_id, source)
    VALUES (?, 'kiosk')
  `);

  const logPoints = db.prepare(`
    INSERT INTO reward_points (customer_id, points, reason)
    VALUES (?, ?, 'signup_bonus')
  `);

  const logAudit = db.prepare(`
    INSERT INTO audit_logs (action, entity, entity_id, details)
    VALUES ('customer_signup', 'customers', ?, ?)
  `);

  const transaction = db.transaction(() => {
    const result = insertCustomer.run(
      loyaltyId, name, phone, email || null,
      smsOptIn ? 1 : 0,
      welcomePoints, welcomePoints
    );

    const customerId = result.lastInsertRowid;

    // VERIFY the write before proceeding
    const verified = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!verified) {
      throw new Error('Database write could not be verified after INSERT');
    }

    logVisit.run(customerId);
    logPoints.run(customerId, welcomePoints);
    logAudit.run(String(customerId), JSON.stringify({ name, phone, smsOptIn }));

    return customerId;
  });

  const customerId = transaction();

  // Final read to return complete customer object
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  if (!customer) {
    logger.error('[SIGNUP] CRITICAL: Customer not found after verified insert', { phone });
    throw new Error('Customer record lost after creation');
  }

  logger.info('[SIGNUP] New customer created', { customerId, loyaltyId, phone });

  // Queue welcome SMS
  if (smsOptIn) {
    queueWelcomeSms(db, customer);
  }

  return {
    isNew: true,
    customer: sanitizeCustomer(customer),
    pointsEarned: welcomePoints,
    welcomeReward: `${welcomePoints} bonus points added to your account!`,
  };
}

function queueWelcomeSms(db, customer) {
  try {
    const template = getSettingStr(db, 'sms_welcome_message',
      'Welcome to Razco Foods! Your loyalty ID is {loyalty_id}. You earned {points} points!');

    const message = template
      .replace('{loyalty_id}', customer.loyalty_id)
      .replace('{name}', customer.name)
      .replace('{points}', customer.points);

    db.prepare(`
      INSERT INTO sms_queue (phone, message, type, reference_id)
      VALUES (?, ?, 'welcome', ?)
    `).run(customer.phone, message, String(customer.id));

    logger.info('[SMS] Welcome SMS queued', { customerId: customer.id });
  } catch (err) {
    // SMS failure never blocks signup
    logger.error('[SMS] Failed to queue welcome SMS', { error: err.message, customerId: customer.id });
  }
}

function getById(id) {
  const db = getDatabase();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND is_active = 1').get(id);
  if (!customer) return null;
  return sanitizeCustomer(customer);
}

function getAll({ page = 1, limit = 50, search = '' } = {}) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let query = 'SELECT c.*, t.name as tier_name FROM customers c JOIN tiers t ON c.tier_id = t.id WHERE c.is_active = 1';
  const params = [];

  if (search) {
    query += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.loyalty_id LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const customers = db.prepare(query).all(...params);
  const total = db.prepare(
    'SELECT COUNT(*) as count FROM customers WHERE is_active = 1' +
    (search ? ' AND (name LIKE ? OR phone LIKE ? OR loyalty_id LIKE ?)' : '')
  ).get(...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []));

  return {
    customers: customers.map(sanitizeCustomer),
    pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) },
  };
}

function getHistory(customerId) {
  const db = getDatabase();
  const visits = db.prepare(
    'SELECT * FROM customer_visits WHERE customer_id = ? ORDER BY visited_at DESC LIMIT 50'
  ).all(customerId);

  const points = db.prepare(
    'SELECT * FROM reward_points WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(customerId);

  return { visits, points };
}

// Helpers
function sanitizeCustomer(c) {
  const { password_hash, ...safe } = c;
  return safe;
}

function getSettingInt(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? parseInt(row.value) || fallback : fallback;
}

function getSettingStr(db, key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

module.exports = { signup, getById, getAll, getHistory };
