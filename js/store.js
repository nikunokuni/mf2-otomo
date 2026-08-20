/* ===========================================================
   状態の保持と localStorage への保存
   -----------------------------------------------------------
   ・アプリ全体の state はこのモジュールだけが書き換える
   ・種族名をキーにしてデータを持つ（種族名は絶対に変えないこと。
     変えるとその種族の記録が丸ごと迷子になる）
   ・旧トラッカー（mf2_mf2v8_state）からの移行に対応
   =========================================================== */

import { SK } from './data/growth.js';
import { FEEDS, DEFAULT_LIKING } from './data/feeds.js';

const STORAGE_KEY = 'monfar_state_v1';
const LEGACY_KEY = 'mf2_mf2v8_state';

/** ヨイワルの5きざみの刻み幅 */
export const MORAL_STEP = 5;

/**
 * ヨイワルを -100〜100 の5きざみの数値に直す。
 * 昔の保存データは 'good' / 'neutral' / 'bad' の3択だったので、そのぶんも読み替える。
 */
export function normalizeMoral(value) {
  const legacy = { good: 50, neutral: 0, bad: -50 };
  const n = typeof value === 'string' && value in legacy ? legacy[value] : Number(value);
  if (!Number.isFinite(n)) return 0;
  const stepped = Math.round(n / MORAL_STEP) * MORAL_STEP;
  return Math.max(-100, Math.min(100, stepped));
}

/** 技を一意に識別するキー。保存データのキーになるので形式を変えないこと */
export function techKey(tech) {
  return tech.from + '→' + tech.to;
}

/** 育成計算の初期値 */
export function defaultSim() {
  const apt = {};
  const init = {};
  SK.forEach((k) => {
    apt[k] = 'C';
    init[k] = 100;
  });
  return {
    month: 1,
    week: 1,
    gtype: 'futsuu',
    // ヨイワルは -100〜100 の数値（5きざみ）。0 が普通
    moral: 0,
    life: 300,
    apt,
    init,
    // plan[g][si] = セットの配列。g=0 が通常、g=1/2 が桃1/桃2の追加分
    plan: { 0: {}, 1: {}, 2: {} },
    peach: [
      { use: false, si: 4, setN: 1 },
      { use: false, si: 4, setN: 1 },
    ],
    result: null,
  };
}

/**
 * エサの好き嫌いの初期値。エサ名をキーにして 'like' / 'normal' / 'dislike' を持つ。
 * どのエサが好きかはモンスターごとに違うので、ユーザーがモンスタータブで入れる。
 */
export function defaultFeedLike() {
  const out = {};
  FEEDS.forEach((f) => {
    out[f.name] = DEFAULT_LIKING;
  });
  return out;
}

/**
 * 調整ローテの初期値。
 * start は「調整ローテを始める時点の内部数値」で、
 * ここに入っている数は仕様で決まっている開始時の値。
 * （js/data/items.js の INNER.init は「生まれた直後の値」なので別もの）
 */
export function defaultRota() {
  return {
    start: { form: -100, moral: 100, stress: 0, fatigue: 0, fear: 100, spoil: 100 },
    // 毎週のアイテムと行動 / 毎月のエサ。中身の形はこれから決める
    weeks: [],
    feeds: [],
  };
}

/** 1種族ぶんの初期値 */
export function defaultMon() {
  return {
    guts: 15,
    inSession: false,
    memo: '',
    log: [],
    selected: [],
    progress: {},
    sim: defaultSim(),
    rota: defaultRota(),
    feedLike: defaultFeedLike(),
  };
}

/** 再生メモ1件ぶんの初期値（早見タブ。種族の記録とは別に持つ） */
export function defaultNote() {
  return { id: newNoteId(), monster: '', title: '', singer: '', memo: '' };
}

/** リンク1件ぶんの初期値（早見タブのリンク集。ユーザーが足したぶん） */
export function defaultLink() {
  return { id: newLinkId(), name: '', url: '' };
}

/** アイテム1件ぶんの初期値（育成計算タブのアイテム。種族に関係なく共通で持つ） */
export function defaultItem() {
  return { id: newItemId(), name: '', effect: '' };
}

