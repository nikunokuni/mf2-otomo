/* ===========================================================
   早見タブ
   -----------------------------------------------------------
   育成中に「あれ、どうだったっけ」となる情報を、
   4つの箱に並べてさっと確認するための画面。

   ・ローテ / アイテム / 合体素材 … アプリ側のデータを表示する。
     中身は js/data/reference-data.js に書く。
   ・再生メモ … ユーザーが自分で書いて残す。state.notes に保存。

   箱の高さは固定で、あふれたぶんは箱の中だけがスクロールする
   （高さは css/reference.css の --ref-box-height）。
   =========================================================== */

import { ROTATION, ITEMS, COMBI } from '../data/reference-data.js';
import { state, addNote, updateNote, removeNote } from '../store.js';
import { el, h, replace } from '../dom.js';

/* ---------- 箱の枠 ---------- */

/** 見出しが固定で、中身だけスクロールする箱をつくる */
function box(title, body, headExtra = null) {
  return h(
    'section',
    { class: 'card ref-box' },
    h('div', { class: 'section-head ref-box__head' }, h('span', { text: title }), headExtra),
    h('div', { class: 'ref-box__body' }, ...[].concat(body))
  );
}

/* ---------- アプリ側で表示する3つ ---------- */

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

/* ---------- 描画 ---------- */

export function render() {
  const area = el('referenceArea');
  if (!area) return;
  replace(
    area,
    h(
      'div',
      { class: 'ref-grid' },
      dataBox('ローテ', ROTATION),
      dataBox('アイテム', ITEMS),
      dataBox('合体素材', COMBI),
      notesBox()
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
};

export const inputActions = {
  // 入力のたびに保存する。描画はしないので入力中のカーソルは動かない
  'ref:note': (target) => {
    updateNote(target.dataset.id, target.dataset.field, target.value);
  },
};
