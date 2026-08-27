/* ===========================================================
   技一覧の共通部品
   -----------------------------------------------------------
   同じ表を2か所で出すので、そのぶんをここにまとめてある。

   ・使い込みタブの「この種族が覚える技」（js/tracker/moves.js）
   ・早見タブの「全技一覧」（js/reference/all-moves.js）

   違うのは「どの技を並べるか」と「種族の列を出すかどうか」だけで、
   セルの見た目・並べ替えの決まり・データの取りに行き方は共通。

   データ（js/data/moves.js）は初めて必要になったときに取りに行き、
   2か所で同じものを使いまわす（2度読み込まない）。
   =========================================================== */

import { h } from './dom.js';

/* ---------- データの遅延読み込み ---------- */

let movesPromise = null;
let MOVES = null;

/** 読み込みずみなら全種族ぶんの技データ、まだなら null */
export function getMoves() {
  return MOVES;
}

/** 1種族ぶんの技。まだ読み込んでいなければ空 */
export function movesOf(species) {
  return (MOVES && MOVES[species]) || [];
}

/** 全種族ぶんを1本に並べた配列。各技に species を足して返す */
export function allMoves() {
  if (!MOVES) return [];
  return Object.entries(MOVES).flatMap(([species, list]) =>
    list.map((mv) => Object.assign({ species }, mv))
  );
}

export function loadMoves() {
  if (!movesPromise) {
    movesPromise = import('./data/moves.js')
      .then((m) => {
        MOVES = m.MOVES;
        return MOVES;
      })
      .catch((e) => {
        console.warn('技データの読み込みに失敗しました:', e);
        MOVES = {};
        return MOVES;
      });
  }
  return movesPromise;
}

/* ---------- セルの部品 ---------- */

const NONE = () => h('span', { class: 'moves-table__none', text: '—' });

/** [ランク, 数値] を色つきのバッジにする。表の E(6) と同じ見た目 */
function rankCell(pair) {
  if (!pair) return NONE();
  const [rank, value] = pair;
  return h('span', { class: `rank rank--${rank}`, text: `${rank}(${value})` });
}

/** ヨイワル。マイナスはワル、プラスはヨイ */
function moralCell(moral) {
  if (moral === null || moral === undefined) return NONE();
  const good = moral > 0;
  return h('span', {
    class: good ? 'moves-moral--good' : 'moves-moral--bad',
    text: `${good ? 'ヨイ' : 'ワル'}(${good ? '+' : ''}${moral})`,
  });
}

/* ---------- 表 ---------- */

const COLS = [
  '技名', '種類', '距離', '消費G', 'ダメージ', '命中', 'GD', 'CR',
  'ヨイワル', '当時間', '外時間', '移動(当)', '移動(外)', '連射', '備考',
];

/**
 * 技の表をつくる。
 * withSpecies を立てると、技名のとなりに種族の列を足す（早見タブの全技一覧）。
 * 技名の列は左に貼り付けてあるので、足すのは必ず2列目にする。
 */
export function movesTable(list, { withSpecies = false } = {}) {
  const cols = withSpecies ? [COLS[0], '種族', ...COLS.slice(1)] : COLS;

  const rows = list.map((mv) =>
    h(
      'tr',
      {},
      h('td', { class: `moves-name--${mv.stat}`, text: mv.name }),
      withSpecies ? h('td', { class: 'moves-table__species', text: mv.species }) : null,
      h('td', { text: mv.kind }),
      h('td', { text: String(mv.dist) }),
      h('td', { text: String(mv.guts) }),
      h('td', {}, rankCell(mv.dmg)),
      h('td', {}, rankCell(mv.acc)),
      h('td', {}, rankCell(mv.gd)),
      h('td', {}, rankCell(mv.cr)),
      h('td', {}, moralCell(mv.moral)),
      h('td', { text: mv.tHit.toFixed(1) }),
      h('td', { text: mv.tMiss.toFixed(1) }),
      h('td', { text: mv.mvHit }),
      h('td', { text: mv.mvMiss }),
      h('td', { text: mv.rapid }),
      h('td', { class: 'moves-table__note' }, mv.note ? mv.note : NONE())
    )
  );

  return h(
    'div',
    { class: 'scroll-x' },
    h(
      'table',
      { class: 'table moves-table' },
      h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })))),
      h('tbody', {}, rows)
    )
  );
}

/* ---------- 並べ替え ---------- */

/** [ランク, 数値] の数値のほう。空欄は null */
function rankValue(pair) {
  return pair ? pair[1] : null;
}

/**
 * 並べ替えに使える列。
 *   value  その技の値を取り出す（空欄の技は null）
 *   desc   はじめに押したときの向き。true=大きい順
 *          ダメージや命中は「大きいほど強い」ので大きい順、
 *          消費ガッツと当時間は「小さいほど良い」ので小さい順から始める
 */
export const SORTS = {
  guts: { label: 'G', title: '消費ガッツ', value: (mv) => mv.guts, desc: false },
  dmg: { label: 'ダメ', title: 'ダメージ', value: (mv) => rankValue(mv.dmg), desc: true },
  acc: { label: '命', title: '命中', value: (mv) => rankValue(mv.acc), desc: true },
  gd: { label: 'GD', title: 'ガッツダウン', value: (mv) => rankValue(mv.gd), desc: true },
  cr: { label: 'CR', title: 'クリティカル', value: (mv) => rankValue(mv.cr), desc: true },
  tHit: { label: '時間', title: '当たったときの使用時間', value: (mv) => mv.tHit, desc: false },
};

/**
 * 並べ替えた配列を返す。sort が null なら @wiki の表のままの並び。
 * 空欄（—）の技は、どちらの向きでも必ずいちばん下に置く。
 * 同じ値どうしはもとの並びのまま（JS の sort は安定なので、そのままで保たれる）。
 */
export function sortedBy(list, sort) {
  if (!sort) return list;
  const { value } = SORTS[sort.key];
  return list.slice().sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sort.desc ? vb - va : va - vb;
  });
}

/**
 * 並べ替えボタンを押したときの次の状態。
 *   押していない → その列で並べ替え → 逆順 → 表のままに戻る
 */
export function nextSort(sort, key) {
  if (!sort || sort.key !== key) return { key, desc: SORTS[key].desc };
  if (sort.desc === SORTS[key].desc) return { key, desc: !sort.desc };
  return null;
}

/** 並べ替えのボタン列。action は押したときに呼ぶ data-action の名前 */
export function sortBar(sort, action) {
  return h(
    'div',
    { class: 'moves__sort' },
    Object.entries(SORTS).map(([key, { label, title, desc }]) => {
      const on = sort && sort.key === key;
      const arrow = on ? (sort.desc ? ' ▼' : ' ▲') : '';
      return h('button', {
        type: 'button',
        class: 'moves__sort-btn',
        text: label + arrow,
        dataset: { action, key },
        attrs: {
          'aria-pressed': String(!!on),
          'aria-label': on
            ? `${title}で並べ替え中（${sort.desc ? '大きい順' : '小さい順'}）`
            : `${title}で並べ替える（${desc ? '大きい順' : '小さい順'}）`,
        },
      });
    })
  );
}
