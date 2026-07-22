const express=require('express'),router=express.Router(),{getDatabase}=require('../config/database');
router.get('/',(req,res)=>{try{const db=getDatabase(),punchCards=db.prepare('SELECT * FROM punch_cards ORDER BY created_at DESC').all();res.json({success:true,punchCards})}catch(e){res.json({success:false,punchCards:[]})}});
router.post('/',(req,res)=>{try{const db=getDatabase(),{name,reward,visits_required}=req.body;const r=db.prepare('INSERT INTO punch_cards (name,reward,punches_required,is_active) VALUES (?,?,?,1)').run(name,reward,visits_required||10);res.json({success:true,id:r.lastInsertRowid})}catch(e){res.json({success:false,error:e.message})}});
router.put('/:id',(req,res)=>{try{const db=getDatabase();db.prepare('UPDATE punch_cards SET is_active=? WHERE id=?').run(req.body.active?1:0,req.params.id);res.json({success:true})}catch(e){res.json({success:false})}});
module.exports=router;
