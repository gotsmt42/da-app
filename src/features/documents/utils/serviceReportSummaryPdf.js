/**
 * serviceReportSummaryPdf.js — PDF "สรุปรายงานบริการ" (Service Report Summary) จากข้อมูลที่ AI อ่าน + คนตรวจแล้ว
 *
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "ให้อ่าน Service Report ของช่าง แล้วกดสร้างสรุปออกมาเป็น PDF ทำให้สมบูรณ์ที่สุด")
 * 🔁 (25 ต.ค. 2569 ผู้ใช้: "เอาแค่เนื้อหารายละเอียดงานที่ทำ ไม่ต้องอ่านหัวกระดาษ และท้ายกระดาษ ... และสรุปปัญหาที่พบ")
 *    • ไม่มีตารางข้อมูลงาน — เลขที่งานอยู่ท้ายกระดาษ (info จากระบบ ใช้แค่ชื่อไฟล์/ท้ายกระดาษ)
 *    • เนื้อหา 2 หัวข้อ: 1) รายละเอียดงานที่ทำ  2) สรุปปัญหาที่พบ (ย่อหน้าสรุป + ตารางทีละจุด/ทีละอุปกรณ์)
 *    หน้าตาชุดเดียวกับเอกสารบริษัท (ใบแจ้งเข้าปฏิบัติงาน / ใบส่งมอบงาน): หัวกระดาษบริษัท · ชื่อเอกสารกลางหน้า ·
 *    ตารางเส้นบาง · ยาวเกินหน้า = ขึ้นหน้าใหม่พร้อมหัวกระดาษและหัวตารางซ้ำ
 * ⚠️ ตัวช่วยข้อมูลงาน/ปัญหา (jobInfoOf · issueStats · splitQty) อยู่ที่ serviceReportData.js ใช้ร่วมกับ Excel — ตัวเลขตรงกันทุกที่
 */
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  preparePrintAssets, createDocument, drawLetterheadModern, drawDocTitle, drawFooter, outputDocument,
  createFlow, setBold, spaceThaiLatin, wrapText, LM, CW, ISSUER,
} from "./deliveryNotePdf";
import { groupIssues, issueLine } from "./serviceReportData";

const beYear = (m) => m.year() + 543;
const INK = [30, 41, 59];
const SUB = [100, 116, 139];
const ACCENT = [37, 99, 235];

/** ฟอนต์ TH Sarabun ไม่มีลูกศร (→ ⇒ ➜ ←) — AI ชอบใช้ เช่น "291 → 174" ทำให้ใน PDF หายเป็นช่องว่าง จึงแทนเป็น "->" */
const pdfSafe = (v) => {
  if (typeof v === "string") return v.replace(/\s*[→⇒➜➔⟶]\s*/g, " -> ").replace(/\s*[←⇐⟵]\s*/g, " <- ");
  if (Array.isArray(v)) return v.map(pdfSafe);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pdfSafe(x)]));
  return v;
};

/**
 * @param data  ข้อมูลสรุป { summary, workDone[], issueSummary, issues[] } (รูปแบบเดียวกับ ServiceReportScan ฝั่งเซิร์ฟเวอร์)
 * @param info  ข้อมูลงานจากระบบ — jobInfoOf()
 * @param meta  { confirmedBy, confirmedAt, fileCount }
 */
