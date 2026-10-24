import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:'AIzaSyBxtpx-CqMK4XWuRtihy0rSNe6AdAS0Gzc',
  authDomain:'organ-practice-tracker.firebaseapp.com',
  projectId:'organ-practice-tracker',
  storageBucket:'organ-practice-tracker.firebasestorage.app',
  messagingSenderId:'68830167607',
  appId:'1:68830167607:web:849cf39d0199ac317c75b2',
  measurementId:'G-XFM4VKFHWB'
};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const UID_KEY='iowaOrganStudentUid', ATTEMPT_KEY='iowaOrganImprovisationCurrentAttempt';
const APP_ID='improvisation-models', CAP=300;
const root=document.getElementById('practiceAccessRoot');
root.innerHTML=`<div class="pa-bar"><button id="pa-login">Student login</button><button id="pa-history">My practice history</button></div>
<dialog id="pa-login-dialog"><div class="pa-head"><h2>Student login</h2><button id="pa-login-close" aria-label="Close">✕</button></div><div id="pa-out"><form id="pa-form"><label>Eight-digit student UID <input id="pa-uid" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" required></label> <button type="submit">Sign in</button></form></div><div id="pa-in" hidden><p id="pa-welcome"></p><button id="pa-logout">Log out</button></div><p id="pa-message" role="status"></p></dialog>
<dialog id="pa-history-dialog"><div class="pa-head"><h2>My practice history</h2><button id="pa-history-close" aria-label="Close">✕</button></div><div id="pa-history-body" class="pa-scroll"></div></dialog>`;
const el=id=>root.querySelector('#'+id);
const loginDialog=el('pa-login-dialog'), historyDialog=el('pa-history-dialog');
el('pa-login').onclick=()=>loginDialog.showModal();
el('pa-login-close').onclick=()=>loginDialog.close();
el('pa-history').onclick=()=>{historyDialog.showModal();loadHistory();};
el('pa-history-close').onclick=()=>historyDialog.close();
let ready=false,queue=Promise.resolve();
function status(s){el('pa-message').textContent=s;}
function display(name){const logged=!!name;el('pa-out').hidden=logged;el('pa-in').hidden=!logged;el('pa-login').textContent=logged?'Student: '+name:'Student login';el('pa-welcome').textContent=logged?'Logged in as '+name:'';}
async function signInUid(uid){uid=uid.trim();if(!/^\d{8}$/.test(uid)){status('Enter an eight-digit student UID.');return;}
  status('Checking student UID...');
  try {const snap=await getDoc(doc(db,'users',uid));if(!snap.exists()){status('Student UID not found.');return;}
    localStorage.setItem(UID_KEY,uid);display(snap.data().name||uid);status('');
  }catch(e){console.error(e);status('Could not connect to Firebase.');}
}
el('pa-form').onsubmit=e=>{e.preventDefault();if(!ready){status('Connecting...');return;}signInUid(el('pa-uid').value);};
el('pa-logout').onclick=()=>{localStorage.removeItem(UID_KEY);localStorage.removeItem(ATTEMPT_KEY);display(null);status('');};
onAuthStateChanged(auth,async user=>{if(!user){try{await signInAnonymously(auth);}catch(e){console.error(e);status('Firebase authentication unavailable.');}return;}ready=true;const uid=localStorage.getItem(UID_KEY);if(uid)await signInUid(uid);else display(null);});
function elapsed(attempt){return Math.min(CAP,Math.max(0,Math.round((Date.now()-attempt.startedAt)/1000)));}
async function record(detail){
  await auth.authStateReady();
  const uid=localStorage.getItem(UID_KEY);
  if(!uid||!auth.currentUser)return;
  const prevText=localStorage.getItem(ATTEMPT_KEY);
  if(prevText){try{const prev=JSON.parse(prevText);if(prev.uid===uid&&prev.id)await updateDoc(doc(db,'users',uid,'webPractice',prev.id),{durationSeconds:elapsed(prev)});}catch(e){console.warn('Previous attempt could not be completed',e);}}
  const ref=await addDoc(collection(db,'users',uid,'webPractice'),{app:APP_ID,model:detail.model||'Unknown model',modelId:detail.modelId||'',exercise:detail.phrase||'Unknown phrase',key:detail.key||'Unknown key',venetianTone:detail.venetianTone||null,final:detail.final||null,startedAt:serverTimestamp(),durationSeconds:CAP});
  localStorage.setItem(ATTEMPT_KEY,JSON.stringify({uid,id:ref.id,startedAt:Date.now()}));
}
window.addEventListener('improv:phrase',e=>{queue=queue.then(()=>record(e.detail)).catch(err=>console.error('Practice tracking error',err));});

