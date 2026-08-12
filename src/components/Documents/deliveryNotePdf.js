/**
 * deliveryNotePdf.js — "ใบส่งมอบงาน" (หนังสือส่งมอบเอกสาร/งานบริการให้ลูกค้า)
 *
 * วางเลย์เอาต์ตามแบบฟอร์มจริงของบริษัทเป๊ะๆ:
 *   [โลโก้]  ชื่อบริษัท (ไทย/อังกฤษ) · ที่อยู่สำนักงานใหญ่ · เลขประจำตัวผู้เสียภาษี
 *   เลขที่ / วันที่ / เรื่อง / โครงการ (ชื่อโครงการ + บริษัทลูกค้า + ที่อยู่)
 *   เรียน / อ้างถึง / สิ่งที่ส่งมาด้วย
 *   ย่อหน้าเนื้อความ
 *   กรอบลงนามรับเอกสาร (ฝั่งลูกค้า)  |  ขอแสดงความนับถือ + ตราประทับ (ฝั่งบริษัท)
 *
 * ⚠️ ทำไมไม่ใช้ไฟล์เดียวกับ GenPDF.js (ใบแจ้งขอเข้างาน) ทั้งที่หัวกระดาษคล้ายกัน:
 * เอกสาร 2 ตัวนี้คนละชนิดกันโดยสิ้นเชิง — ใบแจ้งขอเข้างานออก "ก่อน" เข้างาน (แจ้งกำหนดการ ไม่มี
 * เลขที่เอกสารทางการ ไม่มีกรอบลงนามรับมอบ) ส่วนใบส่งมอบงานออก "หลัง" งานเสร็จ (มีเลขที่เอกสาร
 * เดินหน้าอย่างเดียวที่ห้ามซ้ำ มีรายการสิ่งที่ส่งมาด้วย มีกรอบให้ลูกค้าเซ็นรับ) ถ้ายัดรวมไฟล์เดียวกัน
 * จะกลายเป็นฟังก์ชันที่มี if แยกทางกันตั้งแต่บรรทัดแรกจนบรรทัดสุดท้าย แก้อันหนึ่งพังอีกอันตลอด
 *
 * ⚠️ พิกัดทั้งหมดเป็นมิลลิเมตร (jsPDF unit:"mm", A4 = 210 x 297)
 */
import moment from "moment";
import "moment/locale/th";
import { formatRoundLabel } from "../../utils/contractRounds";

// ── ข้อมูลบริษัทผู้ออกเอกสาร ────────────────────────────────────────────────
// ✅ รวมไว้ที่เดียว — เดิม GenPDF.js ฝังข้อความพวกนี้กระจายอยู่กลางฟังก์ชัน ย้ายที่อยู่/เบอร์ทีต้องไล่หา
export const ISSUER = {
  nameTh: "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด",
  nameEn: "DO ALL ARCHITECT AND ENGINEERING CO.,LTD.",
  address: "สำนักงานใหญ่ : 68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
  taxId: "เลขประจำตัวผู้เสียภาษี 0125563014222",
  logo: "/logo-light-2.png",
  stamp: "/stamp.png",
};

const PAGE = { w: 210, h: 297, left: 22, right: 22 };
const CONTENT_W = PAGE.w - PAGE.left - PAGE.right;
// ระยะจากขอบซ้ายถึงคอลัมน์ "ค่า" ของบล็อกหัวจดหมาย (เลขที่/วันที่/เรื่อง/โครงการ/เรียน/อ้างถึง)
const LABEL_VALUE_X = PAGE.left + 26;
// ✅ ระยะบรรทัด — TH Sarabun ที่ 14pt ตัวสูงกว่าฟอนต์ละตินขนาดเดียวกัน (มีสระบน/วรรณยุกต์อีก 2 ชั้น
// และสระล่างอีก 1 ชั้น) ระยะ 6mm เดิมทำให้วรรณยุกต์ของบรรทัดล่างเกือบชนสระล่างของบรรทัดบน อ่านแล้ว
// รู้สึกอึดอัดแน่นไปหมด — 6.6mm ให้ช่องไฟหายใจได้พอดีโดยไม่เปลืองหน้ากระดาษ
const LINE_H = 6.6;
const INDENT = 14; // ระยะเยื้องย่อหน้าแรกตามแบบหนังสือราชการ

/**
 * ✅ เว้นวรรคระหว่างภาษาไทยกับอังกฤษ/ตัวเลขให้อัตโนมัติ
 * 🐛 BUG ที่แก้: ข้อความในเอกสารถูกประกอบจากข้อมูลที่ผู้ใช้กรอกไว้ในระบบ ซึ่งชื่อระบบ/ชื่อโครงการ
 * มักเป็นภาษาอังกฤษ (Fire Alarm, Avenue) พอเอามาต่อท้ายคำไทยตรงๆ จะกลายเป็น "ระบบFire Alarm"
 * ติดกันเป็นพืด อ่านยากและดูไม่เป็นเอกสารทางการเลย (เห็นชัดในใบที่ออกมาจริง)
 * ⚠️ ต้องเว้นทั้ง 2 ทิศทาง (ไทย→ละติน และ ละติน→ไทย) เพราะเจอทั้ง "ระบบFire" และ "Alarmโครงการ"
 * ⚠️ นับ ( ) เป็นขอบเขตด้วย — "จำกัด(มหาชน)" ต้องได้ "จำกัด (มหาชน)"
 * ✅ ใช้กับ "ทุกข้อความ" ก่อนวาดลงกระดาษ ไม่ใช่แก้เฉพาะจุดที่ประกอบข้อความ — ข้อมูลที่ผู้ใช้พิมพ์เอง
 * ในกล่องออกเอกสารก็จะถูกจัดให้เรียบร้อยเหมือนกันหมด ไม่ต้องพึ่งว่าใครจะพิมพ์เว้นวรรคมาถูกไหม
 */
