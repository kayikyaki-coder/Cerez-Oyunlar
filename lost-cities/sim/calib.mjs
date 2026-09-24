/* Projeksiyon kalibrasyonu: bot bir sefer açarken ne tahmin ediyor,
   el sonunda o renk gerçekte kaç puan getiriyor? */
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../lost-cities.html', import.meta.url), 'utf8');
const m = html.match(/\/\* ==== CORE START ==== \*\/([\s\S]*?)\/\* ==== CORE END ==== \*\//);
const c = new Function(m[1] + `return {mulberry32,newState,NC,BOT,scoreCol,canPlay,
  botPlayDecision,botDrawDecision,doPlay,doDiscard,doDrawDeck,doTakeDiscard,
  projectCol,drawBudget,unseenFor};`)();
const {mulberry32,newState,NC,BOT,scoreCol,botPlayDecision,botDrawDecision,
  doPlay,doDiscard,doDrawDeck,doTakeDiscard,projectCol,drawBudget,unseenFor}=c;

const cfg = {...BOT, acNum: Number(process.argv[2]??6), acInv: Number(process.argv[3]??10)};
const rnd = mulberry32(4242);
const buckets = new Map();   // tahmin kovası -> gerçek puanlar
let acilis=0;
for (let h=0;h<300;h++){
  const s = newState(rnd, h%2);
  const pend = [];           // {p,ci,tahmin}
  let g=0;
  while(!s.over && g++<400){
    const p=s.turn;
    const a=botPlayDecision(s,p,cfg);
    if(a.type==='play'){
      const col=s.cols[p][a.card.ci];
      if(col.length===0){                    // yeni sefer açılıyor
        const un=unseenFor(s,p), od=Math.ceil(s.deck.length/2);
        const bd=drawBudget(s,p,a.card.ci,od,cfg);
        const same=s.hands[p].filter(x=>x.ci===a.card.ci&&x!==a.card);
        pend.push({p,ci:a.card.ci,tahmin:projectCol([a.card],a.card.ci,same,od-1,un,cfg,bd)});
        acilis++;
      }
      doPlay(s,p,a.idx);
    } else doDiscard(s,p,a.idx);
    const d=botDrawDecision(s,p,cfg);
    if(d.type==='take') doTakeDiscard(s,p,d.ci); else doDrawDeck(s,p);
  }
  for(const e of pend){
    const k=Math.round(e.tahmin/10)*10;
    if(!buckets.has(k)) buckets.set(k,[]);
    buckets.get(k).push(scoreCol(s.cols[e.p][e.ci]));
  }
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log(`acNum=${cfg.acNum} acInv=${cfg.acInv} — ${acilis} sefer açılışı`);
console.log('tahmin ~   n     gerçek ort.   sapma');
for(const k of [...buckets.keys()].sort((a,b)=>a-b)){
  const v=buckets.get(k);
  if(v.length<8) continue;
  console.log(`  ${String(k).padStart(5)}  ${String(v.length).padStart(5)}   ${avg(v).toFixed(1).padStart(9)}   ${(avg(v)-k).toFixed(1).padStart(7)}`);
}
