import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:8811/';
// 実行時の一時ファイル（スクリーンショット等）の置き場
const OUT = new URL('./.tmp/', import.meta.url).pathname;
(await import('fs')).mkdirSync(OUT, {recursive:true});
const errors=[];
let pass=0, fail=0;
const ok=(cond,label)=>{ if(cond){pass++;} else {fail++;console.log('  ✗ '+label);} };

const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
const ctx = await browser.newContext({ viewport:{width:390,height:844} });
const page = await ctx.newPage();
page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: '+e.message));

await page.goto(BASE, {waitUntil:'networkidle'});

console.log('— 起動 —');
ok(await page.title()==='モンファーのおとも','title');
const topOrder = await page.locator('.tabbar__btn').allTextContents();
ok(topOrder.join(',')==='モンスター,使い込み,育成計算,早見','上位タブの並び: '+topOrder.join(','));
ok(await page.locator('#pane-monster').isVisible(),'はじめはモンスタータブ');
ok(await page.locator('#monsterEmpty').isVisible(),'種族未選択の案内が出る');
ok(await page.locator('#monsterSpec').isHidden(),'種族を選ぶまで個体データは出さない');

console.log('— 種族追加（D10: 共通の種族バー） —');
await page.click('#speciesGridToggle');
await page.waitForSelector('.monster-cell');
ok(await page.locator('.monster-cell').count()===38,'38種族が並ぶ');
ok(await page.locator('.monster-cell img').count()>0,'アイコンが遅延読み込みされた');
await page.click('.monster-cell[data-name="ピクシー"]');
ok(await page.locator('#monsterSpec').isVisible(),'追加すると個体データが出る');
ok((await page.locator('#specSpeciesLabel').textContent())==='ピクシー','個体データの見出しが種族名');
ok((await page.locator('.apt-cell').count())===6,'成長適正は6つ');
ok((await page.locator('#gutsRecovery option').count())===14,'ガッツ回復は6〜19の14通り');
ok((await page.locator('#speciesChips .chip').count())===1,'種族チップが帯に出る');

console.log('— 技選択（使い込みタブを開いたときに案内が出る） —');
await page.click('#tab-tracker');
await page.waitForSelector('#techPickerCard:not([hidden])');
ok(true,'まだ技を選んでいない種族なら技選択が開く');
ok((await page.locator('.tech-picker__item').count())===8,'ピクシーの技8件');
await page.locator('.tech-picker__item input').nth(0).check();
await page.locator('.tech-picker__item input').nth(3).check();
ok((await page.locator('#techPickerCount').textContent()).includes('2件'),'選択数の表示');
await page.click('[data-action="tracker:applyPick"]');
await page.waitForSelector('#trackerMain:not([hidden])');
ok((await page.locator('#techBody tr').count())===2,'表に2行');

console.log('— 理想回数（ガッツ回復はモンスタータブ） —');
const ideal = await page.locator('#techBody tr').nth(0).locator('.ideal-hit').textContent();
ok(Number(ideal)>0, '理想命中が数値で出る');
ok((await page.locator('#gutsHint').textContent()).includes('15秒'),'いまのガッツ回復を表の下に出す');
await page.click('#tab-monster');
await page.selectOption('#gutsRecovery','6');
await page.click('#tab-tracker');
const ideal6 = await page.locator('#techBody tr').nth(0).locator('.ideal-hit').textContent();
ok(Number(ideal6)>=Number(ideal),'ガッツ回復を速くすると回数が増える(または同等)');
ok((await page.locator('#gutsHint').textContent()).includes('6秒'),'表の下の表示も追いかける');
await page.click('#tab-monster');
await page.selectOption('#gutsRecovery','15');
await page.click('#tab-tracker');

console.log('— 大会の記録 —');
await page.click('[data-action="tracker:start"]');
ok((await page.locator('#sessionBadge').textContent())==='大会中','バッジが大会中');
for(let i=0;i<5;i++) await page.locator('#techBody tr').nth(0).locator('[data-delta="1"]').click();
ok((await page.locator('#techBody tr').nth(0).locator('.counter__val').textContent())==='5','5回カウント');
await page.click('[data-action="tracker:confirm"]');
ok((await page.locator('#techBody tr').nth(0).textContent()).includes('5/30'),'合格で累計に加算');
ok((await page.locator('#logArea').textContent()).includes('合格'),'履歴に残る');

await page.click('[data-action="tracker:start"]');
for(let i=0;i<3;i++) await page.locator('#techBody tr').nth(0).locator('[data-delta="1"]').click();
await page.click('[data-action="tracker:cancel"]');
ok((await page.locator('#techBody tr').nth(0).textContent()).includes('5/30'),'やり直しで累計が増えない');

console.log('— メモ（B1） —');
await page.fill('#memo','テストメモ123');

console.log('— 個体データ（モンスタータブ） —');
await page.click('#tab-monster');
await page.selectOption('#simGtype','bansei');
await page.fill('#simLife','400');
// ヨイワルは -100〜100 の5きざみ
const moralValues = await page.locator('#simMoral option').evaluateAll(o=>o.map(x=>Number(x.value)));
ok(moralValues.length===41,'ヨイワルの選択肢は41個: '+moralValues.length);
ok(moralValues[0]===-100 && moralValues[moralValues.length-1]===100,'両端が-100と100');
ok(moralValues.every((v,i)=>i===0||v-moralValues[i-1]===5),'5きざみで並ぶ');
ok((await page.locator('#simMoral').inputValue())==='0','はじめは0（普通）');
ok((await page.locator('#simMoral option[value="0"]').textContent()).includes('普通'),'0には普通と書いてある');
await page.selectOption('#simMoral','-35');

