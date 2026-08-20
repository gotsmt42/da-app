import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";

// ✅ รูปแบบตัวเลขของช่องจำนวนเงินทุกช่องในไฟล์ที่ส่งออก — เก็บเป็น "ตัวเลขจริง" ใน cell (บวก/ลบ/SUM ต่อ
// ในไฟล์ได้ตามปกติ) แต่ให้ Excel แสดงผลพร้อมสัญลักษณ์ ฿ นำหน้าเสมอ ตรงกับที่แสดงบนหน้าจอ — เดิมเป็น
// ตัวเลขเปล่าๆ ที่แยกไม่ออกจากคอลัมน์ "จำนวนครั้ง"/"จำนวนวัน" ที่อยู่ข้างกันในไฟล์เดียวกัน
const MONEY_FMT = '"฿"#,##0';


/**
 * calendarExcelExport.js — ส่งออกงานจากหน้าปฏิทิน (Event) เป็นไฟล์ Excel (.xlsx) จริงพร้อมรูปแบบ/สี
 *
 * ⚠️ ทำไมต้องเปลี่ยนจาก CSV: ไฟล์ CSV เป็นข้อความล้วนตามนิยามของมันเอง ใส่สี/ตัวหนา/เส้นขอบ/ความกว้าง
 * คอลัมน์ไม่ได้เลยแม้แต่อย่างเดียว — เปิดใน Excel ได้ก็จริงแต่เป็นตารางเปล่าๆ ต้องมานั่งจัดรูปแบบเองใหม่
 * ทุกครั้ง ซ้ำยัง "แปลงค่าเอง" ให้ด้วย เช่นครั้งที่ "1/3" โดนตีความเป็นวันที่ 1 มี.ค. (ของเดิมต้องเติม
 * เครื่องหมาย ' นำหน้าไว้กันเอง ซึ่งติดไปในไฟล์จริงเวลาเปิดดู)
 * ✅ .xlsx เป็นรูปแบบจริงของ Excel จึงกำหนดได้ครบทุกอย่าง — ใช้ exceljs ตัวเดียวกับที่หน้า "ภาพรวมงาน"
 * ใช้อยู่แล้ว (ดู features/contracts/utils/contractExcelExport.js) ให้ไฟล์ที่ส่งออกจากทั้งสองหน้าหน้าตาเป็นชุดเดียวกัน
 */

// 🎨 โทนสีเดียวกับหน้าจอ (ACCENT #dc2626) — ExcelJS ใช้รหัสสีแบบ ARGB (มี alpha นำหน้า 2 หลัก)
const C = {
  headerBg: "FF7F1D1D",     // แดงเข้ม — แถบหัวตาราง
  headerText: "FFFFFFFF",
  groupBg: "FFDC2626",      // แดงหลัก — แถวหัวข้อกลุ่มคอลัมน์
  titleText: "FF7F1D1D",
  subtitleText: "FF64748B",
  zebra: "FFFDF7F7",        // แถบสลับแถวโทนแดงจางมาก
  border: "FFE2E8F0",
  muted: "FF94A3B8",
};

// 🎨 สีสถานะงาน — ตรงกับ statusLegend ในหน้าปฏิทิน (index.js) เป๊ะๆ กันคนอ่านไฟล์เทียบกับบนจอแล้วงง
const STATUS_COLOR = {
  "กำลังรอยืนยัน": "FF888888",
  "ยืนยันแล้ว": "FF0C49AC",
  "กำลังดำเนินการ": "FFA1B50B",
  "ดำเนินการเสร็จสิ้น": "FF18B007",
  "ยกเลิก": "FFDC2626",
};

// 🎨 สีสถานะการอนุมัติ — ตรงกับป้าย "รออนุมัติ/ไม่อนุมัติ" บนการ์ดงานในปฏิทิน
const APPROVAL_META = {
  approved: { label: "อนุมัติแล้ว", color: "FF059669" },
  pending: { label: "รออนุมัติ", color: "FFB45309" },
  rejected: { label: "ไม่อนุมัติ", color: "FFDC2626" },
};

