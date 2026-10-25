/**
 * serviceReportSummaryPdf.js — PDF "สรุปรายงานบริการ" (Service Report Summary) จากข้อมูลที่ AI อ่าน + คนตรวจแล้ว
 *
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "ให้อ่าน Service Report ของช่าง แล้วกดสร้างสรุปออกมาเป็น PDF ทำให้สมบูรณ์ที่สุด")
 *    หน้าตาชุดเดียวกับเอกสารบริษัท (ใบแจ้งเข้าปฏิบัติงาน / ใบส่งมอบงาน): หัวกระดาษบริษัท · ชื่อเอกสารกลางหน้า ·
 *    ตารางเส้นบาง · ตัวอักษรไม่ต่ำกว่า 13pt · ยาวเกินหน้า = ขึ้นหน้าใหม่พร้อมหัวกระดาษและหัวตารางซ้ำ
 *    ลำดับเนื้อหา: ข้อมูลงาน → ผลการทำงาน → บทสรุป/ประเด็นสำคัญ → สถานะระบบก่อน/หลัง → ผลตรวจเช็ค →
 *    รายละเอียดงานที่ทำ → ปัญหาที่พบ/อุปกรณ์ที่ต้องเปลี่ยน → ข้อเสนอแนะ/การติดตาม → ลูกค้า/ผู้ให้บริการ
 *    หัวข้อที่ไม่มีข้อมูลไม่พิมพ์ (ไม่มีตารางว่างให้ดูไม่เรียบร้อย) · เลขหัวข้อเรียงใหม่ตามที่พิมพ์จริง
 */
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  preparePrintAssets, createDocument, drawLetterheadModern, drawDocTitle, drawFooter, outputDocument,
  createFlow, flowTable, setBold, spaceThaiLatin, wrapText, LM, CW, ISSUER,
} from "./deliveryNotePdf";

export const RESULT_META = {
  normal: { label: "ปกติ ใช้งานได้", rgb: [21, 128, 61], fill: [240, 253, 244] },
  working_with_issues: { label: "ใช้งานได้ แต่มีจุดต้องแก้ไข", rgb: [180, 83, 9], fill: [255, 251, 235] },
  not_working: { label: "ใช้งานไม่ได้", rgb: [185, 28, 28], fill: [254, 242, 242] },
  unknown: { label: "ไม่ระบุ", rgb: [100, 116, 139], fill: [248, 250, 252] },
};
export const ISSUE_STATUS = { fixed: "แก้แล้ว", pending: "ยังค้าง", need_quote: "ต้องเสนอราคา", unknown: "-" };
export const CHECK_RESULT = { normal: "ปกติ", abnormal: "ผิดปกติ", unknown: "-" };

const INK = [30, 41, 59];
const SUB = [100, 116, 139];
const ACCENT = [37, 99, 235];

const thDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return String(iso || "");
  const m = moment(iso, "YYYY-MM-DD");
  return `${m.date()} ${m.locale("th").format("MMM")} ${m.year() + 543}`;
};
/** วันที่ + เวลาเข้า-ออก ทุกวัน ในบรรทัดเดียว เช่น "22 ต.ค. 2569 09:00–17:00 น. · 23 ต.ค. 2569" */
export const datesText = (dates = []) => dates
  .map((d) => [thDate(d.date), d.timeIn || d.timeOut ? `${d.timeIn || "-"}–${d.timeOut || "-"} น.` : ""].filter(Boolean).join(" "))
  .filter(Boolean).join(" · ");

/** ฟอนต์ TH Sarabun ไม่มีลูกศร (→ ⇒ ➜ ←) — AI ชอบใช้ เช่น "291 → 174" ทำให้ใน PDF หายเป็นช่องว่าง จึงแทนเป็น "->" */
const pdfSafe = (v) => {
  if (typeof v === "string") return v.replace(/\s*[→⇒➜➔⟶]\s*/g, " -> ").replace(/\s*[←⇐⟵]\s*/g, " <- ");
  if (Array.isArray(v)) return v.map(pdfSafe);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pdfSafe(x)]));
  return v;
};

/**
 * @param data  ข้อมูลสรุป (รูปแบบเดียวกับ ServiceReportScan ฝั่งเซิร์ฟเวอร์)
 * @param meta  { jobNo, company, site, system, title, preparedBy, confirmedBy, confirmedAt, fileCount, status }
 */
