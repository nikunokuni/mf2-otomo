/* ===========================================================
   育成計算タブ「調整ローテ」
   -----------------------------------------------------------
   育成計画の短期詳細版。
   育成計画が「全期間を段階ごとにざっくり組む」ものなのに対して、
   こちらは短い期間を1週ずつ細かく組むための画面。

   ・開始時点の内部数値を入れる（mon.rota.start）
   ・双子の水差しの所持数を入れる（mon.rota.jugs）
   ・1週ずつ、アイテムと行動を入れる（mon.rota.weeks）
     入れると次の週の欄が出てくる。上限はない。
   ・月初め（第1週）の行では、その月のエサも選ぶ（mon.rota.feeds）

   計算そのものは rota-calc.js（画面に依存しない）に置いてある。
   1週のなかの順番は「月初めならエサ → 双子の水差し、そのあとアイテム → 行動」。

   休養は成長段階で効き方が変わるので、段階もここで選ぶ（mon.rota.stage）。
   大会は結果（優勝 / 他 / ビリ）で疲労が変わり、そのあとストレスが0になる。
   冒険を選ぶと4週ぶんまとめて埋まる。出ているあいだは何も起きず体調値も出さない。
   疲労+70 は帰ってきた週にまとめて乗る。

   アイテムの効果そのものを思い出したいときは早見タブを見る
   （ユーザーは効果を覚えている前提なので、この画面には出さない）。

   設計のメモは docs/roadmap.md の②。
   =========================================================== */

import { INNER, ITEMS } from '../data/items.js';
import { FEEDS, LIKING_LABEL, feedEffect } from '../data/feeds.js';
import { HEAVY4, LIGHT6, STAGES, SKEYS } from '../data/growth.js';
import { TOURNAMENT, ADVENTURE_WEEKS } from '../data/acts.js';
import { save, currentMon, state } from '../store.js';
import { el, h, replace, clampInt } from '../dom.js';
import { moralRange } from './inner-calc.js';
import {
  simulate,
  weekLabel,
  isMonthStart,
  monthOf,
  monthCount,
  totalAgePlus,
  totalFeedPrice,
  totalLifeLoss,
  adventureWeeks,
  JUG_NAME,
} from './rota-calc.js';

/**
 * 開始時点に入れる内部数値。並びは画面に出す順。
 * 人気（fame）はいまのところ調整ローテでは使わないので出していない。
 */
const START_KEYS = ['form', 'moral', 'stress', 'fatigue', 'fear', 'spoil'];

/** 表に出す内部数値と、狭い画面用の短い見出し */
const TRACK_KEYS = [
  ['fatigue', '疲'],
  ['stress', 'ス'],
  ['fear', '恐'],
  ['spoil', '甘'],
  ['form', '体'],
  ['moral', 'ヨ'],
];

/** 1週に選べる行動。値は保存データに入るので変えないこと */
const ACTS = [
  ['', 'なし'],
  ...HEAVY4.map((t, i) => [`heavy:${i}`, `重・${t.name}`]),
  ...LIGHT6.map((t, i) => [`light:${i}`, `軽・${t.name}`]),
  ['rest', '休養'],
  ...Object.entries(TOURNAMENT).map(([key, t]) => [`tc:${key}`, `大会（${t.label}）`]),
  ['mc', '修行'],
  ['ac', '冒険'],
];

/** 1週に使えるアイテム（持ち物は毎週使うものではないので出さない） */
const USE_ITEMS = ITEMS.filter((i) => i.kind === 'use');

function rota() {
  const mon = currentMon();
  return mon ? mon.rota : null;
}

/**
 * そのキーが取れる範囲。
 * ヨイワルだけは、そのモンスターの初期ヨイワル（モンスタータブ）から
 * ±100 までしか動かないので、範囲が狭くなることがある。
 */