console.log('— 育成計算タブ（D4: 2階層） —');
await page.click('#tab-simulator');
ok(await page.locator('#simBody').isVisible(),'育成計算が表示');
ok((await page.locator('#simSpeciesLabel').textContent())==='ピクシー','D10: 種族が引き継がれている');
const subOrder = await page.locator('.subtabs__btn').allTextContents();
ok(subOrder.join(',')==='育成計画,調整ローテ,結果','サブタブの並び: '+subOrder.join(','));
ok(await page.locator('#subpane-plan').isVisible(),'はじめは育成計画');
await page.waitForSelector('.plan-table');
const stageRows = await page.locator('.plan-table .stage-cell').count();
ok(stageRows>0,'育成計画テーブルが出る');
const badge = await page.locator('.plan-table .stage-weeks').first().textContent();
ok(/^\d+\/\d+週$/.test(badge),'使用週/総週バッジ: '+badge);
const [used,total] = badge.match(/(\d+)\/(\d+)/).slice(1).map(Number);
ok(used===total,'B5: 寿命変更後も週数が総週数に一致 ('+badge+')');
ok((await page.locator('#planWarnings').textContent()).includes('問題なし'),'警告なし');

console.log('— 成長適正の小表示（計画を組みながら見える） —');
ok((await page.locator('#planApt .plan-apt__cell').count())===6,'計画の上に適正6つが出る');
ok((await page.locator('#planApt .plan-apt__rank').allTextContents()).join('')==='CCCCCC','はじめは全部C');
ok((await page.locator('#planApt .plan-apt__cell input, #planApt .plan-apt__cell select').count())===0,
   'ここでは書き換えられない（読むだけ）');

console.log('— 重トレ→軽トレ自動 —');
await page.locator('.plan-table select').first().selectOption('0');
const hc = page.locator('.plan-table input[data-field="hc"]').first();
await hc.fill('3');
ok((await page.locator('.plan-table .light-count').first().textContent())==='1','軽トレ=4-重トレ');

console.log('— トレーニングの上昇値表示 —');
const row0 = page.locator('.plan-table tbody tr').first();
await row0.locator('select').first().selectOption('0');   // 重り引き
const heavyGain = (await row0.locator('.train-gain').first().textContent()).trim();
// 重り引き: ちから(主)+ ライフ(副)+ 回避-2。適正Cの1段階なら 力+5 ラ+3 回-2
ok(/^力\+\d+ラ\+\d+回-2$/.test(heavyGain),'重トレの上昇値が3つ出る: '+heavyGain);
const gainColors = await row0.locator('.train-gain').first().locator('span').evaluateAll(
  ns => ns.map(n=>getComputedStyle(n).color));
ok(new Set(gainColors).size===3,'能力値ごとに色が違う: '+gainColors.join(' / '));
await row0.locator('select').nth(1).selectOption('4');    // 走り込み（ライフ）
const lightGain = (await row0.locator('.train-gain').nth(1).textContent()).trim();
ok(/^ラ\+\d+$/.test(lightGain),'軽トレの上昇値が出る: '+lightGain);
// 適正を上げると上昇値も増える（モンスタータブで変えて戻ってくる）
const before = Number(heavyGain.match(/力\+(\d+)/)[1]);
await page.click('#tab-monster');
await page.locator('.apt-cell select').nth(1).selectOption('A');  // ちから適正A
await page.click('#tab-simulator');
const after = Number((await page.locator('.plan-table tbody tr').first().locator('.train-gain').first().textContent()).match(/力\+(\d+)/)[1]);
ok(after>before,`適正を上げると上昇値が増える: ${before}→${after}`);
ok((await page.locator('#planApt .plan-apt__rank').allTextContents())[1]==='A','計画の上の小表示も追いかける');
await page.click('#tab-monster');
await page.locator('.apt-cell select').nth(1).selectOption('C');
await page.click('#tab-simulator');
ok((await page.locator('.train-gain-legend').count())===1,'凡例は表の下に1つだけ');
await page.locator('.plan-table tbody tr').first().locator('select').first().selectOption('-1');
ok((await page.locator('.plan-table tbody tr').first().locator('.train-gain').first().textContent()).trim()==='','「なし」なら上昇値は出ない');
await page.locator('.plan-table tbody tr').first().locator('select').first().selectOption('0');

console.log('— 桃 —');
await page.locator('[data-change="sim:peach"][data-pi="0"][data-field="use"]').selectOption('yes');
await page.waitForSelector('.peach__sub');
ok((await page.locator('.peach__sub').textContent()).includes('計'),'桃の追加計画が出る');
ok((await page.locator('.plan-table').count())===2,'桃用テーブルが増える');
const peachTiming = await page.locator('.peach__timing').first().textContent();
ok(peachTiming.includes('桃を与えるタイミング'),'桃を与えるタイミングが出る');
ok(/週目|寿命/.test(peachTiming),'タイミングに段階と週目（または寿命超過）が出る');

