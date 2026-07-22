const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

function seed() {
  const db = getDatabase();

  // Default tiers
  const insertTier = db.prepare(`
    INSERT OR IGNORE INTO tiers (id, name, min_points, multiplier, color_hex)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tiers = [
    [1, 'Bronze',   0,    1.0, '#CD7F32'],
    [2, 'Silver',   500,  1.25, '#C0C0C0'],
    [3, 'Gold',     1500, 1.5, '#FFD700'],
    [4, 'Platinum', 4000, 2.0, '#E5E4E2'],
  ];

  const seedTiers = db.transaction(() => {
    tiers.forEach(t => insertTier.run(...t));
  });
  seedTiers();

  // Default settings
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  const defaults = [
    ['store_name',          'Razco Foods'],
    ['store_phone',         ''],
    ['store_address',       ''],
    ['welcome_points',      '100'],
    ['visit_points',        '10'],
    ['sms_welcome_message', 'Welcome to Razco Foods! Your loyalty ID is {loyalty_id}. You earned {points} points. Thank you!'],
    ['sms_tier_upgrade',    'Congratulations {name}! You reached {tier} status at Razco Foods!'],
    ['signup_bonus_points', '100'],
    ['backup_retention_days', '30'],
  ];

  const seedSettings = db.transaction(() => {
    defaults.forEach(([k, v]) => insertSetting.run(k, v));
  });
  seedSettings();

  logger.info('[SEED] Default tiers and settings loaded');
}

seed();
