/* ===========================================================
   早見タブ
   -----------------------------------------------------------
   種族に関係なく使う「参照とメモの置き場」。
   ここの箱はどれも state.current を見ない（＝種族を切り替えても変わらない）。
   だから種族チップの帯も、このタブでは隠している（js/tabs.js）。

   ・ローテ … 調整ローテ（育成計算タブ）で「早見のローテに保存」を押したぶんが並ぶ。
     エサ・アイテム・行動と、最初と最後の内部数値を写したもの（state.rotas）で、
     写したあとは動かない。アプリ側であらかじめ入れておくぶんは
     js/data/reference-data.js の ROTATION に書く。
   ・合体素材 … アプリ側のデータを表示する。
     中身は js/data/reference-data.js に書く。
   ・アイテム … アプリに収録したぶん（js/data/items.js。読むだけ）のうしろに、
     自分で足したぶん（state.items）を並べる。足す・直す・消すのもここでやる。
     細かい数値を使うのは育成計算タブ側で、ここは名前と効果を思い出すための場所。
   ・再生メモ … ユーザーが自分で書いて残す。state.notes に保存。
   ・リンク集 … あらかじめ入れた3つ（LINKS）に加えて、
     ユーザーが名前とURLを足せる。足したぶんは state.links に保存。
   ・バックアップ … JSONの書き出しと読み込み。

   箱の高さは固定で、あふれたぶんは箱の中だけがスクロールする
   （高さは css/reference.css の --ref-box-height）。
   リンク集とバックアップだけは中身に合わせて伸びる。
   =========================================================== */

import { ROTATION, COMBI, LINKS } from '../data/reference-data.js';
import { ITEMS, INNER } from '../data/items.js';
import {
  state,
  addNote,
  updateNote,
  removeNote,
  addLink,
  removeLink,
  addItem,
  updateItem,
  removeItem,
  removeSavedRota,
} from '../store.js';
import { el, h, replace } from '../dom.js';

/* ---------- 箱の枠 ---------- */

/** 見出しが固定で、中身だけスクロールする箱をつくる */
function box(title, body, headExtra = null, extraClass = '') {
  return h(
    'section',
    { class: 'card ref-box' + (extraClass ? ' ' + extraClass : '') },
    h('div', { class: 'section-head ref-box__head' }, h('span', { text: title }), headExtra),
    h('div', { class: 'ref-box__body' }, ...[].concat(body))
  );
}

/* ---------- アプリ側で表示するぶん（合体素材） ---------- */

function dataBox(title, rows) {
  if (!rows.length) {
    return box(title, h('div', { class: 'empty', text: '内容はこれから追加します。' }));
  }
  return box(
    title,
    rows.map((row) =>
      h(
        'div',
        { class: 'ref-row' },
        h('span', { class: 'ref-row__name', text: row.name }),
        row.detail ? h('span', { class: 'ref-row__detail', text: row.detail }) : null
      )
    )
  );
}

/* ---------- ローテ ---------- */

/**
 * 状態（内部数値）に出す順。ここに無いキーも写っていれば後ろに続けて出す。
 * 「状態」は内部数値全部なので、キーを増やしても落とさない。
 */
const STATE_ORDER = ['form', 'moral', 'stress', 'fatigue', 'fear', 'spoil', 'fame'];

