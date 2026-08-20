import * as N from '../js/simulator/growth-calc.js';
import {SK,SKEYS,HEAVY4,LIGHT6,HM,HS,LG,GTH,EV_COST} from '../js/data/growth.js';
import {calcIdeal as newIdeal} from '../js/tracker/ideal.js';
import {ITEMS,INNER} from '../js/data/items.js';
import {normalizeMoral} from '../js/store.js';
import {moralRange,clampInner,pctDelta,applyPct,applyDelta} from '../js/simulator/inner-calc.js';
import * as R from '../js/simulator/rota-calc.js';
import {FEEDS,feedEffect} from '../js/data/feeds.js';
import * as A from '../js/data/acts.js';

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

/* ---- 割当週のはみ出しが次の段階を削る ---- */
{
  // 1段階10週 / 2段階20週 の作り物
  const mk=(w,items={})=>({ht:-1,hc:2,lt:-1,tc:0,mc:0,ac:0,weeks:w,items});
  const sim={life:100,gtype:'futsuu',month:1,week:1,
    peach:[{use:false,si:4},{use:false,si:4}],
    plan:{0:{0:[mk(10,{'パラドクシン':1})],1:[mk(20)]},1:{},2:{}}};
  // 素の段階週数を 10/20 に見立てるため、cascade だけを直接みる
  const base=N.calcStageWeeks(100,'futsuu');
  eq(base[0],10,'1段階は10週');
  // パラドクシン(-18) は 10週の割当を8週こえる
  eq(N.lifeCost(sim.plan[0][0][0]),18,'パラドクシン1個で寿命-18');
  eq(N.trainWeeks(sim.plan[0][0][0]),-8,'1段階は8週たりない');
  const weeks=N.stageWeeksByGroup(sim);
  eq(weeks[0][0],10,'1段階の週数はそのまま（トレーニングが0になる）');
  eq(weeks[0][1],base[1]-8,'次の段階から8週引かれる');
  // 割当を割り当て直しても同じ結果になる
  N.normalizePlan(sim);
  eq(N.stageWeeksByGroup(sim)[0][1],base[1]-8,'割り当て直しても変わらない');
  eq(sim.plan[0][1][0].weeks,base[1]-8,'2段階の割当週も減る');
  eq(N.planOverflow(sim)[0],0,'最後まではみ出さなければ0');
  // 寿命が足りないほど使うと、最後まではみ出す
  const heavy={...sim,plan:{0:{0:[mk(10,{'パラドクシン':20})]},1:{},2:{}}};
  eq(N.planOverflow(heavy)[0]>0,true,'使いすぎたぶんは最後まで残る');
}

// 育成計画のアイテム列は寿命の減りが大きい順（パラドクシンが先頭）
eq(N.AGE_ITEMS[0].name,'パラドクシン','アイテム列の先頭はパラドクシン');
eq(N.AGE_ITEMS.map(i=>i.agePlus).every((v,i,a)=>i===0||a[i-1]>=v),true,'寿命の減りが大きい順');

/* ---- 内部数値 ---- */
// ヨイワルは初期値から±100、かつ全体の-100〜100に収まる
eq(moralRange(0),[-100,100],'moralRange 0');
eq(moralRange(-90),[-100,10],'moralRange -90');
eq(moralRange(50),[-50,100],'moralRange 50');
eq(clampInner('moral',20,-90),10,'ヨイワルは初期値-90なら+10まで');
eq(clampInner('moral',-200,-90),-100,'ヨイワルの下限');
eq(clampInner('stress',120),100,'ストレスの上限');
eq(clampInner('stress',-5),0,'ストレスの下限');
eq(clampInner('form',-150),-100,'体型の下限');
// 割合は小数点以下切り捨て
eq(pctDelta(75,-50),-37,'75の-50%は-37（-37.5を切り捨て）');
eq(pctDelta(100,-50),-50,'100の-50%は-50');
eq(pctDelta(9,-20),-1,'9の-20%は-1（-1.8を切り捨て）');
eq(pctDelta(0,-50),0,'0なら動かない');
eq(applyPct('stress',75,-50),38,'ストレス75に-50%で38');
eq(applyDelta('fatigue',5,-28),0,'疲労は0より下がらない');