const THAI = "฀-๿";
export const spaceThaiLatin = (s) =>
  String(s ?? "")
    .replace(new RegExp(`([${THAI}])([A-Za-z0-9(])`, "g"), "$1 $2")
    .replace(new RegExp(`([A-Za-z0-9)])([${THAI}])`, "g"), "$1 $2")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/**
 * ── ชื่อเรียกเอกสารรายงานที่ส่งแนบไปกับใบส่งมอบ ─────────────────────────────
 * ✅ ใบส่งมอบงานถูกส่งไปพร้อม "รายงานหน้างาน" ทุกครั้ง — ชื่อที่เขียนในช่อง "สิ่งที่ส่งมาด้วย" จึงต้อง
 * บอกให้ชัดว่าคือเอกสารอะไร ไม่ใช่แค่ชื่อระบบลอยๆ อย่าง "เอกสาร ระบบ Fire Alarm" ซึ่งลูกค้าอ่านแล้ว
 * ไม่รู้ว่าได้รับอะไรมา
 * ✅ เลือกคำตามลักษณะงานจริงจาก "ประเภทงาน" ที่บันทึกไว้ในระบบ — งานบำรุงรักษาได้คำว่า "ตรวจสอบและ
 * บำรุงรักษา" งานติดตั้งได้ "การติดตั้ง" ฯลฯ ตรงกับสิ่งที่ทำจริงโดยไม่ต้องมาพิมพ์แก้เองทุกใบ
 * ⚠️ ค่าเริ่มต้นกลาง (fallback) ใช้ "รายงานการเข้าปฏิบัติงาน" เพราะเป็นคำที่ถูกต้องกับงานทุกประเภท
 * ไม่ว่าจะเป็นงานแบบไหน — ไม่มีทางเขียนผิดความหมายแม้ประเภทงานจะไม่ตรงกับกฎข้อไหนเลย
 */
const REPORT_NOUN_RULES = [
  { match: /บำรุงรักษา|preventive|\bpm\b/i, noun: "รายงานการตรวจสอบและบำรุงรักษา" },
  { match: /ติดตั้ง|install/i, noun: "รายงานการติดตั้ง" },
  { match: /เปลี่ยน|replace/i, noun: "รายงานการเปลี่ยนอุปกรณ์" },
  { match: /ซ่อม|แก้ไข|repair|corrective|\bcm\b/i, noun: "รายงานการซ่อมแก้ไข" },
  { match: /ตรวจสอบ|สำรวจ|inspect|survey/i, noun: "รายงานการตรวจสอบ" },
  { match: /ทดสอบ|test|commission/i, noun: "รายงานการทดสอบระบบ" },
];
export const DEFAULT_REPORT_NOUN = "รายงานการเข้าปฏิบัติงาน";

/** ✅ รายการให้เลือกในกล่องออกเอกสาร — เผื่อกรณีที่อยากใช้คำอื่นนอกจากที่ระบบเดาให้ */
export const REPORT_NOUN_PRESETS = [
  DEFAULT_REPORT_NOUN,
  ...REPORT_NOUN_RULES.map((r) => r.noun),
  "รายงานผลการปฏิบัติงาน",
  "เอกสารรายงานการบริการ (Service Report)",
];

export const reportNounFor = (title) => {
  const t = String(title || "");
  return REPORT_NOUN_RULES.find((r) => r.match.test(t))?.noun || DEFAULT_REPORT_NOUN;
};

/**
 * ── ตัวเลือกสำเร็จรูปของแต่ละช่อง ───────────────────────────────────────────
 * ✅ ทุกช่องเป็นแบบ "เลือกก็ได้ พิมพ์เองก็ได้" (freeSolo) — รายการพวกนี้ไม่ได้จำกัดสิ่งที่กรอกได้
 * แค่ทำให้กรณีที่เจอบ่อย 90% กดครั้งเดียวจบ ไม่ต้องพิมพ์ยาวๆ ใหม่ทุกใบและไม่ต้องกลัวพิมพ์ผิด
 */

/** "เรียน" — ตำแหน่งผู้รับฝั่งลูกค้าที่เจอจริงในงานอาคาร/โรงงาน */
export const ATTENTION_PRESETS = [
  "ผู้จัดการโครงการ",
  "ผู้จัดการอาคาร",
  "ผู้จัดการฝ่ายวิศวกรรม",
  "หัวหน้าแผนกวิศวกรรม",
  "ผู้จัดการนิติบุคคลอาคารชุด",
  "ผู้จัดการฝ่ายจัดซื้อ",
  "ฝ่ายบริหารอาคาร",
  "ผู้เกี่ยวข้อง",
];

/**
 * "ตำแหน่ง" ของผู้ลงนามฝั่งบริษัทเรา
 * ✅ ครอบคลุมทั้งสายบริหาร (ผู้จัดการ/กรรมการ) และสายหน้างาน (ช่าง/ผู้ควบคุมงาน/ผู้รับผิดชอบโครงการ)
 * เพราะคนที่เซ็นส่งมอบจริงไม่ได้เป็นผู้จัดการเสมอไป — งานเล็กหรืองานที่ส่งมอบหน้างานเลย มักเป็น
 * หัวหน้าช่างหรือผู้รับผิดชอบโครงการเป็นคนเซ็น
 */
