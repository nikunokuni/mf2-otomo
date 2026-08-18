import * as N from '../js/simulator/growth-calc.js';
import {SK,SKEYS,HEAVY4,LIGHT6,HM,HS,LG,GTH,EV_COST} from '../js/data/growth.js';
import {calcIdeal as newIdeal} from '../js/tracker/ideal.js';

/* ---- 旧実装をそのまま写したもの ---- */
const O={};
O.getPct=(total,e)=>Math.floor(Math.floor((e/total)*1000)/10);
O.getStageIdx=(pct,gtype)=>{const th=GTH[gtype];for(let i=0;i<th.length;i++)if(pct>=th[i][0]&&pct<=th[i][1])return i;return 9;};
O.calcStageWeeks=(total,gtype)=>{const w=new Array(10).fill(0);for(let i=0;i<total;i++)w[O.getStageIdx(O.getPct(total,i),gtype)]++;return w;};
// 桃は「選んだ段階の開始まで若返り、そこから extra 週ぶん進む」区間
O.calcPeachWeeks=(totalLife,gtype,useSi,extra)=>{
  const baseW=O.calcStageWeeks(totalLife,gtype);let s=0;for(let i=0;i<useSi;i++)s+=baseW[i];
  const ps=s,pe=Math.min(totalLife,s+extra),r=new Array(10).fill(0);let c=0;
  for(let si=0;si<10;si++){const sE=c+baseW[si];r[si]=Math.max(0,Math.min(sE,pe)-Math.max(c,ps));c=sE;}return r;};
O.peachTiming=(totalLife,gtype,useSi,extra)=>{
  const baseW=O.calcStageWeeks(totalLife,gtype);let s=0;for(let i=0;i<useSi;i++)s+=baseW[i];
  const w=s+extra;if(w>=totalLife)return{week:w,si:null,weekInStage:null,over:true};
  let c=0;for(let si=0;si<10;si++){const sE=c+baseW[si];if(w<sE)return{week:w,si,weekInStage:w-c+1,over:false};c=sE;}
  return{week:w,si:null,weekInStage:null,over:true};};
O.calcSetGain=(set,sk,apts)=>{
  const G={};SK.forEach(k=>G[k]=0);
  const evW=(set.tc||0)*EV_COST.tc+(set.mc||0)*EV_COST.mc+(set.ac||0)*EV_COST.ac;
  const trainW=Math.max(0,(set.weeks||0)-evW);
  const fullM=Math.floor(trainW/4),remW=trainW%4;
  const hc=Math.max(0,Math.min(4,parseInt(set.hc)||0)),lc=Math.max(0,4-hc);
  const hi=parseInt(set.ht);
  if(hi>=0&&hi<HEAVY4.length&&hc>0){const t=HEAVY4[hi];
    const mg=HM[sk][apts[t.main]][2],sg=HS[sk][apts[t.sub]];
    G[t.main]+=mg*hc*fullM;G[t.sub]+=sg*hc*fullM;G[t.pen]-=2*hc*fullM;
    if(remW>0){G[t.main]+=mg;G[t.sub]+=sg;G[t.pen]-=2;}}
  const li=parseInt(set.lt);
  if(li>=0&&li<LIGHT6.length&&lc>0){const t=LIGHT6[li];G[t.stat]+=LG[sk][apts[t.stat]]*lc*fullM;}
  return G;};
const oldIdeal=(gutsCost,motionTime,gr)=>{const rps=30/gr;let g=50,t=0,n=0;
  while(t<60){if(g<gutsCost){t+=(gutsCost-g)/rps;g=gutsCost;if(t>=60)break;}
  if(t+motionTime>60)break;g-=gutsCost;t+=motionTime;n++;}return n;};

/* ---- 突き合わせ ---- */
let checks=0,fail=0;
const eq=(a,b,label)=>{checks++;if(JSON.stringify(a)!==JSON.stringify(b)){fail++;console.log('NG',label,JSON.stringify(a),JSON.stringify(b));}};

