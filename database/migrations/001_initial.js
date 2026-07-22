const { getDatabase } = require('../../config/database');
const logger = require('../../utils/logger');

function migrate() {
  const db = getDatabase();

  db.exec(`
    -- TIERS
    CREATE TABLE IF NOT EXISTS tiers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      min_points  INTEGER NOT NULL,
      multiplier  REAL NOT NULL DEFAULT 1.0,
      color_hex   TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- CUSTOMERS
    CREATE TABLE IF NOT EXISTS customers (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      loyalty_id            TEXT UNIQUE NOT NULL,
      name                  TEXT NOT NULL,
      phone                 TEXT UNIQUE NOT NULL,
      email                 TEXT,
      sms_opt_in            INTEGER NOT NULL DEFAULT 0,
      tier_id               INTEGER NOT NULL DEFAULT 1 REFERENCES tiers(id),
      points                INTEGER NOT NULL DEFAULT 0,
      total_points_earned   INTEGER NOT NULL DEFAULT 0,
      visit_count           INTEGER NOT NULL DEFAULT 0,
      last_visit            TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      is_active             INTEGER NOT NULL DEFAULT 1
    );

    -- CUSTOMER VISITS
    CREATE TABLE IF NOT EXISTS customer_visits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      visited_at  TEXT NOT NULL DEFAULT (datetime('now')),
      source      TEXT,
      notes       TEXT
    );

    -- REWARD POINTS LEDGER
    CREATE TABLE IF NOT EXISTS reward_points (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      points      INTEGER NOT NULL,
      reason      TEXT NOT NULL,
      reference_id TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- EMPLOYEES
    CREATE TABLE IF NOT EXISTS employees (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'staff',
      is_active     INTEGER NOT NULL DEFAULT 1,
      last_login    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- PUNCH CARDS (templates)
    CREATE TABLE IF NOT EXISTS punch_cards (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      description      TEXT,
      punches_required INTEGER NOT NULL,
      reward           TEXT NOT NULL,
      reward_points    INTEGER,
      start_date       TEXT,
      end_date         TEXT,
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- PUNCH PROGRESS (per customer)
    CREATE TABLE IF NOT EXISTS punch_progress (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id),
      punch_card_id  INTEGER NOT NULL REFERENCES punch_cards(id),
      punches        INTEGER NOT NULL DEFAULT 0,
      completed_at   TEXT,
      reward_claimed INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, punch_card_id)
    );

    -- COUPONS
    CREATE TABLE IF NOT EXISTS coupons (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      code             TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      description      TEXT,
      discount_type    TEXT NOT NULL,
      discount_value   REAL NOT NULL,
      min_purchase     REAL,
      max_uses         INTEGER,
      uses_per_customer INTEGER NOT NULL DEFAULT 1,
      tier_restriction INTEGER REFERENCES tiers(id),
      start_date       TEXT,
      expiry_date      TEXT,
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- COUPON REDEMPTIONS
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id   INTEGER NOT NULL REFERENCES coupons(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
      redeemed_by INTEGER REFERENCES employees(id)
    );

    -- CAMPAIGNS
    CREATE TABLE IF NOT EXISTS campaigns (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      message          TEXT NOT NULL,
      audience_type    TEXT NOT NULL,
      audience_tier_id INTEGER REFERENCES tiers(id),
      recipient_count  INTEGER,
      estimated_cost   REAL,
      status           TEXT NOT NULL DEFAULT 'draft',
      scheduled_at     TEXT,
      sent_at          TEXT,
      created_by       INTEGER REFERENCES employees(id),
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- CAMPAIGN RECIPIENTS
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      phone       TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'queued',
      twilio_sid  TEXT,
      sent_at     TEXT,
      error_message TEXT
    );

    -- RAFFLES
    CREATE TABLE IF NOT EXISTS raffles (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      prize     TEXT NOT NULL,
      draw_date TEXT NOT NULL,
      status    TEXT NOT NULL DEFAULT 'open',
      winner_id INTEGER REFERENCES customers(id),
      drawn_at  TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- RAFFLE ENTRIES
    CREATE TABLE IF NOT EXISTS raffle_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      raffle_id   INTEGER NOT NULL REFERENCES raffles(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      tickets     INTEGER NOT NULL DEFAULT 1,
      entered_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(raffle_id, customer_id)
    );

    -- WEEKLY ADS
    CREATE TABLE IF NOT EXISTS weekly_ads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL,
      is_active   INTEGER NOT NULL DEFAULT 0,
      deployed_at TEXT,
      created_by  INTEGER REFERENCES employees(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- WEEKLY AD IMAGES
    CREATE TABLE IF NOT EXISTS weekly_ad_images (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      weekly_ad_id INTEGER NOT NULL REFERENCES weekly_ads(id),
      filename     TEXT NOT NULL,
      url          TEXT NOT NULL,
      page_order   INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- AI SHOPPING LISTS
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      items       TEXT NOT NULL,
      ad_id       INTEGER REFERENCES weekly_ads(id),
      sent_via_sms INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- SMS QUEUE
    CREATE TABLE IF NOT EXISTS sms_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone           TEXT NOT NULL,
      message         TEXT NOT NULL,
      type            TEXT NOT NULL,
      reference_id    TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- SMS HISTORY
    CREATE TABLE IF NOT EXISTS sms_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phone      TEXT NOT NULL,
      message    TEXT NOT NULL,
      twilio_sid TEXT,
      type       TEXT NOT NULL,
      status     TEXT NOT NULL,
      cost       REAL,
      sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ANALYTICS SNAPSHOTS
    CREATE TABLE IF NOT EXISTS analytics (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      date                 TEXT NOT NULL UNIQUE,
      new_customers        INTEGER NOT NULL DEFAULT 0,
      total_customers      INTEGER NOT NULL DEFAULT 0,
      sms_opt_ins          INTEGER NOT NULL DEFAULT 0,
      campaigns_sent       INTEGER NOT NULL DEFAULT 0,
      sms_sent             INTEGER NOT NULL DEFAULT 0,
      coupons_redeemed     INTEGER NOT NULL DEFAULT 0,
      ad_views             INTEGER NOT NULL DEFAULT 0,
      ai_lists_generated   INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- SETTINGS
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- AUDIT LOG
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER REFERENCES employees(id),
      action      TEXT NOT NULL,
      entity      TEXT,
      entity_id   TEXT,
      details     TEXT,
      ip_address  TEXT,
      request_id  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- FAILED JOBS
    CREATE TABLE IF NOT EXISTS failed_jobs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type   TEXT NOT NULL,
      payload    TEXT NOT NULL,
      error      TEXT,
      attempts   INTEGER NOT NULL DEFAULT 0,
      failed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- API KEYS
    CREATE TABLE IF NOT EXISTS api_keys (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      key_hash     TEXT NOT NULL,
      is_active    INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_customers_phone       ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_loyalty_id  ON customers(loyalty_id);
    CREATE INDEX IF NOT EXISTS idx_customers_tier        ON customers(tier_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status   ON campaign_recipients(status);
    CREATE INDEX IF NOT EXISTS idx_sms_queue_status      ON sms_queue(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_reward_points_customer ON reward_points(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_visits_customer ON customer_visits(customer_id);
  `);

  logger.info('[MIGRATE] All tables created successfully');
}

migrate();
