/* ===========================================================
   育成計算タブ
   -----------------------------------------------------------
   選択中の種族ごとに、育成計画と結果を保存する。
   計算そのものは growth-calc.js（画面に依存しない）に置いてある。
   =========================================================== */

import { STATS, SK, SC, SCV, STAGES, SKEYS, HEAVY4, LIGHT6, EV_COST } from '../data/growth.js';
import { state, save, currentMon } from '../store.js';
import { el, h, replace, clampInt } from '../dom.js';
import {
  newSet,
  trainWeeks,
  AGE_ITEMS,
  planLayout,
  segLabel,
  peachName,
  normalizePlan,
  computeResult,
  validatePlan,
  peachExtra,
  weekToDate,
  heavyGain,
  lightGain,
} from './growth-calc.js';

function sim() {
  const mon = currentMon();
  return mon ? mon.sim : null;
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
function gainBox(key, idx, field, list) {
  return h('div', { class: 'train-gain', id: `gain-${key}-${idx}-${field}` }, gainItems(list));
}

function updateTrainGain(key, si, idx, field, ti) {
  const node = el(`gain-${key}-${idx}-${field}`);
  if (!node) return;
  const apt = sim().apt;
  const list = field === 'ht' ? heavyGain(ti, SKEYS[si], apt) : lightGain(ti, SKEYS[si], apt);
  replace(node, gainItems(list));
}

function trainOptions(list, selected, noneLabel) {
  return [
    h('option', { value: '-1', text: noneLabel, selected: String(selected) === '-1' }),
    ...list.map((t, i) => h('option', { value: String(i), text: t.name, selected: String(selected) === String(i) })),
  ];
}

function trainWeeksLabel(set) {
  const n = trainWeeks(set);
  // 割当週を超えたぶんは次の行から引かれるので、そのことを書いておく
  return n < 0 ? `トレ0週\n次へ${-n}週` : `トレ${n}週`;
}

function trainWeeksClass(set) {
  return 'train-weeks' + (trainWeeks(set) < 0 ? ' train-weeks--over' : '');
}

/** 計画表の列の数（桃の見出し行を1行ぶんで横に伸ばすのに使う） */
function planColCount() {
  return 10 + AGE_ITEMS.length;
}

function planRow(seg, idx, set, rowspanCells) {
  const heavy = clampInt(set.hc, 0, 4, 0);
  const light = Math.max(0, 4 - heavy);
  const apt = sim().apt;
  const stageKey = SKEYS[seg.si];
  const key = seg.key;
  const ref = { seg: key, si: String(seg.si), idx: String(idx) };
  const numField = (field, value, label, extra = null) =>
    h('td', { class: 'col-num' + (field === 'weeks' ? ' col-week' : '') },
      h('input', {
        type: 'number',
        id: `set-${field}-${key}-${idx}`,
        value,
        min: 0,
        dataset: { input: 'sim:setField', ...ref, field },
        attrs: { 'aria-label': label },
      }),
      extra
    );

  return h(
    'tr',
    { class: seg.ph < 0 ? null : 'plan-row--peach' },
    ...rowspanCells,
    h('td', { class: 'col-train' },
      h('select',
        { dataset: { change: 'sim:setField', ...ref, field: 'ht' },
          attrs: { 'aria-label': '重トレの種類' } },
        trainOptions(HEAVY4, set.ht, 'なし')
      ),
      gainBox(key, idx, 'ht', heavyGain(parseInt(set.ht, 10), stageKey, apt))
    ),
    numField('hc', heavy, '重トレの回数/月'),
    h('td', { class: 'col-train' },
      h('select',
        { dataset: { change: 'sim:setField', ...ref, field: 'lt' },
          attrs: { 'aria-label': '軽トレの種類' } },
        trainOptions(LIGHT6, set.lt, 'なし')
      ),
      gainBox(key, idx, 'lt', lightGain(parseInt(set.lt, 10), stageKey, apt))
    ),
    h('td', { class: 'col-num' },
      h('span', { class: 'light-count', id: `lc-${key}-${idx}`, text: String(light) })
    ),
    numField(
      'weeks',
      set.weeks || 0,
      '割り当て週数',
      h('span', {
        class: trainWeeksClass(set),
        id: `trainWeeks-${key}-${idx}`,
        text: trainWeeksLabel(set),
      })
    ),
    numField('tc', set.tc || 0, '大会の回数'),
    numField('mc', set.mc || 0, '修行の回数'),
    numField('ac', set.ac || 0, '冒険の回数'),
    ...AGE_ITEMS.map((item) =>
      h('td', { class: 'col-num' },
        h('input', {
          type: 'number',
          value: (set.items && set.items[item.name]) || 0,
          min: 0,
          dataset: { input: 'sim:setItem', ...ref, name: item.name },
          attrs: { 'aria-label': `${item.name}の回数` },
        })
      )
    )
  );
}

/** セット番号と、追加/削除ボタンをまとめた欄 */
function setCell(seg, idx) {
  return h('td', { class: 'col-set' },
    h('span', { class: 'set-no', text: String(idx + 1) }),
    idx === 0
      ? h('button', {
          type: 'button',
          class: 'icon-btn icon-btn--add',
          text: '＋',
          dataset: { action: 'sim:addSet', seg: seg.key },
          attrs: { 'aria-label': `${segLabel(seg)}にセットを追加` },
        })
      : h('button', {
          type: 'button',
          class: 'icon-btn icon-btn--del',
          text: '✕',
          dataset: { action: 'sim:delSet', seg: seg.key, idx: String(idx) },
          attrs: { 'aria-label': 'このセットを削除' },
        })
  );
}

/** 段階が始まる時期。「○月◎週」で出す（分からないときは空） */
function stageDateLabel(s, offset) {
  if (offset === null || offset === undefined) return '';
  const d = weekToDate(s.month, s.week, offset);
  return `${d.month}月${d.week}週`;
}

/** 桃を与える行の見出し。挟み込む位置がそのままタイミングになる */
function peachHeadText(s, p, seg) {
  return `🍑 ${peachName(p.pi)}（+${peachExtra(p.pi)}週）を与える ／ ${stageDateLabel(
    s,
    seg.calStart
  )}（通算${p.age + 1}週目）`;
}

function peachHeadRow(s, p, seg) {
  return h('tr', { class: 'plan-row--peach-head' },
    h('td', {
      id: `peachHead-${p.pi}`,
      attrs: { colspan: String(planColCount()) },
      text: peachHeadText(s, p, seg),
    })
  );
}

/**
 * 育成計画の表。
 * 行は時系列に並んでいて、桃で若返るぶんはその位置に黄色い行として挟まる。
 */
function planTable(layout) {
  const s = sim();
  const head = h('thead', {},
    h('tr', {},
      h('th', { style: 'width:78px', text: '段階(週数)' }),
      h('th', { class: 'col-set', text: 'セット' }),
      h('th', { class: 'col-train', text: '重トレ' }),
      h('th', { class: 'col-num', text: '回/月' }),
      h('th', { class: 'col-train', text: '軽トレ' }),
      h('th', { class: 'col-num', text: '自動' }),
      h('th', { class: 'col-num col-week', text: '割当週' }),
      h('th', { class: 'col-num', text: `大会(-${EV_COST.tc})` }),
      h('th', { class: 'col-num', text: `修行(-${EV_COST.mc})` }),
      h('th', { class: 'col-num', text: `冒険(-${EV_COST.ac})` }),
      ...AGE_ITEMS.map((item) =>
        h('th', { class: 'col-num', text: `${item.name}(-${item.agePlus})` })
      )
    )
  );

  const rows = [];
  layout.segments.forEach((seg) => {
    // 桃を与える位置に見出しを出してから、若返ったぶんの行を続ける
    seg.peaches.forEach((p) => rows.push(peachHeadRow(s, p, seg)));
    // 週数が0になった行も出す。前の行のはみ出しで0になっただけのことがあり、
    // 隠すと入れたイベントやアイテムを直せなくなる
    const used = seg.sets.reduce((a, x) => a + (x.weeks || 0), 0);

    seg.sets.forEach((set, idx) => {
      const rowspanCells =
        idx === 0
          ? [
              h('td', { class: 'stage-cell', attrs: { rowspan: seg.sets.length } },
                seg.ph < 0
                  ? null
                  : h('span', { class: 'stage-peach', text: `🍑${peachName(seg.ph)}` }),
                h('span', { class: 'stage-name', text: STAGES[seg.si] }),
                h('span', {
                  class:
                    'stage-weeks ' + (used > seg.weeks ? 'stage-weeks--over' : 'stage-weeks--ok'),
                  id: `segWeeks-${seg.key}`,
                  text: `${used}/${seg.weeks}週`,
                }),
                h('span', {
                  class: 'stage-date',
                  id: `segDate-${seg.key}`,
                  text: stageDateLabel(s, seg.calStart),
                })
              ),
            ]
          : [];
      rows.push(planRow(seg, idx, set, [...rowspanCells, setCell(seg, idx)]));
    });
  });

  return h('div', { class: 'scroll-x' },
    h('table', { class: 'plan-table' }, head, h('tbody', {}, rows))
  );
}

/**
 * 桃システムの操作欄。
 * 若返るぶんの計画は上の表に挟み込むので、ここには「使うか」と「使用段階」だけ置く。
 * 2つぶんを1行に並べる。
 */
function renderPeach() {
  const s = sim();
  const blocks = [0, 1].map((pi) => {
    const p = s.peach[pi];
    return h('span', { class: 'peach__item' },
      h('label', { class: 'peach__check' },
        h('input', {
          type: 'checkbox',
          checked: p.use,
          dataset: { change: 'sim:peach', pi: String(pi), field: 'use' },
          attrs: { 'aria-label': `${peachName(pi)}を使う` },
        }),
        h('span', { text: peachName(pi) })
      ),
      p.use
        ? h('select',
            { dataset: { change: 'sim:peach', pi: String(pi), field: 'si' },
              attrs: { 'aria-label': `${peachName(pi)}の使用段階（その段階の開始まで若返る）` } },
            STAGES.map((name, i) => h('option', { value: String(i), text: name, selected: p.si === i }))
          )
        : null
    );
  });

  replace(el('peachArea'),
    h('span', { class: 'peach__title', text: '🍑 桃' }),
    ...blocks
  );
}

function renderWarnings() {
  const s = sim();
  const warnings = validatePlan(s);
  // 問題があるときだけ出す
  replace(el('planWarnings'), warnings.map((w) => h('div', { class: 'callout callout--warn', text: '⚠ ' + w })));
}

/**
 * 成長適正の読み取り専用の帯。
 * 上昇値は適正で変わるので、計画を組みながら見えるようにしておく。
 * 書き換えるのはモンスタータブなので、ここでは表示だけ。
 */
function renderPlanApt() {
  const s = sim();
  replace(
    el('planApt'),
    h('span', { class: 'plan-apt__title', text: '成長適正' }),
    ...STATS.map((name, i) =>
      h(
        'span',
        { class: 'plan-apt__cell', attrs: { title: `${name}の成長適正` } },
        h('span', { class: 'plan-apt__label', style: `color:${SC[i]}`, text: STAT_SHORT[i] }),
        h('span', { class: 'plan-apt__rank', text: s.apt[SK[i]] })
      )
    )
  );
}

export function renderPlan() {
  const s = sim();
  if (!s) return;
  el('simMonth').value = s.month;
  el('simWeek').value = s.week;
  renderPlanApt();
  normalizePlan(s); // B5: 寿命や成長タイプを変えたら週数を計算し直す
  renderPeach();
  replace(el('planArea'), planTable(planLayout(s)));
  renderWarnings();
  save();
}

/**
 * イベントやアイテムを変えると、はみ出しで次の行の週数まで動く。
 * 表そのものは作り直さずに、数字と日付だけ書き換える
 * （入力中の欄はさわらない。作り直すとカーソルが飛ぶため）。
 */
function refreshPlanNumbers() {
  const s = sim();
  if (!s) return;
  normalizePlan(s);
  const { segments } = planLayout(s);

  segments.forEach((seg) => {
    seg.sets.forEach((set, idx) => {
      const input = el(`set-weeks-${seg.key}-${idx}`);
      if (input && document.activeElement !== input) input.value = String(set.weeks || 0);
      updateTrainWeeks(seg.key, idx, set);
    });
    const used = seg.sets.reduce((a, x) => a + (x.weeks || 0), 0);
    const badge = el(`segWeeks-${seg.key}`);
    if (badge) {
      badge.textContent = `${used}/${seg.weeks}週`;
      badge.className =
        'stage-weeks ' + (used > seg.weeks ? 'stage-weeks--over' : 'stage-weeks--ok');
    }
    const date = el(`segDate-${seg.key}`);
    if (date) date.textContent = stageDateLabel(s, seg.calStart);
    // 桃を与える位置（暦）も動くので、見出しも書き換える
    seg.peaches.forEach((p) => {
      const head = el(`peachHead-${p.pi}`);
      if (head) head.textContent = peachHeadText(s, p, seg);
    });
  });
  renderWarnings();
}

function updateTrainWeeks(key, idx, set) {
  const node = el(`trainWeeks-${key}-${idx}`);
  if (!node) return;
  node.textContent = trainWeeksLabel(set);
  node.className = trainWeeksClass(set);
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

  // ステータス6種の合計（初期値からの伸びも一緒に出す）
  const initTotal = SK.reduce((a, key) => a + (init[key] || 0), 0);
  const finalTotal = SK.reduce((a, key) => a + (final[key] || 0), 0);
  const totalDelta = finalTotal - initTotal;

  const panel = h('div', { class: 'result-panel' },
    h('div', { class: 'result-head' },
      h('span', { class: 'result-title', text: '最終パラメーター' }),
      h('span', { class: 'result-total' },
        h('span', { class: 'result-total__label', text: '合計' }),
        h('span', { class: 'result-total__value', text: String(finalTotal) }),
        h('span', {
          class: 'result-total__delta ' + (totalDelta >= 0 ? 'result-row__delta--up' : 'result-row__delta--down'),
          text: (totalDelta >= 0 ? '+' : '') + totalDelta,
        })
      )
    ),
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
          h('div', { class: 'stat-bar__fill', style: `background:${SCV[i]};width:${Math.min(100, (to / 999) * 100).toFixed(1)}%` })
        )
      );
    })
  );

  // 計画表と同じ時系列の並び。桃で若返るぶんは黄色い行で挟まる
  const list = rows.filter((r) => r.weeks > 0);
  const tables = list.length
    ? [
        h('div', { class: 'stage-result__phase', text: '段階別の上昇値' }),
        h('div', { class: 'scroll-x' },
          h('table', { class: 'stage-result' },
            h('thead', {}, h('tr', {},
              h('th', { text: '段階' }), h('th', { text: '週数' }),
              ...STATS.map((name, i) => h('th', { style: `color:${SC[i]}`, text: name }))
            )),
            h('tbody', {}, list.map((r) => {
              // 前のしくみで保存した結果には peach が無いので、そのときは白い行として出す
              const pi = r.peach === null || r.peach === undefined ? null : r.peach;
              return h('tr', { class: pi === null ? null : 'stage-result__row--peach' },
                h('td', { text: pi === null ? r.label : `🍑${peachName(pi)} ${r.label}` }),
                h('td', { style: 'color:var(--color-text-tertiary)', text: String(r.weeks) }),
                ...SK.map((key, j) => {
                  const v = Math.round(r.gain[key]);
                  const cls = v === 0 ? 'val-zero' : v < 0 ? 'val-down' : '';
                  return h('td', { class: cls, style: v > 0 ? `color:${SC[j]}` : '', text: v !== 0 ? (v > 0 ? '+' : '') + v : '−' });
                })
              );
            }))
          )
        ),
      ]
    : [];

  replace(area, panel, ...tables);
}

