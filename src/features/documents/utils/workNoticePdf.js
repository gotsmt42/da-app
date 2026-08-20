/**
 * workNoticePdf.js — "ใบแจ้งเข้าปฏิบัติงาน" (หนังสือแจ้งกำหนดการเข้าทำงานให้ลูกค้าทราบล่วงหน้า)
 *
 * ⚠️ ต่างจาก "ใบส่งมอบงาน" (deliveryNotePdf.js) ตรงจังหวะเวลาและจุดประสงค์:
 *   ใบแจ้งเข้างาน = ออก "ก่อน" เข้าทำงาน — บอกว่าจะเข้าวันไหน เวลาไหน ใครเข้า เพื่อให้ลูกค้าเตรียม
 *                    พื้นที่/แจ้งผู้เกี่ยวข้อง มีช่องให้ลูกค้าลงนามรับทราบ
 *   ใบส่งมอบงาน   = ออก "หลัง" งานเสร็จ — ส่งมอบเอกสาร/ผลงาน มีรายการสิ่งที่ส่งมาด้วย ให้ลูกค้าเซ็นรับมอบ
 * เนื้อความ/บล็อกกำหนดการ/ส่วนลงนามจึงคนละชุดกัน แต่ "หัวกระดาษ ขอบกระดาษ ระยะบรรทัด และวิธีส่งไฟล์ออก"
 * ใช้ของกลางร่วมกันจาก deliveryNotePdf.js ทั้งหมด — เอกสารของบริษัทจะได้หน้าตาเป็นชุดเดียวกันเสมอ
 * และย้ายที่อยู่/เปลี่ยนโลโก้ทีเดียวมีผลครบทุกใบ
 *
 * 🐛 ปัญหาของไฟล์เดิม (EventCalendar/Functions/GenPDF.js) ที่เขียนใหม่ทั้งหมดตรงนี้:
 *   1. เลขที่เอกสารที่ผู้ใช้กรอกถูก "เขียนทับ" ด้วยเลขขยะที่สร้างสดในฟังก์ชัน (DOC-<วันเวลา>-001 โดย
 *      counter เป็นตัวแปรในฟังก์ชันที่รีเซ็ตเป็น 1 ทุกครั้งที่เรียก) — เลขที่เอกสารจริงจึงไม่เคยถูกใช้เลย
 *      และเลขที่พิมพ์ออกมาก็ตามกลับไม่ได้ ซ้ำได้ ไม่มีความหมายอะไรทั้งสิ้น
 *   2. เปิดแท็บใหม่ "และ" สั่งดาวน์โหลดพร้อมกันทุกครั้ง (เลือกไม่ได้) แถมไม่เคย revokeObjectURL
 *   3. หัวกระดาษถูกวาดซ้ำ 2 รอบตอนขึ้นหน้าใหม่ (drawHeader ก่อน addPage แล้ววาดอีกทีหลัง addPage)
 *   4. ข้อความทั้งหมดฝังตายในโค้ด แก้ถ้อยคำก่อนออกไม่ได้เลย ("เรียน ผู้จัดการโครงการ X" เสมอ)
 */
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import {
  // ✅ letterIndentFor = แนวเยื้องเส้นเดียวที่ใช้ร่วมกับใบส่งมอบงาน (แทน LABEL_VALUE_X/INDENT แบบตายตัว
  // ของเดิม ซึ่งทำให้บรรทัดเริ่มไม่ตรงกันหลายแนวในใบเดียว — ดูคอมเมนต์ที่ letterIndentFor)
  ISSUER, PAGE, CONTENT_W, letterIndentFor,
  spaceThaiLatin, thaiFullDate, resolveJobFields, referencePresetsFor,
  ATTENTION_PRESETS, SIGNER_POSITION_PRESETS,
  wrapParagraph, createDocument, drawLetterhead, outputDocument,
} from "./deliveryNotePdf";

export { ATTENTION_PRESETS, SIGNER_POSITION_PRESETS, thaiFullDate, ISSUER };

/**
 * ✅ คำขึ้นต้น "สิ่งที่จะทำในวันนั้น" ตามลักษณะงาน — เติมให้เป็นค่าตั้งต้นของทุกวัน แล้วผู้ใช้แก้เองได้
 * ⚠️ เอกสารจริงของบริษัทเขียนรายละเอียดไม่เหมือนกันในแต่ละวัน (วันแรกตรวจตู้ควบคุม วันถัดไปไล่ทดสอบ
 * ตามพื้นที่) ค่าที่เติมให้จึงเป็นแค่จุดตั้งต้นให้พิมพ์ต่อ ไม่ใช่ข้อความสำเร็จรูปที่ใช้ได้ทุกใบ
 */