// ヨイワルの入力値の丸め（5きざみ・-100〜100・古い3択からの読み替え）
eq(normalizeMoral('good'),50,'good は +50');
eq(normalizeMoral('neutral'),0,'neutral は 0');
eq(normalizeMoral('bad'),-50,'bad は -50');
eq(normalizeMoral(0),0,'0 はそのまま');
eq(normalizeMoral(37),35,'5きざみに丸める');
eq(normalizeMoral(-98),-100,'下限に収める');
eq(normalizeMoral(999),100,'上限に収める');
eq(normalizeMoral('でたらめ'),0,'読めない値は 0');
eq(normalizeMoral(undefined),0,'未設定は 0');

/* ---- アイテムデータの形 ---- */
const STAT_KEYS=['life','pow','int','hit','avo','tou'];
const INNER_KEYS=Object.keys(INNER);
eq(ITEMS.length>0,true,'アイテムが入っている');
eq(new Set(ITEMS.map(i=>i.name)).size,ITEMS.length,'アイテム名が重複していない');
ITEMS.forEach(it=>{
  eq(!!it.name&&!!it.effect,true,`${it.name}: 名前と説明がある`);
  eq(['use','hold'].includes(it.kind),true,`${it.name}: kind が use か hold`);
  const inners=[it.inner,it.innerPct,it.monthly&&it.monthly.inner]
    .concat((it.conditional||[]).flatMap(c=>[c.inner,c.innerPct]));
  inners.filter(Boolean).forEach(o=>
    eq(Object.keys(o).every(k=>INNER_KEYS.includes(k)),true,`${it.name}: 内部数値のキー ${Object.keys(o)}`));
  [it.stat,it.statPctWeekly].filter(Boolean).forEach(o=>
    eq(Object.keys(o).every(k=>STAT_KEYS.includes(k)),true,`${it.name}: パラメーターのキー ${Object.keys(o)}`));
  // 持ち物は月ごとの効果を持ち、使うアイテムは持たない
  eq(it.kind==='hold',!!it.monthly,`${it.name}: hold と monthly の対応`);
  if(it.statPctWeekly) eq(it.weeks>0,true,`${it.name}: 毎週の効果には weeks が要る`);
});

/* ---- 調整ローテ ---- */
// 週番号と月の区切り（1か月は4週。第1週が月初め）
eq([0,1,3,4,7,8].map(R.isMonthStart).join(','),'true,false,false,true,false,true','月初めは4週ごと');
eq([0,3,4,11].map(R.monthOf).join(','),'0,0,1,2','何か月目か');
eq(R.weekLabel(0),'1か月目 第1週','週の見出し');
eq(R.weekLabel(6),'2か月目 第3週','週の見出し（2か月目）');
eq([0,1,4,5].map(R.monthCount).join(','),'1,1,1,2','週数から月の数');

// エサの好き嫌い
eq(JSON.stringify(feedEffect(FEEDS[4],'like')),'{"stress":-8,"fear":0,"spoil":6,"form":6}','ニクもどき（好き）');
eq(JSON.stringify(feedEffect(FEEDS[4],'normal')),'{"stress":-6,"fear":0,"spoil":4,"form":6}','ニクもどき（普通）');
eq(FEEDS.every(f=>f.like.form===undefined),true,'体型は好き嫌いの中に持たない');

// 1週ずつの流れ。月初めは エサ → 双子の水差し、そのあと アイテム
const rotaStart={form:0,moral:0,stress:50,fatigue:50,fear:50,spoil:50};
const rotaRows=R.simulate({
  start:rotaStart,
  weeks:[{item:'カララギマンゴー',act:''},{item:'ないちゃい草',act:''}],
  feeds:['ニクもどき'],
  jugs:2,
  feedLike:{},              // 空なら「普通」として扱う
  initMoral:0,
  species:'ピクシー',
});
// 1週目: エサ(ス-6 甘+4 体+6) → 水差し×2(ス-2 恐+2) → マンゴー(疲-10 恐+1 甘+1 体+1)
eq(JSON.stringify(rotaRows[0].values),
   JSON.stringify({form:7,moral:0,stress:42,fatigue:40,fear:53,spoil:55}),
   '1週目（エサ→水差し→アイテム）');
