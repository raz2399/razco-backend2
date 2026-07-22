const express=require('express'),router=express.Router(),{getDatabase}=require('../config/database');
router.get('/',(req,res)=>{try{const db=getDatabase(),coupons=db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();res.json({success:true,coupons})}catch(e){res.json({success:false,coupons:[]})}});
router.post('/',(req,res)=>{try{const db=getDatabase(),{code,name,discount_type,discount_value,expiry_date,max_uses}=req.body;const r=db.prepare('INSERT INTO coupons (code,name,discount_type,discount_value,expiry_date,max_uses,is_active) VALUES (?,?,?,?,?,?,1)').run(code,name,discount_type||'percent',discount_value||10,expiry_date||null,max_uses||null);res.json({success:true,id:r.lastInsertRowid})}catch(e){res.json({success:false,error:e.message})}});
module.exports=router;
