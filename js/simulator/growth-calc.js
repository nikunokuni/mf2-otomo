/* ===========================================================
   育成計算（画面に依存しない純粋な計算だけを置く）
   =========================================================== */

import {
  SK, SKEYS, STAGES, HEAVY4, LIGHT6, TRIP5, TRIP_SUB, TRIP_WEEKS,
  HM, HS, LG, MT, MS, GTH, EV_COST, EV_WEEKS, GOOD_BONUS, GOOD_MAX,
} from '../data/growth.js';
import { ITEMS } from '../data/items.js';

/**
 * 育成計画で回数を入れるアイテム＝使うと寿命が進むもの。
 * 減る寿命が大きい順に並べる（パラドクシンが先頭）。
 * items.js に agePlus 付きのアイテムを足せば、表の列も自動で増える。
 */
export const AGE_ITEMS = ITEMS.filter((item) => item.agePlus > 0).sort(
  (a, b) => b.agePlus - a.agePlus
);
const AGE_BY_NAME = Object.fromEntries(AGE_ITEMS.map((item) => [item.name, item.agePlus]));

/** 寿命 total 週のうち e 週目が、寿命全体の何%か */
export function getPct(total, elapsed) {
  return Math.floor(Math.floor((elapsed / total) * 1000) / 10);
}

/** 経過率から成長段階のインデックス（0〜9）を求める */
export function getStageIdx(pct, gtype) {
  const th = GTH[gtype];
  for (let i = 0; i < th.length; i++) {
    if (pct >= th[i][0] && pct <= th[i][1]) return i;
  }
  return 9;
}

/** 段階ごとの週数を数える */
export function calcStageWeeks(totalLife, gtype) {
  const weeks = new Array(10).fill(0);
  for (let i = 0; i < totalLife; i++) {
    weeks[getStageIdx(getPct(totalLife, i), gtype)]++;
  }
  return weeks;
}

/** 段階 si が始まる週（0始まり） */
export function stageStartWeek(baseWeeks, si) {
  let start = 0;
  for (let i = 0; i < si && i < baseWeeks.length; i++) start += baseWeeks[i];
  return start;
}

/**
 * 育成開始（startMonth月 startWeek週）から offset 週あとが、何月何週か。
 * 4週で1か月、12か月で1年。year は0から数えた経過年数。
 */
export function weekToDate(startMonth, startWeek, offset) {
  const total = (startMonth - 1) * 4 + (startWeek - 1) + offset;
  return {
    year: Math.floor(total / 48),
    month: (Math.floor(total / 4) % 12) + 1,
    week: (total % 4) + 1,
  };
}

/* ---------- 年齢の時間軸（桃で若返るぶんを含む） ---------- */

/** 桃の名前 */
export function peachName(pi) {
  return pi === 0 ? '黄金桃' : '白銀桃';
}

/**
 * 計画表の1行ぶん（セグメント）のキー。
 * ph は -1 が白（初めて通る年齢）、0/1 が黄金桃/白銀桃で戻ってたどり直す区間。
 * 同じ段階が何度も出てくるので、通し番号 n を付けて見分ける。
 */
export function segKey(ph, si, n) {
  return `${ph < 0 ? 'w' : 'p' + ph}-${si}-${n}`;
}

/** 行の見出しに出す名前（桃で戻った行には桃の名前を付ける） */
export function segLabel(seg) {
  return seg.ph < 0 ? STAGES[seg.si] : `${peachName(seg.ph)} ${STAGES[seg.si]}`;
}

/**
 * 年齢の時間軸をなぞって、計画表の行を時系列で並べる。
 *
 * 桃は「使用段階の開始＋桃の週数」の年齢で与えると、
 * ちょうどその段階の開始まで若返る。与えたあとは年齢だけ戻って暦は進み続けるので、
 * 一度通った年齢をもう一度たどることになる（＝黄色の行）。
 * 与えた年齢より先はまだ通っていないので、そこからは白い行に戻る。
 *
 * 桃を2つ使うと、片方の若返り区間の中でもう片方を与えることもある。
 * ここは年齢をそのまま1週ずつ進めているので、その並びもそのまま出る。
 *
 * 戻り値の1行ぶん:
 *   key     セグメントのキー（計画の保存先）
 *   si      成長段階     ph  白なら -1、桃で戻った区間なら桃の番号
 *   from    その行が始まる年齢の週   base 素の週数（年齢）
 *   peaches この行の直前に与える桃 [{ pi, age }]
 */
