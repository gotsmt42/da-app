/**
 * otPdf.js — พิมพ์ใบขออนุมัติ OT เป็น PDF A4
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ให้ออกเอกสารเป็น PDF ด้วย") — รูปแบบเดียวกับใบเบิกของ/ใบขอซื้อ (โทนขาว-ดำ-เทา เส้นบาง)
 *    หัวกระดาษบริษัท → ชื่อเอกสาร + เลขที่/วันที่ → กล่องข้อมูล → ตารางรายการ (วันหยุดระบุชื่อ)
 *    → สรุปชั่วโมงตามประเภท → ประวัติ → ช่องลงนาม ผู้ขอ · ผู้ตรวจสอบ · ผู้อนุมัติ
 * ⚠️ ไม่มีเรื่องเงิน (ผู้ใช้: "ไม่ต้องใส่ค่าจ้าง ให้ทำแค่ชั่วโมงโอที อิงกับงาน")
 */
import moment from "moment";
import { ISSUER, drawLetterhead, outputDocument, spaceThaiLatin, preparePrintAssets } from "@/features/documents/utils/deliveryNotePdf";
import { loadBoldFont, newDoc, wrapText } from "@/features/expenses/utils/expensePdf";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { otStatus, typeMeta, hoursText, periodLabel, OT_TYPES } from "../otMeta";

const W_PAGE = 210;
const H_PAGE = 297;
const L = 14;
const R = W_PAGE - 14;
const W = R - L;
const SIG_H = 34;
const SIG_TOP = H_PAGE - 12 - SIG_H;
const BODY_LIMIT = H_PAGE - 16;

const INK = [15, 23, 42];
const SUB = [100, 116, 139];
const FAINT = [148, 163, 184];
const RULE = [226, 232, 240];
const ZEBRA = [241, 245, 249];
const LINE = [148, 163, 184];
const DAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/**
 * @param {object} opts.request   ใบ OT จาก GET /api/ot/:id
 * @param {Map}    [opts.holidays] วันที่ → { name } (ชุดเดียวกับปฏิทิน)
 */