/** 保存した日時を「2026/08/21 14:30」の形にする。読めない値なら空文字 */
function savedAtText(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** 最初の状態 / 最後の状態の1行。内部数値をラベルつきで並べる */
function stateRow(label, values) {
  const keys = STATE_ORDER.filter((k) => values[k] !== undefined).concat(
    Object.keys(values).filter((k) => !STATE_ORDER.includes(k))
  );
  const text = keys
    .map((k) => `${INNER[k] ? INNER[k].label : k} ${values[k]}`)
    .join(' / ');
  return h(
    'div',
    { class: 'ref-rota__state' },
    h('span', { class: 'ref-rota__state-label', text: label }),
    h('span', { class: 'ref-rota__state-vals', text: text || '—' })
  );
}

/** 1週ぶん。エサ・アイテム・行動を、入っているものだけ並べる */
function savedWeekRow(week) {
  const parts = [];
  if (week.feed) parts.push(`エサ:${week.feed}`);
  if (week.item) parts.push(`アイテム:${week.item}`);
  if (week.act) parts.push(week.act);
  return h(
    'div',
    { class: 'ref-row' },
    h('span', { class: 'ref-row__name', text: week.label }),
    h('span', { class: 'ref-row__detail', text: parts.length ? parts.join(' / ') : 'なし' })
  );
}

/**
 * 保存した調整ローテ1件ぶん。
 * 週数がまちまちなので、たたんでおいて押したときだけ中身を出す。
 */
function savedRotaCard(saved) {
  const stamp = savedAtText(saved.savedAt);
  return h(
    'details',
    { class: 'ref-rota' },
    h(
      'summary',
      { class: 'ref-rota__head' },
      h('span', {
        class: 'ref-rota__name',
        text: `${saved.species || '調整ローテ'}（${saved.weeks.length}週）`,
      }),
      stamp ? h('span', { class: 'ref-rota__date', text: stamp }) : null
    ),
    h(
      'div',
      { class: 'ref-rota__body' },
      stateRow('最初の状態', saved.start),
      ...saved.weeks.map(savedWeekRow),
      stateRow('最後の状態', saved.end),
      h('button', {
        type: 'button',
        class: 'btn btn--sm btn--ng ref-rota__del',
        text: 'このローテを削除',
        dataset: { action: 'ref:delRota', id: saved.id },
      })
    )
  );
}

/**
 * ローテの箱。アプリ側で入れてあるぶん（ROTATION）のうしろに、
 * 調整ローテから保存したぶんを新しい順に並べる。
 */
function rotaBox() {
  const fixed = ROTATION.map((row) =>
    h(
      'div',
      { class: 'ref-row' },
      h('span', { class: 'ref-row__name', text: row.name }),
      row.detail ? h('span', { class: 'ref-row__detail', text: row.detail }) : null
    )
  );

  if (!fixed.length && !state.rotas.length) {
    return box(
      'ローテ',
      h('div', {
        class: 'empty',
        text: '育成計算タブの「調整ローテ」で「早見のローテに保存」を押すと、ここに入ります。',
      })
    );
  }

  return box('ローテ', [...fixed, ...state.rotas.map(savedRotaCard)]);
}

/* ---------- アイテム ---------- */

/** アプリに収録しているぶん。読むだけなので入力欄にはしない */
function builtinItemRow(item, idx) {
  return h(
    'div',
    { class: 'item-row item-row--fixed' },
    h('span', { class: 'item-row__no', text: String(idx + 1) }),
    h('span', { class: 'item-row__name item-row__text', text: item.name }),
    h('span', { class: 'item-row__effect item-row__text', text: item.effect })
  );
}

/** 1つぶんの入力欄。入力中は作り直さない（作り直すとカーソルが飛ぶ） */
function itemField(item, field, label, cls) {
  return h('input', {
    type: 'text',
    class: 'item-row__input ' + cls,
    value: item[field],
    placeholder: label,
    dataset: { input: 'item:field', id: item.id, field },
    attrs: { 'aria-label': label },
  });
}

/** 自分で足したぶん。名前と効果を直せる */
function myItemRow(item, idx) {
  return h(
    'div',
    { class: 'item-row' },
    h('span', { class: 'item-row__no', text: String(ITEMS.length + idx + 1) }),
    itemField(item, 'name', '名前', 'item-row__name'),
    // 狭い画面では効果が次の行に回るので、× は名前と同じ行に残るよう先に置く
    // （広い画面では CSS の order で右端へ回す）
    h('button', {
      type: 'button',
      class: 'item-row__del',
      text: '×',
      dataset: { action: 'item:del', id: item.id },
      attrs: { 'aria-label': 'このアイテムを削除' },
    }),
    itemField(item, 'effect', '効果', 'item-row__effect')
  );
}

function itemsBox() {
  const addBtn = h('button', {
    type: 'button',
    class: 'btn btn--sm btn--primary ref-box__add',
    text: '＋ 追加',
    dataset: { action: 'item:add' },
  });

  const mine = state.items.length
    ? state.items.map(myItemRow)
    : [h('div', { class: 'empty', text: '「＋ 追加」で1件ずつ入れていきます。' })];

  return box(
    `アイテム（${ITEMS.length + state.items.length}件）`,
    [
      ITEMS.length
        ? h('div', { class: 'item-group__title', text: `収録ぶん（${ITEMS.length}件）` })
        : null,
      ...ITEMS.map(builtinItemRow),
      h('div', { class: 'item-group__title', text: '自分で足したぶん' }),
      ...mine,
    ],
    addBtn
  );
}

/* ---------- 再生メモ ---------- */

/** 1行ぶんの入力欄。入力中は作り直さない（作り直すとカーソルが飛ぶ） */
function noteField(note, field, label, multiline = false) {
  const props = {
    class: 'ref-note__input',
    value: note[field],
    placeholder: label,
    dataset: { input: 'ref:note', id: note.id, field },
    attrs: { 'aria-label': label },
  };
  if (multiline) return h('textarea', Object.assign(props, { class: 'ref-note__input ref-note__memo' }));
  return h('input', Object.assign(props, { type: 'text' }));
}

function noteCard(note) {
  return h(
    'div',
    { class: 'ref-note' },
    h(
      'div',
      { class: 'ref-note__row' },
      noteField(note, 'monster', 'モンスター'),
      h('button', {
        type: 'button',
        class: 'ref-note__del',
        text: '×',
        dataset: { action: 'ref:delNote', id: note.id },
        attrs: { 'aria-label': 'このメモを削除' },
      })
    ),
    noteField(note, 'title', 'タイトル'),
    noteField(note, 'singer', '歌手'),
    noteField(note, 'memo', '自由メモ', true)
  );
}

function notesBox() {
  const addBtn = h('button', {
    type: 'button',
    class: 'btn btn--sm btn--primary ref-box__add',
    text: '＋ 追加',
    dataset: { action: 'ref:addNote' },
  });

  const body = state.notes.length
    ? state.notes.map(noteCard)
    : [h('div', { class: 'empty', text: '「＋ 追加」で再生したCDを記録できます。' })];

  return box('再生メモ', body, addBtn);
}

/* ---------- リンク集 ---------- */

/** 名前がそのままボタンになる。押すと別タブでリンクを開く */
function linkButton(link, deletable) {
  return h(
    'div',
    { class: 'ref-link' },
    h('a', {
      class: 'ref-link__btn',
      text: link.name,
      href: link.url,
      attrs: { target: '_blank', rel: 'noopener noreferrer', title: link.url },
    }),
    deletable
      ? h('button', {
          type: 'button',
          class: 'ref-link__del',
          text: '×',
          dataset: { action: 'ref:delLink', id: link.id },
          attrs: { 'aria-label': `${link.name} を削除` },
        })
      : null
  );
}

function linksBox() {
  const form = h(
    'div',
    { class: 'ref-link-form' },
    h('input', {
      type: 'text',
      id: 'refLinkName',
      class: 'ref-link-form__input',
      placeholder: '名前',
      attrs: { 'aria-label': 'リンクの名前' },
    }),
    h('input', {
      type: 'url',
      id: 'refLinkUrl',
      class: 'ref-link-form__input',
      placeholder: 'https://…',
      attrs: { 'aria-label': 'リンクのURL' },
    }),
    h('button', {
      type: 'button',
      class: 'btn btn--sm btn--primary',
      text: '追加',
      dataset: { action: 'ref:addLink' },
    })
  );

  return box(
    'リンク集',
    [
      h('div', { class: 'ref-links' }, LINKS.map((link) => linkButton(link, false))),
      state.links.length
        ? h('div', { class: 'ref-links' }, state.links.map((link) => linkButton(link, true)))
        : null,
      form,
      h('div', { class: 'ref-link-form__error', id: 'refLinkError' }),
    ],
    null,
    'ref-box--auto'
  );
}

/* ---------- バックアップ ---------- */

function backupBox() {
  return box(
    'データのバックアップ',
    [
      h('p', {
        class: 'note',
        style: 'margin-bottom:10px',
        text:
          '記録はこの端末のブラウザに保存されています。機種変更のときや、' +
          'しばらく使わずに消えてしまうのが心配なときは、書き出しておいてください。',
      }),
      h(
        'div',
        { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'JSONで書き出し',
          dataset: { action: 'backup:export' },
        }),
        h('button', {
          type: 'button',
          class: 'btn',
          text: 'JSONから読み込み',
          dataset: { action: 'backup:import' },
        }),
        h('input', {
          type: 'file',
          id: 'importFile',
          hidden: true,
          dataset: { change: 'backup:file' },
          attrs: { accept: 'application/json,.json' },
        })
      ),
    ],
    null,
    'ref-box--auto'
  );
}

