/* ===========================================================
   技一覧（使い込みタブのいちばん下、たたんだカード）
   -----------------------------------------------------------
   その種族が覚える技を、有志Wikiの表そのままの並びで出すだけの画面。
   計算にも保存データにも関わらない（読むだけ）。

   ・畳み方は調整ローテの「開始時点の内部数値」と同じ作りで、
     開いたかどうかは state.ui.movesOpen に覚える
   ・データ（js/data/moves.js）は、初めて開いたときに取りに行く。
     全種族ぶんが入ると50KB前後になる見込みなので、アイコンと同じ遅延読み込み
   ・距離での絞り込みは画面の中だけの状態（保存しない）
   ・技名の地色は @wiki と同じ塗り分け（黄＝ちから技 / 緑＝かしこさ技）。
     色の意味は画面には書かない（見れば分かるので）
   =========================================================== */

import { state, save } from '../store.js';
import { el, h, replace } from '../dom.js';

/** 距離の絞り込み。null は「ぜんぶ」 */
let distFilter = null;

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

/** 距離の絞り込みボタン。1=近 … 4=遠 */
function filterBar(list) {
  const buttons = [{ label: 'ぜんぶ', dist: null }].concat(
    [1, 2, 3, 4].map((d) => ({
      label: d === 1 ? '近1' : d === 4 ? '遠4' : String(d),
      dist: d,
    }))
  );

  return h(
    'div',
    { class: 'moves__filter' },
    buttons.map(({ label, dist }) => {
      const count = dist === null ? list.length : list.filter((mv) => mv.dist === dist).length;
      return h('button', {
        type: 'button',
        class: 'moves__filter-btn',
        text: `${label}（${count}）`,
        dataset: { action: 'moves:filter', dist: dist === null ? '' : String(dist) },
        attrs: { 'aria-pressed': String(distFilter === dist) },
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
  const shown = distFilter === null ? all : all.filter((mv) => mv.dist === distFilter);
  return h('div', {}, filterBar(all), table(shown));
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

  'moves:filter': (target) => {
    const raw = target.dataset.dist;
    distFilter = raw === '' ? null : Number(raw);
    render();
  },
};
