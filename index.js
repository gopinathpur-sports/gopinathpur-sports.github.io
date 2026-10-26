const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const admin=require('firebase-admin');admin.initializeApp();
async function sendAll(title,body){
  const db=admin.firestore(),tokens=(await db.collection('fcmTokens').get()).docs.map(d=>d.id);
  for(let i=0;i<tokens.length;i+=500){const t=tokens.slice(i,i+500);
    const r=await admin.messaging().sendEachForMulticast({tokens:t,data:{title,body}});
    r.responses.forEach((x,j)=>{if(!x.success&&/not-registered|invalid-registration/.test((x.error&&x.error.code)||''))db.doc('fcmTokens/'+t[j]).delete()})}
}
exports.matchPush=onDocumentWritten('matches/{id}',async e=>{
  const a=e.data.after.exists?e.data.after.data():null,b=e.data.before.exists?e.data.before.data():null;if(!a)return;
  const sc=`${a.home} ${a.hs||0}–${a.as||0} ${a.away}`;
  if(!b)return sendAll('🆕 নতুন ম্যাচ',`${a.home} বনাম ${a.away}`);
  if(b.status!=='live'&&a.status==='live')return sendAll('🔴 ম্যাচ শুরু',sc);
  if(b.status!=='done'&&a.status==='done')return sendAll('🏁 ম্যাচ শেষ',sc);
  if((b.hs!==a.hs||b.as!==a.as)&&a.status!=='upcoming'){const ev=(a.events||[]).slice(-1)[0];return sendAll('⚽ গোল / স্কোর আপডেট',(ev&&ev.name?ev.name+' — ':'')+sc)}
});
exports.reminderPush=onSchedule('every 5 minutes',async()=>{
  const db=admin.firestore(),now=Date.now(),snap=await db.collection('reminders').get();
  for(const d of snap.docs){const r=d.data();if(r.notified||!r.when)continue;
    const t=new Date(String(r.when).replace(' ','T')+'+06:00').getTime();
    if(t>now&&t-now<=3600e3){await sendAll('🗓️ রিমাইন্ডার',`${r.title} — ${r.when}`);await d.ref.update({notified:true})}}
});