export function buildTimeline(sim) {
  const base = calcStageWeeks(sim.life, sim.gtype);
  const starts = base.map((_, i) => stageStartWeek(base, i));
  // 桃を与える年齢。使わない桃と、寿命を超えてしまう桃は発動しない
  const eat = [0, 1].map((pi) => {
    const p = sim.peach && sim.peach[pi];
    return p && p.use ? starts[p.si] + peachExtra(pi) : Infinity;
  });
  const stageOf = (age) => {
    let si = 0;
    while (si < 9 && age >= starts[si + 1]) si++;
    return si;
  };

  const segments = [];
  const seq = {};
  const used = [false, false];
  let age = 0;
  let maxAge = 0; // ここまでの年齢は一度通っている
  let ph = -1; // いまどの桃で戻ってたどり直しているか
  let cur = null;
  let pending = []; // 直前に与えた桃（行の前に見出しを出す）

  while (age < sim.life) {
    const pi = [0, 1].find((i) => !used[i] && age === eat[i]);
    if (pi !== undefined) {
      used[pi] = true;
      ph = pi;
      pending.push({ pi, age });
      age = starts[sim.peach[pi].si];
      cur = null;
      continue;
    }
    const si = stageOf(age);
    const phase = age < maxAge ? ph : -1; // 初めて通る年齢は白
    if (!cur || cur.si !== si || cur.ph !== phase) {
      const k = `${phase}-${si}`;
      seq[k] = seq[k] === undefined ? 0 : seq[k] + 1;
      cur = { key: segKey(phase, si, seq[k]), si, ph: phase, from: age, base: 0, peaches: pending };
      pending = [];
      segments.push(cur);
    }
    cur.base++;
    if (age + 1 > maxAge) maxAge = age + 1;
    age++;
  }
  return segments;
}

/** そのセグメントに組んであるセット */
function setsOfSeg(sim, key) {
  return (sim.plan && sim.plan[key]) || [];
}

/**
 * 計画表の行に、週数と暦の位置を足して返す。
 *
 * weeks    その行に使える週数（年齢）。寿命の消費が割当を超えたぶんは、
 *          時系列で次の行から引く
 * calStart その行が始まるのが、育成開始から数えて暦の何週目か。
 *          行は時系列に並んでいるので、実際に進む暦を積み上げるだけでよい
 * overflow 最後の行からもはみ出した週数（寿命が足りていない量）
 */
export function planLayout(sim) {
  const segments = buildTimeline(sim);
  let carry = 0;
  let cal = 0;
  segments.forEach((seg) => {
    const avail = seg.base - carry;
    seg.weeks = Math.max(0, avail);
    carry = Math.max(0, -avail);

    const sets = setsOfSeg(sim, seg.key);
    seg.sets = sets.length ? sets : [newSet(seg.weeks)];
    seg.calStart = cal;
    cal += seg.sets.reduce((a, set) => a + calendarWeeks(set), 0);
    carry += seg.sets.reduce((a, set) => a + setOverflow(set), 0);
  });
  return { segments, overflow: carry };
}

/** 桃で追加される週数（黄金桃 +50 / 白銀桃 +25） */
export function peachExtra(peachIndex) {
  return peachIndex === 0 ? 50 : 25;
}

export function newSet(weeks = 0) {
  // items は { アイテム名: 回数 }。使わないアイテムはキーごと持たない
  // mt は修行の場所（-1 は選んでいない）
  return { ht: -1, hc: 2, lt: -1, mt: -1, tc: 0, mc: 0, ac: 0, weeks, items: {} };
}

/**
 * そのセットで減る寿命の週数（イベント＋アイテム）。
 * 割当週から引くのはこちら。段階の週数は「年齢」なので、寿命の減りぶんだけ削られる。
 */
export function lifeCost(set) {
  const events =
    (set.tc || 0) * EV_COST.tc + (set.mc || 0) * EV_COST.mc + (set.ac || 0) * EV_COST.ac;
  const items = Object.entries(set.items || {}).reduce(
    (sum, [name, count]) => sum + (AGE_BY_NAME[name] || 0) * (Number(count) || 0),
    0
  );
  return events + items;
}

/** そのセットで実際にトレーニングできる週数 */
export function trainWeeks(set) {
  return (set.weeks || 0) - lifeCost(set);
}

/**
 * そのセットで実際に進む暦の週数。
 * トレーニングは1週で1週進む。イベントは減る寿命と進む週数が違い、
 * アイテムは寿命だけ進めて暦は進めない（その週にトレーニングもできる）。
 */