function defaultState() {
  return {
    v: 1,
    ui: { top: 'monster', sim: 'plan', gridOpen: false },
    current: null,
    order: [],
    mon: {},
    notes: [],
    links: [],
    items: [],
  };
}

let noteSeq = 0;
function newNoteId() {
  noteSeq += 1;
  return `n${Date.now().toString(36)}${noteSeq}`;
}

let linkSeq = 0;
function newLinkId() {
  linkSeq += 1;
  return `l${Date.now().toString(36)}${linkSeq}`;
}

let itemSeq = 0;
function newItemId() {
  itemSeq += 1;
  return `i${Date.now().toString(36)}${itemSeq}`;
}

/**
 * リンクとして開いてよい URL だけを通す。
 * スキームがなければ https:// を補い、http/https 以外（javascript: など）は空文字で弾く。
 */
export function safeUrl(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : 'https://' + text;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (e) {
    return '';
  }
}

export const state = defaultState();

/* ---------- 読み込み ---------- */

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('保存データの読み込みに失敗しました:', key, e);
    return null;
  }
}

/**
 * 旧トラッカーの保存形式を新しい形に変換する。
 * 旧: { monsters:[{name, techs:[...], log, monGutsRecovery}], techHistory:{種族:{技キー:{total,done}}} }
 */
function migrateLegacy(old) {
  const next = defaultState();
  const monsters = Array.isArray(old.monsters) ? old.monsters : [];

  monsters.forEach((m) => {
    if (!m || !m.name) return;
    const mon = defaultMon();
    mon.guts = m.monGutsRecovery || old.monGutsRecovery || 15;
    mon.log = Array.isArray(m.log) ? m.log : [];
    (m.techs || []).forEach((t) => {
      const k = techKey(t);
      mon.selected.push(k);
      mon.progress[k] = { total: t.total || 0, done: !!t.done, session: 0 };
    });
    next.mon[m.name] = mon;
    next.order.push(m.name);
  });

  // 選択を外した技の記録（techHistory）も引き継ぐ
  const hist = old.techHistory || {};
  Object.keys(hist).forEach((name) => {
    if (!next.mon[name]) {
      next.mon[name] = defaultMon();
      next.order.push(name);
    }
    Object.entries(hist[name] || {}).forEach(([k, v]) => {
      if (!next.mon[name].progress[k]) {
        next.mon[name].progress[k] = { total: v.total || 0, done: !!v.done, session: 0 };
      }
    });
  });

  const cur = monsters.find((m) => m.id === old.current);
  next.current = cur ? cur.name : next.order[0] || null;
  return next;
}

/** 欠けているフィールドを埋めて、古い保存データでも壊れないようにする */
function normalize(loaded) {
  const base = defaultState();
  const s = Object.assign(base, loaded);
  s.ui = Object.assign(base.ui, loaded.ui || {});
  s.mon = s.mon || {};
  s.order = Array.isArray(s.order) ? s.order : [];
  s.notes = (Array.isArray(s.notes) ? s.notes : []).map((n) =>
    Object.assign(defaultNote(), n && typeof n === 'object' ? n : {})
  );
  s.items = (Array.isArray(s.items) ? s.items : []).map((i) =>
    Object.assign(defaultItem(), i && typeof i === 'object' ? i : {})
  );
  // 開けない URL（javascript: など）は読み込み時点で落とす
  s.links = (Array.isArray(s.links) ? s.links : [])
    .map((l) => Object.assign(defaultLink(), l && typeof l === 'object' ? l : {}))
    .map((l) => Object.assign(l, { name: String(l.name || ''), url: safeUrl(l.url) }))
    .filter((l) => l.name && l.url);

  Object.keys(s.mon).forEach((name) => {
    const d = defaultMon();
    const m = Object.assign(d, s.mon[name]);
    m.sim = Object.assign(defaultSim(), m.sim || {});
    m.sim.moral = normalizeMoral(m.sim.moral);
    m.sim.apt = Object.assign(defaultSim().apt, m.sim.apt || {});
    m.sim.init = Object.assign(defaultSim().init, m.sim.init || {});
    m.sim.plan = Object.assign({ 0: {}, 1: {}, 2: {} }, m.sim.plan || {});
    m.rota = Object.assign(defaultRota(), m.rota || {});
    m.rota.start = Object.assign(defaultRota().start, m.rota.start || {});
    m.rota.weeks = Array.isArray(m.rota.weeks) ? m.rota.weeks : [];
    m.rota.feeds = Array.isArray(m.rota.feeds) ? m.rota.feeds : [];
    m.feedLike = Object.assign(defaultFeedLike(), m.feedLike || {});
    m.selected = Array.isArray(m.selected) ? m.selected : [];
    m.progress = m.progress || {};
    m.log = Array.isArray(m.log) ? m.log : [];
    s.mon[name] = m;
    if (!s.order.includes(name)) s.order.push(name);
  });

  // 実体のない種族が order に残っていたら落とす
  s.order = s.order.filter((n) => s.mon[n]);
  if (s.current && !s.mon[s.current]) s.current = s.order[0] || null;
  return s;
}

