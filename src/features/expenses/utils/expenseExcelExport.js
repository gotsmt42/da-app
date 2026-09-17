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

const addTable = (ws, columns, rows, moneyKeys = []) => {
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || 14 }));
  styleHeader(ws.addRow(columns.map((c) => c.header)));
  rows.forEach((r, i) => {
    const row = ws.addRow(columns.map((c) => r[c.key]));
    row.eachCell((cell, col) => {
      cell.border = { bottom: BORDER };
      if (moneyKeys.includes(columns[col - 1].key)) cell.numFmt = MONEY;
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });
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
  { key: "reimburseDue", header: "รอบริษัทจ่ายคืนพนักงาน", width: 22 },
  { key: "reimbursePaid", header: "จ่ายคืนพนักงานแล้ว", width: 18 },
];
/** ⚠️ ช่องที่เป็น "จำนวนใบ" ต้องไม่ถูกจัดรูปแบบเป็นเงิน ไม่งั้นจะอ่านเป็น 3.00 ใบ */
const GROUP_COUNTS = ["count", "reimburseCount"];
const GROUP_MONEY = GROUP_COLS.map((c) => c.key).filter((k) => !GROUP_COUNTS.includes(k));

export async function exportExpenseReport(report, { periodLabel = "", fileName = "รายงานการเบิก" } = {}) {
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
    // ✅ อนุมัติ 2 ขั้น: รอตรวจสอบ (แอดมิน) → ตรวจสอบแล้วรออนุมัติ (ผู้จัดการ)
    ["ยังไม่ผ่านอนุมัติ (รอตรวจสอบ/รออนุมัติ/ตีกลับ)", t.pending],
    ["— ในนั้น: ตรวจสอบแล้ว รออนุมัติขั้นสุดท้าย", t.reviewing],
    ["อนุมัติแล้ว รอจ่ายเงินให้พนักงาน", t.toPay],
    ["จ่ายล่วงหน้าให้พนักงานแล้ว", t.advanced],
    ["ใช้จริงตามใบเคลมที่อนุมัติ", t.actual],
    ["เงินที่ยังอยู่กับพนักงาน (ยังไม่เคลียร์)", t.outstanding],
    ["ใบที่เลยกำหนดเคลียร์", t.overdue],
    ["รอพนักงานคืนเงินบริษัท", t.refundDue],
    ["รอบริษัทจ่ายเพิ่มให้พนักงาน", t.extraDue],
    ["พนักงานคืนเงินบริษัทแล้ว", t.refunded],
    ["บริษัทจ่ายเพิ่มให้พนักงานแล้ว", t.extraPaid],
    ["จำนวนใบสำรองจ่าย (พนักงานออกเงินเอง)", t.reimburseCount],
    ["ใบสำรองจ่ายที่ยังไม่ผ่านอนุมัติ", t.reimbursePending],
    ["— ในนั้น: ตรวจสอบแล้ว รออนุมัติขั้นสุดท้าย", t.reimburseReviewing],
    ["พนักงานสำรองจ่าย (อนุมัติแล้ว)", t.reimburse],
    ["รอบริษัทจ่ายคืนพนักงาน", t.reimburseDue],
    ["บริษัทจ่ายคืนพนักงานแล้ว", t.reimbursePaid],
  ].forEach(([label, value], i) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    // ⚠️ แถวที่เป็น "จำนวนใบ" ไม่ใช่เงิน — อิงข้อความของแถวนั้น ไม่ใช่เลข index ที่เลื่อนทุกครั้งที่เพิ่มแถว
    if (!/^จำนวนใบ|^ใบที่เลยกำหนด/.test(String(label))) row.getCell(2).numFmt = MONEY;
    row.eachCell((c) => { c.border = { bottom: BORDER }; });
  });

  // ── รายใบ ────────────────────────────────────────────────────────────
  addTable(wb.addWorksheet("รายใบ"), [
    { key: "docNo", header: "เลขที่ Advance", width: 17 },
    { key: "date", header: "วันที่", width: 13 },
    { key: "person", header: "ผู้เบิก", width: 20 },
    { key: "subject", header: "เรื่อง", width: 36 },
    { key: "job", header: "งาน", width: 30 },
    { key: "total", header: "ยอดขอเบิก", width: 13 },
    { key: "status", header: "สถานะ", width: 22 },
    // ✅ อนุมัติ 2 ขั้น — ต้องเห็นว่าใครตรวจสอบและใครอนุมัติ (ตรงกับช่องลงนามในใบ PDF)
    { key: "reviewer", header: "ผู้ตรวจสอบ", width: 20 },
    { key: "approver", header: "ผู้อนุมัติ", width: 20 },
    { key: "paidAt", header: "วันที่จ่าย", width: 13 },
    { key: "payTo", header: "บัญชีที่บริษัทโอนเงินล่วงหน้าให้", width: 34 },
    { key: "dueClearAt", header: "กำหนดเคลียร์", width: 13 },
    { key: "claimNo", header: "เลขที่ใบเคลม", width: 17 },
    { key: "actual", header: "ใช้จริง", width: 13 },
    { key: "diff", header: "ส่วนต่าง (+ บริษัทจ่ายเพิ่ม / − พนักงานคืนบริษัท)", width: 26 },
    { key: "diffLabel", header: "ใครต้องจ่ายใคร", width: 24 },
    { key: "claimPayTo", header: "บัญชีที่บริษัทโอนส่วนต่างให้", width: 34 },
    { key: "claimStatus", header: "สถานะใบเคลม", width: 24 },
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
      approver: a.approvedAt && !["pending", "reviewed", "rejected"].includes(a.status) ? personFullName(a.approvedBy) : "",
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
    reviewer: r.reviewedAt ? personFullName(r.reviewedBy) : "",
    approver: r.approvedAt && !["pending", "reviewed", "rejected"].includes(r.status) ? personFullName(r.approvedBy) : "",
    // ใบสำรองจ่าย = บริษัทจ่ายคืนให้ผู้เบิกเสมอ จึงมีบัญชีรับเงินได้ทุกใบ
    payTo: payToText(r.payTo),
    paidAt: r.payment?.at ? thaiDate(r.payment.at) : "",
  })), ["total"]);

  const groupSheet = (name, firstHeader, rows) => addTable(
    wb.addWorksheet(name),
    [{ key: "label", header: firstHeader, width: 34 }, ...GROUP_COLS],
    rows,
    GROUP_MONEY
  );
  groupSheet("ตามผู้เบิก", "ผู้เบิก", report.byPerson);
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