console.log('— トレーニングに使える週数 —');
const weekCell = page.locator('.plan-table').first().locator('tbody tr').first();
const weekInput = weekCell.locator('[aria-label="割り当て週数"]');
const trainWeeks = weekCell.locator('.train-weeks');
const assigned = Number(await weekInput.inputValue());
ok((await trainWeeks.textContent()).trim()===`トレ${assigned}週`,'イベント0なら割当週と同じ');
// 大会1回=寿命-4 ぶんだけ減る
await weekCell.locator('[aria-label="大会の回数"]').fill('1');
ok((await trainWeeks.textContent()).trim()===`トレ${assigned-4}週`,'大会1回で4週減る: '+(await trainWeeks.textContent()));
// 修行1回=寿命-7 も足すと合わせて11週減る
await weekCell.locator('[aria-label="修行の回数"]').fill('1');
ok((await trainWeeks.textContent()).trim()===`トレ${assigned-11}週`,'修行1回でさらに7週減る: '+(await trainWeeks.textContent()));
// アイテムも寿命ぶん減る（パラドクシンは-18）
await weekCell.locator('[aria-label="パラドクシンの回数"]').fill('1');
ok((await trainWeeks.textContent()).trim()===`トレ${assigned-29}週`,'パラドクシン1個で18週減る: '+(await trainWeeks.textContent()));
await weekCell.locator('[aria-label="パラドクシンの回数"]').fill('0');
ok(Number(await weekInput.inputValue())===assigned,'イベントを入れても割当週は減らない');
ok((await page.locator('.plan-table thead').first().textContent()).includes('大会(-4)'),'ヘッダーに寿命の減りが出る');
// 割当週を超えたら、はみ出たぶんが次の段階から引かれる
await weekCell.locator('[aria-label="大会の回数"]').fill('0');
await weekCell.locator('[aria-label="修行の回数"]').fill('0');
const stageBadges = page.locator('.plan-table').first().locator('.stage-weeks');
const nextTotal = Number((await stageBadges.nth(1).textContent()).split('/')[1].replace('週',''));
// パラドクシン(-18)を、割当週を超える個数だけ使う。はみ出たぶんが次へ回る
const doses = Math.floor(assigned/18)+1;
await weekCell.locator('[aria-label="パラドクシンの回数"]').fill(String(doses));
const over = doses*18 - assigned;
ok((await trainWeeks.textContent()).trim()===`トレ0週\n次へ${over}週`,'トレは0になり、はみ出しが出る: '+(await trainWeeks.textContent()));
ok((await trainWeeks.getAttribute('class')).includes('train-weeks--over'),'はみ出しは警告色');
const nextAfter = Number((await stageBadges.nth(1).textContent()).split('/')[1].replace('週',''));
ok(nextAfter===nextTotal-over,`次の段階が${over}週減る: ${nextTotal} → ${nextAfter}`);
await weekCell.locator('[aria-label="パラドクシンの回数"]').fill('0');
ok((await trainWeeks.textContent()).trim()===`トレ${assigned}週`,'戻せば元に戻る');
ok(Number((await stageBadges.nth(1).textContent()).split('/')[1].replace('週',''))===nextTotal,'次の段階も戻る');

console.log('— 段階が始まる時期（開始時期は育成計画の中） —');
ok(await page.locator('#subpane-plan #simMonth').isVisible(),'開始時期は育成計画のいちばん上にある');
await page.fill('#simMonth','4');
await page.selectOption('#simWeek','1');
await page.click('#tab-monster');
await page.fill('#simLife','300');
await page.selectOption('#simGtype','futsuu');
await page.click('#tab-simulator');
await page.waitForSelector('.plan-table .stage-date');
const dates = await page.locator('.plan-table').first().locator('.stage-date').allTextContents();
ok(dates[0]==='4月1週','1段階は育成開始と同じ: '+dates[0]);
// 寿命300・普通型なら 1段階30週 → 2段階は30週後 = 11月3週
ok(dates[1]==='11月3週','2段階は30週後: '+dates[1]);
ok(dates.every(d=>/^\d+月[1-4]週$/.test(d)),'すべて○月◎週の形: '+dates.join(','));

// 列の並びと、イベント/アイテムで暦がずれること
const heads = await page.locator('.plan-table').first().locator('thead th').allTextContents();
ok(heads.slice(0,10).join(',')==='段階(週数),セット,重トレ,回/月,軽トレ,自動,割当週,大会(-4),修行(-7),冒険(-2)','列の並び: '+heads.join(','));
ok(heads.some(t=>t.includes('パラドクシン(-18)')),'寿命が減るアイテムの列がある: '+heads.slice(10).join(','));
ok((await page.locator('.plan-table').first().locator('tbody tr').first().locator('.col-set .icon-btn--add').count())===1,'セット欄に＋がある');
// 1段階に大会2回 → 年齢30週ぶんが暦24週になり、2段階が6週手前にずれる
const firstRow = page.locator('.plan-table').first().locator('tbody tr').first();
await firstRow.locator('[aria-label="大会の回数"]').fill('2');
const shifted = await page.locator('.plan-table').first().locator('.stage-date').nth(1).textContent();
ok(shifted==='10月1週','大会2回で2段階が6週手前になる: '+shifted);
// アイテムは暦を進めないので、さらに前に寄る
await firstRow.locator('[aria-label="トロロンの回数"]').fill('1');
const shifted2 = await page.locator('.plan-table').first().locator('.stage-date').nth(1).textContent();
ok(shifted2==='8月3週','トロロン1個でさらに6週手前になる: '+shifted2);
await firstRow.locator('[aria-label="大会の回数"]').fill('0');
await firstRow.locator('[aria-label="トロロンの回数"]').fill('0');
ok((await page.locator('.plan-table').first().locator('.stage-date').nth(1).textContent())==='11月3週','戻せば元に戻る');
// このあとの保存テストのために設定を戻す
await page.click('#tab-monster');
await page.fill('#simLife','400');
await page.selectOption('#simGtype','bansei');
await page.click('#tab-simulator');

console.log('— 調整ローテ —');
await page.click('#subtab-rotation');
ok(await page.locator('#subpane-rotation').isVisible(),'調整ローテのペインが出る');
ok(await page.locator('#simActions').isHidden(),'調整ローテでは計算実行/リセットを出さない');
// 開始時点の内部数値（体型 / ヨイワル / ストレス / 疲労 / 恐れ度 / 甘え度）
const startInputs = page.locator('.rota-start-grid input');
ok((await startInputs.count())===6,'開始時点の内部数値は6つ: '+(await startInputs.count()));
const startLabels = await page.locator('.rota-start-grid label').allTextContents();
ok(startLabels.join(',')==='体型,ヨイワル,ストレス,疲労,恐れ度,甘え度','並び: '+startLabels.join(','));
const startValues = await startInputs.evaluateAll(ns=>ns.map(n=>n.value));
// ヨイワルだけは初期ヨイワル（この時点で-35）から±100の範囲に収まるので 100→65
ok(startValues.join(',')==='-100,65,0,0,100,100','初期値: '+startValues.join(','));
ok((await page.locator('#rotaStart-moral').getAttribute('max'))==='65','初期ヨイワル-35なら上限は+65');
ok((await page.locator('#rotaStart-form').getAttribute('min'))==='-100'
   && (await page.locator('#rotaStart-form').getAttribute('max'))==='100','体型は-100〜100');
