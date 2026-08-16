import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:8811/';
// 実行時の一時ファイル（スクリーンショット等）の置き場
const OUT = new URL('./.tmp/', import.meta.url).pathname;
(await import('fs')).mkdirSync(OUT, {recursive:true});
let pass=0,fail=0; const errors=[];
const ok=(c,l)=>{ if(c) pass++; else {fail++;console.log('  ✗ '+l);} };
const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});

/* ===== 旧トラッカーからの移行（R9） ===== */
console.log('— 旧データからの移行 —');
const ctx = await browser.newContext({viewport:{width:390,height:844}});
const page = await ctx.newPage();
page.on('pageerror', e=>errors.push('pageerror: '+e.message));
page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });

// 旧アプリの保存形式をそのまま埋め込む
await page.goto(BASE);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mf2_mf2v8_state', JSON.stringify({
    monsters:[
      {id:1, name:'ヘンガー', monGutsRecovery:12, session:false,
       log:[{type:'ok',text:'合格: パンチ+7',date:'2026/01/05'}],
       techs:[{from:'パンチ',to:'ヘヴィチョップ',need:30,guts:10,hit:2.8,miss:3.1,
               milestone:{need:50,to:'アイショット'},total:23,session:0,done:false},
              {from:'ヨーヨー',to:'Wヨーヨー',need:50,guts:17,hit:4.1,miss:4.1,total:50,session:0,done:true}]},
      {id:2, name:'モッチー', monGutsRecovery:9, session:false, log:[], techs:[]}
    ],
    current:1, monGutsRecovery:15,
    techHistory:{
      'ヘンガー':{'パンチ→ヘヴィチョップ':{total:23,done:false},'ヨーヨー→Wヨーヨー':{total:50,done:true},
                  'ローキック→キック':{total:11,done:false}},
      'ゴーレム':{'パンチ→大パンチ':{total:44,done:false}}
    }
  }));
});
await page.goto(BASE,{waitUntil:'networkidle'});

ok(await page.locator('#migrationNotice').isVisible(),'移行の案内が出る');
const chips = await page.locator('.chip__name').allTextContents();
ok(chips.includes('ヘンガー')&&chips.includes('モッチー')&&chips.includes('ゴーレム'),
   '種族が引き継がれた: '+chips.join(','));
ok((await page.locator('#trackerSpeciesLabel').textContent())==='ヘンガー','選択中の種族も復元');
ok((await page.locator('#gutsRecovery').inputValue())==='12','ガッツ回復値が引き継がれた');
const body = await page.locator('#techBody').textContent();
ok(body.includes('23/30'),'途中の累計が引き継がれた');
ok(body.includes('✓完了'),'完了状態が引き継がれた');
ok(body.includes('アイショット'),'milestone表示');
ok((await page.locator('#logArea').textContent()).includes('パンチ+7'),'履歴が引き継がれた');

// 選択を外していた技（techHistoryのみ）の記録が残っているか
await page.click('[data-action="tracker:openPicker"]');
await page.waitForSelector('.tech-picker__item');
const picker = await page.locator('#techPickerList').textContent();
ok(picker.includes('記録:11回'),'選択を外していた技の記録も保持: ローキック11回');
await page.click('[data-action="tracker:cancelPick"]');

// 新形式で保存され、旧キーは残したまま（巻き戻せるように）
const keys = await page.evaluate(()=>Object.keys(localStorage));
ok(keys.includes('monfar_state_v1'),'新しいキーで保存された');
ok(keys.includes('mf2_mf2v8_state'),'旧データは消さずに残している');

// 二重移行が起きないこと
await page.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('monfar_state_v1')); s.mon['ヘンガー'].memo='移行後メモ'; localStorage.setItem('monfar_state_v1',JSON.stringify(s)); });
await page.goto(BASE,{waitUntil:'networkidle'});
ok((await page.locator('#memo').inputValue())==='移行後メモ','再読込で旧データに上書きされない');
ok(await page.locator('#migrationNotice').isHidden(),'2回目は移行の案内を出さない');

/* ===== バックアップ（R8） ===== */
console.log('— バックアップ —');
const dl = page.waitForEvent('download');
await page.click('[data-action="backup:export"]');
const d = await dl;
ok(/^monfar-no-otomo-\d{4}-\d{2}-\d{2}\.json$/.test(d.suggestedFilename()),'書き出しファイル名: '+d.suggestedFilename());
const fs = await import('fs');
const tmp=OUT+'backup.json';
await d.saveAs(tmp);
const parsed = JSON.parse(fs.readFileSync(tmp,'utf8'));
ok(parsed.mon['ヘンガー'].memo==='移行後メモ','書き出した中身が正しい');

// データを消してから読み込みで復元
await page.evaluate(()=>localStorage.clear());
await page.goto(BASE,{waitUntil:'networkidle'});
ok(await page.locator('#trackerEmpty').isVisible(),'消去された');
page.once('dialog', d=>d.accept());
await page.setInputFiles('#importFile', tmp);
await page.waitForSelector('#trackerMain:not([hidden])');
ok((await page.locator('.chip__name').allTextContents()).includes('ヘンガー'),'バックアップから復元できた');

// 壊れたファイルを渡しても既存データを壊さない
fs.writeFileSync(OUT+'broken.json','{ これはJSONではない');
page.once('dialog', d=>d.accept());
await page.setInputFiles('#importFile',OUT+'broken.json');
await page.waitForTimeout(300);
ok((await page.locator('.chip__name').allTextContents()).includes('ヘンガー'),'壊れたファイルでデータが消えない');

/* ===== オフライン（PWA） ===== */
console.log('— オフライン —');
await page.goto(BASE,{waitUntil:'networkidle'});
await page.evaluate(()=>navigator.serviceWorker.ready.then(r=>r.active&&null));
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(800);
ok((await page.title())==='モンファーのおとも','機内モードでも起動する');
ok(await page.locator('#trackerMain').isVisible()||await page.locator('#trackerEmpty').isVisible(),'画面が描画される');
const cssApplied = await page.evaluate(()=>getComputedStyle(document.querySelector('.card')).borderRadius);
ok(cssApplied!=='0px','オフラインでもCSSが効いている: '+cssApplied);
await page.click('#tab-simulator');
await page.click('#subtab-plan');
await page.waitForSelector('.plan-table',{timeout:5000});
ok(true,'オフラインで育成計算タブも動く');
await page.click('#tab-tracker');
await page.click('#speciesGridToggle');
await page.waitForSelector('.monster-cell',{timeout:5000});
ok((await page.locator('.monster-cell img').count())>0,'オフラインでアイコンも表示される');
await ctx.setOffline(false);

console.log(`\n合格 ${pass} / 失敗 ${fail}`);
console.log('コンソールエラー:', errors.length?errors:'なし');
await browser.close();
process.exit(fail?1:0);
