/**
 * ส่งออกรายงาน OT รายเดือน (สำหรับทำเงินเดือน) เป็น Excel
 * ⚠️ exceljs ใหญ่ — import แบบ dynamic จากหน้ารายงานเฉพาะตอนกดส่งออก
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { OT_TYPES, periodLabel } from "../otMeta";

export async function exportOtReport(report) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`OT ${report.period}`);
  ws.addRow([`รายงาน OT รอบเงินเดือน ${periodLabel(report.period)}`]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const head = ws.addRow([
    "พนักงาน",
    ...OT_TYPES.map((t) => `${t.label} (ชม.)`),
    ...OT_TYPES.map((t) => `${t.label} (บาท)`),
    "ชม. อนุมัติรวม", "ยอดอนุมัติรวม (บาท)", "จ่ายแล้ว (บาท)", "รออนุมัติ (ชม.)",
  ]);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }; });
  report.people.forEach((p) => {
    const bt = p.approved.byType || {};
    ws.addRow([
      p.name,
      ...OT_TYPES.map((t) => bt[t.value]?.hours || 0),
      ...OT_TYPES.map((t) => bt[t.value]?.amount || 0),
      p.approved.hours + p.paid.hours, p.approved.amount + p.paid.amount, p.paid.amount, p.waiting.hours,
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
