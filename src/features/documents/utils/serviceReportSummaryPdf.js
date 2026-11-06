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
// สีกลุ่มปัญหา — ตรงกับหน้าจอ (ISSUE_TONE ใน ServiceReportSummaryDialog)
const GROUP_RGB = { fixed: [21, 128, 61], pending: [180, 83, 9], need_quote: [194, 65, 12], unknown: SUB };

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
  // 🔁 (6 พ.ย. 2569 ผู้ใช้: "แก้ไขรายละเอียดให้ชัดเจนและมองง่ายกว่านี้") ตัวอักษรใหญ่ขึ้น (13.5 → 15) อ่านง่ายทั้งจอและกระดาษ
  const fs = 15;
  const lh = 6.7;
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
  /** กล่องสรุปสั้น (พื้นฟ้าอ่อน) — ยาวเกินที่เหลือในหน้าก็ขึ้นหน้าใหม่ทั้งกล่อง · ยาวเกินครึ่งหน้า = ย่อหน้าธรรมดา */
  const leadBox = (text) => {
    const t = spaceThaiLatin(text);
    if (!t) return;
    const lines = wrapText(doc, t, CW - 8);
    const h = lines.length * lh + 3.2;
    if (h > 120) { para(text); return; }
    f.y += 1.2;
    f.need(h);
    const top = f.y - lh + 1.6;
    doc.setFillColor(239, 246, 255); doc.setDrawColor(219, 234, 254); doc.setLineWidth(0.3);
    doc.roundedRect(LM, top, CW, h, 1.6, 1.6, "FD");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.rect(LM, top, 1.1, h, "F");
    lines.forEach((ln) => { doc.text(ln, LM + 4.5, f.y + 0.8); f.y += lh; });
    f.y += 4.5;
  };
  /** รายการเลขข้อ — บรรทัดที่ตัดต่อเยื้องตรงกับข้อความ */
  const list = (items) => {
    items.filter(Boolean).forEach((it, i) => {
      const lines = wrapText(doc, spaceThaiLatin(it), CW - 8);
      f.need(lh * Math.min(lines.length, 2) - lh);
      setBold(doc, true); color(ACCENT); doc.text(`${i + 1}.`, LM + 1, f.y); setBold(doc, false); color(INK);
      lines.forEach((ln) => { f.need(0); doc.text(ln, LM + 8, f.y); f.y += lh; });
    });
  };
  /** รายการแบบจุด (•) — ปัญหาที่พบแต่ละข้อ */
  const bullets = (items, rgb = INK) => {
    items.filter(Boolean).forEach((it) => {
      const lines = wrapText(doc, spaceThaiLatin(it), CW - 9);
      f.need(lh * Math.min(lines.length, 2) - lh);
      color(rgb); doc.text("•", LM + 4, f.y); color(INK);
      lines.forEach((ln) => { f.need(0); doc.text(ln, LM + 9, f.y); f.y += lh; });
    });
  };


  // 🔁 (25 ต.ค. 2569 ผู้ใช้: "ส่วนตรงนี้ไม่ต้องอ่าน ไม่ต้องสรุปมาให้เปลือง") — ไม่มีตารางข้อมูลงาน (เลขที่/โครงการ/วันที่/ช่าง)
  //    เนื้อหาเริ่มที่รายละเอียดงานที่ทำเลย · เลขที่งานยังอยู่ที่ท้ายกระดาษและหัวหน้าต่อ

  // ── 1. รายละเอียดงานที่ทำ ─────────────────────────────────────────────────
  const work = d.workDone || [];
  section("รายละเอียดงานที่ทำ");
  if (d.summary) leadBox(d.summary);
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
      const rgb = GROUP_RGB[g.key] || INK;
      f.need(lh * 2);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(LM, f.y - lh + 2, 1.1, lh - 0.6, "F");
      setBold(doc, true); color(rgb); doc.text(`${g.title} (${g.items.length} รายการ)`, LM + 3.5, f.y); setBold(doc, false); color(INK);
      f.y += lh;
      bullets(g.items.map(issueLine), rgb);
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
