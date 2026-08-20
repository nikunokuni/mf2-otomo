/* ===========================================================
   調整ローテの計算（画面に依存しない純粋な計算だけを置く）
   -----------------------------------------------------------
   1週ずつ、内部数値がどう動くかを追いかける。

   1週のなかの順番
     1. 月初め（第1週）なら エサ → 双子の水差し
     2. その週に使ったアイテム
     3. その週の行動（js/data/acts.js）
     4. その週にかかる寿命

   修行と冒険は「4週まとめて出かける」ひとかたまり
     修行 出かける週にはエサもアイテムも間に合う（先にエサをあげてから出かける）。
          2〜4週目はエサもアイテムも無し。疲労とストレスは毎週たまる
     冒険 出かける週にエサは間に合うが、アイテムは使えない。
          出かけているあいだは何も起きず、体調値も出さない。
          疲労+70 は帰ってきた週にまとめて乗る
     どちらも、帰ってきた週からはふつうにアイテムを使えて行動も選べる

   寿命の減り方は2本立て（js/data/acts.js）
     A 週経過ぶん … 1週たてば寿命が1週減る。暦も1週進む
                    （冒険の4週だけは、暦は進むが寿命に数えない）
     B 追加ぶん   … 週経過に加えてかかるぶん。暦は進まない。
                    体調値ぶんと、イベントぶんの両方がかかる
   ★体調値の表は週経過ぶんを含んだ合計なので、追加ぶんは「表の値 − 1」★
     体調値69以下なら追加は0（減るのは週経過ぶんだけ）。

   疲労0・ストレス0から始めた場合、育成計画の EV_COST と一致する
     大会 1 + 体調値0 + ベース3 = -4
     修行 4週ぶんの週経過と体調値ぶん（0+0+1+2）で -7
     冒険 週経過なし + 冒険ぶん2 = -2

   ★ゲーム内の計算は、途中で小数点以下を切り捨てる★
     割合の効果は pctDelta() を通す（js/simulator/inner-calc.js）。
   =========================================================== */

import { ITEMS } from '../data/items.js';
import { FEEDS, DEFAULT_LIKING, feedEffect } from '../data/feeds.js';
import {
  TRAIN_LIGHT,
  TRAIN_HEAVY,
  TRAINING_CAMP,
  TRAINING_CAMP_WEEKS,
  ADVENTURE,
  ADVENTURE_WEEKS,
  REST,
  REST_FORM,
  REST_SPOIL,
  tournamentFatigue,
  conditionValue,
  conditionExtra,
  tournamentBase,
  WEEK_AGE,
  EVENT_LIFE,
} from '../data/acts.js';
import { clampInner, pctDelta } from './inner-calc.js';

/** 1か月は4週 */
export const WEEKS_PER_MONTH = 4;

/** 月初めに効く持ち物。個数ぶん重なる */
export const JUG_NAME = '双子の水差し';

const ITEM_BY_NAME = Object.fromEntries(ITEMS.map((i) => [i.name, i]));
const FEED_BY_NAME = Object.fromEntries(FEEDS.map((f) => [f.name, f]));

/** 調整ローテの週番号（0はじまり）から、何か月目か（0はじまり） */
export function monthOf(weekIdx) {
  return Math.floor(weekIdx / WEEKS_PER_MONTH);
}

/** その週が月初め（第1週）かどうか */
export function isMonthStart(weekIdx) {
  return weekIdx % WEEKS_PER_MONTH === 0;
}

/** 「2か月目 第3週」の形 */
export function weekLabel(weekIdx) {
  return `${monthOf(weekIdx) + 1}か月目 第${(weekIdx % WEEKS_PER_MONTH) + 1}週`;
}

/** 週数から、必要な月の数 */
export function monthCount(weekCount) {
  return Math.max(1, Math.ceil(weekCount / WEEKS_PER_MONTH));
}

/**
 * 内部数値のかたまりに、足し引きと割合をまとめて当てる。
 * 割合を先に当てる（同じキーに両方が乗るアイテムはいまのところ無い）。
 * times は双子の水差しのように「持っている数だけ重なる」ぶんの倍率。
 */
function applyInner(values, { inner, innerPct } = {}, initMoral, times = 1) {
  const next = { ...values };
  if (innerPct) {
    Object.entries(innerPct).forEach(([key, pct]) => {
      if (next[key] === undefined) return;
      next[key] = clampInner(key, next[key] + pctDelta(next[key], pct) * times, initMoral);
    });
  }
  if (inner) {
    Object.entries(inner).forEach(([key, delta]) => {
      if (next[key] === undefined) return;
      next[key] = clampInner(key, next[key] + delta * times, initMoral);
    });
  }
  return next;
}

