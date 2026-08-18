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
ok(await page.locator('#trackerEmpty').isVisible(),'種族未選択の案内が出る');

console.log('— 種族追加（D10: 共通の種族バー） —');
await page.click('#speciesGridToggle');
await page.waitForSelector('.monster-cell');
ok(await page.locator('.monster-cell').count()===38,'38種族が並ぶ');
ok(await page.locator('.monster-cell img').count()>0,'アイコンが遅延読み込みされた');
await page.click('.monster-cell[data-name="ピクシー"]');
await page.waitForSelector('#techPickerCard:not([hidden])');
ok(true,'追加直後に技選択が開く');
ok((await page.locator('.tech-picker__item').count())===8,'ピクシーの技8件');

console.log('— 技選択 —');
await page.locator('.tech-picker__item input').nth(0).check();
await page.locator('.tech-picker__item input').nth(3).check();
ok((await page.locator('#techPickerCount').textContent()).includes('2件'),'選択数の表示');
await page.click('[data-action="tracker:applyPick"]');
await page.waitForSelector('#trackerMain:not([hidden])');
ok((await page.locator('#techBody tr').count())===2,'表に2行');

console.log('— 理想回数 —');
const ideal = await page.locator('#techBody tr').nth(0).locator('.ideal-hit').textContent();
ok(Number(ideal)>0, '理想命中が数値で出る');
await page.selectOption('#gutsRecovery','6');
const ideal6 = await page.locator('#techBody tr').nth(0).locator('.ideal-hit').textContent();
ok(Number(ideal6)>=Number(ideal),'ガッツ回復を速くすると回数が増える(または同等)');
await page.selectOption('#gutsRecovery','15');

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

console.log('— 育成計算タブ（D4: 2階層） —');
await page.click('#tab-simulator');
ok(await page.locator('#simBody').isVisible(),'育成計算が表示');
ok((await page.locator('#simSpeciesLabel').textContent())==='ピクシー','D10: 種族が引き継がれている');
ok((await page.locator('.apt-cell').count())===6,'適正6つ');
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
await page.click('#subtab-plan');
await page.waitForSelector('.plan-table');
const stageRows = await page.locator('.plan-table .stage-cell').count();
ok(stageRows>0,'育成計画テーブルが出る');
const badge = await page.locator('.plan-table .stage-weeks').first().textContent();
ok(/^\d+\/\d+週$/.test(badge),'使用週/総週バッジ: '+badge);
const [used,total] = badge.match(/(\d+)\/(\d+)/).slice(1).map(Number);
ok(used===total,'B5: 寿命変更後も週数が総週数に一致 ('+badge+')');
ok((await page.locator('#planWarnings').textContent()).includes('問題なし'),'警告なし');

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
// 適正を上げると上昇値も増える（基本設定で変えて戻ってくる）
const before = Number(heavyGain.match(/力\+(\d+)/)[1]);
await page.click('#subtab-basic');
await page.locator('.apt-cell select').nth(1).selectOption('A');  // ちから適正A
await page.click('#subtab-plan');
const after = Number((await page.locator('.plan-table tbody tr').first().locator('.train-gain').first().textContent()).match(/力\+(\d+)/)[1]);
ok(after>before,`適正を上げると上昇値が増える: ${before}→${after}`);
await page.click('#subtab-basic');
await page.locator('.apt-cell select').nth(1).selectOption('C');
await page.click('#subtab-plan');
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
const weekInput = weekCell.locator('input[type="number"]').last();
const trainWeeks = weekCell.locator('.train-weeks');
const assigned = Number(await weekInput.inputValue());
ok((await trainWeeks.textContent()).trim()===`トレ${assigned}週`,'イベント0なら割当週と同じ');
// 大会1回=4週 ぶんだけ減る
await weekCell.locator('input[type="number"]').nth(1).fill('1');
ok((await trainWeeks.textContent()).trim()===`トレ${assigned-4}週`,'大会1回で4週減る: '+(await trainWeeks.textContent()));
// 修行1回=5週 も足すと合わせて9週減る
await weekCell.locator('input[type="number"]').nth(2).fill('1');
ok((await trainWeeks.textContent()).trim()===`トレ${assigned-9}週`,'修行1回でさらに5週減る: '+(await trainWeeks.textContent()));
ok(Number(await weekInput.inputValue())===assigned,'イベントを入れても割当週は減らない');
// 割当週を超えるイベントは赤くなる
await weekInput.fill('5');
ok((await trainWeeks.getAttribute('class')).includes('train-weeks--over'),'割当週より多いイベントは警告色');
await weekCell.locator('input[type="number"]').nth(1).fill('0');
await weekCell.locator('input[type="number"]').nth(2).fill('0');
await weekInput.fill(String(assigned));
ok((await trainWeeks.textContent()).trim()===`トレ${assigned}週`,'戻せば元に戻る');

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
await page.click('#tab-simulator');
ok((await page.locator('#simLife').inputValue())==='400','寿命が保存されている');
ok((await page.locator('#simGtype').inputValue())==='bansei','成長タイプが保存されている');
ok((await page.locator('#simMoral').inputValue())==='-35','ヨイワルが保存されている');

