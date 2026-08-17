/* ===========================================================
   早見タブ
   -----------------------------------------------------------
   育成中に「あれ、どうだったっけ」となる情報を、
   さっと開いて確認するための場所。
   中身はこれから足していく。SECTIONS に
   { title, build() } を並べれば、その順にカードが出る。
   build() は Node か Node の配列を返すこと。
   =========================================================== */

import { el, h, replace } from '../dom.js';

/** 表示するセクション。ここに足すと画面に増える */
const SECTIONS = [];

export function render() {
  const area = el('referenceArea');
  if (!area) return;

  if (SECTIONS.length === 0) {
    replace(
      area,
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'empty', text: '表示する内容はこれから追加します。' })
      )
    );
    return;
  }

  replace(
    area,
    SECTIONS.map((section) =>
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'section-head', text: section.title }),
        ...[].concat(section.build())
      )
    )
  );
}

/** 早見タブの中で使う操作。中身が増えたらここに登録する */
export const actions = {};