// 2週目: 月初めではないのでエサも水差しも効かない。
//        ないちゃい草 ストレス-40% は 42→42+trunc(-16.8)=42-16=26（切り捨て）
eq(rotaRows[1].values.stress,26,'割合は切り捨ててから引く');
eq(rotaRows[1].values.fatigue,50,'2週目の疲労（40+10）');
eq(rotaRows[1].values.fear,53,'月初めでなければ水差しは効かない');
eq(rotaRows[1].values.form,6,'月初めでなければエサも効かない');

// 種族条件つきの効果（オイリーオイルのストレス-20%）
const oily=(species)=>R.simulate({
  start:{...rotaStart},weeks:[{item:'オイリーオイル',act:''}],feeds:[''],jugs:0,
  feedLike:{},initMoral:0,species,
})[0].values.stress;
eq(oily('ヘンガー'),40,'ヘンガーならストレス-20%が乗る（50→40）');
eq(oily('ピクシー'),50,'種族が合わなければ乗らない');

// ヨイワルは初期ヨイワルから±100までしか動かない
const moralRows=R.simulate({
  start:{...rotaStart,moral:5},
  weeks:[{item:'フルーツグミ'},{item:'フルーツグミ'},{item:'フルーツグミ'}],
  feeds:[''],jugs:0,feedLike:{},initMoral:-90,species:'ピクシー',
});
eq(moralRows.map(r=>r.values.moral).join(','),'10,10,10','初期ヨイワル-90なら+10で頭打ち');

// 0〜100 の下限でも止まる
eq(R.simulate({start:{...rotaStart,stress:3},weeks:[{item:'ソンナバナナ'}],feeds:[''],jugs:0,
   feedLike:{},initMoral:0,species:'ピクシー'})[0].values.stress,0,'ストレスは0より下がらない');

// 合計
eq(R.totalAgePlus([{item:'パラドクシン'},{item:'トロロン'},{item:'カララギマンゴー'}]),24,'寿命が進む合計(18+6)');
eq(R.totalFeedPrice(['ニクもどき','ゼリーもどき'],5),450,'エサ代は月ごとに1回ぶん(300+150)');
eq(R.totalFeedPrice(['ニクもどき','ゼリーもどき'],4),300,'4週なら1か月ぶんだけ');

/* ---- 行動 ---- */
const base={form:0,moral:0,stress:20,fatigue:20,fear:50,spoil:50};
const act=(a,over={},stage='s1')=>R.applyAct({...base,...over},a,0,stage);

// トレーニング
eq([act('light:0').fatigue,act('light:0').stress],[30,25],'軽トレ 疲労+10 ストレス+5');
eq([act('heavy:0').fatigue,act('heavy:0').stress],[35,32],'重トレ 疲労+15 ストレス+12');
// 軽トレ6種・重トレ4種はどれも同じ内部数値
eq([0,1,2,3,4,5].every(i=>act(`light:${i}`).fatigue===30),true,'軽トレはどれも同じ');
eq([0,1,2,3].every(i=>act(`heavy:${i}`).stress===32),true,'重トレはどれも同じ');

// 修行は4週まとめて。疲労とストレスは毎週たまる
eq([act('mc').fatigue,act('mc').stress],[38,27],'修行1週 疲労+18 ストレス+7');
eq(A.TRAINING_CAMP_WEEKS,4,'修行は4週');
eq([R.isBlockAct('mc'),R.isBlockAct('ac'),R.isBlockAct('rest')].join(','),'true,true,false',
   '4週まとめてなのは修行と冒険');