console.log('— 技なし種族（ライガー） —');
await page.click('#tab-tracker');
await page.click('#speciesGridToggle');
await page.click('.monster-cell[data-name="ライガー"]');
ok((await page.locator('#techBody').textContent()).includes('使い込みで進化する技はありません'),'技なし種族の案内');
ok((await page.locator('#sessionControls').textContent()).trim()==='','技がない種族では大会開始ボタンを出さない');
ok(await page.locator('#changeTechBtn').isHidden(),'技なし種族では「技を変更」も出さない');
await page.click('#tab-simulator');
ok((await page.locator('#simSpeciesLabel').textContent())==='ライガー','技なし種族でも育成計算は使える');
const visibleSub = await page.evaluate(()=>['basic','plan','result'].filter(t=>!document.getElementById('subpane-'+t).hidden));
ok(visibleSub.length===1,'サブタブは常にちょうど1つだけ表示: '+visibleSub.join(','));
const subContent = await page.evaluate(()=>{const t=['basic','plan','result'].find(t=>!document.getElementById('subpane-'+t).hidden);return document.getElementById('subpane-'+t).textContent.trim().length;});
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

console.log('— アイテム —');
await page.click('#tab-simulator');
await page.click('#subtab-item');
ok(await page.locator('#subpane-item').isVisible(),'アイテムタブが表示');
const subOrder = await page.locator('.subtabs__btn').allTextContents();
ok(subOrder.join(',')==='基本設定,育成計画,アイテム,結果','育成計画と結果の間にある: '+subOrder.join(','));
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
ok((await page.locator('#itemArea .section-head').textContent()).includes(`${builtin+2}件`),'件数は収録ぶんとの合計');
// 早見タブに出る
await page.click('#tab-reference');
const itemBody = page.locator('.ref-box').nth(1);
ok((await itemBody.locator('.ref-box__head').textContent()).includes('アイテム'),'2番目の箱がアイテム');
ok((await itemBody.locator('.ref-row').count())===builtin+2,'収録ぶんのうしろに足したぶんが並ぶ');
ok((await itemBody.locator('.ref-row__name').first().textContent())==='カララギマンゴー','収録ぶんが先に出る');
ok((await itemBody.locator('.ref-row__name').last().textContent())==='おいしいマタタビ','足したぶんが最後に出る');
ok((await itemBody.locator('.ref-row__detail').last().textContent())==='ちから+10 きふん+5','効果が出る');
// 名前も効果も空の行は早見に出さない
await page.click('#tab-simulator');
await page.click('[data-action="item:add"]');
await page.click('#tab-reference');
ok((await page.locator('.ref-box').nth(1).locator('.ref-row').count())===builtin+2,'空の行は早見に出ない');
await page.click('#tab-simulator');
page.once('dialog',d=>d.accept());
await page.locator('[data-action="item:del"]').last().click();
ok((await page.locator('input.item-row__name').count())===2,'アイテムを削除できる');

console.log('— 早見タブ —');
await page.click('#tab-reference');
ok(await page.locator('#pane-reference').isVisible(),'早見タブが表示');
const visibleTop = await page.evaluate(()=>['tracker','simulator','reference'].filter(t=>!document.getElementById('pane-'+t).hidden));
ok(visibleTop.length===1 && visibleTop[0]==='reference','上位タブはちょうど1つだけ表示: '+visibleTop.join(','));
ok((await page.locator('.ref-box').count())===5,'5つの箱が並ぶ');
const boxTitles = await page.locator('.ref-box__head').allTextContents();
ok(boxTitles.map(t=>t.replace('＋ 追加','').trim()).join(',')==='ローテ,アイテム,合体素材,再生メモ,リンク集','箱の並び: '+boxTitles.join(','));

console.log('— リンク集 —');
ok((await page.locator('.ref-box--links').count())===1,'リンク集の箱が一番下にある');
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
  // リンク集だけは中身に合わせて伸びるので、高さ固定の対象は上の4つ
  const h=[...document.querySelectorAll('.ref-box:not(.ref-box--links)')].map(x=>Math.round(x.getBoundingClientRect().height));
  return h.length===4 && h.every(v=>v===h[0]);
});
ok(fixedHeight,'箱の高さが固定（リンク集をのぞく4つとも同じ）');

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
ok((await page.locator('.ref-box').nth(1).locator('.ref-row').count())===builtin+2,'アイテムが保存されている');
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
await page.click('#tab-tracker');

console.log('— 横スクロール —');
const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1);
ok(!overflow,'ページ全体に横スクロールが出ていない');

await page.screenshot({path:OUT+'shot-sim.png', fullPage:true});
await page.locator('.chip__name', {hasText:'ピクシー'}).click();
await page.click('#tab-tracker');
await page.screenshot({path:OUT+'shot-tracker.png', fullPage:true});

// ダークモード
const dark = await browser.newContext({viewport:{width:390,height:844}, colorScheme:'dark'});
const dp = await dark.newPage();
await dp.goto(BASE,{waitUntil:'networkidle'});
await dp.click('#speciesGridToggle');
await dp.click('.monster-cell[data-name="ドラゴン"]');
await dp.click('[data-action="tracker:cancelPick"]');
await dp.screenshot({path:OUT+'shot-dark.png', fullPage:true});

console.log(`\n合格 ${pass} / 失敗 ${fail}`);
console.log('コンソールエラー:', errors.length ? errors : 'なし');
await browser.close();
process.exit(fail||errors.length?1:0);