function rangeOf(key) {
  const mon = currentMon();
  if (key === 'moral') return moralRange(mon ? mon.sim.moral : 0);
  return [INNER[key].min, INNER[key].max];
}

/** 数字を +3 / -3 / 0 の形にそろえる */
function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * 入力欄は「最後の1行が必ず空」になるように整える。
 * 空の行に何か入れたら、その下に新しい空の行が出てくる（上限なし）。
 * 途中の空行はそのまま残す（間を空けたまま組みたいことがあるので）。
 */
function normalizeWeeks(r) {
  let last = r.weeks.length;
  while (last > 0 && !r.weeks[last - 1].item && !r.weeks[last - 1].act) last -= 1;
  r.weeks = r.weeks.slice(0, last);
  r.weeks.push({ item: '', act: '' });
}

/* ---------- 開始時点 ---------- */

function startField(key) {
  const r = rota();
  const [min, max] = rangeOf(key);
  const value = clampInt(r.start[key], min, max, min);
  return h(
    'div',
    { class: 'field' },
    h('label', { attrs: { for: `rotaStart-${key}` }, text: INNER[key].label }),
    h('input', {
      type: 'number',
      id: `rotaStart-${key}`,
      value,
      min,
      max,
      dataset: { input: 'rota:start', key },
      attrs: { 'aria-label': `開始時点の${INNER[key].label}` },
    }),
    h('span', { class: 'rota-range', text: `${min}〜${max}` })
  );
}

function startSection() {
  const mon = currentMon();
  return h(
    'div',
    { class: 'sim-section' },
    h('div', { class: 'sim-section__title', text: '調整ローテを始める時点の内部数値' }),
    h('div', { class: 'rota-start-grid' }, ...START_KEYS.map(startField)),
    h(
      'div',
      { class: 'sim-row', style: 'margin-top:10px' },
      h('label', { class: 'note', attrs: { for: 'rotaJugs' }, text: `${JUG_NAME}の所持数` }),
      h('input', {
        type: 'number',
        id: 'rotaJugs',
        value: mon.rota.jugs,
        min: 0,
        max: 99,
        style: 'width:64px',
        dataset: { input: 'rota:jugs' },
        attrs: { 'aria-label': `${JUG_NAME}の所持数` },
      }),
      h('span', { class: 'note', text: '個（月初めに、持っている数だけ重なって効く）' })
    ),
    h(
      'div',
      { class: 'sim-row', style: 'margin-top:8px' },
      h('label', { class: 'note', attrs: { for: 'rotaStage' }, text: '成長段階' }),
      h(
        'select',
        {
          id: 'rotaStage',
          dataset: { change: 'rota:stage' },
          attrs: { 'aria-label': '成長段階' },
        },
        options(STAGES.map((label, i) => [SKEYS[i], label]), mon.rota.stage)
      ),
      h('span', { class: 'note', text: '（休養の効き方が変わります）' })
    ),
    h('div', {
      class: 'note',
      style: 'margin-top:6px',
      text:
        `ヨイワルは、モンスタータブの初期ヨイワル（${mon.sim.moral}）から` +
        '±100までしか動かないので、範囲がせまくなることがあります。',
    })
  );
}

/* ---------- エサの効き方（読むだけ） ---------- */