const mcRows=R.simulate({start:{...base,fatigue:0,stress:0},
  weeks:[{act:'mc'},{act:'mc'},{act:'mc'},{act:'mc'}],
  feeds:['ニクもどき','ニクもどき'],jugs:3,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1'});
eq([mcRows[3].values.fatigue,mcRows[3].values.stress],[72,28],
   '修行4週で 疲労+72 ストレス+28（修行合計と一致）');
eq(mcRows.map(r=>r.canFeed).join(','),'true,false,false,false','エサは出かける週だけ間に合う');
eq(mcRows.map(r=>r.canItem).join(','),'true,false,false,false','アイテムも出かける週だけ');

// 冒険は4週まとめて。出ているあいだは何も起きず、疲労は帰ってきた週にまとめて乗る
eq([act('ac',{fatigue:0}).fatigue,act('ac',{fatigue:0}).stress],[0,20],'冒険の週そのものでは何も起きない');
eq(A.ADVENTURE_WEEKS,4,'冒険は4週');
const advRows=R.simulate({
  start:{...base,fatigue:10,stress:10},
  weeks:[{act:'heavy:0'},{act:'ac'},{act:'ac'},{act:'ac'},{act:'ac'},{act:''},{act:''}],
  feeds:['',''],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1',
});
eq(advRows.map(r=>r.adventuring).join(','),'false,true,true,true,true,false,false','2〜5週目が冒険中');
eq(advRows[1].blockStart,true,'冒険の最初の週');
eq(advRows[2].blockStart,false,'2週目以降は最初の週ではない');
eq(advRows.slice(1,5).map(r=>r.values.fatigue).join(','),'25,25,25,25','出ているあいだは疲労が動かない');
eq(advRows.slice(1,5).map(r=>r.condition).join(','),',,,','出ているあいだは体調値なし');
eq(advRows.slice(1,5).map(r=>r.ageWeeks).join(','),'0,0,0,0','出ているあいだは週経過を寿命に数えない');
eq(advRows[5].returned,true,'6週目に帰ってくる');
eq(advRows[5].values.fatigue,95,'帰ってきた週に疲労+70（25→95）');
eq(advRows[5].condition,95+22*2,'帰ってきた週から体調値が戻る');
eq(R.adventureWeeks(advRows),4,'冒険で出かけた週数');

/* ---- 寿命の減り方（週経過ぶん + 追加ぶん） ---- */
eq(A.WEEK_AGE,1,'1週たてば寿命が1週減る');
const life=(weeks)=>R.lifeTotals(R.simulate({
  start:{...base,fatigue:0,stress:0},weeks,
  feeds:['','',''],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1',
}));
// 育成計画の EV_COST と一致する（大会-4 / 修行-7 / 冒険-2）
// 疲労0ストレス0から出れば、育成計画の EV_COST とぴったり合う
eq(life([{act:'tc:win'}]),{age:1,extra:3,total:4},'大会 -4（EV_COST.tc と一致）');
eq(life([{act:'mc'},{act:'mc'},{act:'mc'},{act:'mc'}]),{age:4,extra:3,total:7},
   '修行 -7（EV_COST.mc と一致）');
// 冒険は週経過を数えず、冒険ぶんの追加だけ
eq(life([{act:'ac'},{act:'ac'},{act:'ac'},{act:'ac'}]),{age:0,extra:2,total:2},
   '冒険 週経過0+冒険2=2（EV_COST.ac と一致）');
eq([EV_COST.tc,EV_COST.mc,EV_COST.ac].join(','),'4,7,2','育成計画側の EV_COST');
// 大会は 体調値ぶん と 大会ぶん の両方がかかる
const tc=(fatigue)=>R.simulate({start:{...base,fatigue,stress:0},weeks:[{act:'tc:win'}],
  feeds:[''],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1'})[0];
eq([tc(0).fromCondition,tc(0).fromEvent,tc(0).lifeCost],[0,3,4],
   '疲労0から出れば 週経過1+体調値0+ベース3 = -4');
eq(A.TOURNAMENT_HEAVY_FATIGUE,70,'疲労70を越えるとベースが倍');
eq([A.tournamentBase(70),A.tournamentBase(71)].join(','),'3,6','70ちょうどはまだ倍にならない');
// 疲労60から優勝 → 大会で+30して90。ベースは倍の6、体調値90ぶんの追加1
eq([tc(60).values.fatigue,tc(60).condition,tc(60).fromCondition,tc(60).fromEvent,tc(60).lifeCost],
   [90,90,1,6,8],'疲労がたまっていると -8（Wiki の「-8週以上」と合う）');
// 修行は毎週ぶん体調値で減る。修行そのものの追加は無い
const mcLife=R.simulate({start:{...base,fatigue:0,stress:0},
  weeks:[{act:'mc'},{act:'mc'},{act:'mc'},{act:'mc'}],
  feeds:[''],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1'});
eq(mcLife.map(r=>r.condition).join(','),'32,64,96,128','修行中の体調値');
eq(mcLife.map(r=>r.fromCondition).join(','),'0,0,1,2','体調値ぶんは毎週');
eq(mcLife.map(r=>r.fromEvent).join(','),'0,0,0,0','修行そのものの追加は無い');
eq(mcLife.map(r=>r.lifeCost).join(','),'1,1,2,3','週ごとの寿命（合わせて-7）');
// ふだんの週は 週経過1 + 体調値ぶん。体調値が低ければ追加は無い
eq(life([{act:'light:0'}]),{age:1,extra:0,total:1},'体調値が低い週は週経過ぶんだけ');
const heavyRows=R.simulate({start:{...base,fatigue:0,stress:0},
  weeks:[{act:'heavy:0'},{act:'heavy:0'},{act:'heavy:0'}],
  feeds:[''],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1'});
eq(heavyRows.map(r=>r.condition).join(','),'39,78,117','各週の体調値');
eq(heavyRows.map(r=>r.fromCondition).join(','),'0,1,2','ふだんの週の追加ぶんは体調値から（表の値−1）');
eq(heavyRows.map(r=>r.fromEvent).join(','),'0,0,0','ふだんの週にイベントぶんは無い');
eq(heavyRows.map(r=>r.lifeCost).join(','),'1,2,3','週ごとの合計（週経過1+追加）');
eq(R.lifeTotals(heavyRows).total,6,'合計');
// 出かける週にはエサが間に合う（冒険はアイテムだけ使えない）
const acFeed=R.simulate({start:{...base,fatigue:0,stress:50},
  weeks:[{item:'カララギマンゴー',act:'ac'},{act:'ac'},{act:'ac'},{act:'ac'},{act:''}],
  feeds:['ニクもどき','ニクもどき'],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1'});
eq(acFeed[0].canFeed,true,'冒険に出かける週もエサは間に合う');
eq(acFeed[0].canItem,false,'冒険はアイテムだけ使えない');
eq(acFeed[0].values.stress,44,'出発の週のエサは効く（50-6）');
eq(acFeed[0].values.fatigue,0,'アイテムは効かない');
// 帰ってきた週はふつうに戻る
eq([acFeed[4].canFeed,acFeed[4].canItem].join(','),'true,true','帰ってきた週はエサもアイテムも戻る');
// 冒険中はエサも水差しもアイテムも効かない
const advFeed=R.simulate({
  start:{...base,fatigue:0,stress:50},
  weeks:[{act:'ac'},{act:'ac'},{act:'ac'},{act:'ac'},{act:''}],
  feeds:['ニクもどき','ニクもどき'],jugs:3,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1',
});
// 出発の週にはエサが間に合う（ニクもどき普通-6、水差し3個-3）
eq(advFeed[0].values.stress,50-6-3,'冒険に出かける週もエサと水差しは効く');
eq(advFeed[1].values.stress,41,'出かけている途中は何も効かない');
eq(advFeed[4].values.stress,41-6-3,'帰ってきた月（2か月目第1週）もエサと水差しが効く');
eq(advFeed[4].values.fatigue,70,'帰ってきた週の疲労は+70');

// 休養は成長段階で変わる。値は最低値
eq([act('rest',{fatigue:90,stress:60},'s1').fatigue,act('rest',{fatigue:90,stress:60},'s1').stress],
   [54,55],'第1段階の休養 疲労-36 ストレス-5');
eq([act('rest',{fatigue:90,stress:60},'peak').fatigue,act('rest',{fatigue:90,stress:60},'peak').stress],
   [46,51],'ピークの休養 疲労-44 ストレス-9');
eq(act('rest',{fatigue:90,stress:60}).form,5,'休養で体型+5（段階に関係なく）');
eq(A.REST_SPOIL,0,'甘え度は最低値（0）をとる');
eq(Object.keys(A.REST).length,10,'休養は10段階ぶん');

// 大会。疲労は体型で変わり、そのあとストレスは0
eq(A.tournamentFatigue('win',-100),23,'優勝・超激ガリ +23（目安表と一致）');
eq(A.tournamentFatigue('win',0),30,'優勝・体型中間 +30');
eq(A.tournamentFatigue('win',100),37,'優勝・超激デブ +37');
eq(A.tournamentFatigue('mid',0),40,'大会(他) +40');
eq(A.tournamentFatigue('last',0),50,'大会(ビリ) +50');
eq(act('tc:win',{fatigue:0,form:-100}).fatigue,23,'大会の疲労はそのときの体型で決まる');
eq(act('tc:win',{stress:100}).stress,0,'大会のあとはストレス0');
eq(act('tc:last',{stress:3}).stress,0,'順位に関係なくストレス0');

/* ---- 体調値と減る寿命 ---- */
eq(A.conditionValue(40,30),100,'体調値 = 疲労 + ストレス×2');
// 表の値は週経過ぶんを含んだ合計。追加ぶんは「表の値 − 1」
eq([0,69,70,104,105,139,140,174,175,209,210,244,245,269,270,300].map(A.lifeLoss).join(','),
   '1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8','体調値ごとの寿命（週経過ぶんを含む合計）');
eq([0,69,70,104,105,139,270].map(A.conditionExtra).join(','),'0,0,1,1,2,2,7','追加ぶんは表の値−1');
eq(A.conditionExtra(30),0,'体調値30なら追加ぶんは無い');
const lifeRows=R.simulate({
  start:{...base,fatigue:0,stress:0},
  weeks:[{act:'heavy:0'},{act:'heavy:0'},{act:'heavy:0'}],
  feeds:[''],jugs:0,feedLike:{},initMoral:0,species:'ピクシー',stage:'s1',
});
// 1週目 疲15 ス12 → 体調39 → -1 ／ 2週目 疲30 ス24 → 78 → -2 ／ 3週目 疲45 ス36 → 117 → -3
eq(lifeRows.map(r=>r.condition).join(','),'39,78,117','各週の体調値');
eq(lifeRows.map(r=>r.extraLife).join(','),'0,1,2','各週の追加ぶん（体調値から）');
eq(lifeRows.map(r=>r.lifeCost).join(','),'1,2,3','各週の合計（週経過1を足す）');
eq(R.lifeTotals(lifeRows),{age:3,extra:3,total:6},'合計の内訳');

console.log(`\n照合 ${checks}件 / 不一致 ${fail}件`);

/* ---- イベント週の二重計上を確認 ---- */
const apt={};SK.forEach(k=>apt[k]='C');
const set={ht:0,hc:4,lt:-1,tc:2,mc:0,ac:0,weeks:40};
console.log('\n[旧] weeks=40, 大会2回(8週) の上昇値:', JSON.stringify(O.calcSetGain({...set,weeks:40-8},'peak',apt)));
console.log('[新] 同条件                      :', JSON.stringify(N.calcSetGain(set,'peak',apt)));
console.log('※旧は weeks 自体を 40→32 に減らしたうえで、計算内でさらに8週を引いていた（24週ぶんしか育たない）');