export function calendarWeeks(set) {
  return (
    Math.max(0, trainWeeks(set)) +
    (set.tc || 0) * EV_WEEKS.tc +
    (set.mc || 0) * EV_WEEKS.mc +
    (set.ac || 0) * EV_WEEKS.ac
  );
}

/** そのセットで、割当週からはみ出た寿命の消費 */
function setOverflow(set) {
  return Math.max(0, lifeCost(set) - (set.weeks || 0));
}

/**
 * 分かれた行や、桃で戻った行に引き継ぐ中身。
 * トレーニングの種類と回数だけを写し、イベントとアイテムの回数は写さない
 * （そのまま写すと、同じ寿命の消費を二重に数えてしまうため）。
 */
function inheritSet(src) {
  return Object.assign(newSet(0), { ht: src.ht, hc: src.hc, lt: src.lt, mt: src.mt });
}

/**
 * 寿命・成長タイプ・桃の設定を変えたあと、計画を行の並びに合わせ直す。
 *
 * - 行が増えたとき（段階が桃で前後に割れたときなど）は、同じ段階の直前の行から
 *   トレーニングの内容だけ引き継ぐ
 * - 2セット目以降に入力した週数はそのまま残し、余りを1セット目に寄せる
 * - 並びから消えた行の計画は落とす
 */
export function normalizePlan(sim) {
  const segments = buildTimeline(sim);
  const plan = {};
  const last = {}; // 段階ごとの直前の中身（引き継ぎ元）
  let carry = 0;

  segments.forEach((seg) => {
    const avail = seg.base - carry;
    const total = Math.max(0, avail);
    carry = Math.max(0, -avail);

    let sets = sim.plan && sim.plan[seg.key];
    if (!Array.isArray(sets) || !sets.length) {
      // 同じ桃の区間 → 白い行 の順で、同じ段階の中身を探す
      const src = last[`${seg.ph}-${seg.si}`] || last[`-1-${seg.si}`];
      sets = [src ? inheritSet(src) : newSet(0)];
    }
    const others = sets.slice(1).reduce((a, s) => a + (s.weeks || 0), 0);
    sets[0].weeks = Math.max(0, total - others);

    plan[seg.key] = sets;
    last[`${seg.ph}-${seg.si}`] = sets[0];
    carry += sets.reduce((a, s) => a + setOverflow(s), 0);
  });

  sim.plan = plan;
  return sim;
}

/** 得意なトレーニングかどうか（good はモンスタータブで選んだ得意の一覧） */
function isGood(good, key) {
  return Array.isArray(good) && good.includes(key);
}

/**
 * 上がるぶんに得意の +1 を乗せて、上限で止める。
 * 上限は成長段階や適正に関係なく 重トレ20 / 軽トレ15。
 */
function withGood(value, bonus, max) {
  return Math.min(max, value + bonus);
}

/**
 * 重トレ1回ぶんの上昇値。[{ key, value }] を主上昇・副上昇・減少の順で返す。
 * 主上昇は HM テーブルの4つの数字のうち3つ目を使う（計算も画面表示もここを見る）。
 * 得意な重トレなら、主上昇と副上昇の両方が +1 される（減るぶん -2 は変わらない）。
 * トレーニングを選んでいない（ti が -1）ときは空配列。
 */
export function heavyGain(ti, stageKey, apt, good) {
  const t = HEAVY4[ti];
  if (!t) return [];
  const bonus = isGood(good, `heavy:${ti}`) ? GOOD_BONUS : 0;
  return [
    { key: t.main, value: withGood(HM[stageKey][apt[t.main]][2], bonus, GOOD_MAX.heavy) },
    { key: t.sub, value: withGood(HS[stageKey][apt[t.sub]], bonus, GOOD_MAX.heavy) },
    { key: t.pen, value: -2 },
  ];
}

/**
 * 軽トレ1回ぶんの上昇値。LG テーブルの値＝上がりうる最大値。
 * 得意な軽トレなら +1（上限15）。
 */
export function lightGain(ti, stageKey, apt, good) {
  const t = LIGHT6[ti];
  if (!t) return [];
  const bonus = isGood(good, `light:${ti}`) ? GOOD_BONUS : 0;
  return [{ key: t.stat, value: withGood(LG[stageKey][apt[t.stat]], bonus, GOOD_MAX.light) }];
}

/**
 * 修行1週ぶんの上昇値。[{ key, value }] をメイン・サブ（ライフ）の順で返す。
 * 場所でメインのパラメータが変わり、サブは場所に関係なくライフ。
 * 表はどちらも5つの数字を持っていて、重トレと同じく3つ目を使う。
 * 得意な修行なら、メインとサブが毎週それぞれ +1 される（4週なので合わせて +8）。
 * 場所を選んでいない（mi が -1）ときは空配列。
 */