const WORK_VERB_RULES = [
  { match: /บำรุงรักษา|preventive|\bpm\b/i, verb: "เข้าทำการตรวจเช็คและบำรุงรักษา" },
  { match: /ติดตั้ง|install/i, verb: "เข้าดำเนินการติดตั้ง" },
  { match: /เปลี่ยน|replace/i, verb: "เข้าดำเนินการเปลี่ยนอุปกรณ์" },
  { match: /ซ่อม|แก้ไข|repair|corrective|\bcm\b/i, verb: "เข้าดำเนินการซ่อมแก้ไข" },
  { match: /ทดสอบ|test|commission/i, verb: "เข้าทำการทดสอบ" },
];
const DEFAULT_WORK_VERB = "เข้าทำการตรวจเช็คและทดสอบ";
export const workVerbFor = (title) =>
  WORK_VERB_RULES.find((r) => r.match.test(String(title || "")))?.verb || DEFAULT_WORK_VERB;

/**
 * ✅ ข้อความท้ายบล็อกกำหนดการที่บริษัทใช้บ่อย (ขอสนับสนุนอุปกรณ์/เจ้าหน้าที่ประสานงาน)
 * — เติมให้เป็นค่าตั้งต้น ลบทิ้งหรือแก้ถ้อยคำได้ทั้งหมด
 */
export const SUPPORT_REQUEST_PRESETS = [
  "บริษัท ฯ ขอสนับสนุนอุปกรณ์ขึ้นที่สูง เช่น บันได นั่งร้าน ลิฟท์ และเจ้าหน้าที่ประสานงาน 1 ท่าน",
  "บริษัท ฯ ขอสนับสนุนเจ้าหน้าที่ประสานงานเพื่อนำเข้าพื้นที่ 1 ท่าน",
  "บริษัท ฯ ขอความอนุเคราะห์เปิดพื้นที่และระบบไฟฟ้าสำหรับการทดสอบ",
];

/** ✅ ช่วงเวลาที่พิมพ์บ่อย — ให้เลือกได้ทั้งแบบทั้งวันและครึ่งวัน */
export const TIME_PRESETS = [
  "09.30 - 17.30 น.",
  "08.30 - 17.30 น.",
  "09.00 - 18.00 น.",
  "08.00 - 17.00 น.",
  "13.00 - 17.00 น.",
];

/**
 * ✅ ตัวเลือก "เรื่อง" ประกอบจากชื่องานของใบนี้เอง — หัวเรื่องที่ดีต้องมีชื่องานอยู่ด้วย ไม่งั้นลูกค้า
 * อ่านแล้วไม่รู้ว่าเอกสารของงานไหน (เทียบ pattern เดียวกับ subjectPresetsFor ของใบส่งมอบงาน)
 */
export const noticeSubjectPresetsFor = (workLabel, roundLabel) => {
  const work = workLabel || "งานบริการ";
  const round = roundLabel ? ` ครั้งที่ ${roundLabel}` : "";
  return [
    `ขอแจ้งกำหนดการเข้าปฏิบัติงาน ${work}${round}`,
    `ขออนุญาตเข้าปฏิบัติงาน ${work}${round}`,
    `แจ้งกำหนดการเข้าดำเนินการ ${work}${round}`,
    `ขอความอนุเคราะห์เข้าปฏิบัติงาน ${work}${round}`,
  ].map(spaceThaiLatin);
};

/** จำนวนวันสูงสุดที่จะสร้างบรรทัดให้อัตโนมัติ — งานที่ยาวกว่านี้ให้ผู้ใช้จัดรูปแบบเองจะเหมาะกว่า */
export const MAX_AUTO_DAY_ROWS = 31;

/**
 * ✅ สร้างบรรทัด "วันละ 1 รายการ" ตามช่วงวันที่ของงาน
 * ⚠️ ต้องกันช่วงวันที่ยาวผิดปกติ (ข้อมูลเก่าบางรายการวันสิ้นสุดเพี้ยนไปเป็นปีหน้า) ไม่งั้นจะสร้างบรรทัด
 * เป็นร้อยจนกล่องค้างและเอกสารยาวหลายสิบหน้า
 */
export const buildDayRows = ({ startAt, endAt, title, system, defaultTime }) => {
  const verb = workVerbFor(title);
  const detail = spaceThaiLatin([verb, system && `ระบบ ${system}`].filter(Boolean).join(" "));
  const rows = [];
  const cur = moment(startAt).startOf("day");
  const last = moment(endAt).startOf("day");
  while (cur.isSameOrBefore(last) && rows.length < MAX_AUTO_DAY_ROWS) {
    rows.push({ date: cur.format("YYYY-MM-DD"), time: defaultTime, detail });
    cur.add(1, "day");
  }
  return rows.length > 0
    ? rows
    : [{ date: moment(startAt).format("YYYY-MM-DD"), time: defaultTime, detail }];
};

