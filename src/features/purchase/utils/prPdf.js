/**
 * prPdf.js — พิมพ์ใบขอซื้อสินค้า (PR) เป็น PDF A4
 *
 * ✅ ผู้ใช้แจ้ง (2 ต.ค. 2569): "ใน pdf ยังเป็นรูปแบบเดิม ไม่สวย มองยาก"
 *    เดิมเป็นแบบฟอร์มกระดาษ "ป้าย : ค่าบนเส้นประ" ตัวอักษรขนาดเดียวกันหมด + ข้อมูลสั่งซื้อเป็นบรรทัดเทาจางท้ายหน้า
 *    → ออกแบบใหม่ให้อ่านเป็นก้อน:
 *      1. หัวกระดาษบริษัท → แถบชื่อเอกสาร (ซ้าย) + กล่องเลขที่/วันที่/สถานะ (ขวา)
 *      2. กล่องข้อมูลแบบตาราง ป้ายเล็กสีเทา · ค่าตัวหนาสีเข้ม (สายตาแยกหัวข้อกับข้อมูลได้ทันที)
 *      3. ตารางสินค้า หัวตารางพื้นสีเข้มตัวขาว · แถวสลับสี · สเปกตัวเล็กใต้ชื่อสินค้า
 *      4. กล่องยอดรวมด้านขวา (ก่อน VAT · VAT · รวม) + จำนวนเงินตัวอักษรด้านซ้าย
 *      5. กล่องวัตถุประสงค์ / ข้อมูลการสั่งซื้อ / การรับของ — มีหัวข้อชัด
 *      6. ช่องลงนาม 4 กล่องมีกรอบ (หัวกล่องบอกบทบาท) + ลายเซ็นอิเล็กทรอนิกส์
 * ✅ รายการเยอะขึ้นหน้าใหม่อัตโนมัติ (หัวตารางซ้ำ) — ช่องลงนามอยู่หน้าสุดท้ายเสมอ (ห้ามตัดรายการทิ้ง)
 * ⚠️ jsPDF + ฟอนต์ไทยโหลดแบบ dynamic เฉพาะตอนกดพิมพ์
 */
import { ISSUER, drawLetterhead, outputDocument, spaceThaiLatin, preparePrintAssets } from "@/features/documents/utils/deliveryNotePdf";
import { loadBoldFont, newDoc, wrapText } from "@/features/expenses/utils/expensePdf";
import { bahtText } from "@/features/expenses/expenseMeta";
import { thaiDate, thaiDateFull, thaiDateTime } from "@/shared/utils/thaiDate";
import { prStatus, priorityMeta, fmtMoney, fmtQty, prJobText, categoryLabel, fileKindLabel } from "../prMeta";

const W_PAGE = 210;
const H_PAGE = 297;
const L = 14;
const R = W_PAGE - 14;
const W = R - L;
const SIG_H = 38;
const SIG_TOP = H_PAGE - 12 - SIG_H;
const BODY_LIMIT = H_PAGE - 16;

const INK = [15, 23, 42];
const SUB = [100, 116, 139];
const FAINT = [148, 163, 184];
const RULE = [226, 232, 240];
const ZEBRA = [241, 245, 249];
const LINE = [148, 163, 184];

