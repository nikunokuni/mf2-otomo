/* ===========================================================
   育成計算タブ
   -----------------------------------------------------------
   選択中の種族ごとに、育成計画と結果を保存する。
   計算そのものは growth-calc.js（画面に依存しない）に置いてある。
   =========================================================== */

import { STATS, SK, SC, STAGES, SKEYS, HEAVY4, LIGHT6, EV_COST } from '../data/growth.js';
import { state, save, currentMon } from '../store.js';
import { el, h, replace, clampInt } from '../dom.js';
import {
  newSet,
  eventWeeks,
  stageWeeksByGroup,
  normalizePlan,
  computeResult,
  validatePlan,
  peachExtra,
  peachTiming,
  heavyGain,
  lightGain,
} from './growth-calc.js';

const APTITUDES = ['E', 'D', 'C', 'B', 'A'];
const GROWTH_TYPES = [
  ['hayajuku', '早熟'],
  ['jizoku', '持続'],
  ['futsuu', '普通'],
  ['bansei', '晩成'],
];
const MORALS = [
  ['good', 'ヨイ'],
  ['neutral', '普通'],
  ['bad', 'ワル'],
];

function sim() {
  const mon = currentMon();
  return mon ? mon.sim : null;
}

/* ---------- 基本設定 ---------- */

function renderBasic() {
  const s = sim();
  if (!s) return;

  // 開始時期
  el('simMonth').value = s.month;
  el('simWeek').value = s.week;
  el('simGtype').value = s.gtype;
  el('simMoral').value = s.moral;
  el('simLife').value = s.life;

  // 成長適正
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

  // 初期パラメータ
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
            style: `background:${SC[i]};width:${Math.min(100, value / 9.99).toFixed(1)}%`,
          })
        )
      );
    })
  );
}

function updateStatBar(key) {
  const s = sim();
  const bar = el(`statBar-${key}`);
  if (bar && s) bar.style.width = Math.min(100, (s.init[key] || 0) / 9.99).toFixed(1) + '%';
}

/* ---------- 育成計画 ---------- */

/* 表の中は幅が狭いので、パラメータ名は1文字にする（色と凡例で見分ける） */
const STAT_SHORT = ['ラ', '力', '賢', '命', '回', '丈'];

/** 選んだトレーニング1回ぶんの上昇値を、パラメータごとに色を付けて並べる */
function gainItems(list) {
  return list.map(({ key, value }) => {
    const i = SK.indexOf(key);
    return h('span', {
      class: 'train-gain__item',
      style: `color:${SC[i]}`,
      text: `${STAT_SHORT[i]}${value >= 0 ? '+' : ''}${value}`,
      attrs: { title: `${STATS[i]} ${value >= 0 ? '+' : ''}${value}` },
    });
  });
}

/** 上昇値の表示欄。select の下に置き、選び直したら中身だけ差し替える */
function gainBox(g, si, idx, field, list) {
  return h('div', { class: 'train-gain', id: `gain-${g}-${si}-${idx}-${field}` }, gainItems(list));
}

function updateTrainGain(g, si, idx, field, ti) {
  const node = el(`gain-${g}-${si}-${idx}-${field}`);
  if (!node) return;
  const apt = sim().apt;
  const list = field === 'ht' ? heavyGain(ti, SKEYS[si], apt) : lightGain(ti, SKEYS[si], apt);
  replace(node, gainItems(list));
}

/** 1文字表記の対応表。表の下に一度だけ出す */
function gainLegend() {
  return h(
    'div',
    { class: 'train-gain-legend' },
    ...STATS.map((name, i) =>
      h('span', { style: `color:${SC[i]}`, text: `${STAT_SHORT[i]}=${name}` })
    ),
    h('span', { class: 'note', text: '※ トレーニング1回ぶんの上昇値（軽トレは最大値）' })
  );
}

