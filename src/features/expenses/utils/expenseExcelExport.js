/**
 * expenseExcelExport.js — ส่งออกรายงานการเบิก Advance / เคลม เป็น Excel (.xlsx)
 *
 * ✅ ตัวเลขทุกช่องมาจาก buildExpenseReport ชุดเดียวกับที่หน้าจอแสดง — ไฟล์กับหน้าจอต้องไม่ต่างกัน
 * ✅ ช่องเงินเก็บเป็น "ตัวเลขจริง" (SUM ต่อใน Excel ได้) แสดงผลด้วยรูปแบบ #,##0.00
 * ⚠️ exceljs ใหญ่ — ถูก import แบบ dynamic จากหน้ารายงานเฉพาะตอนกดส่งออก
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { thaiDate } from "@/shared/utils/thaiDate";
import { statusMeta, categoryMeta, jobText, differenceMeta, personFullName, money } from "../expenseMeta";
import { formatAccountNo, bankMeta } from "../bankMeta";

/**
 * ข้อความบัญชีรับเงินสำหรับไฟล์ Excel
 * ⚠️ โชว์เฉพาะใบที่ "บริษัทต้องโอนให้ผู้เบิก" — ใบที่ผู้เบิกต้องคืนเงินบริษัทไม่ต้องมีบัญชี
 * (เหตุผลเดียวกับในใบ PDF/หน้าจอ: ทิศทางเงินตรงข้าม ใส่ไปแล้วฝ่ายบัญชีสับสน)
 */
const payToText = (payTo) => (payTo?.accountNo
  ? `${payTo.bankName || bankMeta(payTo.bankCode).name} ${formatAccountNo(payTo.accountNo)}${payTo.accountName ? ` (${payTo.accountName})` : ""}`
  : "");

const MONEY = "#,##0.00";
const HEAD = { bg: "FF0F766E", text: "FFFFFFFF" };
const BORDER = { style: "thin", color: { argb: "FFE2E8F0" } };

const styleHeader = (row) => {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: HEAD.text } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD.bg } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });
  row.height = 22;
};

/**
 * ตารางมาตรฐานของไฟล์ — ✅ ผู้ใช้: "ทำข้อมูลใน excel ให้ดูง่าย ชัดเจน และสอดคล้อง"
 *   • หัวตารางสีเดียวกันทุกชีต · ตรึงหัวตาราง · มีปุ่มกรอง (AutoFilter) ทุกคอลัมน์
 *   • แถว "รวมทั้งหมด" ท้ายตาราง (ตัวหนา) — รวมเฉพาะช่องเงิน/จำนวน (sumKeys)
 *   • แถวที่มี __subtotal = แถวรวมย่อย (พื้นเทา ตัวหนา) · ไม่ถูกนับซ้ำในแถวรวมทั้งหมด
 * ⚠️ ใส่ "ค่า" ไม่ใช่สูตร SUM — ถ้าเป็นสูตร แถวรวมย่อยในช่วงเดียวกันจะถูกบวกซ้ำ และกรองข้อมูลแล้วยอดเพี้ยน
 */
