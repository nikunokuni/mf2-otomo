/* ===========================================================
   エサのデータ
   -----------------------------------------------------------
   調整ローテの「毎月のエサ」で使う。

   ・ストレス / 恐れ度 / 甘え度 は、そのモンスターの好き嫌いで値が変わる
   ・体型 と 買値 は好き嫌いに関係なく同じ
   ・どのエサが好きかはモンスターごとに違うので、ユーザーが入力する
     （モンスタータブ「エサの好き嫌い」→ mon.feedLike）

   ★name は保存データのキーです（mon.feedLike のキーになる）。
     表記を1文字でも変えると、そのエサの好き嫌いの記録が読めなくなります★

   内部数値のキーは js/data/items.js の INNER と同じ
     stress ストレス / fear 恐れ度 / spoil 甘え度 / form 体型
   =========================================================== */

/** 好き嫌いの3段階。キーは保存データに入るので変えないこと */
export const LIKING = [
  ['like', '好き'],
  ['normal', '普通'],
  ['dislike', '嫌い'],
];

export const LIKING_LABEL = Object.fromEntries(LIKING);

/** 好き嫌いが入っていないときに使う段階 */
export const DEFAULT_LIKING = 'normal';

export const FEEDS = [
  {
    name: 'ジャガもどき',
    form: -1,
    price: 10,
    like: { stress: 0, fear: 0, spoil: 1 },
    normal: { stress: 4, fear: 3, spoil: -4 },
    dislike: { stress: 16, fear: 4, spoil: -10 },
  },
  {
    name: 'ミルクもどき',
    form: 1,
    price: 50,
    like: { stress: -3, fear: 0, spoil: 3 },
    normal: { stress: -2, fear: 0, spoil: 1 },
    dislike: { stress: 4, fear: -4, spoil: -4 },
  },
  {
    name: 'サカナもどき',
    form: 2,
    price: 100,
    like: { stress: -6, fear: 0, spoil: 3 },
    normal: { stress: -3, fear: 0, spoil: 2 },
    dislike: { stress: 2, fear: 1, spoil: -2 },
  },
  {
    name: 'ゼリーもどき',
    form: -3,
    price: 150,
    like: { stress: -7, fear: 1, spoil: 2 },
    normal: { stress: -5, fear: 1, spoil: 1 },
    dislike: { stress: 1, fear: 1, spoil: -1 },
  },
  {
    name: 'ニクもどき',
    form: 6,
    price: 300,
    like: { stress: -8, fear: 0, spoil: 6 },
    normal: { stress: -6, fear: 0, spoil: 4 },
    dislike: { stress: 0, fear: 1, spoil: 1 },
  },
  {
    name: 'ビタミンもどき',
    form: 3,
    price: 500,
    like: { stress: -15, fear: 2, spoil: 6 },
    normal: { stress: -13, fear: 2, spoil: 1 },
    dislike: { stress: -10, fear: 2, spoil: -1 },
  },
];

/**
 * そのモンスターの好き嫌いを当てはめた、エサ1つぶんの実際の効果。
 * 体型は好き嫌いに関係ないので、そのまま混ぜて返す。
 */
export function feedEffect(feed, liking) {
  const base = feed[liking] || feed[DEFAULT_LIKING];
  return { ...base, form: feed.form };
}