ok((await page.locator('#rotaStart-stress').getAttribute('min'))==='0','ストレスは0から');
// 範囲の外を入れても収まる
await page.fill('#rotaStart-stress','250');
await page.click('#subtab-plan');
await page.click('#subtab-rotation');
ok((await page.locator('#rotaStart-stress').inputValue())==='100','範囲の外は上限で止まる');
await page.fill('#rotaStart-stress','40');
// ヨイワルは初期ヨイワルから±100までしか動かない
await page.click('#tab-monster');
await page.selectOption('#simMoral','-90');
await page.click('#tab-simulator');
await page.click('#subtab-rotation');
ok((await page.locator('#rotaStart-moral').getAttribute('max'))==='10','初期ヨイワル-90なら上限は+10');
ok((await page.locator('#rotaStart-moral').inputValue())==='10','はみ出したぶんは範囲に収める');
await page.click('#tab-monster');
await page.selectOption('#simMoral','-35');
await page.click('#tab-simulator');
await page.click('#subtab-rotation');
ok((await page.locator('#rotationArea').textContent()).includes('体調値'),'体調値の説明が出る');

console.log('— エサ —');
const feedRows = page.locator('.feed-table tbody tr');
ok((await feedRows.count())===6,'エサは6種類: '+(await feedRows.count()));
const feedNames = await page.locator('.feed-table__name').allTextContents();
ok(feedNames.join(',')==='ジャガもどき,ミルクもどき,サカナもどき,ゼリーもどき,ニクもどき,ビタミンもどき',
   'エサの並び: '+feedNames.join(','));
// はじめは全部「普通」。ジャガもどき普通 = ストレス+4 / 恐れ度+3 / 甘え度-4 / 体型-1 / 10
const jaga = () => feedRows.nth(0).locator('td').allTextContents();
ok((await jaga()).join(',')==='ジャガもどき,普通,+4,+3,-4,-1,10','普通のジャガもどき: '+(await jaga()).join(','));
// 好き嫌いはモンスタータブで変える
await page.click('#tab-monster');
ok((await page.locator('.feed-like').count())===6,'モンスタータブに好き嫌いの欄が6つ');
await page.locator('[data-change="mon:feedLike"][data-name="ジャガもどき"]').selectOption('like');
await page.locator('[data-change="mon:feedLike"][data-name="ビタミンもどき"]').selectOption('dislike');
await page.click('#tab-simulator');
await page.click('#subtab-rotation');
ok((await jaga()).join(',')==='ジャガもどき,好き,0,0,+1,-1,10','好きにすると効果が変わる: '+(await jaga()).join(','));
const vita = await feedRows.nth(5).locator('td').allTextContents();
ok(vita.join(',')==='ビタミンもどき,嫌い,-10,+2,-1,+3,500','嫌いのビタミンもどき: '+vita.join(','));
// 体型と買値は好き嫌いで変わらない
ok((await jaga())[5]==='-1' && (await jaga())[6]==='10','体型と買値は好き嫌いで変わらない');

console.log('— 週ごとの表 —');
const weekRows = page.locator('.rota-table__inputs');
ok((await weekRows.count())===1,'はじめは空の1行だけ: '+(await weekRows.count()));
ok((await page.locator('.rota-table__week').first().textContent())==='1か月目 第1週','週の見出し');
// 1週ぶん入れると次の週の欄が出てくる（上限なし）
await page.locator('[aria-label="1か月目 第1週のアイテム"]').selectOption('カララギマンゴー');
ok((await weekRows.count())===2,'入れると次の週が出る: '+(await weekRows.count()));
await page.locator('[aria-label="1か月目 第2週の行動"]').selectOption('rest');
ok((await weekRows.count())===3,'行動だけでも次の週が出る');
const actLabels = await page.locator('[aria-label="1か月目 第2週の行動"] option').allTextContents();
ok(actLabels.filter(t=>t.startsWith('大会')).join(',')==='大会（優勝）,大会（他）,大会（ビリ）',
   '大会は結果ごとに選ぶ: '+actLabels.filter(t=>t.startsWith('大会')).join(','));
for(const w of ['1か月目 第3週','1か月目 第4週']) await page.locator(`[aria-label="${w}の行動"]`).selectOption('rest');
ok((await weekRows.count())===5,'4週を超えると2か月目に入る');
ok((await page.locator('.rota-table__week').last().textContent())==='2か月目 第1週','5行目は2か月目 第1週');
// エサは月初めの行だけで選ぶ
ok((await page.locator('.rota-table [aria-label$="か月目のエサ"]').count())===2,'エサの欄は月初めの行だけ');
ok((await page.locator('.rota-table__same').count())===3,'月初め以外は「↑」');

console.log('— 内部数値の計算 —');
// 開始時点をそろえてから、月初めの並び（エサ → 双子の水差し → アイテム）を確かめる
await page.fill('#rotaStart-stress','50');
await page.fill('#rotaStart-fatigue','50');
await page.fill('#rotaStart-fear','50');
await page.fill('#rotaStart-spoil','50');
await page.fill('#rotaStart-form','0');
await page.fill('#rotaStart-moral','0');
await page.fill('#rotaJugs','2');
await page.locator('[aria-label="1か月目のエサ"]').selectOption('ニクもどき');
// ニクもどき(普通) ス-6 甘+4 体+6 → 水差し×2 ス-2 恐+2 → マンゴー 疲-10 恐+1 甘+1 体+1
// 帯は 内部数値6つ + 体調 + 寿命 の順。内部数値だけ取り出す
const valRow = async (n) =>
  (await page.locator('.rota-table__values').nth(n).locator('.rota-vals__num').allTextContents()).slice(0,6);
