/* ===========================================================
   技一覧（使い込みタブのいちばん下、たたんだカード）
   -----------------------------------------------------------
   その種族が覚える技を、有志Wikiの表そのままの並びで出すだけの画面。
   計算にも保存データにも関わらない（読むだけ）。

   ・畳み方は調整ローテの「開始時点の内部数値」と同じ作りで、
     開いたかどうかは state.ui.movesOpen に覚える
   ・データ（js/data/moves.js）は、初めて開いたときに取りに行く。
     全種族ぶんが入ると50KB前後になる見込みなので、アイコンと同じ遅延読み込み
   ・並べ替えは画面の中だけの状態（保存しない）。
     はじめは @wiki の表の並びのままで、押した列で並べ替える
   ・技名の地色は @wiki と同じ塗り分け（黄＝ちから技 / 緑＝かしこさ技）。
     色の意味は画面には書かない（見れば分かるので）
   =========================================================== */

import { state, save } from '../store.js';
import { el, h, replace } from '../dom.js';

/**
 * 並べ替え。null なら @wiki の表のままの並び。
 * key は SORTS のキー、desc は大きい順かどうか。
 */
let sort = null;

/* ---------- データの遅延読み込み ---------- */

let movesPromise = null;
let MOVES = null;

function loadMoves() {
  if (!movesPromise) {
    movesPromise = import('../data/moves.js')
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

function movesOf(species) {
  return (MOVES && MOVES[species]) || [];
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

function table(list) {
  const rows = list.map((mv) =>
    h(
      'tr',
      {},
      h('td', { class: `moves-name--${mv.stat}`, text: mv.name }),
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
      h('thead', {}, h('tr', {}, COLS.map((c) => h('th', { text: c })))),
      h('tbody', {}, rows)
    )
  );
}

/* ---------- 並べ替え ---------- */

/**
 * 並べ替えに使える列。
 *   value  その技の値を取り出す（空欄の技は null）
 *   desc   はじめに押したときの向き。true=大きい順
 *          ダメージや命中は「大きいほど強い」ので大きい順、
 *          消費ガッツと当時間は「小さいほど良い」ので小さい順から始める
 */
const SORTS = {
  guts: { label: 'G', title: '消費ガッツ', value: (mv) => mv.guts, desc: false },
  dmg: { label: 'ダメ', title: 'ダメージ', value: (mv) => rankValue(mv.dmg), desc: true },
  acc: { label: '命', title: '命中', value: (mv) => rankValue(mv.acc), desc: true },
  gd: { label: 'GD', title: 'ガッツダウン', value: (mv) => rankValue(mv.gd), desc: true },
  cr: { label: 'CR', title: 'クリティカル', value: (mv) => rankValue(mv.cr), desc: true },
  tHit: { label: '時間', title: '当たったときの使用時間', value: (mv) => mv.tHit, desc: false },
};

/** [ランク, 数値] の数値のほう。空欄は null */
function rankValue(pair) {
  return pair ? pair[1] : null;
}

/**
 * 並べ替えた配列を返す。
 * 空欄（—）の技は、どちらの向きでも必ずいちばん下に置く。
 * 同じ値どうしは @wiki の表の並びのまま（JS の sort は安定なので、そのままで保たれる）。
 */
function sorted(list) {
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
 * 並べ替えのボタン。押すたびに
 *   押していない → その列で並べ替え → 逆順 → 表のままに戻る
 * と変わる。
 */
function sortBar() {
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
        dataset: { action: 'moves:sort', key },
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

function body(species) {
  const all = movesOf(species);
  if (!all.length) {
    return h('div', {
      class: 'empty',
      text: 'この種族の技データはまだ入っていません。',
    });
  }
  return h('div', {}, sortBar(), table(sorted(all)));
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
  const count = MOVES ? movesOf(state.current).length : null;

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
    h('div', { id: 'movesBody', hidden: !open }, open && MOVES ? body(state.current) : null)
  );

  // 開いているのにデータがまだ無いときは、取りに行ってから描き直す
  if (open && !MOVES) loadMoves().then(render);
}

/* ---------- 操作 ---------- */

export const actions = {
  'moves:toggle': () => {
    state.ui.movesOpen = !state.ui.movesOpen;
    save();
    render();
  },

  'moves:sort': (target) => {
    const key = target.dataset.key;
    if (!sort || sort.key !== key) sort = { key, desc: SORTS[key].desc };
    // 同じ列をもう一度押したら逆順に、そのあともう一度で表のままに戻す
    else if (sort.desc === SORTS[key].desc) sort = { key, desc: !sort.desc };
    else sort = null;
    render();
  },
};
