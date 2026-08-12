import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import "moment/locale/th";

// ✅ รูปแบบตัวเลขของช่องจำนวนเงินทุกช่องในไฟล์ที่ส่งออก — เก็บเป็น "ตัวเลขจริง" ใน cell (บวก/ลบ/SUM ต่อ
// ในไฟล์ได้ตามปกติ) แต่ให้ Excel แสดงผลพร้อมสัญลักษณ์ ฿ นำหน้าเสมอ ตรงกับที่แสดงบนหน้าจอ — เดิมเป็น
// ตัวเลขเปล่าๆ ที่แยกไม่ออกจากคอลัมน์ "จำนวนครั้ง"/"จำนวนวัน" ที่อยู่ข้างกันในไฟล์เดียวกัน
const MONEY_FMT = '"฿"#,##0';


/**
 * quotationExcelExport.js — ส่งออกรายการ "ติดตามใบเสนอราคา" เป็นไฟล์ Excel (.xlsx) พร้อมรูปแบบ/สี
 * เทียบ pattern เดียวกับ contractExcelExport.js / calendarExcelExport.js ให้ทั้งแอปได้ไฟล์หน้าตาชุดเดียวกัน
 *
 * ✅ ข้อมูลที่ใส่ต้องเป็น "ความจริงชุดเดียวกับที่เห็นบนจอ" — จึงรับ resolve* / getFollowUpInfo เข้ามา
 * จากหน้าจอโดยตรง แทนที่จะคำนวณเองซ้ำ (กันตัวเลขในไฟล์ไม่ตรงกับหน้าจอ)
 */

const C = {
  headerBg: "FF1E3A8A",      // น้ำเงินเข้ม — แถบหัวตาราง (โทนเดียวกับสถานะ "รอลูกค้าตอบ")
  headerText: "FFFFFFFF",
  groupBg: "FF3B82F6",       // น้ำเงินหลัก — แถวหัวข้อกลุ่มคอลัมน์
  titleText: "FF1E3A8A",
  subtitleText: "FF64748B",
  zebra: "FFF6F9FF",
  border: "FFE2E8F0",
  muted: "FF94A3B8",
  danger: "FFDC2626",
  warn: "FFB45309",
  ok: "FF059669",
};

// 🎨 สีสถานะ — ตรงกับ STATUS_META ในหน้า QuotationTracking.js
const STATUS_COLOR = {
  waiting_file: "FF6B7280",
  not_sent: "FFF59E0B",
  sent: "FF3B82F6",
  follow_up: "FFEF4444",
  revising: "FF8B5CF6",
  approved: "FF10B981",
  rejected: "FF94A3B8",
};
const STATUS_LABEL = {
  waiting_file: "รอช่างแนบไฟล์",
  not_sent: "รอส่งลูกค้า",
  sent: "รอลูกค้าตอบ",
  follow_up: "ต้องติดตามด่วน",
  revising: "ลูกค้าขอแก้ไข",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
};

const thinBorder = {
  top: { style: "thin", color: { argb: C.border } },
  left: { style: "thin", color: { argb: C.border } },
  bottom: { style: "thin", color: { argb: C.border } },
  right: { style: "thin", color: { argb: C.border } },
};