const w1 = await valRow(0);
ok(w1.join(',')==='40,42,53,55,7,0','1週目の内部数値（疲ス恐甘体ヨ）: '+w1.join(','));
// 月初めでない週にはエサも水差しも効かない。
// 2週目は休養だけが乗る（第1段階: 疲労-36 ストレス-5 体型+5）
const w2 = await valRow(1);
ok(w2.join(',')==='4,37,53,55,12,0','2週目は休養だけが乗る: '+w2.join(','));
ok(w2[2]==='53','恐れ度は動かない（水差しは月初めだけ）');
// 打ちなおしても入力欄からカーソルが飛ばない（表ごと作り直していない）
await page.locator('#rotaStart-stress').fill('80');
ok(await page.locator('#rotaStart-stress').evaluate(n=>n===document.activeElement),'入力中に作り直さない');
ok((await valRow(0))[1]==='72','数値だけ追いかける（80→72）');
await page.fill('#rotaStart-stress','50');
console.log('— 行動と体調値 —');
// 重トレ 疲労+15 ストレス+12。開始をそろえて1週目だけで確かめる
await page.fill('#rotaStart-stress','0');
await page.fill('#rotaStart-fatigue','0');
await page.locator('[aria-label="1か月目のエサ"]').selectOption('');
await page.fill('#rotaJugs','0');
await page.locator('[aria-label="1か月目 第1週のアイテム"]').selectOption('');
await page.locator('[aria-label="1か月目 第1週の行動"]').selectOption('heavy:0');
const cond = (n) => page.locator(`#rotaCond-${n}`).textContent();
const lifeOf = (n) => page.locator(`#rotaLife-${n}`).textContent();
ok((await valRow(0)).slice(0,2).join(',')==='15,12','重トレで疲労+15 ストレス+12');
ok((await cond(0))==='39','体調値 = 15 + 12×2 = 39');
ok((await lifeOf(0))==='-1','体調39は69以下なので週経過ぶんだけ = -1');
ok((await page.locator('#rotaLifeCell-0').getAttribute('title')).includes('追加なし'),
   '体調値69以下なら追加ぶんは無い: '+(await page.locator('#rotaLifeCell-0').getAttribute('title')));
// 休養は成長段階で変わる
await page.locator('[aria-label="1か月目 第2週の行動"]').selectOption('rest');
ok((await valRow(1)).slice(0,2).join(',')==='0,7','第1段階の休養 疲労-36 ストレス-5（下限0で止まる）');
await page.selectOption('#rotaStage','peak');
ok((await valRow(1)).slice(0,2).join(',')==='0,3','ピークの休養はストレス-9');
await page.selectOption('#rotaStage','s1');
// 大会はそのときの体型で疲労が決まり、そのあとストレス0
await page.fill('#rotaStart-form','-100');
await page.locator('[aria-label="1か月目 第3週の行動"]').selectOption('tc:win');
ok((await valRow(2))[1]==='0','大会のあとはストレス0');
ok((await valRow(2))[0]==='23','優勝・体型-100 なら疲労+23（目安表と一致）');
console.log('— 冒険（4週まとめて） —');
// 4週目に冒険を選ぶと、そこから4週ぶんが埋まる
await page.locator('[aria-label="1か月目 第4週の行動"]').selectOption('ac');
const advActs = await page.locator('[aria-label$="の行動"]').evaluateAll(ns=>ns.map(n=>n.value));
ok(advActs.slice(3,7).join(',')==='ac,ac,ac,ac','冒険を選ぶと4週ぶん埋まる: '+advActs.join(','));
// 最初の週だけ変えられる（取りやめられるように）
ok(await page.locator('[aria-label="1か月目 第4週の行動"]').isEnabled(),'冒険の最初の週は変えられる');
ok(await page.locator('[aria-label="2か月目 第1週の行動"]').isDisabled(),'出ているあいだの週は閉じる');
ok(await page.locator('[aria-label="2か月目 第1週のアイテム"]').isDisabled(),'出ているあいだはアイテムも使えない');
// 出ているあいだは体調値なし
ok((await page.locator('#rotaCond-3').textContent())==='冒険中','冒険中は体調値を出さない');
ok((await page.locator('#rotaLife-4').textContent())==='0','冒険中の週は寿命がかからない');
ok((await page.locator('#rotaLife-3').textContent())==='-2','出発の週に冒険ぶんの追加-2');
ok(await page.locator('[aria-label="1か月目 第4週のアイテム"]').isDisabled(),'冒険はアイテムを使えない');
ok((await page.locator('#rotaLifeCell-3').getAttribute('title')).includes('冒険 -2'),
   '内訳が出る: '+(await page.locator('#rotaLifeCell-3').getAttribute('title')));

// 帰ってきた週に疲労がまとめて乗る
const beforeAdv = Number((await valRow(2))[0]);
const backFatigue = Number((await valRow(7))[0]);
ok(backFatigue===Math.min(100,beforeAdv+70),
   `帰ってきた週に疲労+70: ${beforeAdv} → ${backFatigue}`);
ok((await page.locator('.rota-total').textContent()).includes('うち冒険 4週'),
   '冒険の週数が合計に出る: '+(await page.locator('.rota-total').textContent()));
// 大会は 週経過1 + 追加3 = 4
await page.locator('[aria-label="1か月目 第1週の行動"]').selectOption('tc:win');
// 大会は 週経過1 + 体調値ぶん + 大会ぶん3
const tcTitle = await page.locator('#rotaLifeCell-0').getAttribute('title');
ok(/大会 -(3|6)/.test(tcTitle),'大会ぶんが内訳に出る: '+tcTitle);
await page.locator('[aria-label="1か月目 第1週の行動"]').selectOption('heavy:0');
// 取りやめると残りの3週も空く
await page.locator('[aria-label="1か月目 第4週の行動"]').selectOption('rest');
const afterCancel = await page.locator('[aria-label$="の行動"]').evaluateAll(ns=>ns.map(n=>n.value));
ok(afterCancel.slice(3,7).every((v,i)=>i===0?v==='rest':v===''),
   '冒険をやめると残りの3週も空く: '+afterCancel.join(','));

