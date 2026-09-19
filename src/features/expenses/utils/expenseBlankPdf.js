/**
 * expenseBlankPdf.js — "ฟอร์มใบเคลมเปล่า" สำหรับพิมพ์ไปกรอกด้วยลายมือ (A4)
 *
 * ✅ ผู้ใช้ขอ: "กดปริ้นเอกสารเปล่าๆ มาเขียนมือเองได้ โดยต้องมีความปลอดภัย และละเอียด"
 * ช่างที่อยู่หน้างานมักไม่สะดวกกรอกในแอประหว่างจ่ายเงิน — จดลงกระดาษก่อน แนบใบเสร็จ แล้วค่อยบันทึกเข้าระบบ
 *
 * ── ความปลอดภัย: กระดาษเปล่าคือช่องโหว่ที่ใหญ่ที่สุดของเอกสารการเงิน ─────────────────────────
 * ใครก็ถ่ายเอกสาร/กรอกย้อนหลัง/แก้ตัวเลขบนกระดาษได้ ฟอร์มนี้จึงออกแบบให้ "ปลอมยาก ตรวจง่าย":
 *   1. ไม่มีเลขที่เอกสาร — เลขที่ออกจากระบบเท่านั้นเมื่อบันทึกจริง กระดาษจึงอ้างตัวเป็นเอกสารที่อนุมัติแล้วไม่ได้
 *      และมีแถบเตือน "ยังไม่มีผลทางบัญชีจนกว่าจะบันทึกเข้าระบบและได้รับอนุมัติ" ตัวใหญ่ด้านบน
 *   2. รหัสฟอร์มไม่ซ้ำทุกแผ่น (พิมพ์ทุกหน้า) —
 *      • แบบผูกใบ Advance (FC-…): server เป็นคนสุ่มและบันทึกลงประวัติใบ Advance ทันที ฝ่ายบัญชีเปิดใบ
 *        Advance เทียบได้ว่ารหัสนี้ออกจริง โดยใคร เมื่อไร — รหัสที่ไม่มีในประวัติ = กระดาษที่ไม่ได้ออกจากระบบ
 *      • แบบเปล่าทั้งใบ (FB-…): สุ่มในเครื่อง ตรวจกับระบบไม่ได้ แต่ยังบอกได้ว่าใครพิมพ์ เมื่อไร
 *   3. แบบผูกใบ Advance พิมพ์เลขที่/ยอดเบิก (ทั้งตัวเลขและตัวอักษร)/รายการที่ตั้งเบิกจากระบบลงไปเลย —
 *      ส่วนที่เป็นยอดเงินต้นทางจึงแก้ด้วยมือไม่ได้โดยไม่เห็นร่องรอย
 *   4. ช่องจำนวนเงินแยก "บาท | สต." + ช่องเขียนยอดเป็นตัวอักษร — กันเติมเลขหน้า/เลื่อนจุดทศนิยม
 *   5. ข้อปฏิบัติพิมพ์ติดไว้บนฟอร์ม: ปากกาเท่านั้น ห้ามลบ ขีดฆ่า+เซ็นกำกับ ขีดปิดบรรทัดว่าง
 *   6. ลายเซ็น 4 ช่อง รวม "ผู้บันทึกเข้าระบบ" พร้อมเลขที่ใบเคลมที่ได้ — ปิดวงจรว่ากระดาษแผ่นนี้ถูกบันทึกแล้ว
 *      ใบไหน (กันยื่นกระดาษแผ่นเดิมซ้ำเพื่อเบิกสองรอบ)
 *
 * ── ฟอร์มมี 3 แบบ ────────────────────────────────────────────────────────────────────────────
 *   "advance"   ใบเคลมที่ผูกใบ Advance — พิมพ์เลขที่/ยอด/รายการตั้งเบิกให้ + รหัสฟอร์ม FC- จาก server
 *   "empty"     ใบเคลมเปล่าทั้งใบ — ไม่ผูกใบไหน รหัส FB- สุ่มในเครื่อง
 *   "reimburse" ใบเบิกค่าใช้จ่าย (สำรองจ่ายเอง) — ไม่มี Advance ให้อ้างเลย จึงตัดกรอบอ้างอิง คอลัมน์
 *               "ตั้งเบิก" และแถว "หัก เงินเบิกล่วงหน้า/ส่วนต่าง" ออกทั้งหมด เหลือยอดรวมบรรทัดเดียว
 * ⚠️ ความสูงของส่วนท้ายตาราง (AFTER_H) ต่างกันตามแบบ — ต้องส่งเข้า planRows ให้ตรง ไม่งั้นแถวสุดท้าย
 * จะทับช่องลายเซ็น หรือเหลือที่ว่างเปล่าครึ่งหน้า
 *
 * ⚠️ ห้ามตัดรายการที่ตั้งเบิกทิ้งเพื่อให้จบหน้าเดียว (หลักเดียวกับ expensePdf.js) — ถ้าเยอะเกินจะบีบแถวก่อน
 * แล้วค่อยต่อหน้า 2 พร้อมหัวตารางซ้ำ ลายเซ็นอยู่หน้าสุดท้ายเสมอ
 */
import { ISSUER, outputDocument, spaceThaiLatin } from "@/features/documents/utils/deliveryNotePdf";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { KIND_META, fmtMoney, bahtText, qtyText, jobText, money, itemPersonName, personFullName } from "../expenseMeta";
import { newDoc, loadBoldFont, wrapText } from "./expensePdf";

