/* ===========================================================
   調整ローテの計算（画面に依存しない純粋な計算だけを置く）
   -----------------------------------------------------------
   1週ずつ、内部数値がどう動くかを追いかける。

   1週のなかの順番
     ・月初め（第1週）のときだけ
         1. エサ（その月に選んだもの。好き嫌いで効き方が変わる）
         2. 双子の水差し（持っている数だけ重なる）
     ・そのあと、その週に使ったアイテム
     ・そのあと、その週の行動（js/data/acts.js）
         軽トレ 疲労+10 ストレス+5 ／ 重トレ 疲労+15 ストレス+12
         修行   1週ぶん 疲労+18 ストレス+7（4週で +72 / +28）
         冒険   疲労+70 ストレス0
         休養   成長段階ごと。体型+5
         大会   疲労は体型で変わる。大会後はストレス0
     ・最後に、その週が終わった時点の体調値（疲労+ストレス×2）から
       その週に減る寿命を出す

   ★ゲーム内の計算は、途中で小数点以下を切り捨てる★
     割合の効果は pctDelta() を通す（js/simulator/inner-calc.js）。
   =========================================================== */

import { ITEMS } from '../data/items.js';
import { FEEDS, DEFAULT_LIKING, feedEffect } from '../data/feeds.js';
import {
  TRAIN_LIGHT,
  TRAIN_HEAVY,
  TRAINING_CAMP,
  ADVENTURE,
  REST,
  REST_FORM,
  REST_SPOIL,
  tournamentFatigue,
  conditionValue,
  lifeLoss,
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

  const table = {
    mc: TRAINING_CAMP,
    ac: ADVENTURE,
  };
  if (table[act]) return applyInner(values, { inner: table[act] }, initMoral);

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
export function simulate({ start, weeks, feeds, jugs, feedLike, initMoral, species, stage }) {
  let values = { ...start };
  return weeks.map((w, i) => {
    const monthStart = isMonthStart(i);
    const feedName = monthStart ? feeds[monthOf(i)] || '' : '';

    if (monthStart) {
      values = applyFeed(values, feedName, feedLike && feedLike[feedName], initMoral);
      values = applyJugs(values, jugs, initMoral);
    }
    values = applyItem(values, w.item, initMoral, species);
    values = applyAct(values, w.act, initMoral, stage);

    const condition = conditionValue(values.fatigue, values.stress);
    return {
      weekIdx: i,
      monthStart,
      feed: feedName,
      item: w.item || '',
      act: w.act || '',
      values: { ...values },
      condition,
      lifeLoss: lifeLoss(condition),
    };
  });
}

/** 体調値で減る寿命の合計（アイテムで進む寿命とは別） */
export function totalLifeLoss(rows) {
  return rows.reduce((sum, r) => sum + r.lifeLoss, 0);
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
