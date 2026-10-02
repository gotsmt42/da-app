/**
 * ส่งออกรายงานใบขอซื้อ (PR) เป็น Excel — 4 ชีต: สรุป · รายใบ · ตามร้านค้า · รายการสินค้า
 * ⚠️ exceljs ใหญ่ — import แบบ dynamic จากหน้ารายงานเฉพาะตอนกดส่งออก
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { thaiDate } from "@/shared/utils/thaiDate";
import { prStatus, priorityMeta, prJobText } from "../prMeta";
import { pendingReceiveOf } from "./prReport";

const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

const sheet = (wb, name, title, headers, rows, widths, moneyCols = []) => {
  const ws = wb.addWorksheet(name);
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const head = ws.addRow(headers);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = HEAD_FILL; });
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => {
    col.width = widths[i] || 14;
    if (moneyCols.includes(i)) col.numFmt = "#,##0.00";
  });
  ws.views = [{ state: "frozen", ySplit: 3 }];
  return ws;
};

export async function exportPrReport(report, rows, { periodLabel, fileName }) {
  const wb = new ExcelJS.Workbook();
  const t = report.totals;

  const sum = wb.addWorksheet("สรุป");
  sum.addRow([`รายงานใบขอซื้อสินค้า (PR) · ${periodLabel}`]).font = { bold: true, size: 14 };
  sum.addRow([]);
  [
    ["จำนวนใบทั้งหมด", t.count],
    ["ยอดประมาณการรวม (ไม่รวมใบยกเลิก)", t.est],
    ["ยอดสั่งซื้อจริง", t.actual],
    ["ส่วนต่างประมาณการ − ซื้อจริง (ประหยัดได้)", report.saving],
    ["รอตรวจสอบ/อนุมัติ", t.waitApproval],
    ["อนุมัติแล้ว รอสั่งซื้อ", t.waitOrder],
    ["มูลค่าของที่ยังไม่ได้รับ", t.pendingReceive],
    ["ใบที่เลยวันต้องใช้", t.late],
  ].forEach((r) => sum.addRow(r));
  sum.getColumn(1).width = 42;
  sum.getColumn(2).width = 18;
  sum.getColumn(2).numFmt = "#,##0.00";

  sheet(wb, "รายใบ", `รายใบขอซื้อ · ${periodLabel}`,
    ["เลขที่", "วันที่", "ผู้ขอซื้อ", "เรื่อง", "งาน / โครงการ", "ความเร่งด่วน", "ต้องใช้ภายใน", "ร้านค้า", "เลขที่ PO", "ยอดประมาณการ", "ยอดสั่งซื้อจริง", "ของค้างรับ (มูลค่า)", "สถานะ"],
    rows.map((r) => [
      r.docNo, thaiDate(r.docDate), r.requester?.name || "-", r.subject,
      r.eventId ? prJobText(r.job) : "ไม่ผูกงาน", priorityMeta(r.priority).label,
      r.neededBy ? thaiDate(r.neededBy) : "", r.order?.supplier || "", r.order?.poNo || "",
      r.status === "cancelled" ? 0 : Number(r.estTotal) || 0, Number(r.actualTotal) || 0, pendingReceiveOf(r), prStatus(r.status).label,
    ]),
    [16, 14, 22, 36, 32, 12, 14, 24, 14, 16, 16, 16, 22], [9, 10, 11]);

  sheet(wb, "ตามร้านค้า", `ยอดสั่งซื้อตามร้านค้า · ${periodLabel}`,
    ["ร้านค้า", "จำนวนใบ", "ยอดสั่งซื้อจริง", "ของค้างรับ (มูลค่า)", "รับครบแล้ว (ใบ)"],
    report.bySupplier.map((g) => [g.label, g.count, g.actual, g.pendingReceive, g.received]),
    [32, 12, 18, 18, 16], [2, 3]);

  sheet(wb, "รายการสินค้า", `สินค้าที่ขอซื้อ · ${periodLabel}`,
    ["สินค้า", "หน่วย", "จำนวนรวม", "จำนวนใบ", "ราคา/หน่วย ต่ำสุด", "ราคา/หน่วย สูงสุด", "มูลค่ารวม"],
    report.topItems.map((g) => [g.name, g.unit, g.qty, g.docs, g.minPrice, g.maxPrice, g.amount]),
    [40, 10, 12, 10, 16, 16, 16], [4, 5, 6]);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
}
