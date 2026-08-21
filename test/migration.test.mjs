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
ok((await page.locator('#specSpeciesLabel').textContent())==='ヘンガー','選択中の種族も復元');
ok((await page.locator('#gutsRecovery').inputValue())==='12','ガッツ回復値が引き継がれた');
await page.click('#tab-tracker');
ok((await page.locator('#trackerSpeciesLabel').textContent())==='ヘンガー','使い込みタブにも引き継がれる');
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
await page.click('#tab-tracker');
ok((await page.locator('#memo').inputValue())==='移行後メモ','再読込で旧データに上書きされない');
ok(await page.locator('#migrationNotice').isHidden(),'2回目は移行の案内を出さない');

/* ===== バックアップ（R8） ===== */
console.log('— バックアップ —');
await page.click('#tab-reference');
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
ok(await page.locator('#monsterEmpty').isVisible(),'消去された');
await page.click('#tab-reference');
page.once('dialog', d=>d.accept());
await page.setInputFiles('#importFile', tmp);
await page.waitForSelector('#speciesChips .chip',{state:'attached'});
ok((await page.locator('.chip__name').allTextContents()).includes('ヘンガー'),'バックアップから復元できた');

// 壊れたファイルを渡しても既存データを壊さない
fs.writeFileSync(OUT+'broken.json','{ これはJSONではない');
await page.click('#tab-reference');
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
// どのタブを開いた状態で落ちたかは直前の操作次第なので、
// 「上位タブのどれか1つがちゃんと開いている」ことで描画を見る
const shownPane = await page.evaluate(()=>
  ['monster','tracker','simulator','reference'].filter(t=>!document.getElementById('pane-'+t).hidden));
ok(shownPane.length===1,'画面が描画される: '+shownPane.join(','));
const cssApplied = await page.evaluate(()=>getComputedStyle(document.querySelector('.card')).borderRadius);
ok(cssApplied!=='0px','オフラインでもCSSが効いている: '+cssApplied);
await page.click('#tab-simulator');
await page.click('#subtab-plan');
await page.waitForSelector('.plan-table',{timeout:5000});
ok(true,'オフラインで育成計算タブも動く');
await page.click('#tab-monster');
await page.click('#speciesGridToggle');
await page.waitForSelector('.monster-cell',{timeout:5000});
ok((await page.locator('.monster-cell img').count())>0,'オフラインでアイコンも表示される');
await ctx.setOffline(false);

/* ===== 育成計画の保存形式の移行（桃の挟み込み） ===== */
console.log('— 育成計画の移行 —');
// 旧形式: plan[グループ][段階]。グループは 0=通常 / 1=黄金桃後 / 2=白銀桃後
await page.evaluate(() => {
  const set = (weeks, extra = {}) =>
    Object.assign({ht:0,hc:4,lt:-1,tc:0,mc:0,ac:0,weeks,items:{}}, extra);
  localStorage.setItem('monfar_state_v1', JSON.stringify({
    v:1, ui:{top:'simulator',sim:'plan',gridOpen:false}, current:'ゴーレム', order:['ゴーレム'],
    notes:[], links:[], items:[], rotas:[],
    mon:{'ゴーレム':{guts:15,inSession:false,memo:'',log:[],selected:[],progress:{},
      sim:{month:1,week:1,gtype:'futsuu',moral:0,life:300,
        apt:{life:'C',pow:'C',int:'C',hit:'C',avo:'C',tou:'C'},
        init:{life:100,pow:100,int:100,hit:100,avo:100,tou:100},
        // 5段階(30週)に重り引き、桃1（黄金桃）後のピークに変動床
        plan:{0:{6:[set(30,{lt:2})]},1:{4:[set(30,{ht:1})]},2:{}},
        peach:[{use:true,si:4,setN:1},{use:false,si:4,setN:1}], result:null}}}
  }));
});
await page.goto(BASE,{waitUntil:'networkidle'});
await page.click('#tab-simulator');
await page.waitForSelector('.plan-row--peach');
const migRows = await page.locator('.plan-table tbody tr').evaluateAll(rows=>rows.map(r=>({
  name:(r.querySelector('.stage-name')||{}).textContent||'',
  weeks:(r.querySelector('.stage-weeks')||{}).textContent||'',
  peach:r.className.includes('plan-row--peach')&&!r.className.includes('head'),
  heavy:(r.querySelector('select')||{}).value,
  light:(r.querySelectorAll('select')[1]||{}).value,
})));
const fifth = migRows.filter(r=>r.name==='5段階');
ok(fifth.length===3,'5段階は 白(前)/桃/白(後) の3行になる: '+fifth.map(r=>r.weeks).join(','));
ok(fifth.filter(r=>!r.peach).map(r=>r.weeks).join(',')==='5/5週,25/25週','白の5段階が前後に割れる');
ok(fifth.every(r=>r.light==='2'),'旧データの軽トレが割れた行にも引き継がれる');
ok(migRows.filter(r=>r.peach&&r.name==='ピーク').every(r=>r.heavy==='1'),
   '桃後の計画（変動床）も桃の行に引き継がれる');
ok((await page.locator('#planWarnings').textContent()).trim()==='','移行しただけでは警告は出ない');


console.log(`\n合格 ${pass} / 失敗 ${fail}`);
console.log('コンソールエラー:', errors.length?errors:'なし');
await browser.close();
process.exit(fail?1:0);
