import moment from "moment";

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

// ✅ ป้ายกำกับ "ครั้งที่" ของงานสัญญา — แสดงเป็น "1/3" (ครั้งที่ปัจจุบัน/จำนวนครั้งทั้งหมดตามสัญญา) แทน
// "1" เฉยๆ ให้เห็นสัดส่วนความคืบหน้าทันทีโดยไม่ต้องเปิดไปดูหน้าภาพรวมสัญญา — visitCount มาจากค่าที่
// บันทึกไว้ในตัวงานเองตอนสร้าง (ดู AddEvent.js/EditEvent.js) ไม่ต้องไป join กับ record อื่น งานที่ไม่ใช่
// งานสัญญา (ไม่มี visitCount) ยังคงโชว์แค่เลขครั้งเฉยๆ เหมือนเดิม
export const formatRoundLabel = (time, visitCount) => {
  if (time === undefined || time === null || time === "") return "";
  return visitCount ? `${time}/${visitCount}` : `${time}`;
};

export const DEFAULT_INTERVAL_MONTHS = 3;

// ✅ "เข้าปีละกี่ครั้ง" — แค่ค่าที่ช่วยให้อ่านระยะห่างระหว่างรอบเข้าใจง่ายขึ้น (ไม่ผูก/บังคับกับจำนวน
// ครั้งทั้งหมดจริง ซึ่งผู้ใช้กำหนดเองอิสระเสมอ) โชว์เฉพาะตอนหารลงตัว (ทุก 5 เดือน = ปีละ 2.4 ครั้ง
// จะสื่อสารผิด — กรณีนั้นโชว์แค่ "ทุก N เดือน" พอ)
export const visitsPerYear = (intervalMonths) => {
  const n = Number(intervalMonths);
  if (!n || n < 1 || 12 % n !== 0) return null;
  return 12 / n;
};