function trainOptions(list, selected, noneLabel) {
  return [
    h('option', { value: '-1', text: noneLabel, selected: String(selected) === '-1' }),
    ...list.map((t, i) => h('option', { value: String(i), text: t.name, selected: String(selected) === String(i) })),
  ];
}

function planRow(g, si, idx, set, rowspanCells) {
  const heavy = clampInt(set.hc, 0, 4, 0);
  const light = Math.max(0, 4 - heavy);
  const apt = sim().apt;
  const stageKey = SKEYS[si];
  const numField = (field, value, label) =>
    h('td', { class: 'col-num' },
      h('input', {
        type: 'number',
        value,
        min: 0,
        dataset: { input: 'sim:setField', g: String(g), si: String(si), idx: String(idx), field },
        attrs: { 'aria-label': label },
      })
    );

  return h(
    'tr',
    {},
    ...rowspanCells,
    h('td', { class: 'col-train' },
      h('select',
        { dataset: { change: 'sim:setField', g: String(g), si: String(si), idx: String(idx), field: 'ht' },
          attrs: { 'aria-label': '重トレの種類' } },
        trainOptions(HEAVY4, set.ht, 'なし')
      ),
      gainBox(g, si, idx, 'ht', heavyGain(parseInt(set.ht, 10), stageKey, apt))
    ),
    numField('hc', heavy, '重トレの回数/月'),
    h('td', { class: 'col-train' },
      h('select',
        { dataset: { change: 'sim:setField', g: String(g), si: String(si), idx: String(idx), field: 'lt' },
          attrs: { 'aria-label': '軽トレの種類' } },
        trainOptions(LIGHT6, set.lt, 'なし')
      ),
      gainBox(g, si, idx, 'lt', lightGain(parseInt(set.lt, 10), stageKey, apt))
    ),
    h('td', { class: 'col-num' },
      h('span', { class: 'light-count', id: `lc-${g}-${si}-${idx}`, text: String(light) })
    ),
    numField('tc', set.tc || 0, '大会の回数'),
    numField('mc', set.mc || 0, '修行の回数'),
    numField('ac', set.ac || 0, '冒険の回数'),
    numField('weeks', set.weeks || 0, '割り当て週数'),
    h('td', { style: 'width:32px' },
      idx > 0
        ? h('button', {
            type: 'button',
            class: 'icon-btn icon-btn--del',
            text: '✕',
            dataset: { action: 'sim:delSet', g: String(g), si: String(si), idx: String(idx) },
            attrs: { 'aria-label': 'このセットを削除' },
          })
        : null
    )
  );
}

function planTable(g, stageWeeks) {
  const s = sim();
  const head = h('thead', {},
    h('tr', {},
      h('th', { style: 'width:78px', text: '段階(週数)' }),
      h('th', { style: 'width:32px', text: '＋' }),
      h('th', { class: 'col-train', text: '重トレ' }),
      h('th', { class: 'col-num', text: '回/月' }),
      h('th', { class: 'col-train', text: '軽トレ' }),
      h('th', { class: 'col-num', text: '自動' }),
      h('th', { class: 'col-num', text: `大会(${EV_COST.tc}週)` }),
      h('th', { class: 'col-num', text: `修行(${EV_COST.mc}週)` }),
      h('th', { class: 'col-num', text: `冒険(${EV_COST.ac}週)` }),
      h('th', { class: 'col-num', text: '割当週' }),
      h('th', { style: 'width:32px' })
    )
  );

  const rows = [];
  for (let si = 0; si < 10; si++) {
    const total = stageWeeks[si];
    if (total === 0) continue;
    const sets = (s.plan[g] && s.plan[g][si]) || [newSet(total)];
    const used = sets.reduce((a, x) => a + (x.weeks || 0), 0);

    sets.forEach((set, idx) => {
      const rowspanCells =
        idx === 0
          ? [
              h('td', { class: 'stage-cell', attrs: { rowspan: sets.length } },
                h('span', { class: 'stage-name', text: STAGES[si] }),
                h('span', {
                  class: 'stage-weeks ' + (used > total ? 'stage-weeks--over' : 'stage-weeks--ok'),
                  id: `stageWeeks-${g}-${si}`,
                  text: `${used}/${total}週`,
                })
              ),
              h('td', { attrs: { rowspan: sets.length } },
                h('button', {
                  type: 'button',
                  class: 'icon-btn icon-btn--add',
                  text: '＋',
                  dataset: { action: 'sim:addSet', g: String(g), si: String(si) },
                  attrs: { 'aria-label': `${STAGES[si]}にセットを追加` },
                })
              ),
            ]
          : [];
      rows.push(planRow(g, si, idx, set, rowspanCells));
    });
  }

  return h('div', { class: 'scroll-x' },
    h('table', { class: 'plan-table' }, head, h('tbody', {}, rows))
  );
}