export const generateServiceReportSummaryPdf = async ({ jsPDF, thSarabunFont, data, info = {}, meta = {}, mode = "blob" }) => {
  moment.locale("th");
  await preparePrintAssets();
  const doc = createDocument(jsPDF, thSarabunFont);
  const headerY = drawLetterheadModern(doc);
  const d = pdfSafe(data || {});
  const title = "สรุปรายงานบริการ";
  const fs = 13.5;
  const lh = 6.1;
  const f = createFlow(doc, { draw: true, fs, lh, y: 0, title, docNumber: info.jobNo || "-", headerY });
  // 🔁 (25 ต.ค. 2569 ผู้ใช้: "หัวกระดาษสรุปรายงาน ไม่ต้องมีภาษาอังกฤษ" · "ตรงบริษัทยังต้องมีนะ")
  //    ตัดเฉพาะชื่อเอกสารภาษาอังกฤษ (SERVICE REPORT SUMMARY) — หัวกระดาษบริษัทคงครบเหมือนเอกสารอื่น
  f.y = drawDocTitle(doc, headerY, title, "", true) - 3;
  setBold(doc, false); doc.setFontSize(fs);

  const color = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  let secNo = 0;
  /** หัวข้อ: เลข + ชื่อ ตัวหนาสีน้ำเงิน + เส้นใต้บาง · ต้องมีที่พอสำหรับหัวข้อ + 2 บรรทัดแรก */
  const section = (name) => {
    secNo += 1;
    f.y += lh * 0.55;
    f.need(lh * 3.2);
    setBold(doc, true); doc.setFontSize(fs + 1); color(ACCENT);
    doc.text(`${secNo}. ${name}`, LM, f.y);
    doc.setDrawColor(219, 234, 254); doc.setLineWidth(0.4);
    doc.line(LM, f.y + 1.6, LM + CW, f.y + 1.6);
    setBold(doc, false); doc.setFontSize(fs); color(INK);
    f.y += lh * 1.15;
  };
  /** ย่อหน้าธรรมดา (ตัดบรรทัดตามคำไทย) */
  const para = (text, { indent = 0, size = fs, sub = false } = {}) => {
    const t = spaceThaiLatin(text);
    if (!t) return;
    doc.setFontSize(size); if (sub) color(SUB);
    wrapText(doc, t, CW - indent).forEach((ln) => { f.need(0); doc.text(ln, LM + indent, f.y); f.y += lh; });
    doc.setFontSize(fs); color(INK);
  };
  /** รายการเลขข้อ — บรรทัดที่ตัดต่อเยื้องตรงกับข้อความ */
  const list = (items) => {
    items.filter(Boolean).forEach((it, i) => {
      const lines = wrapText(doc, spaceThaiLatin(it), CW - 8);
      f.need(lh * Math.min(lines.length, 2) - lh);
      doc.text(`${i + 1}.`, LM + 1, f.y);
      lines.forEach((ln) => { f.need(0); doc.text(ln, LM + 8, f.y); f.y += lh; });
    });
  };
  /** รายการแบบจุด (•) — ปัญหาที่พบแต่ละข้อ */
  const bullets = (items) => {
    items.filter(Boolean).forEach((it) => {
      const lines = wrapText(doc, spaceThaiLatin(it), CW - 9);
      f.need(lh * Math.min(lines.length, 2) - lh);
      doc.text("•", LM + 4, f.y);
      lines.forEach((ln) => { f.need(0); doc.text(ln, LM + 9, f.y); f.y += lh; });
    });
  };


  // 🔁 (25 ต.ค. 2569 ผู้ใช้: "ส่วนตรงนี้ไม่ต้องอ่าน ไม่ต้องสรุปมาให้เปลือง") — ไม่มีตารางข้อมูลงาน (เลขที่/โครงการ/วันที่/ช่าง)
  //    เนื้อหาเริ่มที่รายละเอียดงานที่ทำเลย · เลขที่งานยังอยู่ที่ท้ายกระดาษและหัวหน้าต่อ

  // ── 1. รายละเอียดงานที่ทำ ─────────────────────────────────────────────────
  const work = d.workDone || [];
  section("รายละเอียดงานที่ทำ");
  if (d.summary) { para(d.summary); f.y += lh * 0.25; }
  if (work.length) list(work);
  if (!d.summary && !work.length) para("- ไม่มีรายละเอียดในเอกสาร -", { sub: true });

  // ── 2. สรุปปัญหาที่พบ ─────────────────────────────────────────────────────
  const issues = d.issues || [];
  section("สรุปปัญหาที่พบ");
  if (!issues.length && !d.issueSummary) {
    para("ไม่พบปัญหา");
  } else {
    if (d.issueSummary) { para(d.issueSummary); f.y += lh * 0.2; }
    // 🔁 (25 ต.ค. 2569 ผู้ใช้: "ถ้ามีระบุอุปกรณ์ ให้แยกเป็นข้อๆ ... อ่านง่าย และมืออาชีพ") — ข้อๆ จัดกลุ่มตามสิ่งที่ต้องทำต่อ แทนตาราง
    groupIssues(issues).forEach((g) => {
      f.need(lh * 2);
      setBold(doc, true); doc.text(`${g.title} (${g.items.length} รายการ)`, LM + 1, f.y); setBold(doc, false);
      f.y += lh;
      bullets(g.items.map(issueLine));
      f.y += lh * 0.25;
    });
  }

  // ── ท้ายเอกสาร: ที่มาของข้อมูล + ผู้ตรวจ ───────────────────────────────────
  f.y += lh * 0.6;
  f.need(lh * 2.5);
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(LM, f.y - lh * 0.6, LM + CW, f.y - lh * 0.6);
  para([
    meta.fileCount ? `สรุปจาก Service Report ${meta.fileCount} ไฟล์` : "สรุปจาก Service Report",
    meta.confirmedBy ? `ตรวจและยืนยันโดย ${meta.confirmedBy}${meta.confirmedAt ? ` ${moment(meta.confirmedAt).format("D MMM")} ${beYear(moment(meta.confirmedAt))}` : ""}` : "ฉบับร่าง (ยังไม่ได้ยืนยัน)",
    ISSUER.nameTh,
  ].join(" · "), { size: fs - 2, sub: true });

  drawFooter(doc, `สรุปรายงานบริการ · ${info.jobNo || info.site || ""}`);
  const name = `สรุปรายงานบริการ ${info.jobNo || ""} ${info.site || ""}`.trim();
  return outputDocument(doc, name, mode);
};
