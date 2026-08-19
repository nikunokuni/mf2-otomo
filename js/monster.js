/* ===========================================================
   モンスタータブ
   -----------------------------------------------------------
   そのモンスター1体について「ゲーム側で決まっている値」をまとめて置く場所。
   使い込みタブと育成計算タブは、ここに入れた値を読んで動く。

     成長タイプ / ヨイワル / 寿命 / 成長適正 / 初期パラメーター … mon.sim
     ガッツ回復速度                                              … mon.guts

   docs/roadmap.md ① の「派生種を選ぶと自動で埋まる」7項目は、
   ちょうどこの画面の中身と同じ。派生種の選択を足すならここになる。

   種族そのものの選択（グリッドとチップ）は js/species.js が持っている。
   =========================================================== */

import { STATS, SK, SC } from './data/growth.js';
import { state, save, currentMon, MORAL_STEP, normalizeMoral } from './store.js';
import { el, h, replace, clampInt } from './dom.js';

const APTITUDES = ['E', 'D', 'C', 'B', 'A'];

/** ヨイワルの選択肢。-100〜100 を5きざみ。両端と0だけ言葉を添える */
const MORAL_LABELS = { '-100': 'ワル', 0: '普通', 100: 'ヨイ' };
function moralOptions(selected) {
  const list = [];
  for (let v = -100; v <= 100; v += MORAL_STEP) {
    const sign = v > 0 ? '+' : '';
    const note = MORAL_LABELS[v] ? `（${MORAL_LABELS[v]}）` : '';
    list.push(h('option', { value: String(v), text: `${sign}${v}${note}`, selected: v === selected }));
  }
  return list;
}

function sim() {
  const mon = currentMon();
  return mon ? mon.sim : null;
}

/* ---------- ガッツ回復速度 ---------- */

function renderGuts(mon) {
  const options = [];
  for (let i = 6; i <= 19; i++) {
    options.push(h('option', { value: String(i), text: String(i), selected: i === (mon.guts || 15) }));
  }
  replace(el('gutsRecovery'), options);
}

/* ---------- 成長適正 ---------- */

function renderApt(s) {
  replace(
    el('aptGrid'),
    STATS.map((label, i) =>
      h(
        'div',
        { class: 'apt-cell' },
        h('span', { class: 'apt-cell__label', style: `color:${SC[i]}`, text: label }),
        h(
          'select',
          { dataset: { change: 'sim:apt', key: SK[i] }, attrs: { 'aria-label': `${label}の成長適正` } },
          APTITUDES.map((a) => h('option', { value: a, text: a, selected: s.apt[SK[i]] === a }))
        )
      )
    )
  );
}

/* ---------- 初期パラメーター ---------- */

function renderInit(s) {
  replace(
    el('initStats'),
    STATS.map((label, i) => {
      const key = SK[i];
      const value = s.init[key] || 0;
      return h(
        'div',
        { class: 'stat-row' },
        h('span', { class: 'stat-row__label', style: `color:${SC[i]}`, text: label }),
        h('button', {
          type: 'button',
          class: 'stepper',
          text: '−10',
          dataset: { action: 'sim:statStep', key, delta: '-10' },
          attrs: { 'aria-label': `${label}を10減らす` },
        }),
        h('input', {
          type: 'number',
          class: 'stat-row__input',
          value,
          min: 0,
          max: 999,
          dataset: { input: 'sim:init', key },
          attrs: { 'aria-label': `${label}の初期値` },
        }),
        h('button', {
          type: 'button',
          class: 'stepper',
          text: '+10',
          dataset: { action: 'sim:statStep', key, delta: '10' },
          attrs: { 'aria-label': `${label}を10増やす` },
        }),
        h(
          'div',
          { class: 'stat-bar' },
          h('div', {
            class: 'stat-bar__fill',
            id: `statBar-${key}`,
            style: `background:${SC[i]};width:${statBarWidth(value)}%`,
          })
        )
      );
    })
  );
}

/** 999 を上限としたときの帯の長さ（%） */
function statBarWidth(value) {
  return Math.min(100, value / 9.99).toFixed(1);
}

function updateStatBar(key) {
  const s = sim();
  const bar = el(`statBar-${key}`);
  if (bar && s) bar.style.width = statBarWidth(s.init[key] || 0) + '%';
}

/* ---------- 全体の描画 ---------- */

export function render() {
  const mon = currentMon();
  el('monsterEmpty').hidden = !!mon;
  el('monsterSpec').hidden = !mon;
  if (!mon) return;

  const s = mon.sim;
  el('specSpeciesLabel').textContent = state.current;
  el('simGtype').value = s.gtype;
  replace(el('simMoral'), moralOptions(s.moral));
  el('simLife').value = s.life;
  renderGuts(mon);
  renderApt(s);
  renderInit(s);
}

/* ---------- 操作 ---------- */

export const actions = {
  'sim:statStep': (target) => {
    const s = sim();
    if (!s) return;
    const key = target.dataset.key;
    s.init[key] = clampInt((s.init[key] || 0) + Number(target.dataset.delta), 0, 999, 0);
    const input = document.querySelector(`input[data-input="sim:init"][data-key="${key}"]`);
    if (input) input.value = s.init[key];
    updateStatBar(key);
    save();
  },

  'sim:lifeStep': (target) => {
    const s = sim();
    if (!s) return;
    s.life = clampInt(s.life + Number(target.dataset.delta), 100, 600, 300);
    el('simLife').value = s.life;
    save();
  },
};

export const changeActions = {
  'sim:apt': (target) => {
    const s = sim();
    if (!s) return;
    s.apt[target.dataset.key] = target.value;
    save();
  },

  'sim:gtype': (target) => {
    const s = sim();
    if (!s) return;
    s.gtype = target.value;
    save();
  },

  'sim:moral': (target) => {
    const s = sim();
    if (!s) return;
    s.moral = normalizeMoral(target.value);
    save();
  },

  'tracker:guts': (target) => {
    const mon = currentMon();
    if (!mon) return;
    mon.guts = clampInt(target.value, 6, 19, 15);
    save();
  },
};

export const inputActions = {
  'sim:init': (target) => {
    const s = sim();
    if (!s) return;
    s.init[target.dataset.key] = clampInt(target.value, 0, 999, 0);
    updateStatBar(target.dataset.key);
    save();
  },

  'sim:life': (target) => {
    const s = sim();
    if (!s) return;
    s.life = clampInt(target.value, 100, 600, 300);
    save();
  },
};
