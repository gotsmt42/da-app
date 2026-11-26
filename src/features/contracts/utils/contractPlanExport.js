/**
 * contractPlanExport.js — ส่งออก "แผนงานทั้งปี"
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "หน้าภาพรวมงานสามารถกดออกแผนงานทั้งปี … ทำให้มันสมบูรณ์ และต่อเป็นต่อปีด้วยนะ")
 *   • exportContractPlanExcel — แผนของสัญญาเดียว รายครั้ง + การเข้างานจริง (ใช้ภายใน)
 *   • เอกสารส่งลูกค้า (มีที่เซ็น/ลายเซ็นอิเล็กทรอนิกส์) = ใบแจ้งเข้างานแบบ "ระบุแค่เดือน" (WorkNoticeDialog + planPreset)
 *   • exportYearPlanExcel     — ทุกสัญญาในปี พ.ศ. ที่เลือก: แถวละสัญญา × 12 เดือน + รวมจำนวนงานต่อเดือน
 * ตัวเลข/เดือนทั้งหมดมาจาก buildContractPlan (src/shared/utils/contractPlan.js) ตัวเดียวกับหน้าจอ
 */
import moment from "moment";
import { ISSUER } from "@/features/documents/utils/deliveryNotePdf";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { TH_MONTHS, PLAN_STATES, thaiMonthLabel, roundsByMonthOfYear } from "@/shared/utils/contractPlan";

/** ป้ายสั้นของสัญญา (ใช้ทั้งชื่อไฟล์และหัวกระดาษ) */
const contractTitle = (c) => [c.contractNo, c.site || c.company].filter(Boolean).join(" ");
const periodText = (c) => {
  if (!c.contractStart && !c.contractEnd) return "-";
  return `${c.contractStart ? thaiDate(c.contractStart) : "?"} – ${c.contractEnd ? thaiDate(c.contractEnd) : "?"}`;
};
const cadenceText = (plan) => `ทุก ${plan.interval} เดือน · ปีละ ${plan.per} ครั้ง · ${plan.years} ปี (รวม ${plan.total} ครั้ง)`;
const actualText = (r) => (r.visits.length ? r.visits.map((v) => formatEventDateRange(v)).join(", ") : "");

// ═══════════════════════════════ Excel ═══════════════════════════════
const X = {
  head: "FF1E293B", headText: "FFFFFFFF", title: "FF0F172A", sub: "FF64748B", border: "FFE2E8F0", zebra: "FFF8FAFC",
};
const argb = (h) => `FF${h.replace("#", "").toUpperCase()}`;
const border = { top: { style: "thin", color: { argb: X.border } }, left: { style: "thin", color: { argb: X.border } }, bottom: { style: "thin", color: { argb: X.border } }, right: { style: "thin", color: { argb: X.border } } };
const save = async (wb, fileName) => {
  const { saveAs } = await import("file-saver");
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName.replace(/[/\\:*?"<>|]/g, "-"));
};
const headRow = (ws, values) => {
  const row = ws.addRow(values);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: X.headText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.head } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  row.height = 22;
  return row;
};

export async function exportContractPlanExcel({ contract: c, plan }) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = ISSUER.nameEn;
  const ws = wb.addWorksheet("แผนงานทั้งปี", { views: [{ state: "frozen", ySplit: 7 }] });
  ws.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 30 }, { width: 22 }, { width: 14 }];
  ws.addRow([`แผนการเข้าปฏิบัติงาน — ${contractTitle(c)}`]).font = { bold: true, size: 15, color: { argb: X.title } };
  ws.addRow([`ลูกค้า: ${c.company || "-"} · โครงการ: ${c.site || "-"}`]).font = { color: { argb: X.sub } };
  ws.addRow([`งาน/ระบบ: ${[c.title, c.system].filter(Boolean).join(" · ") || "-"} · ระยะสัญญา: ${periodText(c)}`]).font = { color: { argb: X.sub } };
  ws.addRow([`รอบการเข้า: ${cadenceText(plan)} · ครั้งที่ 1: ${thaiMonthLabel(plan.firstMonth, { full: true })}`]).font = { color: { argb: X.sub } };
  ws.addRow([`ส่งออกเมื่อ ${thaiDateTime(new Date())}`]).font = { color: { argb: X.sub }, size: 9 };
  ws.addRow([]);
  headRow(ws, ["ปีสัญญา", "ครั้งที่", "เดือนตามแผน", "วันที่เข้าจริง", "สถานะ", "เลื่อนจากแผน"]);
  plan.rounds.forEach((r, i) => {
    const g = plan.groups.find((x) => x.yearIdx === r.yearIdx);
    const row = ws.addRow([
      `ปีที่ ${r.yearIdx} · ${g?.label || ""}`, r.label, thaiMonthLabel(r.month, { full: true }) + (r.manual ? " (แก้เอง)" : ""), actualText(r) || "-",
      PLAN_STATES[r.state].label, r.shift ? `${r.shift > 0 ? "+" : ""}${r.shift} เดือน` : "",
    ]);
    row.eachCell((cell) => {
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (i % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.zebra } };
    });
    row.getCell(5).font = { bold: true, color: { argb: argb(PLAN_STATES[r.state].color) } };
  });
  await save(wb, `แผนงานทั้งปี ${contractTitle(c)}.xlsx`);
}

