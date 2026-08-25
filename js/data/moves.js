/* ===========================================================
   種族ごとの技データ（有志Wikiの技一覧をそのまま写したもの）
   -----------------------------------------------------------
   使い込みタブの「この種族が覚える技」に出す。表示専用で、
   計算にも保存データにも使わない。

   ★ js/data/monsters.js とは別のファイル ★
   monsters.js の "下位技→上位技" は使い込みの記録のキーなので、
   絶対に作り変えない。こちらは名前で突き合わせるだけにしてある
   （ズレたら test/calc.test.mjs が落ちる）。

   1技ぶんの中身（並びは @wiki の表と同じ）:
     name   技名
     stat   ちから技 / かしこさ技  'pow' / 'int'
            @wiki の表で技名セルの背景色になっているもの（黄＝ちから / 緑＝かしこさ）
     kind   種類  バランス / 大ダメージ / 超必殺 / 命中 / ガッツダウン / クリティカル
     dist   距離  1=近 … 4=遠（表の「遠←距離→近」のどの列に数字があるか）
     guts   消費ガッツ
     dmg    ダメージ  [ランク, 数値]。表の E(6) は ['E',6]。空欄は null
     acc    命中      [ランク, 数値]。マイナスもある
     gd     ガッツダウン（表の GD）
     cr     クリティカル率（表の CR）
     moral  ヨイワル  ワル(-50) は -50、ヨイ(+50) は 50。無いものは null
     note   備考      使い込み条件・派生種固有・特殊効果。表の文字をそのまま入れる
     tHit   当時間（命中時のモーション秒。monsters.js の hit と同じ値）
     tMiss  外時間（空振り時のモーション秒。monsters.js の miss と同じ値）
     mvHit  移動(当)  '1' や '2→3' のように表のまま
     mvMiss 移動(外)
     rapid  連射      強 / 並
     init   最初から持っている技なら true（無ければ書かない）
            @wiki の表では「種類」のセルが淡い黄色（#ffffa0）になっているもの。
            画面には出していないが、修行で覚える技と区別が付くので持っておく
   =========================================================== */

/** ランクの並び（色分けに使う。S がいちばん上） */
export const RANKS = ['S', 'A', 'B', 'C', 'D', 'E'];

/** 種類の並び（絞り込みボタンの順番にもなる） */
export const KINDS = ['バランス', '大ダメージ', '超必殺', '命中', 'ガッツダウン', 'クリティカル'];

