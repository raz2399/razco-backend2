const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function seed() {
  await query(`
    INSERT INTO tiers (name, min_points, multiplier, color_hex) VALUES
      ('Bronze', 0, 1.0, '#CD7F32'),
      ('Silver', 500, 1.5, '#C0C0C0'),
      ('Gold', 1000, 2.0, '#FFD700')
    ON CONFLICT DO NOTHING;
  `);

  await query(`
    INSERT INTO settings (key, value) VALUES
      ('signup_bonus_points', '100'),
      ('sms_welcome_message', 'Welcome to Razco Foods! Your loyalty ID is {loyalty_id}. You earned {points} points!'),
      ('store_name', 'Razco Foods Supermarket'),
      ('store_phone', ''),
      ('manager_pin', '1234')
    ON CONFLICT DO NOTHING;
  `);

  logger.info('[SEED] Default tiers and settings loaded');
}

module.exports = seed();