export const SIGNER_POSITION_PRESETS = [
  "ผู้จัดการแผนกช่าง",
  "ผู้รับผิดชอบโครงการ",
  "หัวหน้าช่าง",
  "หัวหน้าทีมช่าง",
  "ช่างเทคนิค",
  "ช่างผู้ปฏิบัติงาน",
  "ผู้ควบคุมงาน",
  "ผู้จัดการฝ่ายบริการ",
  "ผู้จัดการโครงการ",
  "วิศวกรโครงการ",
  "วิศวกรผู้ควบคุมงาน",
  "หัวหน้าแผนกวิศวกรรม",
  "ผู้จัดการฝ่ายวิศวกรรม",
  "กรรมการผู้จัดการ",
];

/**
 * "เรื่อง" — ประกอบจากลักษณะงานจริงของใบนั้นๆ ไม่ใช่รายการตายตัว
 * ⚠️ ต้องรับ workLabel เข้ามา ไม่ใช่ export เป็น array คงที่ เพราะหัวเรื่องที่ดีต้องมีชื่องาน/ระบบอยู่ด้วย
 * ("ส่งมอบเอกสาร" เฉยๆ ลูกค้าอ่านแล้วไม่รู้ว่าเอกสารของงานไหน)
 */
// ⚠️ ตัวแรกของรายการ = ค่าเริ่มต้นที่เติมให้ในฟอร์ม (ดู buildDeliveryNoteDefaults) — "ส่งมอบงานและ
// เอกสาร" ครอบคลุมกว่า "ส่งมอบเอกสาร" เฉยๆ เพราะใบนี้ส่งมอบทั้งตัวงานที่ทำเสร็จและเอกสารประกอบ
// ไปพร้อมกัน ไม่ใช่ส่งแค่กระดาษ
// ⚠️ รับ roundLabel มาต่อท้ายด้วย ("ครั้งที่ 1/2") — งานสัญญาเข้าหลายครั้งต่อปี ถ้าหัวเรื่องไม่บอกว่า
// เป็นครั้งไหน เอกสารทุกใบของสัญญาเดียวกันจะมีหัวเรื่องเหมือนกันเป๊ะ แยกไม่ออกตอนเก็บเข้าแฟ้ม
export const subjectPresetsFor = (workLabel, roundLabel) => {
  const w = spaceThaiLatin(workLabel);
  const r = roundLabel ? ` ครั้งที่ ${roundLabel}` : "";
  if (!w) return [`ส่งมอบงานและเอกสารที่เกี่ยวข้อง${r}`, `ส่งมอบเอกสารงานบริการ${r}`];
  return [
    `ส่งมอบงานและเอกสาร ${w}${r}`,
    `ส่งมอบเอกสาร ${w}${r}`,
    `ส่งมอบรายงานผลการปฏิบัติงาน ${w}${r}`,
    `ขอส่งมอบเอกสารประกอบการตรวจรับงาน ${w}${r}`,
    `ส่งมอบเอกสารเพื่อประกอบการวางบิล ${w}${r}`,
  ].map(spaceThaiLatin);
};

/**
 * "อ้างถึง" — สร้างตัวเลือกจากเลขเอกสารที่ผูกกับงานนี้อยู่แล้วในระบบ
 * ✅ ตอบโจทย์ "เลือกได้ว่าจะอ้างอิงเอกสารอะไร ตามข้อมูลงานที่มีอยู่แล้ว" — ไม่ต้องเปิดหน้าอื่นไปคัดลอก
 * เลขมาวาง และไม่มีทางพิมพ์เลขผิด เพราะเลือกจากค่าที่บันทึกไว้จริง
 * ⚠️ เรียงตามลำดับที่ใช้อ้างอิงกันจริงในงานส่งมอบ: ใบเสนอราคา (ตัวที่ลูกค้าอนุมัติให้ทำงาน) มาก่อน
 * แล้วค่อยเลขที่สัญญา แล้วค่อยเลขเอกสารภายใน
 */
/**
 * ── อ่านข้อมูลงานให้ได้ครบไม่ว่าจะถูกเรียกมาจากหน้าไหน ─────────────────────────
 * 🐛 BUG ที่แก้ (ประเภทงานไม่ถูกดึงมาให้ เช่น PM / Service หายไปจากเอกสาร):
 * กล่องออกเอกสารถูกเปิดได้จาก 3 ที่ ซึ่งส่ง "ตัวงาน" มาคนละรูปแบบกัน
 *   • หน้าการดำเนินงาน / หน้าภาพรวมงาน → object ดิบจาก API ฟิลด์อยู่ระดับบนสุดทั้งหมด
 *   • หน้า Event (ปฏิทิน) → FullCalendar Event object ซึ่งย้ายฟิลด์ที่ไม่รู้จักเข้า .extendedProps
 *     ให้อัตโนมัติ "แต่ไม่ย้ายทุกตัว" — title / start / end / allDay ยังอยู่ระดับบนสุดเสมอ เพราะ
 *     FullCalendar รู้จักฟิลด์พวกนี้เองและทำเป็น getter บน prototype ไว้
 * เดิมโค้ดอ่านจาก `job.extendedProps || job` อย่างเดียว = พอเป็น event จากปฏิทินก็ได้แต่ extendedProps
 * ซึ่งไม่มี title/start/end เลย → "ประเภทงาน" หายทุกใบ และวันที่เสร็จงานก็ตกไปใช้วันนี้แทนวันจริง
 * ✅ อ่าน extendedProps ก่อน แล้ว fallback ไปอ่าน property ระดับบนสุด (ผ่าน job[k] ตรงๆ ซึ่งเรียก
 * getter ของ FullCalendar ได้ถูกต้อง — ใช้ spread `{...job}` ไม่ได้ เพราะ getter อยู่บน prototype
 * ไม่ใช่ own property จึงถูก spread ข้ามไปหมด)
 */