/* ---------- 描画 ---------- */

export function render() {
  const area = el('referenceArea');
  if (!area) return;
  replace(
    area,
    h(
      'div',
      { class: 'ref-grid' },
      rotaBox(),
      itemsBox(),
      dataBox('合体素材', COMBI),
      notesBox(),
      linksBox(),
      backupBox()
    )
  );
}

export const actions = {
  'ref:addNote': () => {
    addNote();
    render();
    // 追加した1件目の入力欄にすぐ書けるようにする
    const first = el('referenceArea').querySelector('.ref-note__input');
    if (first) first.focus();
  },

  'ref:delNote': (target) => {
    if (!confirm('このメモを削除します。よろしいですか？')) return;
    removeNote(target.dataset.id);
    render();
  },

  'ref:delRota': (target) => {
    if (!confirm('保存したこのローテを削除します。よろしいですか？')) return;
    removeSavedRota(target.dataset.id);
    render();
  },

  'ref:addLink': () => {
    const nameInput = el('refLinkName');
    const urlInput = el('refLinkUrl');
    const error = el('refLinkError');
    const name = nameInput.value.trim();

    if (!name) {
      error.textContent = '名前を入力してください';
      nameInput.focus();
      return;
    }
    // http/https 以外は addLink 側で弾かれる
    if (!addLink(name, urlInput.value)) {
      error.textContent = 'リンクは http:// か https:// で始まるURLを入れてください';
      urlInput.focus();
      return;
    }
    render();
    el('refLinkName').focus();
  },

  'ref:delLink': (target) => {
    if (!confirm('このリンクを削除します。よろしいですか？')) return;
    removeLink(target.dataset.id);
    render();
  },

  'item:add': () => {
    addItem();
    render();
    // 続けて入力できるように、足した行の名前欄へ移動する
    const inputs = el('referenceArea').querySelectorAll('input.item-row__name');
    const last = inputs[inputs.length - 1];
    if (last) {
      last.focus();
      last.scrollIntoView({ block: 'nearest' });
    }
  },

  'item:del': (target) => {
    if (!confirm('このアイテムを削除します。よろしいですか？')) return;
    removeItem(target.dataset.id);
    render();
  },
};

export const inputActions = {
  // 入力のたびに保存する。描画はしないので入力中のカーソルは動かない
  'ref:note': (target) => {
    updateNote(target.dataset.id, target.dataset.field, target.value);
  },

  'item:field': (target) => {
    updateItem(target.dataset.id, target.dataset.field, target.value);
  },
};
