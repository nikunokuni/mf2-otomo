/* ===========================================================
   早見タブ
   -----------------------------------------------------------
   育成中に「あれ、どうだったっけ」となる情報を、
   箱に並べてさっと確認するための画面。

   ・ローテ / アイテム / 合体素材 … アプリ側のデータを表示する。
     中身は js/data/reference-data.js に書く。
     アイテムだけは、育成計算タブの「アイテム」で入れたぶん（state.items）も
     続けて並べる。
   ・再生メモ … ユーザーが自分で書いて残す。state.notes に保存。
   ・リンク集 … あらかじめ入れた3つ（LINKS）に加えて、
     ユーザーが名前とURLを足せる。足したぶんは state.links に保存。

   箱の高さは固定で、あふれたぶんは箱の中だけがスクロールする
   （高さは css/reference.css の --ref-box-height）。
   =========================================================== */

import { ROTATION, ITEMS, COMBI, LINKS } from '../data/reference-data.js';
import { state, addNote, updateNote, removeNote, addLink, removeLink } from '../store.js';
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

/**
 * アイテムの箱に出す行。
 * アプリ側のデータ（ITEMS）のうしろに、育成計算タブで入れたぶんを並べる。
 * 名前も効果も空の行（追加した直後でまだ書いていない行）は出さない。
 */
function itemRows() {
  return [
    ...ITEMS,
    ...state.items
      .filter((i) => i.name || i.effect)
      .map((i) => ({ name: i.name, detail: i.effect })),
  ];
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
    'ref-box--links'
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
      dataBox('ローテ', ROTATION),
      dataBox('アイテム', itemRows()),
      dataBox('合体素材', COMBI),
      notesBox(),
      linksBox()
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
};

export const inputActions = {
  // 入力のたびに保存する。描画はしないので入力中のカーソルは動かない
  'ref:note': (target) => {
    updateNote(target.dataset.id, target.dataset.field, target.value);
  },
};