export const MOVES = {
  ピクシー: [
    { init:true, name:'タッチ',        stat:'pow', kind:'バランス',     dist:1, guts:12, dmg:['E',6],  acc:['A',10],  gd:null,       cr:null,       moral:null, note:'',                              tHit:3.8, tMiss:3.8, mvHit:'1',      mvMiss:'1→2',   rapid:'強' },
    { name:'はり手',        stat:'pow', kind:'バランス',     dist:1, guts:18, dmg:['D',15], acc:['A',9],   gd:['E',5],    cr:null,       moral:null, note:'タッチ30回',                    tHit:3.8, tMiss:4.1, mvHit:'1',      mvMiss:'1→2',   rapid:'並' },
    { init:true, name:'キック',        stat:'pow', kind:'バランス',     dist:1, guts:10, dmg:['E',7],  acc:['B',4],   gd:null,       cr:null,       moral:null, note:'',                              tHit:3.8, tMiss:4.1, mvHit:'1',      mvMiss:'1→2',   rapid:'強' },
    { name:'ハイキック',    stat:'pow', kind:'バランス',     dist:1, guts:19, dmg:['D',15], acc:['B',3],   gd:['E',5],    cr:['E',5],    moral:null, note:'キック30回',                    tHit:3.3, tMiss:4.3, mvHit:'1',      mvMiss:'1→2',   rapid:'強' },
    { name:'ヒールレイド',  stat:'pow', kind:'大ダメージ',   dist:1, guts:30, dmg:['C',28], acc:['D',-10], gd:['C',20],   cr:['E',5],    moral:null, note:'ハイキック50回',                tHit:5.5, tMiss:4.3, mvHit:'1→2-3',  mvMiss:'1→2',   rapid:'並' },
    { name:'バン',          stat:'int', kind:'超必殺',       dist:2, guts:42, dmg:['B',34], acc:['D',-11], gd:['D',16],   cr:['C',15],   moral:null, note:'',                              tHit:6.1, tMiss:4.8, mvHit:'2→3',    mvMiss:'2',     rapid:'並' },
    { name:'ビッグバン',    stat:'int', kind:'超必殺',       dist:2, guts:46, dmg:['A',41], acc:['E',-17], gd:['C',23],   cr:['B',22],   moral:null, note:'バン50回',                      tHit:6.8, tMiss:5.1, mvHit:'2→3',    mvMiss:'2',     rapid:'並' },
    { name:'ワン・ツー',    stat:'pow', kind:'バランス',     dist:2, guts:15, dmg:['D',12], acc:['S',15],  gd:null,       cr:['E',5],    moral:null, note:'セピアリエーヴル固有',          tHit:5.1, tMiss:3.5, mvHit:'2→2-3',  mvMiss:'2',     rapid:'並' },
    { name:'影爪',          stat:'pow', kind:'命中',         dist:2, guts:25, dmg:['D',15], acc:['S',15],  gd:['E',5],    cr:['E',5],    moral:null, note:'ファー固有',                    tHit:4.8, tMiss:2.3, mvHit:'2→2-3',  mvMiss:'2→2-3', rapid:'並' },
    { name:'デスファイナル',stat:'pow', kind:'超必殺',       dist:2, guts:52, dmg:['A',44], acc:['E',-18], gd:['A',44],   cr:['E',5],    moral:null, note:'リリム固有',                    tHit:4.1, tMiss:4.1, mvHit:'2',      mvMiss:'2',     rapid:'並' },
    { name:'サンダー',      stat:'int', kind:'命中',         dist:3, guts:16, dmg:['E',9],  acc:['A',13],  gd:['E',5],    cr:['E',3],    moral:null, note:'',                              tHit:2.1, tMiss:2.1, mvHit:'3',      mvMiss:'3',     rapid:'強' },
    { name:'ライトニング',  stat:'int', kind:'命中',         dist:3, guts:25, dmg:['D',16], acc:['A',12],  gd:['E',5],    cr:['E',5],    moral:null, note:'サンダー50回',                  tHit:4.8, tMiss:2.1, mvHit:'3→4-5',  mvMiss:'3',     rapid:'強' },
    { name:'なげキッス',    stat:'int', kind:'ガッツダウン', dist:3, guts:18, dmg:null,     acc:['B',2],   gd:['C',25],   cr:['E',8],    moral:null, note:'',                              tHit:3.1, tMiss:2.3, mvHit:'3',      mvMiss:'3',     rapid:'強' },
    { name:'ドレイン',      stat:'int', kind:'超必殺',       dist:3, guts:40, dmg:['C',20], acc:['D',-10], gd:null,       cr:null,       moral:-50,  note:'ライフドレイン率100%',          tHit:3.1, tMiss:3.1, mvHit:'3',      mvMiss:'3',     rapid:'並' },
    { name:'リフレッシュ',  stat:'int', kind:'超必殺',       dist:3, guts:50, dmg:null,     acc:['E',-20], gd:null,       cr:null,       moral:50,   note:'回復力30(B)',                   tHit:4.1, tMiss:3.5, mvHit:'3',      mvMiss:'3',     rapid:'並' },
    { name:'ファイアブレス',stat:'int', kind:'超必殺',       dist:3, guts:49, dmg:['A',45], acc:['D',-14], gd:['D',19],   cr:['E',8],    moral:null, note:'ダイナ固有',                    tHit:2.8, tMiss:2.5, mvHit:'3',      mvMiss:'3→3-4', rapid:'並' },
    { name:'フレイム',      stat:'int', kind:'大ダメージ',   dist:4, guts:19, dmg:['C',24], acc:['E',-15], gd:['D',11],   cr:['E',5],    moral:null, note:'ユキは修行で修得不可',          tHit:2.8, tMiss:2.5, mvHit:'4',      mvMiss:'4',     rapid:'並' },
    { name:'ギガフレイム',  stat:'int', kind:'大ダメージ',   dist:4, guts:30, dmg:['B',39], acc:['E',-19], gd:['D',15],   cr:['E',5],    moral:-20,  note:'フレイム50回、ユキは修得不可',  tHit:6.8, tMiss:4.5, mvHit:'4→4-5',  mvMiss:'4',     rapid:'並' },
    { name:'レイ',          stat:'int', kind:'クリティカル', dist:4, guts:17, dmg:['D',12], acc:['C',-3],  gd:['E',5],    cr:['C',16],   moral:null, note:'',                              tHit:2.3, tMiss:2.1, mvHit:'4',      mvMiss:'4',     rapid:'並' },
    { name:'メガレイ',      stat:'int', kind:'クリティカル', dist:4, guts:29, dmg:['D',19], acc:['C',-4],  gd:['E',5],    cr:['B',21],   moral:null, note:'レイ50回',                      tHit:5.8, tMiss:4.1, mvHit:'4→4-5',  mvMiss:'4',     rapid:'並' },
    { name:'ギガレイ',      stat:'int', kind:'クリティカル', dist:4, guts:34, dmg:['C',25], acc:['D',-8],  gd:['E',5],    cr:['S',32],   moral:20,   note:'メガレイ50回',                  tHit:6.1, tMiss:4.5, mvHit:'4→4-5',  mvMiss:'4',     rapid:'並' },
  ],
};