/* ---------- 全体の描画 ---------- */

export function render() {
  const mon = currentMon();
  el('simEmpty').hidden = !!mon;
  el('simBody').hidden = !mon;
  if (!mon) return;

  renderPlan();
  renderResult();
}

/** サブタブが表示されたときに呼ぶ（表の幅計算のため、表示後に描き直す） */
export function onSubTabShown(name) {
  if (!sim()) return;
  if (name === 'plan') renderPlan();
  else if (name === 'result') renderResult();
}

/* ---------- 操作 ---------- */

/** そのセグメント（計画表の1行）に組んであるセット */
function setsAt(s, seg) {
  if (!s.plan[seg]) s.plan[seg] = [newSet(0)];
  return s.plan[seg];
}

export const actions = {
  'sim:addSet': (target) => {
    const s = sim();
    setsAt(s, target.dataset.seg).push(newSet(0));
    renderPlan();
  },

  'sim:delSet': (target) => {
    const s = sim();
    const seg = target.dataset.seg;
    const sets = setsAt(s, seg);
    sets.splice(Number(target.dataset.idx), 1);
    if (!sets.length) s.plan[seg] = [newSet(0)];
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
  'sim:peach': (target) => {
    const s = sim();
    const p = s.peach[Number(target.dataset.pi)];
    const field = target.dataset.field;
    if (field === 'use') p.use = target.checked;
    else p[field] = Number(target.value);
    renderPlan();
  },

  'sim:setField': (target) => {
    // select（重トレ/軽トレ）の変更
    const s = sim();
    const { seg, si, idx, field } = target.dataset;
    const set = setsAt(s, seg)[Number(idx)];
    if (!set) return;
    set[field] = parseInt(target.value, 10);
    // 選んだトレーニングの上昇値をその場で出す（表全体は作り直さない）
    updateTrainGain(seg, Number(si), Number(idx), field, set[field]);
    save();
  },
};

export const inputActions = {
  'sim:setItem': (target) => {
    const s = sim();
    const { seg, idx, name } = target.dataset;
    const set = setsAt(s, seg)[Number(idx)];
    if (!set) return;
    if (!set.items) set.items = {};
    const count = Math.max(0, parseInt(target.value, 10) || 0);
    // 使わないアイテムはキーごと持たない（保存データを小さく保つ）
    if (count === 0) delete set.items[name];
    else set.items[name] = count;
    refreshPlanNumbers();
    save();
  },

  'sim:setField': (target) => {
    const s = sim();
    const { seg, idx, field } = target.dataset;
    const set = setsAt(s, seg)[Number(idx)];
    if (!set) return;

    if (field === 'hc') {
      set.hc = clampInt(target.value, 0, 4, 0);
      const lc = el(`lc-${seg}-${idx}`);
      if (lc) lc.textContent = String(Math.max(0, 4 - set.hc));
    } else {
      set[field] = Math.max(0, parseInt(target.value, 10) || 0);
    }
    refreshPlanNumbers();
    save();
  },
};

export const simpleChanges = {
  // 育成開始の月と週。表に出ている「○月◎週」もその場で書き換える
  'sim:month': (target) => {
    sim().month = clampInt(target.value, 1, 12, 1);
    refreshPlanNumbers();
    save();
  },

  'sim:week': (target) => {
    sim().week = clampInt(target.value, 1, 4, 1);
    refreshPlanNumbers();
    save();
  },
};

/** イベント週の合計（画面の説明文に出す） */
export function eventCostLabel() {
  return `大会-${EV_COST.tc}週 / 修行-${EV_COST.mc}週 / 冒険-${EV_COST.ac}週`;
}