function feedSection() {
  const mon = currentMon();
  const rows = FEEDS.map((feed) => {
    const liking = mon.feedLike[feed.name];
    const e = feedEffect(feed, liking);
    return h(
      'tr',
      {},
      h('td', { class: 'feed-table__name', text: feed.name }),
      h('td', { class: `feed-like--${liking}`, text: LIKING_LABEL[liking] }),
      h('td', { class: 'col-num', text: signed(e.stress) }),
      h('td', { class: 'col-num', text: signed(e.fear) }),
      h('td', { class: 'col-num', text: signed(e.spoil) }),
      h('td', { class: 'col-num', text: signed(e.form) }),
      h('td', { class: 'col-num', text: String(feed.price) })
    );
  });

  return h(
    'div',
    { class: 'sim-section' },
    h('div', { class: 'sim-section__title', text: 'エサの効き方（このモンスターの好き嫌いを当てはめたもの）' }),
    h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'table feed-table' },
        h('thead', {},
          h('tr', {},
            h('th', { text: 'エサ' }),
            h('th', { text: '好み' }),
            h('th', { text: 'ストレス' }),
            h('th', { text: '恐れ度' }),
            h('th', { text: '甘え度' }),
            h('th', { text: '体型' }),
            h('th', { text: '買値' })
          )
        ),
        h('tbody', {}, ...rows)
      )
    ),
    h('div', {
      class: 'note',
      style: 'margin-top:6px',
      text: '好き嫌いを変えるのはモンスタータブです。体型と買値は好き嫌いで変わりません。',
    })
  );
}

/* ---------- 週ごとの表 ---------- */

function options(list, selected) {
  return list.map(([value, label]) =>
    h('option', { value, text: label, selected: String(selected || '') === value })
  );
}

/** エサは月初めの行だけで選ぶ。ほかの週は「その月のエサが続いている」印だけ出す */
function feedCell(i) {
  const r = rota();
  if (!isMonthStart(i)) return h('td', { class: 'rota-table__same', text: '↑' });
  const m = monthOf(i);
  return h(
    'td',
    {},
    h(
      'select',
      {
        class: 'rota-table__feed',
        dataset: { change: 'rota:feed', month: String(m) },
        attrs: { 'aria-label': `${m + 1}か月目のエサ` },
      },
      options([['', 'なし'], ...FEEDS.map((f) => [f.name, f.name])], r.feeds[m])
    )
  );
}

/**
 * 1週ぶんは2行で出す。
 *   1行目 … 週 / エサ / アイテム / 行動 の入力
 *   2行目 … その週が終わった時点の内部数値（横いっぱいの帯）
 * 数値を列にすると狭い画面で入力の右に隠れてしまうので、下に敷いている。
 */
function weekRows(row, i) {
  const r = rota();
  const w = r.weeks[i];
  const monthStart = isMonthStart(i);
  const cls = monthStart ? ' rota-table__month-start' : '';

  // いちばん下の「次の週」の行は、まだ組んでいないので薄く出す
  const pending = i >= plannedCount() ? ' rota-table--pending' : '';
  // 冒険で出かけている週は、そのあいだ何もできないので入力を閉じる。
  // 取りやめられるように、冒険を選んだ最初の週だけは開けておく
  const locked = row.adventuring && !row.advStart;

  const inputs = h(
    'tr',
    { class: 'rota-table__inputs' + cls + pending },
    h('td', { class: 'rota-table__week', text: weekLabel(i) }),
    row.adventuring ? h('td', { class: 'rota-table__same', text: '—' }) : feedCell(i),
    h(
      'td',
      {},
      h(
        'select',
        {
          disabled: row.adventuring,
          dataset: { change: 'rota:week', idx: String(i), field: 'item' },
          attrs: { 'aria-label': `${weekLabel(i)}のアイテム` },
        },
        options([['', 'なし'], ...USE_ITEMS.map((it) => [it.name, it.name])], w.item)
      )
    ),
    h(
      'td',
      {},
      h(
        'select',
        {
          disabled: locked,
          dataset: { change: 'rota:week', idx: String(i), field: 'act' },
          attrs: { 'aria-label': `${weekLabel(i)}の行動` },
        },
        options(ACTS, w.act)
      )
    )
  );

  const values = h(
    'tr',
    { class: 'rota-table__values' + cls + pending + (row.adventuring ? ' rota-table--adv' : '') },
    h(
      'td',
      { attrs: { colspan: 4 } },
      h(
        'div',
        { class: 'rota-vals' },
        ...TRACK_KEYS.map(([key, short]) =>
          h(
            'span',
            { class: 'rota-vals__cell', attrs: { title: INNER[key].label } },
            h('span', { class: 'rota-vals__label', text: short }),
            h('span', {
              class: 'rota-vals__num',
              id: `rotaVal-${i}-${key}`,
              text: String(row.values[key]),
            })
          )
        ),
        // 体調値（疲労+ストレス×2）と、そのせいでその週に減る寿命。
        // 冒険で出かけているあいだは体調値を出さない
        h(
          'span',
          { class: 'rota-vals__cell rota-vals__cond', attrs: { title: '体調値（疲労＋ストレス×2）' } },
          h('span', { class: 'rota-vals__label', text: row.adventuring ? '' : '体調' }),
          h('span', {
            class: 'rota-vals__num',
            id: `rotaCond-${i}`,
            text: row.adventuring ? '冒険中' : String(row.condition),
          })
        ),
        h(
          'span',
          { class: 'rota-vals__cell rota-vals__life', attrs: { title: 'その週に減る寿命' } },
          h('span', { class: 'rota-vals__label', text: row.adventuring ? '' : '寿命' }),
          h('span', {
            class: 'rota-vals__num',
            id: `rotaLife-${i}`,
            text: row.adventuring ? '—' : `-${row.lifeLoss}`,
          })
        )
      )
    )
  );

  return [inputs, values];
}

