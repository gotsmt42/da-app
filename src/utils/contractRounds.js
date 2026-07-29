/**
 * contractRounds.js — นับ "จำนวนครั้งที่ใช้ไปแล้ว" ของสัญญาแบบนับตามครั้ง (round) จริง ไม่ใช่นับ
 * document ดิบ — ปกติ 1 ครั้ง = 1 document แต่ครั้งที่เข้างานไม่ต่อเนื่อง (เว้นช่วงแล้วกลับมาเข้าอีก)
 * จะมีหลาย document แชร์ contractGroupId + time (ครั้งที่) + jobGroupId เดียวกัน — ถ้านับความยาว
 * array ตรงๆ จะนับครั้งซ้ำเกินจริง ต้องนับจำนวนค่า time ที่ไม่ซ้ำกันแทน
 */
export const countUsedRounds = (visits) => {
  const rounds = new Set();
  (visits || []).forEach((v) => {
    if (v.time !== undefined && v.time !== null && v.time !== "") rounds.add(String(v.time));
  });
  return rounds.size;
};