// 🎨 สีประเภทงาน — ต้องตรงกับ JOB_CLASS_META (shared/utils/jobClassification.js) ที่ใช้วาดแถบสีขอบซ้ายในปฏิทิน
// ⚠️ อัปเดตพร้อมกันเสมอเมื่อแก้ที่ต้นทาง (ที่นี่เป็น ARGB ของ ExcelJS จึงใช้ค่าเดียวกันตรงๆ ไม่ได้)
// สัญญาเปลี่ยนจากคราม #6366F1 → ส้ม #F97316 และงานทั่วไปจากเทาอ่อน #94A3B8 → เทาเข้ม #475569
// เพราะสีเดิมชนกับสีพื้นหลังงานเริ่มต้นในปฏิทินจนแถบมองไม่เห็น (ดูเหตุผลเต็มที่ jobClassification.js)
const JOB_CLASS_COLOR = {
  contract: "FFF97316",
  project: "FF0D9488",
  general: "FF475569",
};

const thinBorder = {
  top: { style: "thin", color: { argb: C.border } },
  left: { style: "thin", color: { argb: C.border } },
  bottom: { style: "thin", color: { argb: C.border } },
  right: { style: "thin", color: { argb: C.border } },
};

/**
 * สร้างและดาวน์โหลดไฟล์ Excel ของงานในปฏิทิน
 * @param {Array}  rows   งานที่ผ่านตัวกรองแล้ว (โครงสร้างเดียวกับที่ปฏิทินบนจอใช้)
 * @param {Object} meta   { fileName, filterSummary, exportedAt }
 * @param {Function} classifyJob        ฟังก์ชันเดียวกับที่หน้าจอใช้ (กันข้อมูลไม่ตรงกัน)
 * @param {Function} getApprovalState   ฟังก์ชันเดียวกับที่หน้าจอใช้
 * @param {Function} formatRoundLabel   ฟังก์ชันเดียวกับที่หน้าจอใช้ ("1/3")
 */
