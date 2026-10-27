/**
 * ส่งออกรายงานชั่วโมง OT รายเดือน เป็น Excel (🔁 27 ต.ค. 2569 — ชั่วโมงอย่างเดียว ไม่มีเงิน)
 * ⚠️ exceljs ใหญ่ — import แบบ dynamic จากหน้ารายงานเฉพาะตอนกดส่งออก
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import { OT_TYPES, periodLabel, otStatus, typeMeta } from "../otMeta";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";

export async function exportOtReport(report) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`OT ${report.period}`);
  ws.addRow([`รายงานชั่วโมง OT รอบ ${periodLabel(report.period)}`]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const head = ws.addRow([
    "พนักงาน",
    ...OT_TYPES.map((t) => `${t.label} (ชม.)`),
    "ชม. อนุมัติรวม", "ปิดรอบแล้ว (ชม.)", "รออนุมัติ (ชม.)",
  ]);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }; });
  report.people.forEach((p) => {
    const bt = p.approved.byType || {};
    ws.addRow([
      p.name,
      ...OT_TYPES.map((t) => bt[t.value]?.hours || 0),
      p.approved.hours + p.paid.hours, p.paid.hours, p.waiting.hours,
    ]);
  });
  // 🔁 (24 ต.ค. 2569 ผู้ใช้: "export excel ดูง่าย ครบถ้วน") แถวรวมท้ายตาราง · เส้นตาราง · ตรึงหัวตาราง · หัวคอลัมน์ตัดบรรทัด
  const nCols = head.cellCount;
  const first = head.number + 1;
  const last = ws.lastRow.number;
  if (last >= first) {
    const tot = ws.addRow(["รวมทั้งหมด", ...Array.from({ length: nCols - 1 }, (_, k) => ({ formula: `SUM(${ws.getColumn(k + 2).letter}${first}:${ws.getColumn(k + 2).letter}${last})` }))]);
    tot.font = { bold: true };
    tot.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }; });
  }
  const border = { style: "thin", color: { argb: "FFE2E8F0" } };
  for (let r = head.number; r <= ws.lastRow.number; r += 1) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (c) => { c.border = { top: border, left: border, bottom: border, right: border }; });
  }
  head.height = 32;
  head.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  ws.views = [{ state: "frozen", ySplit: head.number, xSplit: 1 }];
  ws.columns.forEach((col, i) => { col.width = i === 0 ? 28 : 16; if (i > 0) col.numFmt = "#,##0.00"; });
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `รายงาน OT ${report.period}.xlsx`);
}

/* ══ ส่งออกใบ OT ทั้งหมดจากหน้ารายการ ════════════════════════════════════════
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "หน้า OT ให้ Export Excel ได้ด้วยให้ครบถ้วน ดูง่าย สมบูรณ์") — 3 ชีต:
 *   1. สรุปรายคน   พนักงาน × เดือน — ชั่วโมงแยกประเภท · อนุมัติแล้ว · รออนุมัติ (ไม่นับใบยกเลิก/ตีกลับ)
 *   2. ใบ OT       หนึ่งแถวต่อใบ — ผู้ยื่น · ชั่วโมง · สถานะ · ผู้ตรวจสอบ/ผู้อนุมัติ
 *   3. รายการ OT   หนึ่งแถวต่อรายการ — วัน/วันหยุด · เวลา · ประเภท · ชั่วโมง · งาน · รายละเอียด
 * ทุกชีต: หัวเข้มตัวขาว · ตรึงหัว · ตัวกรอง · แถวสลับสี · แถวรวมท้าย (SUBTOTAL — กรองแล้วรวมเฉพาะที่เห็น)
 */