export function tripGain(mi, stageKey, apt, good) {
  const t = TRIP5[mi];
  if (!t) return [];
  const bonus = isGood(good, `trip:${mi}`) ? GOOD_BONUS : 0;
  return [
    { key: t.main, value: withGood(MT[stageKey][apt[t.main]][2], bonus, GOOD_MAX.trip) },
    { key: TRIP_SUB, value: withGood(MS[stageKey][2], bonus, GOOD_MAX.trip) },
  ];
}

/**
 * 1セットぶんのパラメータ上昇値。
 * イベント週はトレーニングに使えないので、ここで一度だけ差し引く。
 */
export function calcSetGain(set, stageKey, apt, good) {
  const gain = {};
  SK.forEach((k) => (gain[k] = 0));

  const weeks = Math.max(0, trainWeeks(set));
  const fullMonths = Math.floor(weeks / 4);
  const remainder = weeks % 4;

  const heavyCount = Math.max(0, Math.min(4, parseInt(set.hc, 10) || 0));
  const lightCount = Math.max(0, 4 - heavyCount);

  const heavy = heavyGain(parseInt(set.ht, 10), stageKey, apt, good);
  if (heavy.length && heavyCount > 0) {
    heavy.forEach(({ key, value }) => {
      gain[key] += value * heavyCount * fullMonths;
      // 4週に満たない余り週は、重トレ1回ぶんとして加算する
      if (remainder > 0) gain[key] += value;
    });
  }

  const light = lightGain(parseInt(set.lt, 10), stageKey, apt, good);
  if (light.length && lightCount > 0) {
    light.forEach(({ key, value }) => {
      gain[key] += value * lightCount * fullMonths;
    });
  }

  // 修行は4週まとめて出かけ、毎週ぶん上がる（トレーニングの週数とは別に足す）
  const trip = tripGain(parseInt(set.mt, 10), stageKey, apt, good);
  const trips = Math.max(0, set.mc || 0);
  if (trip.length && trips > 0) {
    trip.forEach(({ key, value }) => {
      gain[key] += value * TRIP_WEEKS * trips;
    });
  }
  return gain;
}

/**
 * 計画全体を計算して、最終パラメータと行ごとの内訳を返す。
 * 行は計画表と同じ時系列の並びで、桃で戻った行には peach（桃の番号）が入る。
 */
export function computeResult(sim) {
  const { segments } = planLayout(sim);
  const total = {};
  SK.forEach((k) => (total[k] = 0));

  const rows = segments.map((seg) => {
    const stageKey = SKEYS[seg.si];
    const gain = {};
    SK.forEach((k) => (gain[k] = 0));
    seg.sets.forEach((set) => {
      const setGain = calcSetGain(set, stageKey, sim.apt, sim.good);
      SK.forEach((k) => {
        gain[k] += setGain[k];
        total[k] += setGain[k];
      });
    });
    return {
      label: STAGES[seg.si],
      gain,
      weeks: seg.weeks,
      peach: seg.ph < 0 ? null : seg.ph,
      calStart: seg.calStart,
    };
  });

  const final = {};
  SK.forEach((k) => {
    final[k] = Math.max(0, Math.round((sim.init[k] || 0) + total[k]));
  });

  return { init: { ...sim.init }, final, rows };
}

/**
 * 週数の使いすぎなど、計画の問題点を文章で返す。
 */
export function validatePlan(sim) {
  const warnings = [];
  const base = calcStageWeeks(sim.life, sim.gtype);

  // 使えない桃（与える年齢が寿命を超える）は、行が挟まらないのでここで知らせる
  [0, 1].forEach((pi) => {
    const p = sim.peach && sim.peach[pi];
    if (!p || !p.use) return;
    const extra = peachExtra(pi);
    if (stageStartWeek(base, p.si) + extra >= sim.life) {
      warnings.push(
        `${peachName(pi)}：「${STAGES[p.si]}」開始から${extra}週後は寿命（${sim.life}週）を超えるので使えません`
      );
    }
  });

  const { segments, overflow } = planLayout(sim);
  segments.forEach((seg) => {
    const used = seg.sets.reduce((a, s) => a + (s.weeks || 0), 0);
    if (used > seg.weeks) {
      warnings.push(`${segLabel(seg)}：${used}週 > 総${seg.weeks}週`);
    }
  });
  if (overflow > 0) {
    warnings.push(`寿命の消費が${overflow}週ぶん、最後の段階からもはみ出しています`);
  }
  return warnings;
}
