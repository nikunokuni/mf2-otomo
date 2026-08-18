/* ===========================================================
   育成計算タブ「アイテム」
   -----------------------------------------------------------
   名前と効果だけを並べて入力していく画面。
   入れた内容は早見タブの「アイテム」の箱にもそのまま出る。

   ・上半分 … アプリにあらかじめ入っているぶん（js/data/items.js）。読むだけ。
   ・下半分 … ユーザーが足したぶん（state.items）。種族ごとではなく全体で1つ。
     種族を選び直しても中身は変わらない。
   =========================================================== */

import { ITEMS } from '../data/items.js';
import { state, addItem, updateItem, removeItem } from '../store.js';
import { el, h, replace } from '../dom.js';

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

function itemRow(item, idx) {
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

/** アプリに入っているぶん。読むだけなので入力欄にはしない */
function builtinRow(item, idx) {
  return h(
    'div',
    { class: 'item-row item-row--fixed' },
    h('span', { class: 'item-row__no', text: String(idx + 1) }),
    h('span', { class: 'item-row__name item-row__text', text: item.name }),
    h('span', { class: 'item-row__effect item-row__text', text: item.effect })
  );
}

export function renderItems() {
  const area = el('itemArea');
  if (!area) return;

  const head = h(
    'div',
    { class: 'section-head' },
    h('span', { text: `アイテム（${ITEMS.length + state.items.length}件）` }),
    h('button', {
      type: 'button',
      class: 'btn btn--sm btn--primary',
      style: 'margin-left:auto',
      text: '＋ 追加',
      dataset: { action: 'item:add' },
    })
  );

  const mine = state.items.length
    ? state.items.map(itemRow)
    : [h('div', { class: 'empty', text: '「＋ 追加」で1件ずつ入れていきます。' })];

  replace(
    area,
    head,
    h('div', { class: 'callout callout--info', text: '入れた内容は早見タブの「アイテム」にも出ます。' }),
    ITEMS.length ? h('div', { class: 'item-group__title', text: `収録ぶん（${ITEMS.length}件）` }) : null,
    ...ITEMS.map(builtinRow),
    h('div', { class: 'item-group__title', text: '自分で足したぶん' }),
    ...mine
  );
}

export const actions = {
  'item:add': () => {
    addItem();
    renderItems();
    // 続けて入力できるように、足した行の名前欄へ移動する
    const inputs = el('itemArea').querySelectorAll('.item-row__name');
    const last = inputs[inputs.length - 1];
    if (last) {
      last.focus();
      last.scrollIntoView({ block: 'nearest' });
    }
  },

  'item:del': (target) => {
    if (!confirm('このアイテムを削除します。よろしいですか？')) return;
    removeItem(target.dataset.id);
    renderItems();
  },
};

export const inputActions = {
  // 入力のたびに保存する。描画はしないので入力中のカーソルは動かない
  'item:field': (target) => {
    updateItem(target.dataset.id, target.dataset.field, target.value);
  },
};
