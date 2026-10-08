
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
/**
 * ✅ (8 ต.ค. 2569 ผู้ใช้: "การเลือกและแสดงครั้งที่ของงาน ให้แสดงปีของสัญญาด้วย เช่น ครั้งที่ 2/4 - 2569")
 * ปีของสัญญา (พ.ศ.) — จากวันเริ่มสัญญาก่อน ไม่มีค่อยอ่านจากท้ายเลขที่สัญญา (FAPTY05-2569)
 * รับได้ทั้งงานดิบจาก API และ event ของปฏิทิน (ข้อมูลอยู่ใน extendedProps)
 */
export const contractYearOf = (ev) => {
  if (!ev) return null;
  const src = ev.extendedProps ? { ...ev.extendedProps, ...ev } : ev;
  if (src.contractStart) {
    const d = new Date(src.contractStart);
    if (!Number.isNaN(d.getTime())) return d.getFullYear() + 543;
  }
  const m = String(src.contractNo || "").trim().match(/-(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return y > 2400 ? y : y + 543;
  }
  return null;
};

/**
 * ✅ (8 ต.ค. 2569 ผู้ใช้: "ลงเป็นแบบ เข้าปีละกี่ครั้ง และเข้ากี่ปี · ไม่ให้แสดงเป็น 1/8, 2/8")
 * จำนวนปีของสัญญา — contractYears ที่เลือกในฟอร์ม → ไม่มี (สัญญาเก่า) คิดจากช่วงวันที่สัญญา → ไม่มีวันที่ = 1 ปี
 * ⚠️ ฝั่ง server มีตัวเดียวกันที่ utils/contractVisits.js (contractYearsOf) — แก้ต้องแก้คู่กัน
 */
export const MAX_CONTRACT_YEARS = 5;
export const contractYearsOf = (c) => {
  if (!c) return 1;
  const src = c.extendedProps ? { ...c.extendedProps, ...c } : c;
  const y = Number(src.contractYears);
  if (Number.isInteger(y) && y >= 1) return Math.min(y, MAX_CONTRACT_YEARS);
  const a = src.contractStart ? new Date(src.contractStart) : null;
  const b = src.contractEnd ? new Date(src.contractEnd) : null;
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 1;
  const days = (b - a) / 86400000 + 1;
  return Math.min(MAX_CONTRACT_YEARS, Math.max(1, Math.round(days / 365.25)));
};

/** เข้าปีละกี่ครั้ง — จากรอบเข้า (หาร 12 ลงตัว) · ไม่งั้นแบ่งจำนวนครั้งทั้งหมดตามจำนวนปี (หารลงตัว) */
export const perYearOf = (c) => {
  if (!c) return 0;
  const src = c.extendedProps ? { ...c.extendedProps, ...c } : c;
  const n = Number(src.intervalMonths);
  if (n >= 1 && 12 % n === 0) return 12 / n;
  const total = Number(src.visitCount) || 0;
  const years = contractYearsOf(src);
  return years > 1 && total % years === 0 ? total / years : total;
};

/**
 * ป้ายครั้งที่ — นับใหม่ทุกปีของสัญญา (ผู้ใช้เลือก 8 ต.ค. 2569)
 *   ปีละ 4 ครั้ง 2 ปี เริ่ม 2569: ครั้งที่ 5 → "1/4 - 2570" (ไม่ใช่ "5/8")
 *   ปีของรอบ = ปีที่เริ่มสัญญา + (ปีที่ของสัญญา − 1)
 * ไม่ส่งงาน/สัญญามา (ctx) → แบบเดิม "2/4"
 */
export const formatRoundLabel = (time, visitCount, ctx) => {
  if (time === undefined || time === null || time === "") return "";
  if (!ctx) return visitCount ? `${time}/${visitCount}` : `${time}`;
  const t = Number(time);
  const per = perYearOf(ctx) || Number(visitCount) || 0;
  const startYear = contractYearOf(ctx);
  if (!per || !Number.isInteger(t) || t < 1) {
    const base = visitCount ? `${time}/${visitCount}` : `${time}`;
    return startYear ? `${base} - ${startYear}` : base;
  }
  const yearIdx = Math.ceil(t / per);
  const inYear = ((t - 1) % per) + 1;
  const years = contractYearsOf(ctx);
  if (startYear) return `${inYear}/${per} - ${startYear + yearIdx - 1}`;
  return years > 1 ? `${inYear}/${per} (ปีที่ ${yearIdx})` : `${inYear}/${per}`;
};

export const DEFAULT_INTERVAL_MONTHS = 3;

/**
 * ✅ จำนวนครั้งทั้งหมดของสัญญา — ตัวตัดสินเดียวที่ทุกจุดต้องใช้ (ป้าย "x/y", ปุ่ม "+ เพิ่มครั้งถัดไป",
 *    แจ้งเตือนเลยกำหนดรอบ, คอลัมน์ครั้งที่ N, รายการสัญญาในฟอร์มเพิ่มงาน)
 * 🐛 ที่แก้: เดิมป้าย x/y คิดจาก "รอบเข้า" (ทุก 6 เดือน = 2 ครั้ง) แต่ปุ่มเพิ่มครั้ง/แจ้งเตือนอ่าน visitCount
 *    ที่บันทึกแยกไว้ ซึ่งค้างค่าเก่าได้ — สัญญาขึ้น "2/2 ครบแล้ว" แต่ยังมีช่องให้ลงครั้งที่ 3 และเตือนเลยกำหนด
 * กติกา: ตั้งรอบเข้าที่หาร 12 ลงตัว → 12 ÷ รอบเข้า (ทั้งระบบถือสัญญาเป็นรายปี — ตรงกับที่ฟอร์มเพิ่มสัญญา
 *        และการแก้รอบเข้าบันทึกไว้) ไม่งั้นใช้ visitCount ที่กรอกไว้ตรงๆ
 * ⚠️ ฝั่ง server มีตัวเดียวกันที่ utils/contractVisits.js (totalRoundsOf) — แก้ต้องแก้คู่กัน
 */
export const totalRoundsOf = (c) => {
  const n = Number(c?.intervalMonths);
  // ✅ ปีละ N ครั้ง × จำนวนปีของสัญญา (สัญญา 1 ปี = เหมือนเดิมทุกประการ)
  if (n >= 1 && 12 % n === 0) return (12 / n) * contractYearsOf(c);
  return Number(c?.visitCount) || 0;
};

// ✅ "เข้าปีละกี่ครั้ง" — แค่ค่าที่ช่วยให้อ่านระยะห่างระหว่างรอบเข้าใจง่ายขึ้น (ไม่ผูก/บังคับกับจำนวน
// ครั้งทั้งหมดจริง ซึ่งผู้ใช้กำหนดเองอิสระเสมอ) โชว์เฉพาะตอนหารลงตัว (ทุก 5 เดือน = ปีละ 2.4 ครั้ง
// จะสื่อสารผิด — กรณีนั้นโชว์แค่ "ทุก N เดือน" พอ)
export const visitsPerYear = (intervalMonths) => {
  const n = Number(intervalMonths);
  if (!n || n < 1 || 12 % n !== 0) return null;
  return 12 / n;
};

/**
 * ✅ ตัวเลือกด่วน "เข้าปีละกี่ครั้ง" — ทางลัดกรอก "รอบเข้า" (intervalMonths) โดยคิดเป็นจำนวนครั้ง/ปี
 * แทนจำนวนเดือน เพราะคนตั้งสัญญาคิดเป็น "เข้าปีละกี่ครั้ง" ก่อนเสมอ (คุยกับลูกค้าด้วยหน่วยนี้) แล้ว
 * ค่อยแปลงเป็นเดือนในใจเอง — ให้ระบบแปลงให้แทน ไม่ต้องคิดเลขเอง
 * ⚠️ เก็บเรียงจากถี่ไปห่าง (12→1 ครั้ง/ปี) ให้ตรงกับสัญชาตญาณอ่านจากบ่อยไปน้อย
 * ⚠️ ใช้ค่าเดียวกับที่ visitsPerYear() ยอมรับเป๊ะ (ตัวหาร 12 ลงตัว) — สองฟังก์ชันนี้ต้องสมมาตรกัน
 * (แปลงไปแล้วแปลงกลับต้องได้ค่าเดิมเสมอ) ไม่งั้นตัวเลือกด่วนกับป้ายแสดงผลจะพูดกันคนละภาษา
 */
export const INTERVAL_MONTHS_PRESETS = [1, 2, 3, 4, 6, 12].map((months) => {
  const perYear = 12 / months;
  // ⚠️ 2 ตัวปลายพิเศษ — "ทุก 1 เดือน"/"ทุก 12 เดือน" ฟังเป็นภาษาพูดไทยแปลกๆ (เก้อ) คนไทยพูดว่า
  // "ทุกเดือน"/"ทุกปี" ตรงๆ มากกว่า ตัวกลางๆ (2/3/4/6) พูดเป็นจำนวนเดือนได้เป็นธรรมชาติอยู่แล้ว
  const everyLabel = months === 1 ? "ทุกเดือน" : months === 12 ? "ทุกปี" : `ทุก ${months} เดือน`;
  return { months, perYear, label: `${everyLabel} (ปีละ ${perYear} ครั้ง)` };
});
