/* ===========================================================
   使い込みタブ
   -----------------------------------------------------------
   ・技ごとの累計使い込み回数を管理する
   ・「大会開始」してから回数を数え、合格なら累計に足す／
     やり直しなら破棄する
   ・記録は種族ごと・技ごとに残るので、技の選択を外しても消えない
   =========================================================== */

import { MONSTER_DATA } from '../data/monsters.js';
import { state, save, currentMon, techKey } from '../store.js';
import { el, h, replace } from '../dom.js';
import { hasTech } from '../species.js';
import { calcIdeal } from './ideal.js';

/** 選択画面で仮に入れておくチェック状態（確定するまで state には書かない） */
let pickState = null;

function techsOf(name) {
  return MONSTER_DATA[name] || [];
}

function progressOf(mon, key) {
  if (!mon.progress[key]) mon.progress[key] = { total: 0, done: false, session: 0 };
  return mon.progress[key];
}

/* ---------- 技の選択 ---------- */

function openPicker() {
  const mon = currentMon();
  if (!mon || !hasTech(state.current)) return;
  pickState = new Set(mon.selected);
  renderPicker();
  el('techPickerCard').hidden = false;
  el('trackerMain').hidden = true;
}

function closePicker() {
  pickState = null;
  el('techPickerCard').hidden = true;
  render();
}

function renderPicker() {
  const mon = currentMon();
  if (!mon || !pickState) return;

  const items = techsOf(state.current).map((tech) => {
    const key = techKey(tech);
    const checked = pickState.has(key);
    const saved = mon.progress[key];

    const label = h(
      'span',
      { class: 'tech-picker__label' },
      `${tech.from} → `,
      h('strong', { text: tech.to }),
      tech.milestone
        ? h('span', {
            class: 'badge badge--milestone',
            text: `+${tech.milestone.to}@${tech.milestone.need}回`,
          })
        : null,
      saved && saved.total > 0
        ? h('span', { class: 'tech-picker__saved', text: `（記録:${saved.total}回）` })
        : null
    );

    return h(
      'label',
      { class: 'tech-picker__item' + (checked ? ' is-selected' : '') },
      h('input', {
        type: 'checkbox',
        checked,
        dataset: { change: 'tracker:togglePick', key },
      }),
      label,
      h('span', { class: 'tech-picker__sub', text: `G:${tech.guts}` })
    );
  });

  replace(el('techPickerList'), items);
  el('techPickerCount').textContent = `${pickState.size}件選択中`;
}

/* ---------- 使い込み表 ---------- */