export const generateServiceReportSummaryPdf = async ({ jsPDF, thSarabunFont, data, meta = {}, mode = "blob" }) => {
  moment.locale("th");
  await preparePrintAssets();
  const doc = createDocument(jsPDF, thSarabunFont);
  const headerY = drawLetterheadModern(doc);
  const d = pdfSafe(data || {});
  const job = d.job || {};
  const title = "สรุปรายงานบริการ";
  const fs = 13.5;
  const lh = 6.1;
  const f = createFlow(doc, { draw: true, fs, lh, y: 0, title, docNumber: meta.jobNo || "-", headerY });
  f.y = drawDocTitle(doc, headerY, title, "SERVICE REPORT SUMMARY", true) + 1;
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
  /** รายการแบบมีหัวข้อย่อย (• หรือ 1. 2. 3.) — บรรทัดที่ตัดต่อเยื้องตรงกับข้อความ */
  const list = (items, numbered = false) => {
    items.filter(Boolean).forEach((it, i) => {
      const mark = numbered ? `${i + 1}.` : "•";
      const ind = numbered ? 8 : 6;
      const lines = wrapText(doc, spaceThaiLatin(it), CW - ind);
      f.need(lh * Math.min(lines.length, 2) - lh);
      doc.text(mark, LM + 1, f.y);
      lines.forEach((ln) => { f.need(0); doc.text(ln, LM + ind, f.y); f.y += lh; });
    });
  };
  /** ตาราง (flowTable คาด f.y = ขอบบนของตาราง) */
  const table = (cols, rows) => {
    if (!rows.length) return;
    f.y -= lh * 0.72;
    flowTable(doc, f, { cols, rows });
    f.y += lh * 0.95;
  };

  // ── ข้อมูลงาน (ตาราง 2 คู่ต่อแถว) ──────────────────────────────────────────
  const info = [
    ["โครงการ / สถานที่", job.project || meta.site || "-"],
    ["ลูกค้า", meta.company && meta.company !== (job.project || meta.site) ? meta.company : ""],
    ["ระบบ", job.system || meta.system || "-"],
    ["ประเภทงาน", [job.jobType || meta.title, job.pmRound ? `ครั้งที่ ${job.pmRound}` : ""].filter(Boolean).join(" ") || "-"],
    ["เลขที่งาน", meta.jobNo || "-"],
    ["วันที่เข้างาน", datesText(job.dates) || "-"],
    ["ผู้ติดต่อ", [job.contactName, job.contactPosition, job.contactPhone].filter(Boolean).join(" · ")],
    ["ช่างผู้ให้บริการ", (d.technicians || []).join(", ")],
  ].filter(([, v]) => v);
  f.y += 1.5;
  table([{ title: "หัวข้อ", w: 40 }, { title: "รายละเอียด" }], info);

  // ── ผลการทำงาน (กล่องสี) ───────────────────────────────────────────────────
  const rm = RESULT_META[d.result] || RESULT_META.unknown;
  f.need(lh * 2.2);
  const boxY = f.y - lh * 0.75;
  doc.setFillColor(rm.fill[0], rm.fill[1], rm.fill[2]); doc.setDrawColor(rm.rgb[0], rm.rgb[1], rm.rgb[2]); doc.setLineWidth(0.35);
  doc.roundedRect(LM, boxY, CW, lh * 1.55, 1.6, 1.6, "FD");
  setBold(doc, true); color(INK); doc.text("ผลการทำงาน :", LM + 3, boxY + lh * 1.02);
  const lw = doc.getTextWidth("ผลการทำงาน :") + 5;
  color(rm.rgb); doc.text(rm.label, LM + 3 + lw, boxY + lh * 1.02);
  setBold(doc, false); color(INK);
  const fu = d.followUp || {};
  const tags = [fu.revisit ? `ต้องเข้าอีก${fu.revisitDate ? ` ${thDate(fu.revisitDate)}` : ""}` : "", fu.needQuotation ? "ต้องเสนอราคา" : ""].filter(Boolean).join(" · ");
  if (tags) { doc.setFontSize(fs - 1); color(SUB); doc.text(tags, LM + CW - 3, boxY + lh * 1.02, { align: "right" }); doc.setFontSize(fs); color(INK); }
  f.y = boxY + lh * 1.55 + lh * 0.9;

  // ── บทสรุป ────────────────────────────────────────────────────────────────
  if (d.summary || (d.highlights || []).length) {
    section("บทสรุป");
    para(d.summary);
    if ((d.highlights || []).length) { f.y += lh * 0.2; list(d.highlights); }
  }

  // ── สถานะระบบ ก่อน → หลัง ─────────────────────────────────────────────────
  if ((d.systemStatus || []).length) {
    section("สถานะระบบ ก่อนเข้า / หลังเสร็จ");
    table([{ title: "รายการ", w: 70 }, { title: "ก่อนเข้า", w: 50, align: "center" }, { title: "หลังเสร็จ", align: "center" }],
      d.systemStatus.map((r) => [r.item, r.before || "-", r.after || "-"]));
  }

  // ── ผลตรวจเช็คพื้นฐาน ─────────────────────────────────────────────────────
  if ((d.checks || []).length) {
    section("ผลตรวจเช็คพื้นฐาน");
    table([{ title: "รายการ", w: 55 }, { title: "ค่าที่วัด / ข้อมูล", w: 85 }, { title: "ผล", align: "center" }],
      d.checks.map((r) => [r.item, r.value || "-", CHECK_RESULT[r.result] || "-"]));
  }

  // ── รายละเอียดงานที่ทำ ─────────────────────────────────────────────────────
  if ((d.workDone || []).length) {
    section("รายละเอียดงานที่ทำ");
    list(d.workDone, true);
  }

  // ── ปัญหาที่พบ / อุปกรณ์ที่ต้องเปลี่ยน ─────────────────────────────────────
  if ((d.issues || []).length) {
    section("ปัญหาที่พบ / อุปกรณ์ที่ต้องเปลี่ยน");
    table([
      { title: "ลำดับ", w: 12, align: "center" }, { title: "ตำแหน่ง", w: 30 }, { title: "ปัญหา / อาการ", w: 52 },
      { title: "อุปกรณ์ / รุ่น", w: 34 }, { title: "จำนวน", w: 18, align: "center" }, { title: "สถานะ", align: "center" },
    ], d.issues.map((r, i) => [String(i + 1), r.location || "-", r.problem || "-", r.part || "-", r.qty || "-", ISSUE_STATUS[r.status] || "-"]));
  }

  // ── ข้อเสนอแนะ / การติดตาม ─────────────────────────────────────────────────
  const follow = [
    ...(d.recommendations || []),
    fu.revisit ? `นัดเข้าดำเนินการอีกครั้ง${fu.revisitDate ? ` วันที่ ${thDate(fu.revisitDate)}` : ""}` : "",
    fu.needQuotation ? "จัดทำใบเสนอราคาสำหรับอุปกรณ์/งานที่ต้องเปลี่ยนตามรายการข้างต้น" : "",
    fu.coordinateWith ? `ประสานงานกับ ${fu.coordinateWith}` : "",
  ].filter(Boolean);
  if (follow.length) {
    section("ข้อเสนอแนะและการติดตาม");
    list([...new Set(follow)]);
  }

  // ── ลูกค้า / การรับรอง ─────────────────────────────────────────────────────
  const c = d.customer || {};
  if (c.comment || c.signed || c.name) {
    section("ความเห็นและการรับรองของลูกค้า");
    if (c.comment) para(`ความเห็นลูกค้า: ${c.comment}`);
    para([c.signed ? "ลูกค้าลงนามรับรองใน Service Report แล้ว" : "ยังไม่พบลายเซ็นลูกค้าใน Service Report",
      c.name ? `(${c.name})` : "", c.signDate ? `วันที่ ${thDate(c.signDate)}` : ""].filter(Boolean).join(" "));
  }

  // ── ท้ายเอกสาร: ที่มาของข้อมูล + ผู้จัดทำ/ผู้ตรวจ ───────────────────────────
  f.y += lh * 0.6;
  f.need(lh * 2.5);
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(LM, f.y - lh * 0.6, LM + CW, f.y - lh * 0.6);
  para([
    `สรุปจาก Service Report ${meta.fileCount || ""} ไฟล์`.replace("  ", " "),
    meta.confirmedBy ? `ตรวจและยืนยันโดย ${meta.confirmedBy}${meta.confirmedAt ? ` ${moment(meta.confirmedAt).format("D MMM")} ${moment(meta.confirmedAt).year() + 543}` : ""}` : "ฉบับร่าง (ยังไม่ได้ยืนยัน)",
    `${ISSUER.nameTh}`,
  ].join(" · "), { size: fs - 2, sub: true });

  drawFooter(doc, `สรุปรายงานบริการ · ${meta.jobNo || job.project || ""}`);
  const name = `สรุปรายงานบริการ ${meta.jobNo || ""} ${job.project || meta.site || ""}`.trim();
  return outputDocument(doc, name, mode);
};