/**
 * @param {number} opts.year  ปี พ.ศ.
 * @param {Array}  opts.items [{ contract, plan, estimated, note }]
 */
export async function exportYearPlanExcel({ year, items, includeProjected = false }) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = ISSUER.nameEn;
  const ws = wb.addWorksheet(`แผนงานปี ${year}`, { views: [{ state: "frozen", xSplit: 4, ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  ws.columns = [{ width: 6 }, { width: 16 }, { width: 30 }, { width: 24 }, { width: 18 }, ...TH_MONTHS.map(() => ({ width: 9 })), { width: 8 }];
  ws.addRow([`แผนงานเข้าปฏิบัติงานประจำปี ${year}`]).font = { bold: true, size: 15, color: { argb: X.title } };
  ws.addRow([`${items.length} สัญญา · ส่งออกเมื่อ ${thaiDateTime(new Date())}${includeProjected ? " · รวมประมาณการปีถัดไปของสัญญาที่ยังไม่ต่อ" : ""} · ช่องสี = เดือนที่มีงาน (ตัวเลข = ครั้งที่/ปีละกี่ครั้ง)`]).font = { color: { argb: X.sub } };
  ws.addRow([]);
  headRow(ws, ["#", "เลขที่สัญญา", "ลูกค้า / โครงการ", "งาน / ระบบ", "รอบ", ...TH_MONTHS.map((m) => `${m} ${String(year).slice(-2)}`), "รวม"]);
  const perMonth = Array(12).fill(0);
  items.forEach(({ contract: c, plan, estimated }, i) => {
    const cells = roundsByMonthOfYear(plan, year);
    const count = cells.reduce((s, x) => s + x.length, 0);
    cells.forEach((x, m) => { perMonth[m] += x.length; });
    const row = ws.addRow([
      i + 1, c.contractNo || "-", [c.company, c.site].filter(Boolean).join("\n"), [c.title, c.system].filter(Boolean).join(" · "),
      `ทุก ${plan.interval} ด.${estimated ? " (ประมาณ)" : ""}`,
      ...cells.map((x) => x.map((r) => `${r.inYear}/${plan.per}`).join("\n")),
      count,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = border;
      cell.alignment = { vertical: "middle", horizontal: col >= 6 ? "center" : "left", wrapText: true };
      if (i % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.zebra } };
    });
    cells.forEach((x, m) => {
      if (!x.length) return;
      const st = PLAN_STATES[x[0].state];
      const cell = row.getCell(6 + m);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(st.bg === "#ffffff" ? "#f1f5f9" : st.bg) } };
      cell.font = { bold: true, color: { argb: argb(st.color) }, italic: x[0].projected };
    });
    if (estimated) row.getCell(5).font = { italic: true, color: { argb: X.sub } };
  });
  const total = ws.addRow(["", "", "รวมงานต่อเดือน", "", "", ...perMonth, perMonth.reduce((a, b) => a + b, 0)]);
  total.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { bold: true, color: { argb: X.headText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.head } };
    cell.alignment = { vertical: "middle", horizontal: col >= 6 ? "center" : "left" };
    cell.border = border;
  });
  ws.addRow([]);
  ws.addRow(["", "สี:", Object.values(PLAN_STATES).map((s) => s.label).join(" · ")]).font = { color: { argb: X.sub }, size: 9 };
  await save(wb, `แผนงานทั้งปี ${year} (${moment().format("DD-MM")}).xlsx`);
}
