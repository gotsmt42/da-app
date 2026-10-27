/**
 * stockPdf.js — พิมพ์ใบเบิกของ (SR) เป็น PDF A4
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ใบเบิกทำให้สวยงาม ทันสมัย รายละเอียดครบ และสามารถทำเป็นเอกสาร PDF ออกมาได้ด้วย")
 *    รูปแบบเดียวกับใบขอซื้อ (prPdf.js) — โทนขาว-ดำ-เทา เส้นบาง:
 *      หัวกระดาษบริษัท → ชื่อเอกสาร + เลขที่/วันที่ → กล่องข้อมูล → ตารางรายการ → หมายเหตุ/ประวัติ → ช่องลงนาม 3 ช่อง
 * ✅ รายการเยอะขึ้นหน้าใหม่อัตโนมัติ (หัวตารางซ้ำ) — ช่องลงนามอยู่หน้าสุดท้ายเสมอ
 * ⚠️ jsPDF + ฟอนต์ไทยโหลดแบบ dynamic เฉพาะตอนกดพิมพ์
 */
import { ISSUER, drawLetterhead, outputDocument, spaceThaiLatin, preparePrintAssets } from "@/features/documents/utils/deliveryNotePdf";
import { loadBoldFont, newDoc, wrapText } from "@/features/expenses/utils/expensePdf";
import { thaiDate, thaiDateFull, thaiDateTime } from "@/shared/utils/thaiDate";
import { reqStatus, kindMeta, outstanding, fmt } from "../stockMeta";

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

/**
 * @param {object} opts.request  ใบเบิกจาก GET /api/stock/requests/:id
 * @param {string} [opts.deptLabel] ชื่อแผนก/คลัง
 */
