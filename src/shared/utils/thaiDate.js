import moment from "moment";
import "@/shared/utils/momentThaiLocale";

/**
 * thaiDate.js — ศูนย์กลางการแสดงวันที่แบบไทย (พ.ศ. + ชื่อเดือนภาษาไทย)
 *
 * ⚠️ กฎเหล็กข้อเดียวที่ต้องจำ: ไฟล์นี้ใช้กับ "วันที่ที่คนอ่าน" เท่านั้น
 * ห้ามเอาไปใช้กับค่าที่ส่งขึ้น server / เก็บใน state / เทียบค่าในโค้ด ซึ่งต้องเป็น ค.ศ.
 * รูปแบบ "YYYY-MM-DD" ตลอดไป (มีอยู่ 61 จุดในโปรเจกต์) — ถ้าเผลอแปลงเป็น พ.ศ. ตรงนั้น
 * ข้อมูลจะเพี้ยนไป 543 ปีแบบเงียบๆ และ MongoDB จะเก็บวันที่ผิดโดยไม่มี error ให้เห็นเลย
 *
 * 🐛 วิธีที่ "ดูเหมือนจะได้" แต่พัง: clone().add(543, "years")
 * 29 ก.พ. 2567 (ค.ศ. 2024 เป็นปีอธิกสุรทิน) พอบวกไป 543 ปีจะกลายเป็น ค.ศ. 2567 ซึ่งไม่ใช่
 * ปีอธิกสุรทิน moment จึงหดวันให้เหลือ 28 ก.พ. เงียบๆ = แสดงวันที่ผิดไป 1 วัน
 * ✅ วิธีที่ใช้จริง: ไม่ขยับตัววันที่เลย แต่ "แก้ที่ตัวรูปแบบ" — เปลี่ยน token YYYY ให้กลายเป็น
 * ข้อความตายตัวของปี พ.ศ. ([2569]) ก่อนส่งให้ moment format ตัววันจึงไม่ถูกแตะต้อง
 */

/** ส่วนต่างระหว่างพุทธศักราชกับคริสต์ศักราช */
export const BE_OFFSET = 543;

/** รูปแบบมาตรฐานของช่องกรอกวันที่ทั้งแอป — ใช้ตัวเดียวกันทุกที่เพื่อไม่ให้ผู้ใช้ต้องเดา */
export const THAI_DATE_FORMAT = "DD/MM/YYYY";

/** ข้อความใบ้ในช่องกรอก บอกลำดับ วัน-เดือน-ปี และย้ำว่าเป็น พ.ศ. */
export const THAI_DATE_PLACEHOLDER = "วว/ดด/ปปปป (พ.ศ.)";

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const toBEYear = (ceYear) => Number(ceYear) + BE_OFFSET;
export const toCEYear = (beYear) => Number(beYear) - BE_OFFSET;

/**
 * แปลง token ปีในรูปแบบของ moment ให้กลายเป็นข้อความตายตัวของปี พ.ศ.
 *
 * ⚠️ ต้องจับ [...] ที่ผู้เรียก escape ไว้เองก่อนเสมอ (regex ตัวแรกของ alternation) ไม่งั้นรูปแบบ
 * อย่าง "[ปี] YYYY" จะถูกมองว่าข้างใน [] เป็น token ด้วย และรูปแบบที่ตั้งใจ escape คำว่า YYYY
 * ไว้เป็นข้อความ ("[YYYY]") จะถูกแปลงเป็นตัวเลขทั้งที่ไม่ควร
 */
export const patchYearTokens = (pattern, beYear) =>
  String(pattern).replace(/\[[^\]]*\]|Y{2,4}/g, (token) => {
    if (token[0] === "[") return token;
    if (token === "YY") return `[${String(beYear).slice(-2)}]`;
    return `[${beYear}]`;
  });

/**
 * คลี่ token ย่อของ moment (L, LL, LLL, LLLL, l..llll, LT, LTS) ให้กลายเป็นรูปแบบเต็มก่อน
 *
 * 🐛 BUG ที่แก้ (ปีหลุดเป็น ค.ศ. ในบางจุดทั้งที่จุดอื่นถูก): token พวกนี้ "มีปีอยู่ข้างใน" แต่ไม่ได้
 * เขียนว่า YYYY ตรงๆ — patchYearTokens จึงมองไม่เห็นแล้วปล่อยผ่าน ทำให้ moment เรนเดอร์ปี ค.ศ. ออกมา
 * MUI ใช้ token พวกนี้ถึง 10 จาก 27 รูปแบบของ adapter (fullDate:"ll", keyboardDate:"L",
 * fullDateWithWeekday:"dddd, LL" ฯลฯ) — อาการที่เห็นคือ aria-label ของปุ่มเปิดปฏิทินขึ้นว่า
 * "selected date is 11 ส.ค. 2026" (เดือนไทยแต่ปี ค.ศ.) ปนกับช่องกรอกที่เป็น 2569
 *
 * ✅ moment คลี่ให้เองได้ผ่าน localeData().longDateFormat() ซึ่งรองรับตัวพิมพ์เล็กด้วย (มันสร้าง
 * จากตัวพิมพ์ใหญ่ให้อัตโนมัติแล้วแคชไว้) จึงไม่ต้องเขียนตารางแปลงเอง
 */