const W_PAGE = 210;
const H_PAGE = 297;
const L = 16;
const R = W_PAGE - 16;
const W = R - L;
const FOOT_Y = H_PAGE - 6;
const SIG_H = 34;
const SIG_TOP = H_PAGE - 10 - SIG_H;
/** ขอบล่างของเนื้อหาในหน้าที่ไม่มีช่องลายเซ็น (หน้าที่ตารางล้นต่อ) */
const PAGE_BOTTOM = H_PAGE - 13;

/** ความสูงแถวสำหรับเขียนมือ — 7.6 มม. ใกล้เคียงสมุดบรรทัดทั่วไป ต่ำกว่า 6 มม. เริ่มเขียนภาษาไทยไม่ลง */
const ROW_H = 7.6;
const ROW_H_TIGHT = 6.2;
const HEAD_H = 10;
const TOTAL_ROW_H = 7.2;
const RULES_H = 18.5;
/** ความสูงทุกอย่างหลังตาราง (แถวรวม 3 แถว + ตัวอักษร + เอกสารแนบ + ข้อปฏิบัติ) — ต้องตรงกับ drawAfterTable */
const AFTER_H = TOTAL_ROW_H * 3 + 6.8 + 6.8 + 3.2 + RULES_H + 2.5;
/** แบบสำรองจ่าย: มีแถวยอดรวมแถวเดียว (ไม่มีหัก Advance / ส่วนต่าง) */
const AFTER_H_SIMPLE = AFTER_H - TOTAL_ROW_H * 2;

const SLATE = [15, 23, 42];
const GRAY = [100, 116, 139];
const LINE = [148, 163, 184];
const FAINT = [215, 222, 232];
const NA_FILL = [241, 245, 249];
const AMBER = { fill: [255, 251, 235], line: [245, 158, 11], text: [146, 64, 14] };

const CLAIM = KIND_META.claim.pdf;
const ADV = KIND_META.advance.pdf;
const RMB = KIND_META.reimburse.pdf;

/**
 * หน้าตาประจำแบบฟอร์ม — ทุกจุดที่ "ต่างกันตามแบบ" รวมไว้ที่เดียว ไม่กระจายเป็น if ทั่วไฟล์
 * ⚠️ showPlanned = false ตัดคอลัมน์ "ตั้งเบิก" ออกจากตารางด้วย (ดู buildColumns)
 */
const FORM_STYLE = {
  claim: {
    tint: CLAIM, badge: "CLAIM", title: "ใบเคลียร์ค่าใช้จ่าย (Claim)", noLabel: "เลขที่ใบเคลม",
    amountHead: "ใช้จริง", descHead: "รายการค่าใช้จ่าย", totalLabel: "รวมค่าใช้จ่ายจริง",
    wordsLabel: "จำนวนเงินใช้จริง (ตัวอักษร)", signRole: "ผู้เบิก / ผู้เคลียร์", signDocLine: "เลขที่ใบเคลม ......................",
    showPlanned: true, afterH: AFTER_H,
  },
  reimburse: {
    tint: RMB, badge: "สำรองจ่าย", title: "ใบเบิกค่าใช้จ่าย (สำรองจ่ายเอง)", noLabel: "เลขที่เอกสาร",
    amountHead: "จำนวนเงิน", descHead: "รายการที่สำรองจ่าย", totalLabel: "รวมขอเบิกคืน",
    wordsLabel: "จำนวนเงินที่ขอเบิกคืน (ตัวอักษร)", signRole: "ผู้เบิก / ผู้สำรองจ่าย", signDocLine: "เลขที่เอกสาร ......................",
    showPlanned: false, afterH: AFTER_H_SIMPLE,
  },
};

/** อักษรที่ใช้ในรหัสฟอร์ม — ตัด 0/O/1/I ที่อ่านสับสนเวลาคนเขียน/อ่านจากกระดาษ (ชุดเดียวกับฝั่ง server) */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * รหัสฟอร์มของ "ฟอร์มเปล่าทั้งใบ" (ไม่ผูกใบ Advance จึงไม่มีใบให้บันทึกประวัติฝั่ง server)
 * ⚠️ ใช้ crypto.getRandomValues ไม่ใช่ Math.random — Math.random เดาลำดับได้ ไม่เหมาะกับรหัสควบคุมเอกสาร
 */
export const localFormCode = (now = new Date()) => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => CODE_ALPHABET[b % 32]).join("");
  const pad = (v) => String(v).padStart(2, "0");
  return `FB-${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${rand}`;
};

/** 1480.5 → { baht: "1,480", satang: "50" } สำหรับช่อง บาท | สต. */
const splitMoney = (n) => {
  const v = money(n);
  const baht = Math.floor(v);
  return { baht: baht.toLocaleString("th-TH"), satang: String(Math.round((v - baht) * 100)).padStart(2, "0") };
};

const makePen = (doc, hasBold) => {
  const pen = {
    bold: (on) => doc.setFont("THSarabun", on && hasBold ? "bold" : "normal"),
    size: (pt) => doc.setFontSize(pt),
    color: (rgb) => doc.setTextColor(...rgb),
    dotted: (x1, y, x2) => {
      if (x2 - x1 < 1) return;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([0.5, 0.8], 0);
      doc.line(x1, y, x2, y);
      doc.setLineDashPattern([], 0);
    },
    /** ช่องติ๊ก ☐ — ฟอนต์ TH Sarabun ไม่มีอักษร ☐ ต้องวาดเป็นสี่เหลี่ยมเอง; คืนค่า x ถัดจากช่อง */
    checkbox: (x, baseline, s = 2.8) => {
      doc.setDrawColor(...SLATE);
      doc.setLineWidth(0.25);
      doc.rect(x, baseline - s + 0.3, s, s);
      return x + s + 1.3;
    },
    /** ข้อความบรรทัดเดียว — ยาวเกินพื้นที่ตัดท้ายด้วย … (บนฟอร์มเขียนมือไม่มีที่ให้ขึ้นบรรทัดใหม่) */
    fit: (text, width) => {
      const lines = wrapText(doc, spaceThaiLatin(text), width);
      return lines.length > 1 ? `${lines[0].replace(/\s+$/, "")}…` : lines[0];
    },
  };
  return pen;
};