export const resolveJobFields = (job) => {
  const ext = job?.extendedProps || {};
  const get = (k) => {
    const v = ext[k];
    if (v !== undefined && v !== null && v !== "") return v;
    return job?.[k];
  };
  return {
    title: get("title"), system: get("system"), site: get("site"), company: get("company"),
    quotationNo: get("quotationNo"), contractNo: get("contractNo"), docNo: get("docNo"),
    time: get("time"), visitCount: get("visitCount"), responsiblePerson: get("responsiblePerson"),
    start: get("start"), end: get("end"), date: get("date"), allDay: get("allDay"),
  };
};

export const referencePresetsFor = (job) => {
  const p = resolveJobFields(job);
  return [
    p.quotationNo && `ใบเสนอราคาเลขที่ ${p.quotationNo}`,
    p.contractNo && `สัญญาเลขที่ ${p.contractNo}`,
    p.docNo && `เอกสารเลขที่ ${p.docNo}`,
    p.contractNo && p.time && `สัญญาเลขที่ ${p.contractNo} ครั้งที่ ${p.time}`,
  ].filter(Boolean).map(spaceThaiLatin);
};

/** วันที่แบบไทยเต็ม เช่น "7 สิงหาคม 2569" */
export const thaiFullDate = (d) => {
  const m = moment(d);
  if (!m.isValid()) return "-";
  return `${m.format("D MMMM")} ${m.year() + 543}`;
};

/**
 * ตัดบรรทัดย่อหน้า โดยให้บรรทัดแรกแคบลงเท่าระยะเยื้อง
 * ⚠️ ทำไมไม่ใช้ doc.splitTextToSize ตรงๆ: มันรับความกว้างได้ค่าเดียว ใช้กับย่อหน้าที่บรรทัดแรก
 * เยื้องเข้ามาไม่ได้ (ถ้าส่งความกว้างที่หักระยะเยื้องแล้ว บรรทัดที่ 2 เป็นต้นไปจะสั้นกุดตามไปด้วยทั้ง
 * ย่อหน้า ขอบขวาแหว่งเป็นฟันปลา) — จึงตัดเองทีละคำ โดยเทียบความกว้างจริงจาก doc.getTextWidth
 * ⚠️ ภาษาไทยไม่มีเว้นวรรคระหว่างคำ ก้อนคำไทยยาวๆ ก้อนเดียวจึงอาจกว้างเกินบรรทัดได้ — กรณีนั้น
 * fallback ไปใช้ splitTextToSize หั่นก้อนนั้นต่อ (ยอมให้ตัดกลางคำ ดีกว่าปล่อยให้ล้นออกนอกกระดาษ)
 */
const wrapParagraph = (doc, text, firstWidth, restWidth) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  const limitFor = () => (lines.length === 0 ? firstWidth : restWidth);

  const pushCur = () => { if (cur) { lines.push(cur); cur = ""; } };

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (doc.getTextWidth(test) <= limitFor()) { cur = test; continue; }
    pushCur();
    // ก้อนคำเดียวยังกว้างเกินบรรทัด → หั่นก้อนนั้นเอง
    if (doc.getTextWidth(w) > limitFor()) {
      const chunks = doc.splitTextToSize(w, limitFor());
      chunks.forEach((ch, i) => {
        if (i === chunks.length - 1) cur = ch;
        else lines.push(ch);
      });
    } else {
      cur = w;
    }
  }
  pushCur();
  return lines;
};

/**
 * ✅ ประกอบ "ค่าเริ่มต้น" ของเอกสารจากตัวงาน — ให้ผู้ใช้กดออกใบได้เลยโดยแทบไม่ต้องพิมพ์อะไร
 * (ตามที่ขอว่า "ออกได้ง่าย ตามลักษณะงาน") แต่ทุกช่องยังแก้ไขได้ก่อนออกจริงในกล่องยืนยัน
 *
 * @param {object} job  — event/แถวงาน (รองรับทั้ง object ดิบจาก API และ FullCalendar extendedProps)
 * @param {object} customer — ข้อมูลลูกค้าจากตาราง Customer (เอาที่อยู่มาใส่) อาจเป็น null ได้
 */
