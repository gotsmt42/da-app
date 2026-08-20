import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import "moment/locale/th";

/**
 * operationExcelExport.js — ส่งออกรายการ "แผนการดำเนินงาน" เป็นไฟล์ Excel (.xlsx) พร้อมรูปแบบ/สี
 *
 * ⚠️ แทนที่ handleExportCSV เดิม: CSV เป็นข้อความล้วน ใส่สี/ตัวหนา/ความกว้างคอลัมน์ไม่ได้เลย และ
 * ค่าทุกช่องถูกครอบด้วย " " กลายเป็นข้อความหมด — วันที่เรียงตามตัวอักษร ตัวเลขรวมยอดไม่ได้
 * ✅ .xlsx เก็บวันที่เป็น Date จริงและตัวเลขเป็น number จริง เรียง/กรอง/รวมยอดใน Excel ได้ทันที
 */

const C = {
  headerBg: "FF4C1D95",   // ม่วงเข้ม — โทนเดียวกับ "กำลังดำเนินการ" ที่เป็นแกนของหน้านี้
  headerText: "FFFFFFFF",
  groupBg: "FF7C3AED",
  titleText: "FF4C1D95",
  subtitleText: "FF64748B",
  zebra: "FFF8F7FF",
  border: "FFE2E8F0",
  danger: "FFDC2626",
  warn: "FFB45309",
  ok: "FF059669",
  muted: "FF94A3B8",
};

// 🎨 ตรงกับ OP_COLOR ในหน้าจอ
const STATUS_COLOR = {
  "กำลังรอยืนยัน": "FFF59E0B",
  "ยืนยันแล้ว": "FF3B82F6",
  "กำลังดำเนินการ": "FF8B5CF6",
  "ดำเนินการเสร็จสิ้น": "FF10B981",
};

const thinBorder = {
  top: { style: "thin", color: { argb: C.border } },
  left: { style: "thin", color: { argb: C.border } },
  bottom: { style: "thin", color: { argb: C.border } },
  right: { style: "thin", color: { argb: C.border } },
};

/**
 * @param {Array}  jobs   กลุ่มงาน [{ sessions: [event, ...] }] — 1 แถว = 1 งาน (รวมทุกวันของงานเดียวกัน)
 * @param {Object} meta   { fileName, groupLabel, filterSummary, exportedAt }
 * @param {Map}    daysPastDueMap  ผลการคำนวณ "ค้างกี่วัน" ชุดเดียวกับที่หน้าจอใช้ (กันตัวเลขไม่ตรงกัน)
 */
