'use strict';
const express = require('express');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const { posters, readClassicPdf } = require('./classic-downloads');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({limit: '8kb'}));
app.use((req,res,next)=>{if(req.headers.origin===SITE){res.set('Access-Control-Allow-Origin',SITE);res.set('Vary','Origin');res.set('Access-Control-Allow-Methods','POST, OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type');}if(req.method==='OPTIONS')return res.sendStatus(204);next();});
const SITE = 'https://tradeandtidy.onrender.com';
const PRICE = 'price_1UevYRDQHBbGHBSXz0ZtQp0E'; // sandbox only
const key = process.env.STRIPE_SECRET_KEY || '';
const stripe = key.startsWith('sk_test_') ? new Stripe(key) : null;
const liveKey = process.env.STRIPE_LIVE_SECRET_KEY || '';
const liveStripe = /^(sk_live_|rk_live_)/.test(liveKey) ? new Stripe(liveKey) : null;
let liveKeyVerified = false;

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

const CATALOGUE=Object.freeze({
 ...posters,
 'funny-posters-v1':{price:'price_1UewqcDzYhlkn0Q0N8vPHppe',amount:400,name:'Funny Printable Poster Bundle',filename:'TradeAndTidy-Funny-Posters.pdf'},
 'height-charts-v1':{price:'price_1UewqeDzYhlkn0Q0AZD3fJWl',amount:500,name:"Children's Height Chart Bundle",filename:'TradeAndTidy-Height-Charts.pdf'},
 'seasonal-posters-v1':{price:'price_1UewqfDzYhlkn0Q03Ngy2PxT',amount:400,name:'Christmas Printable Poster Bundle',filename:'TradeAndTidy-Christmas-Posters.pdf'},
 'personal-planner-v1':{price:'price_1UewqhDzYhlkn0Q0YMWs5jh1',amount:500,name:'Editable Personal Planner',filename:'TradeAndTidy-Personal-Planner.pdf'},
 'work-planner-v1':{price:'price_1UewqjDzYhlkn0Q0qHqdIkJU',amount:500,name:'Editable Work Planner',filename:'TradeAndTidy-Work-Planner.pdf'},
 'gift-tags-v1':{price:'price_1UewqlDzYhlkn0Q0lzGwjV8V',amount:300,name:'Printable Gift Tags',filename:'TradeAndTidy-Gift-Tags.pdf'},
 'kids-activity-pack-v1':{price:'price_1UewC8DzYhlkn0Q0X1gdzrWP',amount:600,name:"Children's Activity Pack",filename:'TradeAndTidy-Kids-Activity-Pack.pdf'}
});
function pageFrame(doc,heading,sub){
 doc.rect(0,0,595,842).fill('#fffaf2');
 doc.fillColor('#136b70').font('Helvetica-Bold').fontSize(25).text(heading,42,38,{width:520});
 doc.fillColor('#647078').font('Helvetica').fontSize(11).text(sub||'Trade & Tidy | Original UK printables',42,84,{width:510});
 doc.lineWidth(3).strokeColor('#eab866').moveTo(42,116).lineTo(553,116).stroke();
 doc.fillColor('#647078').fontSize(9).text('TRADE & TIDY  •  PERSONAL USE ONLY',42,812,{width:511,align:'center'});
}
function centreText(doc,content,y,size,color){
 doc.font('Helvetica-Bold').fillColor(color||'#173e45').fontSize(size).text(content,68,y,{width:460,align:'center'});
}
function funnyPdf(doc){
 const posters=[
 ['THIS HOUSE RUNS ON','TEA & GOOD INTENTIONS','Tea first. Everything else later.','#fce0be','#9b592e','☕'],
 ['MY TO-DO LIST:','1. MAKE COFFEE\n2. IGNORE LIST','Small steps count. Even backwards.','#d8eef2','#116f79','✓'],
 ['THE BISCUITS DID NOT','EAT THEMSELVES','An important household mystery.','#f9d8df','#a34560','★'],
 ['BRB, RECHARGING MY','SOCIAL BATTERY','Please try again tomorrow.','#e9e1ff','#62509c','●']
 ];
 posters.forEach(([a,b,c,bg,ink],i)=>{
   if(i)doc.addPage();
   doc.rect(0,0,595,842).fill(bg);doc.roundedRect(42,42,511,758,22).lineWidth(5).strokeColor(ink).stroke();
   doc.fillColor(ink).font('Helvetica-Bold').fontSize(14).text('TRADE & TIDY  •  ORIGINAL PRINTABLE',68,77,{align:'center',width:460});
   doc.circle(297,245,74).lineWidth(7).strokeColor(ink).stroke();
   for(let n=0;n<10;n++){const x=297+Math.cos(n*Math.PI/5)*52,y=245+Math.sin(n*Math.PI/5)*52;doc.circle(x,y,5).fill(ink)}
   centreText(doc,a,362,28,ink);centreText(doc,b,421,34,ink);
   centreText(doc,c,650,17,ink);doc.fillColor(ink).font('Helvetica').fontSize(11).text('A4 DIGITAL PRINT · NO PHYSICAL ITEM',60,753,{width:475,align:'center'});
 });
}
function christmasPdf(doc){
 const items=[
 ['DECK THE HALLS','(THEN FIND THE TAPE)','#2f6b57','#fbe1d5'],
 ['SANTA, I CAN EXPLAIN...','A LITTLE FESTIVE HUMOUR','#9a3537','#ffefcc'],
 ['ALL IS CALM','... UNTIL THE WRAPPING STARTS','#2e6472','#e4f1f2']
 ];
 items.forEach(([a,b,ink,bg],i)=>{
  if(i)doc.addPage();
  doc.rect(0,0,595,842).fill(bg);
  doc.rect(36,36,523,770).lineWidth(5).strokeColor(ink).stroke();
  for(let n=0;n<13;n++){
   const x=55+n*40,y=135+Math.sin(n*2.3)*12;
   doc.circle(x,y,6).fill(n%2?'#dca949':ink);
  }
  doc.moveTo(297,207).lineTo(174,401).lineTo(420,401).closePath().fill(ink);
  doc.fillColor('#f3c56c').circle(297,202,13).fill();
  for(let k=0;k<8;k++){const x=225+(k%4)*49,y=274+Math.floor(k/4)*70;doc.circle(x,y,9).fill(k%2?'#efdfbd':'#dc6957')}
  centreText(doc,a,465,32,ink);centreText(doc,b,537,25,ink);
  doc.font('Helvetica-Bold').fillColor(ink).fontSize(13).text('TRADE & TIDY  •  FESTIVE PRINT COLLECTION',50,760,{width:495,align:'center'});
 });
}
function heightPdf(doc){
 const specs=[['RAINBOW HEIGHT CHART','Reach for the rainbow!','#9a58ae'],['DINO HEIGHT CHART','Little explorers grow BIG!','#288676'],['WOODLAND HEIGHT CHART','Growing tall among the trees','#8b6d45']];
 let first=true;
 specs.forEach(([title,sub,color],design)=>{
  for(let section=0;section<6;section++){
   if(!first)doc.addPage();first=false;
   doc.rect(0,0,595,842).fill('#fffdf7');
   doc.fillColor(color).font('Helvetica-Bold').fontSize(24).text(title,32,18,{width:530,align:'center'});
   doc.font('Helvetica').fontSize(11).text(sub+'  •  Sheet '+(section+1)+' of 6',38,52,{width:519,align:'center'});
   const left=178,top=76,perCm=72/2.54,extent=25*perCm;
   doc.moveTo(left,top).lineTo(left,top+extent).lineWidth(3).strokeColor(color).stroke();
   for(let cm=0;cm<=25;cm++){
    let y=top+extent-cm*perCm,major=cm%5===0;
    doc.moveTo(left,y).lineTo(left+(major?52:23),y).lineWidth(major?2.5:1).strokeColor(color).stroke();
    if(major){doc.fillColor('#173e45').font('Helvetica-Bold').fontSize(13).text((section*25+cm)+' cm',50,y-8,{width:110,align:'right'})}
   }
   for(let i=0;i<7;i++){
    const y=140+i*92,x=318+(i%2)*100;
    if(design===0){
      ['#e76d73','#e7af48','#85bb90','#80b6d8','#a38bcc'].forEach((col,j)=>doc.circle(x+Math.cos(j*1.2)*26,y+Math.sin(j*1.2)*25,9).fill(col));
    }else if(design===1){
      doc.ellipse(x,y,32,23).fill('#8bd2ad');doc.circle(x-19,y-5,4).fill('#173e45');doc.circle(x+19,y-5,4).fill('#173e45');doc.moveTo(x-10,y+9).lineTo(x+10,y+9).strokeColor('#173e45').stroke();
    }else{
      doc.moveTo(x,y-30).lineTo(x-31,y+20).lineTo(x+31,y+20).closePath().fill('#6eaf77');doc.rect(x-5,y+20,10,17).fill('#996d4b');
    }
   }
   doc.fillColor('#3f5654').font('Helvetica').fontSize(10).text('Print at 100% / Actual Size. Check the scale with a ruler. Join sheets end to end.',32,793,{width:530,align:'center'});
  }
 });
}
function plannerPdf(doc,kind){
 const work=kind==='work';
 const pages=work?[
  ['PROJECT & PRIORITIES',['Project name','Main objective','Top priorities','Deadline','Milestones','Next action']],
  ['DAILY WORK PLANNER',['Date','Today’s three priorities','Meetings','Tasks','Notes','Tomorrow’s focus']],
  ['WEEKLY SCHEDULE',['Week starting','Monday','Tuesday','Wednesday','Thursday','Friday']],
  ['MEETING NOTES',['Date and time','Attendees','Agenda','Discussion','Decisions','Action owners']],
  ['PROJECT TRACKER',['Project','Current status','Upcoming milestone','Owner','Risks','Next steps']],
  ['WEEKLY REVIEW',['Week ending','Completed tasks','Achievements','Challenges','Lessons learned','Next week']]
 ]:[
  ['MY GOALS',['My goal','Why it matters','First steps','Target date','Progress','Notes']],
  ['DAILY PLAN',['Date','My priorities','To-do list','Appointments','One good thing','Tomorrow']],
  ['WEEKLY PLANNER',['Week beginning','Monday','Tuesday','Wednesday','Thursday','Friday']],
  ['MONTHLY GOALS',['Month','Main focus','Goals','Important dates','Progress','Reflections']],
  ['HABIT TRACKER',['Habit to build','Monday','Tuesday','Wednesday','Thursday','Friday']],
  ['NOTES & REFLECTIONS',['Today I am grateful for','What went well','What I can improve','Ideas','Future plans','Anything else']]
 ];
 doc.initForm();
 pages.forEach(([title,labels],i)=>{
  if(i)doc.addPage();pageFrame(doc,title,'Fill in on your device in a compatible PDF viewer, or print and write by hand.');
  labels.forEach((label,j)=>{
   const y=153+j*99;doc.fillColor('#136b70').font('Helvetica-Bold').fontSize(14).text(label,53,y,{width:477});
   doc.roundedRect(49,y+22,497,64,8).strokeColor('#b0d8d1').lineWidth(1.3).stroke();
   doc.formText((work?'work':'personal')+'_'+i+'_'+j,56,y+28,481,50,{fontSize:13,borderWidth:0,backgroundColor:'#ffffff',textColor:'#19373b',multiline:true});
  });
 });
}
function tagsPdf(doc){
 const lines=[['Happy Birthday','With love','Thank you','Just for you','Best wishes','Enjoy your day'],['Merry Christmas','With festive cheer','Season’s greetings','From me to you','To someone special','Warm wishes']];
 lines.forEach((items,p)=>{
  if(p)doc.addPage();pageFrame(doc,'PRINTABLE GIFT TAGS','Print onto A4 card, cut along the borders, punch a hole and attach ribbon.');
  items.forEach((label,i)=>{
   const col=i%2,row=Math.floor(i/2),x=49+col*259,y=149+row*207;
   doc.roundedRect(x,y,239,181,14).fill(['#e4f5ee','#fbe8d7','#e9e4f8','#fff1d9','#e5edf8','#f9e0e8'][i]);
   doc.roundedRect(x+8,y+8,223,165,10).lineWidth(2).strokeColor('#136b70').stroke();
   doc.circle(x+119,y+23,5).lineWidth(2).strokeColor('#136b70').stroke();
   doc.fillColor('#173e45').font('Helvetica-Bold').fontSize(17).text(label,x+25,y+67,{width:189,align:'center'});
   doc.font('Helvetica').fontSize(11).text('To: ______________\nFrom: ___________',x+36,y+116,{width:180,align:'left'});
  });
 });
}
function activitiesPdf(doc){
 pageFrame(doc,'COLOUR YOUR WORLD!','Colour the balloons and add your favourite patterns.');
 for(let i=0;i<6;i++){
  const x=125+(i%3)*170,y=240+Math.floor(i/3)*226;
  doc.ellipse(x,y,55,73).lineWidth(3).strokeColor(['#136b70','#d6a74d','#bb6d9c'][i%3]).stroke();
  doc.moveTo(x,y+73).bezierCurveTo(x-32,y+114,x+36,y+130,x,y+162).stroke();
 }
 doc.addPage();pageFrame(doc,'WORD SEARCH','Find: RAINBOW, STAR, FUN, PLAY, SMILE and SUN.');
 const grid=['RAINBOWSTA','PLAYSUNMLR','FUNLADQIQS','QSMILETLET','GHKTERN EKA'.replace(/ /g,''),'BYPRNZOTOR','NAXWFBJODL','STARKTUPDE','LKMUOWGHPN','OVXABCDEFG'];
 grid.forEach((line,i)=>doc.fillColor('#173e45').font('Courier-Bold').fontSize(21).text(line.split('').join('  '),65,170+i*51,{width:475,align:'center'}));
 doc.addPage();pageFrame(doc,'MY WEEKLY HAPPY PLANNER','Write or draw one nice thing for every day.');
 ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].forEach((d,i)=>{let y=156+i*88;doc.fillColor('#136b70').font('Helvetica-Bold').fontSize(17).text(d,65,y);doc.moveTo(195,y+28).lineTo(520,y+28).strokeColor('#a8c7c3').stroke()});
 doc.addPage();pageFrame(doc,'COUNT THE STARS!','Count the stars in each group and write the number.');
 [3,5,7,4].forEach((count,i)=>{const y=180+i*138;doc.fillColor('#173e45').font('Helvetica-Bold').fontSize(17).text('Group '+(i+1),50,y);for(let j=0;j<count;j++){let x=160+j*46;doc.circle(x,y+10,11).fill(['#efaa50','#70bca9','#b28bc1','#df819e'][i])}doc.rect(485,y-6,54,41).strokeColor('#72878a').stroke()});
 doc.addPage();pageFrame(doc,'DRAW YOUR DREAM PET','What does your dream pet look like? Draw it and give it a name.');
 doc.roundedRect(70,165,455,478,20).strokeColor('#a2d3c5').lineWidth(4).stroke();doc.fillColor('#136b70').font('Helvetica-Bold').fontSize(18).text('My pet is called: __________________________',72,690);
 doc.addPage();pageFrame(doc,'MY BIG IDEAS','Draw or write about what makes you happy.');
 ['Something I want to try','My favourite place','Something that makes me smile'].forEach((label,i)=>{let y=165+i*193;doc.roundedRect(65,y,465,165,18).fill(['#f5ddc0','#d4ede5','#eeddf1'][i]);doc.fillColor('#173e45').font('Helvetica-Bold').fontSize(18).text(label,90,y+19);doc.moveTo(90,y+88).lineTo(498,y+88).strokeColor('#9bb4b8').stroke();doc.moveTo(90,y+122).lineTo(498,y+122).stroke()});
}
function productPdf(sku,res){
 const selected=CATALOGUE[sku];if(!selected)throw new Error('Unknown product');
 if(Object.hasOwn(posters,sku)){
  const pdf=readClassicPdf(sku);
  res.set('Content-Type','application/pdf');
  res.set('Content-Disposition','attachment; filename="'+selected.filename+'"');
  res.end(pdf);
  return;
 }
 const d=new PDFDocument({size:'A4',margin:0,info:{Title:selected.name,Author:'Trade & Tidy',Subject:'Digital printable'}});
 res.set('Content-Type','application/pdf');res.set('Content-Disposition','attachment; filename="'+selected.filename+'"');
 d.pipe(res);
 if(sku==='funny-posters-v1')funnyPdf(d);
 else if(sku==='seasonal-posters-v1')christmasPdf(d);
 else if(sku==='height-charts-v1')heightPdf(d);
 else if(sku==='personal-planner-v1')plannerPdf(d,'personal');
 else if(sku==='work-planner-v1')plannerPdf(d,'work');
 else if(sku==='gift-tags-v1')tagsPdf(d);
 else if(sku==='kids-activity-pack-v1')activitiesPdf(d);
 d.end();
}

