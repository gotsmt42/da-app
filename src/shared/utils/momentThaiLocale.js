import moment from "moment";

/**
 * momentThaiLocale.js — ลงทะเบียน locale ไทยกับ moment "ตัวที่แอปใช้จริง"
 *
 * 🐛 BUG ที่แก้ (เดือนขึ้นเป็นภาษาอังกฤษทั้งแอป ทั้งที่ 15 ไฟล์ import "moment/locale/th" กันอยู่):
 * Vite แยก moment/locale/th ออกเป็น chunk ของตัวเองตอน pre-bundle (node_modules/.vite/deps/
 * moment_locale_th.js ขนาด 148 KB) แล้ว **ฝังสำเนา moment.js ทั้งก้อนไว้ข้างในนั้นเอง** แทนที่จะ
 * อ้าง chunk ของ moment ที่โค้ดแอปใช้ (chunk-R5GOII4R.js) ผลคือ defineLocale('th') ไปลงทะเบียน
 * กับ moment คนละตัว — moment ตัวที่แอปใช้จึงยังมีแค่ locale 'en' ตลอด
 *
 * พิสูจน์กับไฟล์จริงที่เบราว์เซอร์โหลด:
 *   import moment from ".vite/deps/moment.js"      -> moment.locales() = ["en"]
 *   import ".vite/deps/moment_locale_th.js"        -> moment.locales() = ["en"]  (ไม่เปลี่ยน!)
 *   moment("2026-08-11").locale("th").format(...)  -> "11 August 2026"
 *
 * ⚠️ ที่ต้องระวังเป็นพิเศษ: มันไม่ throw และไม่เตือนอะไรเลย — moment เจอ locale ที่ยังไม่ลงทะเบียน
 * ก็ถอยไปใช้ 'en' เงียบๆ บั๊กนี้จึงรอดสายตามาตลอด และ vitest ก็จับไม่ได้เพราะตอนรันเทสต์ Vite
 * ไม่ได้ pre-bundle แบบเดียวกับ dev server (โมดูลจึงถูกแชร์กันถูกต้อง เทสต์เลยผ่านทั้งที่ของจริงพัง)
 *
 * ✅ วิธีแก้: ประกาศ locale เองกับ instance ที่ import เข้ามาตรงนี้ ไม่พึ่ง side-effect ของไฟล์ใน
 * moment/locale อีกต่อไป — ได้ผลเหมือนกันทุกที่ ไม่ว่าจะเป็น dev server, production build,
 * vitest หรือฝั่ง server เพราะไม่ขึ้นกับพฤติกรรมการแบ่ง chunk ของ bundler เลย
 *
 * ⚠️ ค่าทั้งหมดคัดมาจาก moment/locale/th.js ตรงตัว ถ้าอัปเกรด moment แล้วอยากได้ของใหม่ ให้เทียบ
 * กับไฟล์นั้นอีกครั้ง
 */
if (!moment.locales().includes("th")) {
  moment.defineLocale("th", {
    months: "มกราคม_กุมภาพันธ์_มีนาคม_เมษายน_พฤษภาคม_มิถุนายน_กรกฎาคม_สิงหาคม_กันยายน_ตุลาคม_พฤศจิกายน_ธันวาคม".split("_"),
    monthsShort: "ม.ค._ก.พ._มี.ค._เม.ย._พ.ค._มิ.ย._ก.ค._ส.ค._ก.ย._ต.ค._พ.ย._ธ.ค.".split("_"),
    monthsParseExact: true,
    weekdays: "อาทิตย์_จันทร์_อังคาร_พุธ_พฤหัสบดี_ศุกร์_เสาร์".split("_"),
    // ⚠️ ตั้งใจให้ต่างจาก weekdays แค่ "พฤหัส" — ตามต้นฉบับของ moment เป๊ะ
    weekdaysShort: "อาทิตย์_จันทร์_อังคาร_พุธ_พฤหัส_ศุกร์_เสาร์".split("_"),
    weekdaysMin: "อา._จ._อ._พ._พฤ._ศ._ส.".split("_"),
    weekdaysParseExact: true,
    // ⚠️ ตารางนี้สำคัญกับปฏิทิน MUI เป็นพิเศษ — 10 จาก 27 รูปแบบของมันใช้ token ย่อ (L/LL/ll/lll)
    // ซึ่งถูกคลี่ผ่านตารางนี้ ก่อนที่ thaiDate จะแทนที่ปีเป็น พ.ศ. (ดู expandLocalizedTokens)
    longDateFormat: {
      LT: "H:mm",
      LTS: "H:mm:ss",
      L: "DD/MM/YYYY",
      LL: "D MMMM YYYY",
      LLL: "D MMMM YYYY เวลา H:mm",
      LLLL: "วันddddที่ D MMMM YYYY เวลา H:mm",
    },
    meridiemParse: /ก่อนเที่ยง|หลังเที่ยง/,
    isPM: (input) => input === "หลังเที่ยง",
    meridiem: (hour) => (hour < 12 ? "ก่อนเที่ยง" : "หลังเที่ยง"),
    calendar: {
      sameDay: "[วันนี้ เวลา] LT",
      nextDay: "[พรุ่งนี้ เวลา] LT",
      nextWeek: "dddd[หน้า เวลา] LT",
      lastDay: "[เมื่อวานนี้ เวลา] LT",
      lastWeek: "[วัน]dddd[ที่แล้ว เวลา] LT",
      sameElse: "L",
    },
    relativeTime: {
      future: "อีก %s",
      past: "%sที่แล้ว",
      s: "ไม่กี่วินาที",
      ss: "%d วินาที",
      m: "1 นาที",
      mm: "%d นาที",
      h: "1 ชั่วโมง",
      hh: "%d ชั่วโมง",
      d: "1 วัน",
      dd: "%d วัน",
      w: "1 สัปดาห์",
      ww: "%d สัปดาห์",
      M: "1 เดือน",
      MM: "%d เดือน",
      y: "1 ปี",
      yy: "%d ปี",
    },
  });
}

// ✅ ตั้งเป็นภาษาเริ่มต้นของทั้งแอป — โค้ดเดิมหลายสิบจุดเรียก .format("DD MMM") เฉยๆ โดยคาดหวัง
// เดือนไทยอยู่แล้ว (เพราะเข้าใจว่า import "moment/locale/th" ทำให้เป็นแบบนั้น)
// ⚠️ ไม่กระทบรูปแบบตัวเลขที่ส่งขึ้น server — locale ไทยของ moment ไม่ได้เปลี่ยนเลขเป็นเลขไทย
// "YYYY-MM-DD" จึงยังได้ผลลัพธ์เดิมทุกประการ
moment.locale("th");

export default moment;