// Build the tabs from the site's actual landing and sublanding JSON.
const NAV_COLLECTIONS={
  'Pachelbel-Aria':'sublandings/Pachelbel-Aria/pachelbel-aria.json',
  'Boehm-Chorale-Partita':'sublandings/Boehm-Chorale-Partita/boehm-chorale-partita.json',
  'Bach-WTC':'sublandings/Bach-WTC/bach-wtc.json'
};
const KEY_ORDER=['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb',
  'a','e','b','f#','c#','g#','d#','a#','d','g','c','f','bb','eb','ab'];
const ROMAN={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10};
const MODE_MINOR=new Set([1,2,3,4,9,10]);
let navCache=null;
const niceKey=k=>k.replace(/#/g,'♯').replace(/b/g,'♭');
const keyFromTonic=(tonic,minor)=>{
  if(!tonic)return null;
  const m=String(tonic).trim().replace(/♯/g,'#').replace(/♭/g,'b').match(/^([A-Ga-g])([#b]?)$/);
  if(!m)return null;
  const k=(minor?m[1].toLowerCase():m[1].toUpperCase())+m[2];
  return KEY_ORDER.includes(k)?k:null;
};
function historyKey(item){
  const raw=String(item.key||'');
  const venetian= item.modelId==='Venetian-Toccata'||/Venetian|Merulo/i.test(item.model||'')||/^Tone\s+[IVX]+\s*\(/i.test(raw);
  if(venetian){
    const tone=item.venetianTone||raw.match(/Tone\s+([IVX]+)/i)?.[1];
    const num=ROMAN[String(tone||'').toUpperCase()];
    const final=item.final||raw.match(/\(([A-Ga-g][♯♭#b]?)\s+Final\)/i)?.[1];
    return num?keyFromTonic(final,MODE_MINOR.has(num)):null;
  }
  const cleaned=raw.replace(/^Current key:\s*/i,'').trim();
  const mode=cleaned.match(/\b(major|minor)\b/i)?.[1]?.toLowerCase();
  if(!mode)return null;
  return keyFromTonic(cleaned.replace(/\b(major|minor)\b/ig,'').trim(),mode==='minor');
}
async function getNavigation(){
  if(navCache)return navCache;
  const get=async url=>{const res=await fetch(url);if(!res.ok)throw Error('Could not load '+url);return res.json();};
  const landing=await get('landing/models.json');
  const nav=[];
  for(const entry of landing.models){
    if(entry.type==='collection'){
      const collection=await get(NAV_COLLECTIONS[entry.collection]);
      nav.push({title:entry.title,subtabs:collection.items.map(x=>({title:x.title,id:x.model}))});
    }else if(entry.type==='model')nav.push({title:entry.title,id:entry.model,subtabs:[]});
  }
  navCache=nav;
  return nav;
}
function addButton(parent,label,selected,fn){
  const btn=document.createElement('button');btn.type='button';btn.className='pa-tab'+(selected?' pa-active':'');
  btn.textContent=label;btn.setAttribute('aria-pressed',String(selected));btn.onclick=fn;parent.append(btn);
}
function drawGrid(host,attempts,models){
  const allowed=new Set(models.map(x=>x.id));
  const names=new Map(models.map(x=>[x.id,x.title]));
  const byExercise=new Map();let skipped=0;
  for(const item of attempts){
    const id=item.modelId||resolveOldModel(item.model,models);
    if(!allowed.has(id))continue;
    const key=historyKey(item);
    if(!key){skipped++;continue;}
    const name=names.get(id)||item.model||id;
    const exercise=`${name} — ${item.exercise||'Unknown phrase'}`;
    if(!byExercise.has(exercise))byExercise.set(exercise,new Map());
    const counts=byExercise.get(exercise);counts.set(key,(counts.get(key)||0)+1);
  }
  if(!byExercise.size){const msg=document.createElement('p');msg.textContent='No recorded phrases for this selection.';host.append(msg);return;}
  const wrap=document.createElement('div');wrap.className='pa-grid-scroll';
  const table=document.createElement('table');table.className='pa-grid';
  const header=document.createElement('thead'),hr=document.createElement('tr');
  for(const label of ['Exercise','Totals',...KEY_ORDER.map(niceKey)]){
    const th=document.createElement('th');th.textContent=label;hr.append(th);
  }header.append(hr);table.append(header);
  const body=document.createElement('tbody'),totals=Object.fromEntries(KEY_ORDER.map(k=>[k,0]));let grand=0;
  const rows=[...byExercise.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
  for(const [name,counts] of rows){
    const tr=document.createElement('tr'),sum=[...counts.values()].reduce((a,b)=>a+b,0);grand+=sum;
    for(const value of [name,sum,...KEY_ORDER.map(k=>{const v=counts.get(k)||0;totals[k]+=v;return v||'';})]){
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }body.append(tr);
  }
  const totalRow=document.createElement('tr');totalRow.className='pa-total-row';
  for(const value of ['Totals',grand,...KEY_ORDER.map(k=>totals[k]||'')]){
    const td=document.createElement('td');td.textContent=value;totalRow.append(td);
  }body.prepend(totalRow);table.append(body);wrap.append(table);host.append(wrap);
  if(skipped){const note=document.createElement('p');note.className='pa-note';note.textContent=`${skipped} attempt(s) had an unrecognized key and are not included.`;host.append(note);}
}
function resolveOldModel(value,models){
  const text=String(value||'').toLowerCase();
  return models.find(m=>m.title.toLowerCase()===text||m.id.toLowerCase()===text)?.id||null;
}
async function loadHistory(){
  const area=el('pa-history-body'),uid=localStorage.getItem(UID_KEY);
  if(!uid){area.textContent='Please log in first.';return;}
  area.textContent='Loading practice history...';
  try{
    await auth.authStateReady();if(!auth.currentUser)throw Error('Not authenticated');
    const [nav,snapshot]=await Promise.all([getNavigation(),getDocs(collection(db,'users',uid,'webPractice'))]);
    if(localStorage.getItem(UID_KEY)!==uid){area.textContent='Student changed; reopen history.';return;}
    const attempts=snapshot.docs.map(d=>d.data()).filter(x=>x.app===APP_ID);
    // Open the history on the model or collection corresponding to this page.
    const params = new URLSearchParams(window.location.search);
    const pageModel = params.get('model');
    const pageCollection = params.get('collection');
    let activeLanding = 0, activeSub = null;
    if (pageModel) {
      const match = nav.findIndex(n => n.id === pageModel || n.subtabs.some(s => s.id === pageModel));
      if (match !== -1) {
        activeLanding = match;
        const subIndex = nav[match].subtabs.findIndex(s => s.id === pageModel);
        if (subIndex !== -1) activeSub = subIndex;
      }
    } else if (pageCollection) {
      const collections = {
        'Pachelbel-Aria': 'Pachelbel Aria Variations',
        'Boehm-Chorale-Partita': 'Böhm Chorale Partita',
        'Bach-WTC': 'JS Bach Well-Tempered Clavier Preludes'
      };
      const match = nav.findIndex(n => n.title === collections[pageCollection]);
      if (match !== -1) activeLanding = match;
    }
    const render=()=>{
      area.replaceChildren();
      const tabs=document.createElement('div');tabs.className='pa-tabs';
      nav.forEach((n,i)=>addButton(tabs,n.title,i===activeLanding,()=>{activeLanding=i;activeSub=null;render();}));
      area.append(tabs);
      const landing=nav[activeLanding];let models;
      if(landing.subtabs.length){
        const sub=document.createElement('div');sub.className='pa-subtabs';
        addButton(sub,'All models',activeSub===null,()=>{activeSub=null;render();});
        landing.subtabs.forEach((s,i)=>addButton(sub,s.title,activeSub===i,()=>{activeSub=i;render();}));
        area.append(sub);
        models=activeSub===null?landing.subtabs:[landing.subtabs[activeSub]];
      }else models=[landing];
      drawGrid(area,attempts,models);
    };
    render();
  }catch(e){console.error(e);area.textContent='Could not load practice history.';}
}
