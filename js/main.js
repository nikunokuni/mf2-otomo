/* ===========================================================
   エントリーポイント
   -----------------------------------------------------------
   各モジュールの操作を1か所に集めて登録し、最初の描画を行う。
   =========================================================== */

import { load, save, onSave, state, exportJSON, importJSON } from './store.js';
import { el, registerActions, startActionDelegation } from './dom.js';
import * as tabs from './tabs.js';
import * as species from './species.js';
import * as tracker from './tracker/tracker.js';
import * as simulator from './simulator/simulator.js';
import * as reference from './reference/reference.js';

/* ---------- 保存インジケータ ---------- */

let indicatorTimer = null;
onSave(() => {
  const node = el('saveIndicator');
  if (!node) return;
  node.classList.add('is-shown');
  clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => node.classList.remove('is-shown'), 1500);
});

/* ---------- バックアップ ---------- */

const backupActions = {
  'backup:export': () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monfar-no-otomo-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  'backup:import': () => el('importFile').click(),
};

const backupChanges = {
  'backup:file': (target) => {
    const file = target.files && target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importJSON(String(reader.result));
      if (!ok) {
        alert('読み込めませんでした。このアプリで書き出したJSONファイルを選んでください。');
        return;
      }
      renderAll();
      tabs.restore();
      alert('データを復元しました。');
    };
    reader.readAsText(file);
    target.value = '';
  },
};

/* ---------- 全体の描画 ---------- */

function renderAll() {
  species.renderChips();
  tracker.render();
  simulator.render();
  reference.render();
}

/* ---------- 起動 ---------- */

function start() {
  const migrated = load();

  registerActions('click', {
    ...tabs.actions,
    ...species.actions,
    ...tracker.actions,
    ...simulator.actions,
    ...reference.actions,
    ...backupActions,
  });
  registerActions('change', {
    ...tracker.changeActions,
    ...simulator.changeActions,
    ...simulator.simpleChanges,
    ...backupChanges,
  });
  registerActions('input', {
    ...tracker.inputActions,
    ...simulator.inputActions,
  });
  startActionDelegation();

  // 種族を選び直したら、両方のタブを作り直す
  document.addEventListener(species.SPECIES_CHANGED, renderAll);

  // 「計算実行」を押したら結果タブへ移動する
  document.addEventListener('sim:showResult', () => {
    tabs.showSub('result');
    simulator.renderResult();
  });

  tabs.onSubShown((name) => simulator.onSubTabShown(name));

  // グリッドの開閉状態を復元
  el('speciesGrid').hidden = !state.ui.gridOpen;
  if (state.ui.gridOpen) species.toggleGrid(true);

  renderAll();
  tabs.restore();

  if (migrated) {
    el('migrationNotice').hidden = false;
  }

  // Service Worker（オフライン対応）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

start();