console.log('— 修行（4週セット） —');
// 修行も4週まとめて。出かける週はエサもアイテムも間に合う
await page.locator('[aria-label="1か月目 第4週の行動"]').selectOption('mc');
const mcActs = await page.locator('[aria-label$="の行動"]').evaluateAll(ns=>ns.map(n=>n.value));
ok(mcActs.slice(3,7).join(',')==='mc,mc,mc,mc','修行を選ぶと4週ぶん埋まる: '+mcActs.join(','));
ok(await page.locator('[aria-label="1か月目 第4週のアイテム"]').isEnabled(),
   '修行に出かける週はアイテムを使える');
ok(await page.locator('[aria-label="2か月目 第1週のアイテム"]').isDisabled(),
   '出かけている途中はアイテムなし');
ok(await page.locator('[aria-label="2か月目 第1週の行動"]').isDisabled(),'途中の週は行動も閉じる');
// 途中の月初めはエサをあげられない
ok((await page.locator('.rota-table__inputs').nth(4).locator('[aria-label$="か月目のエサ"]').count())===0,
   '出かけている途中の月初めはエサを選べない');
// 修行中も体調値は出る（冒険とちがう）
ok((await page.locator('#rotaCond-4').textContent())!=='冒険中','修行中は体調値が出る');
// 修行は毎週ぶん体調値で減る。修行そのものの追加は無い
const mcTitles = await Promise.all([3,4,5,6].map(n=>
  page.locator(`#rotaLifeCell-${n}`).getAttribute('title')));
ok(mcTitles.every(t=>!t.includes('大会')&&!t.includes('冒険')),
   '修行そのものの追加は無い: '+mcTitles[3]);
ok(mcTitles.every(t=>t.includes('週経過 -1')),'修行の各週に週経過ぶんがかかる');
const mcCosts = await Promise.all([3,4,5,6].map(n=>page.locator(`#rotaLife-${n}`).textContent()));
ok(mcCosts.every(v=>Number(v.replace('-',''))>=1),'修行の各週に寿命がかかる: '+mcCosts.join(','));
// やめると残りも空く
await page.locator('[aria-label="1か月目 第4週の行動"]').selectOption('rest');
const afterMc = await page.locator('[aria-label$="の行動"]').evaluateAll(ns=>ns.map(n=>n.value));
ok(afterMc.slice(4,7).every(v=>v===''),'修行をやめると残りの3週も空く: '+afterMc.join(','));

// 減る寿命の合計
ok((await page.locator('#rotaLifeTotal').textContent()).includes('週経過'),
   '寿命は内訳つきで出る: '+(await page.locator('#rotaLifeTotal').textContent()));
await page.fill('#rotaJugs','3');
const lifeTotalText = await page.locator('#rotaLifeTotal').textContent();
const [tAge,tExtra,tSum] = lifeTotalText.match(/週経過-(\d+) ＋ 追加-(\d+) ＝ 合計-(\d+)/).slice(1).map(Number);
ok(tAge+tExtra===tSum,`合計は内訳の和: ${tAge}+${tExtra}=${tSum}`);
const perWeek = await page.locator('[id^="rotaLife-"]').allTextContents();
// いちばん下の行は「次の週」の入力欄なので、まだ組んだ週には数えない
ok(tSum===perWeek.slice(0,-1).reduce((a,v)=>a+Number(v.replace('-','')),0),
   '合計は最後の空行をのぞく各週の和と一致: '+tSum+' / '+perWeek.join(','));
ok((await page.locator('.rota-table__inputs.rota-table--pending').count())===1,
   '「次の週」の行は1つだけ薄く出る');
// 表は5行あるが、いちばん下は「次の週」の入力欄なので4週ぶん
ok((await page.locator('.rota-table__inputs').count())===5,'表は5行');
ok((await page.locator('.rota-total').textContent()).includes('組んだ週数 4週'),
   '組んだ週数に「次の週」の行は入らない: '+(await page.locator('.rota-total').textContent()));

// 保存されるか
await page.reload({waitUntil:'networkidle'});
await page.click('#subtab-rotation');
ok((await page.locator('.rota-table__inputs').count())===5,'週の入力が保存されている');
ok((await page.locator('#rotaJugs').inputValue())==='3','双子の水差しの数が保存されている');
ok((await page.locator('#rotaStage').inputValue())==='s1','成長段階が保存されている');
ok((await page.locator('[aria-label="1か月目 第3週の行動"]').inputValue())==='tc:win','行動が保存されている');
await page.click('#subtab-plan');
ok(await page.locator('#simActions').isVisible(),'育成計画では出る');

console.log('— 計算実行 —');
await page.click('[data-action="sim:calc"]');
await page.waitForSelector('#subpane-result:not([hidden])');
ok(await page.locator('.result-panel').isVisible(),'結果タブへ遷移して結果表示');
const vals = await page.locator('.result-row__value').allTextContents();
ok(vals.length===6 && vals.every(v=>/^\d+$/.test(v)),'6パラメータが数値: '+vals.join(','));
ok(Number(vals[1])>100,'ちからが初期値より増えている: '+vals[1]);
const totalText = (await page.locator('.result-total__value').textContent()).trim();
ok(Number(totalText)===vals.reduce((a,v)=>a+Number(v),0),'合計値が6パラメータの和と一致: '+totalText);
ok((await page.locator('.result-total__delta').textContent()).trim().startsWith('+'),'合計の伸びが出る');

console.log('— 保存と復元（D7/D8） —');
await page.reload({waitUntil:'networkidle'});
ok((await page.locator('#tab-simulator').getAttribute('aria-selected'))==='true','D8: タブを覚えている');
ok((await page.locator('#subtab-result').getAttribute('aria-selected'))==='true','D8: サブタブも覚えている');
await page.click('#tab-tracker');
ok((await page.locator('#memo').inputValue())==='テストメモ123','B1: メモが保存されている');
ok((await page.locator('#techBody tr').nth(0).textContent()).includes('5/30'),'使い込み累計が保存されている');
await page.click('#tab-monster');
ok((await page.locator('#simLife').inputValue())==='400','寿命が保存されている');
ok((await page.locator('#simGtype').inputValue())==='bansei','成長タイプが保存されている');
ok((await page.locator('#simMoral').inputValue())==='-35','ヨイワルが保存されている');
ok((await page.locator('#gutsRecovery').inputValue())==='15','ガッツ回復が保存されている');

