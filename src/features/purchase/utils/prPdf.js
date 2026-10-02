/**
 * prPdf.js — พิมพ์ใบขอซื้อสินค้า (PR) เป็น PDF A4
 *
 * ✅ แบบฟอร์มมาตรฐานใบขอซื้อ: หัวกระดาษบริษัท · เลขที่/วันที่ · ผู้ขอ/ตำแหน่ง · เรื่อง · งาน · ความเร่งด่วน ·
 *    ต้องการใช้ภายใน · สถานที่ส่ง · ร้านที่แนะนำ · ตาราง (ลำดับ · รายการ/สเปก · จำนวน · หน่วย · ราคา/หน่วย · จำนวนเงิน)
 *    · รวม/VAT/ยอดรวม (ตัวอักษร) · วัตถุประสงค์ · ข้อมูลการสั่งซื้อ (ถ้ามี) · ลงนาม 4 ช่อง
 * ✅ รายการเยอะขึ้นหน้าใหม่อัตโนมัติ — ช่องลงนามอยู่หน้าสุดท้ายเสมอ (ห้ามตัดรายการทิ้ง)
 * ⚠️ jsPDF + ฟอนต์ไทยโหลดแบบ dynamic เฉพาะตอนกดพิมพ์
 */
import { ISSUER, drawLetterhead, outputDocument, spaceThaiLatin, preparePrintAssets } from "@/features/documents/utils/deliveryNotePdf";
import { loadBoldFont, newDoc, wrapText } from "@/features/expenses/utils/expensePdf";
import { bahtText } from "@/features/expenses/expenseMeta";
import { thaiDate, thaiDateFull, thaiDateTime } from "@/shared/utils/thaiDate";
import { prStatus, priorityMeta, fmtMoney, fmtQty, prJobText } from "../prMeta";

const W_PAGE = 210;
const H_PAGE = 297;
const L = 14;
const R = W_PAGE - 14;
const W = R - L;
const SIG_H = 34;
const SIG_TOP = H_PAGE - 10 - SIG_H;
const SLATE = [15, 23, 42];
const GRAY = [100, 116, 139];
const LINE = [148, 163, 184];
const MAIN = [55, 48, 163];
const HEAD = [224, 231, 255];
const FILL = [238, 242, 255];