const LOCALIZED_TOKEN = /\[[^\]]*\]|LTS|LT|L{1,4}|l{1,4}/g;

export const expandLocalizedTokens = (pattern, localeData) => {
  if (!localeData) return String(pattern);
  return String(pattern).replace(LOCALIZED_TOKEN, (token) => {
    if (token[0] === "[") return token;
    return localeData.longDateFormat(token) || token;
  });
};

/**
 * คลี่ token ย่อ แล้วค่อยแทนที่ปีเป็น พ.ศ. — ลำดับนี้สลับกันไม่ได้
 *
 * ⚡ แคชผลไว้เพราะตารางหนึ่งหน้าเรียกด้วย (รูปแบบ, ปี) ชุดเดิมซ้ำหลายร้อยครั้ง — รูปแบบในโปรเจกต์มี
 * ไม่ถึง 20 แบบ และปีที่ใช้จริงมีไม่กี่ปี แคชจึงโตจำกัดโดยธรรมชาติ ไม่ต้องมีกลไกล้างทิ้ง
 */
const patternCache = new Map();

export const toThaiPattern = (pattern, beYear, localeData) => {
  const key = beYear + "|" + pattern;
  const hit = patternCache.get(key);
  if (hit !== undefined) return hit;
  const out = patchYearTokens(expandLocalizedTokens(pattern, localeData), beYear);
  patternCache.set(key, out);
  return out;
};

/**
 * รับได้ทั้ง Date / string / moment / timestamp แล้วคืน moment ที่ใช้ได้ หรือ null ถ้าค่าไม่ถูกต้อง
 *
 * ⚠️ สตริงต้อง parse แบบระบุรูปแบบ + strict เสมอ ห้ามโยนเข้า moment(value) ตรงๆ — ถ้าสตริงไม่เข้า
 * รูปแบบใดเลย moment จะตกไปใช้ new Date() ของเบราว์เซอร์แล้วพ่น deprecation warning ยาวเหยียด
 * ลง console ทุกครั้ง (ค่าที่ยังไม่ได้กรอกมีเป็นปกติในแอปนี้ จึงจะกลายเป็นสแปมเต็ม console)
 * และผลลัพธ์ยัง "ไม่เหมือนกันในแต่ละเบราว์เซอร์" ด้วย
 */
const STRING_FORMATS = [moment.ISO_8601, "YYYY-MM-DD", "YYYY-MM-DD HH:mm", "YYYY-MM"];

/**
 * ⚡ เลือกรูปแบบจาก "รูปทรงของสตริง" ก่อน แล้วค่อย parse ด้วยรูปแบบเดียว
 *
 * 🐛 ที่ต้องทำ (หน้าภาพรวมงานหน่วงตอนเปิด): เดิมส่ง array 4 รูปแบบเข้า moment ทีเดียว ซึ่ง moment
 * จะ "ลองทุกรูปแบบแล้วให้คะแนนเลือกตัวที่ดีที่สุด" — วัดจริงแล้วกิน 36.3 µs ต่อครั้ง เทียบกับ 9.5 µs
 * ถ้าระบุรูปแบบเดียว (ช้ากว่าเกือบ 4 เท่า) และคิดเป็น 72% ของเวลาทั้งหมดของ formatThai
 * หน้าภาพรวมงานเรียกฟังก์ชันนี้หลายร้อยครั้งต่อการ render หนึ่งรอบ (ทุกแถว × ทุกช่องวันที่)
 * ⚠️ ยังคง array ไว้เป็นทางสำรองสำหรับสตริงรูปแบบแปลกๆ ที่ไม่เข้าเงื่อนไขใดเลย
 */
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_DATETIME_T = /^\d{4}-\d{2}-\d{2}T/;
const RE_DATETIME_SP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
const RE_MONTH = /^\d{4}-\d{2}$/;