/** 起動時に一度だけ呼ぶ。戻り値は移行が起きたかどうか */
export function load() {
  let migrated = false;
  let loaded = readJSON(STORAGE_KEY);

  if (!loaded) {
    const legacy = readJSON(LEGACY_KEY);
    if (legacy) {
      loaded = migrateLegacy(legacy);
      migrated = true;
    }
  }

  Object.assign(state, loaded ? normalize(loaded) : defaultState());
  if (migrated) save();
  return migrated;
}

/* ---------- 保存 ---------- */

let saveListener = null;

/** 保存されたときに呼ばれるコールバックを登録する（保存インジケータ用） */
export function onSave(fn) {
  saveListener = fn;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (saveListener) saveListener();
  } catch (e) {
    console.warn('保存に失敗しました:', e);
  }
}

/* ---------- 種族の操作 ---------- */

export function currentMon() {
  return state.current ? state.mon[state.current] || null : null;
}

export function ensureMon(name) {
  if (!state.mon[name]) {
    state.mon[name] = defaultMon();
    state.order.push(name);
  }
  return state.mon[name];
}

export function selectSpecies(name) {
  ensureMon(name);
  state.current = name;
  save();
}

export function removeSpecies(name) {
  delete state.mon[name];
  state.order = state.order.filter((n) => n !== name);
  if (state.current === name) state.current = state.order[0] || null;
  save();
}

/* ---------- 再生メモ（早見タブ） ---------- */

export function addNote() {
  const note = defaultNote();
  state.notes.unshift(note);
  save();
  return note;
}

export function updateNote(id, field, value) {
  const note = state.notes.find((n) => n.id === id);
  if (!note || !(field in note) || field === 'id') return;
  note[field] = value;
  save();
}

export function removeNote(id) {
  state.notes = state.notes.filter((n) => n.id !== id);
  save();
}

/* ---------- リンク集（早見タブ） ---------- */

/** 追加できたら追加した1件を、名前かURLが不正なら null を返す */
export function addLink(name, url) {
  const link = Object.assign(defaultLink(), { name: String(name || '').trim(), url: safeUrl(url) });
  if (!link.name || !link.url) return null;
  state.links.push(link);
  save();
  return link;
}

export function removeLink(id) {
  state.links = state.links.filter((l) => l.id !== id);
  save();
}

/* ---------- アイテム（育成計算タブ / 早見タブに表示） ---------- */

/** 続けて入力していくので、新しいものは末尾に足す */
export function addItem() {
  const item = defaultItem();
  state.items.push(item);
  save();
  return item;
}

export function updateItem(id, field, value) {
  const item = state.items.find((i) => i.id === id);
  if (!item || !(field in item) || field === 'id') return;
  item[field] = value;
  save();
}

export function removeItem(id) {
  state.items = state.items.filter((i) => i.id !== id);
  save();
}

/* ---------- バックアップ ---------- */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

/**
 * バックアップから復元する。壊れたJSONなら false を返して既存データは触らない。
 */
export function importJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return false;
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.mon !== 'object') return false;
  Object.assign(state, normalize(parsed));
  save();
  return true;
}