/** ข้อความ 1 บรรทัดของกำหนดการรายวัน — ใช้ทั้งตอนวาด PDF และตอนโชว์ตัวอย่างในกล่อง */
export const dayRowText = (r) => spaceThaiLatin(
  [
    r?.date ? `วันที่ ${thaiFullDate(r.date)}` : "",
    r?.time ? `เวลา ${r.time}` : "",
    r?.detail || "",
  ].filter(Boolean).join("  ")
);

/**
 * ✅ ประกอบค่าเริ่มต้นทั้งใบจากตัวงานจริง — เปิดกล่องมาแล้วกด "ออกเอกสาร" ได้เลยโดยไม่ต้องพิมพ์อะไร
 * @param {object} job       — event จากปฏิทิน (FullCalendar) หรือ object งานดิบจาก API
 * @param {object} customer  — ข้อมูลลูกค้าจากทะเบียน (เอาที่อยู่/เลขภาษีมาใส่) อาจเป็น null ได้
 * @param {object} issuer    — ผู้ออกเอกสาร (userData ที่ล็อกอินอยู่) ใช้เติมชื่อ/เบอร์ผู้ประสานงาน
 */
export const buildWorkNoticeDefaults = (job, customer, issuer) => {
  const p = resolveJobFields(job);
  const site = p.site || "";
  const company = p.company || customer?.cCompany || "";
  const system = p.system || "";
  const title = p.title || "";

  // "ประเภทงาน + ระบบ" เช่น "PM ระบบ Fire Alarm" — ตัวตั้งของทั้งหัวเรื่องและเนื้อความ
  const workLabel = spaceThaiLatin([title, system && `ระบบ ${system}`].filter(Boolean).join(" "));
  const roundLabel = formatRoundLabel(p.time, p.visitCount);

  // ⚠️ วันสิ้นสุดของงานแบบทั้งวัน (allDay) ถูกเก็บแบบ exclusive คือบวกมาแล้ว 1 วัน ต้องลบกลับก่อนเสมอ
  // ไม่งั้นเอกสารจะแจ้งวันสิ้นสุดเกินจริงไป 1 วันทุกใบ — และต้องเช็ค "allDay !== false" ไม่ใช่ "=== true"
  // เพราะฟิลด์นี้ default:true ที่ฐานข้อมูล งานเก่าจำนวนมากจึงไม่มีค่านี้ติดมาเลย (ดู models/Events.js)
  const startRaw = p.start || p.date;
  const endRaw = p.end || p.start || p.date;
  const startAt = startRaw ? moment(startRaw) : moment();
  const endAt = endRaw
    ? (p.allDay !== false ? moment(endRaw).subtract(1, "days") : moment(endRaw))
    : startAt.clone();

  // ⚠️ ไม่ดึงรายชื่อทีมมาใส่เอกสารให้อัตโนมัติ (ตามที่ผู้ใช้ระบุ) — ชื่อในระบบเป็นชื่อผู้ใช้งาน
  // ไม่ใช่ชื่อ-นามสกุลจริงที่เหมาะจะพิมพ์ในหนังสือถึงลูกค้า ถ้าโครงการไหนต้องใช้รายชื่อทำบัตรผ่าน
  // ให้พิมพ์เองในช่อง "ข้อความปิดท้าย" ของกล่องออกเอกสาร

  const subject = noticeSubjectPresetsFor(workLabel, roundLabel)[0];
  // งานทั้งวัน (allDay) ไม่มีเวลาเก็บในระบบเลย → ใช้ช่วงเวลาที่พิมพ์บ่อยเป็นค่าตั้งต้น (แก้ได้รายวัน)
  const defaultTime = p.allDay === false && startRaw
    ? `${moment(startRaw).format("HH.mm")} - ${moment(endRaw).format("HH.mm")} น.`
    : TIME_PRESETS[0];

  // ✅ "ไกด์" วันที่ที่งานนี้ลงตารางไว้ในระบบ — ไม่ใช่ค่าที่จะถูกพิมพ์ลงเอกสารโดยตรง แต่เอาไว้โชว์ในกล่อง
  // ให้ผู้ใช้เห็นว่าระบบมีนัดไว้ช่วงไหน แล้วค่อยกรอกวันที่ที่นัดกับลูกค้าจริงเอง (ดู SCHEDULE_LABEL_PRESETS)
  const sameDay = startAt.isSame(endAt, "day");
  const jobDateText = sameDay
    ? thaiFullDate(startAt)
    : `${thaiFullDate(startAt)} ถึงวันที่ ${thaiFullDate(endAt)}`;

  return {
    docNumber: p.docNo || "",            // แอดมิน/ผู้จัดการจะได้เลขเดินหน้าจาก server ทับให้ตอนเปิดกล่อง
    issuedAt: moment().format("YYYY-MM-DD"),
    subject,
    site,
    customerCompany: company,
    customerAddress: customer?.address || "",
    customerTaxId: customer?.tax || "",
    attention: ATTENTION_PRESETS[0],
    reference: referencePresetsFor(job)[0] || "",
    workLabel,
    roundLabel,
    // ⚠️ ไกด์อย่างเดียว ไม่ถูกพิมพ์ลงเอกสาร — ใช้โชว์ในกล่องและปุ่ม "สร้างรายการตามวันที่ในตาราง"
    jobDateText,
    jobStartDate: startAt.format("YYYY-MM-DD"),
    jobEndDate: endAt.format("YYYY-MM-DD"),
    // ✅ กำหนดการเป็น "รายการทีละวัน" ตามรูปแบบเอกสารจริงของบริษัท:
    //      วันที่ 5 กุมภาพันธ์ 2569  เวลา 09.30 - 17.30 น.  เข้าทำการตรวจเช็คตู้ควบคุม ...
    //      วันที่ 6 กุมภาพันธ์ 2569  เวลา 09.30 - 17.30 น.  เข้าทำการตรวจเช็คและทดสอบ ...
    // ⚠️ ต้องแยกเป็นรายวันจริงๆ ไม่ใช่เขียนช่วง "5–7 ก.พ." รวดเดียว เพราะแต่ละวันเข้าทำคนละอย่าง/คนละ
    // พื้นที่ และบางงานเว้นวันด้วย — เขียนรวมเป็นช่วงจะสื่อผิดว่าเข้าต่อเนื่องทุกวันและทำเหมือนกันทุกวัน
    // ✅ ระบบเติมให้ครบทุกวันตามที่งานลงตารางไว้ (วันละ 1 บรรทัด) พร้อมเวลา/รายละเอียดตั้งต้น —
    // ผู้ใช้แก้ข้อความรายวัน เพิ่ม/ลบวัน ได้อิสระ ตามที่นัดกับลูกค้าจริง
    dayRows: buildDayRows({ startAt, endAt, title, system, defaultTime }),
    // ✅ บรรทัดปิดท้ายกำหนดการ (ขอสนับสนุนอุปกรณ์/เจ้าหน้าที่) — ขึ้นบรรทัดใหม่ได้หลายบรรทัด
    // ⚠️ ไม่ใส่รายชื่อผู้เข้าปฏิบัติงานให้อัตโนมัติแล้ว (ตามที่ผู้ใช้ระบุ) — ชื่อทีมในระบบเป็นชื่อผู้ใช้งาน
    // ไม่ใช่ชื่อ-นามสกุลจริงที่เหมาะจะพิมพ์ในเอกสารถึงลูกค้า และหลายงานก็ยังไม่ได้ระบุทีมตอนออกใบแจ้ง
    // (ยังพิมพ์เองได้ถ้าโครงการไหนต้องใช้รายชื่อทำบัตรผ่าน — ดูช่อง "ข้อความปิดท้าย" ในกล่องออกเอกสาร)
    supportNote: SUPPORT_REQUEST_PRESETS[0],
    body: "",            // เติมด้วย buildWorkNoticeBody หลังสร้าง object นี้เสร็จ
    cooperationNote: "", // เติมด้วย buildWorkNoticeCooperation
    // ✅ ผู้ออกเอกสาร = คนที่ลูกค้าจะติดต่อกลับเมื่อไม่สะดวกตามกำหนดการ — เอกสารแจ้งเข้างานที่ไม่มีเบอร์
    // ให้ติดต่อกลับ ใช้ประโยชน์จริงไม่ได้เลย (ต่างจากใบส่งมอบงานที่แค่ต้องมีคนเซ็นกำกับ)
    signerName: [issuer?.fname, issuer?.lname].filter(Boolean).join(" ") || p.responsiblePerson || "",
    signerPosition: SIGNER_POSITION_PRESETS[1] || SIGNER_POSITION_PRESETS[0],
    signerTel: issuer?.tel || "",
  };
};