const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7490" } };
const ZEBRA = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFEFF" } };
const LINE = { style: "thin", color: { argb: "FFE2E8F0" } };
const DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const LIVE = (r) => !["cancelled", "rejected"].includes(r.status);
const APPROVED = (r) => ["approved", "paid"].includes(r.status);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const sheet = (wb, name, title, sub, columns, rows, { totals = [] } = {}) => {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([sub]).font = { size: 10, color: { argb: "FF64748B" } };
  const head = ws.addRow(columns.map((c) => c.h));
  head.height = 26;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEAD_FILL;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  rows.forEach((r, i) => {
    const row = ws.addRow(columns.map((c) => r[c.k] ?? ""));
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      const c = columns[n - 1];
      cell.border = { top: LINE, bottom: LINE, left: LINE, right: LINE };
      if (i % 2) cell.fill = ZEBRA;
      if (c?.num) { cell.numFmt = "#,##0.00"; cell.alignment = { horizontal: "right" }; }
      if (c?.center) cell.alignment = { horizontal: "center" };
      if (c?.wrap) cell.alignment = { wrapText: true, vertical: "top" };
    });
  });
  if (totals.length && rows.length) {
    const first = head.number + 1;
    const last = ws.lastRow.number;
    const tot = ws.addRow(columns.map((c, i) => {
      if (i === 0) return "รวมทั้งหมด";
      if (!totals.includes(c.k)) return "";
      const col = ws.getColumn(i + 1).letter;
      return { formula: `SUBTOTAL(9,${col}${first}:${col}${last})` };
    }));
    tot.eachCell({ includeEmpty: true }, (cell, n) => {
      cell.font = { bold: true };
      cell.fill = TOTAL_FILL;
      cell.border = { top: { style: "medium", color: { argb: "FF0E7490" } }, bottom: LINE, left: LINE, right: LINE };
      if (columns[n - 1]?.num) cell.numFmt = "#,##0.00";
    });
  }
  columns.forEach((c, i) => {
    const longest = Math.max(String(c.h).length, ...rows.map((r) => String(r[c.k] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(c.max || 45, Math.max(c.min || 9, longest + 2));
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } };
  return ws;
};

/**
 * @param {Array}  requests    ใบ OT (OtService.list) — ส่งตามที่เห็นในหน้า (ค้นหา/กรองแล้ว)
 * @param {Map}    [holidays]  วันที่ → { name } (ชุดเดียวกับปฏิทิน) ใช้ระบุชื่อวันหยุดในชีตรายการ
 * @param {string} [scopeLabel] ข้อความบอกขอบเขต เช่น "ทุกสถานะ"
 */
export async function exportOtList({ requests = [], holidays = null, scopeLabel = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  const sub = `ส่งออกเมื่อ ${thaiDateTime(new Date())} · ${requests.length} ใบ${scopeLabel ? ` · ${scopeLabel}` : ""} · ชั่วโมงรวมไม่นับใบที่ยกเลิก/ตีกลับ`;
  const monthOf = (r) => r.period || moment(r.docDate).format("YYYY-MM");

  // 1) สรุปรายคน × เดือน
  const people = new Map();
  requests.filter(LIVE).forEach((r) => (r.lines || []).forEach((l) => {
    const key = `${l.person?.userId}|${monthOf(r)}`;
    const p = people.get(key) || { name: l.person?.name || "-", month: monthOf(r), total: 0, approved: 0, waiting: 0, days: new Set(), ...Object.fromEntries(OT_TYPES.map((t) => [t.value, 0])) };
    p[l.type] = round2((p[l.type] || 0) + l.hours);
    p.total = round2(p.total + l.hours);
    if (APPROVED(r)) p.approved = round2(p.approved + l.hours); else p.waiting = round2(p.waiting + l.hours);
    p.days.add(String(l.date).slice(0, 10));
    people.set(key, p);
  }));
  const summary = [...people.values()]
    .sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name, "th"))
    .map((p) => ({ ...p, monthLabel: periodLabel(p.month), dayCount: p.days.size }));
  sheet(wb, "สรุปรายคน", "สรุปชั่วโมง OT รายคน รายเดือน", sub, [
    { k: "monthLabel", h: "เดือน", center: true }, { k: "name", h: "พนักงาน", min: 22 }, { k: "dayCount", h: "จำนวนวัน", center: true },
    ...OT_TYPES.map((t) => ({ k: t.value, h: `${t.label} (ชม.)`, num: true, min: 12 })),
    { k: "total", h: "รวม (ชม.)", num: true }, { k: "approved", h: "อนุมัติแล้ว (ชม.)", num: true }, { k: "waiting", h: "รออนุมัติ (ชม.)", num: true },
  ], summary, { totals: ["dayCount", ...OT_TYPES.map((t) => t.value), "total", "approved", "waiting"] });

  // 2) ใบ OT
  sheet(wb, "ใบ OT", "ใบขออนุมัติ OT", sub, [
    { k: "docNo", h: "เลขที่" }, { k: "date", h: "วันที่ยื่น", center: true }, { k: "month", h: "รอบ (เดือน)", center: true },
    { k: "requester", h: "ผู้ยื่น", min: 18 }, { k: "people", h: "พนักงาน", min: 18, max: 40 }, { k: "lines", h: "รายการ", center: true },
    { k: "hours", h: "ชั่วโมงรวม", num: true }, { k: "status", h: "สถานะ" }, { k: "jobs", h: "งานที่อิง", min: 30, max: 60 },
    { k: "reviewedBy", h: "ผู้ตรวจสอบ" }, { k: "reviewedAt", h: "วันที่ตรวจ", center: true },
    { k: "approvedBy", h: "ผู้อนุมัติ" }, { k: "approvedAt", h: "วันที่อนุมัติ", center: true }, { k: "files", h: "หลักฐาน (ไฟล์)", center: true },
    { k: "note", h: "หมายเหตุ / เหตุผลตีกลับ", wrap: true, max: 50 },
  ], requests.map((r) => ({
    docNo: r.docNo, date: thaiDate(r.docDate), month: periodLabel(monthOf(r)), requester: r.requester?.name,
    people: [...new Set((r.lines || []).map((l) => l.person?.name).filter(Boolean))].join(", "),
    lines: (r.lines || []).length, hours: LIVE(r) ? round2(r.totalHours) : 0, status: otStatus(r.status).label,
    jobs: [...new Set((r.lines || []).map((l) => l.jobTitle).filter(Boolean))].join(" / "),
    reviewedBy: r.reviewedBy?.name || "", reviewedAt: r.reviewedAt ? thaiDate(r.reviewedAt) : "",
    approvedBy: r.approvedBy?.name || "", approvedAt: r.approvedAt ? thaiDate(r.approvedAt) : "",
    files: (r.attachments || []).length || "",
    note: [r.note, r.status === "rejected" && r.rejectReason ? `ตีกลับ: ${r.rejectReason}` : ""].filter(Boolean).join(" · "),
  })), { totals: ["lines", "hours"] });

  // 3) รายการ OT
  const rows = requests.flatMap((r) => (r.lines || []).map((l) => {
    const d = String(l.date).slice(0, 10);
    return {
      sort: `${d} ${l.start}`, docNo: r.docNo, month: periodLabel(monthOf(r)), person: l.person?.name, date: thaiDate(l.date), day: DAY[moment(d).day()],
      holiday: holidays?.get?.(d)?.name || "", start: l.start, end: l.end, type: typeMeta(l.type).label, mult: `×${l.multiplier}`,
      hours: LIVE(r) ? round2(l.hours) : 0, job: l.jobTitle || "", task: l.task || "", status: otStatus(r.status).label,
    };
  })).sort((a, b) => b.sort.localeCompare(a.sort));
  sheet(wb, "รายการ OT", "รายการ OT ทุกวัน", sub, [
    { k: "date", h: "วันที่", center: true }, { k: "day", h: "วัน", center: true }, { k: "holiday", h: "วันหยุด", max: 30 },
    { k: "person", h: "พนักงาน", min: 18 }, { k: "start", h: "เริ่ม", center: true }, { k: "end", h: "เลิก", center: true },
    { k: "type", h: "ประเภท OT" }, { k: "mult", h: "อัตรา", center: true }, { k: "hours", h: "ชั่วโมง", num: true },
    { k: "job", h: "งานที่อิง", min: 30, max: 60 }, { k: "task", h: "รายละเอียดงาน", wrap: true, max: 50 },
    { k: "docNo", h: "เลขที่ใบ" }, { k: "month", h: "รอบ", center: true }, { k: "status", h: "สถานะใบ" },
  ], rows, { totals: ["hours"] });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `OT-${moment().format("YYYYMMDD-HHmm")}.xlsx`);
}