/**
 * いちばん下の行は「次の週の入力欄」なので、まだ組んだ週には数えない。
 * 途中の空行は「その週は何もしない」として数える。
 */
function plannedCount() {
  return Math.max(0, rota().weeks.length - 1);
}

/** いまの入力から1週ずつたどった結果 */
function currentRows() {
  const mon = currentMon();
  const r = mon.rota;
  return simulate({
    start: r.start,
    weeks: r.weeks,
    feeds: r.feeds,
    jugs: r.jugs,
    feedLike: mon.feedLike,
    initMoral: mon.sim.moral,
    species: state.current,
    stage: r.stage,
  });
}

/**
 * 数値の列だけを書き換える。
 * 入力中に表ごと作り直すとカーソルが飛ぶので、開始時点や所持数を
 * 打っているあいだはこちらだけを呼ぶ。
 */
function refreshValues() {
  const rows = currentRows();
  rows.forEach((row, i) => {
    TRACK_KEYS.forEach(([key]) => {
      const cell = el(`rotaVal-${i}-${key}`);
      if (cell) cell.textContent = String(row.values[key]);
    });
    const cond = el(`rotaCond-${i}`);
    if (cond) cond.textContent = row.adventuring ? '冒険中' : String(row.condition);
    const life = el(`rotaLife-${i}`);
    if (life) life.textContent = row.adventuring ? '—' : `-${row.lifeLoss}`;
  });
  const total = el('rotaLifeTotal');
  if (total) {
    total.textContent = `体調で減る寿命 合計 ${totalLifeLoss(rows.slice(0, plannedCount()))}週`;
  }
}

function weekTable() {
  const r = rota();
  const rows = currentRows();

  return h(
    'div',
    { class: 'scroll-x' },
    h(
      'table',
      { class: 'table rota-table' },
      h('thead', {},
        h('tr', {},
          h('th', { text: '週' }),
          h('th', { text: 'エサ' }),
          h('th', { text: 'アイテム' }),
          h('th', { text: '行動' })
        )
      ),
      h('tbody', {}, ...r.weeks.flatMap((w, i) => weekRows(rows[i], i)))
    )
  );
}

