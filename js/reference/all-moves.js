/* ===========================================================
   全技一覧（早見タブ）
   -----------------------------------------------------------
   使い込みタブの「この種族が覚える技」は種族ごとだが、こちらは
   38種族ぶんを1つの表にまとめて出す。種族に関係なく使う一覧なので
   早見タブに置いてある（この箱も state.current を見ない）。

   ・表と並べ替えは js/moves-table.js の共通部品。種族の列だけ増える
   ・並べ替えると **種族をまたいで** 強い順に並ぶ。
     「ダメージのいちばん高い技はどれか」を探すのがこの画面の使いどころ
   ・「最初から持っている技だけ」に絞れる（moves.js の init）。
     種族ごとの表では出していない情報だが、まとめて見るときは
     「どの種族が何を最初から持っているか」の一覧になるので出している
   ・600技を超えるので、たたんだ状態から始める（開閉は state.ui.allMovesOpen）。
     データを取りに行くのも開いたときで、使い込みタブと同じものを使いまわす
   ・並べ替えと絞り込みは画面の中だけの状態（保存しない）。開閉だけ覚える
   =========================================================== */

import { state, save } from '../store.js';
import { h } from '../dom.js';
import {
  allMoves,
  getMoves,
  loadMoves,
  movesTable,
  nextSort,
  sortBar,
  sortedBy,
} from '../moves-table.js';

/** 並べ替え。null なら種族順・表順のまま */
let sort = null;
/** 最初から持っている技だけに絞るかどうか */
let initOnly = false;

/** 描き直しを頼む相手（早見タブ全体）。setup() で受け取る */
let repaint = () => {};

export function setup(render) {
  repaint = render;
}

function filtered() {
  const all = allMoves();
  return initOnly ? all.filter((mv) => mv.init) : all;
}

/** 「最初から持っている技だけ」の切り替えボタン */
function initFilter(shown, total) {
  return h(
    'div',
    { class: 'all-moves__filter' },
    h('button', {
      type: 'button',
      id: 'allMovesInit',
      class: 'moves__sort-btn',
      text: '最初から持っている技だけ',
      dataset: { action: 'allMoves:init' },
      attrs: { 'aria-pressed': String(initOnly) },
    }),
    h('span', {
      class: 'moves__count',
      text: initOnly ? `${shown} / 全${total}技` : `全${total}技`,
    })
  );
}

function body() {
  const total = allMoves().length;
  const list = filtered();
  return h(
    'div',
    {},
    initFilter(list.length, total),
    sortBar(sort, 'allMoves:sort'),
    movesTable(sortedBy(list, sort), { withSpecies: true })
  );
}

/* ---------- 箱 ---------- */

export function allMovesBox() {
  const open = !!state.ui.allMovesOpen;
  const loaded = !!getMoves();

  // 開いているのにデータがまだ無いときは、取りに行ってから描き直す
  if (open && !loaded) loadMoves().then(repaint);

  return h(
    'section',
    { class: 'card ref-box ref-box--auto ref-box--moves' },
    h(
      'button',
      {
        type: 'button',
        class: 'moves__toggle',
        id: 'allMovesToggle',
        dataset: { action: 'allMoves:toggle' },
        attrs: { 'aria-expanded': String(open), 'aria-controls': 'allMovesBody' },
      },
      `${open ? '▼' : '▶'} 全技一覧`,
      h('span', {
        class: 'moves__count',
        text: loaded ? `${allMoves().length}技（全38種族）` : '38種族ぶんまとめて',
      })
    ),
    h('div', { id: 'allMovesBody', hidden: !open }, open && loaded ? body() : null)
  );
}

/* ---------- 操作 ---------- */

export const actions = {
  'allMoves:toggle': () => {
    state.ui.allMovesOpen = !state.ui.allMovesOpen;
    save();
    repaint();
  },

  'allMoves:sort': (target) => {
    sort = nextSort(sort, target.dataset.key);
    repaint();
  },

  'allMoves:init': () => {
    initOnly = !initOnly;
    repaint();
  },
};
