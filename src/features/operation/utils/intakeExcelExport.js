import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { isUrgent } from "@/shared/utils/jobFlow";

/**
 * intakeExcelExport.js — ส่งออกรายการหน้า "งานเข้า · รับงาน" เป็น Excel (.xlsx)
 *
 * ✅ (24 ต.ค. 2569 ผู้ใช้: "ต้องการปุ่ม Excel หน้ารับงาน")
 *    1 แถว = 1 งานตามที่เห็นบนหน้าจอ (แท็บ + คำค้นที่เลือกอยู่) · หัวตาราง/สีชุดเดียวกับ Excel หน้าการดำเนินงาน
 *    วันที่เป็น Date จริง ยอดเงินเป็นตัวเลขจริง — เรียง/กรอง/รวมยอดใน Excel ได้ทันที
 */

const C = {
  headerBg: "FF1E293B",
  headerText: "FFFFFFFF",
  groupBg: "FF475569",
  titleText: "FF0F172A",
  subtitleText: "FF64748B",
  zebra: "FFF8FAFC",
  border: "FFE2E8F0",
  danger: "FFDC2626",
  muted: "FF94A3B8",
};

const thinBorder = Object.fromEntries(["top", "left", "bottom", "right"].map((k) => [k, { style: "thin", color: { argb: C.border } }]));

