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
  ISSUER, LM, spaceThaiLatin, thaiFullDate, resolveJobFields,
  ATTENTION_PRESETS, SIGNER_POSITION_PRESETS,
  defaultReferenceFor, createDocument, outputDocument,
  preparePrintAssets, drawLetterheadModern, drawDocTitle, drawLetterMeta, flowParagraph, flowTable, flowLabeled, placeFlowLetter,
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
// 🔁 (17 ต.ค. 2569 ผู้ใช้: "หมายเหตุให้ระบุว่าถ้าจำเป็นด้วย") — ขึ้นต้น "หากจำเป็น" ทุกข้อ: เป็นคำขอเผื่อไว้ ไม่ใช่เงื่อนไขบังคับลูกค้า
export const SUPPORT_REQUEST_PRESETS = [
  "หากจำเป็น บริษัทฯ ขอความอนุเคราะห์อุปกรณ์สำหรับงานที่สูง เช่น บันได นั่งร้าน หรือลิฟต์ และเจ้าหน้าที่ประสานงาน 1 ท่าน",
  "หากจำเป็น บริษัทฯ ขอความอนุเคราะห์เจ้าหน้าที่ประสานงานเพื่อนำเข้าพื้นที่ 1 ท่าน",
  "หากจำเป็น บริษัทฯ ขอความอนุเคราะห์เปิดพื้นที่และระบบไฟฟ้าสำหรับการทดสอบ",
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
  const roundLabel = formatRoundLabel(p.time, p.visitCount, p);

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
    reference: defaultReferenceFor(job),
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
    `ตามที่ ${ISSUER.nameTh} ได้รับความไว้วางใจ${customer} ให้ดำเนินการ ${work}${place}${ref} นั้น ` +
    `บริษัทฯ ขอแจ้งกำหนดการเข้าปฏิบัติงาน${round} ดังนี้`
  );
};

/** ย่อหน้าที่ 2 — ขอความร่วมมือ/ยืนยันมาตรการ */
export const buildWorkNoticeCooperation = () => spaceThaiLatin(
  `จึงขอความร่วมมือท่านแจ้งผู้เกี่ยวข้องให้ทราบกำหนดการดังกล่าว บริษัทฯ จะปฏิบัติงานอย่างระมัดระวัง ` +
  `ไม่ให้กระทบผู้ใช้พื้นที่ และปฏิบัติตามมาตรการความปลอดภัยตลอดการทำงาน ` +
  `หากวันหรือเวลาดังกล่าวไม่สะดวก กรุณาติดต่อกลับเพื่อนัดหมายใหม่`
);

/**
 * สร้างไฟล์ PDF ใบแจ้งเข้าปฏิบัติงาน (รูปแบบใหม่ 17 ต.ค. 2569 — ชุดจัดหน้าอยู่ใน deliveryNotePdf.js)
 * @param {"open"|"download"|"blob"} mode
 */
export const generateWorkNoticePdf = async ({ jsPDF, thSarabunFont, form, mode = "open" }) => {
  moment.locale("th");
  await preparePrintAssets();
  const doc = createDocument(jsPDF, thSarabunFont);
  const headerY = drawLetterheadModern(doc);
  const days = (form.dayRows || []).filter((r) => dayRowText(r));

  placeFlowLetter(doc, {
    headerY,
    title: "ใบแจ้งเข้าปฏิบัติงาน",
    docNumber: form.docNumber,
    firstY: ({ fs, lh }, draw) => {
      const y = drawDocTitle(doc, headerY, "ใบแจ้งเข้าปฏิบัติงาน", "WORK NOTICE", draw);
      return drawLetterMeta(doc, {
        y: y + 2, fs, lh, draw, docNumber: form.docNumber, date: form.issuedAt,
        rows: [
          ["เรื่อง", form.subject],
          ["โครงการ", form.site],
          ["", form.customerCompany],
          ["", form.customerAddress],
          ["", form.customerTaxId ? `เลขประจำตัวผู้เสียภาษี ${form.customerTaxId}` : ""],
          ["เรียน", form.attention, { gapBefore: 0.3 }],
          ["อ้างถึง", form.reference],
        ],
      }) + lh;
    },
    body: (f) => {
      flowParagraph(doc, f, form.body);
      // ✅ กำหนดการเป็นตาราง วันที่ | เวลา | รายละเอียด — หลายวันจนล้นหน้า = ขึ้นหน้าใหม่พร้อมหัวตารางซ้ำ (ไม่ย่อตัวอักษร)
      if (!days.length) return;
      f.y += -f.lh + 4.8;
      flowTable(doc, f, {
        cols: [
          { title: "วันที่", w: 34 },
          { title: "เวลา", w: 30, align: "center" },
          { title: "รายละเอียดการปฏิบัติงาน" },
        ],
        rows: days.map((r) => [r.date ? thaiFullDate(r.date) : "-", r.time || "-", r.detail || "-"]),
      });
      f.y += f.lh * 1.45;
    },
    // ส่วนท้าย (หมายเหตุ · ย่อหน้าปิด · คำลงท้าย) ไปพร้อมช่องเซ็นเสมอ
    closing: (f) => {
      if (String(form.supportNote || "").trim()) {
        flowLabeled(doc, f, "หมายเหตุ", form.supportNote);
        f.y += f.lh * 0.9;
      }
      flowParagraph(doc, f, form.cooperationNote);
      f.y += f.lh * 0.6;
      f.need(0);
      if (f.draw) doc.text("จึงเรียนมาเพื่อโปรดทราบ และขอขอบพระคุณมา ณ โอกาสนี้", LM + 14, f.y);
    },
    sign: {
      leftTitle: "ลงนามรับทราบกำหนดการ",
      customer: form.customerCompany || form.site,
      signerName: form.signerName, signerPosition: form.signerPosition,
      contact: [ISSUER.nameTh, form.signerTel && `โทร. ${form.signerTel}`].filter(Boolean).join(" · "),
      signatureImage: form.signatureImage,
    },
    footerLabel: `ใบแจ้งเข้าปฏิบัติงาน · เลขที่ ${form.docNumber || "-"}`,
  });

  return outputDocument(doc, `ใบแจ้งเข้างาน ${form.docNumber || ""} ${form.site || ""}`, mode);
};
