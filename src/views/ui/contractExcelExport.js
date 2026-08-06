import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * contractExcelExport.js — ส่งออกตาราง "ภาพรวมงาน" เป็นไฟล์ Excel (.xlsx) จริงพร้อมรูปแบบ/สี
 *
 * ⚠️ ทำไมต้องเปลี่ยนจาก CSV: ไฟล์ CSV เป็นข้อความล้วนตามนิยามของมันเอง ใส่สี/ตัวหนา/เส้นขอบ/ความกว้าง
 * คอลัมน์/ตรึงหัวตารางไม่ได้เลยแม้แต่อย่างเดียว — เปิดใน Excel ได้ก็จริงแต่เป็นตารางเปล่าๆ ต้องมานั่งจัด
 * รูปแบบเองใหม่ทุกครั้ง และเลขที่สัญญาแบบ "FAPTY04-2569" ยังเสี่ยงโดน Excel ตีความเป็นวันที่/สูตรเองด้วย
 * ✅ .xlsx เป็นรูปแบบจริงของ Excel จึงกำหนดได้ครบทุกอย่าง — ใช้ exceljs (SheetJS ที่มีอยู่เดิมเขียน
 * สไตล์ไม่ได้ เป็นฟีเจอร์เฉพาะรุ่น Pro)
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
  // สถานะสัญญา — ตรงกับ contractStatusInfo ในหน้าจอ
  expired: "FFDC2626",
  nearExpiry: "FFF59E0B",
  active: "FF10B981",
  muted: "FF94A3B8",
  visitDone: "FF059669",    // ครั้งที่ลงตารางแล้ว
  visitPending: "FFB45309",  // รอวางแผน
};

const thinBorder = {
  top: { style: "thin", color: { argb: C.border } },
  left: { style: "thin", color: { argb: C.border } },
  bottom: { style: "thin", color: { argb: C.border } },
  right: { style: "thin", color: { argb: C.border } },
};

/**
 * สร้างและดาวน์โหลดไฟล์ Excel
 * @param {Array}  rows          แถวข้อมูลที่ผ่านตัวกรองแล้ว (โครงสร้างเดียวกับที่ตารางบนจอใช้)
 * @param {Array}  visitColumns  เลขครั้งที่ที่ต้องมีคอลัมน์ [1,2,3,...]
 * @param {Object} meta          { fileName, viewLabel, yearLabel, filterSummary, exportedBy }
 * @param {Function} contractStatusInfo  ฟังก์ชันเดียวกับที่หน้าจอใช้ (กันข้อมูลไม่ตรงกัน)
 * @param {Function} formatEventDateRange
 * @param {Function} visitsPerYear
 */
