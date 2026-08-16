/* ===========================================================
   DOM まわりの小さなヘルパー
   -----------------------------------------------------------
   インラインの onclick は使わない。要素に data-action / data-change /
   data-input を書いておき、ここで一括して受け取る（イベント委譲）。
   こうしておくと、関数名を変えても HTML 側の文字列を追いかけずに済む。
   =========================================================== */

export function el(id) {
  return document.getElementById(id);
}

/**
 * 要素をつくる。
 *   h('div', { class:'card', text:'やあ' }, child1, child2)
 * props で使えるキー: class / text / html / style / attrs / dataset / それ以外は直接代入
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'attrs') {
      Object.entries(value).forEach(([a, v]) => {
        if (v !== null && v !== undefined && v !== false) node.setAttribute(a, v);
      });
    } else node[key] = value;
  });
  children.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

/** 子要素をまとめて入れ替える（innerHTML を使わずに中身を差し替える） */
export function replace(parent, ...children) {
  parent.replaceChildren(...children.flat().filter(Boolean));
}

const registry = {
  click: new Map(),
  change: new Map(),
  input: new Map(),
};

const ATTR = { click: 'action', change: 'change', input: 'input' };

/**
 * ハンドラを登録する。
 *   registerActions('click', { 'tracker:start': (el, ev) => {...} })
 * HTML/生成要素側は data-action="tracker:start" と書く。
 */
export function registerActions(type, handlers) {
  Object.entries(handlers).forEach(([name, fn]) => registry[type].set(name, fn));
}

/** 起動時に一度だけ呼ぶ。document に委譲リスナーを張る */
export function startActionDelegation() {
  Object.keys(registry).forEach((type) => {
    document.addEventListener(
      type,
      (event) => {
        const target = event.target.closest(`[data-${ATTR[type]}]`);
        if (!target) return;
        const fn = registry[type].get(target.dataset[ATTR[type]]);
        if (!fn) return;
        fn(target, event);
      },
      type === 'click' ? false : true // change/input はキャプチャで拾う
    );
  });
}

/** data-* から数値を取り出す */
export function num(target, key, fallback = 0) {
  const v = parseInt(target.dataset[key], 10);
  return Number.isNaN(v) ? fallback : v;
}

/** 入力値を整数に丸めて範囲に収める */
export function clampInt(value, min, max, fallback = min) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
