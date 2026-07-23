const express = require('express');
const router = express.Router();
const { all, get, query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const ad = await get('SELECT * FROM weekly_ads WHERE is_active=1 ORDER BY created_at DESC LIMIT 1');
    if (!ad) return res.json({ success: true, ad: null });
    const images = await all('SELECT * FROM weekly_ad_images WHERE weekly_ad_id=$1 ORDER BY page_order ASC', [ad.id]);
    res.json({ success: true, ad: { id: ad.id, dates: ad.title, images: images.map(i => ({ name: i.filename, src: i.url })) } });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { dates, images } = req.body;
    if (!images || !images.length) return res.json({ success: false, error: 'No images' });
    await query('UPDATE weekly_ads SET is_active=0 WHERE is_active=1');
    const r = await query(
      'INSERT INTO weekly_ads (title, start_date, end_date, is_active, deployed_at) VALUES ($1, NOW(), NOW(), 1, NOW()) RETURNING id',
      [dates || 'Weekly Ad']
    );
    const adId = r.rows[0].id;
    for (let i = 0; i < images.length; i++) {
      await query('INSERT INTO weekly_ad_images (weekly_ad_id, filename, url, page_order) VALUES ($1,$2,$3,$4)',
        [adId, images[i].name || `page_${i+1}`, images[i].src, i]);
    }
    res.json({ success: true, count: images.length });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
