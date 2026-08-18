/* ===========================================================
   アイテムデータ
   -----------------------------------------------------------
   早見タブの「アイテム」と、育成計算タブの「アイテム」に出る。
   ユーザーが自分で足したぶんは state.items に入るので、ここは触らない。

   ★ゲーム内の計算は、途中で小数点以下を切り捨てる★
     「ストレス-50%」のような割合を計算に使うときは、この切り捨てに合わせること。

   -----------------------------------------------------------
   1件ぶんの形

   name    アイテム名
   kind    'use'  … 使うと無くなる（1週間にアイテム1個 + 行動1回が両方できる）
           'hold' … 持っているだけで効く。持っている数だけ効果が重なる
   effect  画面に出す説明の文章。数値と食い違わないように、直したら両方直すこと

   inner       内部数値の増減（そのまま足す）
   innerPct    内部数値の増減（そのときの値に対する％。切り捨て）
   stat        パラメーター（ライフ〜丈夫さ）の増減
   statPctWeekly 効果が続くあいだ、毎週そのときの値に対する％（切り捨て）
   weeks       効果が続く週数。この間かけて stat のぶん上がり、そのあとも残る
   agePlus     寿命が進む週数（寿命そのものは減らない。そのぶん歳を取る）
   conditional 種族が合ったときだけ乗る効果
   monthly     kind:'hold' のとき、月初めに毎月かかる効果

   内部数値のキー: fatigue 疲労 / stress ストレス / fear 恐れ度 /
                   spoil 甘え度 / form 体型 / fame 人気 / moral ヨイワル
   パラメーターのキーは js/data/growth.js の SK と同じ
     life ライフ / pow ちから / int かしこさ / hit 命中 / avo 回避 / tou 丈夫さ
   =========================================================== */

/**
 * 内部数値の範囲と初期値。
 * ヨイワルだけはモンスターごとに初期値が違い、さらに初期値から±100までしか動かない。
 * （初期値-90のモンスターなら -100〜+10 が動ける範囲）
 * 実際の下限・上限は moralRange() で出す。
 */
export const INNER = {
  fatigue: { label: '疲労', min: 0, max: 100, init: 0 },
  stress: { label: 'ストレス', min: 0, max: 100, init: 0 },
  fear: { label: '恐れ度', min: 0, max: 100, init: 0 },
  spoil: { label: '甘え度', min: 0, max: 100, init: 0 },
  form: { label: '体型', min: -100, max: 100, init: 0 },
  fame: { label: '人気', min: 0, max: 100, init: 0 },
  moral: { label: 'ヨイワル', min: -100, max: 100, init: 0 },
};

export const ITEMS = [
  {
    name: 'カララギマンゴー',
    kind: 'use',
    effect: '疲労-10 / 恐れ度+1 / 甘え度+1 / 体型+1',
    inner: { fatigue: -10, fear: 1, spoil: 1, form: 1 },
  },
  {
    name: '夏見草',
    kind: 'use',
    effect: 'ストレス-50% / 甘え度-2 / 体型-5',
    innerPct: { stress: -50 },
    inner: { spoil: -2, form: -5 },
  },
  {
    name: 'オイリーオイル',
    kind: 'use',
    effect:
      '疲労-28 / 恐れ度+1 / 甘え度+1 / ストレス-20%（デュラハン・アローヘッド・ヘンガーのときだけ）',
    inner: { fatigue: -28, fear: 1, spoil: 1 },
    conditional: [
      { species: ['デュラハン', 'アローヘッド', 'ヘンガー'], innerPct: { stress: -20 } },
    ],
  },
  {
    name: 'ソンナバナナ',
    kind: 'use',
    effect: 'ストレス-10 / 恐れ度+10 / 甘え度+10 / 体型-1',
    inner: { stress: -10, fear: 10, spoil: 10, form: -1 },
  },
  {
    name: 'バリアメ',
    kind: 'use',
    effect: 'ストレス-2 / 甘え度+1 / 体型+10',
    inner: { stress: -2, spoil: 1, form: 10 },
  },
  {
    name: '冬虫散',
    kind: 'use',
    effect: '疲労+5 / 体型-24',
    inner: { fatigue: 5, form: -24 },
  },
  {
    name: 'カクテルグミ',
    kind: 'use',
    effect: 'ヨイワル-5 / 体型+5',
    inner: { moral: -5, form: 5 },
  },
  {
    name: 'フルーツグミ',
    kind: 'use',
    effect: 'ヨイワル+5 / 体型+5',
    inner: { moral: 5, form: 5 },
  },
  {
    name: 'スタープルーン',
    kind: 'use',
    effect: '甘え度+5 / 体型+1 / 人気+20',
    inner: { spoil: 5, form: 1, fame: 20 },
  },
  {
    name: 'トロロン',
    kind: 'use',
    effect: '4週間かけて ちから+10 命中+5（そのあとも残る） / 寿命が6週進む',
    weeks: 4,
    stat: { pow: 10, hit: 5 },
    agePlus: 6,
  },
  {
    name: 'パラドクシン',
    kind: 'use',
    effect:
      '4週間かけて ちから+30 命中+30（そのあとも残る）、そのあいだ毎週 回避と丈夫さ-10% / 寿命が18週進む',
    weeks: 4,
    stat: { pow: 30, hit: 30 },
    statPctWeekly: { avo: -10, tou: -10 },
    agePlus: 18,
  },
  {
    name: 'ラロックス',
    kind: 'use',
    effect: 'ちからと丈夫さ+10 / ライフ-10 / 寿命が4週進む',
    stat: { pow: 10, tou: 10, life: -10 },
    agePlus: 4,
  },
  {
    name: '万精丹',
    kind: 'use',
    effect: 'ライフと命中+10 / 回避-10 / 寿命が5週進む',
    stat: { life: 10, hit: 10, avo: -10 },
    agePlus: 5,
  },
  {
    name: 'おこり草',
    kind: 'use',
    effect: '疲労+10 / ストレス+15 / 体型-1',
    inner: { fatigue: 10, stress: 15, form: -1 },
  },
  {
    name: 'ないちゃい草',
    kind: 'use',
    effect: '疲労+10 / ストレス-40% / 体型-1',
    inner: { fatigue: 10, form: -1 },
    innerPct: { stress: -40 },
  },
  {
    name: '双子の水差し',
    kind: 'hold',
    effect: '持っているあいだ、月初めに ストレス-1 / 恐れ度+1（持っている数だけ効く）',
    monthly: { inner: { stress: -1, fear: 1 } },
  },
];
