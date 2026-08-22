/* ===========================================================
   種族ごとに決まっている値（ゲームのモンスター表そのまま）
   -----------------------------------------------------------
   種族を追加したとき、モンスタータブの入力欄をこの値で埋める。
   入れたあとで手で書き換えられるし、「種族データを読み込む」を押せば
   いつでもここの値に戻せる。

   1種族ぶんの中身:
     life   寿命（週）
     gtype  成長タイプ  hayajuku=早熟 / jizoku=持続 / futsuu=普通 / bansei=晩成
     moral  善悪（ヨイワル。-100〜100の5きざみ）
     guts   ガッツ回復（30ガッツ回復にかかる秒数。表の「G回復」）
     apt    成長適正 [ライフ, ちから, かしこさ, 命中, 回避, 丈夫さ]
     init   初期パラメーター（並びは apt と同じ）
     good   得意トレーニング（表の「得意」。複数持つことがある）
            js/data/growth.js の GOOD_KEYS のキーで書く:
              heavy:0 重り引き / heavy:1 変動床 / heavy:2 めいそう / heavy:3 プール
              light:0 ドミノ倒し / light:1 しゃてき / light:2 猛勉強 /
              light:3 巨石よけ / light:4 走り込み / light:5 丸太受け
              trip:0 海岸 / trip:1 砂漠 / trip:2 雪山 / trip:3 密林 / trip:4 火山
            表に修行先（トーブル海岸・マンディー砂漠など）が書いてあるときは、
            地名の部分を落として trip: のキーにする
            得意なトレーニングは、上がるパラメータが1回ごとに +1 される
     feed   エサの好み（js/data/feeds.js の並び）
            ジャガもどき / ミルクもどき / サカナもどき / ゼリーもどき /
            ニクもどき / ビタミンもどき
            like=好き / normal=ふつう / dislike=嫌い

   まだ入れていない種族は、ここに書かなければよい（これまで通り手入力になる）。
   =========================================================== */

