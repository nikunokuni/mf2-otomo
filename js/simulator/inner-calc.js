/* ===========================================================
   内部数値の計算（画面に依存しない純粋な計算だけを置く）
   -----------------------------------------------------------
   疲労 / ストレス / 恐れ度 / 甘え度 / 体型 / 人気 / ヨイワル の
   範囲の収め方と、割合の効果の切り捨て方をここに集める。

   ★ゲーム内の計算は、途中で小数点以下を切り捨てる★
   =========================================================== */

import { INNER } from '../data/items.js';

/**
 * ヨイワルが動ける範囲。
 * 全体では -100〜100 だが、そのモンスターの初期値から±100までしか動かない。
 * 例: 初期値 -90 のモンスターなら -100〜10。
 */
export function moralRange(initMoral) {
  const base = INNER.moral;
  return [Math.max(base.min, initMoral - 100), Math.min(base.max, initMoral + 100)];
}

/** 内部数値をその値が取れる範囲に収める。ヨイワルだけ初期値によって範囲が変わる */
export function clampInner(key, value, initMoral = 0) {
  const spec = INNER[key];
  if (!spec) return value;
  const [min, max] = key === 'moral' ? moralRange(initMoral) : [spec.min, spec.max];
  return Math.max(min, Math.min(max, value));
}

/**
 * 「ストレス-50%」のような割合の効果で、実際に動く量を返す。
 * 割合を出した時点で小数点以下を切り捨て、そのあとで足し引きする。
 *   pctDelta(75, -50) === -37  → 75 は 38 になる（37.5 を切り捨てて 37 引く）
 */
export function pctDelta(value, pct) {
  return Math.trunc((value * pct) / 100);
}

/** 割合の効果を当てて、範囲に収めた結果を返す */
export function applyPct(key, value, pct, initMoral = 0) {
  return clampInner(key, value + pctDelta(value, pct), initMoral);
}

/** 足し引きの効果を当てて、範囲に収めた結果を返す */
export function applyDelta(key, value, delta, initMoral = 0) {
  return clampInner(key, value + delta, initMoral);
}
