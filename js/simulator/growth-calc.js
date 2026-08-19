/* ===========================================================
   育成計算（画面に依存しない純粋な計算だけを置く）
   =========================================================== */

import { SK, SKEYS, STAGES, HEAVY4, LIGHT6, HM, HS, LG, GTH, EV_COST } from '../data/growth.js';

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

/**
 * 各段階が始まるのが、育成開始から数えて暦の何週目かを返す。
 * groups[g][si] = 週数（0始まり）。その段階が無いときは null。
 *
 * 桃を使うと年齢だけ戻って暦は進み続けるので、
 * 桃を与えたあとの段階は、そのぶん暦がうしろにずれる。
 *
 * ※ イベント（大会・修行・冒険）は減る寿命と実際に進む週数が違うため、
 *   計画にイベントを入れると、ここで出す暦とは実際にはずれる。
 *   いまは「育成開始 ＋ 段階の週数」だけで出している。
 */
export function stageStartOffsets(sim) {
  const base = calcStageWeeks(sim.life, sim.gtype);

  // 桃を与える時点（年齢の週）と、そこで暦だけ余分に進む週数
  const peaches = [];
  for (let pi = 0; pi < 2; pi++) {
    const p = sim.peach[pi];
    if (!p || !p.use) continue;
    const extra = peachExtra(pi);
    const at = stageStartWeek(base, p.si) + extra;
    if (at >= sim.life) continue; // 寿命を超えるなら使えない
    peaches.push({ pi, at, extra });
  }
  peaches.sort((a, b) => a.at - b.at);

  /** 年齢の週 → 暦の週 */
  const toCalendar = (age) =>
    age + peaches.reduce((sum, p) => sum + (age > p.at ? p.extra : 0), 0);

  const normal = new Array(10).fill(null);
  let cursor = 0;
  for (let si = 0; si < 10; si++) {
    if (base[si] > 0) normal[si] = toCalendar(cursor);
    cursor += base[si];
  }

  const groups = [normal];
  for (let pi = 0; pi < 2; pi++) {
    const list = new Array(10).fill(null);
    const used = peaches.find((x) => x.pi === pi);
    if (used) {
      // 桃を与えた週から、戻ったぶんの段階を順にたどる
      let at = toCalendar(used.at);
      const weeks = calcPeachWeeks(sim.life, sim.gtype, sim.peach[pi].si, used.extra);
      for (let si = 0; si < 10; si++) {
        if (weeks[si] > 0) {
          list[si] = at;
          at += weeks[si];
        }
      }
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
  return { ht: -1, hc: 2, lt: -1, tc: 0, mc: 0, ac: 0, weeks };
}

/** そのセットでイベントに使う週数 */
export function eventWeeks(set) {
  return (set.tc || 0) * EV_COST.tc + (set.mc || 0) * EV_COST.mc + (set.ac || 0) * EV_COST.ac;
}

/**
 * 計画の全グループについて、段階ごとの総週数を返す。
 * g=0 は通常育成、g=1/2 は桃1/桃2 の追加分。
 */
export function stageWeeksByGroup(sim) {
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

/**
 * 寿命や成長タイプを変えたあと、計画の週数を総週数に合わせ直す。
 * 2セット目以降に入力した週数はそのまま残し、余りを1セット目に寄せる。
 */
export function normalizePlan(sim) {
  const groups = stageWeeksByGroup(sim);
  groups.forEach((stageWeeks, g) => {
    if (!sim.plan[g]) sim.plan[g] = {};
    for (let si = 0; si < 10; si++) {
      const total = stageWeeks[si];
      const sets = sim.plan[g][si];

      if (total === 0) {
        // その段階が消えたら計画も消す（桃を使わなくした場合など）
        if (g > 0) delete sim.plan[g][si];
        else if (sets) sets.forEach((s) => (s.weeks = 0));
        continue;
      }
      if (!sets || !sets.length) {
        sim.plan[g][si] = [newSet(total)];
        continue;
      }
      const others = sets.slice(1).reduce((a, s) => a + (s.weeks || 0), 0);
      sets[0].weeks = Math.max(0, total - others);
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

  const trainWeeks = Math.max(0, (set.weeks || 0) - eventWeeks(set));
  const fullMonths = Math.floor(trainWeeks / 4);
  const remainder = trainWeeks % 4;

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

  groups.forEach((stageWeeks, g) => {
    const prefix = g === 0 ? '' : `桃${g}後 `;
    for (let si = 0; si < 10; si++) {
      const sets = (sim.plan[g] && sim.plan[g][si]) || [];
      if (!sets.length) continue;
      const used = sets.reduce((a, s) => a + (s.weeks || 0), 0);
      if (used > stageWeeks[si]) {
        warnings.push(`${prefix}${STAGES[si]}：${used}週 > 総${stageWeeks[si]}週`);
      }
      sets.forEach((s, i) => {
        const ev = eventWeeks(s);
        if (ev > (s.weeks || 0)) {
          warnings.push(
            `${prefix}${STAGES[si]} セット${i + 1}：イベント${ev}週が割当${s.weeks || 0}週を超えています`
          );
        }
      });
    }
  });
  return warnings;
}
