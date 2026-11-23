'use strict';
const express = require('express');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({limit: '8kb'}));
app.use((req,res,next)=>{if(req.headers.origin===SITE){res.set('Access-Control-Allow-Origin',SITE);res.set('Vary','Origin');res.set('Access-Control-Allow-Methods','POST, OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type');}if(req.method==='OPTIONS')return res.sendStatus(204);next();});
const SITE = 'https://tradeandtidy.onrender.com';
const PRICE = 'price_1UevYRDQHBbGHBSXz0ZtQp0E'; // sandbox only
const key = process.env.STRIPE_SECRET_KEY || '';
const stripe = key.startsWith('sk_test_') ? new Stripe(key) : null;
const base = () => process.env.PUBLIC_URL || 'https://tradeandtidy-checkout.onrender.com';
app.get('/health',async(_,res)=>{let connected=false;let correctAccount=false; if(stripe){try{const account=await stripe.accounts.retrieve();connected=true;correctAccount=account.id==='acct_1UawRHDQHBbGHBSX';}catch(e){console.error('Stripe account check:',e.code||e.type||'unknown');}}res.json({ok:true,checkout_ready:!!stripe&&correctAccount,stripe_connected:connected,correct_sandbox_account:correctAccount,mode:'test'});});
app.get('/',(_,res)=>res.redirect(SITE));
app.post('/checkout',async (req,res)=>{
  res.set('Cache-Control','no-store');
  if(!stripe) return res.status(503).json({error:'Sandbox checkout is not configured yet.'});
  try{
    const account=await stripe.accounts.retrieve();
    if(account.id!=='acct_1UawRHDQHBbGHBSX')return res.status(503).json({error:'The Stripe test key is connected to a different sandbox account. Please use the Trade & Tidy Sandbox secret key.'});
    const session = await stripe.checkout.sessions.create({
      mode:'payment',line_items:[{price:PRICE,quantity:1}],
      client_reference_id:'tradeandtidy-activity-pack',
      success_url:base()+'/complete?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:SITE+'/#activities',
      billing_address_collection:'auto',
      customer_creation:'always',
      metadata:{sku:'kids-activity-pack-v1'}
    });
    return res.json({url:session.url});
  }catch(e){console.error('Stripe checkout:',e.code||e.type||e.message);return res.status(502).json({error:e.code==='resource_missing'?'Test product could not be found in the connected sandbox. Please check the Stripe test key.':'Unable to start checkout. Check the connected sandbox key and try again.'});}
});
async function paid(id){
  if(!stripe || !/^cs_test_[a-zA-Z0-9]+$/.test(id||'')) return false;
  const session=await stripe.checkout.sessions.retrieve(id);
  return session.payment_status==='paid' &&
    session.mode==='payment' && session.metadata?.sku==='kids-activity-pack-v1' &&
    session.amount_total===600 && session.currency==='gbp';
}
app.get('/complete',async(req,res)=>{
  res.set('Cache-Control','no-store');
  let ok=false;
  try{ok=await paid(req.query.session_id);}catch(e){console.error(e.message);}
  const url='/download?session_id='+encodeURIComponent(req.query.session_id||'');
  res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trade & Tidy — Download</title><style>body{font:18px system-ui;background:#fffaf2;color:#173e45;max-width:660px;margin:10vh auto;padding:24px;text-align:center}a{color:#fff;background:#136b70;padding:16px 22px;border-radius:22px;display:inline-block;text-decoration:none;margin:14px}</style><h1>Trade & Tidy</h1>'+(ok?'<h2>Payment confirmed</h2><p>Your printable activity pack is ready.</p><a href="'+url+'">Download your PDF</a><p>Save the file to your device.</p>':'<h2>Payment not yet confirmed</h2><p>If you completed payment, please refresh this page shortly. No download is released before confirmation.</p>')+'<p><a href="'+SITE+'">Back to shop</a></p></html>');
});
app.get('/download',async(req,res)=>{
  res.set('Cache-Control','private, no-store');
  try{
    if(!(await paid(req.query.session_id))) return res.status(403).send('Payment not verified.');
  }catch(e){console.error(e.message);return res.status(403).send('Payment not verified.');}
  res.type('application/pdf');
  res.set('Content-Disposition','attachment; filename="TradeAndTidy-Kids-Activity-Pack.pdf"');
  const doc=new PDFDocument({size:'A4',margin:48,info:{Title:"Trade & Tidy Children's Activity Pack",Author:'Trade & Tidy'}});
  doc.pipe(res);
  function page(title,subtitle){
    doc.rect(0,0,595,842).fill('#fffaf2');doc.fillColor('#136b70').fontSize(28).font('Helvetica-Bold').text(title,50,52);
    doc.fontSize(12).font('Helvetica').fillColor('#526168').text(subtitle,50,97);
    doc.strokeColor('#f5bd69').lineWidth(4).moveTo(50,126).lineTo(544,126).stroke();
    doc.fillColor('#526168').fontSize(10).text('Trade & Tidy  |  Printable activities for personal use',50,785,{align:'center'});
  }
  page('COLOUR YOUR WORLD!','Colour in the balloons and add your own patterns.');
  [0,1,2,3,4,5].forEach((n)=>{
    const x=130+(n%3)*165,y=245+Math.floor(n/3)*235;
    doc.strokeColor(['#136b70','#f5bd69','#cb77a5'][n%3]).lineWidth(3).ellipse(x,y,54,72).stroke();
    doc.moveTo(x,y+72).bezierCurveTo(x-32,y+117,x+32,y+136,x,y+169).stroke();
    doc.fontSize(16).fillColor('#182b35').text(['A','B','C','D','E','F'][n],x-10,y-8);
  });
  doc.addPage();page('WORD SEARCH','Find these six words: RAINBOW, STAR, FUN, PLAY, SMILE, SUN.');
  const grid=['R A I N B O W S T A','P L A Y S U N M L R','F U N L A D Q I Q S','Q S M I L E T L E T','G H K T E R N E K A','B Y P R N Z O T O R','N A X W F B J O D L','S T A R K T U P D E','L K M U O W G H P N','O V X A B C D E F G'];
  doc.font('Courier-Bold').fontSize(20).fillColor('#182b35');
  grid.forEach((line,i)=>doc.text(line,87,176+i*45,{characterSpacing:6}));
  doc.font('Helvetica').fontSize(12).fillColor('#136b70').text('Circle each word when you find it!',74,660);
  doc.addPage();page('MY WEEKLY HAPPY PLANNER','Write one happy thing you want to do each day.');
  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].forEach((d,i)=>{
    let y=164+i*82;doc.fillColor('#136b70').fontSize(15).font('Helvetica-Bold').text(d,66,y);
    doc.strokeColor('#bbd4cd').lineWidth(1).moveTo(170,y+23).lineTo(525,y+23).stroke();
  });
  doc.addPage();page('COUNT THE STARS!','Count the colourful stars in each row and write the answer.');
  const groups=[[3,'#efaa50'],[5,'#4eaa9f'],[7,'#b781bd'],[4,'#e67c98']];
  groups.forEach(([count,color],row)=>{
    const y=200+row*126;
    doc.fillColor('#263b52').font('Helvetica-Bold').fontSize(16).text('Row '+(row+1),58,y+10);
    for(let j=0;j<count;j++){
      const x=165+j*47;
      const pts=[];for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5;const rad=k%2?10:23;pts.push([x+rad*Math.cos(a),y+20+rad*Math.sin(a)]);}
      doc.polygon(...pts.flat()).fill(color);
    }
    doc.strokeColor('#879ca7').rect(485,y+1,52,44).stroke();
  });
  doc.fillColor('#136b70').fontSize(14).font('Helvetica-Bold').text('You did it! Colour the stars again if you like.',60,710);
  doc.addPage();page('DRAW YOUR DREAM PET','What would your dream pet look like? Give it a name!');
  doc.roundedRect(70,170,455,465,20).lineWidth(5).strokeColor('#b5dcd4').stroke();
  doc.fillColor('#136b70').font('Helvetica-Bold').fontSize(19).text('My pet is called:',75,670);
  doc.moveTo(244,694).lineTo(520,694).lineWidth(2).strokeColor('#b5dcd4').stroke();
  doc.addPage();page('MY BIG IDEAS','Plan a fun day! Write or draw your favourite ideas.');
  [['Something I want to try','#f9d9ad'],['My favourite place','#c4e9e1'],['Something that makes me smile','#efd4ec']].forEach(([label,color],idx)=>{
     const y=166+idx*185;doc.roundedRect(72,y,452,153,18).fill(color);
     doc.fillColor('#30495a').font('Helvetica-Bold').fontSize(18).text(label,96,y+20);
     doc.moveTo(96,y+78).lineTo(490,y+78).lineWidth(1).strokeColor('#8eacb5').stroke();
     doc.moveTo(96,y+116).lineTo(490,y+116).stroke();
  });
  doc.end();
});
app.listen(process.env.PORT||10000,'0.0.0.0',async()=>{console.log('Trade & Tidy sandbox service running');if(!stripe){console.warn('Stripe sandbox key missing or not a test key');return;}try{const a=await stripe.accounts.retrieve();console.log(a.id==='acct_1UawRHDQHBbGHBSX'?'Stripe Trade & Tidy sandbox account verified':'Stripe key belongs to another account — checkout disabled');}catch(e){console.warn('Stripe test key verification failed:',e.code||e.type||'unknown');}});