export async function exportCalendarEventsToExcel({
  rows,
  meta,
  classifyJob,
  getApprovalState,
  formatRoundLabel,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();

  // ✅ ไม่ตรึง (freeze) แถว/คอลัมน์ใดๆ — เลื่อนดูได้อิสระทั้งแผ่นเหมือนตารางปกติ (แนวเดียวกับไฟล์ที่
  // ส่งออกจากหน้า "ภาพรวมงาน" ซึ่งผู้ใช้ขอให้เอา freeze ออกไปแล้ว)
  const ws = wb.addWorksheet("งานในปฏิทิน", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ── นิยามคอลัมน์ (ลำดับ/ความกว้าง/การจัดวาง) ────────────────────────────
  const cols = [
    { key: "startDate", header: "วันที่เริ่ม", width: 13, group: "ช่วงวันที่", align: "center" },
    { key: "endDate", header: "วันที่สิ้นสุด", width: 13, group: "ช่วงวันที่", align: "center" },
    { key: "days", header: "จำนวนวัน", width: 10, group: "ช่วงวันที่", align: "center" },
    { key: "startTime", header: "เวลาเริ่ม", width: 10, group: "ช่วงวันที่", align: "center" },
    { key: "endTime", header: "เวลาสิ้นสุด", width: 10, group: "ช่วงวันที่", align: "center" },
    { key: "company", header: "บริษัท", width: 26, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ / สถานที่", width: 26, group: "ข้อมูลงาน" },
    { key: "title", header: "หัวข้องาน", width: 18, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "jobClass", header: "ประเภทงาน", width: 13, group: "ข้อมูลงาน", align: "center" },
    { key: "jobValue", header: "มูลค่างาน (฿)", width: 15, group: "ข้อมูลงาน", align: "right", numFmt: MONEY_FMT },
    { key: "contractNo", header: "เลขที่สัญญา", width: 18, group: "สัญญา" },
    { key: "round", header: "ครั้งที่", width: 10, group: "สัญญา", align: "center" },
    { key: "status", header: "สถานะงาน", width: 18, group: "สถานะ", align: "center" },
    { key: "approval", header: "การอนุมัติ", width: 13, group: "สถานะ", align: "center" },
    { key: "team", header: "หัวหน้าทีมเข้างาน", width: 20, group: "ผู้เกี่ยวข้อง" },
    { key: "teamMembers", header: "ลูกทีม", width: 28, group: "ผู้เกี่ยวข้อง", wrap: true },
    { key: "responsiblePerson", header: "ผู้รับผิดชอบงาน", width: 20, group: "ผู้เกี่ยวข้อง" },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = cols.length;

  // ── แถว 1-3: หัวเรื่องรายงาน ─────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "ตารางงาน (ปฏิทิน)";
  titleCell.font = { name: "Tahoma", size: 16, bold: true, color: { argb: C.titleText } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = `${meta.filterSummary}  ·  รวม ${rows.length} รายการ  ·  ส่งออก ${meta.exportedAt}`;
  subCell.font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  subCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6; // เว้นบรรทัดหายใจก่อนเข้าตาราง

  // ── แถว 4: หัวข้อกลุ่มคอลัมน์ (merge ตามกลุ่มที่ติดกัน) ──────────────────
  const GROUP_ROW = 4;
  const HEADER_ROW = 5;
  let gStart = 1;
  for (let i = 0; i < cols.length; i += 1) {
    const isLast = i === cols.length - 1;
    const nextDiffers = isLast || cols[i + 1].group !== cols[i].group;
    if (nextDiffers) {
      const gEnd = i + 1;
      if (gEnd > gStart) ws.mergeCells(GROUP_ROW, gStart, GROUP_ROW, gEnd);
      const cell = ws.getCell(GROUP_ROW, gStart);
      cell.value = cols[i].group;
      cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.groupBg } };
      cell.border = thinBorder;
      // เซลล์ที่เหลือในกลุ่มต้องมีพื้น/ขอบด้วย ไม่งั้นช่วงที่ merge จะดูขาดเป็นช่วงๆ
      for (let k = gStart; k <= gEnd; k += 1) {
        const c2 = ws.getCell(GROUP_ROW, k);
        c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.groupBg } };
        c2.border = thinBorder;
      }
      gStart = gEnd + 1;
    }
  }
  ws.getRow(GROUP_ROW).height = 20;

  // ── แถว 5: หัวคอลัมน์จริง ────────────────────────────────────────────────
  const headerRow = ws.getRow(HEADER_ROW);
  cols.forEach((c, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = c.header;
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });
  headerRow.height = 30;

  // ── แถวข้อมูล ────────────────────────────────────────────────────────────
  const JOB_CLASS_LABEL = { contract: "งานสัญญา", project: "งานโปรเจค", general: "งานทั่วไป" };

  rows.forEach((ev, rIdx) => {
    // ⚠️ end ของงาน allDay เก็บเป็นค่าแบบ exclusive (บวก +1 วันไว้แล้วตอนบันทึก) ต้องลบคืน 1 วันเสมอ
    // ไม่งั้นงานวันเดียวปลายเดือน (เช่น 31 ม.ค.) จะกลายเป็น 31 ม.ค. – 1 ก.พ. = ข้ามเดือนทั้งที่ไม่ได้ข้าม
    const start = moment(ev.start);
    const rawEnd = ev.end ? moment(ev.end) : null;
    const end = rawEnd ? rawEnd.clone().subtract(1, "days") : start.clone();
    const days = Math.max(1, end.diff(start, "days") + 1);

    const jobClass = classifyJob ? classifyJob(ev) : "";
    const approvalState = getApprovalState ? getApprovalState(ev) : "approved";
    const approvalMeta = APPROVAL_META[approvalState] || APPROVAL_META.approved;

    const memberNames = [...new Set(
      (ev.teamMembers || [])
        .map((m) => m?.name)
        .filter(Boolean)
        .filter((name) => name !== ev.team)
    )];

    const values = {
      // ⚠️ ส่งเป็น Date จริง ไม่ใช่ string — Excel จะเรียง/กรอง/คำนวณวันที่ได้จริง (CSV เดิมเป็นข้อความ
      // ล้วน เรียงตามตัวอักษรเท่านั้น) รูปแบบการแสดงผลกำหนดผ่าน numFmt ด้านล่าง
      startDate: start.isValid() ? start.toDate() : "",
      endDate: end.isValid() ? end.toDate() : "",
      days,
      startTime: ev.extendedProps?.startTime || "",
      endTime: ev.extendedProps?.endTime || "",
      company: ev.company || "",
      site: ev.site || "",
      title: ev.title || "",
      system: ev.system || "",
      jobClass: JOB_CLASS_LABEL[jobClass] || "",
      jobValue: ev.jobValue ?? "",
      contractNo: ev.contractNo || "",
      // ✅ ส่งเป็นข้อความล้วน ไม่ต้องเติม ' นำหน้าเหมือน CSV เดิมแล้ว — .xlsx เก็บชนิดข้อมูลจริงได้
      // Excel จึงไม่แปลง "1/3" เป็นวันที่ให้เอง และไม่มีเครื่องหมาย ' ติดไปในไฟล์
      round: ev.time ? String(formatRoundLabel ? formatRoundLabel(ev.time, ev.visitCount) : ev.time) : "",
      status: ev.status || "",
      approval: approvalMeta.label,
      team: ev.team || "",
      teamMembers: memberNames.join(", "),
      responsiblePerson: ev.responsiblePerson || "— ยังไม่มอบหมาย —",
    };

    const row = ws.addRow(values);
    const isZebra = rIdx % 2 === 1;
    // ⚠️ ต้องคำนวณความสูงแถวเองตามจำนวนบรรทัดจริง — ExcelJS ที่กำหนด row.height ตายตัวจะล็อกความสูงไว้
    // เท่านั้นเสมอ Excel จะไม่ขยายให้อัตโนมัติแม้เปิด wrapText ไว้ก็ตาม
    const maxLines = Math.max(
      1,
      ...Object.values(values).map((v) => (typeof v === "string" ? v.split("\n").length : 1))
    );
    row.height = Math.max(22, maxLines * 14);

    cols.forEach((colDef, idx) => {
      const cell = row.getCell(idx + 1);
      cell.font = { name: "Tahoma", size: 10 };
      cell.border = thinBorder;
      cell.alignment = {
        vertical: colDef.wrap ? "top" : "middle",
        horizontal: colDef.align || "left",
        wrapText: Boolean(colDef.wrap),
      };
      if (isZebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (colDef.numFmt) cell.numFmt = colDef.numFmt;
      if (colDef.key === "startDate" || colDef.key === "endDate") cell.numFmt = "dd/mm/yyyy";

      // 🎨 ระบายสีตามความหมายของข้อมูล — จุดที่ CSV ทำไม่ได้เลย และเป็นเหตุผลหลักที่ต้องเปลี่ยนรูปแบบไฟล์
      if (colDef.key === "status" && STATUS_COLOR[ev.status]) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: STATUS_COLOR[ev.status] } };
      }
      if (colDef.key === "approval") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: approvalMeta.color } };
      }
      if (colDef.key === "jobClass" && JOB_CLASS_COLOR[jobClass]) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: JOB_CLASS_COLOR[jobClass] } };
      }
      if (colDef.key === "responsiblePerson" && !ev.responsiblePerson) {
        cell.font = { name: "Tahoma", size: 10, italic: true, color: { argb: C.muted } };
      }
    });
  });

  // ✅ เปิดตัวกรอง (AutoFilter) ให้ที่หัวตาราง — ผู้ใช้กรอง/เรียงต่อเองได้ทันทีโดยไม่ต้องตั้งเอง
  if (rows.length > 0) {
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: lastCol } };
  }

  // ── แถวสรุปยอดรวมท้ายตาราง ───────────────────────────────────────────────
  // ✅ ใช้สูตร SUBTOTAL จริง (ไม่ใช่ตัวเลขนิ่งที่คำนวณมาจาก JS) เพื่อให้ยอดอัปเดตตามเองถ้าผู้ใช้แก้ตัวเลข
  // ต่อในไฟล์ หรือกรองด้วย AutoFilter แล้วดูเฉพาะบางแถว
  if (rows.length > 0) {
    const jobValueIdx = cols.findIndex((c) => c.key === "jobValue") + 1;
    const firstDataRow = HEADER_ROW + 1;
    const lastDataRow = HEADER_ROW + rows.length;
    const totalRow = ws.getRow(lastDataRow + 1);
    const filled = rows.filter((r) => r.jobValue !== null && r.jobValue !== undefined && r.jobValue !== "" && !Number.isNaN(Number(r.jobValue))).length;
    const missing = rows.length - filled;

    if (jobValueIdx > 1) ws.mergeCells(lastDataRow + 1, 1, lastDataRow + 1, jobValueIdx - 1);
    const labelCell = totalRow.getCell(1);
    labelCell.value = missing > 0
      ? `รวมมูลค่างานทั้งหมด (${filled}/${rows.length} รายการที่ระบุมูลค่าแล้ว · อีก ${missing} รายการยังไม่ได้กรอก)`
      : `รวมมูลค่างานทั้งหมด (${rows.length} รายการ)`;
    labelCell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };

    const colLetter = ws.getColumn(jobValueIdx).letter;
    const sumCell = totalRow.getCell(jobValueIdx);
    sumCell.value = { formula: `SUBTOTAL(109,${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };
    sumCell.numFmt = MONEY_FMT;
    sumCell.font = { name: "Tahoma", size: 11, bold: true, color: { argb: C.headerText } };
    sumCell.alignment = { vertical: "middle", horizontal: "right" };

    for (let k = 1; k <= lastCol; k += 1) {
      const cell = totalRow.getCell(k);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
      cell.border = thinBorder;
    }
    totalRow.height = 24;
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    meta.fileName
  );
}
