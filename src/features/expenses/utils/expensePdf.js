/**
 * expensePdf.js — พิมพ์ใบเบิก Advance / ใบเคลม เป็น PDF ขนาด A4 "หน้าเดียวเสมอ"
 *
 * ✅ เลย์เอาต์ยึดแบบฟอร์มกระดาษ "ใบเบิกค่าใช้จ่าย" ที่บริษัทใช้อยู่จริง: วันที่ / ถึง / ชื่อผู้เบิกเงิน /
 * ตำแหน่ง / เรื่อง / ตาราง (ลำดับ · รายการ · จำนวน/หน่วย · จำนวนเงิน) / รวมเบิกทั้งหมด / ลายเซ็น 3 ช่อง
 * (ผู้เบิกค่าใช้จ่าย · ผู้ตรวจสอบ · ผู้อนุมัติ) — คนที่เซ็นเอกสารกระดาษมาตลอดต้องเห็นแล้วคุ้นทันที
 *
 * ✅ หน้าเดียวเสมอ (ตามที่ผู้ใช้ขอ): วาดลงกระดาษทดก่อนเพื่อวัดความสูงจริง แล้วค่อยๆ ย่อ (ตัวอักษร/ความสูงแถว/
 * แถวว่างเติมตาราง/หัวกระดาษแบบย่อ) จนเนื้อหาจบก่อนถึงช่องลายเซ็น ช่องลายเซ็นถูกตรึงไว้ท้ายกระดาษเสมอ
 * ⚠️ ห้ามใช้วิธีตัดรายการทิ้ง — เอกสารการเงินที่พิมพ์ออกมาไม่ครบรายการคือเอกสารที่ผิด
 *
 * ⚠️ jsPDF + ฟอนต์ไทย (600+ kB) โหลดแบบ dynamic import เฉพาะตอนกดพิมพ์ ไม่ถ่วงการเปิดหน้ารายการ
 */