console.log('— 技なし種族（ライガー） —');
await page.click('#speciesGridToggle');
await page.click('.monster-cell[data-name="ライガー"]');
await page.click('#tab-tracker');
ok((await page.locator('#techBody').textContent()).includes('使い込みで進化する技はありません'),'技なし種族の案内');
ok((await page.locator('#sessionControls').textContent()).trim()==='','技がない種族では大会開始ボタンを出さない');
ok(await page.locator('#changeTechBtn').isHidden(),'技なし種族では「技を変更」も出さない');
ok(await page.locator('#techPickerCard').isHidden(),'技なし種族では技選択も開かない');
await page.click('#tab-simulator');
ok((await page.locator('#simSpeciesLabel').textContent())==='ライガー','技なし種族でも育成計算は使える');
const visibleSub = await page.evaluate(()=>['plan','rotation','result'].filter(t=>!document.getElementById('subpane-'+t).hidden));
ok(visibleSub.length===1,'サブタブは常にちょうど1つだけ表示: '+visibleSub.join(','));
const subContent = await page.evaluate(()=>{const t=['plan','rotation','result'].find(t=>!document.getElementById('subpane-'+t).hidden);return document.getElementById('subpane-'+t).textContent.trim().length;});
ok(subContent>0,'表示中のサブタブに中身がある ('+subContent+'文字)');
await page.click('#subtab-plan');
await page.waitForSelector('#subpane-plan .plan-table');
ok(await page.locator('#subpane-plan .plan-table').isVisible(),'技なし種族でも育成計画テーブルが出る');

console.log('— 種族の切り替えでデータが混ざらないか —');
await page.click('#tab-tracker');
await page.locator('.chip__name', {hasText:'ピクシー'}).click();
ok((await page.locator('#memo').inputValue())==='テストメモ123','ピクシーのメモ');
await page.locator('.chip__name', {hasText:'ライガー'}).click();
ok((await page.locator('#memo').inputValue())==='','ライガーのメモは空');
// エサの好き嫌いも種族ごとに持つ（ピクシーだけ「好き」にしてある）
await page.click('#tab-monster');
ok((await page.locator('[data-change="mon:feedLike"][data-name="ジャガもどき"]').inputValue())==='normal',
   'ライガーの好き嫌いは初期値のまま');
await page.click('#tab-tracker');
await page.locator('.chip__name', {hasText:'ピクシー'}).click();
await page.click('#tab-monster');
ok((await page.locator('[data-change="mon:feedLike"][data-name="ジャガもどき"]').inputValue())==='like',
   'ピクシーの好き嫌いは保存されている');
await page.click('#tab-tracker');
await page.locator('.chip__name', {hasText:'ライガー'}).click();

console.log('— 早見タブ —');
await page.click('#tab-reference');
ok(await page.locator('#pane-reference').isVisible(),'早見タブが表示');
const visibleTop = await page.evaluate(()=>['monster','tracker','simulator','reference'].filter(t=>!document.getElementById('pane-'+t).hidden));
ok(visibleTop.length===1 && visibleTop[0]==='reference','上位タブはちょうど1つだけ表示: '+visibleTop.join(','));
ok(await page.locator('#speciesBar').isHidden(),'早見は種族に関係ないので種族チップを隠す');
ok((await page.locator('.ref-box').count())===6,'6つの箱が並ぶ');
const boxTitles = await page.locator('.ref-box__head').allTextContents();
ok(boxTitles.map(t=>t.replace('＋ 追加','').replace(/（\d+件）/,'').trim()).join(',')
   ==='ローテ,アイテム,合体素材,再生メモ,リンク集,データのバックアップ','箱の並び: '+boxTitles.join(','));
await page.click('#tab-tracker');
ok(await page.locator('#speciesBar').isVisible(),'ほかのタブでは種族チップが戻る');
await page.click('#tab-reference');

console.log('— アイテム（早見に一本化） —');
const itemBox = page.locator('.ref-box').nth(1);
// アプリに入っているぶんは読むだけ（入力欄にしない）
const builtin = await page.locator('.item-row--fixed').count();
ok(builtin>0,'収録ぶんのアイテムが出る: '+builtin+'件');
ok((await page.locator('.item-row--fixed').first().locator('input').count())===0,'収録ぶんは編集できない');
ok((await page.locator('.item-row--fixed').first().textContent()).includes('カララギマンゴー'),'収録ぶんの名前が出る');
// 自分で足すぶん
const myName = page.locator('input.item-row__name');
const myEffect = page.locator('input.item-row__effect');
await page.click('[data-action="item:add"]');
await myName.first().fill('まずいマタタビ');
await myEffect.first().fill('ちから+5 きふん-10');
await page.click('[data-action="item:add"]');
await myName.last().fill('おいしいマタタビ');
await myEffect.last().fill('ちから+10 きふん+5');
ok((await myName.count())===2,'アイテムを続けて足せる');
ok((await itemBox.locator('.ref-box__head').textContent()).includes(`${builtin+2}件`),'件数は収録ぶんとの合計');
ok((await page.locator('#pane-simulator .item-row').count())===0,'育成計算タブにはもうアイテムを置かない');
// 種族を切り替えても中身は変わらない（アイテムは全体で1つ）
await page.click('#tab-tracker');
await page.locator('.chip__name', {hasText:'ピクシー'}).click();
await page.click('#tab-reference');
ok((await page.locator('input.item-row__name').count())===2,'種族を切り替えてもアイテムは共通');
page.once('dialog',d=>d.accept());
await page.locator('[data-action="item:del"]').last().click();
ok((await page.locator('input.item-row__name').count())===1,'アイテムを削除できる');
await page.click('[data-action="item:add"]');
await myName.last().fill('おいしいマタタビ');
await myEffect.last().fill('ちから+10 きふん+5');