export async function generateStockPdf({ request: r, deptLabel = "", mode = "open" }) {
  const [{ jsPDF }, fontModule, boldFont] = await Promise.all([import("jspdf"), import("@/assets/fonts/THSarabunNew_base64"), loadBoldFont()]);
  await preparePrintAssets();
  const doc = newDoc(jsPDF, fontModule.default, boldFont);
  const hasBold = Boolean(boldFont);
  const bold = (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal");
  const size = (pt) => doc.setFontSize(pt);
  const color = (rgb) => doc.setTextColor(...rgb);
  const T = (t) => spaceThaiLatin(String(t ?? ""));
  const st = reqStatus(r.status);
  const hasAsset = (r.lines || []).some((l) => l.kind === "asset");
  const left = outstanding(r);

  // ── 1. หัวกระดาษ + ชื่อเอกสาร ─────────────────────────────────────────
  doc.setFontSize(17);
  let y = drawLetterhead(doc) + 3.5;
  doc.setDrawColor(...INK); doc.setLineWidth(0.4);
  doc.line(L, y, R, y);
  y += 9;
  color(INK); bold(true); size(20);
  doc.text(hasAsset ? "ใบเบิก / ยืมของ" : "ใบเบิกของ", W_PAGE / 2, y, { align: "center" });
  bold(false); size(11); color(SUB);
  doc.text("STOCK REQUISITION", W_PAGE / 2, y + 5, { align: "center" });
  const kvRight = (label, value, yy) => {
    size(12.5); bold(false); color(SUB);
    doc.text(label, R - 46, yy);
    bold(true); color(INK);
    doc.text(value, R, yy, { align: "right" });
  };
  kvRight("เลขที่", r.docNo || "-", y - 4);
  kvRight("วันที่", thaiDate(r.createdAt), y + 1.5);
  y += 10;

  // ── 2. ข้อมูลใบเบิก ───────────────────────────────────────────────────
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
  const req = r.requester || {};
  infoRow([
    { label: "ผู้เบิก", value: req.name, w: 1.2 },
    { label: "ตำแหน่ง", value: req.position || "-", w: 1.1 },
    { label: "คลัง / แผนก", value: deptLabel || r.dept, w: 0.9 },
  ]);
  infoRow([{ label: "ใช้กับงาน / โครงการ", value: r.jobTitle || "-" }]);
  infoRow([
    { label: "สถานะ", value: left > 0 && r.status === "issued" ? `จ่ายของแล้ว · ยืมค้าง ${fmt(left)}` : st.label, w: 1.1 },
    { label: "อนุมัติ / จ่ายของ", value: r.issuedAt ? `${r.issuedBy?.name || "-"} · ${thaiDate(r.issuedAt)}` : "-", w: 1.3 },
    { label: "กำหนดคืน", value: hasAsset ? (r.dueReturnAt ? thaiDateFull(r.dueReturnAt) : "ไม่ระบุ") : "-", w: 0.9 },
  ]);
  doc.setDrawColor(...RULE); doc.setLineWidth(0.25);
  doc.rect(L, boxTop, W, y - boxTop);
  y += 6;

  // ── 3. ตารางรายการ ─────────────────────────────────────────────────────
  const cols = [{ k: "no", w: 11 }, { k: "code", w: 24 }, { k: "desc", w: 0 }, { k: "kind", w: 22 }, { k: "qty", w: 17 }, { k: "unit", w: 17 }, ...(hasAsset ? [{ k: "ret", w: 20 }] : [])];
  cols[2].w = W - cols.reduce((sum, c) => sum + c.w, 0);
  let cx = L; cols.forEach((c) => { c.x = cx; cx += c.w; });
  const col = (k) => cols.find((c) => c.k === k);
  const HEAD_TXT = { no: "ลำดับ", code: "รหัส", desc: "รายการ", kind: "ชนิด", qty: "จำนวน", unit: "หน่วย", ret: "คืนแล้ว" };
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
  (r.lines || []).forEach((l, idx) => {
    size(13.5); bold(false);
    const descLines = wrapText(doc, T(l.name), col("desc").w - 4);
    const rh = Math.max(8.5, 3.5 + descLines.length * 5.4);
    if (y + rh > BODY_LIMIT) { closeTable(); doc.addPage(); y = 16; tableTop = y; drawHead(); }
    const base = y + 5.6;
    size(13.5); color(INK);
    doc.text(String(idx + 1), col("no").x + col("no").w / 2, base, { align: "center" });
    size(12); doc.text(T(l.code || "-"), col("code").x + 2, base); size(13.5);
    descLines.forEach((ln, i) => doc.text(ln, col("desc").x + 2, base + i * 5.4));
    doc.text(kindMeta(l.kind).label, col("kind").x + col("kind").w / 2, base, { align: "center" });
    bold(true); doc.text(fmt(l.qty), col("qty").x + col("qty").w / 2, base, { align: "center" }); bold(false);
    doc.text(T(l.unit || "-"), col("unit").x + col("unit").w / 2, base, { align: "center" });
    if (hasAsset) doc.text(l.kind === "asset" ? fmt(l.returnedQty || 0) : "-", col("ret").x + col("ret").w / 2, base, { align: "center" });
    y += rh;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(L, y, R, y);
  });
  closeTable();
  size(12); bold(false); color(SUB);
  y += 5;
  doc.text(`รวม ${fmt((r.lines || []).length)} รายการ · ${fmt((r.lines || []).reduce((t, l) => t + l.qty, 0))} หน่วย`, R, y, { align: "right" });
  y += 5;

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
    r.status === "rejected" && ["เหตุผลที่ไม่อนุมัติ", `${r.rejectReason || "-"}${r.rejectedBy?.name ? ` · โดย ${r.rejectedBy.name}` : ""}`],
    r.status === "cancelled" && ["ยกเลิกใบ", `${r.cancelledBy?.name || ""}${r.cancelledAt ? ` · ${thaiDate(r.cancelledAt)}` : ""}`],
  ]);
  section("ประวัติการดำเนินการ", (r.activityLog || []).map((a) => [thaiDateTime(a.timestamp), `${a.detail} — ${a.userName}`]));

  // ── 5. ลงนาม 3 ช่อง ────────────────────────────────────────────────────
  if (y > SIG_TOP - 2) doc.addPage();
  const returnedLog = [...(r.activityLog || [])].reverse().find((a) => a.action === "returned");
  const boxes = [
    { role: "ผู้เบิก", name: req.name, date: r.createdAt },
    { role: "ผู้อนุมัติ / จ่ายของ", name: r.issuedBy?.name, date: r.issuedAt },
    hasAsset
      ? { role: "ผู้รับคืนทรัพย์สิน", name: r.status === "returned" ? returnedLog?.userName : "", date: r.status === "returned" ? returnedLog?.timestamp : null }
      : { role: "ผู้รับของ", name: r.issuedAt ? req.name : "", date: r.issuedAt },
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

  // ── ท้ายกระดาษทุกหน้า ─────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    bold(false); size(10); color(FAINT);
    doc.text(`พิมพ์จากระบบเมื่อ ${thaiDateTime(new Date())} · ${ISSUER.nameEn}`, L, H_PAGE - 5);
    doc.text(`${r.docNo || ""} · สถานะ: ${st.label} · หน้า ${p}/${pages}`, R, H_PAGE - 5, { align: "right" });
  }
  doc.setProperties({ title: `ใบเบิกของ ${r.docNo || ""}`, subject: r.jobTitle || "", creator: ISSUER.nameEn });
  return outputDocument(doc, r.docNo ? `ใบเบิกของ ${r.docNo}` : "ใบเบิกของ", mode);
}