import boldFontUrl from "@/assets/fonts/THSarabunNew Bold.ttf?url";
import { ISSUER, drawLetterhead, outputDocument, spaceThaiLatin, preparePrintAssets } from "@/features/documents/utils/deliveryNotePdf";
import { thaiDateFull, thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import {
  KIND_META, slipKind, statusMeta, fmtMoney, bahtText, qtyText, differenceMeta, paymentLabel, fileKindLabel, jobText, money, itemPersonName, personFullName,
} from "../expenseMeta";
import { bankMeta, formatAccountNo } from "../bankMeta";
import { compareItems } from "./expenseCompare";

const W_PAGE = 210;
const H_PAGE = 297;
const L = 16;
const R = W_PAGE - 16;
const W = R - L;
const SIG_H = 34;
const SIG_TOP = H_PAGE - 11 - SIG_H;

let boldCache = null;
/** ฟอนต์ตัวหนา — ถ้าโหลดไม่ได้ (ออฟไลน์) ยังพิมพ์ได้ด้วยตัวปกติ ไม่ใช่พังทั้งใบ */
export const loadBoldFont = async () => {
  if (boldCache !== null) return boldCache;
  try {
    const buf = new Uint8Array(await (await fetch(boldFontUrl)).arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    boldCache = btoa(bin);
  } catch {
    boldCache = "";
  }
  return boldCache;
};

/**
 * ตัดบรรทัดภาษาไทย
 * ⚠️ ภาษาไทยไม่เว้นวรรคระหว่างคำ ก้อนยาวต้องหั่นเองทีละตัวอักษร — และห้ามหั่นก่อนสระบน/ล่าง/วรรณยุกต์
 * (อักษรประกอบ) ไม่งั้นสระจะหลุดไปอยู่ต้นบรรทัดถัดไปแบบลอยๆ อ่านไม่ออก
 */
const COMBINING = /[ัิ-ฺ็-๎]/;
export const wrapText = (doc, text, width) => {
  const lines = [];
  String(text || "").split(/\r?\n/).forEach((para) => {
    let cur = "";
    const push = () => { if (cur) lines.push(cur); cur = ""; };
    para.split(" ").filter((w) => w !== "").forEach((word) => {
      const test = cur ? `${cur} ${word}` : word;
      if (doc.getTextWidth(test) <= width) { cur = test; return; }
      if (cur && doc.getTextWidth(word) <= width) { push(); cur = word; return; }
      // ก้อนเดียวยาวเกินบรรทัด → หั่นทีละตัวอักษร (ต่อจากบรรทัดปัจจุบันเลย ไม่ทิ้งที่ว่าง)
      let piece = cur ? `${cur} ` : "";
      for (let i = 0; i < word.length; i += 1) {
        const ch = word[i];
        if (piece && !COMBINING.test(ch) && doc.getTextWidth(piece + ch) > width) {
          lines.push(piece.trimEnd());
          piece = "";
        }
        piece += ch;
      }
      cur = piece;
    });
    push();
  });
  return lines.length ? lines : [""];
};

export const newDoc = (jsPDF, font, bold) => {
  // ⚠️ compress: true — บีบฟอนต์ที่ฝัง (TH Sarabun ปกติ+ตัวหนา ~800 KB) และเนื้อหาในไฟล์
  // ดูเหตุผลเต็มที่ deliveryNotePdf.js (หัวข้อ "ขนาดไฟล์ PDF")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "A4", compress: true });
  doc.addFileToVFS("THSarabun.ttf", font);
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  if (bold) {
    doc.addFileToVFS("THSarabunBold.ttf", bold);
    doc.addFont("THSarabunBold.ttf", "THSarabun", "bold");
  }
  doc.setFont("THSarabun", "normal");
  doc.setLineHeightFactor(1.15);
  return doc;
};

/** ชุดขั้นย่อ — ลองทีละขั้นจนกว่าเนื้อหาจะจบก่อนถึงช่องลายเซ็น */
const FIT_STEPS = [
  { s: 1, compact: false, filler: 8 },
  { s: 1, compact: false, filler: 4 },
  { s: 0.94, compact: false, filler: 0 },
  { s: 0.9, compact: true, filler: 0 },
  { s: 0.82, compact: true, filler: 0 },
  { s: 0.74, compact: true, filler: 0 },
  { s: 0.66, compact: true, filler: 0 },
  { s: 0.58, compact: true, filler: 0 },
  { s: 0.5, compact: true, filler: 0 },
];

const SLATE = [15, 23, 42];
const GRAY = [100, 116, 139];
const LINE = [148, 163, 184];

/**
 * วาดเนื้อหาทั้งหมด (ยกเว้นลายเซ็น/ท้ายกระดาษ)
 * @returns {number} y ล่างสุดของเนื้อหา
 */
const renderBody = (doc, e, { s, compact, filler }, hasBold) => {
  // ⚠️ ใช้ "ชนิดที่ใช้แสดงผล" — ใบสำรองจ่ายเป็น kind = "claim" แต่ต้องได้หัวเรื่อง/สี/ป้ายของตัวเอง
  const slip = slipKind(e);
  const kind = KIND_META[slip] || KIND_META.advance;
  const bold = (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal");
  const size = (pt) => doc.setFontSize(Math.max(pt * s, 8));
  const color = (rgb) => doc.setTextColor(...rgb);
  const dotted = (x1, y1, x2) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([0.5, 0.8], 0);
    doc.line(x1, y1, x2, y1);
    doc.setLineDashPattern([], 0);
  };

  // ── หัวกระดาษ ────────────────────────────────────────────────────────
  let y;
  color(SLATE);
  if (compact) {
    y = 13;
    bold(true); size(15);
    doc.text(ISSUER.nameTh, W_PAGE / 2, y, { align: "center" });
    bold(false); size(10);
    y += 4.6 * s + 0.6;
    doc.text(`${ISSUER.address}  ${ISSUER.taxId}`, W_PAGE / 2, y, { align: "center" });
    y += 2.4;
  } else {
    doc.setFontSize(17);
    y = drawLetterhead(doc) + 2.6;
  }
  // ✅ เส้นคั่นหัวกระดาษเป็นสีประจำชนิดใบ — แยก Advance (เขียวอมฟ้า) กับ Claim (ม่วง) ได้ตั้งแต่มองไกลๆ
  const tint = kind.pdf;
  doc.setDrawColor(...tint.main);
  doc.setLineWidth(0.8);
  doc.line(L, y, R, y);

  // ── ชื่อเอกสาร + ป้ายชนิดใบ ───────────────────────────────────────────
  y += 9 * s + 1;
  bold(true); size(21); color(tint.main);
  doc.text(kind.docTitle, W_PAGE / 2, y, { align: "center" });
  {
    const k = Math.max(s, 0.8);
    doc.setFontSize(11 * k);
    const bw = doc.getTextWidth(kind.badge) + 6;
    const bh = 6 * k;
    doc.setFillColor(...tint.main);
    doc.roundedRect(R - bw, y - bh + 1.4, bw, bh, bh / 2, bh / 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(kind.badge, R - bw / 2, y - bh / 2 + 1.4 + 1.3 * k, { align: "center" });
  }
  color(SLATE);

  y += 8 * s;
  size(14);
  bold(true); doc.text("เลขที่", L, y);
  const noX = L + doc.getTextWidth("เลขที่ ") + 1;
  bold(false); doc.text(e.docNo || "-", noX, y);
  const dateText = thaiDateFull(e.docDate);
  const dateW = doc.getTextWidth(dateText);
  doc.text(dateText, R, y, { align: "right" });
  bold(true); doc.text("วันที่", R - dateW - 2, y, { align: "right" });

  // ── ช่องข้อมูล (ป้าย : ค่า บนเส้นประ แบบฟอร์มกระดาษ) ─────────────────
  const rowH = 7.4 * s;
  const field = (label, value, x1, x2, yy) => {
    size(14); bold(true);
    doc.text(label, x1, yy);
    const vx = x1 + doc.getTextWidth(label) + 2.2;
    bold(false);
    const lines = wrapText(doc, spaceThaiLatin(value || "-"), x2 - vx - 1);
    lines.forEach((ln, i) => {
      doc.text(ln, vx + 1, yy + i * rowH);
      dotted(vx, yy + i * rowH + 1.3, x2);
    });
    return lines.length;
  };

  y += rowH + 1;
  field("ถึง", e.to, L, R, y);
  y += rowH;
  const mid = L + W * 0.6;
  field("ชื่อผู้เบิกเงิน", personFullName(e.requester), L, mid - 4, y);
  field("ตำแหน่ง", e.requester?.position, mid, R, y);
  y += rowH;
  const subjLines = field("เรื่อง", e.subject, L, R, y);
  y += rowH * subjLines;
  if (e.eventId || e.job?.title) {
    field("งาน / โครงการ", `${jobText(e.job)}${e.job?.docNo ? ` (${e.job.docNo})` : ""}`, L, R, y);
    y += rowH;
  }

  const isClaim = e.kind === "claim";
  /**
   * ใบสำรองจ่ายไม่มี Advance — บนกระดาษจึงไม่มีกรอบอ้างอิง ไม่มีคอลัมน์ "ตั้งเบิก" และไม่มีบรรทัด
   * "หัก เงินเบิกล่วงหน้า" (พิมพ์เลข 0 ในช่องพวกนั้นออกไปคือเอกสารที่ชวนให้เข้าใจผิด)
   * ⚠️ แต่ยังใช้ "ผังตารางแบบใบเคลม" อยู่ เพราะต้องมีช่องเลขที่ใบเสร็จเหมือนกัน
   */
  const isReimburse = slip === "reimburse";
  const isClearClaim = isClaim && !isReimburse;
  const advDoc = e.advanceDoc || null;
  const advTint = KIND_META.advance.pdf;
  if (isClearClaim) {
    // ✅ ผู้ใช้ขอให้ใบเคลมมีรายละเอียดของ Advance "ข้างๆ" เพื่อตรวจสอบง่าย — บนกระดาษทำเป็นกรอบสีของ
    // Advance (เขียวอมฟ้า) ก่อนตาราง และในตารางมีคอลัมน์ "ตั้งเบิก" คู่กับ "ใช้จริง" ทุกบรรทัด
    const adv = { ...(e.advance || {}), ...(advDoc || {}) };
    const pay = adv.payment || {};
    const paidAt = pay.at || adv.paidAt;
    const parts = [
      `เลขที่ ${adv.docNo || "-"}`,
      adv.docDate ? `ลงวันที่ ${thaiDate(adv.docDate)}` : "",
      `ยอดเบิก ${fmtMoney(adv.total)} บาท`,
      paidAt ? `รับเงิน ${thaiDate(paidAt)}${pay.method ? ` (${paymentLabel(pay.method)}${pay.ref ? ` ${pay.ref}` : ""})` : ""}` : "",
      adv.approvedBy?.name ? `อนุมัติโดย ${personFullName(adv.approvedBy)}` : "",
    ].filter(Boolean).join("  ·  ");
    size(12.5); bold(false);
    const subjWrap = wrapText(doc, spaceThaiLatin(`เรื่อง: ${adv.subject || "-"}`), W - 8);
    const infoWrap = wrapText(doc, parts, W - 8);
    const boxH = 3.2 * s + (1 + subjWrap.length + infoWrap.length) * 5 * s;
    y += 0.8 * s;
    doc.setFillColor(...advTint.fill);
    doc.setDrawColor(...advTint.main);
    doc.setLineWidth(0.3);
    doc.roundedRect(L, y, W, boxH, 1.5, 1.5, "FD");
    doc.setFillColor(...advTint.main);
    doc.rect(L, y + 0.4, 1.4, boxH - 0.8, "F");
    let by = y + 5 * s;
    bold(true); size(13); color(advTint.main);
    doc.text("อ้างอิงใบเบิกเงินล่วงหน้า (Advance)", L + 4, by);
    bold(false); size(12.5); color(SLATE);
    [...subjWrap, ...infoWrap].forEach((ln) => { by += 5 * s; doc.text(ln, L + 4, by); });
    y += boxH + 2.2 * s;
  }

  // ── ตารางรายการ ─────────────────────────────────────────────────────
  y += 1.5 * s;
  const compare = isClaim ? compareItems(e.items || [], advDoc?.items || []) : null;
  const hasPlanned = Boolean(isClearClaim && advDoc?.items?.length);
  const cols = isClaim
    ? [
      { key: "no", w: 10 }, { key: "desc", w: 0 }, { key: "receipt", w: 22 },
      ...(hasPlanned ? [{ key: "planned", w: 25 }] : []),
      { key: "qty", w: 31 }, { key: "amount", w: 26 },
    ]
    : [{ key: "no", w: 12 }, { key: "desc", w: 0 }, { key: "qty", w: 42 }, { key: "amount", w: 34 }];
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  cols.find((c) => c.key === "desc").w = W - fixed;
  let cx = L;
  cols.forEach((c) => { c.x = cx; cx += c.w; });
  const col = (k) => cols.find((c) => c.key === k);
  const headers = isReimburse
    ? { no: "ลำดับ", desc: "รายการที่สำรองจ่าย", receipt: "เลขที่ใบเสร็จ", qty: "จำนวน / หน่วย", amount: "จำนวนเงิน (บาท)" }
    : isClaim
      ? { no: "ลำดับ", desc: "รายการค่าใช้จ่ายจริง", receipt: "เลขที่ใบเสร็จ", planned: "ตั้งเบิก (Advance)", qty: "จำนวน / หน่วย", amount: "ใช้จริง (บาท)" }
      : { no: "ลำดับ", desc: "รายการ", qty: "จำนวน / หน่วย", amount: "จำนวนเงิน (บาท)" };

  const headH = 8 * s;
  doc.setFillColor(...tint.head);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.rect(L, y, W, headH, "FD");
  if (hasPlanned) {
    // คอลัมน์ตั้งเบิกเป็นสีของ Advance — ตาเห็นทันทีว่าช่องไหนคือตัวเลขจากใบต้นทาง
    doc.setFillColor(...advTint.head);
    doc.rect(col("planned").x, y, col("planned").w, headH, "F");
  }
  size(hasPlanned ? 12.5 : 13.5); bold(true); color(SLATE);
  cols.forEach((c, i) => {
    doc.text(headers[c.key], c.x + c.w / 2, y + headH / 2 + 1.5 * s, { align: "center" });
    if (i > 0) doc.line(c.x, y, c.x, y + headH);
  });
  y += headH;
  const tableTop = y;

  const lineH = 5.5 * s;
  const detailH = 4.5 * s;
  const minRowH = 7.4 * s;
  const rows = isClaim
    ? compare.rows.map((r) => ({ ...(r.actual || r.planned || {}), description: r.description, person: r.person, detail: r.detail, receiptNo: r.receiptNo, cmp: r }))
    : (e.items || []);
  rows.forEach((it, idx) => {
    const cmp = it.cmp;
    const unused = cmp?.kind === "unused";
    const tag = cmp?.kind === "unused" ? " (ไม่ได้ใช้)" : cmp?.kind === "added" && hasPlanned ? " (รายการเพิ่ม)" : "";
    size(14); bold(false);
    // ✅ ชื่อพนักงานต่อท้ายรายการ (หัวหน้างานเบิกแทนลูกทีม) — ผู้อนุมัติ/บัญชีเห็นบนกระดาษว่าบรรทัดนี้จ่ายให้ใคร
    const person = itemPersonName(it);
    const descLines = wrapText(doc, spaceThaiLatin(`${it.description}${person ? ` (${person})` : ""}${tag}`), col("desc").w - 3.5);
    size(12);
    const detailLines = it.detail ? wrapText(doc, spaceThaiLatin(it.detail), col("desc").w - 3.5) : [];
    const rh = Math.max(minRowH, 2.6 * s + descLines.length * lineH + detailLines.length * detailH);
    const base = y + 5.1 * s;

    if (hasPlanned) {
      doc.setFillColor(...advTint.fill);
      doc.rect(col("planned").x, y, col("planned").w, rh, "F");
    }
    color(unused ? GRAY : SLATE); size(14);
    doc.text(String(idx + 1), col("no").x + col("no").w / 2, base, { align: "center" });
    descLines.forEach((ln, i) => doc.text(ln, col("desc").x + 1.8, base + i * lineH));
    if (detailLines.length) {
      size(12); color(GRAY);
      detailLines.forEach((ln, i) => doc.text(ln, col("desc").x + 1.8, base + descLines.length * lineH + i * detailH - 0.6 * s));
      size(14);
    }
    color(unused ? GRAY : SLATE);
    if (isClaim) {
      size(12.5);
      doc.text(wrapText(doc, it.receiptNo || "-", col("receipt").w - 2)[0], col("receipt").x + col("receipt").w / 2, base, { align: "center" });
      size(14);
    }
    if (hasPlanned) {
      color(advTint.main);
      doc.text(cmp.planned ? fmtMoney(cmp.plannedAmount) : "-", col("planned").x + col("planned").w - 2, base, { align: "right" });
      color(unused ? GRAY : SLATE);
    }
    doc.text(unused ? "-" : qtyText(it), col("qty").x + col("qty").w / 2, base, { align: "center" });
    doc.text(unused ? "0.00" : fmtMoney(it.amount), col("amount").x + col("amount").w - 2, base, { align: "right" });
    color(SLATE);

    y += rh;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.15);
    doc.line(L, y, R, y);
  });
  for (let i = rows.length; i < filler; i += 1) {
    if (hasPlanned) {
      doc.setFillColor(...advTint.fill);
      doc.rect(col("planned").x, y, col("planned").w, minRowH, "F");
    }
    y += minRowH;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(L, y, R, y);
  }
  if (!rows.length && !filler) {
    size(13); color(GRAY);
    doc.text("— ไม่มีรายการค่าใช้จ่าย —", L + W / 2, y + 5 * s, { align: "center" });
    color(SLATE);
    y += minRowH;
  }
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  cols.forEach((c, i) => { if (i > 0) doc.line(c.x, tableTop, c.x, y); });

  // ── แถวสรุปยอด ─────────────────────────────────────────────────────
  const amountCol = col("amount");
  /**
   * @param {string} labelFrom      คอลัมน์ที่ป้ายเริ่ม (ป้ายกินพื้นที่ตั้งแต่คอลัมน์นี้ถึงก่อนช่องจำนวนเงิน)
   * @param {number} [plannedAmount] ยอดฝั่ง Advance ที่โชว์ในช่อง "ตั้งเบิก" ของแถวนี้
   */
  const sumRow = (words, label, amount, { strong = false, fill = null, labelFrom = "qty", plannedAmount = null } = {}) => {
    const h = 8 * s;
    const withPlanned = plannedAmount !== null && hasPlanned;
    const labelX = (col(labelFrom) || col("qty")).x;
    const leftEdge = withPlanned ? col("planned").x : labelX;
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(labelX, y, R - labelX, h, "F");
    }
    if (withPlanned) {
      doc.setFillColor(...advTint.head);
      doc.rect(col("planned").x, y, col("planned").w, h, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(L, y + h, R, y + h);
    doc.line(leftEdge, y, leftEdge, y + h);
    if (withPlanned) doc.line(col("qty").x, y, col("qty").x, y + h);
    doc.line(amountCol.x, y, amountCol.x, y + h);
    const base = y + h / 2 + 1.6 * s;
    if (words) {
      size(12.5); bold(false); color(GRAY);
      const wl = wrapText(doc, words, leftEdge - L - 4);
      doc.text(wl[0], (L + leftEdge) / 2, base, { align: "center" });
    }
    if (withPlanned) {
      bold(true); size(13.5); color(advTint.main);
      doc.text(fmtMoney(plannedAmount), col("planned").x + col("planned").w - 2, base, { align: "right" });
    }
    color(SLATE); size(14); bold(true);
    doc.text(label, amountCol.x - 2, base, { align: "right" });
    bold(strong); size(strong ? 15.5 : 14.5);
    doc.text(fmtMoney(amount), R - 2, base, { align: "right" });
    bold(false);
    y += h;
  };

  const tableStart = tableTop - headH;
  if (!isClearClaim) {
    // ใบสำรองจ่ายสรุปบรรทัดเดียว = ยอดที่บริษัทต้องจ่ายคืนทั้งก้อน
    sumRow(`( ${bahtText(e.total)} )`, isReimburse ? "รวมขอเบิกคืน" : "รวมเบิกทั้งหมด", e.total, { strong: true, fill: tint.fill });
  } else {
    const d = differenceMeta(e.difference, slip);
    const advTotal = e.advance?.total || advDoc?.total || 0;
    sumRow(`( ${bahtText(e.total)} )`, "รวม", e.total, { plannedAmount: hasPlanned ? compare.plannedTotal : null, fill: tint.fill });
    sumRow("", "หัก เงินเบิกล่วงหน้า", advTotal, { labelFrom: hasPlanned ? "planned" : "receipt" });
    const diffLabel = money(e.difference) > 0 ? "บริษัทจ่ายเพิ่ม" : money(e.difference) < 0 ? "คืนบริษัท" : "ส่วนต่าง";
    sumRow(`( ${d.label}${d.amount ? ` · ${bahtText(d.amount)}` : ""} )`, diffLabel, d.amount, { strong: true, fill: tint.head, labelFrom: hasPlanned ? "planned" : "receipt" });
  }
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(L, tableStart, W, y - tableStart);

  // ── ข้อมูลประกอบ ─────────────────────────────────────────────────────
  y += 2 * s;
  const infoLine = (label, text) => {
    y += 5.6 * s;
    size(12.5); bold(true); color(SLATE);
    doc.text(label, L, y);
    const vx = L + doc.getTextWidth(label) + 2;
    bold(false); color(GRAY);
    const lines = wrapText(doc, spaceThaiLatin(text), R - vx);
    lines.slice(0, 3).forEach((ln, i) => doc.text(ln, vx, y + i * 5 * s));
    y += (Math.min(lines.length, 3) - 1) * 5 * s;
    color(SLATE);
  };

  /**
   * ✅ บัญชีรับเงินของผู้เบิก — ใบที่พิมพ์ออกไปให้ฝ่ายบัญชีต้องมีเลขบัญชีปลายทางอยู่ในเอกสารเอง
   * ไม่ใช่ต้องกลับมาเปิดในแอปหาอีกที (ใบ Advance = บัญชีที่บริษัทโอนเงินล่วงหน้าให้)
   * ✅ ผู้ใช้ขอให้ "เด่นและเข้าใจง่าย": วางเป็นกล่องมีสัญลักษณ์สีประจำธนาคาร + เลขบัญชีตัวใหญ่
   * แทนบรรทัดข้อความยาวๆ ที่กลืนไปกับหมายเหตุอื่น — คนโอนเงินต้องหาเจอในแวบเดียว
   */
  if (e.payTo?.accountNo) {
    const bank = bankMeta(e.payTo.bankCode);
    // พื้น/เส้นขอบผสมจากสีธนาคารกับขาว — กล่องจึงเป็น "สีของธนาคารนั้น" แบบอ่อนๆ เห็นแล้วรู้ทันทีว่าธนาคารไหน
    const mix = (ratio) => bank.rgb.map((c) => Math.round(c * ratio + 255 * (1 - ratio)));
    const boxH = 21 * s;
    y += 4 * s;
    doc.setFillColor(...mix(0.07));
    doc.setDrawColor(...mix(0.45));
    doc.setLineWidth(0.5);
    doc.roundedRect(L, y, W, boxH, 2.2, 2.2, "FD");

    // ป้ายสัญลักษณ์ธนาคาร (ตัวย่อบนสีประจำธนาคาร — ชุดเดียวกับที่เห็นบนหน้าจอ)
    const badge = 13 * s;
    const bx = L + 4 * s;
    const by = y + (boxH - badge) / 2;
    doc.setFillColor(...bank.rgb);
    doc.roundedRect(bx, by, badge, badge, 3, 3, "F");
    const markSize = bank.mark.length > 3 ? 10 : bank.mark.length > 2 ? 12 : bank.mark.length > 1 ? 14 : 17;
    bold(true);
    size(markSize);
    color(bank.darkText ? [31, 41, 55] : [255, 255, 255]);
    doc.text(bank.mark, bx + badge / 2, by + badge / 2 + markSize * 0.17 * s, { align: "center" });

    const tx = bx + badge + 4.5 * s;
    // บรรทัดบน: ป้ายกำกับ + ชื่อธนาคารเป็นสีของธนาคาร
    size(11.5); bold(true); color(GRAY);
    const label = spaceThaiLatin(e.kind === "advance" ? "โอนเงินเข้าบัญชีผู้เบิก" : "โอนเงินคืนเข้าบัญชีผู้เบิก");
    doc.text(label, tx, y + 6.4 * s);
    // ⚠️ ธนาคารสีอ่อน (กรุงศรี/ออมสิน) ใช้สีแบรนด์เป็นสีตัวอักษรตรงๆ แล้วอ่านไม่ออกบนพื้นขาว — หรี่ลงก่อน
    const nameRgb = bank.darkText ? bank.rgb.map((c) => Math.round(c * 0.55)) : bank.rgb;
    size(12.5); color(nameRgb);
    doc.text(spaceThaiLatin(e.payTo.bankName || bank.name), tx + doc.getTextWidth(label) + 3, y + 6.4 * s);

    // บรรทัดกลาง: เลขบัญชีตัวใหญ่ เว้นช่องไฟให้อ่านทีละกลุ่มไม่สลับตัวเลข (ตัวที่คนโอนเงินต้องอ่าน)
    size(17); bold(true); color(SLATE);
    doc.setCharSpace(0.3);
    doc.text(formatAccountNo(e.payTo.accountNo), tx, y + 13.6 * s);
    doc.setCharSpace(0);

    // บรรทัดล่าง: ชื่อบัญชี — ฝ่ายบัญชีใช้ตรวจว่าปลายทางตรงกับผู้เบิกก่อนกดโอน
    if (e.payTo.accountName) {
      size(11.5); bold(false); color(GRAY);
      doc.text(spaceThaiLatin("ชื่อบัญชี"), tx, y + 19 * s);
      const nx = tx + doc.getTextWidth(spaceThaiLatin("ชื่อบัญชี")) + 2;
      bold(true); color(SLATE);
      doc.text(wrapText(doc, spaceThaiLatin(e.payTo.accountName), R - nx - 4 * s)[0] || "", nx, y + 19 * s);
    }
    bold(false);
    color(SLATE);
    y += boxH;
  }

  const pay = e.payment || {};
  if (e.kind === "advance" && pay.at && ["paid", "clearing", "cleared"].includes(e.status)) {
    infoLine("การจ่ายเงิน:", [
      thaiDateFull(pay.at), paymentLabel(pay.method), pay.ref ? `อ้างอิง ${pay.ref}` : "",
      e.dueClearAt ? `กำหนดเคลียร์ภายใน ${thaiDateFull(e.dueClearAt)}` : "",
    ].filter(Boolean).join(" · "));
  }
  if (e.kind === "advance" && e.claimDocNo) infoLine("เคลียร์ด้วยใบเคลม:", e.claimDocNo);
  if (isReimburse && e.status === "settled" && pay.at) {
    infoLine("จ่ายคืนให้ผู้เบิก:", [
      thaiDate(pay.at),
      paymentLabel(pay.method),
      pay.ref ? `เลขที่ ${pay.ref}` : "",
      pay.by?.name ? `โดย ${pay.by.name}` : "",
    ].filter(Boolean).join("  ·  "));
  }
  if (isClearClaim && e.status === "settled" && pay.at && money(e.difference) !== 0) {
    infoLine(money(e.difference) > 0 ? "จ่ายเงินเพิ่ม:" : "รับเงินคืน:", [
      thaiDateFull(pay.at), paymentLabel(pay.method), pay.ref ? `อ้างอิง ${pay.ref}` : "",
    ].filter(Boolean).join(" · "));
  }
  const files = e.attachments || [];
  if (files.length) {
    const counts = {};
    files.forEach((f) => { counts[f.kind] = (counts[f.kind] || 0) + 1; });
    infoLine("หลักฐานแนบในระบบ:", Object.entries(counts).map(([k, n]) => `${fileKindLabel(k)} ${n} ไฟล์`).join(" · "));
  }
  if (e.status === "rejected" && e.rejectReason) infoLine("เหตุผลที่ตีกลับ:", e.rejectReason);
  if (e.status === "cancelled") infoLine("ยกเลิก:", e.cancelReason || "ยกเลิกเอกสาร");
  if (e.note) infoLine("หมายเหตุ:", e.note);

  return y;
};

/**
 * วางลายเซ็นอิเล็กทรอนิกส์ลงบนเส้นลงชื่อ
 * ✅ ผู้ใช้ขอ: ตั้งลายเซ็นไว้ที่ user แล้วใช้กับเอกสาร PDF — ลายเซ็นที่วางที่นี่คือ "ลายเซ็นที่ถูกผนึก
 * ไว้ในใบตอนคนนั้นกดออกใบ/กดอนุมัติเอง" (ดู da-app-server/src/routes/signatures.js)
 * ⚠️ วางให้ฐานของรูปอยู่เหนือเส้นเล็กน้อย และสูงไม่เกินช่องว่างเหนือเส้น — ไม่งั้นลายเซ็นจะทับ
 * หัวข้อ/ยอดเงินด้านบน ซึ่งทำให้เอกสารการเงินอ่านยากและดูเหมือนตัดแปะ
 * ⚠️ ห่อ try/catch: รูปเสีย/ชนิดไม่รองรับต้องไม่ทำให้ "พิมพ์เอกสารไม่ได้" — ปล่อยเป็นเส้นเซ็นมือแทน
 */
const drawSignatureImage = (doc, seal, { centerX, lineY, maxW, maxH }) => {
  if (!seal?.image) return false;
  try {
    const props = doc.getImageProperties(seal.image);
    const ratio = props.height / props.width || 0.35;
    let w = maxW;
    let h = w * ratio;
    if (h > maxH) { h = maxH; w = h / ratio; }
    doc.addImage(seal.image, "PNG", centerX - w / 2, lineY - h - 0.6, w, h, undefined, "MEDIUM");
    return true;
  } catch {
    return false;
  }
};

const renderSignatures = (doc, e, hasBold, signatures = null) => {
  const bold = (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal");
  const colW = W / 3;
  const approved = e.approvedAt && !["pending", "rejected"].includes(e.status);
  const boxes = [
    // ✅ ชื่อ-นามสกุลในวงเล็บใต้ลายเซ็น (ผู้ใช้ขอ) — ใบเก่า/คนนอกระบบที่ไม่มีนามสกุลในทะเบียนได้ชื่อต้นตามเดิม
    { role: "ผู้เบิกค่าใช้จ่าย", name: personFullName(e.requester), date: e.submittedAt || e.docDate, seal: signatures?.requester },
    // ⚠️ "ผู้ตรวจสอบ" ไม่มีขั้นตอนนี้ในระบบ (ไม่มีใครกดตรวจสอบ) — ต้องเว้นให้เซ็นมือเสมอ
    { role: "ผู้ตรวจสอบ", name: "", date: null, seal: null },
    { role: "ผู้อนุมัติ", name: approved ? personFullName(e.approvedBy) : "", date: approved ? e.approvedAt : null, seal: approved ? signatures?.approver : null },
  ];
  doc.setTextColor(...SLATE);
  boxes.forEach((b, i) => {
    const cxm = L + colW * i + colW / 2;
    const half = colW / 2 - 7;
    let y = SIG_TOP + 11;
    doc.setFontSize(13.5); bold(false);
    doc.text("ลงชื่อ", cxm - half, y);
    const sx = cxm - half + doc.getTextWidth("ลงชื่อ") + 1.5;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([0.5, 0.8], 0);
    doc.line(sx, y + 0.8, cxm + half, y + 0.8);
    doc.setLineDashPattern([], 0);
    // ✅ ลายเซ็นวางบนเส้น แล้วมีบรรทัดกำกับเล็กๆ ว่าลงนามอิเล็กทรอนิกส์เมื่อไร (ตรวจย้อนหลังได้)
    const signed = drawSignatureImage(doc, b.seal, {
      centerX: (sx + cxm + half) / 2, lineY: y + 0.6, maxW: (cxm + half - sx) * 0.92, maxH: 11,
    });
    y += 7;
    doc.text(b.name ? `( ${b.name} )` : "( ................................................ )", cxm, y, { align: "center" });
    y += 6.2;
    bold(true); doc.setFontSize(14);
    doc.text(b.role, cxm, y, { align: "center" });
    y += 6;
    bold(false); doc.setFontSize(12.5);
    doc.text(b.date ? `วันที่ ${thaiDate(b.date)}` : "วันที่ ........../........../..........", cxm, y, { align: "center" });
    if (signed) {
      y += 4.6;
      doc.setFontSize(9.5);
      doc.setTextColor(...GRAY);
      doc.text(`ลงนามอิเล็กทรอนิกส์ ${thaiDateTime(b.seal.signedAt)}`, cxm, y, { align: "center" });
      doc.setTextColor(...SLATE);
    }
  });
};

const renderFooter = (doc, e) => {
  doc.setFont("THSarabun", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const by = e.createdBy?.userId && e.createdBy.userId !== e.requester?.userId ? ` · ออกใบแทนโดย ${personFullName(e.createdBy)}` : "";
  doc.text(`พิมพ์จากระบบเมื่อ ${thaiDateTime(new Date())}${by}`, L, H_PAGE - 6);
  doc.text(`สถานะ: ${statusMeta(e.status, slipKind(e)).label}`, R, H_PAGE - 6, { align: "right" });
};

const renderCancelledMark = (doc, hasBold) => {
  try {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.13 }));
    doc.setFont("THSarabun", hasBold ? "bold" : "normal");
    doc.setFontSize(120);
    doc.setTextColor(220, 38, 38);
    doc.text("ยกเลิก", W_PAGE / 2 - 30, H_PAGE / 2 + 30, { angle: 35 });
    doc.restoreGraphicsState();
  } catch { /* เบราว์เซอร์/เวอร์ชันที่ไม่รองรับความโปร่งใส — สถานะยังอยู่ท้ายกระดาษ */ }
};

/**
 * @param {object} opts.expense  ใบจาก API (รูปแบบเดียวกับ GET /api/expenses/:id)
 * @param {"blob"|"open"|"download"} [opts.mode]
 * @returns {Promise<{blob: Blob, url: string, fileName: string}>}
 */
/**
 * @param {object} opts.signatures  ลายเซ็นที่ผนึกไว้ในใบ { requester, approver } จาก
 *   GET /api/expenses/:id/signatures — ไม่ส่งมาก็ออกใบได้ (เว้นช่องให้เซ็นมือ)
 */
export async function generateExpensePdf({ expense, signatures = null, mode = "blob" }) {
  const [{ jsPDF }, fontModule, bold] = await Promise.all([
    import("jspdf"),
    import("@/assets/fonts/THSarabunNew_base64"),
    loadBoldFont(),
  ]);
  const font = fontModule.default;
  const hasBold = Boolean(bold);

  // ✅ ย่อโลโก้หัวกระดาษก่อนฝังลงไฟล์ — ดูหัวข้อ "ขนาดไฟล์ PDF" ใน deliveryNotePdf.js
  await preparePrintAssets();

  // วัดบนกระดาษทด แล้วเลือกขั้นย่อแรกที่พอดีหน้าเดียว
  let step = FIT_STEPS[FIT_STEPS.length - 1];
  for (const candidate of FIT_STEPS) {
    const scratch = newDoc(jsPDF, font, bold);
    const bottom = renderBody(scratch, expense, candidate, hasBold);
    if (bottom <= SIG_TOP - 2) { step = candidate; break; }
  }

  const doc = newDoc(jsPDF, font, bold);
  renderBody(doc, expense, step, hasBold);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(L, SIG_TOP, R, SIG_TOP);
  renderSignatures(doc, expense, hasBold, signatures);
  renderFooter(doc, expense);
  if (expense.status === "cancelled") renderCancelledMark(doc, hasBold);

  doc.setProperties({
    title: `${KIND_META[slipKind(expense)]?.docTitle || "ใบเบิก"} ${expense.docNo || ""}`,
    subject: expense.subject || "",
    creator: ISSUER.nameEn,
  });
  return outputDocument(doc, expense.docNo || "ใบเบิก", mode);
}

export const __test = { wrapText, FIT_STEPS, SIG_TOP };