export async function exportContractsToExcel({
  rows,
  visitColumns,
  meta,
  contractStatusInfo,
  formatEventDateRange,
  visitsPerYear,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();

  const ws = wb.addWorksheet("ภาพรวมงาน", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 5 }], // ตรึงหัวตาราง + 4 คอลัมน์แรกไว้เสมอ
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ── นิยามคอลัมน์ (ลำดับ/ความกว้าง/การจัดวาง) ────────────────────────────
  const baseCols = [
    { key: "contractNo", header: "เลขที่สัญญา", width: 18, group: "เอกสารอ้างอิง" },
    { key: "quotationNo", header: "ใบเสนอราคา", width: 18, group: "เอกสารอ้างอิง" },
    { key: "docNo", header: "เอกสารเลขที่", width: 18, group: "เอกสารอ้างอิง" },
    { key: "company", header: "บริษัท", width: 26, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ", width: 26, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "title", header: "ประเภทงาน", width: 16, group: "ข้อมูลงาน" },
    { key: "contractStart", header: "เริ่มสัญญา", width: 13, group: "ระยะเวลา", align: "center" },
    { key: "contractEnd", header: "สิ้นสุดสัญญา", width: 13, group: "ระยะเวลา", align: "center" },
    { key: "intervalMonths", header: "รอบเข้า (เดือน)", width: 14, group: "ระยะเวลา", align: "center" },
    { key: "perYear", header: "เข้าปีละ (ครั้ง)", width: 14, group: "ระยะเวลา", align: "center" },
    { key: "visitCount", header: "จำนวนครั้ง", width: 11, group: "ระยะเวลา", align: "center" },
    { key: "jobValue", header: "มูลค่างาน", width: 15, group: "มูลค่า", align: "right", numFmt: "#,##0" },
    { key: "contractStatus", header: "สถานะสัญญา", width: 17, group: "สถานะ", align: "center" },
  ];
  const visitCols = visitColumns.map((n) => ({
    key: `visit_${n}`, header: `ครั้งที่ ${n}`, width: 24, group: "วันที่เข้างานแต่ละครั้ง", wrap: true,
  }));
  const tailCols = [
    { key: "responsiblePerson", header: "ผู้รับผิดชอบงาน", width: 20, group: "ผู้เกี่ยวข้อง" },
    { key: "teamLeader", header: "หัวหน้าทีมเข้างาน (ครั้งที่ 1)", width: 22, group: "ผู้เกี่ยวข้อง" },
    { key: "teamMembers", header: "ลูกทีม (ครั้งที่ 1)", width: 24, group: "ผู้เกี่ยวข้อง", wrap: true },
  ];
  const cols = [...baseCols, ...visitCols, ...tailCols];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = cols.length;

  // ── แถว 1-3: หัวเรื่องรายงาน ─────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "ภาพรวมงาน / สัญญาบริการ";
  titleCell.font = { name: "Tahoma", size: 16, bold: true, color: { argb: C.titleText } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = `มุมมอง: ${meta.viewLabel}  ·  ปี: ${meta.yearLabel}  ·  ${meta.filterSummary}  ·  รวม ${rows.length} รายการ  ·  ส่งออก ${meta.exportedAt}`;
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
  rows.forEach((c, rIdx) => {
    const st = contractStatusInfo(c);
    const values = {
      contractNo: c.contractNo || "",
      quotationNo: c.quotationNo || "",
      docNo: c.docNo || "",
      company: c.company || "",
      site: c.site || "",
      system: c.system || "",
      title: c.title || "",
      // ⚠️ ส่งเป็น Date จริง ไม่ใช่ string — Excel จะเรียง/กรอง/คำนวณวันที่ได้จริง (CSV เดิมเป็นข้อความ
      // ล้วน เรียงตามตัวอักษรเท่านั้น) รูปแบบการแสดงผลกำหนดผ่าน numFmt ด้านล่าง
      contractStart: c.contractStart ? new Date(c.contractStart) : "",
      contractEnd: c.contractEnd ? new Date(c.contractEnd) : "",
      intervalMonths: c.intervalMonths ?? "",
      perYear: visitsPerYear(c.intervalMonths) ?? "",
      visitCount: c.visitCount ?? "",
      jobValue: c.jobValue ?? "",
      contractStatus: st?.label || "",
      responsiblePerson: c.responsiblePerson || "— ยังไม่มอบหมาย —",
      teamLeader: c.teamLeaderName || "",
      teamMembers: (c.teamMemberNames || []).join(", "),
    };
    // ✅ ตรรกะรายครั้งเดียวกับตารางบนจอเป๊ะๆ (นับเฉพาะครั้งที่ลงตารางจริง / "รอวางแผน" ถ้ายังเป็นฉบับร่าง)
    const visitMeta = {};
    visitColumns.forEach((n) => {
      const visits = c.visits.filter((v) => !v.unscheduled && (Number(v.time) || 1) === n);
      const pendingDraft = visits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);
      values[`visit_${n}`] = visits.length > 0
        ? visits.map((v) => `${formatEventDateRange(v)}${v.team ? `\n👷 ${v.team}` : ""}`).join("\n")
        : pendingDraft ? "รอวางแผน" : "";
      visitMeta[n] = visits.length > 0 ? "done" : pendingDraft ? "pending" : "empty";
    });

    const row = ws.addRow(values);
    const isZebra = rIdx % 2 === 1;
    row.height = 30;

    cols.forEach((colDef, idx) => {
      const cell = row.getCell(idx + 1);
      cell.font = { name: "Tahoma", size: 10 };
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: colDef.align || "left",
        wrapText: Boolean(colDef.wrap),
      };
      if (isZebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (colDef.numFmt) cell.numFmt = colDef.numFmt;
      if (colDef.key === "contractStart" || colDef.key === "contractEnd") cell.numFmt = "dd/mm/yyyy";

      // 🎨 ระบายสีตามความหมายของข้อมูล — จุดที่ CSV ทำไม่ได้เลย และเป็นเหตุผลหลักที่ต้องเปลี่ยนรูปแบบไฟล์
      if (colDef.key === "contractStatus" && st) {
        const argb = st.label === "หมดอายุแล้ว" ? C.expired
          : st.label.startsWith("ใกล้หมดอายุ") ? C.nearExpiry
          : C.active;
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb } };
      }
      if (colDef.key === "responsiblePerson" && !c.responsiblePerson) {
        cell.font = { name: "Tahoma", size: 10, italic: true, color: { argb: C.muted } };
      }
      if (colDef.key.startsWith("visit_")) {
        const state = visitMeta[Number(colDef.key.slice(6))];
        if (state === "done") cell.font = { name: "Tahoma", size: 10, color: { argb: C.visitDone } };
        else if (state === "pending") cell.font = { name: "Tahoma", size: 10, italic: true, color: { argb: C.visitPending } };
      }
    });
  });

  // ✅ เปิดตัวกรอง (AutoFilter) ให้ที่หัวตาราง — ผู้ใช้กรอง/เรียงต่อเองได้ทันทีโดยไม่ต้องตั้งเอง
  if (rows.length > 0) {
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: lastCol } };
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    meta.fileName
  );
}