/** ย่อหน้าที่ 1 — ที่มาและกำหนดการโดยสรุป */
export const buildWorkNoticeBody = (f) => {
  const work = f.workLabel || "งานบริการ";
  const place = f.site ? ` โครงการ ${f.site}` : "";
  const round = f.roundLabel ? ` ครั้งที่ ${f.roundLabel}` : "";
  const ref = f.reference ? ` ตาม${f.reference}` : "";
  const customer = f.customerCompany ? ` จาก ${f.customerCompany}` : "";
  return spaceThaiLatin(
    `ตามที่ ${ISSUER.nameTh} ได้รับความไว้วางใจ${customer} ให้เข้าดำเนินการ ${work}${place}${ref} นั้น ` +
    `บริษัทฯ ขอแจ้งให้ท่านทราบถึงกำหนดการเข้าปฏิบัติงาน ${work}${round} โดยมีรายละเอียดดังนี้`
  );
};

/** ย่อหน้าที่ 2 — ขอความร่วมมือ/ยืนยันมาตรการ */
export const buildWorkNoticeCooperation = () => spaceThaiLatin(
  `ทั้งนี้ บริษัทฯ ใคร่ขอความร่วมมือจากท่านในการแจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ` +
  `โดยบริษัทฯ จะเข้าดำเนินการด้วยความระมัดระวัง ไม่ให้ส่งผลกระทบต่อผู้ใช้งานพื้นที่ พร้อมมีมาตรการ ` +
  `ความปลอดภัยตามมาตรฐานตลอดระยะเวลาปฏิบัติงาน หากท่านไม่สะดวกตามวันและเวลาดังกล่าว ` +
  `กรุณาแจ้งกลับมายังบริษัทฯ เพื่อนัดหมายใหม่`
);