function renderTechTable() {
  const mon = currentMon();
  const body = el('techBody');
  const all = techsOf(state.current);

  if (!hasTech(state.current)) {
    replace(
      body,
      h(
        'tr',
        {},
        h('td', {
          class: 'empty',
          text: 'この種族に使い込みで進化する技はありません（育成計算タブは使えます）',
          attrs: { colspan: 6 },
        })
      )
    );
    return;
  }
  if (!mon.selected.length) {
    replace(
      body,
      h(
        'tr',
        {},
        h('td', {
          class: 'empty',
          text: '技が選択されていません。「技を変更」から選んでください。',
          attrs: { colspan: 6 },
        })
      )
    );
    return;
  }

  const guts = mon.guts || 15;

  const rows = mon.selected
    .map((key) => all.find((t) => techKey(t) === key))
    .filter(Boolean)
    .map((tech) => {
      const key = techKey(tech);
      const p = progressOf(mon, key);
      const pct = Math.min(100, Math.round((p.total / tech.need) * 100));

      const nameCell = h(
        'td',
        { class: 'tech-name' },
        h('span', { class: 'tech-name__from', text: tech.from }),
        h('strong', { class: 'tech-name__to', text: '→' + tech.to }),
        tech.milestone
          ? h('div', {
              class: 'tech-name__milestone',
              text: `${tech.milestone.need}回→${tech.milestone.to}も習得`,
            })
          : null
      );

      const totalCell = p.done
        ? h('td', {}, h('span', { class: 'done-text', text: '✓完了' }))
        : h(
            'td',
            {},
            h('div', { style: 'font-size:12px;white-space:nowrap', text: `${p.total}/${tech.need}` }),
            h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: `width:${pct}%` }))
          );

      const sessionCell =
        mon.inSession && !p.done
          ? h(
              'td',
              {},
              h(
                'div',
                { class: 'counter' },
                h('button', {
                  type: 'button',
                  text: '−',
                  dataset: { action: 'tracker:count', key, delta: '-1' },
                  attrs: { 'aria-label': `${tech.from} を1回減らす` },
                }),
                h('span', { class: 'counter__val', text: String(p.session || 0) }),
                h('button', {
                  type: 'button',
                  text: '＋',
                  dataset: { action: 'tracker:count', key, delta: '1' },
                  attrs: { 'aria-label': `${tech.from} を1回増やす` },
                })
              )
            )
          : h('td', { style: 'color:var(--color-text-tertiary)', text: '—' });

      return h(
        'tr',
        {},
        nameCell,
        totalCell,
        sessionCell,
        h('td', { text: String(tech.guts) }),
        h('td', {}, h('span', { class: 'ideal-hit', text: String(calcIdeal(tech.guts, tech.hit, guts)) })),
        h('td', {}, h('span', { class: 'ideal-miss', text: String(calcIdeal(tech.guts, tech.miss, guts)) }))
      );
    });

  replace(body, rows);
}

/** 理想回数の前提になっているガッツ回復速度を、表の下に一言そえる */
function renderGutsHint() {
  const mon = currentMon();
  el('gutsHint').textContent =
    `理想回数はガッツ回復 ${mon.guts || 15}秒/30ガッツ で計算しています（変えるのはモンスタータブ）`;
}

function renderSessionControls() {
  const mon = currentMon();
  const box = el('sessionControls');

  // 数える技が1つもないなら、大会を開始しても意味がないのでボタンを出さない
  if (!mon.selected.length) {
    replace(box);
    return;
  }

  if (!mon.inSession) {
    replace(
      box,
      h('button', {
        type: 'button',
        class: 'btn btn--primary btn--block',
        text: '大会開始',
        dataset: { action: 'tracker:start' },
      })
    );
    return;
  }
  replace(
    box,
    h('button', {
      type: 'button',
      class: 'btn btn--ok',
      text: '✓ 合格（累計に追加）',
      dataset: { action: 'tracker:confirm' },
      style: 'flex:1;padding:10px;font-size:14px',
    }),
    h('button', {
      type: 'button',
      class: 'btn btn--ng',
      text: '✗ やり直し（破棄）',
      dataset: { action: 'tracker:cancel' },
      style: 'flex:1;padding:10px;font-size:14px',
    })
  );
}

function renderLog() {
  const mon = currentMon();
  const area = el('logArea');
  if (!mon.log.length) {
    replace(area, h('div', { class: 'empty', text: 'まだ記録がありません' }));
    return;
  }
  replace(
    area,
    mon.log.slice(0, 15).map((entry) =>
      h(
        'div',
        { class: 'log-item' },
        h('span', {
          class: 'log-item__text ' + (entry.type === 'ok' ? 'log-ok' : 'log-ng'),
          text: (entry.type === 'ok' ? '✓ ' : '✗ ') + entry.text,
        }),
        h('span', { class: 'log-item__date', text: entry.date })
      )
    )
  );
}

/* ---------- 全体の描画 ---------- */