export const SPECIES_SPEC = {
  ピクシー: {
    life: 300,
    gtype: 'hayajuku',
    moral: -45,
    guts: 7,
    apt: ['E', 'D', 'A', 'B', 'B', 'E'],
    init: [50, 80, 170, 150, 140, 60],
    feed: ['dislike', 'dislike', 'like', 'like', 'dislike', 'normal'],
    good: [],
  },

  ドラゴン: {
    life: 250,
    gtype: 'hayajuku',
    moral: -70,
    guts: 19,
    apt: ['C', 'A', 'A', 'C', 'D', 'C'],
    init: [100, 170, 160, 120, 90, 110],
    feed: ['dislike', 'dislike', 'normal', 'normal', 'like', 'normal'],
    good: [],
  },

  ケンタウロス: {
    life: 300,
    gtype: 'futsuu',
    moral: 75,
    guts: 16,
    apt: ['C', 'C', 'B', 'A', 'D', 'D'],
    init: [90, 100, 140, 160, 150, 80],
    feed: ['normal', 'normal', 'dislike', 'like', 'like', 'like'],
    good: ['trip:1'], // マンディー砂漠
  },

  コロペンドラ: {
    life: 400,
    gtype: 'bansei',
    moral: 55,
    guts: 12,
    apt: ['A', 'D', 'D', 'C', 'C', 'E'],
    init: [170, 50, 30, 100, 110, 60],
    feed: ['like', 'like', 'normal', 'normal', 'normal', 'like'],
    good: [],
  },

  ビークロン: {
    life: 300,
    gtype: 'hayajuku',
    moral: 30,
    guts: 13,
    apt: ['B', 'B', 'E', 'D', 'D', 'B'],
    init: [120, 150, 50, 70, 90, 140],
    feed: ['like', 'normal', 'normal', 'like', 'normal', 'like'],
    good: ['heavy:0'], // 重り引き
  },

  ヘンガー: {
    life: 300,
    gtype: 'futsuu',
    moral: 70,
    guts: 16,
    apt: ['D', 'B', 'C', 'B', 'B', 'D'],
    init: [100, 150, 110, 160, 170, 90],
    feed: ['normal', 'normal', 'normal', 'normal', 'like', 'like'],
    good: ['light:1'], // しゃてき
  },

  チャッキー: {
    life: 500,
    gtype: 'bansei',
    moral: -85,
    guts: 9,
    apt: ['C', 'E', 'B', 'E', 'B', 'E'],
    init: [20, 10, 150, 40, 160, 30],
    feed: ['dislike', 'like', 'dislike', 'like', 'like', 'normal'],
    good: ['heavy:1'], // 変動ゆか（アプリの表記は「変動床」）
  },

  ゴーレム: {
    life: 350,
    gtype: 'bansei',
    moral: 35,
    guts: 18,
    apt: ['C', 'A', 'C', 'E', 'E', 'A'],
    init: [100, 220, 110, 70, 60, 160],
    feed: ['dislike', 'normal', 'like', 'dislike', 'like', 'like'],
    good: [],
  },

  ロードランナー: {
    life: 350,
    gtype: 'futsuu',
    moral: 10,
    guts: 13,
    apt: ['C', 'C', 'D', 'B', 'C', 'C'],
    init: [130, 120, 80, 140, 100, 110],
    feed: ['dislike', 'normal', 'like', 'normal', 'like', 'normal'],
    good: ['light:4'], // 走り込み
  },

  デュラハン: {
    life: 400,
    gtype: 'jizoku',
    moral: -50,
    guts: 14,
    apt: ['C', 'B', 'C', 'C', 'E', 'A'],
    init: [100, 150, 80, 110, 70, 180],
    feed: ['dislike', 'dislike', 'normal', 'normal', 'like', 'like'],
    good: ['light:0'], // ドミノ倒し
  },

  アローヘッド: {
    life: 400,
    gtype: 'futsuu',
    moral: -10,
    guts: 17,
    apt: ['C', 'C', 'D', 'C', 'D', 'A'],
    init: [120, 80, 70, 30, 40, 170],
    feed: ['dislike', 'normal', 'like', 'normal', 'dislike', 'like'],
    good: [],
  },

  ライガー: {
    life: 300,
    gtype: 'hayajuku',
    moral: 75,
    guts: 9,
    apt: ['D', 'D', 'B', 'A', 'B', 'E'],
    init: [80, 90, 130, 160, 140, 70],
    feed: ['dislike', 'normal', 'normal', 'normal', 'like', 'like'],
    good: [],
  },

  ホッパー: {
    life: 300,
    gtype: 'hayajuku',
    moral: -25,
    guts: 8,
    apt: ['D', 'C', 'C', 'A', 'C', 'E'],
    init: [60, 100, 110, 160, 150, 70],
    feed: ['dislike', 'like', 'normal', 'normal', 'like', 'normal'],
    good: [],
  },

  ハム: {
    life: 300,
    gtype: 'futsuu',
    moral: 45,
    guts: 15,
    apt: ['C', 'A', 'E', 'C', 'A', 'E'],
    init: [50, 130, 70, 100, 140, 40],
    feed: ['dislike', 'like', 'like', 'normal', 'normal', 'like'],
    good: [],
  },

  バクー: {
    life: 400,
    gtype: 'bansei',
    moral: 70,
    guts: 16,
    apt: ['A', 'B', 'E', 'D', 'E', 'C'],
    init: [180, 130, 50, 70, 60, 150],
    feed: ['like', 'like', 'like', 'dislike', 'like', 'dislike'],
    good: [],
  },

  ガリ: {
    life: 250,
    gtype: 'futsuu',
    moral: 90,
    guts: 17,
    apt: ['D', 'B', 'A', 'C', 'D', 'C'],
    init: [110, 130, 160, 120, 90, 100],
    feed: ['dislike', 'dislike', 'normal', 'like', 'like', 'like'],
    good: [],
  },

  アーケロ: {
    life: 450,
    gtype: 'bansei',
    moral: -55,
    guts: 17,
    apt: ['D', 'E', 'A', 'C', 'A', 'D'],
    init: [70, 60, 170, 140, 160, 100],
    feed: ['dislike', 'dislike', 'like', 'dislike', 'normal', 'dislike'],
    good: ['heavy:2'], // めいそう
  },

  グジラ: {
    life: 350,
    gtype: 'bansei',
    moral: 35,
    guts: 18,
    apt: ['B', 'A', 'D', 'E', 'D', 'C'],
    init: [150, 180, 80, 50, 60, 100],
    feed: ['dislike', 'normal', 'like', 'normal', 'normal', 'normal'],
    good: ['trip:0'], // トーブル海岸
  },

  バジャール: {
    life: 350,
    gtype: 'futsuu',
    moral: 5,
    guts: 13,
    apt: ['C', 'B', 'D', 'B', 'C', 'D'],
    init: [100, 130, 90, 120, 110, 80],
    feed: ['dislike', 'normal', 'normal', 'normal', 'like', 'like'],
    good: [],
  },

  スエゾー: {
    life: 350,
    gtype: 'hayajuku',
    moral: -65,
    guts: 12,
    apt: ['D', 'C', 'A', 'B', 'D', 'D'],
    init: [80, 120, 170, 130, 90, 100],
    feed: ['dislike', 'normal', 'normal', 'like', 'like', 'normal'],
    good: [],
  },
};

/** その種族のデータがあるか */
export function hasSpec(name) {
  return !!SPECIES_SPEC[name];
}