export async function exportQuotationsToExcel({ jobs, meta, getFollowUpInfo, formatEventDateRange }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();
  const ws = wb.addWorksheet("ติดตามใบเสนอราคา", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const cols = [
    { key: "status", header: "สถานะ", width: 18, group: "สถานะใบเสนอราคา", align: "center" },
    { key: "amount", header: "มูลค่าใบเสนอราคา (฿)", width: 18, group: "สถานะใบเสนอราคา", align: "right", numFmt: MONEY_FMT },
    { key: "company", header: "บริษัท", width: 24, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ", width: 24, group: "ข้อมูลงาน" },
    { key: "title", header: "ประเภทงาน", width: 16, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "round", header: "ครั้งที่", width: 10, group: "ข้อมูลงาน", align: "center" },
    { key: "docNo", header: "เลขที่เอกสาร", width: 16, group: "ข้อมูลงาน" },
    { key: "jobDate", header: "วันที่เข้างาน", width: 22, group: "ข้อมูลงาน" },
    { key: "sentAt", header: "วันที่ส่งลูกค้า", width: 14, group: "การติดตาม", align: "center" },
    { key: "followUpCount", header: "ติดตามแล้ว (ครั้ง)", width: 15, group: "การติดตาม", align: "center" },
    { key: "lastContact", header: "ติดต่อล่าสุด", width: 14, group: "การติดตาม", align: "center" },
    { key: "silentDays", header: "เงียบมา (วัน)", width: 13, group: "การติดตาม", align: "center" },
    { key: "dueAt", header: "ครบกำหนดตามรอบถัดไป", width: 20, group: "การติดตาม", align: "center" },
    { key: "lastNote", header: "บันทึกติดตามล่าสุด", width: 34, group: "การติดตาม", wrap: true },
    { key: "decidedAt", header: "วันที่ลูกค้าตอบ", width: 14, group: "ผลลัพธ์", align: "center" },
    { key: "decidedBy", header: "ผู้บันทึกผล", width: 16, group: "ผลลัพธ์" },
    { key: "team", header: "ทีมที่เข้างาน", width: 18, group: "ผู้เกี่ยวข้อง" },
    { key: "responsible", header: "ผู้รับผิดชอบงาน", width: 18, group: "ผู้เกี่ยวข้อง" },
    { key: "fileCount", header: "ไฟล์แนบ (ไฟล์)", width: 13, group: "เอกสาร", align: "center" },
    { key: "fileName", header: "ชื่อไฟล์ใบเสนอราคา", width: 30, group: "เอกสาร", wrap: true },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = cols.length;

  // ── หัวเรื่องรายงาน ──────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = "ติดตามใบเสนอราคา";
  t.font = { name: "Tahoma", size: 16, bold: true, color: { argb: C.titleText } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  const s = ws.getCell(2, 1);
  s.value = `${meta.tabLabel}  ·  ${meta.filterSummary}  ·  รวม ${jobs.length} รายการ  ·  ส่งออก ${meta.exportedAt}`;
  s.font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;

  // ── แถบกลุ่มคอลัมน์ ──────────────────────────────────────────────────────
  const GROUP_ROW = 4;
  const HEADER_ROW = 5;
  let gStart = 1;
  for (let i = 0; i < cols.length; i += 1) {
    const isLast = i === cols.length - 1;
    if (isLast || cols[i + 1].group !== cols[i].group) {
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

  // ── แถวข้อมูล ────────────────────────────────────────────────────────────
  jobs.forEach((job, rIdx) => {
    const a = job.sessions[0];
    const info = getFollowUpInfo(a);
    const followUps = a.quotationFollowUps || [];
    const lastFu = followUps.length > 0 ? followUps[followUps.length - 1] : null;
    const files = a.quotationFiles || [];

    const row = ws.addRow({
      status: STATUS_LABEL[job.groupKey] || job.groupKey,
      // ✅ ส่งเป็นตัวเลขจริง (ไม่ใช่ข้อความ) — รวมยอด/ทำ pivot ใน Excel ได้ทันที
      amount: a.quotationAmount != null && a.quotationAmount !== "" ? Number(a.quotationAmount) : "",
      company: a.company || "",
      site: a.site || "",
      title: a.title || "",
      system: a.system || "",
      round: a.time || "",
      docNo: a.docNo || "",
      jobDate: formatEventDateRange(a),
      sentAt: a.quotationSentAt ? new Date(a.quotationSentAt) : "",
      followUpCount: followUps.length,
      lastContact: info ? info.lastContactAt.toDate() : "",
      silentDays: info ? info.daysSinceLastContact : "",
      dueAt: info ? info.dueAt.toDate() : "",
      lastNote: lastFu?.note || "",
      decidedAt: a.quotationDecisionAt ? new Date(a.quotationDecisionAt) : "",
      decidedBy: a.quotationDecisionBy || "",
      team: a.team || "",
      responsible: a.responsiblePerson || "",
      fileCount: files.length,
      fileName: files.map((f) => f.fileName).join(", "),
    });

    const zebra = rIdx % 2 === 1;
    row.height = 26;
    cols.forEach((colDef, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: "Tahoma", size: 10 };
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: colDef.align || "left", wrapText: Boolean(colDef.wrap) };
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (colDef.numFmt) cell.numFmt = colDef.numFmt;
      if (["sentAt", "lastContact", "dueAt", "decidedAt"].includes(colDef.key)) cell.numFmt = "dd/mm/yyyy";

      // 🎨 ระบายสีตามความหมาย — จุดที่ CSV ทำไม่ได้
      if (colDef.key === "status") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: STATUS_COLOR[job.groupKey] || C.muted } };
      }
      if (colDef.key === "amount" && !a.quotationAmount) {
        // ✅ ใบที่ยังไม่กรอกมูลค่า — ทำให้เห็นชัดในไฟล์ด้วย ไม่ใช่ช่องว่างเปล่าที่มองข้าม (ยอดรวมจะขาด)
        cell.value = "ยังไม่ระบุ";
        cell.font = { name: "Tahoma", size: 10, italic: true, color: { argb: C.warn } };
      }
      if (colDef.key === "silentDays" && info?.needsFollowUp) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.danger } };
      }
      if (colDef.key === "followUpCount" && followUps.length > 0) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.ok } };
      }
      if (colDef.key === "fileCount" && files.length === 0) {
        cell.font = { name: "Tahoma", size: 10, italic: true, color: { argb: C.warn } };
      }
    });
  });

  // ── แถวสรุปยอดรวม ───────────────────────────────────────────────────────
  if (jobs.length > 0) {
    const amountColIdx = cols.findIndex((c) => c.key === "amount") + 1;
    const total = jobs.reduce((sum, j) => sum + (Number(j.sessions[0].quotationAmount) || 0), 0);
    const missing = jobs.filter((j) => !j.sessions[0].quotationAmount).length;
    const sumRow = ws.addRow({});
    sumRow.height = 24;
    const labelCell = sumRow.getCell(1);
    labelCell.value = missing > 0 ? `รวม (ยังไม่ระบุมูลค่า ${missing} ใบ)` : "รวมทั้งหมด";
    labelCell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.titleText } };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };
    const totalCell = sumRow.getCell(amountColIdx);
    totalCell.value = total;
    totalCell.numFmt = MONEY_FMT;
    totalCell.font = { name: "Tahoma", size: 11, bold: true, color: { argb: C.titleText } };
    totalCell.alignment = { vertical: "middle", horizontal: "right" };
    for (let k = 1; k <= lastCol; k += 1) {
      const c2 = sumRow.getCell(k);
      c2.border = { ...thinBorder, top: { style: "double", color: { argb: C.headerBg } } };
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
    }

    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + jobs.length, column: lastCol } };
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    meta.fileName
  );
}

// ✅ ชื่อไฟล์บอกได้ในตัวว่าเป็นข้อมูลชุดไหน ณ วันไหน (กันไฟล์ทับกันเองในโฟลเดอร์ดาวน์โหลด)
export const buildQuotationFileName = (tabLabel) =>
  `ติดตามใบเสนอราคา-${tabLabel}-${moment().format("YYYYMMDD")}.xlsx`;
