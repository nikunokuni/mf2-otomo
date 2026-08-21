/* ===========================================================
   状態の保持と localStorage への保存
   -----------------------------------------------------------
   ・アプリ全体の state はこのモジュールだけが書き換える
   ・種族名をキーにしてデータを持つ（種族名は絶対に変えないこと。
     変えるとその種族の記録が丸ごと迷子になる）
   ・旧トラッカー（mf2_mf2v8_state）からの移行に対応
   =========================================================== */

import { SK } from './data/growth.js';
import { SKEYS } from './data/growth.js';
import { FEEDS, DEFAULT_LIKING } from './data/feeds.js';
import { segKey } from './simulator/growth-calc.js';

const STORAGE_KEY = 'monfar_state_v1';
const LEGACY_KEY = 'mf2_mf2v8_state';

/** ヨイワルの5きざみの刻み幅 */
export const MORAL_STEP = 5;

/** 寿命は 250〜500 週を10きざみで選ぶ */
export const LIFE_MIN = 250;
export const LIFE_MAX = 500;
export const LIFE_STEP = 10;

/**
 * 寿命を 250〜500 の10きざみの数値に直す。
 * 前は 100〜600 を1週きざみで入れられたので、その範囲の外や
 * 半端な数の保存データは、いちばん近い選べる数に寄せる。
 */
