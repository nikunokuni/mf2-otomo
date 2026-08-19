/* ===========================================================
   育成計算（画面に依存しない純粋な計算だけを置く）
   =========================================================== */

import { SK, SKEYS, STAGES, HEAVY4, LIGHT6, HM, HS, LG, GTH, EV_COST, EV_WEEKS } from '../data/growth.js';
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
 * 桃（若返り）で戻る分の段階別週数。
 * 桃を使うと useSi 段階の開始時点まで若返るので、
 * そこから extra 週ぶん（寿命の範囲内）をもう一度たどる区間を段階ごとに切り出す。
 */
export function calcPeachWeeks(totalLife, gtype, useSi, extra) {
  const baseWeeks = calcStageWeeks(totalLife, gtype);
  const peachStart = stageStartWeek(baseWeeks, useSi);
  const peachEnd = Math.min(totalLife, peachStart + extra);

  const result = new Array(10).fill(0);
  let cursor = 0;
  for (let si = 0; si < 10; si++) {
    const stageEnd = cursor + baseWeeks[si];
    result[si] = Math.max(0, Math.min(stageEnd, peachEnd) - Math.max(cursor, peachStart));
    cursor = stageEnd;
  }
  return result;
}

/**
 * 桃を与えるタイミング。
 * useSi 段階の開始から extra 週後が、第何段階の何週目にあたるかを返す。
 * 寿命を超えてしまう場合は over: true（si / weekInStage は null）。
 */