/**
 * สร้างไฟล์ PDF ใบแจ้งเข้าปฏิบัติงาน
 * @param {"open"|"download"} mode — เปิดดูในแท็บใหม่ หรือดาวน์โหลดไฟล์เลย (เดิมทำทั้งคู่พร้อมกันเสมอ)
 */
export const generateWorkNoticePdf = async ({ jsPDF, thSarabunFont, form, mode = "open" }) => {
  moment.locale("th");

  const doc = createDocument(jsPDF, thSarabunFont);
  const headerY = drawLetterhead(doc);

  // ── ส่วนลงนามถูกตรึงไว้ล่างกระดาษเสมอ — เนื้อหาทั้งหมดต้องจบก่อนถึงเส้นนี้ ────────────────
  // ✅ มี 2 ขนาด: ปกติ กับ "บีบ" (กรอบเตี้ยลง + ชิดขอบล่างขึ้น) ใช้เป็นตัวช่วยสุดท้ายก่อนยอมขึ้นหน้า 2
  // ⚠️ ไม่บีบไว้ตลอด — กรอบเซ็นที่เตี้ยเกินไปเขียนชื่อ/ประทับตราลำบากเวลาปริ้นท์ออกมาเซ็นจริง
  const boxW = 80;
  const SIGN_VARIANTS = [
    { boxH: 54, bottom: 26 },
    { boxH: 46, bottom: 16 },
  ];

  /**
   * ✅ วางเนื้อหาทั้งใบ — เรียกได้ 2 โหมด: draw:false = "วัดความสูง" เฉยๆ ไม่วาดอะไรลงกระดาษ,
   * draw:true = วาดจริง
   * ⚠️ ทำไมต้องวัดก่อน: ใบแจ้งเข้างานควรจบในหน้าเดียวเสมอ (ลูกค้าปริ้นท์แปะบอร์ด/แนบเมลทีเดียวจบ
   * และส่วนลงนามต้องอยู่หน้าเดียวกับกำหนดการ ไม่งั้นเซ็นแล้วแยกแฟ้มกัน) แต่ความยาวจริงเดาไม่ได้เลย —
   * ขึ้นกับที่อยู่ลูกค้ายาวแค่ไหน, งานกี่วัน, ผู้ใช้พิมพ์รายละเอียดรายวันยาวแค่ไหน
   * ✅ จึงลองวัดด้วยขนาดตัวอักษรไล่จากใหญ่ไปเล็ก แล้วใช้ "ขนาดใหญ่ที่สุดที่ยังจบในหน้าเดียว"
   * (ไม่ใช่ย่อทุกใบให้เล็กไว้ก่อน ซึ่งจะทำให้ใบสั้นๆ อ่านลำบากโดยไม่จำเป็น)
   */
  const layout = ({ fs: fontSize, lh, draw }) => {
    doc.setFontSize(fontSize);
    // ✅ ระยะจากหัวกระดาษถึงบล็อกหัวจดหมาย — 2.1 บรรทัดเดิมทำให้เห็นเป็นช่องว่างก้อนใหญ่คั่นกลาง
    let y = headerY + lh * 1.6;
    const put = (text, x, yy, opt) => { if (draw) doc.text(text, x, yy, opt); };
    const gap = (mm) => { y += mm; };

    // ── บล็อกหัวจดหมาย (ป้าย : ค่า) ────────────────────────────────────────
    // 🐛 ที่แก้ (ระยะห่างดูแปลก): เดิมคอลัมน์ "ค่า" ตรึงไว้ที่ 26mm จากขอบซ้ายตายตัว แต่ป้ายยาวสุดที่ใช้
    // จริง ("โครงการ") กว้างแค่ราว 16mm — เหลือช่องว่างโล่งกลางบรรทัดเกือบ 10mm ทุกบรรทัด ดูเหมือนจัด
    // หน้าพลาดมากกว่าตั้งใจ ✅ คิดจากป้ายที่ยาวที่สุดที่ใช้จริงในใบนี้ + ระยะหายใจคงที่ (เทียบ pattern
    // เดียวกับคอลัมน์ของกำหนดการรายวัน) — ค่าทุกบรรทัดยังเรียงตรงกันเหมือนเดิม แค่ไม่ห่างเกินจำเป็น
    // ✅ แนวเยื้องเส้นเดียวใช้ร่วมกับใบส่งมอบงาน (letterIndentFor) — ทั้งคอลัมน์ค่าของหัวจดหมาย
    // ย่อหน้าแรก กำหนดการรายวัน ป้ายหมายเหตุ และคำลงท้าย เริ่มตรงกันหมดในแนวเดียว
    const indent = letterIndentFor(doc);
    const valueX = PAGE.left + indent;
    const VALUE_W = PAGE.w - PAGE.right - valueX;
    const row = (label, value) => {
      const text = spaceThaiLatin(value);
      if (!text) return;
      const ls = doc.splitTextToSize(text, VALUE_W);
      if (label) put(label, PAGE.left, y);
      ls.forEach((ln, i) => put(ln, valueX, y + i * lh));
      y += ls.length * lh;
    };
    row("เลขที่", form.docNumber);
    row("วันที่", thaiFullDate(form.issuedAt));
    row("เรื่อง", form.subject);
    row("โครงการ", form.site);
    row("", form.customerCompany);
    row("", form.customerAddress);
    row("", form.customerTaxId ? `เลขประจำตัวผู้เสียภาษี ${form.customerTaxId}` : "");
    // ⚠️ ระยะเว้นต้องแยกจาก row() — row() คืนค่าทันทีถ้าช่องนั้นว่าง ถ้าผูกระยะเว้นไว้ด้วยกัน ใบที่ไม่ได้
    // กรอก "อ้างถึง" (กรณีปกติ) จะเห็นหัวข้อถัดไปขึ้นไปติดบรรทัดบนพอดีจนดูเหมือนจัดหน้าพลาด
    // ✅ ครึ่งบรรทัดพอ — เต็มบรรทัดกลายเป็นช่องโหว่กลางบล็อก โดยเฉพาะใบที่ไม่ได้กรอกบริษัท/ที่อยู่ลูกค้า
    // (แถวพวกนั้นถูกข้ามไป ช่องว่างเลยไปกองรวมกันอยู่ตรงเดียว)
    gap(lh * 0.55);
    row("เรียน", form.attention);
    row("อ้างถึง", form.reference);

    // ── ย่อหน้าที่ 1 ───────────────────────────────────────────────────────
    const para = (text) => {
      const t = spaceThaiLatin(text);
      if (!t) return;
      wrapParagraph(doc, t, CONTENT_W - indent, CONTENT_W).forEach((ln, i) => {
        put(ln, PAGE.left + (i === 0 ? indent : 0), y);
        y += lh;
      });
    };
    gap(lh * 1.5);
    para(form.body);

    // ── กำหนดการรายวัน — จัดเป็น 3 คอลัมน์ให้ตรงกันทุกบรรทัด ─────────────────
    // ✅ "วันที่ ..." | "เวลา ..." | "สิ่งที่จะทำ" เรียงตรงกันทุกบรรทัด อ่านไล่ลงมาได้เร็วกว่าปล่อยให้ไหล
    // ต่อกันเป็นประโยคเดียว (ซึ่งแต่ละบรรทัดจะเริ่มคนละตำแหน่งเพราะชื่อเดือน/วันที่ยาวไม่เท่ากัน)
    // ⚠️ ความกว้างคอลัมน์คิดจากข้อความจริงในใบนี้ ไม่ใช่ค่าตายตัว — "1 กันยายน" สั้นกว่า "15 กุมภาพันธ์"
    // อยู่หลายมิลลิเมตร ถ้าตั้งตายตัวจะเว้นห่างเกินไปในใบหนึ่งและชนกันในอีกใบหนึ่ง
    const SCHED_X = PAGE.left + indent;
    const HANG = 8; // ระยะเยื้องของบรรทัดที่ 2 เป็นต้นไป ให้เห็นว่ายังเป็นรายการของวันเดิม
    const writeEntry = (text) => {
      const t = spaceThaiLatin(text);
      if (!t) return;
      wrapParagraph(doc, t, CONTENT_W - indent, CONTENT_W - indent - HANG).forEach((ln, i) => {
        put(ln, SCHED_X + (i === 0 ? 0 : HANG), y);
        y += lh;
      });
    };

    gap(lh * 0.8);
    const days = (form.dayRows || []).filter((r) => dayRowText(r));
    if (days.length > 0) {
      const dateOf = (r) => (r.date ? `วันที่ ${thaiFullDate(r.date)}` : "");
      const timeOf = (r) => (r.time ? `เวลา ${spaceThaiLatin(r.time)}` : "");
      const colW = (fn) => Math.max(0, ...days.map((r) => doc.getTextWidth(fn(r))));
      const dateW = colW(dateOf) ? colW(dateOf) + 5 : 0;
      const timeW = colW(timeOf) ? colW(timeOf) + 5 : 0;
      const detailX = SCHED_X + dateW + timeW;
      const detailW = PAGE.w - PAGE.right - detailX;
      days.forEach((r) => {
        // ⚠️ ถ้าคอลัมน์รายละเอียดแคบเกินไป (ผู้ใช้พิมพ์ช่วงเวลายาวผิดปกติ) ให้ไหลเป็นบรรทัดเดียวแทน
        // ดีกว่าบีบข้อความจนตัดเป็นคำละบรรทัด
        if (detailW < 55) { writeEntry(dayRowText(r)); return; }
        const top = y;
        put(dateOf(r), SCHED_X, top);
        put(timeOf(r), SCHED_X + dateW, top);
        const ls = String(spaceThaiLatin(r.detail) || "").split("\n")
          .flatMap((ln) => doc.splitTextToSize(ln, detailW));
        ls.forEach((ln, i) => put(ln, detailX, top + i * lh));
        y = top + Math.max(1, ls.length) * lh;
      });
    }

    // ── หมายเหตุเพิ่มเติม ──────────────────────────────────────────────────
    // ✅ ต้องแยกออกจากรายการรายวันให้ชัด — เดิมพิมพ์ต่อท้ายด้วยรูปแบบเดียวกันเป๊ะ (เยื้องเท่ากัน ขนาด
    // เท่ากัน) ลูกค้าอ่านแล้วนึกว่าเป็นรายละเอียดของวันสุดท้าย ไม่ใช่ข้อความที่ใช้กับทั้งใบ
    // ✅ ใส่ป้าย "หมายเหตุ" คั่นไว้ + เว้นระยะเหนือกว่าปกติ + เนื้อความเยื้องเข้าไปเป็นคอลัมน์ของตัวเอง
    const noteLines = String(form.supportNote || "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (noteLines.length > 0) {
      gap(lh * 0.9);
      const NOTE_LABEL = "หมายเหตุ";
      const noteX = SCHED_X + doc.getTextWidth(NOTE_LABEL) + 5;
      const noteW = PAGE.w - PAGE.right - noteX;
      put(NOTE_LABEL, SCHED_X, y);
      noteLines.forEach((ln) => {
        doc.splitTextToSize(spaceThaiLatin(ln), noteW).forEach((seg) => {
          put(seg, noteX, y);
          y += lh;
        });
      });
    }

    // ── ย่อหน้าที่ 2 + คำลงท้าย ────────────────────────────────────────────
    gap(lh);
    para(form.cooperationNote);
    gap(lh * 0.8);
    put("จึงเรียนมาเพื่อโปรดทราบและขอขอบพระคุณมา ณ โอกาสนี้", PAGE.left + indent, y);
    y += lh;
    return y;
  };

  // ✅ ไล่ขนาดจากปกติ (14pt) ลงไปจนถึงเล็กสุดที่ยังอ่านสบาย (12pt) — TH Sarabun ตัวโปร่งกว่าฟอนต์ละติน
  // ขนาดเดียวกัน 12pt จึงยังอ่านง่ายบนกระดาษ A4 ถ้าเล็กกว่านี้เริ่มไม่เหมาะกับเอกสารที่ส่งให้ลูกค้า
  // ⚠️ ระยะบรรทัดต้องย่อตามขนาดตัวอักษรด้วย ไม่งั้นตัวเล็กลงแต่บรรทัดยังห่างเท่าเดิม = ไม่ประหยัดที่เลย
  const SCALES = [
    { fs: 14, lh: 6.6 },
    { fs: 13.5, lh: 6.3 },
    { fs: 13, lh: 6.0 },
    { fs: 12.5, lh: 5.7 },
    { fs: 12, lh: 5.4 },
  ];
  // ✅ ลองทุกขนาดตัวอักษรกับกรอบลงนาม "ขนาดปกติ" ก่อน แล้วค่อยลองกรอบแบบบีบ — ลำดับนี้สำคัญ เพราะ
  // การย่อตัวอักษรลงนิดเดียวรบกวนสายตาน้อยกว่าการบีบกรอบเซ็นให้เขียนลำบาก
  // ⚠️ วัดความสูงของแต่ละขนาดครั้งเดียวแล้วเก็บไว้ใช้ซ้ำ — ความสูงเนื้อหาไม่ขึ้นกับขนาดกรอบลงนามเลย
  const measured = SCALES.map((s) => ({ ...s, height: layout({ ...s, draw: false }) }));
  let chosen = { ...measured[measured.length - 1], ...SIGN_VARIANTS[SIGN_VARIANTS.length - 1] };
  outer: for (const v of SIGN_VARIANTS) {
    for (const m of measured) {
      if (m.height <= PAGE.h - v.bottom - v.boxH - 3) { chosen = { ...m, ...v }; break outer; }
    }
  }
  const { boxH, bottom } = chosen;
  const boxY = PAGE.h - bottom - boxH;
  const endY = layout({ ...chosen, draw: true });

  // ── ส่วนลงนาม ────────────────────────────────────────────────────────────
  // ✅ ตรึงไว้ล่างกระดาษเสมอ (เหมือนใบส่งมอบงาน) — เอกสารทางการต้องมีที่เซ็นตำแหน่งเดียวกันทุกใบ
  // ⚠️ ปกติจะไม่ถึงตรงนี้แล้ว เพราะขั้นตอนวัดด้านบนย่อขนาดให้พอดีหน้าเดียวไว้ก่อน — แต่ถ้าเนื้อหายาวจริงๆ
  // จนเล็กสุด (12pt) ยังไม่พอ ก็ต้องขึ้นหน้าใหม่ ดีกว่าปล่อยให้ตัวหนังสือทับกรอบลงนามจนอ่านไม่ได้ทั้งคู่
  if (endY > boxY - 3) doc.addPage();

  // ฝั่งซ้าย: ลูกค้าลงนามรับทราบกำหนดการ
  doc.setLineWidth(0.5);
  doc.rect(PAGE.left, boxY, boxW, boxH);
  const leftCenter = PAGE.left + boxW / 2;
  doc.setFontSize(13.5);
  doc.text("ลงนามรับทราบกำหนดการ", leftCenter, boxY + boxH * 0.15, { align: "center" });
  doc.setFontSize(13);
  doc.text("............................................", leftCenter, boxY + boxH * 0.48, { align: "center" });
  doc.text("(____________________________)", leftCenter, boxY + boxH * 0.61, { align: "center" });
  doc.text("วันที่ _______ / _______ / _______", leftCenter, boxY + boxH * 0.74, { align: "center" });
  doc.setFontSize(11.5);
  doc.splitTextToSize(spaceThaiLatin(form.customerCompany), boxW - 4).slice(0, 2)
    .forEach((ln, i) => doc.text(ln, leftCenter, boxY + boxH * 0.85 + i * 4.6, { align: "center" }));

  // ฝั่งขวา: ขอแสดงความนับถือ → ตราประทับ → ชื่อ/ตำแหน่ง/เบอร์ติดต่อ
  const rightCenter = PAGE.w - PAGE.right - boxW / 2;
  doc.setFontSize(13.5);
  doc.text("ขอแสดงความนับถือ", rightCenter, boxY + boxH * 0.15, { align: "center" });
  try {
    const sp = doc.getImageProperties(ISSUER.stamp);
    const sw = 24;
    const sh = (sp.height / sp.width) * sw;
    // ⚠️ ยึด "ขอบล่าง" ของตราไว้ที่ +24.5 แล้วคำนวณขอบบนย้อนขึ้น — ถ้ายึดขอบบนแล้ววันหนึ่งเปลี่ยนไฟล์ตรา
    // เป็นรูปที่สูงกว่าเดิม ตราจะไหลลงไปทับเส้นเซ็น (บั๊กเดิมของใบส่งมอบงานเป๊ะๆ)
    doc.addImage(ISSUER.stamp, "PNG", rightCenter - boxW / 2 + 2, boxY + boxH * 0.45 - sh, sw, sh);
  } catch {
    // ไม่มีไฟล์ตราประทับก็ออกเอกสารได้ตามปกติ (เว้นที่ว่างไว้ให้ประทับตรามือแทน)
  }
  doc.setFontSize(13);
  doc.text("............................................", rightCenter, boxY + boxH * 0.48, { align: "center" });
  doc.text(`( ${spaceThaiLatin(form.signerName) || "____________________________"} )`, rightCenter, boxY + boxH * 0.61, { align: "center" });
  doc.text(spaceThaiLatin(form.signerPosition), rightCenter, boxY + boxH * 0.74, { align: "center" });
  doc.setFontSize(11.5);
  // ✅ เบอร์ติดต่อกลับอยู่ใต้ตำแหน่ง — จุดที่ลูกค้ามองหาเมื่อไม่สะดวกตามกำหนดการ
  const contactLine = spaceThaiLatin([ISSUER.nameTh, form.signerTel && `โทร. ${form.signerTel}`].filter(Boolean).join(" · "));
  doc.splitTextToSize(contactLine, boxW + 12).slice(0, 2)
    .forEach((ln, i) => doc.text(ln, rightCenter, boxY + boxH * 0.85 + i * 4.6, { align: "center" }));

  return outputDocument(doc, `ใบแจ้งเข้างาน ${form.docNumber || ""} ${form.site || ""}`, mode);
};