// ══ ส่วนหัว ══════════════════════════════════════════════════════════════════

const drawCompanyHeader = (doc, pen, style) => {
  pen.color(SLATE);
  pen.bold(true); pen.size(15);
  doc.text(ISSUER.nameTh, W_PAGE / 2, 12.5, { align: "center" });
  pen.bold(false); pen.size(10);
  doc.text(`${ISSUER.address}  ${ISSUER.taxId}`, W_PAGE / 2, 17, { align: "center" });
  doc.setDrawColor(...style.tint.main);
  doc.setLineWidth(0.8);
  doc.line(L, 19.5, R, 19.5);
};

const drawBadge = (doc, pen, baseline, style) => {
  pen.bold(true); pen.size(11);
  const bw = doc.getTextWidth(style.badge) + 6;
  const bh = 6;
  doc.setFillColor(...style.tint.main);
  doc.roundedRect(R - bw, baseline - bh + 1.4, bw, bh, bh / 2, bh / 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(style.badge, R - bw / 2, baseline - bh / 2 + 2.7, { align: "center" });
};

/** หัวเอกสารหน้าแรก + ข้อมูลผู้เบิก + กรอบอ้างอิง Advance — คืนค่า y ของขอบบนตาราง */
const drawFirstPageTop = (doc, pen, ctx) => {
  const { pre, bound, code, style } = ctx;
  drawCompanyHeader(doc, pen, style);

  let y = 28.5;
  pen.bold(true); pen.size(20); pen.color(style.tint.main);
  doc.text(style.title, W_PAGE / 2, y, { align: "center" });
  drawBadge(doc, pen, y, style);
  y += 5.4;
  pen.bold(false); pen.size(12.5); pen.color(GRAY);
  doc.text("แบบฟอร์มกรอกด้วยลายมือ", W_PAGE / 2, y, { align: "center" });

  // ── เลขที่ (ว่างไว้ให้ระบบออก) · วันที่ ──────────────────────────────────────
  y += 7;
  pen.size(13.5); pen.color(SLATE);
  pen.bold(true);
  doc.text(style.noLabel, L, y);
  const noX = L + doc.getTextWidth(style.noLabel) + 2;
  pen.dotted(noX, y + 1.2, noX + 40);
  pen.bold(false); pen.size(10.5); pen.color(GRAY);
  doc.text("(เว้นว่าง — ระบบออกเลขเมื่อบันทึก)", noX + 42, y);
  pen.size(13.5); pen.color(SLATE);
  const dateBlank = "........ / ........ / ............";
  const dateW = doc.getTextWidth(dateBlank);
  doc.text(dateBlank, R, y, { align: "right" });
  pen.bold(true);
  doc.text("วันที่", R - dateW - 2, y, { align: "right" });

  // ── แถบเตือน + รหัสฟอร์ม ──────────────────────────────────────────────────
  y += 3.6;
  const bandH = 7.6;
  doc.setFillColor(...AMBER.fill);
  doc.setDrawColor(...AMBER.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(L, y, W, bandH, 1.2, 1.2, "FD");
  doc.setFillColor(...AMBER.line);
  doc.rect(L, y + 0.3, 1.3, bandH - 0.6, "F");
  const bandBase = y + bandH / 2 + 1.5;
  pen.size(12.5); pen.bold(true); pen.color(AMBER.text);
  doc.text("สำคัญ:", L + 3.5, bandBase);
  const warnX = L + 3.5 + doc.getTextWidth("สำคัญ:") + 1.8;
  pen.bold(false);
  doc.text("ยังไม่มีผลทางบัญชี จนกว่าจะบันทึกเข้าระบบและได้รับอนุมัติ", warnX, bandBase);
  pen.bold(true); pen.color(SLATE);
  doc.text(`รหัสฟอร์ม ${code}`, R - 3, bandBase, { align: "right" });
  y += bandH;

  // ── ข้อมูลผู้เบิก ─────────────────────────────────────────────────────────
  const field = (label, value, x1, x2, yy) => {
    pen.size(13.5); pen.bold(true); pen.color(SLATE);
    doc.text(label, x1, yy);
    const vx = x1 + doc.getTextWidth(label) + 2;
    pen.dotted(vx, yy + 1.2, x2);
    if (value) {
      pen.bold(false);
      doc.text(pen.fit(value, x2 - vx - 1.5), vx + 1, yy - 0.2);
    }
  };
  const mid = L + W / 2;
  y += 7.4;
  field("ถึง", pre.to, L, mid - 4, y);
  field("ชื่อผู้เบิกเงิน", pre.requester, mid, R, y);
  y += 7.2;
  field("ตำแหน่ง", pre.position, L, mid - 4, y);
  field("เบอร์โทรติดต่อ", "", mid, R, y);
  y += 7.2;
  field("เรื่อง", pre.subject, L, R, y);
  y += 7.2;
  field("งาน / โครงการ", pre.job, L, R, y);

  // ── แบบสำรองจ่าย: ไม่มี Advance ให้อ้าง ────────────────────────────────────
  // ⚠️ ไม่ใช้กรอบเปล่าที่มีช่อง "ยอดเบิก" ว่างไว้ — ช่องว่างบนกระดาษการเงินคือช่องให้เติมทีหลัง
  if (!style.showPlanned) {
    y += 3.4;
    const noteH = 8.6;
    doc.setFillColor(...style.tint.fill);
    doc.setDrawColor(...style.tint.main);
    doc.setLineWidth(0.3);
    doc.roundedRect(L, y, W, noteH, 1.5, 1.5, "FD");
    doc.setFillColor(...style.tint.main);
    doc.rect(L, y + 0.4, 1.4, noteH - 0.8, "F");
    pen.bold(true); pen.size(12.5); pen.color(style.tint.main);
    doc.text("ผู้เบิกสำรองจ่ายเอง — ไม่มีใบเบิกเงินล่วงหน้า (Advance)", L + 4, y + noteH / 2 + 1.5);
    pen.bold(false); pen.size(10.5); pen.color(GRAY);
    doc.text("ถ้าเคยรับเงิน Advance ไว้แล้ว ให้ใช้ฟอร์มใบเคลมแทน", R - 3, y + noteH / 2 + 1.5, { align: "right" });
    return y + noteH + 3;
  }

  // ── กรอบอ้างอิงใบ Advance ─────────────────────────────────────────────────
  y += 3.4;
  const boxH = 16.8;
  doc.setFillColor(...ADV.fill);
  doc.setDrawColor(...ADV.main);
  doc.setLineWidth(0.3);
  doc.roundedRect(L, y, W, boxH, 1.5, 1.5, "FD");
  doc.setFillColor(...ADV.main);
  doc.rect(L, y + 0.4, 1.4, boxH - 0.8, "F");
  let by = y + 5.2;
  pen.bold(true); pen.size(13); pen.color(ADV.main);
  doc.text("อ้างอิงใบเบิกเงินล่วงหน้า (Advance)", L + 4, by);
  if (bound) {
    pen.bold(false); pen.size(10.5); pen.color(GRAY);
    doc.text("ข้อมูลในกรอบนี้พิมพ์จากระบบ ห้ามแก้ไข", R - 3, by, { align: "right" });
  }
  /** ป้าย + ค่า (หรือเส้นประให้เขียน) เรียงต่อกันในบรรทัดเดียว */
  const inline = (yy, parts) => {
    let x = L + 4;
    parts.forEach((p) => {
      pen.size(12.5); pen.bold(true); pen.color(SLATE);
      doc.text(p.label, x, yy);
      x += doc.getTextWidth(p.label) + 1.8;
      const end = p.w === "rest" ? R - 3 : x + p.w;
      if (p.value) {
        pen.bold(false);
        doc.text(pen.fit(p.value, end - x - 0.5), x + 0.3, yy);
      } else {
        pen.dotted(x, yy + 1.1, end);
      }
      if (p.suffix) {
        pen.bold(false);
        doc.text(p.suffix, end + 1, yy);
        x = end + 1 + doc.getTextWidth(p.suffix) + 4;
      } else {
        x = end + 4;
      }
    });
  };
  const adv = pre.advance;
  by += 5.6;
  inline(by, [
    { label: "เลขที่", value: adv?.docNo, w: 38 },
    { label: "ลงวันที่", value: adv?.docDate ? thaiDate(adv.docDate) : "", w: 30 },
    { label: "วันที่รับเงิน", value: adv?.paidAt ? thaiDate(adv.paidAt) : "", w: "rest" },
  ]);
  by += 5.6;
  inline(by, [
    { label: "ยอดเบิก", value: adv ? fmtMoney(adv.total) : "", w: 22, suffix: "บาท" },
    { label: "ตัวอักษร", value: adv ? `( ${bahtText(adv.total)} )` : "", w: "rest" },
  ]);
  y += boxH;
  return y + 3;
};

/** หัวหน้าที่ 2 เป็นต้นไป (ตารางต่อ) — ย่อ แต่ยังมีรหัสฟอร์มให้รู้ว่าหน้านี้เป็นของฟอร์มแผ่นไหน */
const drawContinuationTop = (doc, pen, ctx) => {
  const { style } = ctx;
  drawCompanyHeader(doc, pen, style);
  const y = 27.5;
  pen.bold(true); pen.size(16); pen.color(style.tint.main);
  doc.text(`${style.title} — รายการต่อ`, L, y);
  drawBadge(doc, pen, y, style);
  pen.bold(true); pen.size(12); pen.color(SLATE);
  const codeText = `รหัสฟอร์ม ${ctx.code}`;
  const badgeW = (() => { pen.size(11); return doc.getTextWidth(style.badge) + 6; })();
  pen.size(12);
  doc.text(codeText, R - badgeW - 4, y, { align: "right" });
  return y + 5;
};

// ══ ตาราง ════════════════════════════════════════════════════════════════════

const buildColumns = (style) => {
  const cols = [
    { key: "no", w: 9, h1: "ลำดับ" },
    { key: "date", w: 17, h1: "วันที่", h2: "ใบเสร็จ" },
    { key: "desc", w: 0, h1: style.descHead },
    { key: "receipt", w: 21, h1: "เลขที่", h2: "ใบเสร็จ" },
    { key: "qty", w: 23, h1: "จำนวน /", h2: "หน่วย" },
    // คอลัมน์ "ตั้งเบิก" มีเฉพาะฟอร์มที่ผูกใบ Advance — แบบสำรองจ่ายไม่มียอดต้นทางให้เทียบ
    ...(style.showPlanned ? [{ key: "planned", w: 21, h1: "ตั้งเบิก", h2: "(บาท)" }] : []),
    { key: "baht", w: 20 },
    { key: "satang", w: 9 },
  ];
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  cols.find((c) => c.key === "desc").w = W - fixed;
  let x = L;
  cols.forEach((c) => { c.x = x; x += c.w; });
  const map = Object.fromEntries(cols.map((c) => [c.key, c]));
  return { cols, col: (k) => map[k] };
};

const drawTableHead = (doc, pen, T, y, style) => {
  const { cols, col } = T;
  doc.setFillColor(...style.tint.head);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.rect(L, y, W, HEAD_H, "FD");
  // คอลัมน์ตั้งเบิกเป็นสีของ Advance — ตัวเลขในช่องนี้มาจากใบต้นทาง ไม่ใช่ช่องให้เขียน
  if (col("planned")) {
    doc.setFillColor(...ADV.head);
    doc.rect(col("planned").x, y, col("planned").w, HEAD_H, "F");
  }

  pen.bold(true); pen.size(11.5); pen.color(SLATE);
  const mid = y + HEAD_H / 2;
  cols.forEach((c) => {
    if (c.key === "baht" || c.key === "satang") return;
    const cx = c.x + c.w / 2;
    if (c.h2) {
      doc.text(c.h1, cx, mid - 0.6, { align: "center" });
      doc.text(c.h2, cx, mid + 3.4, { align: "center" });
    } else {
      doc.text(c.h1, cx, mid + 1.5, { align: "center" });
    }
  });
  // "ใช้จริง" คร่อมช่อง บาท + สต.
  const bx = col("baht").x;
  const bw = col("baht").w + col("satang").w;
  doc.text(style.amountHead, bx + bw / 2, y + 4, { align: "center" });
  doc.setDrawColor(...LINE);
  doc.line(bx, y + HEAD_H / 2 + 0.3, R, y + HEAD_H / 2 + 0.3);
  pen.size(11);
  doc.text("บาท", bx + col("baht").w / 2, y + HEAD_H - 1.3, { align: "center" });
  doc.text("สต.", col("satang").x + col("satang").w / 2, y + HEAD_H - 1.3, { align: "center" });
  doc.line(col("satang").x, y + HEAD_H / 2 + 0.3, col("satang").x, y + HEAD_H);
  cols.forEach((c, i) => {
    if (i === 0 || c.key === "satang") return;
    doc.line(c.x, y, c.x, y + HEAD_H);
  });
  return y + HEAD_H;
};

/** @param item รายการที่ตั้งเบิกจากใบ Advance (หรือ null = แถวว่างให้เขียน) */
const drawRow = (doc, pen, T, y, rowH, no, item) => {
  const { col } = T;
  if (col("planned")) {
    doc.setFillColor(...ADV.fill);
    doc.rect(col("planned").x, y, col("planned").w, rowH, "F");
  }
  const base = y + rowH / 2 + 1.5;
  pen.bold(false); pen.size(12); pen.color(GRAY);
  doc.text(String(no), col("no").x + col("no").w / 2, base, { align: "center" });
  if (item) {
    pen.size(12.5); pen.color(SLATE);
    const person = itemPersonName(item);
    const desc = [`${item.description}${person ? ` (${person})` : ""}`, item.detail].filter(Boolean).join(" · ");
    doc.text(pen.fit(desc, col("desc").w - 3), col("desc").x + 1.5, base);
    pen.size(11.5);
    doc.text(pen.fit(qtyText(item), col("qty").w - 2), col("qty").x + col("qty").w / 2, base, { align: "center" });
    if (col("planned")) {
      pen.size(12.5); pen.color(ADV.main);
      doc.text(fmtMoney(item.amount), col("planned").x + col("planned").w - 1.5, base, { align: "right" });
    }
  }
  doc.setDrawColor(...FAINT);
  doc.setLineWidth(0.15);
  doc.line(L, y + rowH, R, y + rowH);
  return y + rowH;
};

/**
 * เส้นแนวตั้งของตาราง (ถึง bodyEnd) + กรอบนอก (ถึง yEnd)
 * ⚠️ เส้นคอลัมน์ต้องหยุดที่แถวรายการสุดท้าย — แถวยอดรวมด้านล่างเป็น "ช่องรวม" ฝั่งซ้าย (ป้าย/ช่องติ๊ก)
 * ถ้าลากทะลุลงไป ช่องติ๊ก "คืนเงินบริษัท" จะโดนเส้นผ่ากลางและป้ายยอดรวมดูเหมือนอยู่ผิดคอลัมน์
 * (แถวยอดรวมวาดเส้นของตัวเองเฉพาะช่อง ตั้งเบิก | บาท | สต. — ดู totalRow)
 */
const closeTable = (doc, T, top, bodyEnd, yEnd = bodyEnd) => {
  const { cols } = T;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  cols.forEach((c, i) => {
    if (i === 0) return;
    if (c.key === "satang") {
      // เส้นคั่นบาท|สต. บางกว่า — ตาอ่านเป็นช่องเดียวกัน แต่เขียนแยกตำแหน่งทศนิยมได้ชัด
      doc.setLineWidth(0.12);
      doc.line(c.x, top + HEAD_H, c.x, bodyEnd);
      doc.setLineWidth(0.25);
      return;
    }
    doc.line(c.x, top + HEAD_H, c.x, bodyEnd);
  });
  doc.setLineWidth(0.3);
  doc.rect(L, top, W, yEnd - top);
};

// ══ หลังตาราง ════════════════════════════════════════════════════════════════

const drawAfterTable = (doc, pen, T, tableTop, y, ctx) => {
  const { col } = T;
  const { bound, pre, style } = ctx;
  // ไม่มีคอลัมน์ "ตั้งเบิก" → ป้ายยอดรวมชิดขอบซ้ายของช่องจำนวนเงินแทน
  const pX = col("planned") ? col("planned").x : col("baht").x;
  const bX = col("baht").x;
  const sX = col("satang").x;
  const bodyEnd = y;

  const totalRow = (label, { planned, amount, na = false, strong = false, left = null }) => {
    const h = TOTAL_ROW_H;
    doc.setFillColor(...(strong ? style.tint.head : style.tint.fill));
    doc.rect(L, y, W, h, "F");
    if (col("planned")) {
      doc.setFillColor(...(na ? NA_FILL : ADV.head));
      doc.rect(pX, y, col("planned").w, h, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(L, y + h, R, y + h);
    doc.line(pX, y, pX, y + h);
    doc.line(bX, y, bX, y + h);
    doc.setLineWidth(0.12);
    doc.line(sX, y, sX, y + h);
    const base = y + h / 2 + 1.5;
    if (left) left(base);
    pen.bold(true); pen.size(strong ? 13.5 : 13); pen.color(SLATE);
    doc.text(label, pX - 2, base, { align: "right" });
    if (!col("planned")) {
      // ไม่มีช่องตั้งเบิกให้วาด
    } else if (na) {
      pen.bold(false); pen.size(11); pen.color(GRAY);
      doc.text("—", pX + col("planned").w / 2, base, { align: "center" });
    } else if (planned !== undefined && planned !== null) {
      pen.bold(true); pen.size(12.5); pen.color(ADV.main);
      doc.text(fmtMoney(planned), pX + col("planned").w - 1.5, base, { align: "right" });
    }
    if (amount !== undefined && amount !== null) {
      const m = splitMoney(amount);
      pen.bold(true); pen.size(12.5); pen.color(SLATE);
      doc.text(m.baht, sX - 1.2, base, { align: "right" });
      doc.text(m.satang, sX + col("satang").w / 2, base, { align: "center" });
    }
    y += h;
  };

  if (style.showPlanned) {
    totalRow(style.totalLabel, { planned: bound ? pre.plannedTotal : null });
    totalRow("หัก เงินเบิกล่วงหน้า (Advance)", { na: true, amount: bound ? pre.advance.total : null });
    totalRow("ส่วนต่าง", {
      na: true,
      strong: true,
      left: (base) => {
        pen.bold(false); pen.size(12.5); pen.color(SLATE);
        let x = L + 3;
        [["คืนเงินบริษัท", 6], ["บริษัทจ่ายเพิ่ม", 6], ["พอดี ไม่มีส่วนต่าง", 0]].forEach(([t, gap]) => {
          x = pen.checkbox(x, base);
          doc.text(t, x, base);
          x += doc.getTextWidth(t) + gap;
        });
      },
    });
  } else {
    // แบบสำรองจ่าย: ยอดรวมแถวเดียว + ช่องติ๊กวิธีรับเงินคืน (ข้อมูลที่ฝ่ายบัญชีต้องใช้จ่ายคืนจริง)
    totalRow(style.totalLabel, {
      strong: true,
      left: (base) => {
        pen.bold(false); pen.size(12.5); pen.color(SLATE);
        let x = L + 3;
        doc.text("รับเงินคืนโดย", x, base);
        x += doc.getTextWidth("รับเงินคืนโดย") + 2.5;
        [["โอนเข้าบัญชี", 6], ["เงินสด", 0]].forEach(([t, gap]) => {
          x = pen.checkbox(x, base);
          doc.text(t, x, base);
          x += doc.getTextWidth(t) + gap;
        });
      },
    });
  }
  closeTable(doc, T, tableTop, bodyEnd, y);

  // ── ยอดเป็นตัวอักษร ────────────────────────────────────────────────────────
  y += 6.8;
  pen.size(13); pen.bold(true); pen.color(SLATE);
  const wl = style.wordsLabel;
  doc.text(wl, L, y);
  const wx = L + doc.getTextWidth(wl) + 2;
  pen.dotted(wx, y + 1.2, R);

  // ── เอกสารแนบ ─────────────────────────────────────────────────────────────
  y += 6.8;
  pen.size(13); pen.bold(true);
  doc.text("เอกสารแนบ", L, y);
  let ax = L + doc.getTextWidth("เอกสารแนบ") + 3;
  pen.bold(false); pen.size(12.5);
  const blank = (w) => { pen.dotted(ax, y + 1.1, ax + w); ax += w + 1; };
  [["ใบเสร็จรับเงิน", "ใบ"], ["ใบกำกับภาษี", "ใบ"], ["สลิปโอนเงิน", "ใบ"]].forEach(([t, unit]) => {
    ax = pen.checkbox(ax, y);
    doc.text(t, ax, y);
    ax += doc.getTextWidth(t) + 1;
    blank(7);
    doc.text(unit, ax, y);
    ax += doc.getTextWidth(unit) + 3.5;
  });
  ax = pen.checkbox(ax, y);
  doc.text("อื่นๆ", ax, y);
  ax += doc.getTextWidth("อื่นๆ") + 1;
  const totalLabel = "รวม";
  const unitLabel = "แผ่น";
  const tailW = doc.getTextWidth(totalLabel) + 1 + 8 + doc.getTextWidth(unitLabel);
  pen.dotted(ax, y + 1.1, R - tailW - 3);
  let tx = R - tailW;
  doc.text(totalLabel, tx, y);
  tx += doc.getTextWidth(totalLabel) + 1;
  pen.dotted(tx, y + 1.1, tx + 7);
  doc.text(unitLabel, R, y, { align: "right" });

  // ── ข้อปฏิบัติ ──────────────────────────────────────────────────────────────
  y += 3.2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...FAINT);
  doc.setLineWidth(0.25);
  doc.roundedRect(L, y, W, RULES_H, 1.2, 1.2, "FD");
  pen.bold(true); pen.size(11.5); pen.color(SLATE);
  doc.text("ข้อปฏิบัติในการกรอก (ป้องกันการแก้ไขเอกสาร)", L + 3, y + 4.6);
  const due = pre.advance?.dueClearAt ? thaiDate(pre.advance.dueClearAt) : "";
  const rules = [
    "กรอกด้วยปากกาหมึกน้ำเงินหรือดำเท่านั้น ห้ามใช้ดินสอ",
    "ห้ามใช้น้ำยา/เทปลบคำผิด เขียนผิดให้ขีดฆ่าแล้วลงชื่อกำกับ",
    "ขีดเส้นปิดบรรทัดที่ไม่ได้ใช้ ก่อนยื่นเอกสาร",
    "ยอดเงินต้องตรงกับใบเสร็จ และเขียนตัวอักษรกำกับยอดรวม",
    "แนบใบเสร็จตัวจริง เขียนเลขลำดับรายการไว้ที่มุมใบเสร็จ",
    due ? `บันทึกเข้าระบบพร้อมรูปใบเสร็จภายใน ${due}`
      : style.showPlanned ? "บันทึกเข้าระบบพร้อมรูปใบเสร็จภายในกำหนดเคลียร์"
        : "บันทึกเข้าระบบพร้อมรูปใบเสร็จโดยเร็วที่สุดหลังจ่ายเงิน",
  ];
  pen.bold(false); pen.size(10.8); pen.color([51, 65, 85]);
  const colW = (W - 6) / 2;
  rules.forEach((t, i) => {
    const cx = L + 3 + (i % 2) * colW;
    const ry = y + 9 + Math.floor(i / 2) * 4.3;
    doc.text(`${i + 1}.`, cx, ry);
    doc.text(pen.fit(t, colW - 6), cx + 3.6, ry);
  });
  return y + RULES_H;
};

// ══ ลายเซ็น + ท้ายกระดาษ ═══════════════════════════════════════════════════

const drawSignatures = (doc, pen, ctx) => {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(L, SIG_TOP, R, SIG_TOP);
  const colW = W / 4;
  const boxes = [
    // ✅ ช่องลงนามตรงกับใบที่ออกจากระบบ (ผู้ใช้สั่งให้ควบรวมผู้ตรวจสอบ/อนุมัติเป็นช่องเดียว)
    { role: ctx.style.signRole, name: ctx.pre.requester },
    { role: "ผู้ตรวจสอบ / อนุมัติ" },
    { role: "ผู้อนุมัติเบิกจ่าย" },
    { role: "ผู้บันทึกเข้าระบบ", docLine: true },
  ];
  boxes.forEach((b, i) => {
    const cx = L + colW * i + colW / 2;
    const half = colW / 2 - 3;
    let y = SIG_TOP + 9.5;
    pen.bold(false); pen.size(12.5); pen.color(SLATE);
    doc.text("ลงชื่อ", cx - half, y);
    pen.dotted(cx - half + doc.getTextWidth("ลงชื่อ") + 1.2, y + 0.8, cx + half);
    y += 6.2;
    doc.text(b.name ? `( ${pen.fit(b.name, colW - 12)} )` : "( ...................................... )", cx, y, { align: "center" });
    y += 5.8;
    pen.bold(true); pen.size(13);
    doc.text(b.role, cx, y, { align: "center" });
    y += 5.4;
    pen.bold(false); pen.size(11.5);
    doc.text("วันที่ ......../......../..........", cx, y, { align: "center" });
    if (b.docLine) {
      y += 5;
      doc.text(ctx.style.signDocLine, cx, y, { align: "center" });
    }
  });
};

const drawFooter = (doc, pen, ctx, pageNo, pageCount) => {
  pen.bold(false); pen.size(10); pen.color(GRAY);
  const tie = ctx.bound
    ? `ลงทะเบียนในประวัติใบ ${ctx.pre.advance.docNo}`
    : ctx.style.showPlanned ? "ฟอร์มเปล่า ไม่ผูกใบ Advance" : "ฟอร์มสำรองจ่าย ไม่มีใบ Advance";
  doc.text(`รหัสฟอร์ม ${ctx.code} · ${tie} · ออกโดย ${ctx.issuedBy || "-"} ${thaiDateTime(ctx.issuedAt)}`, L, FOOT_Y);
  doc.text(`หน้า ${pageNo}/${pageCount}`, R, FOOT_Y, { align: "right" });
};

// ══ ประกอบทั้งฉบับ ═══════════════════════════════════════════════════════════

/**
 * วางแผนแถว: แถวที่พิมพ์รายการตั้งเบิกก่อน ตามด้วยแถวว่างเติมจนเต็มพื้นที่
 * @returns {Array<{rows: number, rowH: number, last: boolean}>} จำนวนแถวต่อหน้า
 */
export const planRows = (itemCount, firstBodyTop, nextBodyTop, afterH = AFTER_H) => {
  const room = (top, bottom, h) => Math.floor((bottom - top) / h + 1e-6);
  const minBlank = itemCount ? 2 : 0;
  for (const rowH of [ROW_H, ROW_H_TIGHT]) {
    const cap = room(firstBodyTop, SIG_TOP - afterH, rowH);
    if (itemCount + minBlank <= cap) return [{ rows: cap, rowH, last: true }];
  }
  // ล้นหน้าเดียว — ต่อหน้าถัดไป (ลายเซ็น/ยอดรวมอยู่หน้าสุดท้าย)
  const rowH = ROW_H_TIGHT;
  const pages = [];
  let left = itemCount + minBlank;
  let top = firstBodyTop;
  for (let guard = 0; guard < 10; guard += 1) {
    // หน้าสุดท้าย: รายการที่เหลือพอกับแถวสูงปกติไหม — พอก็ใช้แถวปกติ (ช่องเขียนมือกว้างกว่า)
    const capRoomy = room(top, SIG_TOP - afterH, ROW_H);
    if (left <= capRoomy) {
      pages.push({ rows: capRoomy, rowH: ROW_H, last: true });
      return pages;
    }
    const capLast = room(top, SIG_TOP - afterH, rowH);
    if (left <= capLast) {
      pages.push({ rows: capLast, rowH, last: true });
      return pages;
    }
    const cap = room(top, PAGE_BOTTOM, rowH);
    pages.push({ rows: cap, rowH, last: false });
    left -= cap;
    top = nextBodyTop;
  }
  pages.push({ rows: left, rowH, last: true });
  return pages;
};

/**
 * @param {object} opts
 * @param {"empty"|"advance"|"reimburse"} opts.variant  empty = ใบเคลมเปล่าทั้งใบ · advance = ใบเคลม
 *   พร้อมข้อมูลใบ Advance · reimburse = ใบเบิกค่าใช้จ่าย (สำรองจ่ายเอง) ที่ไม่มี Advance เลย
 * @param {object} [opts.advance]   ใบ Advance (รูปแบบเดียวกับ API) — จำเป็นเมื่อ variant = "advance"
 * @param {{code: string, issuedAt: string|Date, issuedBy: string}} opts.form  รหัสฟอร์ม
 * @param {"blob"|"open"|"download"} [opts.mode]
 */
export async function generateBlankClaimPdf({ variant = "empty", advance = null, form, mode = "blob" }) {
  const [{ jsPDF }, fontModule, bold] = await Promise.all([
    import("jspdf"),
    import("@/assets/fonts/THSarabunNew_base64"),
    loadBoldFont(),
  ]);
  const hasBold = Boolean(bold);
  const style = FORM_STYLE[variant === "reimburse" ? "reimburse" : "claim"];
  const bound = variant === "advance" && Boolean(advance);
  const items = bound ? (advance.items || []) : [];
  const pre = bound
    ? {
      to: advance.to || "",
      requester: personFullName(advance.requester),
      position: advance.requester?.position || "",
      subject: `เคลียร์ค่าใช้จ่าย ${advance.subject || ""}`.trim(),
      job: advance.job?.title ? `${jobText(advance.job)}${advance.job?.docNo ? ` (${advance.job.docNo})` : ""}` : "",
      plannedTotal: items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
      advance: {
        docNo: advance.docNo || "",
        docDate: advance.docDate || null,
        paidAt: advance.payment?.at || advance.advance?.paidAt || null,
        dueClearAt: advance.dueClearAt || null,
        total: advance.total || 0,
      },
    }
    : { to: "", requester: "", position: "", subject: "", job: "", plannedTotal: 0, advance: null };
  const ctx = { pre, bound, style, code: form.code, issuedAt: form.issuedAt, issuedBy: form.issuedBy };

  const doc = newDoc(jsPDF, fontModule.default, bold);
  const pen = makePen(doc, hasBold);
  const T = buildColumns(style);

  const tableTop1 = drawFirstPageTop(doc, pen, ctx);
  // หัวหน้าต่อ: วัดตำแหน่งจากค่าคงที่ของ drawContinuationTop (27.5 + 5)
  const plan = planRows(items.length, tableTop1 + HEAD_H, 32.5 + HEAD_H, style.afterH);

  let itemIdx = 0;
  let no = 1;
  plan.forEach((pg, p) => {
    if (p > 0) doc.addPage();
    const top = p === 0 ? tableTop1 : drawContinuationTop(doc, pen, ctx);
    let y = drawTableHead(doc, pen, T, top, style);
    for (let r = 0; r < pg.rows; r += 1) {
      y = drawRow(doc, pen, T, y, pg.rowH, no, items[itemIdx] || null);
      itemIdx += 1;
      no += 1;
    }
    if (pg.last) {
      drawAfterTable(doc, pen, T, top, y, ctx);
      drawSignatures(doc, pen, ctx);
    } else {
      closeTable(doc, T, top, y);
      pen.bold(false); pen.size(11); pen.color(GRAY);
      doc.text("มีรายการต่อหน้าถัดไป", R, y + 4.5, { align: "right" });
    }
  });
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    drawFooter(doc, pen, ctx, i, pageCount);
  }

  const formName = style.showPlanned ? "ฟอร์มใบเคลม" : "ฟอร์มใบเบิกค่าใช้จ่าย (สำรองจ่าย)";
  doc.setProperties({
    title: `${formName} ${form.code}`,
    subject: bound ? `อ้างอิง ${advance.docNo}` : `${formName}เปล่า`,
    creator: ISSUER.nameEn,
    keywords: form.code,
  });
  const name = bound
    ? `ฟอร์มเคลม ${advance.docNo} ${form.code}`
    : `${style.showPlanned ? "ฟอร์มเคลมเปล่า" : "ฟอร์มสำรองจ่ายเปล่า"} ${form.code}`;
  return outputDocument(doc, name, mode);
}

export const __test = { planRows, splitMoney, SIG_TOP, AFTER_H, AFTER_H_SIMPLE, ROW_H, ROW_H_TIGHT };