export function peachTiming(totalLife, gtype, useSi, extra) {
  const baseWeeks = calcStageWeeks(totalLife, gtype);
  const week = stageStartWeek(baseWeeks, useSi) + extra;
  if (week >= totalLife) return { week, si: null, weekInStage: null, over: true };

  let cursor = 0;
  for (let si = 0; si < 10; si++) {
    const stageEnd = cursor + baseWeeks[si];
    if (week < stageEnd) return { week, si, weekInStage: week - cursor + 1, over: false };
    cursor = stageEnd;
  }
  return { week, si: null, weekInStage: null, over: true };
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

/** その段階に組んであるセット（無ければ段階まるごと1セットとみなす） */
function setsOfStage(sim, g, si, fallbackWeeks) {
  const sets = (sim.plan[g] && sim.plan[g][si]) || [];
  return sets.length ? sets : [newSet(fallbackWeeks)];
}

/**
 * 各段階が始まるのが、育成開始から数えて暦の何週目かを返す。
 * groups[g][si] = 週数（0始まり）。その段階が無いときは null。
 *
 * 段階の長さは「年齢」で決まるが、実際に進む暦はイベントとアイテムでずれる
 * （大会は寿命-4なのに1週しか進まない／アイテムは寿命だけ進めて暦は進めない）。
 * ここでは計画に入っている中身から、段階ごとの「実際に進む暦」を積み上げる。
 *
 * 桃を使うと年齢だけ戻って暦は進み続けるので、
 * 桃を与えたあとの段階は、桃の表ぶんだけ暦がうしろにずれる。
 */
export function stageStartOffsets(sim) {
  const base = calcStageWeeks(sim.life, sim.gtype);
  const eff = stageWeeksByGroup(sim); // はみ出しを織り込んだ週数

  // 通常育成を段階→セットの順にたどり、年齢と暦を並べて持っておく
  const segments = [];
  const stageCal = new Array(10).fill(null);
  let age = 0;
  let cal = 0;
  for (let si = 0; si < 10; si++) {
    if (eff[0][si] === 0) continue;
    stageCal[si] = cal;
    setsOfStage(sim, 0, si, eff[0][si]).forEach((set) => {
      const ageWeeks = Math.max(0, set.weeks || 0);
      const calWeeks = calendarWeeks(set);
      segments.push({ ageStart: age, ageWeeks, calStart: cal, calWeeks });
      age += ageWeeks;
      cal += calWeeks;
    });
  }

  /** 年齢の週 → 暦の週。セットの途中なら、そのセットの中で割って出す */
  const ageToCal = (target) => {
    for (const seg of segments) {
      if (target < seg.ageStart + seg.ageWeeks) {
        const into = Math.max(0, target - seg.ageStart);
        return seg.calStart + (seg.ageWeeks ? Math.floor((seg.calWeeks * into) / seg.ageWeeks) : 0);
      }
    }
    return cal;
  };

  // 桃を与える時点と、桃の表ぶんの暦の長さ
  const peaches = [];
  for (let pi = 0; pi < 2; pi++) {
    const p = sim.peach[pi];
    if (!p || !p.use) continue;
    const extra = peachExtra(pi);
    const at = stageStartWeek(base, p.si) + extra;
    if (at >= sim.life) continue; // 寿命を超えるなら使えない
    const weeks = eff[pi + 1];
    const stages = [];
    let len = 0;
    for (let si = 0; si < 10; si++) {
      if (weeks[si] === 0) continue;
      const calWeeks = setsOfStage(sim, pi + 1, si, weeks[si]).reduce(
        (a, set) => a + calendarWeeks(set),
        0
      );
      stages.push({ si, calWeeks });
      len += calWeeks;
    }
    peaches.push({ pi, calAt: ageToCal(at), len, stages });
  }
  peaches.sort((a, b) => a.calAt - b.calAt);

  /** その暦の位置より前に使った桃のぶん、うしろにずれる */
  const shift = (calPos) =>
    peaches.reduce((sum, p) => sum + (p.calAt < calPos ? p.len : 0), 0);

  const normal = stageCal.map((c) => (c === null ? null : c + shift(c)));

  const groups = [normal];
  for (let pi = 0; pi < 2; pi++) {
    const list = new Array(10).fill(null);
    const p = peaches.find((x) => x.pi === pi);
    if (p) {
      let at = p.calAt + shift(p.calAt);
      p.stages.forEach(({ si, calWeeks }) => {
        list[si] = at;
        at += calWeeks;
      });
    }
    groups.push(list);
  }
  return groups;
}

/** 桃で追加される週数（黄金桃 +50 / 白銀桃 +25） */
export function peachExtra(peachIndex) {
  return peachIndex === 0 ? 50 : 25;
}

export function newSet(weeks = 0) {
  // items は { アイテム名: 回数 }。使わないアイテムはキーごと持たない
  return { ht: -1, hc: 2, lt: -1, tc: 0, mc: 0, ac: 0, weeks, items: {} };
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

/**
 * 寿命と成長タイプだけで決まる、素の段階週数。
 * g=0 は通常育成、g=1/2 は桃1/桃2 の追加分。
 */
function baseWeeksByGroup(sim) {
  const base = calcStageWeeks(sim.life, sim.gtype);
  const groups = [base];
  for (let pi = 0; pi < 2; pi++) {
    const p = sim.peach[pi];
    groups.push(
      p && p.use ? calcPeachWeeks(sim.life, sim.gtype, p.si, peachExtra(pi)) : new Array(10).fill(0)
    );
  }
  return groups;
}

/** そのセットで、割当週からはみ出た寿命の消費 */
function setOverflow(set) {
  return Math.max(0, lifeCost(set) - (set.weeks || 0));
}

/**
 * 段階を順にたどって、はみ出たぶんを次の段階から引いていく。
 * 例: 1段階10週にパラドクシン(-18)を使うと 1段階は0週になり、
 *     はみ出た8週が次の段階から引かれる（2段階20週 → 12週）。
 */
function cascade(sim, g, base) {
  const weeks = new Array(10).fill(0);
  let carry = 0;
  for (let si = 0; si < 10; si++) {
    const avail = base[si] - carry;
    weeks[si] = Math.max(0, avail);
    carry = Math.max(0, -avail);
    if (base[si] === 0) continue;
    const sets = (sim.plan[g] && sim.plan[g][si]) || [];
    carry += sets.reduce((a, set) => a + setOverflow(set), 0);
  }
  return { weeks, carry };
}

/**
 * 計画の全グループについて、段階ごとの総週数を返す。
 * 寿命の消費が割当を超えたぶんは、次の段階から引いてある。
 */
export function stageWeeksByGroup(sim) {
  return baseWeeksByGroup(sim).map((base, g) => cascade(sim, g, base).weeks);
}

/** 最後の段階からもはみ出た週数（グループごと）。寿命が足りていない量 */
export function planOverflow(sim) {
  return baseWeeksByGroup(sim).map((base, g) => cascade(sim, g, base).carry);
}

/**
 * 寿命や成長タイプを変えたあと、計画の週数を総週数に合わせ直す。
 * 2セット目以降に入力した週数はそのまま残し、余りを1セット目に寄せる。
 */
export function normalizePlan(sim) {
  baseWeeksByGroup(sim).forEach((base, g) => {
    if (!sim.plan[g]) sim.plan[g] = {};
    let carry = 0;
    for (let si = 0; si < 10; si++) {
      const avail = base[si] - carry;
      const total = Math.max(0, avail);
      carry = Math.max(0, -avail);
      const sets = sim.plan[g][si];

      if (base[si] === 0) {
        // その段階が消えたら計画も消す（桃を使わなくした場合など）
        if (g > 0) delete sim.plan[g][si];
        else if (sets) sets.forEach((s) => (s.weeks = 0));
        continue;
      }
      if (total === 0) {
        // 前の段階のはみ出しで丸ごと消えた段階
        if (sets) sets.forEach((s) => (s.weeks = 0));
      } else if (!sets || !sets.length) {
        sim.plan[g][si] = [newSet(total)];
      } else {
        const others = sets.slice(1).reduce((a, s) => a + (s.weeks || 0), 0);
        sets[0].weeks = Math.max(0, total - others);
      }
      // 割り当て直したあとの中身で、次へ回るぶんを数える
      carry += (sim.plan[g][si] || []).reduce((a, s) => a + setOverflow(s), 0);
    }
  });
  return sim;
}

/**
 * 重トレ1回ぶんの上昇値。[{ key, value }] を主上昇・副上昇・減少の順で返す。
 * 主上昇は HM テーブルの4つの数字のうち3つ目を使う（計算も画面表示もここを見る）。
 * トレーニングを選んでいない（ti が -1）ときは空配列。
 */
export function heavyGain(ti, stageKey, apt) {
  const t = HEAVY4[ti];
  if (!t) return [];
  return [
    { key: t.main, value: HM[stageKey][apt[t.main]][2] },
    { key: t.sub, value: HS[stageKey][apt[t.sub]] },
    { key: t.pen, value: -2 },
  ];
}

/** 軽トレ1回ぶんの上昇値。LG テーブルの値＝上がりうる最大値 */
export function lightGain(ti, stageKey, apt) {
  const t = LIGHT6[ti];
  if (!t) return [];
  return [{ key: t.stat, value: LG[stageKey][apt[t.stat]] }];
}

/**
 * 1セットぶんのパラメータ上昇値。
 * イベント週はトレーニングに使えないので、ここで一度だけ差し引く。
 */
export function calcSetGain(set, stageKey, apt) {
  const gain = {};
  SK.forEach((k) => (gain[k] = 0));

  const weeks = Math.max(0, trainWeeks(set));
  const fullMonths = Math.floor(weeks / 4);
  const remainder = weeks % 4;

  const heavyCount = Math.max(0, Math.min(4, parseInt(set.hc, 10) || 0));
  const lightCount = Math.max(0, 4 - heavyCount);

  const heavy = heavyGain(parseInt(set.ht, 10), stageKey, apt);
  if (heavy.length && heavyCount > 0) {
    heavy.forEach(({ key, value }) => {
      gain[key] += value * heavyCount * fullMonths;
      // 4週に満たない余り週は、重トレ1回ぶんとして加算する
      if (remainder > 0) gain[key] += value;
    });
  }

  const light = lightGain(parseInt(set.lt, 10), stageKey, apt);
  if (light.length && lightCount > 0) {
    light.forEach(({ key, value }) => {
      gain[key] += value * lightCount * fullMonths;
    });
  }
  return gain;
}

/**
 * 計画全体を計算して、最終パラメータと段階別の内訳を返す。
 */
export function computeResult(sim) {
  const groups = stageWeeksByGroup(sim);
  const total = {};
  SK.forEach((k) => (total[k] = 0));
  const rows = [];

  groups.forEach((stageWeeks, g) => {
    const phase = g === 0 ? '通常' : `桃${g}後`;
    for (let si = 0; si < 10; si++) {
      if (stageWeeks[si] === 0) continue;
      const stageKey = SKEYS[si];
      const stageGain = {};
      SK.forEach((k) => (stageGain[k] = 0));

      const sets = (sim.plan[g] && sim.plan[g][si]) || [];
      sets.forEach((set) => {
        const gain = calcSetGain(set, stageKey, sim.apt);
        SK.forEach((k) => {
          stageGain[k] += gain[k];
          total[k] += gain[k];
        });
      });
      rows.push({ label: STAGES[si], gain: stageGain, weeks: stageWeeks[si], phase });
    }
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
  const groups = stageWeeksByGroup(sim);
  const overflow = planOverflow(sim);

  groups.forEach((stageWeeks, g) => {
    const prefix = g === 0 ? '' : `桃${g}後 `;
    for (let si = 0; si < 10; si++) {
      const sets = (sim.plan[g] && sim.plan[g][si]) || [];
      if (!sets.length) continue;
      const used = sets.reduce((a, s) => a + (s.weeks || 0), 0);
      if (used > stageWeeks[si]) {
        warnings.push(`${prefix}${STAGES[si]}：${used}週 > 総${stageWeeks[si]}週`);
      }
    }
    if (overflow[g] > 0) {
      warnings.push(`${prefix}寿命の消費が${overflow[g]}週ぶん、最後の段階からもはみ出しています`);
    }
  });
  return warnings;
}