export async function generateOtPdf({ request: r, holidays = null, mode = "open" }) {
  const [{ jsPDF }, fontModule, boldFont] = await Promise.all([import("jspdf"), import("@/assets/fonts/THSarabunNew_base64"), loadBoldFont()]);
  await preparePrintAssets();
  const doc = newDoc(jsPDF, fontModule.default, boldFont);
  const hasBold = Boolean(boldFont);
  const bold = (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal");
  const size = (pt) => doc.setFontSize(pt);
  const color = (rgb) => doc.setTextColor(...rgb);
  const T = (t) => spaceThaiLatin(String(t ?? ""));
  const st = otStatus(r.status);
  const lines = [...(r.lines || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start).localeCompare(String(b.start)));
  const people = [...new Set(lines.map((l) => l.person?.name).filter(Boolean))];
  const multi = people.length > 1;

  // ── 1. หัวกระดาษ ─────────────────────────────────────────────────────
  doc.setFontSize(17);
  let y = drawLetterhead(doc) + 3.5;
  doc.setDrawColor(...INK); doc.setLineWidth(0.4);
  doc.line(L, y, R, y);
  y += 9;
  color(INK); bold(true); size(20);
  doc.text("ใบขออนุมัติทำงานล่วงเวลา (OT)", W_PAGE / 2, y, { align: "center" });
  bold(false); size(11); color(SUB);
  doc.text("OVERTIME REQUEST", W_PAGE / 2, y + 5, { align: "center" });
  const kvRight = (label, value, yy) => {
    size(12.5); bold(false); color(SUB);
    doc.text(label, R - 46, yy);
    bold(true); color(INK);
    doc.text(value, R, yy, { align: "right" });
  };
  kvRight("เลขที่", r.docNo || "-", y - 4);
  kvRight("วันที่", thaiDate(r.docDate), y + 1.5);
  y += 10;

  // ── 2. ข้อมูลใบ ────────────────────────────────────────────────────────
  const infoRow = (cells) => {
    const total = cells.reduce((sum, c) => sum + (c.w || 1), 0);
    size(13.5); bold(false);
    const layout = cells.map((c) => {
      const cw = (W * (c.w || 1)) / total;
      return { ...c, cw, lines: wrapText(doc, T(c.value || "-"), cw - 5).slice(0, 3) };
    });
    const h = 6 + Math.max(...layout.map((c) => c.lines.length)) * 5.5;
    let x = L;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.25);
    layout.forEach((c, i) => {
      if (i) doc.line(x, y, x, y + h);
      size(10.5); bold(false); color(SUB);
      doc.text(c.label, x + 2.5, y + 4.1);
      size(13.5); color(INK);
      c.lines.forEach((ln, j) => doc.text(ln, x + 2.5, y + 9.2 + j * 5.5));
      x += c.cw;
    });
    doc.line(L, y + h, R, y + h);
    y += h;
  };
  const boxTop = y;
  infoRow([
    { label: "ผู้ขอ", value: r.requester?.name, w: 1.2 },
    { label: "ตำแหน่ง", value: r.requester?.position || "-", w: 1.2 },
    { label: "รอบ (เดือน)", value: periodLabel(r.period), w: 0.8 },
  ]);
  infoRow([
    { label: multi ? "พนักงานที่ทำ OT" : "พนักงาน", value: people.join(", ") || r.requester?.name, w: 2.2 },
    { label: "ชั่วโมงรวม", value: hoursText(r.totalHours), w: 0.8 },
  ]);
  infoRow([{ label: "งานที่อิง", value: [...new Set(lines.map((l) => l.jobTitle).filter(Boolean))].join(" / ") || "-" }]);
  doc.setDrawColor(...RULE); doc.setLineWidth(0.25);
  doc.rect(L, boxTop, W, y - boxTop);
  y += 6;

  // ── 3. ตารางรายการ ─────────────────────────────────────────────────────
  const cols = [{ k: "no", w: 10 }, { k: "date", w: 30 }, { k: "time", w: 25 }, { k: "type", w: 30 }, { k: "desc", w: 0 }, { k: "hrs", w: 17 }];
  cols[4].w = W - cols.reduce((sum, c) => sum + c.w, 0);
  let cx = L; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const col = (k) => cols.find((c) => c.k === k);
  const HEAD_TXT = { no: "ลำดับ", date: "วันที่", time: "เวลา", type: "ประเภท", desc: multi ? "พนักงาน / งาน / รายละเอียด" : "งาน / รายละเอียด", hrs: "ชั่วโมง" };
  let tableTop = y;
  const drawHead = () => {
    const h = 8;
    doc.setFillColor(...ZEBRA); doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.rect(L, y, W, h, "FD");
    size(12.5); bold(true); color(INK);
    cols.forEach((c, i) => {
      doc.text(HEAD_TXT[c.k], c.x + c.w / 2, y + 5.5, { align: "center" });
      if (i) doc.line(c.x, y, c.x, y + h);
    });
    y += h;
  };
  const closeTable = () => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    cols.forEach((c, i) => { if (i) doc.line(c.x, tableTop, c.x, y); });
    doc.rect(L, tableTop, W, y - tableTop);
  };
  drawHead();
  lines.forEach((l, idx) => {
    const hol = holidays?.get?.(String(l.date).slice(0, 10))?.name;
    size(12.5); bold(false);
    const main = [multi ? l.person?.name : "", l.jobTitle].filter(Boolean).join(" · ") || "-";
    const descLines = wrapText(doc, T(main), col("desc").w - 4);
    size(11);
    const subLines = l.task ? wrapText(doc, T(l.task), col("desc").w - 4) : [];
    const dateSub = hol ? wrapText(doc, T(hol), col("date").w - 3).slice(0, 2) : [];
    const rh = Math.max(9, 3.5 + descLines.length * 5 + subLines.length * 4.4, 3.5 + 5 + dateSub.length * 4.2);
    if (y + rh > BODY_LIMIT) { closeTable(); doc.addPage(); y = 16; tableTop = y; drawHead(); }
    const base = y + 5.6;
    size(12.5); color(INK);
    doc.text(String(idx + 1), col("no").x + col("no").w / 2, base, { align: "center" });
    doc.text(`${DAY[moment(l.date).day()]} ${thaiDate(l.date)}`, col("date").x + 2, base);
    if (dateSub.length) { size(10); color([185, 28, 28]); dateSub.forEach((ln, i) => doc.text(ln, col("date").x + 2, base + 4.6 + i * 4.2)); size(12.5); color(INK); }
    doc.text(`${l.start}–${l.end}`, col("time").x + col("time").w / 2, base, { align: "center" });
    const tm = typeMeta(l.type);
    doc.text(`${tm.label} ×${l.multiplier}`, col("type").x + 2, base);
    descLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2, base + i * 5));
    if (subLines.length) { size(11); color(SUB); subLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2, base + descLines.length * 5 + i * 4.4 - 0.4)); size(12.5); color(INK); }
    bold(true); doc.text(hoursText(l.hours).replace(" ชม.", ""), col("hrs").x + col("hrs").w / 2, base, { align: "center" }); bold(false);
    y += rh;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(L, y, R, y);
  });
  closeTable();

  // สรุปตามประเภท (แถวต่อท้ายตาราง)
  const sumRow = (label, value, strong) => {
    const h = 7.5;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.rect(col("desc").x, y, R - col("desc").x, h);
    doc.line(col("hrs").x, y, col("hrs").x, y + h);
    size(12.5); bold(strong); color(INK);
    doc.text(label, col("hrs").x - 2, y + 5.2, { align: "right" });
    doc.text(value, col("hrs").x + col("hrs").w / 2, y + 5.2, { align: "center" });
    y += h;
  };
  if (y + 32 > BODY_LIMIT) { doc.addPage(); y = 16; }
  OT_TYPES.forEach((t) => {
    const h = lines.filter((l) => l.type === t.value).reduce((s, l) => s + l.hours, 0);
    if (h) sumRow(t.label, hoursText(h).replace(" ชม.", ""));
  });
  sumRow("รวมชั่วโมง OT", hoursText(r.totalHours).replace(" ชม.", ""), true);
  y += 6;

  // ── 4. หมายเหตุ + ประวัติ ──────────────────────────────────────────────
  const section = (title, rows) => {
    const content = rows.filter(Boolean);
    if (!content.length) return;
    size(12.5); bold(false);
    const wrapped = content.flatMap(([label, text]) => {
      const lw = label ? doc.getTextWidth(label) + 2 : 0;
      return wrapText(doc, T(text), W - 4 - lw).slice(0, 4).map((ln, i) => ({ label: i === 0 ? label : "", lw, ln }));
    });
    const h = 6 + wrapped.length * 5.4;
    if (y + h > BODY_LIMIT) { doc.addPage(); y = 16; }
    size(12.5); bold(true); color(INK);
    doc.text(title, L, y + 4);
    let yy = y + 9.6;
    wrapped.forEach(({ label, lw, ln }) => {
      size(12.5);
      if (label) { bold(false); color(SUB); doc.text(label, L + 2, yy); }
      bold(false); color(INK);
      doc.text(ln, L + 2 + lw, yy);
      yy += 5.4;
    });
    y += h + 3;
  };
  section("หมายเหตุ", [
    r.note && ["", r.note],
    r.status === "rejected" && ["เหตุผลที่ตีกลับ", `${r.rejectReason || "-"}${r.rejectedBy?.name ? ` · โดย ${r.rejectedBy.name}` : ""}`],
    r.status === "cancelled" && ["ยกเลิกใบ", `${r.cancelReason || ""}${r.cancelledBy?.name ? ` · โดย ${r.cancelledBy.name}` : ""}`],
  ]);
  section("ประวัติการดำเนินการ", (r.activityLog || []).map((a) => [thaiDateTime(a.timestamp), `${String(a.detail || "").replace(/(\d{4})-(\d{2})(?!-)/g, (m) => periodLabel(m))} — ${a.userName}`]));

  // ── 5. ลงนาม 3 ช่อง ────────────────────────────────────────────────────
  if (y > SIG_TOP - 2) doc.addPage();
  const boxes = [
    { role: "ผู้ขออนุมัติ", name: r.requester?.name, date: r.docDate },
    { role: "ผู้ตรวจสอบ", name: r.reviewedBy?.name, date: r.reviewedAt },
    { role: "ผู้อนุมัติ", name: r.approvedBy?.name, date: r.approvedAt },
  ];
  const colW = W / boxes.length;
  boxes.forEach((b, i) => {
    const cxm = L + colW * i + colW / 2;
    const half = colW / 2 - 6;
    const lineY = SIG_TOP + 14;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.line(cxm - half, lineY, cxm + half, lineY);
    size(12.5); bold(false); color(INK);
    doc.text(b.name ? `( ${T(b.name)} )` : "(                                   )", cxm, lineY + 5.5, { align: "center" });
    bold(true);
    doc.text(b.role, cxm, lineY + 11, { align: "center" });
    bold(false); size(11); color(SUB);
    doc.text(b.date ? `วันที่ ${thaiDate(b.date)}` : "วันที่ ......../......../..........", cxm, lineY + 16, { align: "center" });
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    bold(false); size(10); color(FAINT);
    doc.text(`พิมพ์จากระบบเมื่อ ${thaiDateTime(new Date())} · ${ISSUER.nameEn}`, L, H_PAGE - 5);
    doc.text(`${r.docNo || ""} · สถานะ: ${st.label} · หน้า ${p}/${pages}`, R, H_PAGE - 5, { align: "right" });
  }
  doc.setProperties({ title: `ใบขออนุมัติ OT ${r.docNo || ""}`, subject: r.subject || "", creator: ISSUER.nameEn });
  return outputDocument(doc, r.docNo ? `ใบ OT ${r.docNo}` : "ใบ OT", mode);
}
