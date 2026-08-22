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
              light:3 巨石よけ / light:4 走り込み / light:5 丸太受け / mc 修行
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