export const buildDeliveryNoteDefaults = (job, customer) => {
  // ⚠️ ต้องอ่านผ่าน resolveJobFields เสมอ — ดูเหตุผลที่นิยามของมัน (ประเภทงาน/วันที่ของ event จาก
  // ปฏิทินไม่ได้อยู่ใน extendedProps)
  const p = resolveJobFields(job);
  const site = p.site || "";
  const company = p.company || customer?.cCompany || "";
  const system = p.system || "";
  const title = p.title || "";

  // ✅ "เรื่อง" ประกอบจากลักษณะงานจริง — งานบำรุงรักษาระบบแจ้งเหตุเพลิงไหม้ ก็ได้เรื่องที่ตรงกับงานนั้น
  // ทันทีโดยไม่ต้องพิมพ์เอง (เทียบกับตัวอย่าง: "ส่งมอบเอกสารการบำรุงรักษาระบบสัญญาณแจ้งเหตุเพลิงไหม้")
  // ⚠️ ผ่าน spaceThaiLatin ทุกจุดที่ต่อคำไทยกับข้อมูลที่ผู้ใช้กรอก — ชื่อระบบ/ประเภทงานมักเป็นภาษา
  // อังกฤษ ("Fire Alarm") ถ้าต่อตรงๆ จะได้ "ระบบFire Alarm" ติดกันเป็นพืด (ดูคอมเมนต์ที่ spaceThaiLatin)
  // ✅ workLabel = "ประเภทงาน + ระบบ" เช่น "PM ระบบ Fire Alarm" — เป็นตัวตั้งของทั้งหัวเรื่องและ
  // เนื้อความ ทำให้เอกสารบอกได้ว่าเข้าไปทำ "งานอะไร กับระบบไหน" ไม่ใช่แค่ "ส่งมอบเอกสาร" ลอยๆ
  const workLabel = spaceThaiLatin([title, system && `ระบบ ${system}`].filter(Boolean).join(" "));
  // ✅ "ครั้งที่ 1/2" — งานสัญญาเข้าหลายครั้งต่อปี ลูกค้าต้องรู้ว่าใบนี้ส่งมอบของครั้งไหน ไม่งั้นพอเก็บ
  // เอกสารหลายใบไว้ด้วยกันจะแยกไม่ออกว่าใบไหนของรอบไหน (โดยเฉพาะเวลาตรวจรับ/วางบิลย้อนหลัง)
  // ⚠️ ใช้ formatRoundLabel ตัวเดียวกับที่ทั้งแอปใช้ (ใบแจ้งเข้างาน/ตารางภาพรวมงาน) กันรูปแบบเลข
  // ครั้งที่ไม่ตรงกันในเอกสารคนละใบของงานเดียวกัน — งานที่ไม่มีครั้งที่ (งานทั่วไป) จะได้ค่าว่าง
  const roundLabel = formatRoundLabel(p.time, p.visitCount);
  // ⚠️ เอาค่าแรกจาก subjectPresetsFor เสมอ ไม่ประกอบข้อความเองซ้ำอีกที่ — ไม่งั้นเปลี่ยนค่าเริ่มต้น
  // ทีต้องไล่แก้ 2 จุดแล้วลืมจุดใดจุดหนึ่ง
  const subject = subjectPresetsFor(workLabel, roundLabel)[0];
  // ชื่อเรียกเอกสารรายงานที่ส่งแนบไปด้วย — เลือกคำตามลักษณะงาน (ดู reportNounFor)
  const reportNoun = reportNounFor(title);

  // ✅ วันที่เสร็จงาน — ใช้วันสิ้นสุดของงาน (allDay ของ FullCalendar เก็บ end แบบ exclusive คือ
  // บวกไปแล้ว 1 วัน ต้องลบกลับก่อนเสมอ ไม่งั้นเอกสารจะขึ้นวันเสร็จเกินจริงไป 1 วันทุกใบ)
  // ⚠️ "allDay !== false" ไม่ใช่ "allDay === true" — ฟิลด์นี้ตั้ง default:true ไว้ที่ฐานข้อมูล
  // (models/Events.js) งานเก่าบางรายการจึงไม่มีค่านี้ติดมาเลย ถ้าเช็คแบบ === true จะตกไปทางงานมีเวลา
  // แล้วไม่ลบ 1 วัน = วันที่เสร็จงานในเอกสารเกินจริงไป 1 วันเงียบๆ โดยไม่มีอะไรฟ้อง
  const rawEnd = p.end || p.start || p.date;
  const completedAt = rawEnd
    ? (p.allDay !== false ? moment(rawEnd).subtract(1, "days") : moment(rawEnd))
    : moment();

  return {
    docNumber: "",                       // เติมจาก API ตอนเปิดกล่อง (ดู routes/docNumber.js)
    issuedAt: moment().format("YYYY-MM-DD"),
    subject,
    site,
    customerCompany: company,
    customerAddress: customer?.address || "",
    // ✅ เลขประจำตัวผู้เสียภาษีของลูกค้า — เอกสารที่ใช้ประกอบการวางบิล/ตรวจรับงานมักต้องมีเลขนี้กำกับ
    // ดึงจากทะเบียนลูกค้าที่มีอยู่แล้วในระบบ (Customer.tax) ไม่ต้องไปเปิดหาจากที่อื่นมาพิมพ์เอง
    customerTaxId: customer?.tax || "",
    attention: ATTENTION_PRESETS[0],
    // เลือกอ้างอิงตัวแรกที่มีจริง (ใบเสนอราคา → สัญญา → เอกสารภายใน) เปลี่ยนเป็นตัวอื่นได้ในกล่อง
    reference: referencePresetsFor(job)[0] || "",
    // ✅ "สิ่งที่ส่งมาด้วย" = ชื่อรายงานตามลักษณะงาน + ระบบที่เข้าทำ (ดู reportNounFor)
    // เช่น "รายงานการตรวจสอบและบำรุงรักษา ระบบ Fire Alarm จำนวน 1 ชุด"
    attachments: [
      {
        text: spaceThaiLatin([
          reportNoun,
          system && `ระบบ ${system}`,
          roundLabel && `ครั้งที่ ${roundLabel}`,
        ].filter(Boolean).join(" ")),
        qty: "1 ชุด",
      },
    ],
    reportNoun,
    completedAt: completedAt.format("YYYY-MM-DD"),
    workLabel,
    roundLabel,
    signerName: p.responsiblePerson || "",
    signerPosition: SIGNER_POSITION_PRESETS[0],
  };
};

/**
 * ✅ เนื้อความหลัก — ประกอบจากค่าที่กรอก ให้แก้ได้ทีหลังในกล่องยืนยันถ้าต้องการปรับถ้อยคำ
 * 🐛 BUG ที่แก้ (ประโยคอ่านไม่รู้เรื่อง): เดิมต่อชื่อโครงการต่อท้ายชื่องานเฉยๆ ได้ประโยคว่า
 * "การดำเนินการระบบFire Alarm Avenue" ซึ่งอ่านแล้วไม่รู้ว่า Avenue คืออะไร (เป็นชื่อโครงการ) —
 * ต้องมีคำว่า "โครงการ" นำหน้าเสมอ และเว้นวรรคคั่นภาษาให้ถูก
 */