function renderPeach(groups) {
  const s = sim();
  const blocks = [0, 1].map((pi) => {
    const p = s.peach[pi];
    const extra = peachExtra(pi);
    const label = pi === 0 ? `黄金桃（+${extra}週）` : `白銀桃（+${extra}週）`;

    const controls = h('div', { class: 'sim-row', style: 'margin-bottom:6px' },
      h('span', { class: 'sim-label', style: 'width:112px', text: label }),
      h('select',
        { dataset: { change: 'sim:peach', pi: String(pi), field: 'use' }, attrs: { 'aria-label': `${label}を使うか` } },
        h('option', { value: 'no', text: '使わない', selected: !p.use }),
        h('option', { value: 'yes', text: '使う', selected: p.use })
      ),
      p.use ? h('span', { class: 'sim-label', text: '使用段階' }) : null,
      p.use
        ? h('select',
            { dataset: { change: 'sim:peach', pi: String(pi), field: 'si' }, attrs: { 'aria-label': '使用する成長段階' } },
            STAGES.map((name, i) => h('option', { value: String(i), text: name, selected: p.si === i }))
          )
        : null
    );

    if (!p.use) return h('div', { class: 'peach__block' }, controls);

    const weeks = groups[pi + 1];
    const total = weeks.reduce((a, b) => a + b, 0);
    const timing = peachTiming(s.life, s.gtype, p.si, extra);
    const timingText = timing.over
      ? `桃を与えるタイミング：「${STAGES[p.si]}」開始から${extra}週後は寿命（${s.life}週）を超えます`
      : `桃を与えるタイミング：「${STAGES[p.si]}」開始から${extra}週後＝${STAGES[timing.si]} ${timing.weekInStage}週目（通算${timing.week + 1}週目）`;

    return h('div', { class: 'peach__block' },
      controls,
      h('div', { class: 'peach__sub', text: `「${STAGES[p.si]}」開始から${extra}週ぶん：計${total}週` }),
      h('div', { class: 'peach__timing' + (timing.over ? ' peach__timing--over' : ''), text: timingText }),
      planTable(pi + 1, weeks)
    );
  });

  replace(el('peachArea'),
    h('div', { class: 'peach__title', text: '🍑 桃システム（若返り）' }),
    h('div', { class: 'callout callout--info',
      text: '黄金桃+50週、白銀桃+25週。選んだ段階の開始時点まで若返り、そこから週数ぶんの段階をもう一度計算します。' }),
    ...blocks
  );
}

function renderWarnings() {
  const s = sim();
  const warnings = validatePlan(s);
  replace(el('planWarnings'),
    warnings.length
      ? warnings.map((w) => h('div', { class: 'callout callout--warn', text: '⚠ ' + w }))
      : h('div', { class: 'callout callout--ok', text: '✔ 全段階のスケジュールに問題なし' })
  );
}

export function renderPlan() {
  const s = sim();
  if (!s) return;
  normalizePlan(s); // B5: 寿命や成長タイプを変えたら週数を計算し直す
  const groups = stageWeeksByGroup(s);
  replace(el('planArea'), planTable(0, groups[0]), gainLegend());
  renderPeach(groups);
  renderWarnings();
  save();
}

