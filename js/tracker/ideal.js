/* ===========================================================
   理想使い込み回数の計算
   -----------------------------------------------------------
   1試合（60秒）のあいだ、初期ガッツ50から始めて
   ガッツが足りなければ回復を待ちながら、技を撃てるだけ撃った回数。
   monGutsRecovery は「30ガッツ回復するのにかかる秒数」（6〜19）。
   =========================================================== */

export const BATTLE_TIME = 60;
export const INIT_GUTS = 50;
export const GUTS_PER_RECOVERY = 30;

/**
 * @param {number} gutsCost         技の消費ガッツ
 * @param {number} motionTime       技のモーション秒（命中時 or 空振り時）
 * @param {number} monGutsRecovery  30ガッツ回復にかかる秒数
 * @returns {number} 撃てる回数
 */
export function calcIdeal(gutsCost, motionTime, monGutsRecovery) {
  const recoveryPerSecond = GUTS_PER_RECOVERY / monGutsRecovery;
  let guts = INIT_GUTS;
  let time = 0;
  let count = 0;

  while (time < BATTLE_TIME) {
    if (guts < gutsCost) {
      time += (gutsCost - guts) / recoveryPerSecond;
      guts = gutsCost;
      if (time >= BATTLE_TIME) break;
    }
    if (time + motionTime > BATTLE_TIME) break;
    guts -= gutsCost;
    time += motionTime;
    count++;
  }
  return count;
}