export const buildDeliveryNoteBody = (f) => {
  const work = f.workLabel || "งานบริการ";
  const place = f.site ? ` โครงการ ${f.site}` : "";
  // ✅ ครั้งที่ต่อท้ายชื่อโครงการ ตามรูปแบบที่ผู้ใช้ระบุ: "PM ระบบ Fire Alarm โครงการ ... ครั้งที่ 1/2"
  // (งานทั่วไป/งานโปรเจคที่ไม่มีครั้งที่ จะได้ค่าว่างแล้วประโยคข้ามส่วนนี้ไปเองโดยไม่มีช่องว่างค้าง)
  const round = f.roundLabel ? ` ครั้งที่ ${f.roundLabel}` : "";
  const ref = f.reference ? ` อ้างอิง ${f.reference}` : "";
  // ⚠️ อ้างชื่อรายงานด้วย "ข้อความจริงในช่องสิ่งที่ส่งมาด้วย" เป็นอันดับแรก — เดิมเนื้อความฝังคำว่า
  // "เอกสารรายงานการบริการ" ตายตัว ทำให้ในใบเดียวกันเรียกเอกสารฉบับเดียวกันคนละชื่อ 2 ที่ ลูกค้าอ่าน
  // แล้วสับสนว่าตกลงได้รับกี่ฉบับกันแน่ — ผูกกับช่องเดียวกันไปเลย ต่อให้ผู้ใช้เปลี่ยนคำทีหลังก็ยังตรงกัน
  const reportNoun =
    (f.attachments || []).find((a) => (a.text || "").trim())?.text?.trim()
    || f.reportNoun
    || DEFAULT_REPORT_NOUN;
  return spaceThaiLatin(
    `เนื่องจากการดำเนินการ ${work}${place}${round}${ref} ได้ดำเนินการเสร็จสิ้นแล้วในวันที่ ${thaiFullDate(f.completedAt)} ` +
    `ตาม${reportNoun}ที่ส่งมาด้วยนี้ ${ISSUER.nameTh} จึงใคร่ขอส่งมอบเอกสาร ${work}${place}${round} ทั้งหมด ` +
    `ให้กับท่าน เพื่อพิจารณาและลงนามรับมอบด้วย จักขอบพระคุณยิ่ง`
  );
};

/**
 * สร้างไฟล์ PDF ใบส่งมอบงาน
 * @param {object} opts.jsPDF          — constructor (ส่งเข้ามาแทน import ตรง เทียบ pattern เดียวกับ GenPDF.js)
 * @param {string} opts.thSarabunFont  — ฟอนต์ TH Sarabun แบบ base64 (จำเป็น ไม่งั้นภาษาไทยกลายเป็นสี่เหลี่ยม)
 * @param {object} opts.form           — ค่าที่ผู้ใช้ยืนยันแล้วจากกล่องออกเอกสาร
 * @param {"open"|"download"} opts.mode — เปิดดูในแท็บใหม่ หรือดาวน์โหลดไฟล์เลย
 */
