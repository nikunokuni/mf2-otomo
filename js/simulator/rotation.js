/* ===========================================================
   育成計算タブ「調整ローテ」
   -----------------------------------------------------------
   育成計画の短期詳細版。
   育成計画が「全期間を段階ごとにざっくり組む」ものなのに対して、
   こちらは短い期間を1週ずつ細かく組むための画面。

   いまできること
     ・調整ローテを始める時点の内部数値を入れる（mon.rota.start）
     ・そのモンスターの好き嫌いを当てはめたエサの効果を一覧で見る

   これから作るもの
     ・毎週のアイテムと行動、毎月のエサを入れる表
     ・それをもとに内部数値を1週ずつ計算して出す

   計算に使うのは js/data/items.js の数値のほう。
   アイテムの効果そのものを思い出したいときは早見タブを見る
   （ユーザーは効果を覚えている前提なので、この画面には出さない）。

   設計のメモは docs/roadmap.md の②。
   =========================================================== */

import { INNER } from '../data/items.js';
import { FEEDS, LIKING_LABEL, feedEffect } from '../data/feeds.js';
import { save, currentMon } from '../store.js';
import { el, h, replace, clampInt } from '../dom.js';
import { moralRange } from './inner-calc.js';

/**
 * 開始時点に入れる内部数値。並びは画面に出す順。
 * 人気（fame）はいまのところ調整ローテでは使わないので出していない。
 */
const START_KEYS = ['form', 'moral', 'stress', 'fatigue', 'fear', 'spoil'];

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
    h('div', {
      class: 'note',
      style: 'margin-top:6px',
      text:
        `ヨイワルは、モンスタータブの初期ヨイワル（${mon ? mon.sim.moral : 0}）から` +
        '±100までしか動かないので、範囲がせまくなることがあります。',
    })
  );
}

/** 数字を +3 / -3 / 0 の形にそろえる */
function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * このモンスターの好き嫌いを当てはめたエサの効果。
 * 好き嫌いを変えるのはモンスタータブなので、ここは読むだけ。
 */
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

/** まだ作っていないぶんの案内 */
function todoSection() {
  return h(
    'div',
    { class: 'sim-section' },
    h('div', { class: 'sim-section__title', text: '毎週のアイテムと行動 / 毎月のエサ' }),
    h('div', { class: 'callout callout--info' },
      h('div', { text: 'ここはまだ作っていません。' }),
      h('div', { text: '1週ずつアイテムと行動を並べて、内部数値がどう動くかをその場で出す予定です。' })
    ),
    h('div', { class: 'empty' },
      h('div', { text: 'アイテムの効果は早見タブで確認できます。' })
    )
  );
}

export function render() {
  const area = el('rotationArea');
  if (!area) return;
  if (!rota()) {
    replace(area, h('div', { class: 'empty', text: '「モンスター」タブから種族を選んでください' }));
    return;
  }
  replace(area, startSection(), feedSection(), todoSection());
}

export const inputActions = {
  'rota:start': (target) => {
    const r = rota();
    if (!r) return;
    const key = target.dataset.key;
    const [min, max] = rangeOf(key);
    r.start[key] = clampInt(target.value, min, max, min);
    save();
  },
};
