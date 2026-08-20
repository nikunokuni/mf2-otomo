/* ===========================================================
   行動（トレーニング・休養・大会・修行・冒険）のデータ
   -----------------------------------------------------------
   調整ローテの「毎週の行動」で使う。動くのは 疲労 と ストレス が中心。

   ★休養は幅のある値だが、いちばん減らない側（最低値）で計算する★
     例: 第1段階の疲労は -36〜-39 → -36 を使う。
     甘え度も 0〜+6 と幅があるので、同じ考えで 0（動かさない）。

   ★大会のあとはストレス0★
     もとの表では「-45以上」などと書かれているが、
     実際には大会後はストレス0とみなしてよい。
     （要求なし・おねだり持ちは例外だが、そこは見ていない）

   成長段階のキーは js/data/growth.js の SKEYS と同じ
     s1〜s4 / peak / prepeak / s5〜s8
   =========================================================== */

/** 軽トレーニング1回ぶん */
export const TRAIN_LIGHT = { fatigue: 10, stress: 5 };

/** 重トレーニング1回ぶん */
export const TRAIN_HEAVY = { fatigue: 15, stress: 12 };

/**
 * 修行の1週ぶん。修行は4週まとめて出かける。
 * 4週で 疲労+72 / ストレス+28（もとの表の「修行合計」と一致する）。
 * 出かけているあいだ（2〜4週目）はエサもアイテムも無し。
 */
export const TRAINING_CAMP = { fatigue: 18, stress: 7 };

/** 修行に出ている週数 */
export const TRAINING_CAMP_WEEKS = 4;

/**
 * 冒険。4週まとめて出かける。
 * 疲労+70 は「合計」で、**帰ってきた週**（4週のあとの週）にまとめて乗る。
 * 出かけているあいだは体調値を出さない（＝そのぶんの寿命も数えない）。
 * ストレスは動かない。
 */
export const ADVENTURE = { fatigue: 70, stress: 0 };

/** 冒険に出ている週数 */
export const ADVENTURE_WEEKS = 4;

/** 休養。成長段階ごとに効き方が違う。値は最低値（いちばん減らない側） */
export const REST = {
  s1: { fatigue: -36, stress: -5 },
  s2: { fatigue: -38, stress: -5 },
  s3: { fatigue: -40, stress: -5 },
  s4: { fatigue: -42, stress: -7 },
  peak: { fatigue: -44, stress: -9 },
  prepeak: { fatigue: -44, stress: -9 },
  s5: { fatigue: -40, stress: -5 },
  s6: { fatigue: -32, stress: -5 },
  s7: { fatigue: -32, stress: -5 },
  s8: { fatigue: -32, stress: -5 },
};

/** 休養の体型変化。成長段階に関係なく同じ */
export const REST_FORM = 5;

/** 休養の甘え度。もとは 0〜+6 ぐらいの幅。最低値をとって動かさない */
export const REST_SPOIL = 0;

/**
 * 大会。疲労は体型で変わる。
 *   疲労 = base + 切り捨て(体型 / formDiv)
 * 例: 優勝で体型-100 なら 30 + 切り捨て(-7.69) = 30 - 7 = 23
 *     優勝で体型+100 なら 30 + 切り捨て(+7.69) = 30 + 7 = 37
 * ストレスは、結果に関係なく大会後は0になる。
 */
export const TOURNAMENT = {
  win: { label: '優勝', base: 30, formDiv: 13 },
  mid: { label: '他', base: 40, formDiv: 10 },
  last: { label: 'ビリ', base: 50, formDiv: 8 },
};

/** 大会の疲労。体型で変わる */
export function tournamentFatigue(rank, form) {
  const t = TOURNAMENT[rank];
  if (!t) return 0;
  return t.base + Math.trunc(form / t.formDiv);
}

/** 体調値 = 疲労 + ストレス×2 */
export function conditionValue(fatigue, stress) {
  return fatigue + stress * 2;
}