function updateStageBadge(g, si) {
  const s = sim();
  const groups = stageWeeksByGroup(s);
  const total = groups[g][si];
  const sets = (s.plan[g] && s.plan[g][si]) || [];
  const used = sets.reduce((a, x) => a + (x.weeks || 0), 0);
  const badge = el(`stageWeeks-${g}-${si}`);
  if (!badge) return;
  badge.textContent = `${used}/${total}週`;
  badge.className = 'stage-weeks ' + (used > total ? 'stage-weeks--over' : 'stage-weeks--ok');
}

/* ---------- 結果 ---------- */

export function renderResult() {
  const s = sim();
  if (!s) return;
  const area = el('resultArea');

  if (!s.result) {
    replace(area, h('div', { class: 'empty', text: '「計算実行」を押すと結果が出ます' }));
    return;
  }

  const { init, final, rows } = s.result;

  const panel = h('div', { class: 'result-panel' },
    h('div', { class: 'result-title', text: '最終パラメーター' }),
    ...SK.map((key, i) => {
      const from = init[key] || 0;
      const to = final[key];
      const delta = to - from;
      return h('div', { class: 'result-row' },
        h('span', { class: 'result-row__label', style: `color:${SC[i]}`, text: STATS[i] }),
        h('span', { class: 'result-row__value', style: `color:${SC[i]}`, text: String(to) }),
        h('span', {
          class: 'result-row__delta ' + (delta >= 0 ? 'result-row__delta--up' : 'result-row__delta--down'),
          text: (delta >= 0 ? '+' : '') + delta,
        }),
        h('div', { class: 'stat-bar' },
          h('div', { class: 'stat-bar__fill', style: `background:${SC[i]};width:${Math.min(100, (to / 999) * 100).toFixed(1)}%` })
        )
      );
    })
  );

  const phases = [...new Set(rows.map((r) => r.phase))];
  const tables = phases.flatMap((phase) => {
    const list = rows.filter((r) => r.phase === phase && r.weeks > 0);
    if (!list.length) return [];
    return [
      h('div', { class: 'stage-result__phase', text: `${phase} 段階別の上昇値` }),
      h('div', { class: 'scroll-x' },
        h('table', { class: 'stage-result' },
          h('thead', {}, h('tr', {},
            h('th', { text: '段階' }), h('th', { text: '週数' }),
            ...STATS.map((name, i) => h('th', { style: `color:${SC[i]}`, text: name }))
          )),
          h('tbody', {}, list.map((r) =>
            h('tr', {},
              h('td', { text: r.label }),
              h('td', { style: 'color:var(--color-text-tertiary)', text: String(r.weeks) }),
              ...SK.map((key, j) => {
                const v = Math.round(r.gain[key]);
                const cls = v === 0 ? 'val-zero' : v < 0 ? 'val-down' : '';
                return h('td', { class: cls, style: v > 0 ? `color:${SC[j]}` : '', text: v !== 0 ? (v > 0 ? '+' : '') + v : '−' });
              })
            )
          ))
        )
      ),
    ];
  });

  replace(area, panel, ...tables);
}

/* ---------- 全体の描画 ---------- */

export function render() {
  const mon = currentMon();
  el('simEmpty').hidden = !!mon;
  el('simBody').hidden = !mon;
  if (!mon) return;

  el('simSpeciesLabel').textContent = state.current;
  renderBasic();
  renderPlan();
  renderResult();
}

/** サブタブが表示されたときに呼ぶ（表の幅計算のため、表示後に描き直す） */
export function onSubTabShown(name) {
  if (!sim()) return;
  if (name === 'plan') renderPlan();
  else if (name === 'result') renderResult();
  else renderBasic();
}

/* ---------- 操作 ---------- */