const addTable = (ws, columns, rows, moneyKeys = [], { countKeys = [], totals = true } = {}) => {
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || 14 }));
  styleHeader(ws.addRow(columns.map((c) => c.header)));
  let stripe = 0;
  rows.forEach((r) => {
    const row = ws.addRow(columns.map((c) => r[c.key]));
    const sub = Boolean(r.__subtotal);
    if (!sub) stripe += 1;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = { bottom: BORDER };
      if (moneyKeys.includes(columns[col - 1].key)) cell.numFmt = MONEY;
      if (sub) {
        cell.font = { bold: true, color: { argb: "FF334155" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      } else if (stripe % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });
  const sumKeys = [...moneyKeys, ...countKeys];
  if (totals && rows.length && sumKeys.length) {
    const body = rows.filter((r) => !r.__subtotal);
    const vals = columns.map((c, i) => {
      if (i === 0) return "รวมทั้งหมด";
      if (!sumKeys.includes(c.key)) return null;
      const t = body.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
      return moneyKeys.includes(c.key) ? money(t) : t;
    });
    const row = ws.addRow(vals);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, color: { argb: HEAD.bg } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
      cell.border = { top: { style: "medium", color: { argb: HEAD.bg } }, bottom: BORDER };
      if (moneyKeys.includes(columns[col - 1].key)) cell.numFmt = MONEY;
    });
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
};

const GROUP_COLS = [
  { key: "count", header: "จำนวนใบ", width: 10 },
  { key: "requested", header: "ยอดขอเบิก", width: 14 },
  { key: "advanced", header: "จ่ายล่วงหน้าให้พนักงาน", width: 20 },
  { key: "actual", header: "ใช้จริง (อนุมัติแล้ว)", width: 18 },
  { key: "outstanding", header: "ยังไม่เคลียร์ (อยู่กับพนักงาน)", width: 24 },
  { key: "refundDue", header: "รอพนักงานคืนเงินบริษัท", width: 20 },
  { key: "extraDue", header: "รอบริษัทจ่ายเพิ่มให้พนักงาน", width: 24 },
  { key: "refunded", header: "พนักงานคืนบริษัทแล้ว", width: 20 },
  { key: "extraPaid", header: "บริษัทจ่ายเพิ่มแล้ว", width: 18 },
  // ── ใบสำรองจ่าย (ไม่มี Advance) ────────────────────────────────────
  { key: "reimburseCount", header: "จำนวนใบสำรองจ่าย", width: 16 },
  { key: "reimburse", header: "พนักงานสำรองจ่าย (อนุมัติ)", width: 22 },
  { key: "reimburseDue", header: "รออนุมัติเบิกจ่ายคืนพนักงาน", width: 24 },
  { key: "reimbursePaid", header: "จ่ายคืนพนักงานแล้ว", width: 18 },
];
/** ⚠️ ช่องที่เป็น "จำนวนใบ" ต้องไม่ถูกจัดรูปแบบเป็นเงิน ไม่งั้นจะอ่านเป็น 3.00 ใบ */
const GROUP_COUNTS = ["count", "reimburseCount"];
const GROUP_MONEY = GROUP_COLS.map((c) => c.key).filter((k) => !GROUP_COUNTS.includes(k));

/** ชื่อผู้ทำแต่ละขั้น — ขั้นที่ยังไม่ถึง/ถูกตีกลับเว้นว่าง (ใบที่ตีกลับถูกล้างผลตรวจสอบ/อนุมัติเดิมแล้ว) */
const reviewerOf = (d) => (d?.reviewedAt && d.status !== "rejected" ? personFullName(d.reviewedBy) : "");
const approverOf = (d) => (d?.approvedAt && !["pending", "reviewed", "rejected"].includes(d.status) ? personFullName(d.approvedBy) : "");
/** ผู้อนุมัติเบิกจ่าย (ส่วนที่ 3) = คนที่บันทึกจ่ายเงิน Advance / ปิดส่วนต่างใบเคลม / จ่ายคืนใบสำรองจ่าย */
const disburserOf = (d) => {
  const done = d?.kind === "advance" ? ["paid", "clearing", "cleared"].includes(d.status) : d?.status === "settled";
  return done && d.payment?.by ? personFullName(d.payment.by) : "";
};

export async function exportExpenseReport(report, { periodLabel = "", fileName = "รายงานการเบิก", ledger = [] } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA App";
  wb.created = new Date();

  // ── สรุป ─────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("สรุป");
  ws.columns = [{ width: 30 }, { width: 18 }];
  ws.addRow(["รายงานการเบิกเงินล่วงหน้า (Advance) และเคลียร์ค่าใช้จ่าย"]).font = { bold: true, size: 14 };
  ws.addRow([`ช่วงเวลา: ${periodLabel || "ทั้งหมด"} · ส่งออกเมื่อ ${thaiDate(new Date())}`]).font = { color: { argb: "FF64748B" } };
  ws.addRow([]);
  const t = report.totals;
  [
    ["จำนวนใบ Advance", t.count],
    ["ยอดขอเบิกทั้งหมด", t.requested],
    // ✅ สายอนุมัติ 3 ส่วน: ส่งขอเบิก → ตรวจสอบ/อนุมัติ (แอดมินตรวจ → ผู้จัดการอนุมัติ) → อนุมัติเบิกจ่าย
    ["ยังไม่ผ่านอนุมัติ (รอตรวจสอบ/รออนุมัติ/ตีกลับ)", t.pending],
    ["— ในนั้น: ตรวจสอบแล้ว รออนุมัติ", t.reviewing],
    ["อนุมัติแล้ว รออนุมัติเบิกจ่าย Advance", t.toPay],
    ["จ่ายล่วงหน้าให้พนักงานแล้ว", t.advanced],
    ["ใช้จริงตามใบเคลมที่อนุมัติ", t.actual],
    ["เงินที่ยังอยู่กับพนักงาน (ยังไม่เคลียร์)", t.outstanding],
    ["ใบที่เลยกำหนดเคลียร์", t.overdue],
    ["รอพนักงานคืนเงินบริษัท (รอยืนยันรับเงินคืน)", t.refundDue],
    ["รอบริษัทจ่ายเพิ่มให้พนักงาน (รออนุมัติเบิกจ่าย)", t.extraDue],
    ["พนักงานคืนเงินบริษัทแล้ว", t.refunded],
    ["บริษัทจ่ายเพิ่มให้พนักงานแล้ว", t.extraPaid],
    ["จำนวนใบสำรองจ่าย (พนักงานออกเงินเอง)", t.reimburseCount],
    ["ใบสำรองจ่ายที่ยังไม่ผ่านอนุมัติ", t.reimbursePending],
    ["— ในนั้น: ตรวจสอบแล้ว รออนุมัติ", t.reimburseReviewing],
    ["พนักงานสำรองจ่าย (อนุมัติแล้ว)", t.reimburse],
    ["รออนุมัติเบิกจ่ายคืนพนักงาน", t.reimburseDue],
    ["บริษัทจ่ายคืนพนักงานแล้ว", t.reimbursePaid],
  ].forEach(([label, value], i) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    // ⚠️ แถวที่เป็น "จำนวนใบ" ไม่ใช่เงิน — อิงข้อความของแถวนั้น ไม่ใช่เลข index ที่เลื่อนทุกครั้งที่เพิ่มแถว
    if (!/^จำนวนใบ|^ใบที่เลยกำหนด/.test(String(label))) row.getCell(2).numFmt = MONEY;
    row.eachCell((c) => { c.border = { bottom: BORDER }; });
  });

  // ── ใบที่ค้างตามขั้นอนุมัติ (3 ส่วน) ─────────────────────────────────────
  // ✅ ผู้ใช้สั่งให้รายงานตรงกับลำดับการเบิกใหม่ — เห็นทันทีว่างานค้างอยู่ที่ขั้นไหน รอใคร
  ws.addRow([]);
  ws.addRow(["ใบที่ค้างตามขั้นอนุมัติ", "จำนวนใบ", "ยอดเงิน", "Advance", "ใบเคลม", "สำรองจ่าย", "ผู้ดำเนินการ"]).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  });
  ws.getColumn(3).width = 16;
  [4, 5, 6].forEach((n) => { ws.getColumn(n).width = 11; });
  ws.getColumn(7).width = 36;
  const pl = report.pipeline || {};
  [
    ["ขั้นที่ 2/3 · รอตรวจสอบ", pl.review, "แอดมินช่าง / ผู้จัดการแผนกช่าง", (p) => p.amount],
    ["ขั้นที่ 2/3 · ตรวจสอบแล้ว รออนุมัติ", pl.approve, "ผู้จัดการแผนกช่าง", (p) => p.amount],
    ["ขั้นที่ 3/3 · รออนุมัติเบิกจ่าย (เงินจ่ายออก)", pl.disburse, "ผู้จัดการแผนกช่าง / กรรมการผู้จัดการ", (p) => p.payOut],
  ].forEach(([label, p = {}, who, amountOf]) => {
    const row = ws.addRow([label, p.count || 0, amountOf(p) || 0, p.advance || 0, p.claim || 0, p.reimburse || 0, who]);
    row.getCell(1).font = { bold: true };
    row.getCell(3).numFmt = MONEY;
    row.eachCell((c) => { c.border = { bottom: BORDER }; });
  });
  if (pl.disburse?.payIn) {
    const row = ws.addRow(["— ในขั้นที่ 3: รอยืนยันรับเงินคืนจากพนักงาน", "", pl.disburse.payIn]);
    row.getCell(3).numFmt = MONEY;
  }

  // ── รายบุคคล (ตามชื่อในรายการ) ───────────────────────────────────────────
  // ✅ ผู้ใช้ขอ: นาย A เบิกเบี้ยเลี้ยงใส่ชื่อนาย B → ต้องรู้ว่านาย B ถูกเบิกให้เท่าไร (ดู buildPersonLedger)
  // ⚠️ คิดจาก "ชื่อเจ้าของแต่ละบรรทัด" ไม่ใช่ผู้เบิก — ยอดรวมจึงไม่จำเป็นต้องเท่าชีต "ตามผู้เบิก" ทีละคน
  //    แต่ยอดรวมทุกคนของ "ขอเบิก" เท่ากับรายการทั้งหมดในใบ Advance + ใบสำรองจ่าย
  if (ledger.length) {
    addTable(wb.addWorksheet("รายบุคคล"), [
      { key: "label", header: "ชื่อ (ตามรายการ)", width: 26 },
      { key: "lineCount", header: "จำนวนรายการ", width: 12 },
      { key: "requested", header: "ยอดของคนนี้ (ขอเบิก)", width: 17 },
      { key: "self", header: "เบิกเอง", width: 13 },
      { key: "byOthers", header: "คนอื่นเบิกให้", width: 14 },
      { key: "requesters", header: "คนอื่นเบิกให้ (โดย)", width: 32 },
      { key: "forOthers", header: "เบิกให้คนอื่น (ไม่นับเป็นของตัวเอง)", width: 22 },
      { key: "beneficiaries", header: "เบิกให้ใคร", width: 32 },
      { key: "onSlips", header: "ยอดในใบที่เป็นผู้เบิก", width: 18 },
      { key: "claimedByOthers", header: "คนอื่นเคลมให้ (ใช้จริง)", width: 18 },
      { key: "claimedForOthers", header: "เคลมให้คนอื่น (ใช้จริง)", width: 18 },
      { key: "advanced", header: "จ่ายล่วงหน้าแล้ว (Advance)", width: 20 },
      { key: "actual", header: "ใช้จริง (ใบเคลมอนุมัติ)", width: 20 },
      { key: "reimburse", header: "สำรองจ่าย (อนุมัติ)", width: 18 },
      { key: "approvedCost", header: "ค่าใช้จ่ายอนุมัติรวม", width: 18 },
      { key: "categories", header: "แยกตามหมวด (ยอดขอเบิก)", width: 44 },
    ], ledger.map((p) => ({
      label: p.label,
      lineCount: p.lines.length,
      requested: p.requested, self: p.self, byOthers: p.byOthers, forOthers: p.forOthers, onSlips: p.onSlips, claimedByOthers: p.claimedByOthers, claimedForOthers: p.claimedForOthers,
      beneficiaries: p.beneficiaries.map((r) => `${r.name} ${r.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`).join(", "),
      requesters: p.requesters.map((r) => `${r.name} ${r.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`).join(", "),
      advanced: p.advanced, actual: p.actual, reimburse: p.reimburse, approvedCost: p.approvedCost,
      categories: p.categories.map((c) => `${categoryMeta(c.key).label} ${c.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`).join(", "),
    })), ["requested", "self", "byOthers", "forOthers", "onSlips", "claimedByOthers", "claimedForOthers", "advanced", "actual", "reimburse", "approvedCost"], { countKeys: ["lineCount"] });

    const SOURCE_LABEL = { advance: "การเบิก · ใบ Advance", claim: "การเคลม · ใช้จริง", reimburse: "การเบิก · ใบสำรองจ่าย" };
    const SOURCE_KIND = { advance: "advance", claim: "claim", reimburse: "reimburse" };
    // ✅ แยกยอด "ขอเบิก" กับ "ใช้จริง" คนละคอลัมน์ (ตรงกับหน้าจอ) — เดิมคอลัมน์ยอดเดียวปนสองความหมาย รวมแล้วไม่มีความหมาย
    //    แต่ละคน: การเบิกก่อน แล้วการเคลม · ปิดท้ายด้วยแถวรวมย่อยของคนนั้น
    const lineRows = ledger.flatMap((p) => {
      const lines = [...p.lines].sort((x, y) => (x.source === "claim") - (y.source === "claim"));
      const out = lines.map((l) => ({
        person: p.label,
        date: thaiDate(l.date),
        source: SOURCE_LABEL[l.source] || l.source,
        docNo: l.docNo,
        pairNo: l.source === "claim" ? l.parentNo : "",
        requester: l.byOther ? l.requester : "เบิกเอง",
        sharedWith: (l.sharedWith || []).join(", "),
        category: categoryMeta(l.category).label,
        description: l.description && l.description !== categoryMeta(l.category).label ? l.description : "",
        requested: l.source === "claim" ? null : l.amount,
        actual: l.source === "claim" ? l.amount : null,
        status: statusMeta(l.status, SOURCE_KIND[l.source]).label,
      }));
      out.push({
        __subtotal: true, person: `รวม ${p.label}`, source: `${lines.length} รายการ`,
        requested: money(p.requested), actual: money(p.actual),
      });
      return out;
    });
    addTable(wb.addWorksheet("รายการรายบุคคล"), [
      { key: "person", header: "ชื่อ (ตามรายการ)", width: 24 },
      { key: "date", header: "วันที่", width: 13 },
      { key: "source", header: "ประเภท", width: 20 },
      { key: "docNo", header: "เลขที่ใบ", width: 17 },
      { key: "pairNo", header: "เคลียร์ใบ Advance", width: 17 },
      { key: "requester", header: "เบิก/เคลมโดย", width: 20 },
      { key: "sharedWith", header: "ใบนี้มีรายการของ", width: 22 },
      { key: "category", header: "หมวด", width: 18 },
      { key: "description", header: "รายละเอียด", width: 30 },
      { key: "requested", header: "ยอดขอเบิก", width: 13 },
      { key: "actual", header: "ยอดใช้จริง (เคลม)", width: 15 },
      { key: "status", header: "สถานะใบ", width: 22 },
    ], lineRows, ["requested", "actual"]);
  }

  // ── รายใบ ────────────────────────────────────────────────────────────
  addTable(wb.addWorksheet("รายใบ Advance+เคลม"), [
    { key: "docNo", header: "เลขที่ Advance", width: 17 },
    { key: "date", header: "วันที่", width: 13 },
    { key: "person", header: "ผู้เบิก", width: 20 },
    { key: "subject", header: "เรื่อง", width: 36 },
    { key: "job", header: "งาน", width: 30 },
    { key: "total", header: "ยอดขอเบิก", width: 13 },
    { key: "status", header: "สถานะ", width: 22 },
    // ✅ เก็บชื่อ "ผู้ตรวจสอบ" กับ "ผู้อนุมัติ" แยกคอลัมน์ไว้ (เอกสารรวมเป็นช่องเดียว แต่รายงานต้องตรวจย้อนได้ว่าใครทำมือไหน)
    { key: "reviewer", header: "ผู้ตรวจสอบ", width: 20 },
    { key: "approver", header: "ผู้อนุมัติ", width: 20 },
    { key: "disburser", header: "ผู้อนุมัติเบิกจ่าย", width: 20 },
    { key: "paidAt", header: "วันที่จ่ายเงิน", width: 13 },
    { key: "payTo", header: "บัญชีที่บริษัทโอนเงินล่วงหน้าให้", width: 34 },
    { key: "dueClearAt", header: "กำหนดเคลียร์", width: 13 },
    { key: "claimNo", header: "เลขที่ใบเคลม", width: 17 },
    { key: "actual", header: "ใช้จริง", width: 13 },
    { key: "diff", header: "ส่วนต่าง (+ บริษัทจ่ายเพิ่ม / − พนักงานคืนบริษัท)", width: 26 },
    { key: "diffLabel", header: "ใครต้องจ่ายใคร", width: 24 },
    { key: "claimPayTo", header: "บัญชีที่บริษัทโอนส่วนต่างให้", width: 34 },
    { key: "claimStatus", header: "สถานะใบเคลม", width: 30 },
    { key: "claimReviewer", header: "ผู้ตรวจสอบใบเคลม", width: 20 },
    { key: "claimApprover", header: "ผู้อนุมัติใบเคลม", width: 20 },
    { key: "claimDisburser", header: "ผู้อนุมัติเบิกจ่าย/รับคืนส่วนต่าง", width: 26 },
  ], report.rows.map((a) => {
    const claim = a.claim || null;
    const diff = claim ? money(claim.difference) : null;
    return {
      docNo: a.docNo,
      date: thaiDate(a.docDate),
      person: personFullName(a.requester),
      subject: a.subject,
      job: jobText(a.job),
      total: a.total,
      status: statusMeta(a.status, "advance").label,
      reviewer: a.reviewedAt ? personFullName(a.reviewedBy) : "",
      approver: approverOf(a),
      disburser: disburserOf(a),
      paidAt: a.payment?.at ? thaiDate(a.payment.at) : "",
      payTo: payToText(a.payTo),
      dueClearAt: a.dueClearAt ? thaiDate(a.dueClearAt) : "",
      claimNo: claim?.docNo || "",
      actual: claim ? claim.total : null,
      diff,
      diffLabel: claim ? differenceMeta(diff, "claim").label : "",
      // ⚠️ ส่วนต่างติดลบ = ผู้เบิกคืนเงินบริษัท ไม่มีการโอนเข้าบัญชีผู้เบิก จึงต้องเว้นช่องนี้ไว้
      claimPayTo: claim && diff > 0 ? payToText(claim.payTo) : "",
      claimStatus: claim ? `${statusMeta(claim.status, "claim").label}${diff ? ` (${differenceMeta(diff, "claim").short})` : ""}` : "",
      claimReviewer: claim ? reviewerOf(claim) : "",
      claimApprover: claim ? approverOf(claim) : "",
      claimDisburser: claim ? (claim.status === "settled" && !diff ? "ไม่มีส่วนต่าง" : disburserOf(claim)) : "",
    };
  }), ["total", "actual", "diff"]);

  // ── ใบสำรองจ่าย ──────────────────────────────────────────────────────
  // ✅ แยกชีตของตัวเอง — ใบพวกนี้ไม่มีคอลัมน์ "ยอดเบิก/กำหนดเคลียร์/ใบเคลม" ให้กรอก ยัดรวมชีตเดียวกับ
  // ใบ Advance จะได้ตารางที่มีช่องว่างครึ่งตารางและอ่านยอดรวมผิดได้ง่าย
  addTable(wb.addWorksheet("ใบสำรองจ่าย"), [
    { key: "docNo", header: "เลขที่", width: 17 },
    { key: "date", header: "วันที่", width: 13 },
    { key: "person", header: "ผู้เบิก", width: 20 },
    { key: "subject", header: "เรื่อง", width: 36 },
    { key: "job", header: "งาน", width: 30 },
    { key: "total", header: "ยอดที่บริษัทต้องจ่ายคืนพนักงาน", width: 24 },
    { key: "status", header: "สถานะ", width: 22 },
    { key: "reviewer", header: "ผู้ตรวจสอบ", width: 20 },
    { key: "approver", header: "ผู้อนุมัติ", width: 20 },
    { key: "disburser", header: "ผู้อนุมัติเบิกจ่าย", width: 20 },
    { key: "payTo", header: "บัญชีที่บริษัทโอนคืนให้พนักงาน", width: 34 },
    { key: "paidAt", header: "วันที่จ่ายคืนพนักงาน", width: 16 },
  ], (report.reimburseRows || []).map((r) => ({
    docNo: r.docNo,
    date: thaiDate(r.docDate),
    person: personFullName(r.requester),
    subject: r.subject,
    job: jobText(r.job),
    total: r.total,
    status: statusMeta(r.status, "reimburse").label,
    reviewer: reviewerOf(r),
    approver: approverOf(r),
    disburser: disburserOf(r),
    // ใบสำรองจ่าย = บริษัทจ่ายคืนให้ผู้เบิกเสมอ จึงมีบัญชีรับเงินได้ทุกใบ
    payTo: payToText(r.payTo),
    paidAt: r.payment?.at ? thaiDate(r.payment.at) : "",
  })), ["total"]);

  const groupSheet = (name, firstHeader, rows) => addTable(
    wb.addWorksheet(name),
    [{ key: "label", header: firstHeader, width: 34 }, ...GROUP_COLS],
    rows,
    GROUP_MONEY,
    { countKeys: GROUP_COUNTS }
  );
  // ⚠️ ชีตนี้ยึด "ผู้เบิก" (เงินอยู่กับใคร) — ต่างจากชีตรายบุคคลที่ยึดชื่อในรายการ
  groupSheet("ตามผู้เบิก (เงินค้าง)", "ผู้เบิก", report.byPerson);
  groupSheet("ตามงาน", "งาน", report.byJob);
  groupSheet("รายเดือน", "เดือน", report.byMonth.map((m) => ({ ...m, label: m.key ? thaiDate(`${m.key}-15`).replace(/^\d+\s/, "") : "-" })));

  addTable(wb.addWorksheet("ตามหมวด"), [
    { key: "label", header: "หมวดค่าใช้จ่าย", width: 24 },
    { key: "planned", header: "ตั้งเบิก (Advance ที่จ่ายแล้ว)", width: 22 },
    { key: "actual", header: "ใช้จริง (ใบเคลมที่อนุมัติ)", width: 22 },
    { key: "reimburse", header: "สำรองจ่าย (อนุมัติ)", width: 20 },
  ], report.byCategory.map((c) => ({ ...c, label: categoryMeta(c.key).label })), ["planned", "actual", "reimburse"]);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
}