/** エサ1回ぶん。好き嫌いはモンスターごと（mon.feedLike） */
export function applyFeed(values, feedName, liking, initMoral) {
  const feed = FEED_BY_NAME[feedName];
  if (!feed) return { ...values };
  const e = feedEffect(feed, liking || DEFAULT_LIKING);
  return applyInner(values, { inner: e }, initMoral);
}

/** 双子の水差し。持っている数だけ重なる */
export function applyJugs(values, count, initMoral) {
  const jug = ITEM_BY_NAME[JUG_NAME];
  if (!jug || !jug.monthly || count <= 0) return { ...values };
  return applyInner(values, jug.monthly, initMoral, count);
}

/** アイテム1個ぶん。種族条件つきの効果は、種族が合ったときだけ乗る */
export function applyItem(values, itemName, initMoral, species) {
  const item = ITEM_BY_NAME[itemName];
  if (!item || item.kind !== 'use') return { ...values };
  let next = applyInner(values, item, initMoral);
  (item.conditional || []).forEach((c) => {
    if (c.species && !c.species.includes(species)) return;
    next = applyInner(next, c, initMoral);
  });
  return next;
}

/**
 * 行動1回ぶん。
 *   act   'light:N' / 'heavy:N' / 'rest' / 'mc' / 'ac' / 'tc:win' / 'tc:mid' / 'tc:last'
 *   stage 成長段階のキー（休養の効き方が変わる）
 * 大会だけは、そのときの体型で疲労が変わり、そのあとストレスが0になる。
 */
export function applyAct(values, act, initMoral, stage = 's1') {
  if (!act) return { ...values };

  if (act.startsWith('tc:')) {
    const rank = act.slice(3);
    const next = applyInner(
      values,
      { inner: { fatigue: tournamentFatigue(rank, values.form) } },
      initMoral
    );
    // 大会のあとはストレス0
    next.stress = clampInner('stress', 0, initMoral);
    return next;
  }

  if (act === 'rest') {
    const r = REST[stage] || REST.s1;
    return applyInner(
      values,
      { inner: { ...r, form: REST_FORM, spoil: REST_SPOIL } },
      initMoral
    );
  }

  // 冒険は出かけている週には何も起きない。疲労は帰ってきた週に simulate() が乗せる
  if (act === 'ac') return { ...values };

  // 修行は出かけているあいだ、毎週たまる
  if (act === 'mc') return applyInner(values, { inner: TRAINING_CAMP }, initMoral);

  if (act.startsWith('light:')) return applyInner(values, { inner: TRAIN_LIGHT }, initMoral);
  if (act.startsWith('heavy:')) return applyInner(values, { inner: TRAIN_HEAVY }, initMoral);

  return { ...values };
}

/**
 * 調整ローテを1週ずつたどる。
 *
 *   start     開始時点の内部数値（mon.rota.start）
 *   weeks     [{ item, act }, ...]（mon.rota.weeks）
 *   feeds     月ごとのエサ名（mon.rota.feeds[何か月目]）
 *   jugs      双子の水差しの所持数
 *   feedLike  エサ名 → 'like' / 'normal' / 'dislike'
 *   initMoral そのモンスターの初期ヨイワル（動ける範囲を決める）
 *   species   種族名（種族条件つきの効果の判定に使う）
 *
 * 戻り値は週ごとの行。values はその週が終わった時点の内部数値。
 */
/** 4週まとめて出かける行動と、その週数 */
const BLOCK_WEEKS = { mc: TRAINING_CAMP_WEEKS, ac: ADVENTURE_WEEKS };

/** その行動が「4週まとめて出かける」ものかどうか */
export function isBlockAct(act) {
  return Object.prototype.hasOwnProperty.call(BLOCK_WEEKS, act);
}

/** その行動が何週ぶんのかたまりか（かたまりでなければ1） */
export function blockWeeksOf(act) {
  return BLOCK_WEEKS[act] || 1;
}

