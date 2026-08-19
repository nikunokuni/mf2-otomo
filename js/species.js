/* ===========================================================
   種族の選択（使い込みタブと育成計算タブで共有する）
   -----------------------------------------------------------
   種族を選ぶ場所はアプリに1つだけ。選び直すと 'species:change'
   イベントが飛び、両方のタブが自分の表示を作り直す。
   =========================================================== */

import { MONSTER_DATA } from './data/monsters.js';
import { state, save, selectSpecies, removeSpecies, ensureMon } from './store.js';
import { el, h, replace } from './dom.js';

export const SPECIES_CHANGED = 'species:change';

/** 使い込み技を持たない種族（育成計算には使えるので、選択そのものは可能） */
export function hasTech(name) {
  return (MONSTER_DATA[name] || []).length > 0;
}

function notifyChange() {
  document.dispatchEvent(new CustomEvent(SPECIES_CHANGED));
}

/* ---------- 種族グリッド（アイコンは開いたときに遅延読み込み） ---------- */

let iconsPromise = null;
function loadIcons() {
  if (!iconsPromise) {
    iconsPromise = import('./data/icons.js')
      .then((m) => m.ICONS)
      .catch((e) => {
        console.warn('アイコンの読み込みに失敗しました:', e);
        return {};
      });
  }
  return iconsPromise;
}

let gridBuilt = false;

async function buildGrid() {
  const grid = el('speciesGrid');
  const icons = await loadIcons();

  const cells = Object.keys(MONSTER_DATA).map((name) => {
    const noTech = !hasTech(name);
    const art = icons[name]
      ? h('img', { src: icons[name], alt: '', loading: 'lazy' })
      : h('div', { class: 'monster-cell__ph' });

    return h(
      'button',
      {
        type: 'button',
        class: 'monster-cell' + (noTech ? ' monster-cell--no-tech' : ''),
        dataset: { action: 'species:add', name },
        attrs: {
          title: noTech ? `${name}（使い込み技なし／育成計算のみ）` : name,
          'aria-current': state.current === name ? 'true' : null,
        },
      },
      art,
      h('span', { text: name })
    );
  });

  replace(grid, cells);
  gridBuilt = true;
}

export function toggleGrid(force) {
  const grid = el('speciesGrid');
  const btn = el('speciesGridToggle');
  const open = force !== undefined ? force : !state.ui.gridOpen;

  state.ui.gridOpen = open;
  grid.hidden = !open;
  btn.textContent = open ? '✕ 閉じる' : '＋ 種族を選んで追加';
  btn.setAttribute('aria-expanded', String(open));

  if (open && !gridBuilt) buildGrid();
  save();
}

/* ---------- 選択中の種族チップ ---------- */

export function renderChips() {
  const chips = state.order.map((name) =>
    h(
      'div',
      { class: 'chip', attrs: { 'aria-current': state.current === name ? 'true' : 'false' } },
      h('button', {
        type: 'button',
        class: 'chip__name',
        text: name,
        dataset: { action: 'species:select', name },
      }),
      h('button', {
        type: 'button',
        class: 'chip__del',
        text: '✕',
        dataset: { action: 'species:remove', name },
        attrs: { 'aria-label': `${name} を削除` },
      })
    )
  );

  const bar = el('speciesChips');
  if (!chips.length) {
    replace(bar, h('span', { class: 'note', text: 'まだ種族が追加されていません' }));
  } else {
    replace(bar, chips);
  }

  // グリッド側の選択状態も合わせる
  if (gridBuilt) {
    el('speciesGrid')
      .querySelectorAll('.monster-cell')
      .forEach((cell) => {
        cell.setAttribute('aria-current', cell.dataset.name === state.current ? 'true' : 'false');
      });
  }
}

/* ---------- 操作 ---------- */

export const actions = {
  'species:toggleGrid': () => toggleGrid(),

  'species:add': (target) => {
    const name = target.dataset.name;
    ensureMon(name);
    selectSpecies(name);
    toggleGrid(false);
    renderChips();
    notifyChange();
  },

  'species:select': (target) => {
    selectSpecies(target.dataset.name);
    renderChips();
    notifyChange();
  },

  'species:remove': (target) => {
    const name = target.dataset.name;
    const ok = confirm(
      `${name} のデータを削除しますか？\n（使い込みの記録と育成計画がどちらも消えます）`
    );
    if (!ok) return;
    removeSpecies(name);
    renderChips();
    notifyChange();
  },
};
