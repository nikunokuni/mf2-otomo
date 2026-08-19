/* ===========================================================
   タブの制御（2階層）
   -----------------------------------------------------------
   上位: モンスター / 使い込み / 育成計算 / 早見
   下位: 育成計画 / 調整ローテ / 結果（育成計算タブの中だけ）
   選んでいたタブは保存され、次に開いたときも同じ場所から始まる。

   種族チップの帯は「その種族の話をしているタブ」でだけ出す。
   早見タブの中身は種族に関係ないので、そこでは隠す。
   =========================================================== */

import { state, save } from './store.js';
import { el } from './dom.js';

const TOP_TABS = ['monster', 'tracker', 'simulator', 'reference'];
const SUB_TABS = ['plan', 'rotation', 'result'];

/** 種族チップの帯を出さないタブ */
const NO_SPECIES_BAR = ['reference'];

const listeners = { top: [], sub: [] };

/** タブが表示されたときに呼ばれる処理を登録する */
export function onTopShown(fn) {
  listeners.top.push(fn);
}
export function onSubShown(fn) {
  listeners.sub.push(fn);
}

export function showTop(name) {
  if (!TOP_TABS.includes(name)) name = 'monster';
  state.ui.top = name;

  TOP_TABS.forEach((t) => {
    el(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    el(`pane-${t}`).hidden = t !== name;
  });
  el('speciesBar').hidden = NO_SPECIES_BAR.includes(name);
  save();
  listeners.top.forEach((fn) => fn(name));
  if (name === 'simulator') showSub(state.ui.sim);
}

export function showSub(name) {
  // 旧データの 'basic' / 'item' はもう無いので、先頭の「育成計画」に寄せる
  if (!SUB_TABS.includes(name)) name = 'plan';
  state.ui.sim = name;

  SUB_TABS.forEach((t) => {
    el(`subtab-${t}`).setAttribute('aria-selected', String(t === name));
    el(`subpane-${t}`).hidden = t !== name;
  });
  // 「計算実行 / リセット」は計画と結果のときだけ意味がある
  el('simActions').hidden = name === 'rotation';
  save();
  listeners.sub.forEach((fn) => fn(name));
}

export const actions = {
  'tab:top': (target) => showTop(target.dataset.tab),
  'tab:sub': (target) => showSub(target.dataset.tab),
};

/** 起動時に、保存されていたタブを復元する */
export function restore() {
  showTop(state.ui.top);
}
