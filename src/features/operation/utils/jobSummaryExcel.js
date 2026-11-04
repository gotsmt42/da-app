/**
 * jobSummaryExcel.js — ส่งออก "สรุปผลการดำเนินงาน" เป็น Excel
 * ชีต: สรุปสถานะ · รายเดือน · ตามโครงการ · ตามระบบงาน · ตามผู้รับผิดชอบ · รายการงาน
 * ⚠️ คอลัมน์เท่าที่ใช้เช็ค (ผู้ใช้: "จัดวางให้เช็คได้ง่ายๆ ข้อมูลไม่ยุ่งยาก ไม่เยอะ")
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { addTable, monthName } from "./workerLogExcel";
import { GROUP_BY_KEY } from "./jobSummary";

const MONEY = "#,##0.00";
const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : "");

/** @param showValue แสดงมูลค่างาน (แอดมิน/ผู้จัดการ) */
export async function exportJobSummary(jobs, summary, { periodLabel, filterLabel, fileName, showValue }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  wb.created = new Date();
  const t = summary.totals;
  const sub = [periodLabel, filterLabel, `ทั้งหมด ${t.total} งาน · เสร็จสิ้น ${t.closed} (${t.closeRate}%) · ค้างงาน ${t.overdue}`].filter(Boolean).join("  ·  ");
  const valCol = showValue ? [{ key: "value", header: "มูลค่างาน (บาท)", width: 18, align: "right", fmt: MONEY, bold: true }] : [];

  addTable(wb, "สรุปสถานะ", {
    title: "สรุปสถานะงาน", sub: `${sub}\n1 งานอยู่สถานะเดียว — ผลรวมทุกสถานะ = จำนวนงานทั้งหมด`,
    cols: [
      { key: "label", header: "สถานะ", width: 20, bold: true },
      { key: "count", header: "จำนวนงาน", width: 12, align: "center" },
      { key: "pct", header: "สัดส่วน", width: 10, align: "center" },
      { key: "hint", header: "ความหมาย", width: 42 },
    ],
    rows: summary.statusRows.map((g) => ({ label: g.label, count: g.count, pct: t.total ? `${Math.round((g.count / t.total) * 100)}%` : "–", hint: g.hint })),
    total: { label: "รวม", count: t.total, pct: "100%", hint: "" },
  });

  const groupCols = (header) => [
    { key: "key", header, width: 30, bold: true, wrap: true },
    { key: "total", header: "งานทั้งหมด", width: 11, align: "center" },
    { key: "closed", header: "เสร็จสิ้น", width: 10, align: "center" },
    { key: "open", header: "ยังไม่ปิด", width: 10, align: "center" },
    { key: "overdue", header: "ค้างงาน", width: 10, align: "center", color: (v) => (v ? "FFDC2626" : "FF94A3B8") },
    { key: "closeRate", header: "อัตราปิดงาน", width: 12, align: "center" },
    ...valCol,
  ];
  const toRow = (label) => (r) => ({ key: label ? label(r.key) : r.key, total: r.total, closed: r.closed, open: r.open, overdue: r.overdue || "", closeRate: `${r.closeRate}%`, value: r.value });
  const totalRow = { key: "รวม", total: t.total, closed: t.closed, open: t.open, overdue: t.overdue || "", closeRate: `${t.closeRate}%`, value: t.value };

  addTable(wb, "รายเดือน", { title: "สรุปรายเดือน (ตามวันเริ่มงาน)", sub, cols: groupCols("เดือน"), rows: summary.byMonth.slice().reverse().map(toRow(monthName)), total: totalRow });
  addTable(wb, "ตามโครงการ", { title: "สรุปตามโครงการ / ลูกค้า", sub, cols: groupCols("โครงการ"), rows: summary.bySite.map(toRow()), total: totalRow });
  addTable(wb, "ตามระบบงาน", { title: "สรุปตามระบบงาน", sub, cols: groupCols("ระบบงาน"), rows: summary.bySystem.map(toRow()), total: totalRow });
  addTable(wb, "ตามผู้รับผิดชอบ", { title: "สรุปตามผู้รับผิดชอบงาน", sub, cols: groupCols("ผู้รับผิดชอบ"), rows: summary.byResponsible.map(toRow()), total: totalRow });

  addTable(wb, "รายการงาน", {
    title: "รายการงาน", sub: `${sub}\n1 แถว = 1 งาน (งานที่เข้าหลายวันรวมเป็นแถวเดียว)`,
    cols: [
      { key: "start", header: "วันเริ่มงาน", width: 12, align: "center", fmt: "dd/mm/yyyy" },
      { key: "site", header: "โครงการ", width: 30, wrap: true, bold: true },
      { key: "job", header: "งาน", width: 24, wrap: true },
      { key: "responsible", header: "ผู้รับผิดชอบ", width: 16 },
      { key: "workers", header: "ผู้ปฏิบัติงาน", width: 24, wrap: true },
      { key: "status", header: "สถานะ", width: 16, align: "center", color: (v) => `FF${(Object.values(GROUP_BY_KEY).find((g) => g.label === v)?.color || "#0f172a").slice(1).toUpperCase()}` },
      { key: "overdue", header: "ค้าง (วัน)", width: 10, align: "center" },
      ...valCol,
    ],
    rows: jobs.map((j) => ({
      start: toDate(j.start), site: j.site || j.company,
      job: [j.title, j.system, j.time ? `ครั้งที่ ${j.time}` : ""].filter(Boolean).join(" · "),
      responsible: j.responsible || "ยังไม่มอบหมาย", workers: j.workers.join(", "),
      status: GROUP_BY_KEY[j.group].label, overdue: j.overdueDays ?? "", value: j.value ?? "",
    })),
    total: { start: "", site: `รวม ${jobs.length} งาน`, job: "", responsible: "", workers: "", status: "", overdue: "", value: t.value },
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
}