const GT=Object.keys(GTH), APTS=['E','D','C','B','A'];
for(const g of GT) for(let life=100;life<=600;life+=7){
  eq(N.calcStageWeeks(life,g),O.calcStageWeeks(life,g),`stageWeeks ${g} ${life}`);
  for(const si of [0,3,4,6,9]) for(const ex of [50,25]){
    eq(N.calcPeachWeeks(life,g,si,ex),O.calcPeachWeeks(life,g,si,ex),`peach ${g} ${life} ${si} ${ex}`);
    eq(N.peachTiming(life,g,si,ex),O.peachTiming(life,g,si,ex),`peachTiming ${g} ${life} ${si} ${ex}`);
  }
}

// 桃の区間は「選んだ段階の開始から前へ」ではなく「開始からうしろへ extra 週」
for(const g of GT) for(let life=100;life<=600;life+=17) for(const si of [0,2,4,5,9]) for(const ex of [50,25]){
  const base=N.calcStageWeeks(life,g);
  const start=N.stageStartWeek(base,si);
  const w=N.calcPeachWeeks(life,g,si,ex);
  // 選んだ段階より前の段階には1週も割り当てられない
  eq(w.slice(0,si).reduce((a,b)=>a+b,0),0,`peach forward-only ${g} ${life} ${si} ${ex}`);
  // 合計は extra 週（寿命を超える分は切り捨て）
  eq(w.reduce((a,b)=>a+b,0),Math.min(life,start+ex)-start,`peach total ${g} ${life} ${si} ${ex}`);
  // 選んだ段階に週数があれば、その先頭から始まっている
  if(base[si]>0) eq(w[si]>0,true,`peach starts at stage ${g} ${life} ${si} ${ex}`);
  // タイミングは「開始から extra 週後」
  const t=N.peachTiming(life,g,si,ex);
  eq(t.week,start+ex,`timing week ${g} ${life} ${si} ${ex}`);
  if(!t.over) eq(N.stageStartWeek(base,t.si)+t.weekInStage-1,t.week,`timing stage/week ${g} ${life} ${si} ${ex}`);
  else eq(t.week>=life,true,`timing over ${g} ${life} ${si} ${ex}`);
}
// 段階週数の合計 = 寿命 であること
for(const g of GT) for(let life=100;life<=600;life+=13)
  eq(N.calcStageWeeks(life,g).reduce((a,b)=>a+b,0),life,`sum ${g} ${life}`);

// 上昇値: イベント0のときは旧実装と完全一致するはず
let rnd=1;const rand=n=>{rnd=(rnd*1103515245+12345)%2147483648;return rnd%n;};
for(let i=0;i<4000;i++){
  const apt={};SK.forEach(k=>apt[k]=APTS[rand(5)]);
  const set={ht:rand(5)-1,hc:rand(5),lt:rand(7)-1,tc:0,mc:0,ac:0,weeks:rand(90)};
  const sk=SKEYS[rand(10)];
  eq(N.calcSetGain(set,sk,apt),O.calcSetGain(set,sk,apt),`gain ${i}`);
}
// 理想回数
for(let gr=6;gr<=19;gr++) for(const gc of [10,12,17,19,24,29,35,42,50])
  for(const mt of [1.1,2.0,2.8,3.8,4.5,5.5,6.5,8.3])
    eq(newIdeal(gc,mt,gr),oldIdeal(gc,mt,gr),`ideal ${gr} ${gc} ${mt}`);

console.log(`\n照合 ${checks}件 / 不一致 ${fail}件`);

/* ---- イベント週の二重計上を確認 ---- */
const apt={};SK.forEach(k=>apt[k]='C');
const set={ht:0,hc:4,lt:-1,tc:2,mc:0,ac:0,weeks:40};
console.log('\n[旧] weeks=40, 大会2回(8週) の上昇値:', JSON.stringify(O.calcSetGain({...set,weeks:40-8},'peak',apt)));
console.log('[新] 同条件                      :', JSON.stringify(N.calcSetGain(set,'peak',apt)));
console.log('※旧は weeks 自体を 40→32 に減らしたうえで、計算内でさらに8週を引いていた（24週ぶんしか育たない）');