export function simulate({ start, weeks, feeds, jugs, feedLike, initMoral, species, stage }) {
  let values = { ...start };
  // いま出かけている最中のかたまり { kind, start, end }
  let block = null;

  return weeks.map((w, i) => {
    // かたまりが終わった。冒険なら、帰ってきたこの週に疲労がまとめて乗る
    let returned = false;
    if (block && i > block.end) {
      if (block.kind === 'ac') {
        values = applyInner(values, { inner: { fatigue: ADVENTURE.fatigue } }, initMoral);
        returned = true;
      }
      block = null;
    }

    // 新しく出かける週か
    const blockStart = !block && isBlockAct(w.act);
    if (blockStart) block = { kind: w.act, start: i, end: i + BLOCK_WEEKS[w.act] - 1 };

    const kind = block ? block.kind : null;
    const inBlock = !!block;
    const blockEnd = inBlock && i === block.end;
    const adventuring = kind === 'ac';
    const camping = kind === 'mc';

    // エサは月初めに1回。出かける週なら、出かける前にあげられる。
    // 出かけている途中（2〜4週目）はあげられない
    const monthStart = isMonthStart(i);
    const canFeed = monthStart && (!inBlock || blockStart);
    const feedName = canFeed ? feeds[monthOf(i)] || '' : '';
    if (canFeed) {
      values = applyFeed(values, feedName, feedLike && feedLike[feedName], initMoral);
      values = applyJugs(values, jugs, initMoral);
    }

    // アイテムは、冒険では使えない。修行は出かける週だけ使える
    const canItem = !inBlock || (camping && blockStart);
    if (canItem) values = applyItem(values, w.item, initMoral, species);

    // 行動。冒険で出かけているあいだは何も起きない
    if (!adventuring) values = applyAct(values, w.act, initMoral, stage);

    // 体調値。冒険で出かけているあいだだけ出さない
    const condition = adventuring ? null : conditionValue(values.fatigue, values.stress);

    // A 週経過ぶん。冒険の4週だけは、暦は進むが寿命に数えない
    const ageWeeks = adventuring ? 0 : WEEK_AGE;

    // B 追加ぶん = 体調値ぶん ＋ イベントぶん
    //   体調値の表は週経過ぶんを含んだ合計なので、追加ぶんは conditionExtra() で出す
    let fromCondition = 0;
    let fromEvent = 0;
    if (adventuring) {
      // 体調値は出さない。冒険ぶんを出発の週に1回
      fromEvent = blockStart ? EVENT_LIFE.ac.extra : 0;
    } else {
      // 修行も、出かけているあいだ毎週ぶん体調値で減る（修行そのものの追加は無い）
      fromCondition = conditionExtra(condition);
      // 大会のベースは -3。大会後の疲労が70を越えていると倍の -6
      if (w.act && w.act.startsWith('tc:')) fromEvent = tournamentBase(values.fatigue);
    }
    const extraLife = fromCondition + fromEvent;

    return {
      weekIdx: i,
      monthStart,
      feed: feedName,
      item: canItem ? w.item || '' : '',
      act: w.act || '',
      blockKind: kind,
      blockStart,
      blockEnd,
      adventuring,
      camping,
      returned,
      canFeed,
      canItem,
      values: { ...values },
      condition,
      ageWeeks,
      fromCondition,
      fromEvent,
      extraLife,
      lifeCost: ageWeeks + extraLife,
    };
  });
}

/** 冒険で出かけている週数（体調値を数えていない週） */
export function adventureWeeks(rows) {
  return rows.filter((r) => r.adventuring).length;
}

/**
 * 寿命の減りの合計。内訳もいっしょに返す。
 *   age   週経過ぶん（A）
 *   extra 追加ぶん（B）
 *   total 合計
 * アイテムで進む寿命（agePlus）はここには入れない。
 */
export function lifeTotals(rows) {
  const age = rows.reduce((sum, r) => sum + r.ageWeeks, 0);
  const extra = rows.reduce((sum, r) => sum + r.extraLife, 0);
  return { age, extra, total: age + extra };
}

/** その調整ローテで寿命がどれだけ進むか（アイテムの agePlus の合計） */
export function totalAgePlus(weeks) {
  return weeks.reduce((sum, w) => {
    const item = ITEM_BY_NAME[w.item];
    return sum + (item && item.agePlus ? item.agePlus : 0);
  }, 0);
}

/** エサ代の合計（月ごとに1回ぶん） */
export function totalFeedPrice(feeds, weekCount) {
  let sum = 0;
  for (let m = 0; m < monthCount(weekCount); m += 1) {
    const feed = FEED_BY_NAME[feeds[m]];
    if (feed) sum += feed.price;
  }
  return sum;
}
