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
 * @param {Function} progressLabel  คืนข้อความคอลัมน์ "คืบหน้า" ของแถวนั้น — ใช้ฟังก์ชันเดียวกับบนจอ
 */
export async function exportContractsToExcel({
  rows,
  visitColumns,
  meta,
  contractStatusInfo,
  formatEventDateRange,
  visitsPerYear,
  progressLabel,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();

  // ✅ ไม่ตรึง (freeze) แถว/คอลัมน์ใดๆ ตามที่ผู้ใช้ขอ — เดิมตรึงหัวตาราง 5 แถวแรก + 4 คอลัมน์แรกไว้เสมอ
  // ซึ่งทำให้เลื่อนดูข้อมูลแล้วรู้สึกติดขัด/แบ่งจอเป็นสองส่วน ตอนนี้เลื่อนได้อิสระทั้งแผ่นเหมือนตารางปกติ
  const ws = wb.addWorksheet("ภาพรวมงาน", {
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
    // ✅ เพิ่มให้ตรงกับคอลัมน์ "คืบหน้า" ในตารางบนจอ (เดิมไฟล์ที่ส่งออกไม่มีคอลัมน์นี้เลย ทั้งที่บนจอมี) —
    // สัญญาจริงเป็น "X/Y" (ครั้งที่ทำเสร็จ) ส่วนงานทั่วไป/โปรเจคเป็นสถานะงานตรงๆ (ดู progressInfo)
    { key: "progress", header: "คืบหน้า / สถานะงาน", width: 18, group: "สถานะ", align: "center" },
  ];
  // ✅ แต่ละครั้งแสดงครบในเซลล์เดียว: วันที่ → 👷 หัวหน้าทีมของครั้งนั้น → 👥 ลูกทีมของครั้งนั้น
  // (เดิมมีแค่วันที่ + หัวหน้าทีม ลูกทีมถูกยุบไปรวมเป็นก้อนเดียวท้ายตาราง แยกไม่ออกว่าใครช่วยครั้งไหน)
  // ⚠️ เปลี่ยนชื่อกลุ่มจาก "วันที่เข้างานแต่ละครั้ง" เป็น "รายละเอียดแต่ละครั้ง" ให้ตรงกับเนื้อหาจริง
  // ที่ไม่ได้มีแค่วันที่อีกต่อไป + ขยายความกว้าง 24 → 30 รองรับรายชื่อลูกทีมที่ยาวขึ้น
  const visitCols = visitColumns.map((n) => ({
    key: `visit_${n}`, header: `ครั้งที่ ${n}`, width: 30, group: "รายละเอียดแต่ละครั้ง (วันที่ / ทีมที่เข้างาน)", wrap: true,
  }));
  // ✅ ตัดคอลัมน์ "หัวหน้าทีมเข้างาน (ครั้งที่ 1)" ออกตามที่ผู้ใช้ขอ — ข้อมูลซ้ำซ้อนอยู่แล้ว เพราะหัวหน้า
  // ทีมของ "ทุกครั้ง" แสดงอยู่ในคอลัมน์ครั้งที่ 1..N ทีละครั้งอยู่แล้ว (บรรทัด 👷 ใต้วันที่) ซึ่งถูกต้อง
  // กว่าด้วย เพราะแต่ละครั้งเข้าโดยคนละทีมกันได้
  // 🐛 BUG ที่แก้ (ช่องลูกทีมว่างเปล่าทั้งที่มีลูกทีมจริง): เดิมดึงจาก teamMembers ของ "ครั้งที่ 1"
  // เท่านั้น (c.teamMemberNames ซึ่ง groupEventsByContract คำนวณจาก head = ครั้งแรกสุดครั้งเดียว) —
  // ลูกทีมที่ไปช่วยครั้งที่ 2, 3, ... ไม่เคยถูกนับเลยสักคน และถ้าครั้งที่ 1 ไม่มีลูกทีม (มีแต่หัวหน้าทีม
  // คนเดียว ซึ่งเป็นกรณีปกติมาก) ช่องนี้ก็ว่างเปล่าทั้งที่ครั้งอื่นมีลูกทีมอยู่จริง
  // ✅ ตอนนี้ลูกทีม "แยกรายครั้ง" อยู่ในคอลัมน์ครั้งที่ 1..N แล้ว (บรรทัด 👥 ในแต่ละเซลล์) — คอลัมน์นี้
  // เก็บไว้เป็นช่องสรุปรวมทุกคนของทั้งแถวไว้ในเซลล์เดียว ซึ่งยังจำเป็นอยู่ เพราะใช้ค้นหา/กรองใน Excel
  // ได้ในช่องเดียว (เช่นหาว่ามีงานไหนบ้างที่คนนี้เคยไปช่วย) ถ้าไปแยกอยู่ 12 คอลัมน์อย่างเดียวจะกรองยากมาก
  const tailCols = [
    { key: "responsiblePerson", header: "ผู้รับผิดชอบงาน", width: 20, group: "ผู้เกี่ยวข้อง" },
    { key: "teamMembers", header: "ลูกทีมทั้งหมด (รวมทุกครั้ง — ไว้ค้นหา/กรอง)", width: 30, group: "ผู้เกี่ยวข้อง", wrap: true },
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
      progress: progressLabel ? progressLabel(c) : "",
      responsiblePerson: c.responsiblePerson || "— ยังไม่มอบหมาย —",
      // ✅ ลูกทีมจากทุกครั้งของแถวนี้ (ไม่ใช่แค่ครั้งที่ 1 เหมือนเดิม) ตัดชื่อซ้ำ + ตัดชื่อที่เป็นหัวหน้า
      // ทีมของครั้งนั้นๆ ออก (บางที่บันทึกหัวหน้าทีมซ้ำลงใน teamMembers ด้วย จะได้ไม่ขึ้นซ้ำในช่องลูกทีม)
      teamMembers: [...new Set(
        (c.visits || []).flatMap((v) =>
          (v.teamMembers || [])
            .map((m) => m?.name)
            .filter(Boolean)
            .filter((name) => name !== v.team)
        )
      )].join(", "),
    };
    // ✅ ตรรกะรายครั้งเดียวกับตารางบนจอเป๊ะๆ (นับเฉพาะครั้งที่ลงตารางจริง / "รอวางแผน" ถ้ายังเป็นฉบับร่าง)
    const visitMeta = {};
    visitColumns.forEach((n) => {
      const visits = c.visits.filter((v) => !v.unscheduled && (Number(v.time) || 1) === n);
      const pendingDraft = visits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);
      // ✅ แยกลูกทีมของ "แต่ละครั้ง" ไว้ในเซลล์ของครั้งนั้นเอง — เห็นได้ทันทีว่าใครไปช่วยครั้งไหนบ้าง
      // (เดิมเห็นแค่หัวหน้าทีม ส่วนลูกทีมถูกยุบรวมเป็นก้อนเดียวท้ายตาราง แยกรายครั้งไม่ได้เลย)
      // ⚠️ 1 ครั้งอาจมีหลาย document ได้ (เข้างานหลายวันไม่ติดกัน) จึงวนทีละ document แล้วต่อด้วย \n
      values[`visit_${n}`] = visits.length > 0
        ? visits.map((v) => {
            const members = [...new Set(
              (v.teamMembers || [])
                .map((m) => m?.name)
                .filter(Boolean)
                .filter((name) => name !== v.team) // กันหัวหน้าทีมโผล่ซ้ำในบรรทัดลูกทีม
            )];
            return [
              formatEventDateRange(v),
              v.team ? `👷 ${v.team}` : "",
              members.length > 0 ? `👥 ${members.join(", ")}` : "",
            ].filter(Boolean).join("\n");
          }).join("\n")
        : pendingDraft ? "รอวางแผน" : "";
      visitMeta[n] = visits.length > 0 ? "done" : pendingDraft ? "pending" : "empty";
    });

    const row = ws.addRow(values);
    const isZebra = rIdx % 2 === 1;
    // ⚠️ ต้องคำนวณความสูงแถวเองตามจำนวนบรรทัดจริง — ExcelJS ที่กำหนด row.height ตายตัวจะ "ล็อก" ความสูง
    // ไว้เท่านั้นเสมอ Excel จะไม่ขยายให้อัตโนมัติแม้เปิด wrapText ไว้ก็ตาม เดิมล็อกไว้ 30 ซึ่งพอดีกับ
    // 2 บรรทัด (วันที่ + หัวหน้าทีม) — พอเพิ่มบรรทัดลูกทีมเข้ามาบรรทัดที่ 3 ขึ้นไปจะโดนตัดหายทันที
    const maxLines = Math.max(
      1,
      ...Object.values(values).map((v) => (typeof v === "string" ? v.split("\n").length : 1))
    );
    row.height = Math.max(30, maxLines * 14);

    cols.forEach((colDef, idx) => {
      const cell = row.getCell(idx + 1);
      cell.font = { name: "Tahoma", size: 10 };
      cell.border = thinBorder;
      cell.alignment = {
        // ✅ ช่องที่ตัดบรรทัดได้ (ครั้งที่ N / ลูกทีม) ชิดบนแทนกึ่งกลาง — แถวสูงไม่เท่ากันแล้วตามจำนวน
        // บรรทัดจริง ถ้าจัดกึ่งกลางทุกช่อง ข้อความในแถวเดียวกันจะลอยอยู่คนละระดับ กวาดสายตาอ่านยาก
        vertical: colDef.wrap ? "top" : "middle",
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

  // ── แถวสรุปยอดรวมท้ายตาราง ───────────────────────────────────────────────
  // ✅ ให้ตรงกับแถวสรุปยอดรวมที่เพิ่มเข้าไปในตารางบนจอ — เดิมไฟล์ที่ส่งออกไม่มียอดรวมเลย ต้องไปรวมเอง
  // ใน Excel ทุกครั้ง ⚠️ ใช้สูตร SUM() จริง (ไม่ใช่ตัวเลขนิ่งที่คำนวณมาจาก JS) เพื่อให้ยอดอัปเดตตามเอง
  // ถ้าผู้ใช้ไปแก้ตัวเลขมูลค่างานต่อในไฟล์ หรือกรองด้วย AutoFilter แล้วดูเฉพาะบางแถว
  if (rows.length > 0) {
    const jobValueIdx = cols.findIndex((c) => c.key === "jobValue") + 1;
    const firstDataRow = HEADER_ROW + 1;
    const lastDataRow = HEADER_ROW + rows.length;
    const totalRow = ws.getRow(lastDataRow + 1);
    const filledCount = rows.filter((r) => r.jobValue !== null && r.jobValue !== undefined && r.jobValue !== "" && !Number.isNaN(Number(r.jobValue))).length;
    const missingCount = rows.length - filledCount;

    // ป้ายกำกับ — merge ตั้งแต่คอลัมน์แรกจนถึงก่อนคอลัมน์มูลค่างาน ให้ยอดตกลงใต้คอลัมน์ของมันพอดี
    if (jobValueIdx > 1) ws.mergeCells(lastDataRow + 1, 1, lastDataRow + 1, jobValueIdx - 1);
    const labelCell = totalRow.getCell(1);
    labelCell.value = missingCount > 0
      ? `รวมมูลค่างานทั้งหมด (${filledCount}/${rows.length} รายการที่ระบุมูลค่าแล้ว · อีก ${missingCount} รายการยังไม่ได้กรอก)`
      : `รวมมูลค่างานทั้งหมด (${rows.length} รายการ)`;
    labelCell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };

    const sumCell = totalRow.getCell(jobValueIdx);
    sumCell.value = { formula: `SUBTOTAL(109,${ws.getColumn(jobValueIdx).letter}${firstDataRow}:${ws.getColumn(jobValueIdx).letter}${lastDataRow})` };
    sumCell.numFmt = "#,##0";
    sumCell.font = { name: "Tahoma", size: 11, bold: true, color: { argb: C.headerText } };
    sumCell.alignment = { vertical: "middle", horizontal: "right" };

    // พื้นหลัง/ขอบให้ครบทั้งแถว ไม่งั้นแถวสรุปจะดูขาดเป็นช่วงๆ
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