export function render() {
  const mon = currentMon();
  const empty = el('trackerEmpty');
  const main = el('trackerMain');

  if (!mon) {
    empty.hidden = false;
    main.hidden = true;
    el('techPickerCard').hidden = true;
    return;
  }
  empty.hidden = true;
  if (!el('techPickerCard').hidden) return; // 技選択中は触らない
  main.hidden = false;

  el('trackerSpeciesLabel').textContent = state.current;
  el('changeTechBtn').hidden = !hasTech(state.current);

  const badge = el('sessionBadge');
  badge.className = mon.inSession ? 'badge badge--active' : 'badge';
  badge.textContent = mon.inSession ? '大会中' : '大会なし';

  el('memo').value = mon.memo || '';

  renderGutsHint();
  renderTechTable();
  renderSessionControls();
  renderLog();
}

/* ---------- 操作 ---------- */

export const actions = {
  'tracker:openPicker': openPicker,
  'tracker:cancelPick': closePicker,

  'tracker:applyPick': () => {
    const mon = currentMon();
    if (!mon || !pickState) return;
    // MONSTER_DATA の並び順を保つ
    mon.selected = techsOf(state.current)
      .map(techKey)
      .filter((k) => pickState.has(k));
    mon.selected.forEach((k) => progressOf(mon, k));
    save();
    closePicker();
  },

  'tracker:count': (target) => {
    const mon = currentMon();
    if (!mon || !mon.inSession) return;
    const p = progressOf(mon, target.dataset.key);
    if (p.done) return;
    p.session = Math.max(0, (p.session || 0) + Number(target.dataset.delta));
    save();
    renderTechTable();
  },

  'tracker:start': () => {
    const mon = currentMon();
    if (!mon) return;
    mon.inSession = true;
    mon.selected.forEach((k) => (progressOf(mon, k).session = 0));
    save();
    render();
  },

  'tracker:confirm': () => {
    const mon = currentMon();
    if (!mon) return;
    const all = techsOf(state.current);
    const gains = [];

    mon.selected.forEach((key) => {
      const p = progressOf(mon, key);
      if (!p.session) return;
      const tech = all.find((t) => techKey(t) === key);
      p.total += p.session;
      gains.push(`${tech ? tech.from : key}+${p.session}`);
      if (tech && p.total >= tech.need) p.done = true;
      p.session = 0;
    });

    mon.inSession = false;
    mon.log.unshift({
      type: 'ok',
      text: `合格: ${gains.length ? gains.join(', ') : 'なし'}`,
      date: new Date().toLocaleDateString('ja-JP'),
    });
    save();
    render();
  },

  'tracker:cancel': () => {
    const mon = currentMon();
    if (!mon) return;
    const discarded = [];
    const all = techsOf(state.current);

    mon.selected.forEach((key) => {
      const p = progressOf(mon, key);
      if (!p.session) return;
      const tech = all.find((t) => techKey(t) === key);
      discarded.push(`${tech ? tech.from : key}+${p.session}`);
      p.session = 0;
    });

    mon.inSession = false;
    mon.log.unshift({
      type: 'ng',
      text: `やり直し: ${discarded.length ? discarded.join(', ') + ' を破棄' : 'なし'}`,
      date: new Date().toLocaleDateString('ja-JP'),
    });
    save();
    render();
  },
};

export const changeActions = {
  'tracker:togglePick': (target) => {
    if (!pickState) return;
    const key = target.dataset.key;
    if (target.checked) pickState.add(key);
    else pickState.delete(key);
    renderPicker();
  },
};

export const inputActions = {
  // B1: 旧トラッカーではこの保存処理が存在せず、メモが一切残らなかった
  'tracker:memo': (target) => {
    const mon = currentMon();
    if (!mon) return;
    mon.memo = target.value;
    save();
  },
};

/**
 * まだ1つも技を選んでいない種族なら、技選択を開いた状態で始める。
 * 種族を足す場所がモンスタータブに移ったので、
 * 「使い込みタブを開いたとき」がこの案内を出すタイミングになる。
 */
export function openPickerIfEmpty() {
  const mon = currentMon();
  if (!mon || !hasTech(state.current)) return;
  if (mon.selected.length) return;
  if (!el('techPickerCard').hidden) return;
  openPicker();
}