/* ===========================================================
   寿命の減り方は2本立て
   -----------------------------------------------------------
   A 週経過ぶん … 1週たてば、それだけで寿命が1週減る。暦も1週進む。
   B 追加ぶん   … 週経過に「加えて」かかるぶん。暦は進まない。
                  体調値ぶんと、イベントぶんの両方がかかる。

   ★体調値の表は「週経過ぶんを含んだ」1週ぶんの合計★
     体調値が69以下なら -1、つまり寿命が減るのは週経過ぶんだけで、
     体調値ぶんの追加は無い。追加ぶんは「表の値 − 週経過ぶん」。

   イベントごとの決まりごと
     大会 週経過1 ＋ 体調値ぶん ＋ 大会のベース（-3。疲労が70を越えると倍の-6）
          疲労0・ストレス0で出れば 1 + 0 + 3 = -4（EV_COST.tc と一致）
     修行 週経過4 ＋ 毎週の体調値ぶん。修行そのものの追加は無い
          疲労0・ストレス0から出れば合計 -7（EV_COST.mc と一致）
     冒険 週経過0（4週たつが、ここだけ寿命に数えない）＋ 冒険ぶん-2
          出かけているあいだは体調値を出さないので -2（EV_COST.ac と一致）
   =========================================================== */

/** 1週たつと、それだけで減る寿命（A） */
export const WEEK_AGE = 1;

/**
 * イベントそのものにかかるぶん（体調値ぶんとは別に、加えてかかる）。
 *   weeks    暦が進む週数
 *   ageWeeks そのうち寿命に数える週経過（冒険だけ0）
 *   extra    イベント1回まるごとでかかるぶん（大会だけは疲労で変わるので下の関数で出す）
 */
export const EVENT_LIFE = {
  tc: { weeks: 1, ageWeeks: 1, extra: 3 },
  // 修行は体調値ぶんだけ。修行そのものの追加は無い
  mc: { weeks: TRAINING_CAMP_WEEKS, ageWeeks: TRAINING_CAMP_WEEKS, extra: 0 },
  ac: { weeks: ADVENTURE_WEEKS, ageWeeks: 0, extra: 2 },
};

/** 大会のベースが倍になる疲労のしきい値（これを「越える」と倍） */
export const TOURNAMENT_HEAVY_FATIGUE = 70;

/**
 * 大会そのものにかかるぶん。
 * 出場だけで -3。ただし大会が終わった時点の疲労が70を越えていると倍の -6 になる。
 * （大会後はストレス0なので、このときの体調値は疲労と同じ数になる）
 */
export function tournamentBase(fatigueAfter) {
  return fatigueAfter > TOURNAMENT_HEAVY_FATIGUE ? EVENT_LIFE.tc.extra * 2 : EVENT_LIFE.tc.extra;
}

/**
 * 体調値から、その週に減る寿命。★週経過ぶんを含んだ合計★
 * 上限まで（max を含む）がその段。いちばん下の段は上限なし。
 */
export const CONDITION_LIFE = [
  { max: 69, life: 1 },
  { max: 104, life: 2 },
  { max: 139, life: 3 },
  { max: 174, life: 4 },
  { max: 209, life: 5 },
  { max: 244, life: 6 },
  { max: 269, life: 7 },
  { max: Infinity, life: 8 },
];

/** その体調値のときに1週で減る寿命（週経過ぶんを含んだ合計） */
export function lifeLoss(condition) {
  const row = CONDITION_LIFE.find((r) => condition <= r.max);
  return row ? row.life : 8;
}

/**
 * 体調値ぶんの追加だけ（週経過ぶんを除いたぶん）。
 * 体調値69以下なら0（減るのは週経過ぶんだけ）。
 */
export function conditionExtra(condition) {
  return Math.max(0, lifeLoss(condition) - WEEK_AGE);
}