console.log('— リンク集 —');
ok((await page.locator('.ref-box--auto').count())===2,'リンク集とバックアップは中身に合わせて伸びる');
ok((await page.locator('.ref-link__btn').count())===3,'あらかじめ3つのリンクが入っている');
ok((await page.locator('.ref-link__del').count())===0,'あらかじめ入っているリンクは消せない');
// 名前だけ / URLだけではエラーになる
await page.click('[data-action="ref:addLink"]');
ok((await page.locator('#refLinkError').textContent()).includes('名前'),'名前が空ならエラー');
await page.fill('#refLinkName','攻略メモ');
await page.fill('#refLinkUrl','javascript:alert(1)');
await page.click('[data-action="ref:addLink"]');
ok((await page.locator('.ref-link__del').count())===0,'http/https 以外のURLは追加されない');
ok((await page.locator('#refLinkError').textContent()).includes('http'),'URLが不正ならエラー');
await page.fill('#refLinkUrl','example.com/mf2');
await page.click('[data-action="ref:addLink"]');
ok((await page.locator('.ref-link__del').count())===1,'自分のリンクを追加できる');
const addedLink = page.locator('.ref-link:has(.ref-link__del) .ref-link__btn').first();
ok((await addedLink.textContent()).trim()==='攻略メモ','名前がボタンになる');
ok((await addedLink.getAttribute('href'))==='https://example.com/mf2','スキームがなければ https:// を補う');
ok((await addedLink.getAttribute('target'))==='_blank','別タブで開く');

console.log('— 箱の中だけスクロール —');
const scrollable = await page.evaluate(()=>{
  const b=[...document.querySelectorAll('.ref-box__body')];
  return b.every(x=>getComputedStyle(x).overflowY==='auto') && b.every(x=>x.clientHeight>0);
});
ok(scrollable,'各箱の本文が縦スクロール領域になっている');
const fixedHeight = await page.evaluate(()=>{
  // リンク集とバックアップは中身に合わせて伸びるので、高さ固定の対象は上の4つ
  const h=[...document.querySelectorAll('.ref-box:not(.ref-box--auto)')].map(x=>Math.round(x.getBoundingClientRect().height));
  return h.length===4 && h.every(v=>v===h[0]);
});
ok(fixedHeight,'箱の高さが固定（リンク集とバックアップをのぞく4つとも同じ）');

console.log('— 再生メモ —');
await page.click('[data-action="ref:addNote"]');
await page.waitForSelector('.ref-note');
await page.fill('.ref-note [data-field="monster"]','ピクシー');
await page.fill('.ref-note [data-field="title"]','テストCD');
await page.fill('.ref-note [data-field="singer"]','テスト歌手');
await page.fill('.ref-note [data-field="memo"]','いい石像が出る');
await page.reload({waitUntil:'networkidle'});
ok((await page.locator('#tab-reference').getAttribute('aria-selected'))==='true','D8: 早見タブも覚えている');
ok((await page.locator('.ref-note [data-field="monster"]').inputValue())==='ピクシー','再生メモが保存されている');
ok((await page.locator('input.item-row__name').count())===2,'アイテムが保存されている');
ok((await page.locator('.ref-note [data-field="memo"]').inputValue())==='いい石像が出る','自由メモが保存されている');
ok((await page.locator('.ref-link:has(.ref-link__del) .ref-link__btn').first().textContent()).trim()==='攻略メモ','追加したリンクが保存されている');
page.once('dialog',d=>d.accept());
await page.locator('[data-action="ref:delLink"]').first().click();
ok((await page.locator('.ref-link__del').count())===0,'追加したリンクを削除できる');
ok((await page.locator('.ref-link__btn').count())===3,'削除してもあらかじめ入っている3つは残る');
const beforeScroll = await page.evaluate(()=>document.documentElement.scrollHeight);
for(let i=0;i<6;i++) await page.click('[data-action="ref:addNote"]');
ok((await page.locator('.ref-note').count())===7,'メモを増やせる');
ok(await page.evaluate(()=>document.documentElement.scrollHeight)===beforeScroll,'メモが増えてもページの高さは変わらない（箱の中で吸収）');
ok(await page.evaluate(()=>{const b=document.querySelectorAll('.ref-box__body')[3];return b.scrollHeight>b.clientHeight;}),'再生メモの箱がスクロールする');
page.once('dialog',d=>d.accept());
await page.locator('[data-action="ref:delNote"]').first().click();
ok((await page.locator('.ref-note').count())===6,'メモを削除できる');
ok((await page.locator('.ref-note [data-field="monster"]').last().inputValue())==='ピクシー','削除しても他のメモは残る');

console.log('— バックアップ（早見の箱） —');
ok(await page.locator('[data-action="backup:export"]').isVisible(),'書き出しボタンは早見タブにある');
await page.click('#tab-tracker');
ok((await page.locator('#pane-tracker [data-action="backup:export"]').count())===0,'ほかのタブには出ない');

console.log('— 横スクロール —');
const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1);
ok(!overflow,'ページ全体に横スクロールが出ていない');

await page.click('#tab-simulator');
await page.screenshot({path:OUT+'shot-sim.png', fullPage:true});
await page.click('#tab-tracker');
await page.screenshot({path:OUT+'shot-tracker.png', fullPage:true});
await page.click('#tab-monster');
await page.screenshot({path:OUT+'shot-monster.png', fullPage:true});
await page.click('#tab-reference');
await page.screenshot({path:OUT+'shot-reference.png', fullPage:true});

// ダークモード
const dark = await browser.newContext({viewport:{width:390,height:844}, colorScheme:'dark'});
const dp = await dark.newPage();
await dp.goto(BASE,{waitUntil:'networkidle'});
await dp.click('#speciesGridToggle');
await dp.click('.monster-cell[data-name="ドラゴン"]');
await dp.screenshot({path:OUT+'shot-dark.png', fullPage:true});

console.log(`\n合格 ${pass} / 失敗 ${fail}`);
console.log('コンソールエラー:', errors.length ? errors : 'なし');
await browser.close();
process.exit(fail||errors.length?1:0);