function planSection() {
  const mon = currentMon();
  const r = mon.rota;
  const rows = currentRows();
  const planned = plannedCount();

  return h(
    'div',
    { class: 'sim-section' },
    h('div', { class: 'sim-section__title', text: '毎週のアイテムと行動 / 毎月のエサ' }),
    h('div', { class: 'callout callout--info' },
      h('div', { text: '月初め（第1週）は、エサ → 双子の水差し の順に効いてから、その週のアイテムと行動です。' }),
      h('div', { text: '1週ぶん入れると、その下に次の週の欄が出てきます。' }),
      h('div', { text: '体調値＝疲労＋ストレス×2。その週に減る寿命は体調値で決まります。' }),
      h('div', { text: `冒険は${ADVENTURE_WEEKS}週まとめて出かけます。出ているあいだは体調値を出さず、疲労は帰ってきた週にまとめて乗ります。` })
    ),
    weekTable(),
    h('div', { class: 'rota-legend' },
      h('span', { text: '各週の下の帯は、その週が終わった時点の値' }),
      ...TRACK_KEYS.map(([key, short]) => h('span', { text: `${short}=${INNER[key].label}` }))
    ),
    h('div', { class: 'rota-total' },
      h('span', { text: `組んだ週数 ${planned}週` }),
      h('span', { text: `月の数 ${monthCount(Math.max(1, planned))}か月` }),
      h('span', {
        class: 'rota-total__life',
        id: 'rotaLifeTotal',
        text: `体調で減る寿命 合計 ${totalLifeLoss(rows.slice(0, planned))}週`,
      }),
      h('span', { text: `アイテムで進む寿命 ${totalAgePlus(r.weeks)}週` }),
      h('span', { text: `エサ代 ${totalFeedPrice(r.feeds, planned)}G` }),
      adventureWeeks(rows.slice(0, planned))
        ? h('span', { text: `うち冒険 ${adventureWeeks(rows.slice(0, planned))}週（体調値なし）` })
        : null
    )
  );
}

/* ---------- 描画 ---------- */

export function render() {
  const area = el('rotationArea');
  if (!area) return;
  const r = rota();
  if (!r) {
    replace(area, h('div', { class: 'empty', text: '「モンスター」タブから種族を選んでください' }));
    return;
  }
  normalizeWeeks(r);
  replace(area, startSection(), feedSection(), planSection());
}

/* ---------- 操作 ---------- */

export const changeActions = {
  'rota:week': (target) => {
    const r = rota();
    if (!r) return;
    const idx = Number(target.dataset.idx);
    if (!r.weeks[idx]) return;
    const field = target.dataset.field;
    const wasAdvStart = field === 'act' && (currentRows()[idx] || {}).advStart;

    r.weeks[idx][field] = target.value;

    if (field === 'act' && target.value === 'ac') {
      // 冒険は4週まとめて。出ているあいだはアイテムも使えない
      for (let j = idx; j < idx + ADVENTURE_WEEKS; j += 1) {
        if (!r.weeks[j]) r.weeks[j] = { item: '', act: '' };
        r.weeks[j].act = 'ac';
        r.weeks[j].item = '';
      }
    } else if (wasAdvStart) {
      // 冒険をやめたら、残りの3週ぶんも空ける
      for (let j = idx + 1; j < idx + ADVENTURE_WEEKS; j += 1) {
        if (r.weeks[j] && r.weeks[j].act === 'ac') r.weeks[j] = { item: '', act: '' };
      }
    }
    save();
    render();
  },

  'rota:stage': (target) => {
    const r = rota();
    if (!r) return;
    r.stage = target.value;
    save();
    render();
  },

  'rota:feed': (target) => {
    const r = rota();
    if (!r) return;
    r.feeds[Number(target.dataset.month)] = target.value;
    save();
    render();
  },
};

export const inputActions = {
  // 入力のたびに数値の列だけ書き換える（表ごと作り直すとカーソルが飛ぶ）
  'rota:start': (target) => {
    const r = rota();
    if (!r) return;
    const key = target.dataset.key;
    const [min, max] = rangeOf(key);
    r.start[key] = clampInt(target.value, min, max, min);
    refreshValues();
    save();
  },

  'rota:jugs': (target) => {
    const r = rota();
    if (!r) return;
    r.jugs = clampInt(target.value, 0, 99, 0);
    refreshValues();
    save();
  },
};
