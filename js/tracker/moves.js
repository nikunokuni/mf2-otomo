/* ===========================================================
   技一覧（使い込みタブのいちばん下、たたんだカード）
   -----------------------------------------------------------
   その種族が覚える技を、有志Wikiの表そのままの並びで出すだけの画面。
   計算にも保存データにも関わらない（読むだけ）。

   ・畳み方は調整ローテの「開始時点の内部数値」と同じ作りで、
     開いたかどうかは state.ui.movesOpen に覚える
   ・表・並べ替え・データの取りに行き方は js/moves-table.js に置いてある
     （早見タブの「全技一覧」と同じものを使う）
   ・並べ替えは画面の中だけの状態（保存しない）。
     はじめは @wiki の表の並びのままで、押した列で並べ替える
   ・技名の地色は @wiki と同じ塗り分け（黄＝ちから技 / 緑＝かしこさ技）。
     色の意味は画面には書かない（見れば分かるので）
   =========================================================== */

import { state, save } from '../store.js';
import { el, h, replace } from '../dom.js';
import {
  getMoves,
  loadMoves,
  movesOf,
  movesTable,
  nextSort,
  sortBar,
  sortedBy,
} from '../moves-table.js';

/**
 * 並べ替え。null なら @wiki の表のままの並び。
 * key は SORTS のキー、desc は大きい順かどうか。
 */
let sort = null;

function body(species) {
  const all = movesOf(species);
  if (!all.length) {
    return h('div', {
      class: 'empty',
      text: 'この種族の技データはまだ入っていません。',
    });
  }
  return h('div', {}, sortBar(sort, 'moves:sort'), movesTable(sortedBy(all, sort)));
}

/* ---------- 描画 ---------- */

export function render() {
  const card = el('movesCard');
  if (!card) return;

  if (!state.current) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  const open = !!state.ui.movesOpen;
  const loaded = !!getMoves();
  const count = loaded ? movesOf(state.current).length : null;

  replace(
    card,
    h(
      'button',
      {
        type: 'button',
        class: 'moves__toggle',
        id: 'movesToggle',
        dataset: { action: 'moves:toggle' },
        attrs: { 'aria-expanded': String(open), 'aria-controls': 'movesBody' },
      },
      `${open ? '▼' : '▶'} この種族が覚える技`,
      count !== null ? h('span', { class: 'moves__count', text: `全${count}技` }) : null
    ),
    h('div', { id: 'movesBody', hidden: !open }, open && loaded ? body(state.current) : null)
  );

  // 開いているのにデータがまだ無いときは、取りに行ってから描き直す
  if (open && !loaded) loadMoves().then(render);
}

/* ---------- 操作 ---------- */

export const actions = {
  'moves:toggle': () => {
    state.ui.movesOpen = !state.ui.movesOpen;
    save();
    render();
  },

  'moves:sort': (target) => {
    sort = nextSort(sort, target.dataset.key);
    render();
  },
};