/** "#16a34a" → "FF16A34A" */
const argb = (hex) => (hex && /^#[0-9a-f]{6}$/i.test(hex) ? `FF${hex.slice(1).toUpperCase()}` : C.titleText);

const DOC_TYPE = { po: "ใบสั่งซื้อ (PO)", quotation: "ใบเสนอราคา", other: "เอกสารอื่น" };

/**
 * @param rows      [{ j, s, oc }] — งาน · ขั้นตอน (stageOf) · ผลเสนอราคา (outcomeOf) ชุดเดียวกับหน้าจอ
 * @param meta      { tabLabel, search }
 * @param helpers   { sourceText(j), scheduleText(j) } — ข้อความเดียวกับที่แสดงบนหน้าจอ
 */
export async function exportIntakeToExcel({ rows, meta, sourceText, scheduleText }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  wb.created = new Date();
  const ws = wb.addWorksheet("งานเข้า", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

  const cols = [
    { key: "stage", header: "ขั้นตอนตอนนี้", width: 18, group: "สถานะ", align: "center" },
    { key: "urgent", header: "ด่วน", width: 7, group: "สถานะ", align: "center" },
    { key: "jobNo", header: "เลขที่งาน (JOB)", width: 17, group: "ข้อมูลงาน" },
    { key: "title", header: "ประเภทงาน", width: 16, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "company", header: "บริษัท / ลูกค้า", width: 24, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ", width: 24, group: "ข้อมูลงาน" },
    { key: "description", header: "รายละเอียดงาน", width: 36, group: "ข้อมูลงาน", wrap: true },
    { key: "source", header: "รับงานจาก", width: 20, group: "การรับงาน" },
    { key: "dispatchNo", header: "เลขที่ใบแจ้งงาน", width: 15, group: "การรับงาน" },
    { key: "intakeAt", header: "วันที่รับงาน", width: 12, group: "การรับงาน", align: "center" },
    { key: "docType", header: "เอกสารอ้างอิง", width: 15, group: "การรับงาน" },
    { key: "docNo", header: "เลขที่เอกสาร", width: 16, group: "การรับงาน" },
    { key: "schedule", header: "กำหนดการ", width: 22, group: "กำหนดการ" },
    { key: "start", header: "วันเข้างาน", width: 12, group: "กำหนดการ", align: "center" },
    { key: "due", header: "กำหนดเสร็จ", width: 12, group: "กำหนดการ", align: "center" },
    { key: "responsible", header: "ผู้รับผิดชอบ", width: 18, group: "ผู้เกี่ยวข้อง" },
    { key: "head", header: "หัวหน้าทีม", width: 16, group: "ผู้เกี่ยวข้อง" },
    { key: "contact", header: "ผู้ติดต่อ", width: 22, group: "ผู้เกี่ยวข้อง", wrap: true },
    { key: "quote", header: "ใบเสนอราคา", width: 18, group: "ใบเสนอราคา" },
    { key: "quoteInfo", header: "รายละเอียดใบเสนอราคา", width: 28, group: "ใบเสนอราคา", wrap: true },
    { key: "quoteAmount", header: "ยอด (บาท)", width: 14, group: "ใบเสนอราคา", align: "right" },
    { key: "files", header: "ไฟล์แนบ", width: 9, group: "อื่นๆ", align: "center" },
    { key: "note", header: "หมายเหตุ", width: 28, group: "อื่นๆ", wrap: true },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = cols.length;

  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = "งานเข้า · รับงาน";
  t.font = { name: "Tahoma", size: 16, bold: true, color: { argb: C.titleText } };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, lastCol);
  const sub = ws.getCell(2, 1);
  sub.value = [meta.tabLabel, meta.search ? `ค้นหา "${meta.search}"` : "", `รวม ${rows.length} งาน`, `ส่งออก ${moment().format("DD/MM/")}${moment().year() + 543} ${moment().format("HH:mm")}`]
    .filter(Boolean).join("  ·  ");
  sub.font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.getRow(3).height = 6;

  const GROUP_ROW = 4;
  const HEADER_ROW = 5;
  let gStart = 1;
  cols.forEach((c, i) => {
    if (i !== cols.length - 1 && cols[i + 1].group === c.group) return;
    const gEnd = i + 1;
    if (gEnd > gStart) ws.mergeCells(GROUP_ROW, gStart, GROUP_ROW, gEnd);
    for (let k = gStart; k <= gEnd; k += 1) {
      const cell = ws.getCell(GROUP_ROW, k);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.groupBg } };
      cell.border = thinBorder;
    }
    const head = ws.getCell(GROUP_ROW, gStart);
    head.value = c.group;
    head.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    head.alignment = { vertical: "middle", horizontal: "center" };
    gStart = gEnd + 1;
  });
  ws.getRow(GROUP_ROW).height = 20;
  const headerRow = ws.getRow(HEADER_ROW);
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });
  headerRow.height = 30;

  rows.forEach(({ j, s, oc }, rIdx) => {
    const scheduled = !j.unscheduled && !j.intakeNote && j.start;
    const files = [...(j.sitePhotoFiles || []), ...(j.quotationFiles || []), ...(j.invoiceFiles || [])].filter((f) => f?.fileUrl).length;
    const note = [
      j.cancelledAt ? `ยกเลิก${j.cancelReason ? `: ${j.cancelReason}` : ""}${j.cancelledBy ? ` (${j.cancelledBy})` : ""}` : "",
      j.infoPending ? `รอข้อมูล${j.infoPendingNote ? `: ${j.infoPendingNote}` : ""}` : "",
      j.noteDoneAt ? `ทำเสร็จ ${moment(j.noteDoneAt).format("DD/MM/YY")}${j.noteDoneBy ? ` · ${j.noteDoneBy}` : ""}` : "",
      j.approvalStatus === "pending" ? "รออนุมัติแผนงาน" : j.approvalStatus === "rejected" ? "ไม่อนุมัติแผนงาน" : "",
    ].filter(Boolean).join("\n");
    const row = ws.addRow({
      stage: s?.label || "",
      urgent: isUrgent(j) ? "ด่วน" : "",
      jobNo: j.jobNo || "",
      title: j.title || "",
      system: j.system || "",
      company: j.company || "",
      site: j.site || "",
      description: j.description || "",
      source: sourceText(j) || "",
      dispatchNo: j.dispatchNo || "",
      intakeAt: j.intakeAt ? new Date(j.intakeAt) : "",
      docType: DOC_TYPE[j.intakeDocType] || "",
      docNo: j.intakeDocNo || "",
      schedule: scheduleText(j) || "",
      start: scheduled ? new Date(j.start) : "",
      due: j.dueDate ? new Date(j.dueDate) : "",
      responsible: j.responsiblePerson || "",
      head: j.team || "",
      contact: [j.contactName, j.contactTel].filter(Boolean).join(" · "),
      quote: oc?.label || "",
      quoteInfo: (oc?.facts || []).join(" · "),
      quoteAmount: oc?.amount || "",
      files: files || "",
      note,
    });
    row.height = note.includes("\n") || String(j.description || "").length > 50 ? 42 : 24;
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: "Tahoma", size: 10 };
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: c.align || "left", wrapText: Boolean(c.wrap) };
      if (rIdx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (["intakeAt", "start", "due"].includes(c.key)) cell.numFmt = "dd/mm/yyyy";
      if (c.key === "quoteAmount") cell.numFmt = "#,##0.00";
      if (c.key === "stage") cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: argb(s?.color) } };
      if (c.key === "urgent" && isUrgent(j)) cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.danger } };
      if (c.key === "quote" && oc) cell.font = { name: "Tahoma", size: 10, bold: !oc.quiet, color: { argb: oc.quiet ? C.muted : argb(oc.color) } };
    });
  });

  ws.views = [{ state: "frozen", ySplit: HEADER_ROW, xSplit: 3 }];
  if (rows.length) ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: lastCol } };

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `งานเข้า-${meta.tabLabel}-${moment().format("YYYYMMDD")}.xlsx`);
}