/** วางลายเซ็นอิเล็กทรอนิกส์บนเส้นลงชื่อ — รูปเสียต้องไม่ทำให้พิมพ์ไม่ได้ */
const drawSignatureImage = (doc, seal, { centerX, lineY, maxW, maxH }) => {
  if (!seal?.image) return false;
  try {
    const props = doc.getImageProperties(seal.image);
    const ratio = props.height / props.width || 0.35;
    let w = maxW; let h = w * ratio;
    if (h > maxH) { h = maxH; w = h / ratio; }
    doc.addImage(seal.image, "PNG", centerX - w / 2, lineY - h - 0.6, w, h, undefined, "MEDIUM");
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {object} opts.request     ใบขอซื้อจาก GET /api/purchase/:id
 * @param {object} [opts.signatures] { requester, reviewer, approver, purchaser } จาก GET /api/purchase/:id/signatures
 */
export async function generatePrPdf({ request: r, signatures = null, mode = "open" }) {
  const [{ jsPDF }, fontModule, boldFont] = await Promise.all([import("jspdf"), import("@/assets/fonts/THSarabunNew_base64"), loadBoldFont()]);
  await preparePrintAssets();
  const doc = newDoc(jsPDF, fontModule.default, boldFont);
  const hasBold = Boolean(boldFont);
  const bold = (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal");
  const size = (pt) => doc.setFontSize(pt);
  const color = (rgb) => doc.setTextColor(...rgb);
  const T = (t) => spaceThaiLatin(String(t ?? ""));
  const st = prStatus(r.status);
  const pr = priorityMeta(r.priority);

  // ✅ ผู้ใช้แจ้ง (2 ต.ค. 2569): "ใบมันรก และฉูดฉาดเกินไป" — โทนขาว-ดำ-เทาแบบเอกสารราชการ/บัญชี
  //    ไม่มีแถบสีทึบ ไม่มีป้ายสี ไม่มีแถวสลับสี · ใช้เส้นบางและขนาดตัวอักษรแบ่งลำดับความสำคัญแทนสี
  //    สถานะไปอยู่ท้ายกระดาษ (ตัวเล็ก) — เอกสารที่พิมพ์ออกไปไม่ต้องตะโกนสถานะ

  // ── 1. หัวกระดาษ + ชื่อเอกสาร ─────────────────────────────────────────
  doc.setFontSize(17);
  let y = drawLetterhead(doc) + 3.5;
  doc.setDrawColor(...INK); doc.setLineWidth(0.4);
  doc.line(L, y, R, y);
  y += 9;
  color(INK); bold(true); size(20);
  doc.text("ใบขอซื้อสินค้า", W_PAGE / 2, y, { align: "center" });
  bold(false); size(11); color(SUB);
  doc.text("PURCHASE REQUISITION", W_PAGE / 2, y + 5, { align: "center" });
  // เลขที่ / วันที่ ชิดขวา (ข้อความธรรมดา ไม่มีกล่อง)
  const kvRight = (label, value, yy) => {
    size(12.5); bold(false); color(SUB);
    doc.text(label, R - 46, yy);
    bold(true); color(INK);
    doc.text(value, R, yy, { align: "right" });
  };
  kvRight("เลขที่", r.docNo || "-", y - 4);
  kvRight("วันที่", thaiDate(r.docDate), y + 1.5);
  y += 10;

  // ── 2. ข้อมูลการขอซื้อ (ตารางเส้นบาง ป้ายเล็ก · ค่าตัวปกติ) ──────────
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
  // ✅ ช่องมาตรฐานของแบบฟอร์ม PR ทั่วไป (ผู้ใช้สั่ง "ข้อมูลครบถ้วน และมืออาชีพ ที่ใช้ทั่วไป"):
  //    ผู้ขอ/ตำแหน่ง-ฝ่าย/โทร · วันที่ต้องการ/ความเร่งด่วน/ประเภทการซื้อ · เรื่อง · งาน(ศูนย์ต้นทุน)/สถานที่ส่ง · ผู้รับของ/ร้านค้าแนะนำ
  const req = r.requester || {};
  infoRow([
    { label: "ผู้ขอซื้อ", value: signatures?.requester?.name || req.name, w: 1.2 },
    { label: "ตำแหน่ง / ฝ่าย", value: [req.position, req.department].filter(Boolean).join(" · ") || "-", w: 1.2 },
    { label: "โทรศัพท์", value: req.phone || "-", w: 0.8 },
  ]);
  infoRow([
    { label: "ต้องการใช้ภายใน", value: r.neededBy ? thaiDateFull(r.neededBy) : "ไม่ระบุ", w: 1.2 },
    { label: "ความเร่งด่วน", value: pr.label, w: 0.8 },
    { label: "ประเภทการซื้อ", value: categoryLabel(r.category), w: 1.2 },
  ]);
  infoRow([{ label: "เรื่อง", value: r.subject }]);
  infoRow([
    { label: "ใช้กับงาน / โครงการ", value: r.eventId ? `${prJobText(r.job)}${r.job?.docNo ? ` (${r.job.docNo})` : ""}` : "ไม่ผูกงาน (ค่าใช้จ่ายทั่วไป)", w: 1.6 },
    { label: "สถานที่ส่งของ", value: r.deliverTo || "-", w: 1.6 },
  ]);
  infoRow([
    { label: "ผู้รับของ / โทร", value: [r.contactName || (r.contactPhone ? "" : req.name), r.contactPhone].filter(Boolean).join(" · ") || "-", w: 1.6 },
    { label: "ร้านค้าที่แนะนำ", value: r.suggestedSupplier || "-", w: 1.6 },
  ]);
  doc.setDrawColor(...RULE); doc.setLineWidth(0.25);
  doc.rect(L, boxTop, W, y - boxTop);
  y += 6;

  // ── 3. ตารางสินค้า (หัวเทาอ่อน · เส้นบาง) ───────────────────────────
  const cols = [{ k: "no", w: 11 }, { k: "desc", w: 0 }, { k: "qty", w: 17 }, { k: "unit", w: 17 }, { k: "price", w: 27 }, { k: "amount", w: 30 }];
  cols[1].w = W - cols.reduce((sum, c) => sum + c.w, 0);
  let cx = L; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const col = (k) => cols.find((c) => c.k === k);
  const HEAD_TXT = { no: "ลำดับ", desc: "รายการ / ยี่ห้อ / รุ่น / สเปก", qty: "จำนวน", unit: "หน่วย", price: "ราคา/หน่วย", amount: "จำนวนเงิน" };
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
  (r.items || []).forEach((it, idx) => {
    size(13.5); bold(false);
    const descLines = wrapText(doc, T(it.description), col("desc").w - 4);
    size(11.5);
    const subLines = [[it.code ? `รหัส ${it.code}` : "", it.spec].filter(Boolean).join(" · "), it.note ? `หมายเหตุ: ${it.note}` : ""].filter(Boolean).flatMap((t) => wrapText(doc, T(t), col("desc").w - 4));
    const rh = Math.max(8.5, 3.5 + descLines.length * 5.4 + subLines.length * 4.5);
    if (y + rh > BODY_LIMIT) { closeTable(); doc.addPage(); y = 16; tableTop = y; drawHead(); }
    const base = y + 5.6;
    size(13.5); color(INK);
    doc.text(String(idx + 1), col("no").x + col("no").w / 2, base, { align: "center" });
    descLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2, base + i * 5.4));
    if (subLines.length) {
      size(11.5); color(SUB);
      subLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2, base + descLines.length * 5.4 + i * 4.5 - 0.4));
      size(13.5); color(INK);
    }
    doc.text(fmtQty(it.qty), col("qty").x + col("qty").w / 2, base, { align: "center" });
    doc.text(it.unit || "-", col("unit").x + col("unit").w / 2, base, { align: "center" });
    doc.text(it.estUnitPrice ? fmtMoney(it.estUnitPrice) : "-", col("price").x + col("price").w - 2, base, { align: "right" });
    doc.text(it.estAmount ? fmtMoney(it.estAmount) : "-", col("amount").x + col("amount").w - 2, base, { align: "right" });
    y += rh;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(L, y, R, y);
  });
  closeTable();

  // ── 4. ยอดรวม — แถวต่อท้ายตาราง (ช่องป้ายกว้างตั้งแต่คอลัมน์จำนวน กันข้อความล้น) ─────
  const sumRow = (label, value, strong) => {
    const h = 7.5;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.rect(col("qty").x, y, R - col("qty").x, h);
    doc.line(col("amount").x, y, col("amount").x, y + h);
    size(13); bold(strong); color(INK);
    doc.text(label, col("amount").x - 2, y + 5.2, { align: "right" });
    size(strong ? 14 : 13.5);
    doc.text(fmtMoney(value), R - 2, y + 5.2, { align: "right" });
    y += h;
  };
  if (y + 32 > BODY_LIMIT) { doc.addPage(); y = 16; }
  const sumTop = y;
  if (r.vatRate) { sumRow("รวมก่อน VAT", r.estSubtotal); sumRow(`VAT ${r.vatRate}%`, r.estTotal - r.estSubtotal); }
  sumRow("ยอดประมาณการรวม", r.estTotal, true);
  if (r.actualTotal) sumRow("ยอดสั่งซื้อจริง", r.actualTotal);
  bold(false); size(12.5); color(SUB);
  wrapText(doc, T(`( ${bahtText(r.estTotal)} )`), col("qty").x - L - 4).slice(0, 3)
    .forEach((ln, i) => doc.text(ln, L + 2, sumTop + 5.2 + i * 5));
  y += 6;

  // ── 5. ข้อมูลเพิ่มเติม — หัวข้อตัวหนาเล็ก + ข้อความ (ไม่มีกล่อง/แถบสี) ─────
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
  section("วัตถุประสงค์ / เหตุผลการซื้อ", [r.purpose && ["", r.purpose]]);
  if (r.order?.orderedAt) {
    section("ข้อมูลการสั่งซื้อ", [
      ["ร้านค้า", `${r.order.supplier}${r.order.supplierContact ? ` (${r.order.supplierContact})` : ""}`],
      ["เลขที่ PO", `${r.order.poNo || "-"} · สั่งเมื่อ ${thaiDate(r.order.orderedAt)}${r.order.expectedAt ? ` · กำหนดส่ง ${thaiDate(r.order.expectedAt)}` : ""}`],
      r.order.note && ["หมายเหตุ", r.order.note],
    ]);
  }
  if (r.receipts?.length) {
    section("การรับของ", r.receipts.map((rc) => [thaiDate(rc.at), `${rc.lines.map((l) => `${l.description} (${fmtQty(l.qty)})`).join(", ")} · รับโดย ${rc.by?.name || "-"}${rc.note ? ` · ${rc.note}` : ""}`]));
  }
  // เอกสารแนบ — นับตามชนิด (ผู้ตรวจสอบรู้ว่ามีใบเสนอราคาเทียบกี่ฉบับ โดยไม่ต้องเปิดระบบ)
  const kinds = new Map();
  (r.attachments || []).forEach((f) => kinds.set(f.kind, (kinds.get(f.kind) || 0) + 1));
  section("เอกสารแนบ", [kinds.size && ["", [...kinds].map(([k, n]) => `${fileKindLabel(k)} ${n} ไฟล์`).join(" · ")]]);
  section("หมายเหตุ", [
    r.note && ["", r.note],
    r.status === "rejected" && r.rejectReason && ["เหตุผลที่ตีกลับ", r.rejectReason],
    r.status === "cancelled" && ["ยกเลิกใบ", `${r.cancelReason || "ไม่ระบุเหตุผล"}${r.cancelledBy?.name ? ` · โดย ${r.cancelledBy.name}` : ""}${r.cancelledAt ? ` · ${thaiDate(r.cancelledAt)}` : ""}`],
  ]);

  // ── 6. ลงนาม 4 ช่อง (ไม่มีกรอบ — เส้นลงชื่อ · ชื่อ · บทบาท · วันที่) ─────
  if (y > SIG_TOP - 2) doc.addPage();
  const sig = signatures || {};
  const boxes = [
    { role: "ผู้ขอซื้อ", name: sig.requester?.name || r.requester?.name, date: r.submittedAt || r.docDate, seal: sig.requester },
    { role: "ผู้ตรวจสอบ", name: r.reviewedAt ? sig.reviewer?.name || r.reviewedBy?.name : "", date: r.reviewedAt, seal: r.reviewedAt ? sig.reviewer : null },
    { role: "ผู้อนุมัติ", name: r.approvedAt ? sig.approver?.name || r.approvedBy?.name : "", date: r.approvedAt, seal: r.approvedAt ? sig.approver : null },
    { role: "ฝ่ายจัดซื้อ", name: r.order?.orderedAt ? sig.purchaser?.name || r.order?.by?.name : "", date: r.order?.orderedAt, seal: r.order?.orderedAt ? sig.purchaser : null },
  ];
  const colW = W / boxes.length;
  boxes.forEach((b, i) => {
    const cxm = L + colW * i + colW / 2;
    const half = colW / 2 - 5;
    const lineY = SIG_TOP + 16;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
    doc.line(cxm - half, lineY, cxm + half, lineY);
    const signed = drawSignatureImage(doc, b.seal, { centerX: cxm, lineY, maxW: half * 2 - 4, maxH: 12 });
    size(12.5); bold(false); color(INK);
    doc.text(b.name ? `( ${T(b.name)} )` : "(                                   )", cxm, lineY + 5.5, { align: "center" });
    bold(true);
    doc.text(b.role, cxm, lineY + 11, { align: "center" });
    bold(false); size(11); color(SUB);
    doc.text(b.date ? `วันที่ ${thaiDate(b.date)}` : "วันที่ ......../......../..........", cxm, lineY + 16, { align: "center" });
    if (signed) {
      size(8.5); color(FAINT);
      doc.text(`ลงนามอิเล็กทรอนิกส์ ${thaiDateTime(b.seal.signedAt)}`, cxm, lineY + 20, { align: "center" });
    }
  });

  // ── ท้ายกระดาษทุกหน้า ─────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    bold(false); size(10); color(FAINT);
    doc.text(`พิมพ์จากระบบเมื่อ ${thaiDateTime(new Date())} · ${ISSUER.nameEn}`, L, H_PAGE - 5);
    doc.text(`${r.docNo || ""} · สถานะ: ${st.label}${` · หน้า ${p}/${pages}`}`, R, H_PAGE - 5, { align: "right" });
  }
  doc.setProperties({ title: `ใบขอซื้อสินค้า ${r.docNo || ""}`, subject: r.subject || "", creator: ISSUER.nameEn });
  return outputDocument(doc, r.docNo || "ใบขอซื้อ", mode);
}
