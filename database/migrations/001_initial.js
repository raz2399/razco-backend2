const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS tiers (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, min_points INTEGER NOT NULL,
      multiplier REAL NOT NULL DEFAULT 1.0, color_hex TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY, loyalty_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL, email TEXT, sms_opt_in INTEGER NOT NULL DEFAULT 0,
      tier_id INTEGER NOT NULL DEFAULT 1 REFERENCES tiers(id), points INTEGER NOT NULL DEFAULT 0,
      total_points_earned INTEGER NOT NULL DEFAULT 0, visit_count INTEGER NOT NULL DEFAULT 0,
      last_visit TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS customer_visits (
      id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source TEXT, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS reward_points (
      id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
      points INTEGER NOT NULL, reason TEXT NOT NULL, reference_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff',
      is_active INTEGER NOT NULL DEFAULT 1, last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS punch_cards (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      punches_required INTEGER NOT NULL, reward TEXT NOT NULL, reward_points INTEGER,
      start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS punch_progress (
      id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
      punch_card_id INTEGER NOT NULL REFERENCES punch_cards(id),
      punches INTEGER NOT NULL DEFAULT 0, completed_at TIMESTAMPTZ,
      reward_claimed INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(customer_id, punch_card_id)
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      description TEXT, discount_type TEXT NOT NULL, discount_value REAL NOT NULL,
      min_purchase REAL, max_uses INTEGER, uses_per_customer INTEGER NOT NULL DEFAULT 1,
      tier_restriction INTEGER REFERENCES tiers(id), start_date TIMESTAMPTZ,
      expiry_date TIMESTAMPTZ, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id SERIAL PRIMARY KEY, coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), redeemed_by INTEGER REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, message TEXT NOT NULL,
      audience_type TEXT NOT NULL, audience_tier_id INTEGER REFERENCES tiers(id),
      recipient_count INTEGER, estimated_cost REAL, status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, created_by INTEGER REFERENCES employees(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id SERIAL PRIMARY KEY, campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id), phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', twilio_sid TEXT, sent_at TIMESTAMPTZ, error_message TEXT
    );
    CREATE TABLE IF NOT EXISTS raffles (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, prize TEXT NOT NULL,
      draw_date TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      winner_id INTEGER REFERENCES customers(id), drawn_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS raffle_entries (
      id SERIAL PRIMARY KEY, raffle_id INTEGER NOT NULL REFERENCES raffles(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      tickets INTEGER NOT NULL DEFAULT 1, entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(raffle_id, customer_id)
    );
    CREATE TABLE IF NOT EXISTS weekly_ads (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL, is_active INTEGER NOT NULL DEFAULT 0,
      deployed_at TIMESTAMPTZ, created_by INTEGER REFERENCES employees(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS weekly_ad_images (
      id SERIAL PRIMARY KEY, weekly_ad_id INTEGER NOT NULL REFERENCES weekly_ads(id),
      filename TEXT NOT NULL, url TEXT NOT NULL, page_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
      items TEXT NOT NULL, ad_id INTEGER REFERENCES weekly_ads(id),
      sent_via_sms INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sms_queue (
      id SERIAL PRIMARY KEY, phone TEXT NOT NULL, message TEXT NOT NULL,
      type TEXT NOT NULL, reference_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sms_history (
      id SERIAL PRIMARY KEY, phone TEXT NOT NULL, message TEXT NOT NULL,
      twilio_sid TEXT, type TEXT NOT NULL, status TEXT NOT NULL, cost REAL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY, date DATE NOT NULL UNIQUE,
      new_customers INTEGER NOT NULL DEFAULT 0, total_customers INTEGER NOT NULL DEFAULT 0,
      sms_opt_ins INTEGER NOT NULL DEFAULT 0, campaigns_sent INTEGER NOT NULL DEFAULT 0,
      sms_sent INTEGER NOT NULL DEFAULT 0, coupons_redeemed INTEGER NOT NULL DEFAULT 0,
      ad_views INTEGER NOT NULL DEFAULT 0, ai_lists_generated INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY, employee_id INTEGER REFERENCES employees(id),
      action TEXT NOT NULL, entity TEXT, entity_id TEXT, details TEXT,
      ip_address TEXT, request_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS failed_jobs (
      id SERIAL PRIMARY KEY, job_type TEXT NOT NULL, payload TEXT NOT NULL,
      error TEXT, attempts INTEGER NOT NULL DEFAULT 0, failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1, last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_loyalty_id ON customers(loyalty_id);
    CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
    CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON sms_queue(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_reward_points_customer ON reward_points(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_visits_customer ON customer_visits(customer_id);
  `);
  logger.info('[MIGRATE] All tables created successfully');
}

module.exports = migrate();   
   