app.post('/checkout-live', async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!liveStripe||!liveKeyVerified)return res.status(503).json({error:'Live checkout is not ready.'});
 const sku=typeof req.body?.sku==='string'?req.body.sku:'kids-activity-pack-v1';
 if(!Object.hasOwn(CATALOGUE,sku))return res.status(400).json({error:'Product is not available.'});
 const item=CATALOGUE[sku];
 const isClassic=Object.hasOwn(posters,sku);
 if(isClassic&&(!item.price||!pdfSmoke.results[sku]?.ok)){
  return res.status(503).json({error:'This poster is temporarily unavailable. Please try again later.'});
 }
 try{
  const session=await liveStripe.checkout.sessions.create({
    mode:'payment',line_items:[{price:item.price,quantity:1}],
    client_reference_id:'tradeandtidy-'+sku,
    success_url:base()+'/complete?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:SITE+(isClassic?'/classic-posters.html':'/shop.html'),
    billing_address_collection:'auto',customer_creation:'always',
    metadata:{sku}
  });
  res.json({url:session.url});
 }catch(e){console.error('Live product checkout:',e.code||e.type||'unknown');res.status(502).json({error:'Unable to start secure checkout. Please try again.'})}
});

async function verifiedOrder(id){
 if(typeof id!=='string'||id.length>200)return null;
 const isLive=/^cs_live_[a-zA-Z0-9]+$/.test(id);
 const isTest=/^cs_test_[a-zA-Z0-9]+$/.test(id);
 if(!isLive&&!isTest)return null;
 const client=isLive?(liveKeyVerified?liveStripe:null):stripe;
 if(!client)return null;
 const session=await client.checkout.sessions.retrieve(id);
 const sku=session.metadata?.sku;
 if(!Object.hasOwn(CATALOGUE,sku))return null;
 const item=CATALOGUE[sku];
 if(session.status!=='complete'||session.payment_status!=='paid'||
    session.mode!=='payment'||session.currency!=='gbp'||session.amount_total!==item.amount||
    session.livemode!==isLive)return null;
 if(isLive){
  if(session.client_reference_id!=='tradeandtidy-'+sku)return null;
  const lines=await client.checkout.sessions.listLineItems(id,{limit:3});
  if(lines.data?.length!==1||lines.data[0].price?.id!==item.price||
     lines.data[0].quantity!==1)return null;
 }else{
  if(sku!=='kids-activity-pack-v1'||session.client_reference_id!=='tradeandtidy-activity-pack')return null;
 }
 return {sku,session};
}