export function normalizeLife(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 300;
  const stepped = Math.round(n / LIFE_STEP) * LIFE_STEP;
  return Math.max(LIFE_MIN, Math.min(LIFE_MAX, stepped));
}

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
    // plan[セグメントのキー] = セットの配列。
    // キーは育成計画の行（時系列）に対応する。桃で若返る行も同じ入れ物に入る
    // （キーの作り方は js/simulator/growth-calc.js の segKey）
    plan: {},
    // 桃システム。si は「そこまで若返る」成長段階
    peach: [
      { use: false, si: 4 },
      { use: false, si: 4 },
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
    // 双子の水差しの所持数。月初めに、持っている数だけ重なって効く
    jugs: 0,
    // 成長段階。休養の効き方が段階で変わるので持っておく
    stage: 's1',
    // weeks[i] = i週目（0はじまり）の { item, act }
    // feeds[m] = mか月目（0はじまり）のエサ名。1か月は4週で、月初めに1回効く
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

/**
 * 保存した調整ローテ1件ぶんの初期値（早見タブの「ローテ」に出る）。
 * 調整ローテそのもの（mon.rota）は種族ごとだが、保存したぶんは
 * 早見タブに並ぶので種族に関係なく全体で1つ持つ。中身は写した時点のまま動かない。
 *   species 写したときの種族名
 *   savedAt 写した日時（ISO文字列）
 *   weeks   [{ label, feed, item, act }]（act は画面に出ていた文言のまま）
 *   start   最初の状態（内部数値全部）
 *   end     最後の状態（内部数値全部）
 *   life    減る寿命の合計 { age 週経過ぶん, extra 追加ぶん, total 合計 }
 */
export function defaultSavedRota() {
  return {
    id: newRotaId(),
    species: '',
    savedAt: '',
    weeks: [],
    start: {},
    end: {},
    life: { age: 0, extra: 0, total: 0 },
  };
}

function defaultState() {
  return {
    v: 1,
    // rotaOpen: 調整ローテの「開始時点の内部数値 / エサの効き方」を開いているか
    ui: { top: 'monster', sim: 'plan', gridOpen: false, rotaOpen: false },
    current: null,
    order: [],
    mon: {},
    notes: [],
    links: [],
    items: [],
    // 調整ローテから保存したぶん（早見タブの「ローテ」に出る）
    rotas: [],
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

let rotaSeq = 0;
function newRotaId() {
  rotaSeq += 1;
  return `r${Date.now().toString(36)}${rotaSeq}`;
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

/**
 * 育成計画の保存形式を、時系列の行（セグメント）ごとの形に直す。
 *
 * 旧: plan[グループ][段階] = セットの配列（グループは 0=通常 / 1=黄金桃後 / 2=白銀桃後）
 * 新: plan[セグメントのキー] = セットの配列
 *
 * 桃で段階が前後に割れたぶんは normalizePlan() がトレーニングの内容を引き継ぐので、
 * ここでは各段階の1つ目の行に移すだけでよい。
 */
function migratePlan(plan) {
  if (!plan || typeof plan !== 'object') return {};
  const next = {};
  Object.entries(plan).forEach(([key, value]) => {
    // すでに新しい形（キーごとにセットの配列）
    if (Array.isArray(value)) {
      next[key] = value;
      return;
    }
    if (!value || typeof value !== 'object') return;
    const g = Number(key);
    if (!Number.isInteger(g) || g < 0 || g > 2) return;
    Object.entries(value).forEach(([si, sets]) => {
      if (!Array.isArray(sets) || !sets.length) return;
      // g=0 が白（ph=-1）、g=1/2 が黄金桃/白銀桃（ph=0/1）
      next[segKey(g - 1, Number(si), 0)] = sets;
    });
  });
  return next;
}

/** 桃システムの設定を、必ず2つぶんの { use, si } にそろえる */
function normalizePeach(peach) {
  const list = Array.isArray(peach) ? peach : [];
  return [0, 1].map((pi) => {
    const p = list[pi] || {};
    const si = Number(p.si);
    return { use: !!p.use, si: Number.isInteger(si) && si >= 0 && si <= 9 ? si : 4 };
  });
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
  s.rotas = (Array.isArray(s.rotas) ? s.rotas : []).map((r) => {
    const saved = Object.assign(defaultSavedRota(), r && typeof r === 'object' ? r : {});
    saved.weeks = (Array.isArray(saved.weeks) ? saved.weeks : []).map((w) => ({
      label: String((w && w.label) || ''),
      feed: String((w && w.feed) || ''),
      item: String((w && w.item) || ''),
      act: String((w && w.act) || ''),
    }));
    saved.start = Object.assign({}, saved.start || {});
    saved.end = Object.assign({}, saved.end || {});
    const life = Object.assign({ age: 0, extra: 0, total: 0 }, saved.life || {});
    saved.life = {
      age: Number(life.age) || 0,
      extra: Number(life.extra) || 0,
      total: Number(life.total) || 0,
    };
    return saved;
  });
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
    m.sim.life = normalizeLife(m.sim.life);
    m.sim.apt = Object.assign(defaultSim().apt, m.sim.apt || {});
    m.sim.init = Object.assign(defaultSim().init, m.sim.init || {});
    m.sim.plan = migratePlan(m.sim.plan);
    m.sim.peach = normalizePeach(m.sim.peach);
    m.rota = Object.assign(defaultRota(), m.rota || {});
    m.rota.start = Object.assign(defaultRota().start, m.rota.start || {});
    m.rota.jugs = Math.max(0, Math.min(99, parseInt(m.rota.jugs, 10) || 0));
    m.rota.stage = SKEYS.includes(m.rota.stage) ? m.rota.stage : 's1';
    m.rota.weeks = (Array.isArray(m.rota.weeks) ? m.rota.weeks : []).map((w) => ({
      item: String((w && w.item) || ''),
      // 大会は結果ごとに分かれたので、結果の無い古い 'tc' は「他」として読む
      act: String((w && w.act) === 'tc' ? 'tc:mid' : (w && w.act) || ''),
    }));
    m.rota.feeds = (Array.isArray(m.rota.feeds) ? m.rota.feeds : []).map((f) => String(f || ''));
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

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

/* ---------- 保存した調整ローテ（早見タブの「ローテ」） ---------- */

/**
 * 調整ローテを写して残す。新しいものが上に来るように先頭へ足す。
 * 渡された中身はそのまま覚えるだけで、あとから計算し直したりはしない。
 */
export function addSavedRota(entry) {
  const saved = Object.assign(defaultSavedRota(), entry || {});
  state.rotas.unshift(saved);
  save();
  return saved;
}

export function removeSavedRota(id) {
  state.rotas = state.rotas.filter((r) => r.id !== id);
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
