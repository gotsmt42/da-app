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
import { prStatus, priorityMeta, fmtMoney, fmtQty, prJobText } from "../prMeta";

const W_PAGE = 210;
const H_PAGE = 297;
const L = 14;
const R = W_PAGE - 14;
const W = R - L;
const SIG_H = 40;
const SIG_TOP = H_PAGE - 12 - SIG_H;
const BODY_LIMIT = H_PAGE - 16;

const INK = [15, 23, 42];
const SUB = [100, 116, 139];
const FAINT = [148, 163, 184];
const RULE = [226, 232, 240];
const ZEBRA = [248, 250, 252];
const MAIN = [55, 48, 163];
const MAIN_SOFT = [238, 242, 255];

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16));

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

  // ── 1. หัวกระดาษ + แถบชื่อเอกสาร ─────────────────────────────────────
  doc.setFontSize(17);
  let y = drawLetterhead(doc) + 3;
  const bandH = 17;
  doc.setFillColor(...MAIN);
  doc.roundedRect(L, y, W, bandH, 2.5, 2.5, "F");
  color([255, 255, 255]);
  bold(true); size(22);
  doc.text("ใบขอซื้อสินค้า", L + 5, y + 8.6);
  bold(false); size(11.5);
  doc.text("PURCHASE REQUISITION (PR)", L + 5, y + 13.6);
  // กล่องเลขที่/วันที่ด้านขวาในแถบ
  const infoW = 70;
  const ix = R - infoW - 3;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(ix, y + 2.5, infoW, bandH - 5, 1.8, 1.8, "F");
  color(SUB); size(10.5);
  doc.text("เลขที่", ix + 3, y + 7.2);
  doc.text("วันที่", ix + 3, y + 12.6);
  color(INK); bold(true); size(13.5);
  doc.text(r.docNo || "-", ix + infoW - 3, y + 7.4, { align: "right" });
  bold(false); size(12.5);
  doc.text(thaiDateFull(r.docDate), ix + infoW - 3, y + 12.8, { align: "right" });
  y += bandH + 4;

  // ── ป้ายสถานะ/ความเร่งด่วน ───────────────────────────────────────────
  const pill = (text, fill, ink, x) => {
    size(11); bold(true);
    const w = doc.getTextWidth(text) + 6;
    doc.setFillColor(...fill);
    doc.roundedRect(x, y, w, 6, 3, 3, "F");
    color(ink);
    doc.text(text, x + w / 2, y + 4.2, { align: "center" });
    return x + w + 2;
  };
  let px = L;
  px = pill(`สถานะ: ${st.label}`, hexRgb(st.bg), hexRgb(st.color), px);
  if (r.priority && r.priority !== "normal") pill(`ความเร่งด่วน: ${pr.label}`, r.priority === "critical" ? [185, 28, 28] : [180, 83, 9], [255, 255, 255], px);
  y += 9;

  // ── 2. กล่องข้อมูล (ป้ายเล็กเทา · ค่าตัวหนา) ────────────────────────
  /** แถวของช่องข้อมูล — cells: [{ label, value, w (สัดส่วน) }] คืนความสูงที่ใช้ */
  const infoRow = (cells, { top = false } = {}) => {
    const total = cells.reduce((s, c) => s + (c.w || 1), 0);
    size(13.5); bold(true);
    const layout = cells.map((c) => {
      const cw = (W * (c.w || 1)) / total;
      const lines = wrapText(doc, T(c.value || "-"), cw - 6).slice(0, 3);
      return { ...c, cw, lines };
    });
    const h = 6.6 + Math.max(...layout.map((c) => c.lines.length)) * 5.6;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.3);
    if (top) doc.line(L, y, R, y);
    let x = L;
    layout.forEach((c, i) => {
      if (i) doc.line(x, y, x, y + h);
      size(10.5); bold(false); color(SUB);
      doc.text(c.label, x + 3, y + 4.4);
      size(13.5); bold(true); color(c.color || INK);
      c.lines.forEach((ln, j) => doc.text(ln, x + 3, y + 9.6 + j * 5.6));
      x += c.cw;
    });
    doc.line(L, y + h, R, y + h);
    y += h;
  };
  const boxTop = y;
  infoRow([{ label: "ผู้ขอซื้อ", value: signatures?.requester?.name || r.requester?.name, w: 1.2 }, { label: "ตำแหน่ง", value: r.requester?.position, w: 1 }, { label: "ต้องการใช้ภายใน", value: r.neededBy ? thaiDateFull(r.neededBy) : "ไม่ระบุ", w: 1 }], { top: true });
  infoRow([{ label: "เรื่อง", value: r.subject }]);
  infoRow([
    { label: "ใช้กับงาน / โครงการ", value: r.eventId ? `${prJobText(r.job)}${r.job?.docNo ? ` (${r.job.docNo})` : ""}` : "ไม่ผูกงาน", w: 2 },
    { label: "สถานที่ส่งของ", value: r.deliverTo || "-", w: 1.2 },
  ]);
  if (r.suggestedSupplier) infoRow([{ label: "ร้านค้าที่แนะนำ", value: r.suggestedSupplier }]);
  // กรอบรอบกล่องข้อมูล
  doc.setDrawColor(...RULE); doc.setLineWidth(0.3);
  doc.roundedRect(L, boxTop, W, y - boxTop, 1.5, 1.5);
  y += 5;

  // ── 3. ตารางสินค้า ────────────────────────────────────────────────
  const cols = [{ k: "no", w: 11 }, { k: "desc", w: 0 }, { k: "qty", w: 17 }, { k: "unit", w: 17 }, { k: "price", w: 27 }, { k: "amount", w: 30 }];
  cols[1].w = W - cols.reduce((s, c) => s + c.w, 0);
  let cx = L; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const col = (k) => cols.find((c) => c.k === k);
  const HEAD_TXT = { no: "#", desc: "รายการสินค้า / ยี่ห้อ / รุ่น / สเปก", qty: "จำนวน", unit: "หน่วย", price: "ราคา/หน่วย", amount: "จำนวนเงิน" };
  const drawHead = () => {
    const h = 8.5;
    doc.setFillColor(...INK);
    doc.rect(L, y, W, h, "F");
    size(12.5); bold(true); color([255, 255, 255]);
    cols.forEach((c) => {
      const al = ["price", "amount"].includes(c.k) ? "right" : c.k === "desc" ? "left" : "center";
      const tx = al === "right" ? c.x + c.w - 2.5 : al === "left" ? c.x + 2.5 : c.x + c.w / 2;
      doc.text(HEAD_TXT[c.k], tx, y + 5.8, { align: al });
    });
    y += h;
  };
  drawHead();
  (r.items || []).forEach((it, idx) => {
    size(13.5); bold(true);
    const descLines = wrapText(doc, T(it.description), col("desc").w - 5);
    size(11.5); bold(false);
    const subLines = [it.spec, it.note ? `หมายเหตุ: ${it.note}` : ""].filter(Boolean).flatMap((t) => wrapText(doc, T(t), col("desc").w - 5));
    const rh = Math.max(9, 4 + descLines.length * 5.4 + subLines.length * 4.5);
    if (y + rh > BODY_LIMIT) { doc.addPage(); y = 16; drawHead(); }
    if (idx % 2 === 1) { doc.setFillColor(...ZEBRA); doc.rect(L, y, W, rh, "F"); }
    const base = y + 5.8;
    size(13); bold(false); color(SUB);
    doc.text(String(idx + 1), col("no").x + col("no").w / 2, base, { align: "center" });
    size(13.5); bold(true); color(INK);
    descLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2.5, base + i * 5.4));
    if (subLines.length) {
      size(11.5); bold(false); color(SUB);
      subLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2.5, base + descLines.length * 5.4 + i * 4.5 - 0.4));
    }
    size(13.5); bold(false); color(INK);
    doc.text(fmtQty(it.qty), col("qty").x + col("qty").w / 2, base, { align: "center" });
    doc.text(it.unit || "-", col("unit").x + col("unit").w / 2, base, { align: "center" });
    doc.text(it.estUnitPrice ? fmtMoney(it.estUnitPrice) : "-", col("price").x + col("price").w - 2.5, base, { align: "right" });
    bold(true);
    doc.text(it.estAmount ? fmtMoney(it.estAmount) : "-", col("amount").x + col("amount").w - 2.5, base, { align: "right" });
    y += rh;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.25); doc.line(L, y, R, y);
  });

  // ── 4. ยอดรวม (ขวา) + ตัวอักษร (ซ้าย) ─────────────────────────────
  const totalsW = 78;
  const tx0 = R - totalsW;
  const lines = [
    ...(r.vatRate ? [["รวมก่อน VAT", r.estSubtotal], [`VAT ${r.vatRate}%`, r.estTotal - r.estSubtotal]] : []),
    ["ยอดประมาณการรวม", r.estTotal, true],
    ...(r.actualTotal ? [["ยอดสั่งซื้อจริง", r.actualTotal, false, true]] : []),
  ];
  if (y + 6 + lines.length * 8 > BODY_LIMIT) { doc.addPage(); y = 16; }
  y += 3;
  const totalsTop = y;
  lines.forEach(([label, val, strong, actual]) => {
    const h = strong ? 9 : 7.5;
    if (strong) { doc.setFillColor(...MAIN); doc.roundedRect(tx0, y, totalsW, h, 1.5, 1.5, "F"); }
    color(strong ? [255, 255, 255] : actual ? MAIN : SUB); bold(strong || actual); size(strong ? 13.5 : 12.5);
    doc.text(label, tx0 + 3, y + h / 2 + 1.5);
    size(strong ? 15.5 : 13.5); bold(true);
    doc.text(fmtMoney(val), R - 3, y + h / 2 + 1.6, { align: "right" });
    y += h + (strong ? 1 : 0);
  });
  // จำนวนเงินตัวอักษร — กล่องอ่อนด้านซ้าย
  doc.setFillColor(...MAIN_SOFT);
  doc.roundedRect(L, totalsTop, tx0 - L - 4, 9, 1.5, 1.5, "F");
  size(12.5); bold(true); color(MAIN);
  doc.text(T(`( ${bahtText(r.estTotal)} )`), L + (tx0 - L - 4) / 2, totalsTop + 6, { align: "center" });
  y = Math.max(y, totalsTop + 9) + 5;

  // ── 5. กล่องข้อมูลเพิ่มเติม (มีหัวข้อ) ────────────────────────────
  const section = (title, rows) => {
    const content = rows.filter(Boolean);
    if (!content.length) return;
    size(12.5);
    const wrapped = content.flatMap(([label, text]) => {
      const lw = label ? doc.getTextWidth(label) + 3 : 0;
      return wrapText(doc, T(text), W - 8 - lw).slice(0, 4).map((ln, i) => ({ label: i === 0 ? label : "", lw, ln }));
    });
    const h = 9.5 + wrapped.length * 5.6;
    if (y + h > SIG_TOP - 3 && y + h > BODY_LIMIT) { doc.addPage(); y = 16; }
    doc.setDrawColor(...RULE); doc.setLineWidth(0.3);
    doc.roundedRect(L, y, W, h, 1.5, 1.5);
    doc.setFillColor(...MAIN); doc.rect(L, y + 1.5, 1.2, h - 3, "F");
    size(12); bold(true); color(MAIN);
    doc.text(title, L + 4, y + 5.4);
    let yy = y + 11.6;
    wrapped.forEach(({ label, lw, ln }) => {
      size(12.5);
      if (label) { bold(true); color(INK); doc.text(label, L + 4, yy); }
      bold(false); color([51, 65, 85]);
      doc.text(ln, L + 4 + lw, yy);
      yy += 5.6;
    });
    y += h + 3;
  };
  section("วัตถุประสงค์ / เหตุผลการซื้อ", [r.purpose && ["", r.purpose]]);
  if (r.order?.orderedAt) {
    section("ข้อมูลการสั่งซื้อ (ฝ่ายจัดซื้อ)", [
      ["ร้านค้า:", `${r.order.supplier}${r.order.supplierContact ? ` · ${r.order.supplierContact}` : ""}`],
      ["เลขที่ PO:", `${r.order.poNo || "-"} · สั่งเมื่อ ${thaiDate(r.order.orderedAt)}${r.order.expectedAt ? ` · กำหนดส่ง ${thaiDate(r.order.expectedAt)}` : ""}`],
      r.order.note && ["หมายเหตุ:", r.order.note],
    ]);
  }
  if (r.receipts?.length) {
    section("การรับของ", r.receipts.map((rc) => [`${thaiDate(rc.at)}:`, `${rc.lines.map((l) => `${l.description} ${fmtQty(l.qty)}`).join(" · ")} · รับโดย ${rc.by?.name || "-"}${rc.note ? ` · ${rc.note}` : ""}`]));
  }
  section("หมายเหตุ", [r.note && ["", r.note], r.status === "rejected" && r.rejectReason && ["เหตุผลที่ตีกลับ:", r.rejectReason], (r.attachments || []).length > 0 && ["เอกสารแนบในระบบ:", `${r.attachments.length} ไฟล์`]]);

  // ── 6. ลงนาม 4 กล่อง (หน้าสุดท้าย) ───────────────────────────────
  if (y > SIG_TOP - 2) doc.addPage();
  const sig = signatures || {};
  const boxes = [
    { role: "ผู้ขอซื้อ", name: sig.requester?.name || r.requester?.name, date: r.submittedAt || r.docDate, seal: sig.requester },
    { role: "ผู้ตรวจสอบ", name: r.reviewedAt ? sig.reviewer?.name || r.reviewedBy?.name : "", date: r.reviewedAt, seal: r.reviewedAt ? sig.reviewer : null },
    { role: "ผู้อนุมัติ", name: r.approvedAt ? sig.approver?.name || r.approvedBy?.name : "", date: r.approvedAt, seal: r.approvedAt ? sig.approver : null },
    { role: "ฝ่ายจัดซื้อ", name: r.order?.orderedAt ? sig.purchaser?.name || r.order?.by?.name : "", date: r.order?.orderedAt, seal: r.order?.orderedAt ? sig.purchaser : null },
  ];
  const gap = 3;
  const bw = (W - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach((b, i) => {
    const bx = L + i * (bw + gap);
    const by = SIG_TOP;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, bw, SIG_H, 1.8, 1.8);
    doc.setFillColor(...MAIN_SOFT);
    doc.roundedRect(bx, by, bw, 7, 1.8, 1.8, "F");
    doc.rect(bx, by + 4, bw, 3, "F");
    size(12); bold(true); color(MAIN);
    doc.text(b.role, bx + bw / 2, by + 5, { align: "center" });
    const lineY = by + 22;
    doc.setDrawColor(...FAINT); doc.setLineWidth(0.2); doc.setLineDashPattern([0.6, 0.8], 0);
    doc.line(bx + 5, lineY, bx + bw - 5, lineY);
    doc.setLineDashPattern([], 0);
    const signed = drawSignatureImage(doc, b.seal, { centerX: bx + bw / 2, lineY, maxW: bw - 12, maxH: 12 });
    size(12.5); bold(Boolean(b.name)); color(b.name ? INK : FAINT);
    doc.text(b.name ? `( ${T(b.name)} )` : "( ............................ )", bx + bw / 2, lineY + 5.4, { align: "center" });
    size(11); bold(false); color(SUB);
    doc.text(b.date ? `วันที่ ${thaiDate(b.date)}` : "วันที่ ....../....../........", bx + bw / 2, lineY + 10.4, { align: "center" });
    if (signed) {
      size(8.5); color(FAINT);
      doc.text(`ลงนามอิเล็กทรอนิกส์ ${thaiDateTime(b.seal.signedAt)}`, bx + bw / 2, lineY + 14.6, { align: "center" });
    }
  });

  // ── ท้ายกระดาษทุกหน้า ─────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    bold(false); size(10); color(FAINT);
    doc.text(`พิมพ์จากระบบเมื่อ ${thaiDateTime(new Date())} · ${ISSUER.nameEn}`, L, H_PAGE - 5);
    doc.text(`${r.docNo || ""}${pages > 1 ? ` · หน้า ${p}/${pages}` : ""}`, R, H_PAGE - 5, { align: "right" });
  }
  doc.setProperties({ title: `ใบขอซื้อสินค้า ${r.docNo || ""}`, subject: r.subject || "", creator: ISSUER.nameEn });
  return outputDocument(doc, r.docNo || "ใบขอซื้อ", mode);
}
