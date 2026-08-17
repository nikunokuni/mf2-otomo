/* ===========================================================
   タブの制御（2階層）
   -----------------------------------------------------------
   上位: 使い込み / 育成計算 / 早見
   下位: 基本設定 / 育成計画 / 結果（育成計算タブの中だけ）
   選んでいたタブは保存され、次に開いたときも同じ場所から始まる。
   =========================================================== */

import { state, save } from './store.js';
import { el } from './dom.js';

const TOP_TABS = ['tracker', 'simulator', 'reference'];
const SUB_TABS = ['basic', 'plan', 'result'];

const listeners = { top: [], sub: [] };

/** タブが表示されたときに呼ばれる処理を登録する */
export function onTopShown(fn) {
  listeners.top.push(fn);
}
export function onSubShown(fn) {
  listeners.sub.push(fn);
}

export function showTop(name) {
  if (!TOP_TABS.includes(name)) name = 'tracker';
  state.ui.top = name;

  TOP_TABS.forEach((t) => {
    el(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    el(`pane-${t}`).hidden = t !== name;
  });
  save();
  listeners.top.forEach((fn) => fn(name));
  if (name === 'simulator') showSub(state.ui.sim);
}

export function showSub(name) {
  if (!SUB_TABS.includes(name)) name = 'basic';
  state.ui.sim = name;

  SUB_TABS.forEach((t) => {
    el(`subtab-${t}`).setAttribute('aria-selected', String(t === name));
    el(`subpane-${t}`).hidden = t !== name;
  });
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