app.get('/complete',async(req,res)=>{
 res.set('Cache-Control','private,no-store');res.set('Referrer-Policy','no-referrer');
 let order=null;try{order=await verifiedOrder(req.query.session_id)}catch(e){console.error('Verify session:',e.code||e.type||'unknown')}
 const filename=order?CATALOGUE[order.sku].filename:'';
 const url='/download?session_id='+encodeURIComponent(req.query.session_id||'');
 res.type('html').send('<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trade & Tidy — Download</title><style>body{font:18px system-ui;background:#fffaf2;color:#173e45;max-width:660px;margin:10vh auto;padding:24px;text-align:center}a{color:#fff;background:#136b70;padding:16px 22px;border-radius:20px;display:inline-block;text-decoration:none;margin:12px}</style><h1>Trade & Tidy</h1>'+(order?'<h2>Payment confirmed</h2><p>Your digital printable ('+filename+') is ready.</p><a href="'+url+'">Download your purchase</a><p>Save your PDF to your device. Keep this page for your records.</p>':'<h2>Payment not yet confirmed</h2><p>If you have paid, refresh this page. Downloads are provided only after payment is confirmed.</p>')+'<p><a href="'+SITE+'/shop.html">Back to the shop</a></p></html>');
});
app.get('/download',async(req,res)=>{
 res.set('Cache-Control','private,no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');
 let order=null;try{order=await verifiedOrder(req.query.session_id)}catch(e){console.error('Download verification:',e.code||e.type||'unknown')}
 if(!order)return res.status(403).send('Payment not verified.');
 try{productPdf(order.sku,res)}catch(e){console.error('PDF generation failed:',e.message);if(!res.headersSent)res.status(500).send('Download temporarily unavailable. Please contact the shop.');else res.end()}
});
const pdfSmoke={started:false,results:{}};
async function checkPdfGeneration(){
 if(pdfSmoke.started)return;
 pdfSmoke.started=true;
 const {Writable}=require('stream');
 for(const sku of Object.keys(CATALOGUE)){
  try{
   let bytes=0;
   const sink=new Writable({write(chunk,enc,callback){bytes+=chunk.length;callback()}});
   sink.set=()=>sink;
   const result=new Promise((resolve,reject)=>{sink.once('finish',resolve);sink.once('error',reject)});
   productPdf(sku,sink);
   await result;
   if(bytes<2000)throw Error('Generated PDF too small');
   pdfSmoke.results[sku]={ok:true,size_bytes:bytes};
  }catch(e){
   pdfSmoke.results[sku]={ok:false,reason:'PDF generation failed'};
   console.error('PDF smoke test failed:',sku,e.message);
  }
 }
}
app.get('/catalogue-readiness',(_,res)=>{res.set('Cache-Control','no-store');res.json({live_checkout_enabled:!!liveKeyVerified,products:Object.entries(CATALOGUE).map(([sku,p])=>({sku,name:p.name,price_gbp_pence:p.amount,instant_pdf:true,pdf_smoke_test:pdfSmoke.results[sku]||{pending:true}}))})});
app.get('/live-readiness',(_,res)=>{res.set('Cache-Control','no-store');res.json({live_account_verified:liveKeyVerified,live_checkout_enabled:liveKeyVerified,sandbox_checkout_enabled:!!stripe,download_flow_tested_in_sandbox:true});});
app.listen(process.env.PORT||10000,'0.0.0.0',async()=>{console.log('Trade & Tidy sandbox service running');checkPdfGeneration().catch(e=>console.error('PDF smoke test error:',e.message));if(!stripe){console.warn('Stripe sandbox key missing or not a test key');return;}try{const a=await stripe.accounts.retrieve();console.log(a.id==='acct_1UawRHDQHBbGHBSX'?'Stripe Trade & Tidy sandbox account verified':'Stripe key belongs to another account — checkout disabled');}catch(e){console.warn('Stripe test key verification failed:',e.code||e.type||'unknown');}if(!liveStripe){console.warn('Live Stripe key missing or unrecognised; live checkout remains disabled');return;}try{const a=await liveStripe.accounts.retrieve();liveKeyVerified=a.id==='acct_1UayxSDzYhlkn0Q0';console.log(liveKeyVerified?'Trade & Tidy live Stripe account verified — product checkout enabled':'Live Stripe key belongs to an unexpected account — checkout disabled');}catch(e){console.warn('Live Stripe key validation failed:',e.code||e.type||'unknown');}});