export async function exportOperationToExcel({ jobs, meta, daysPastDueMap, isFlaggedDays, formatEventDateRange }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();
  const ws = wb.addWorksheet("แผนการดำเนินงาน", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const cols = [
    { key: "status", header: "สถานะงาน", width: 18, group: "สถานะ", align: "center" },
    { key: "overdue", header: "ค้างกี่วัน", width: 11, group: "สถานะ", align: "center" },
    { key: "approval", header: "การอนุมัติ", width: 13, group: "สถานะ", align: "center" },
    { key: "company", header: "บริษัท", width: 24, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ", width: 24, group: "ข้อมูลงาน" },
    { key: "title", header: "ประเภทงาน", width: 16, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "round", header: "ครั้งที่", width: 9, group: "ข้อมูลงาน", align: "center" },
    { key: "docNo", header: "เลขที่เอกสาร", width: 16, group: "ข้อมูลงาน" },
    { key: "dateRange", header: "วันที่เข้างาน", width: 26, group: "กำหนดการ", wrap: true },
    { key: "startDate", header: "วันเริ่ม", width: 12, group: "กำหนดการ", align: "center" },
    { key: "endDate", header: "วันสิ้นสุด", width: 12, group: "กำหนดการ", align: "center" },
    { key: "dayCount", header: "จำนวนวัน", width: 10, group: "กำหนดการ", align: "center" },
    { key: "timeRange", header: "เวลา", width: 14, group: "กำหนดการ", align: "center" },
    { key: "team", header: "ทีมที่เข้างาน", width: 20, group: "ผู้เกี่ยวข้อง" },
    { key: "responsible", header: "ผู้รับผิดชอบงาน", width: 20, group: "ผู้เกี่ยวข้อง" },
    { key: "checkIn", header: "เวลาเข้างานจริง", width: 17, group: "การปฏิบัติงาน", align: "center" },
    { key: "checkOut", header: "เวลาเสร็จงานจริง", width: 17, group: "การปฏิบัติงาน", align: "center" },
    { key: "workNote", header: "สรุปงาน (ช่างบันทึก)", width: 36, group: "การปฏิบัติงาน", wrap: true },
    { key: "closeState", header: "สถานะการปิดงาน", width: 18, group: "การปฏิบัติงาน", align: "center" },
    { key: "docReport", header: "Service Report", width: 14, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    { key: "docQuotation", header: "ใบเสนอราคา", width: 13, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    { key: "docInvoice", header: "ใบวางบิล", width: 12, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    { key: "docCompletion", header: "ใบส่งมอบงาน", width: 13, group: "เอกสารแนบ (ไฟล์)", align: "center" },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = cols.length;

  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = "แผนการดำเนินงาน";
  t.font = { name: "Tahoma", size: 16, bold: true, color: { argb: C.titleText } };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  const s = ws.getCell(2, 1);
  s.value = `${meta.groupLabel}  ·  ${meta.filterSummary}  ·  รวม ${jobs.length} งาน  ·  ส่งออก ${meta.exportedAt}`;
  s.font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;

  const GROUP_ROW = 4;
  const HEADER_ROW = 5;
  let gStart = 1;
  for (let i = 0; i < cols.length; i += 1) {
    if (i === cols.length - 1 || cols[i + 1].group !== cols[i].group) {
      const gEnd = i + 1;
      if (gEnd > gStart) ws.mergeCells(GROUP_ROW, gStart, GROUP_ROW, gEnd);
      for (let k = gStart; k <= gEnd; k += 1) {
        const cell = ws.getCell(GROUP_ROW, k);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.groupBg } };
        cell.border = thinBorder;
      }
      const head = ws.getCell(GROUP_ROW, gStart);
      head.value = cols[i].group;
      head.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
      head.alignment = { vertical: "middle", horizontal: "center" };
      gStart = gEnd + 1;
    }
  }
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

  jobs.forEach((job, rIdx) => {
    const sessions = job.sessions;
    const a = sessions[0];
    const overdueDays = daysPastDueMap.get(a._id)?.days;
    const isOverdue = isFlaggedDays(overdueDays);

    // ✅ ช่วงวันที่จริงของ "ทั้งงาน" (รวมทุกวันที่เข้า ไม่ใช่แค่วันแรก) + นับจำนวนวันเข้างานจริง
    const starts = sessions.map((e) => moment(e.start));
    const ends = sessions.map((e) => (e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days") : moment(e.start)));
    const minStart = moment.min(starts);
    const maxEnd = moment.max(ends);
    const dayCount = sessions.reduce((sum, e) => {
      const st = moment(e.start).startOf("day");
      const en = (e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days") : moment(e.start)).startOf("day");
      return sum + Math.max(1, en.diff(st, "days") + 1);
    }, 0);

    const closeState = a.status === "ดำเนินการเสร็จสิ้น" ? "ปิดงานแล้ว"
      : a.closeRequested ? "รอแอดมินอนุมัติปิดงาน"
      : "ยังไม่ปิด";
    const approvalState = !a.approvalStatus || a.approvalStatus === "approved" ? "อนุมัติแล้ว"
      : a.approvalStatus === "pending" ? "รออนุมัติ" : "ไม่อนุมัติ";

    const row = ws.addRow({
      status: a.status || "-",
      overdue: isOverdue ? overdueDays : "",
      approval: approvalState,
      company: a.company || "",
      site: a.site || "",
      title: a.title || "",
      system: a.system || "",
      round: a.time || "",
      docNo: a.docNo || "",
      // ✅ ข้อความช่วงวันที่แบบอ่านง่าย (รวมทุกช่วงของงานหลายวันไม่ติดกัน) เหมือนที่เห็นบนการ์ด
      dateRange: sessions.map((e) => formatEventDateRange(e)).join("\n"),
      startDate: minStart.toDate(),
      endDate: maxEnd.toDate(),
      dayCount,
      timeRange: a.startTime || a.endTime ? `${a.startTime || "-"}-${a.endTime || "-"}` : "ทั้งวัน",
      team: [a.team, ...(a.teamMembers || []).map((m) => m?.name)].filter(Boolean).join(", "),
      responsible: a.responsiblePerson || "",
      checkIn: a.checkedInAt ? new Date(a.checkedInAt) : "",
      checkOut: a.checkedOutAt ? new Date(a.checkedOutAt) : "",
      workNote: a.workNote || "",
      closeState,
      docReport: (a.reportFiles || []).length,
      docQuotation: (a.quotationFiles || []).length,
      docInvoice: (a.invoiceFiles || []).length,
      docCompletion: (a.completionFiles || []).length,
    });

    const zebra = rIdx % 2 === 1;
    row.height = 28;
    cols.forEach((colDef, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: "Tahoma", size: 10 };
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: colDef.align || "left", wrapText: Boolean(colDef.wrap) };
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (["startDate", "endDate"].includes(colDef.key)) cell.numFmt = "dd/mm/yyyy";
      if (["checkIn", "checkOut"].includes(colDef.key)) cell.numFmt = "dd/mm/yyyy hh:mm";

      if (colDef.key === "status") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: STATUS_COLOR[a.status] || C.muted } };
      }
      if (colDef.key === "overdue" && isOverdue) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.danger } };
      }
      if (colDef.key === "approval" && approvalState !== "อนุมัติแล้ว") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: approvalState === "รออนุมัติ" ? C.warn : C.danger } };
      }
      if (colDef.key === "closeState") {
        cell.font = {
          name: "Tahoma", size: 10, bold: closeState !== "ยังไม่ปิด",
          color: { argb: closeState === "ปิดงานแล้ว" ? C.ok : closeState === "ยังไม่ปิด" ? C.muted : C.warn },
        };
      }
      // ✅ ช่องเอกสารที่ยังไม่มีไฟล์ — ทำให้เห็นชัดว่ายังขาด ไม่ใช่เลข 0 กลืนไปกับตัวอื่น
      if (colDef.key.startsWith("doc") && colDef.key !== "docNo" && cell.value === 0) {
        cell.value = "—";
        cell.font = { name: "Tahoma", size: 10, color: { argb: C.muted } };
      }
    });
  });

  if (jobs.length > 0) {
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + jobs.length, column: lastCol } };
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    meta.fileName
  );
}

export const buildOperationFileName = (groupLabel) =>
  `แผนการดำเนินงาน-${groupLabel}-${moment().format("YYYYMMDD")}.xlsx`;