function setsAt(s, g, si) {
  if (!s.plan[g]) s.plan[g] = {};
  if (!s.plan[g][si]) s.plan[g][si] = [newSet(0)];
  return s.plan[g][si];
}

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

  'sim:addSet': (target) => {
    const s = sim();
    const g = Number(target.dataset.g);
    const si = Number(target.dataset.si);
    setsAt(s, g, si).push(newSet(0));
    renderPlan();
  },

  'sim:delSet': (target) => {
    const s = sim();
    const g = Number(target.dataset.g);
    const si = Number(target.dataset.si);
    const idx = Number(target.dataset.idx);
    const sets = setsAt(s, g, si);
    sets.splice(idx, 1);
    if (!sets.length) s.plan[g][si] = [newSet(0)];
    renderPlan();
  },

  'sim:calc': () => {
    const s = sim();
    if (!s) return;
    normalizePlan(s);
    s.result = computeResult(s);
    save();
    document.dispatchEvent(new CustomEvent('sim:showResult'));
  },

  // B6: 旧実装では開始月・週・ヨイワルが初期値に戻らなかった
  'sim:reset': () => {
    const mon = currentMon();
    if (!mon) return;
    if (!confirm(`${state.current} の育成計画をすべて初期値に戻しますか？`)) return;
    // defaultSim() を作り直して丸ごと差し替える（戻し忘れが起きない）
    import('../store.js').then(({ defaultSim }) => {
      mon.sim = defaultSim();
      save();
      render();
    });
  },
};

export const changeActions = {
  'sim:apt': (target) => {
    const s = sim();
    s.apt[target.dataset.key] = target.value;
    save();
  },

  'sim:gtype': (target) => {
    const s = sim();
    s.gtype = target.value;
    save();
  },

  'sim:moral': (target) => {
    const s = sim();
    s.moral = target.value;
    save();
  },

  'sim:peach': (target) => {
    const s = sim();
    const p = s.peach[Number(target.dataset.pi)];
    const field = target.dataset.field;
    if (field === 'use') p.use = target.value === 'yes';
    else p[field] = Number(target.value);
    renderPlan();
  },

  'sim:setField': (target) => {
    // select（重トレ/軽トレ）の変更
    const s = sim();
    const { g, si, idx, field } = target.dataset;
    const set = setsAt(s, Number(g), Number(si))[Number(idx)];
    if (!set) return;
    set[field] = parseInt(target.value, 10);
    // 選んだトレーニングの上昇値をその場で出す（表全体は作り直さない）
    updateTrainGain(Number(g), Number(si), Number(idx), field, set[field]);
    save();
  },
};

export const inputActions = {
  'sim:init': (target) => {
    const s = sim();
    const key = target.dataset.key;
    s.init[key] = clampInt(target.value, 0, 999, 0);
    updateStatBar(key);
    save();
  },

  'sim:life': (target) => {
    const s = sim();
    s.life = clampInt(target.value, 100, 600, 300);
    save();
  },

  'sim:month': (target) => {
    sim().month = clampInt(target.value, 1, 12, 1);
    save();
  },

  'sim:setField': (target) => {
    const s = sim();
    const { g, si, idx, field } = target.dataset;
    const set = setsAt(s, Number(g), Number(si))[Number(idx)];
    if (!set) return;

    if (field === 'hc') {
      set.hc = clampInt(target.value, 0, 4, 0);
      const lc = el(`lc-${g}-${si}-${idx}`);
      if (lc) lc.textContent = String(Math.max(0, 4 - set.hc));
    } else {
      set[field] = Math.max(0, parseInt(target.value, 10) || 0);
    }
    updateStageBadge(Number(g), Number(si));
    renderWarnings();
    save();
  },
};

export const simpleChanges = {
  'sim:week': (target) => {
    sim().week = clampInt(target.value, 1, 4, 1);
    save();
  },
};

/** イベント週の合計（画面の説明文に出す） */
export function eventCostLabel() {
  return `大会-${EV_COST.tc}週 / 修行-${EV_COST.mc}週 / 冒険-${EV_COST.ac}週`;
}

export { eventWeeks };
