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
import { statusMeta, categoryMeta, jobText, differenceMeta } from "../expenseMeta";

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
  { key: "advanced", header: "จ่ายล่วงหน้าแล้ว", width: 16 },
  { key: "actual", header: "ใช้จริง (อนุมัติ)", width: 16 },
  { key: "outstanding", header: "ค้างเคลียร์", width: 14 },
  { key: "refundDue", header: "รอรับคืน", width: 12 },
  { key: "extraDue", header: "รอจ่ายเพิ่ม", width: 12 },
  { key: "refunded", header: "รับคืนแล้ว", width: 12 },
  { key: "extraPaid", header: "จ่ายเพิ่มแล้ว", width: 12 },
];
const GROUP_MONEY = GROUP_COLS.map((c) => c.key).filter((k) => k !== "count");

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
    ["รออนุมัติ / ตีกลับ", t.pending],
    ["อนุมัติแล้ว รอจ่าย", t.toPay],
    ["จ่ายเงินล่วงหน้าแล้ว", t.advanced],
    ["ใช้จริงตามใบเคลมที่อนุมัติ", t.actual],
    ["ค้างเคลียร์ (ยังไม่มีใบเคลมที่อนุมัติ)", t.outstanding],
    ["ใบที่เลยกำหนดเคลียร์", t.overdue],
    ["รอรับเงินคืน", t.refundDue],
    ["รอจ่ายเงินเพิ่ม", t.extraDue],
    ["รับเงินคืนแล้ว", t.refunded],
    ["จ่ายเงินเพิ่มแล้ว", t.extraPaid],
  ].forEach(([label, value], i) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (![0, 7].includes(i)) row.getCell(2).numFmt = MONEY;
    row.eachCell((c) => { c.border = { bottom: BORDER }; });
  });

  // ── รายใบ ────────────────────────────────────────────────────────────
  addTable(wb.addWorksheet("รายใบ"), [
    { key: "docNo", header: "เลขที่ Advance", width: 17 },
    { key: "date", header: "วันที่", width: 13 },
    { key: "person", header: "ผู้เบิก", width: 14 },
    { key: "subject", header: "เรื่อง", width: 36 },
    { key: "job", header: "งาน", width: 30 },
    { key: "total", header: "ยอดเบิก", width: 13 },
    { key: "status", header: "สถานะ", width: 18 },
    { key: "paidAt", header: "วันที่จ่าย", width: 13 },
    { key: "dueClearAt", header: "กำหนดเคลียร์", width: 13 },
    { key: "claimNo", header: "เลขที่ใบเคลม", width: 17 },
    { key: "actual", header: "ใช้จริง", width: 13 },
    { key: "diff", header: "ส่วนต่าง (+จ่ายเพิ่ม / −คืน)", width: 16 },
    { key: "claimStatus", header: "สถานะใบเคลม", width: 20 },
  ], report.rows.map((a) => ({
    docNo: a.docNo,
    date: thaiDate(a.docDate),
    person: a.requester?.name,
    subject: a.subject,
    job: jobText(a.job),
    total: a.total,
    status: statusMeta(a.status, "advance").label,
    paidAt: a.payment?.at ? thaiDate(a.payment.at) : "",
    dueClearAt: a.dueClearAt ? thaiDate(a.dueClearAt) : "",
    claimNo: a.claim?.docNo || "",
    actual: a.claim ? a.claim.total : null,
    diff: a.claim ? a.claim.difference : null,
    claimStatus: a.claim ? `${statusMeta(a.claim.status, "claim").label}${a.claim.difference ? ` (${differenceMeta(a.claim.difference).short})` : ""}` : "",
  })), ["total", "actual", "diff"]);

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
  ], report.byCategory.map((c) => ({ ...c, label: categoryMeta(c.key).label })), ["planned", "actual"]);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
}
