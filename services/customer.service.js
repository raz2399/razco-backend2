const { query, get, all, run } = require('../config/database');
const { normalizePhone } = require('../utils/phone');
const { generateLoyaltyId } = require('../utils/idGenerator');
const logger = require('../utils/logger');

async function signup({ name, phone, email, smsOptIn }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw Object.assign(new Error('Invalid phone number format'), { statusCode: 422, code: 'INVALID_PHONE' });
  }

  const existing = await get('SELECT * FROM customers WHERE phone = $1', [normalizedPhone]);
  if (existing) return updateReturningCustomer(existing, { smsOptIn });
  return createNewCustomer({ name, phone: normalizedPhone, email, smsOptIn });
}

async function updateReturningCustomer(customer, { smsOptIn }) {
  const visitPoints = 10;
  await query(`
    UPDATE customers
    SET visit_count = visit_count + 1,
        last_visit  = NOW(),
        sms_opt_in  = $1,
        updated_at  = NOW()
    WHERE id = $2
  `, [smsOptIn ? 1 : 0, customer.id]);

  await query(`INSERT INTO customer_visits (customer_id, source) VALUES ($1, 'kiosk')`, [customer.id]);
  await query(`INSERT INTO reward_points (customer_id, points, reason) VALUES ($1, $2, 'visit_checkin')`, [customer.id, visitPoints]);
  await query(`UPDATE customers SET points = points + $1, total_points_earned = total_points_earned + $1, updated_at = NOW() WHERE id = $2`, [visitPoints, customer.id]);

  const verified = await get('SELECT * FROM customers WHERE id = $1', [customer.id]);
  if (!verified) throw new Error('Customer update could not be verified');

  logger.info('[SIGNUP] Returning customer checked in', { customerId: customer.id });
  return { isNew: false, customer: sanitizeCustomer(verified), pointsEarned: visitPoints };
}

async function createNewCustomer({ name, phone, email, smsOptIn }) {
  const loyaltyId = generateLoyaltyId();
  const welcomePoints = await getSettingInt('signup_bonus_points', 100);

  const result = await query(`
    INSERT INTO customers (loyalty_id, name, phone, email, sms_opt_in, tier_id, points, total_points_earned, visit_count, last_visit)
    VALUES ($1, $2, $3, $4, $5, 1, $6, $6, 1, NOW())
    RETURNING id
  `, [loyaltyId, name, phone, email || null, smsOptIn ? 1 : 0, welcomePoints]);

  const customerId = result.rows[0].id;

  await query(`INSERT INTO customer_visits (customer_id, source) VALUES ($1, 'kiosk')`, [customerId]);
  await query(`INSERT INTO reward_points (customer_id, points, reason) VALUES ($1, $2, 'signup_bonus')`, [customerId, welcomePoints]);
  await query(`INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ('customer_signup', 'customers', $1, $2)`, [String(customerId), JSON.stringify({ name, phone, smsOptIn })]);

  const customer = await get('SELECT * FROM customers WHERE id = $1', [customerId]);
  if (!customer) throw new Error('Customer record lost after creation');

  logger.info('[SIGNUP] New customer created', { customerId, loyaltyId, phone });

  if (smsOptIn) await queueWelcomeSms(customer);

  return {
    isNew: true,
    customer: sanitizeCustomer(customer),
    pointsEarned: welcomePoints,
    welcomeReward: `${welcomePoints} bonus points added to your account!`,
  };
}

async function queueWelcomeSms(customer) {
  try {
    const template = await getSettingStr('sms_welcome_message',
      'Welcome to Razco Foods! Your loyalty ID is {loyalty_id}. You earned {points} points!');
    const message = template
      .replace('{loyalty_id}', customer.loyalty_id)
      .replace('{name}', customer.name)
      .replace('{points}', customer.points);
    await query(`INSERT INTO sms_queue (phone, message, type, reference_id) VALUES ($1, $2, 'welcome', $3)`,
      [customer.phone, message, String(customer.id)]);
    logger.info('[SMS] Welcome SMS queued', { customerId: customer.id });
  } catch (err) {
    logger.error('[SMS] Failed to queue welcome SMS', { error: err.message, customerId: customer.id });
  }
}

async function getById(id) {
  const customer = await get('SELECT * FROM customers WHERE id = $1 AND is_active = 1', [id]);
  return customer ? sanitizeCustomer(customer) : null;
}

async function getAll({ page = 1, limit = 50, search = '' } = {}) {
  const offset = (page - 1) * limit;
  let sql = 'SELECT c.*, t.name as tier_name FROM customers c JOIN tiers t ON c.tier_id = t.id WHERE c.is_active = 1';
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.loyalty_id ILIKE $${params.length})`;
  }

  params.push(limit, offset);
  sql += ` ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const customers = await all(sql, params);

  const countParams = search ? [`%${search}%`] : [];
  const countSql = 'SELECT COUNT(*) as count FROM customers WHERE is_active = 1' +
    (search ? ' AND (name ILIKE $1 OR phone ILIKE $1 OR loyalty_id ILIKE $1)' : '');
  const total = await get(countSql, countParams);

  return {
    customers: customers.map(sanitizeCustomer),
    pagination: { page, limit, total: parseInt(total.count), pages: Math.ceil(parseInt(total.count) / limit) },
  };
}

async function getHistory(customerId) {
  const visits = await all('SELECT * FROM customer_visits WHERE customer_id = $1 ORDER BY visited_at DESC LIMIT 50', [customerId]);
  const points = await all('SELECT * FROM reward_points WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]);
  return { visits, points };
}

function sanitizeCustomer(c) {
  const { password_hash, ...safe } = c;
  return safe;
}

async function getSettingInt(key, fallback) {
  const row = await get('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? parseInt(row.value) || fallback : fallback;
}

async function getSettingStr(key, fallback) {
  const row = await get('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : fallback;
}

module.exports = { signup, getById, getAll, getHistory };