export async function generatePrPdf({ request: r, mode = "open" }) {
  const [{ jsPDF }, fontModule, boldFont] = await Promise.all([import("jspdf"), import("@/assets/fonts/THSarabunNew_base64"), loadBoldFont()]);
  await preparePrintAssets();
  const doc = newDoc(jsPDF, fontModule.default, boldFont);
  const hasBold = Boolean(boldFont);
  const bold = (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal");
  const size = (pt) => doc.setFontSize(pt);
  const color = (rgb) => doc.setTextColor(...rgb);
  const dotted = (x1, y1, x2) => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.setLineDashPattern([0.5, 0.8], 0);
    doc.line(x1, y1, x2, y1); doc.setLineDashPattern([], 0);
  };
  const rowH = 7;
  const field = (label, value, x1, x2, yy) => {
    size(14); bold(true); color(SLATE);
    doc.text(label, x1, yy);
    const vx = x1 + doc.getTextWidth(label) + 2;
    bold(false);
    const lines = wrapText(doc, spaceThaiLatin(value || "-"), x2 - vx - 1);
    lines.forEach((ln, i) => { doc.text(ln, vx + 1, yy + i * rowH); dotted(vx, yy + i * rowH + 1.3, x2); });
    return lines.length;
  };

  // ── หัวกระดาษ ─────────────────────────────────────────────────────
  doc.setFontSize(17);
  let y = drawLetterhead(doc) + 2.5;
  doc.setDrawColor(...MAIN); doc.setLineWidth(0.8); doc.line(L, y, R, y);
  y += 9;
  bold(true); size(21); color(MAIN);
  doc.text("ใบขอซื้อสินค้า", W_PAGE / 2, y, { align: "center" });
  size(12); bold(false);
  doc.text("PURCHASE REQUISITION", W_PAGE / 2, y + 5, { align: "center" });
  const pr = priorityMeta(r.priority);
  if (r.priority && r.priority !== "normal") {
    size(12); bold(true);
    const bw = doc.getTextWidth(pr.label) + 8;
    doc.setFillColor(...(r.priority === "critical" ? [185, 28, 28] : [180, 83, 9]));
    doc.roundedRect(R - bw, y - 5.5, bw, 7, 3.5, 3.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(pr.label, R - bw / 2, y - 0.6, { align: "center" });
  }
  y += 12;
  color(SLATE); size(14);
  bold(true); doc.text("เลขที่", L, y);
  bold(false); doc.text(r.docNo || "-", L + doc.getTextWidth("เลขที่ ") + 1, y);
  const dateText = thaiDateFull(r.docDate);
  doc.text(dateText, R, y, { align: "right" });
  bold(true); doc.text("วันที่", R - doc.getTextWidth(dateText) - 2, y, { align: "right" });

  // ── ข้อมูล ────────────────────────────────────────────────────────
  y += rowH + 1;
  const mid = L + W * 0.58;
  field("ผู้ขอซื้อ", r.requester?.name, L, mid - 4, y);
  field("ตำแหน่ง", r.requester?.position, mid, R, y);
  y += rowH;
  y += rowH * field("เรื่อง", r.subject, L, R, y);
  if (r.eventId || r.job?.title) y += rowH * field("ใช้กับงาน / โครงการ", `${prJobText(r.job)}${r.job?.docNo ? ` (${r.job.docNo})` : ""}`, L, R, y);
  field("ต้องการใช้ภายใน", r.neededBy ? thaiDateFull(r.neededBy) : "ไม่ระบุ", L, mid - 4, y);
  field("ความเร่งด่วน", pr.label, mid, R, y);
  y += rowH;
  y += rowH * field("สถานที่ส่งของ", r.deliverTo, L, R, y);
  if (r.suggestedSupplier) y += rowH * field("ร้านค้าที่แนะนำ", r.suggestedSupplier, L, R, y);

  // ── ตาราง ─────────────────────────────────────────────────────────
  const cols = [{ k: "no", w: 11 }, { k: "desc", w: 0 }, { k: "qty", w: 18 }, { k: "unit", w: 18 }, { k: "price", w: 27 }, { k: "amount", w: 30 }];
  cols[1].w = W - cols.reduce((s, c) => s + c.w, 0);
  let cx = L; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const col = (k) => cols.find((c) => c.k === k);
  const HEADERS = { no: "ลำดับ", desc: "รายการ / ยี่ห้อ / รุ่น / สเปก", qty: "จำนวน", unit: "หน่วย", price: "ราคา/หน่วย", amount: "จำนวนเงิน (บาท)" };
  const drawHead = () => {
    const h = 8;
    doc.setFillColor(...HEAD); doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.rect(L, y, W, h, "FD");
    size(13); bold(true); color(SLATE);
    cols.forEach((c, i) => { doc.text(HEADERS[c.k], c.x + c.w / 2, y + 5.4, { align: "center" }); if (i) doc.line(c.x, y, c.x, y + h); });
    y += h;
  };
  y += 3;
  drawHead();
  let tableTop = y;
  const closeTable = () => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    cols.forEach((c, i) => { if (i) doc.line(c.x, tableTop, c.x, y); });
    doc.rect(L, tableTop, W, y - tableTop);
  };
  const BODY_LIMIT = H_PAGE - 16;
  (r.items || []).forEach((it, idx) => {
    size(14); bold(false);
    const descLines = wrapText(doc, spaceThaiLatin(it.description), col("desc").w - 3.5);
    size(12);
    const specLines = [it.spec, it.note ? `หมายเหตุ: ${it.note}` : ""].filter(Boolean).flatMap((t) => wrapText(doc, spaceThaiLatin(t), col("desc").w - 3.5));
    const rh = Math.max(8, 3 + descLines.length * 5.5 + specLines.length * 4.6);
    if (y + rh > BODY_LIMIT) {
      closeTable();
      doc.addPage();
      y = 16;
      drawHead();
      tableTop = y;
    }
    const base = y + 5.4;
    size(14); color(SLATE);
    doc.text(String(idx + 1), col("no").x + col("no").w / 2, base, { align: "center" });
    descLines.forEach((ln, i) => doc.text(ln, col("desc").x + 1.8, base + i * 5.5));
    if (specLines.length) {
      size(12); color(GRAY);
      specLines.forEach((ln, i) => doc.text(ln, col("desc").x + 1.8, base + descLines.length * 5.5 + i * 4.6 - 0.6));
      size(14); color(SLATE);
    }
    doc.text(fmtQty(it.qty), col("qty").x + col("qty").w / 2, base, { align: "center" });
    doc.text(it.unit || "-", col("unit").x + col("unit").w / 2, base, { align: "center" });
    doc.text(it.estUnitPrice ? fmtMoney(it.estUnitPrice) : "-", col("price").x + col("price").w - 2, base, { align: "right" });
    doc.text(it.estAmount ? fmtMoney(it.estAmount) : "-", col("amount").x + col("amount").w - 2, base, { align: "right" });
    y += rh;
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.15); doc.line(L, y, R, y);
  });
  closeTable();

  // ── สรุปยอด ───────────────────────────────────────────────────────
  const sumRow = (label, value, strong, words) => {
    const h = 7.5;
    if (strong) { doc.setFillColor(...FILL); doc.rect(col("price").x, y, R - col("price").x, h, "F"); }
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.rect(col("price").x, y, R - col("price").x, h);
    doc.line(col("amount").x, y, col("amount").x, y + h);
    if (words) { size(12); bold(false); color(GRAY); doc.text(words, (L + col("price").x) / 2, y + 5.2, { align: "center" }); }
    size(13.5); bold(true); color(SLATE);
    doc.text(label, col("amount").x - 2, y + 5.2, { align: "right" });
    bold(strong); size(strong ? 15 : 14);
    doc.text(fmtMoney(value), R - 2, y + 5.2, { align: "right" });
    bold(false);
    y += h;
  };
  if (r.vatRate) sumRow("รวมก่อน VAT", r.estSubtotal);
  if (r.vatRate) sumRow(`VAT ${r.vatRate}%`, r.estTotal - r.estSubtotal);
  sumRow("ยอดประมาณการรวม", r.estTotal, true, `( ${bahtText(r.estTotal)} )`);

  // ── ข้อมูลเพิ่มเติม ──────────────────────────────────────────────
  const info = (label, text) => {
    if (!text) return;
    size(12.5);
    const lines = wrapText(doc, spaceThaiLatin(text), R - L - doc.getTextWidth(label) - 3).slice(0, 3);
    if (y + 5.5 * lines.length + 2 > SIG_TOP - 2) { doc.addPage(); y = 16; }
    y += 5.5;
    bold(true); color(SLATE); doc.text(label, L, y);
    bold(false); color(GRAY);
    lines.forEach((ln, i) => doc.text(ln, L + doc.getTextWidth(label) + 2, y + i * 5));
    y += (lines.length - 1) * 5;
    color(SLATE);
  };
  y += 2;
  info("วัตถุประสงค์:", r.purpose);
  if (r.order?.orderedAt) {
    info("การสั่งซื้อ:", [`ร้าน ${r.order.supplier}`, r.order.poNo ? `PO ${r.order.poNo}` : "", `สั่งเมื่อ ${thaiDate(r.order.orderedAt)}`,
      r.order.expectedAt ? `กำหนดส่ง ${thaiDate(r.order.expectedAt)}` : "", r.actualTotal ? `ยอดจริง ${fmtMoney(r.actualTotal)} บาท` : ""].filter(Boolean).join(" · "));
  }
  if (r.receipts?.length) info("การรับของ:", `${prStatus(r.status).label} · รับ ${r.receipts.length} ครั้ง ล่าสุด ${thaiDate(r.receipts[r.receipts.length - 1].at)}`);
  if ((r.attachments || []).length) info("เอกสารแนบในระบบ:", `${r.attachments.length} ไฟล์`);
  if (r.note) info("หมายเหตุ:", r.note);
  if (r.status === "rejected" && r.rejectReason) info("เหตุผลที่ตีกลับ:", r.rejectReason);

  // ── ลงนาม (หน้าสุดท้าย) ──────────────────────────────────────────
  if (y > SIG_TOP - 2) { doc.addPage(); }
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(L, SIG_TOP, R, SIG_TOP);
  const boxes = [
    { role: "ผู้ขอซื้อ", name: r.requester?.name, date: r.submittedAt || r.docDate },
    { role: "ผู้ตรวจสอบ", name: r.reviewedAt ? r.reviewedBy?.name : "", date: r.reviewedAt },
    { role: "ผู้อนุมัติ", name: r.approvedAt ? r.approvedBy?.name : "", date: r.approvedAt },
    { role: "ฝ่ายจัดซื้อ", name: r.order?.orderedAt ? r.order?.by?.name : "", date: r.order?.orderedAt },
  ];
  const colW = W / boxes.length;
  boxes.forEach((b, i) => {
    const cxm = L + colW * i + colW / 2;
    const half = colW / 2 - 3;
    let yy = SIG_TOP + 11;
    size(13); bold(false); color(SLATE);
    doc.text("ลงชื่อ", cxm - half, yy);
    dotted(cxm - half + doc.getTextWidth("ลงชื่อ") + 1.2, yy + 0.8, cxm + half);
    yy += 7;
    doc.text(b.name ? `( ${b.name} )` : "( ................................ )", cxm, yy, { align: "center" });
    yy += 6; bold(true); doc.text(b.role, cxm, yy, { align: "center" });
    yy += 5.5; bold(false); size(12);
    doc.text(b.date ? `วันที่ ${thaiDate(b.date)}` : "วันที่ ......../......../..........", cxm, yy, { align: "center" });
  });

  // ── ท้ายกระดาษทุกหน้า ─────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    bold(false); size(10); color(GRAY);
    doc.text(`พิมพ์จากระบบเมื่อ ${thaiDateTime(new Date())}`, L, H_PAGE - 5);
    if (pages > 1) doc.text(`หน้า ${p}/${pages}`, W_PAGE / 2, H_PAGE - 5, { align: "center" });
    doc.text(`สถานะ: ${prStatus(r.status).label}`, R, H_PAGE - 5, { align: "right" });
  }
  doc.setProperties({ title: `ใบขอซื้อสินค้า ${r.docNo || ""}`, subject: r.subject || "", creator: ISSUER.nameEn });
  return outputDocument(doc, r.docNo || "ใบขอซื้อ", mode);
}