export const generateDeliveryNotePdf = async ({ jsPDF, thSarabunFont, form, mode = "open" }) => {
  moment.locale("th");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "A4" });
  doc.addFileToVFS("THSarabun.ttf", thSarabunFont);
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  doc.setFont("THSarabun");

  // ── หัวกระดาษ ────────────────────────────────────────────────────────────
  const centerX = PAGE.w / 2;
  let y = 12;
  try {
    const props = doc.getImageProperties(ISSUER.logo);
    const w = 30;
    const h = (props.height / props.width) * w;
    doc.addImage(ISSUER.logo, "PNG", centerX - w / 2, y, w, h);
    y += h + 4;
  } catch {
    // ⚠️ ไม่มีโลโก้ก็ยังต้องออกเอกสารได้ — เว้นที่ไว้เท่าเดิมเพื่อไม่ให้เลย์เอาต์ที่เหลือขยับ
    y += 22;
  }

  // ✅ ไล่ขนาดตัวอักษรลงตามลำดับความสำคัญ (17 → 11.5 → 10.5) และเว้นระยะแต่ละบรรทัดให้ต่างกันตาม
  // ขนาดจริงของแต่ละบรรทัด แทนการบวกทีละ 6 คงที่แบบเดิมซึ่งทำให้ชื่อบริษัทตัวใหญ่ดูอึดอัดติดบรรทัดล่าง
  doc.setFontSize(17);
  y += 6;
  doc.text(ISSUER.nameTh, centerX, y, { align: "center" });
  doc.setFontSize(11.5);
  y += 5.6;
  doc.text(ISSUER.nameEn, centerX, y, { align: "center" });
  doc.setFontSize(10.5);
  y += 5.2;
  doc.text(ISSUER.address, centerX, y, { align: "center" });
  y += 4.6;
  doc.text(ISSUER.taxId, centerX, y, { align: "center" });

  // ── บล็อกหัวจดหมาย (ป้าย : ค่า) ──────────────────────────────────────────
  y += 14;
  doc.setFontSize(14);
  const VALUE_W = PAGE.w - PAGE.right - LABEL_VALUE_X;

  // ✅ เขียนคู่ "ป้าย + ค่า" โดยตัดบรรทัดค่าที่ยาวเกินให้เองและเลื่อน y ต่อให้ถูก (ชื่อโครงการ/ที่อยู่
  // ลูกค้าของจริงยาวไม่เท่ากันเลย จะกะระยะตายตัวไม่ได้)
  const row = (label, value) => {
    const text = spaceThaiLatin(value);
    if (!text) return;
    const lines = doc.splitTextToSize(text, VALUE_W);
    if (label) doc.text(label, PAGE.left, y);
    lines.forEach((ln, i) => doc.text(ln, LABEL_VALUE_X, y + i * LINE_H));
    y += lines.length * LINE_H;
  };
  // 🐛 BUG ที่แก้ (ระยะเว้นหายไปเมื่อช่องว่าง): เดิมระยะเว้นถูกผูกไว้กับ row() เป็น option — แต่ row()
  // จะ return ทันทีถ้าค่าว่าง ระยะเว้นจึงหายไปด้วย ผลคือใบที่ไม่ได้กรอก "อ้างถึง" (ซึ่งเป็นกรณีปกติ)
  // หัวข้อ "สิ่งที่ส่งมาด้วย" จะขึ้นไปติดบรรทัด "เรียน" พอดีเป๊ะ ดูเหมือนจัดหน้าพลาด (เห็นในใบจริง)
  // ✅ แยกออกมาเป็นคำสั่งเว้นระยะของตัวเอง ไม่ผูกกับว่าแถวไหนมีค่าหรือไม่มี
  const gap = (mm) => { y += mm; };

  row("เลขที่", form.docNumber);
  row("วันที่", thaiFullDate(form.issuedAt));
  row("เรื่อง", form.subject);
  // "โครงการ" มี 3 บรรทัดย่อย: ชื่อโครงการ / บริษัทลูกค้า / ที่อยู่ — ป้ายอยู่แค่บรรทัดแรก
  row("โครงการ", form.site);
  row("", form.customerCompany);
  row("", form.customerAddress);
  // ✅ เลขประจำตัวผู้เสียภาษีต่อท้ายที่อยู่ — ตำแหน่งมาตรฐานของเอกสารธุรกิจไทย (อยู่ใต้ที่อยู่ผู้รับเสมอ)
  row("", form.customerTaxId ? `เลขประจำตัวผู้เสียภาษี ${form.customerTaxId}` : "");
  gap(LINE_H);
  row("เรียน", form.attention);
  row("อ้างถึง", form.reference);

  // ── สิ่งที่ส่งมาด้วย ──────────────────────────────────────────────────────
  const attachments = (form.attachments || []).filter((a) => (a.text || "").trim());
  if (attachments.length > 0) {
    gap(LINE_H);
    doc.text("สิ่งที่ส่งมาด้วย", PAGE.left, y);
    y += LINE_H;
    attachments.forEach((a, i) => {
      // ✅ เลขลำดับอยู่คอลัมน์ของตัวเอง แล้วข้อความเยื้องเข้าไปอีกชั้น — บรรทัดที่ 2 ของรายการยาวๆ
      // จะเรียงตรงกับบรรทัดแรก ไม่ไหลกลับไปชนใต้ตัวเลข (แบบเดิมเยื้องทั้งก้อนเท่ากันหมด)
      const num = `${i + 1}.`;
      const text = spaceThaiLatin(`${a.text}${a.qty ? ` จำนวน ${a.qty}` : ""}`);
      const numX = PAGE.left + 10;
      const textX = numX + 7;
      const lines = doc.splitTextToSize(text, PAGE.w - PAGE.right - textX);
      doc.text(num, numX, y);
      lines.forEach((ln, li) => doc.text(ln, textX, y + li * LINE_H));
      y += lines.length * LINE_H;
    });
  }

  // ── เนื้อความ ────────────────────────────────────────────────────────────
  // ✅ ย่อหน้าแรกเยื้องเข้ามาตามแบบหนังสือราชการ — jsPDF ไม่มี text-indent จึงตัดบรรทัดเองด้วย
  // wrapParagraph (บรรทัดแรกแคบลงเท่าระยะเยื้อง บรรทัดที่เหลือเต็มความกว้าง)
  // 🐛 BUG ที่แก้: เดิมตัดบรรทัดแรกแล้วใช้ .slice(first.length) หาเนื้อความที่เหลือ — ซึ่งเชื่อว่า
  // ข้อความที่ jsPDF ตัดออกมาจะตรงกับต้นฉบับทีละตัวอักษรเป๊ะๆ (ไม่จริง มันตัด/รวบช่องว่างใหม่)
  // ผลคือเนื้อความอาจขาดหรือซ้ำคำตรงรอยต่อบรรทัดแรกได้
  gap(LINE_H * 1.5);
  const body = spaceThaiLatin(form.body);
  if (body) {
    const lines = wrapParagraph(doc, body, CONTENT_W - INDENT, CONTENT_W);
    lines.forEach((ln, i) => {
      doc.text(ln, PAGE.left + (i === 0 ? INDENT : 0), y);
      y += LINE_H;
    });
  }

  gap(LINE_H * 1.5);
  doc.text("จึงเรียนมาเพื่อทราบและโปรดพิจารณา", PAGE.left + INDENT, y);

  // ── ส่วนลงนาม ────────────────────────────────────────────────────────────
  // ✅ ตรึงไว้ล่างกระดาษเสมอ ไม่ลอยตามความยาวเนื้อความ — เอกสารทางการต้องมีที่เซ็นอยู่ตำแหน่งเดียวกัน
  // ทุกใบ เพื่อให้ปั๊ม/เซ็น/สแกนเก็บเข้าแฟ้มได้เป็นระเบียบเหมือนกันหมด
  // ⚠️ กันเนื้อความยาวเกินจนไปทับส่วนลงนาม — ถ้าชนขึ้นหน้าใหม่ให้เลย (ดีกว่าตัวหนังสือทับกันจนอ่านไม่ได้)
  // 🐛 BUG ที่แก้ (ตราประทับทับชื่อผู้ลงนาม): เดิมวางตราไว้กึ่งกลางฝั่งขวาที่ระยะ +10 ซึ่งความสูงจริง
  // ของรูปตรา (คำนวณตามสัดส่วนภาพ) ยาวลงมาถึงราว +30 พอดีกับบรรทัด "( ชื่อ )" ที่ +26.5 — ตราเลย
  // ทับชื่อจนอ่านไม่ออกทั้งคู่ และไม่เหลือที่ว่างให้เซ็นชื่อจริงเลยสักนิด
  // ✅ จัดใหม่เป็น 3 ชั้นชัดเจน: คำลงท้าย → ช่องว่างสำหรับเซ็น (มีเส้นประให้เซ็นทับ) → ชื่อ/ตำแหน่ง/บริษัท
  // แล้วย้ายตราไปไว้ "มุมซ้ายบนของช่องเซ็น" ซึ่งเป็นพื้นที่ว่างที่ไม่มีตัวหนังสือใดๆ อยู่ — ตรงกับ
  // ธรรมเนียมเอกสารไทยที่ประทับตราไว้ข้างลายเซ็น ไม่ใช่ทับลายเซ็น
  const boxH = 54;
  const boxW = 80;
  const boxY = PAGE.h - 26 - boxH;
  if (y > boxY - LINE_H) doc.addPage();

  // ฝั่งซ้าย: กรอบให้ลูกค้าลงนามตรวจสอบและรับเอกสาร
  doc.setLineWidth(0.5);
  doc.rect(PAGE.left, boxY, boxW, boxH);
  const leftCenter = PAGE.left + boxW / 2;
  doc.setFontSize(13.5);
  doc.text("ลงนามตรวจสอบและรับเอกสาร", leftCenter, boxY + 8, { align: "center" });
  doc.setFontSize(13);
  // เว้นช่องว่าง +11 ถึง +24 ไว้ให้เซ็นชื่อ แล้วค่อยมีเส้นประรองรับ
  doc.text("............................................", leftCenter, boxY + 26, { align: "center" });
  doc.text("(____________________________)", leftCenter, boxY + 33, { align: "center" });
  doc.text("วันที่ _______ / _______ / _______", leftCenter, boxY + 40, { align: "center" });
  // ✅ ชื่อบริษัทลูกค้าใต้กรอบ — ตัดบรรทัดเองเพราะชื่อนิติบุคคลไทยยาวเกินกรอบได้ง่ายมาก
  doc.setFontSize(11.5);
  const custLines = doc.splitTextToSize(spaceThaiLatin(form.customerCompany), boxW - 4);
  custLines.slice(0, 2).forEach((ln, i) => {
    doc.text(ln, leftCenter, boxY + 46 + i * 4.6, { align: "center" });
  });

  // ฝั่งขวา: ขอแสดงความนับถือ → ช่องเซ็น (+ตราประทับมุมซ้าย) → ชื่อ/ตำแหน่ง/บริษัท
  // ✅ จัดให้ "กึ่งกลางฝั่งขวา" อยู่ระดับสายตาเดียวกับกรอบฝั่งซ้าย — 2 ฝั่งจึงดูสมดุลเป็นคู่กัน
  const rightCenter = PAGE.w - PAGE.right - boxW / 2;
  doc.setFontSize(13.5);
  doc.text("ขอแสดงความนับถือ", rightCenter, boxY + 8, { align: "center" });

  // ✅ ตราประทับ — มุมซ้ายของช่องเซ็น จบก่อนถึงเส้นประที่ +26 จึงไม่มีทางทับทั้งลายเซ็นและชื่อ
  try {
    const sp = doc.getImageProperties(ISSUER.stamp);
    const sw = 24;
    const sh = (sp.height / sp.width) * sw;
    // ⚠️ ยึด "ขอบล่าง" ของตราไว้ที่ +24.5 แล้วคำนวณขอบบนย้อนขึ้นไป — ความสูงของตราขึ้นกับสัดส่วน
    // ของไฟล์รูปซึ่งเปลี่ยนได้ถ้าวันหนึ่งมีการเปลี่ยนไฟล์ตรา ถ้ายึดขอบบนแบบเดิมแล้วรูปสูงขึ้น
    // ตราจะไหลลงไปทับเส้นเซ็นอีก (ซึ่งคือบั๊กเดิมเป๊ะๆ)
    doc.addImage(ISSUER.stamp, "PNG", rightCenter - boxW / 2 + 2, boxY + 24.5 - sh, sw, sh);
  } catch {
    // ไม่มีไฟล์ตราประทับก็ออกเอกสารได้ตามปกติ (เว้นที่ว่างไว้ให้ประทับตรามือแทน)
  }

  doc.setFontSize(13);
  doc.text("............................................", rightCenter, boxY + 26, { align: "center" });
  doc.text(`( ${spaceThaiLatin(form.signerName) || "____________________________"} )`, rightCenter, boxY + 33, { align: "center" });
  doc.text(spaceThaiLatin(form.signerPosition), rightCenter, boxY + 40, { align: "center" });
  doc.setFontSize(11.5);
  const issuerLines = doc.splitTextToSize(ISSUER.nameTh, boxW + 12);
  issuerLines.slice(0, 2).forEach((ln, i) => {
    doc.text(ln, rightCenter, boxY + 46 + i * 4.6, { align: "center" });
  });

  // ── ส่งออก ───────────────────────────────────────────────────────────────
  // ⚠️ ชื่อไฟล์ต้องกรองอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออกก่อน (เลขที่เอกสารมี "/" อยู่เสมอ —
  // ถ้าไม่แทนที่ เบราว์เซอร์บางตัวจะตีความเป็นโฟลเดอร์แล้วดาวน์โหลดล้มเหลวเงียบๆ)
  const safeName = `ใบส่งมอบงาน ${form.docNumber || ""} ${form.site || ""}`
    .replace(/[/\\:*?"<>|]/g, "-")
    .trim();

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  if (mode === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}.pdf`;
    link.click();
  } else {
    window.open(url, "_blank");
  }
  // ✅ คืนหน่วยความจำหลังเบราว์เซอร์อ่านไฟล์เสร็จ — เดิม GenPDF.js ไม่เคย revoke เลย เปิดหลายใบ
  // ติดกันแล้ว blob ค้างในหน่วยความจำจนกว่าจะปิดแท็บ
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return safeName;
};