const parseString = (s) => {
  if (RE_DATE.test(s)) return moment(s, "YYYY-MM-DD", true);
  if (RE_DATETIME_T.test(s)) return moment(s, moment.ISO_8601, true);
  if (RE_DATETIME_SP.test(s)) return moment(s, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"], true);
  if (RE_MONTH.test(s)) return moment(s, "YYYY-MM", true);
  return moment(s, STRING_FORMATS, true);
};

const toMoment = (value, parseFormat) => {
  if (value == null || value === "") return null;
  let m;
  if (moment.isMoment(value)) m = value.clone();
  else if (parseFormat) m = moment(value, parseFormat, true);
  else if (typeof value === "string") m = parseString(value);
  else m = moment(value); // Date object หรือ timestamp — ไม่มีปัญหาเรื่องรูปแบบ
  return m.isValid() ? m : null;
};

/**
 * แสดงวันที่เป็นภาษาไทย + ปี พ.ศ. ตามรูปแบบ moment ที่กำหนด
 * @param {*} value        วันที่ (Date/string/moment)
 * @param {string} pattern รูปแบบของ moment เช่น "D MMM YYYY"
 * @param {object} [opts]  { fallback: ข้อความเมื่อค่าไม่ถูกต้อง, parseFormat: รูปแบบตอนอ่านค่า }
 */
export const formatThai = (value, pattern, opts = {}) => {
  const { fallback = "", parseFormat } = opts;
  const m = toMoment(value, parseFormat);
  if (!m) return fallback;
  const th = m.locale("th");
  return th.format(toThaiPattern(pattern, toBEYear(th.year()), th.localeData()));
};

/**
 * อ่านข้อความวันที่แบบ พ.ศ. กลับเป็น moment ของ ค.ศ.
 *
 * 🐛 ที่ต้องแปลงเลขปีในสตริงก่อน parse (ไม่ใช่ parse แล้วค่อยลบ 543): moment ตรวจความถูกต้อง
 * ของวันตามปฏิทินของ "ปีที่มันอ่านได้" — "29/02/2567" จึงถูกตีว่าไม่มีอยู่จริงทันที (ค.ศ. 2567
 * ไม่ใช่ปีอธิกสุรทิน) แล้วคืน invalid ตั้งแต่ต้น ยังไม่ทันได้ลบ 543 เลย
 *
 * ⚠️ strict = true เสมอ — ผู้ใช้พิมพ์ค้างกลางทางได้ตลอด ("20/08/25") ถ้าไม่ strict moment จะ
 * เดาให้กลายเป็นวันที่มั่วๆ แล้วหลุดเข้า state ไปถึง server
 */
export const parseThai = (text, pattern = THAI_DATE_FORMAT) => {
  if (text == null || text === "") return null;
  // แปลงเฉพาะเลข 4 หลักที่อยู่ในช่วงปี พ.ศ. จริงๆ (>= 2400) — กันไม่ให้ไปโดนเลขอื่นในสตริง
  const ceText = String(text).replace(/\d{4}/, (y) =>
    Number(y) >= 2400 ? String(toCEYear(y)) : y
  );
  const m = moment(ceText, pattern, "th", true);
  return m.isValid() ? m : null;
};

/* ── รูปแบบสำเร็จรูปที่ใช้บ่อย ─────────────────────────────────────────────
   ⚠️ ให้เรียกผ่านตัวช่วยพวกนี้แทนการเขียน formatThai(v, "D MMM YYYY") กระจายทั่วโปรเจกต์
   เพราะถ้าวันหนึ่งต้องเปลี่ยนรูปแบบ จะได้แก้ที่เดียว ไม่ต้องไล่หา 35 ไฟล์ */

/** 20 ส.ค. 2569 — รูปแบบหลักที่ใช้แสดงวันที่ทั่วไป อ่านง่าย ไม่มีทางสับสนวัน/เดือน */
export const thaiDate = (value, fallback = "-") =>
  formatThai(value, "D MMM YYYY", { fallback });

/** 20/08/2569 — ใช้ในตาราง/ช่องกรอกที่ต้องการความกระชับและความกว้างคงที่ */
export const thaiDateNumeric = (value, fallback = "-") =>
  formatThai(value, THAI_DATE_FORMAT, { fallback });

/** 20 สิงหาคม 2569 — ใช้ในเอกสารทางการ (ใบส่งมอบงาน / ใบแจ้งเข้างาน) */
export const thaiDateFull = (value, fallback = "-") =>
  formatThai(value, "D MMMM YYYY", { fallback });

/** 20 ส.ค. 2569 14:30 */
export const thaiDateTime = (value, fallback = "-") =>
  formatThai(value, "D MMM YYYY HH:mm", { fallback });

/** ส.ค. 2569 */
export const thaiMonthYear = (value, fallback = "-") =>
  formatThai(value, "MMM YYYY", { fallback });

/** สิงหาคม 2569 — หัวข้อเดือนของปฏิทิน/รายงาน */
export const thaiMonthYearFull = (value, fallback = "-") =>
  formatThai(value, "MMMM YYYY", { fallback });

/** 2569 */
export const thaiYear = (value, fallback = "-") =>
  formatThai(value, "YYYY", { fallback });

/**
 * ช่วงวันที่แบบย่อ — ตัดส่วนที่ซ้ำกันออกเพื่อไม่ให้ยาวเกินจำเป็นและไม่ขาดกลางเวลาขึ้นบรรทัดใหม่
 * "20 – 25 ส.ค. 2569" · "20 ส.ค. – 3 ก.ย. 2569" · "20 ส.ค. 2568 – 3 ก.ย. 2569"
 */
export const thaiDateRange = (startValue, endValue, fallback = "-") => {
  const start = toMoment(startValue);
  if (!start) return fallback;
  const end = toMoment(endValue);
  if (!end || start.isSame(end, "day")) return thaiDate(start, fallback);

  if (start.year() === end.year()) {
    if (start.month() === end.month()) {
      return `${start.locale("th").format("D")} – ${thaiDate(end)}`;
    }
    return `${start.locale("th").format("D MMM")} – ${thaiDate(end)}`;
  }
  return `${thaiDate(start)} – ${thaiDate(end)}`;
};
