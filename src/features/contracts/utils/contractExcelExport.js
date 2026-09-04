import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
// ✅ ของกลางชุดเดียวกับหน้าจอ — ยอดในไฟล์ต้องตรงกับที่เห็นบนจอเสมอ
import { contractBillingSummary, roundBillingStatus, baht as bahtText } from "@/shared/utils/billing";
import { JOB_DOC_TYPES, roundDocs } from "@/shared/utils/jobDocTypes";
// ✅ ป้ายแผนกชุดเดียวกับหน้าจอ — ไฟล์ที่ส่งออกต้องเรียกชื่อแผนกเหมือนที่คนกรอกเห็นบนจอเป๊ะๆ
import { DEPARTMENT, DEPARTMENT_LABEL } from "@/shared/utils/roles";

// ✅ รูปแบบตัวเลขของช่องจำนวนเงินทุกช่องในไฟล์ที่ส่งออก — เก็บเป็น "ตัวเลขจริง" ใน cell (บวก/ลบ/SUM ต่อ
// ในไฟล์ได้ตามปกติ) แต่ให้ Excel แสดงผลพร้อมสัญลักษณ์ ฿ นำหน้าเสมอ ตรงกับที่แสดงบนหน้าจอ — เดิมเป็น
// ตัวเลขเปล่าๆ ที่แยกไม่ออกจากคอลัมน์ "จำนวนครั้ง"/"จำนวนวัน" ที่อยู่ข้างกันในไฟล์เดียวกัน

const MONEY_FMT = '"฿"#,##0';


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
  // ป้ายแผนก — คู่สีเดียวกับบนหน้าจอ (แดง = สายบริการ/ช่าง · ม่วง = สายขาย)
  deptService: "FFDC2626",
  deptSales: "FF8B5CF6",
};

// ✅ สีตัวหนังสือของคอลัมน์ "แผนก" — งานเก่าที่ยังไม่เคยติดป้ายถือเป็นฝ่ายบริการเหมือนบนหน้าจอ
const deptColor = (v) => (v === DEPARTMENT.SALES ? C.deptSales : C.deptService);
const deptLabel = (v) => DEPARTMENT_LABEL[v || DEPARTMENT.SERVICE] || DEPARTMENT_LABEL[DEPARTMENT.SERVICE];

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
  statusLabel,
  missingFields,
  durationYears,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();

  // ✅ ชีต "สรุปสำหรับผู้บริหาร" ถูกสร้างก่อนชีตข้อมูลดิบโดยตั้งใจ — Excel เรียงแท็บตามลำดับที่สร้าง
  // และเปิดไฟล์มาที่แท็บแรกเสมอ คนที่เปิดไฟล์จึงเจอ "สรุป" ก่อน ไม่ใช่เจอตาราง 20+ คอลัมน์แล้วต้อง
  // ไปหาเองว่าสรุปอยู่ไหน (ตามที่ผู้ใช้ขอให้ "ดูสรุปข้อมูลง่ายที่สุด")
  buildSummarySheet(wb, { rows, meta, contractStatusInfo, missingFields, durationYears });

  // ✅ ไม่ตรึง (freeze) แถว/คอลัมน์ใดๆ ตามที่ผู้ใช้ขอ — เดิมตรึงหัวตาราง 5 แถวแรก + 4 คอลัมน์แรกไว้เสมอ
  // ซึ่งทำให้เลื่อนดูข้อมูลแล้วรู้สึกติดขัด/แบ่งจอเป็นสองส่วน ตอนนี้เลื่อนได้อิสระทั้งแผ่นเหมือนตารางปกติ
  const ws = wb.addWorksheet("ภาพรวมงาน", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ── นิยามคอลัมน์ (ลำดับ/ความกว้าง/การจัดวาง) ────────────────────────────
  const baseCols = [
    // ✅ แผนกอยู่หน้าสุดตามที่ผู้ใช้ขอ — ตรงกับลำดับคอลัมน์บนหน้าจอ (ไฟล์กับจออ่านเรียงเหมือนกันเป๊ะ)
    // และเป็นตัวแบ่งสายงานที่กว้างที่สุด เจ้านายกวาดตาคอลัมน์แรกก็แยกงานบริการ/งานขายออกได้ทันที
    { key: "departmentTag", header: "แผนก", width: 12, group: "แผนก", align: "center" },
    { key: "contractNo", header: "เลขที่สัญญา", width: 18, group: "เอกสารอ้างอิง" },
    { key: "quotationNo", header: "ใบเสนอราคา", width: 18, group: "เอกสารอ้างอิง" },
    { key: "docNo", header: "เอกสารเลขที่", width: 18, group: "เอกสารอ้างอิง" },
    { key: "company", header: "บริษัท", width: 26, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ", width: 26, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "title", header: "ประเภทงาน", width: 16, group: "ข้อมูลงาน" },
    { key: "contractStart", header: "เริ่มสัญญา", width: 13, group: "ระยะเวลา", align: "center" },
    { key: "contractEnd", header: "สิ้นสุดสัญญา", width: 13, group: "ระยะเวลา", align: "center" },
    // ✅ อายุสัญญาเป็นจำนวนปี — สัญญา 2-3 ปีมีเงื่อนไขต่างจากปีต่อปีชัดเจน ต้องแยก/pivot ได้ในไฟล์ด้วย
    // ไม่ใช่ให้เจ้านายมานั่งลบวันที่เอาเองทีละแถว (เทียบคอลัมน์เดียวกับตัวกรอง "อายุสัญญา" บนหน้าจอ)
    { key: "durationYears", header: "อายุสัญญา (ปี)", width: 13, group: "ระยะเวลา", align: "center" },
    { key: "intervalMonths", header: "รอบเข้า (เดือน)", width: 14, group: "ระยะเวลา", align: "center" },
    { key: "perYear", header: "เข้าปีละ (ครั้ง)", width: 14, group: "ระยะเวลา", align: "center" },
    { key: "visitCount", header: "จำนวนครั้ง", width: 11, group: "ระยะเวลา", align: "center" },
    { key: "jobValue", header: "มูลค่างาน (฿)", width: 15, group: "มูลค่า", align: "right", numFmt: MONEY_FMT },
    // ✅ ค่าคอมที่จ่ายให้ฝั่งลูกค้า + สัดส่วนเทียบมูลค่างาน — ใส่ % เป็นคอลัมน์แยกให้เรียง/กรองได้
    // (บนจอโชว์เป็นบรรทัดเล็กใต้ตัวเลข ซึ่งดีเวลาไล่ดูทีละแถว แต่ในไฟล์ต้องเป็นคอลัมน์ถึงจะใช้งานต่อได้)
    { key: "commission", header: "ค่าคอม (฿)", width: 15, group: "มูลค่า", align: "right", numFmt: MONEY_FMT },
    { key: "commissionPct", header: "ค่าคอม (% ของมูลค่างาน)", width: 20, group: "มูลค่า", align: "center", numFmt: "0.00%" },
    { key: "contractStatus", header: "สถานะสัญญา", width: 22, group: "สถานะ", align: "center", wrap: true },
    // ✅ ช่องที่ยังไม่ได้กรอกของแถวนั้น — ตามที่ผู้ใช้ขอให้ "สถานะสัญญาถ้ายังไม่สมบูรณ์ ให้มีข้อความบอก"
    // ⚠️ ต้องเป็นคอลัมน์แยก ไม่ใช่ต่อท้ายในช่องสถานะ — เจ้านายกรองคอลัมน์นี้ด้วย AutoFilter เพื่อดึงเฉพาะ
    // งานที่ข้อมูลยังไม่ครบออกมาสั่งงานต่อได้ทันที ถ้าปนอยู่ในช่องเดียวกับสถานะจะกรองแยกไม่ได้เลย
    { key: "missingFields", header: "ข้อมูลที่ยังไม่ครบ", width: 30, group: "สถานะ", wrap: true },
    // ✅ เพิ่มให้ตรงกับคอลัมน์ "คืบหน้า" ในตารางบนจอ (เดิมไฟล์ที่ส่งออกไม่มีคอลัมน์นี้เลย ทั้งที่บนจอมี) —
    // สัญญาจริงเป็น "X/Y" (ครั้งที่ทำเสร็จ) ส่วนงานทั่วไป/โปรเจคเป็นสถานะงานตรงๆ (ดู progressInfo)
    { key: "progress", header: "คืบหน้า / สถานะงาน", width: 18, group: "สถานะ", align: "center" },
    // ✅ การวางบิล/รับเงิน — ต้องมีในไฟล์ที่ส่งออกด้วย ไม่ใช่มีแต่บนจอ เพราะคนที่ใช้ตัวเลขนี้จริง
    // (บัญชี/ผู้บริหาร) ทำงานกับไฟล์ Excel เป็นหลัก ไม่ได้เปิดหน้าจอนั่งไล่ดูทีละแถว
    // ⚠️ 3 ช่องยอดเป็นตัวเลขจริง ไม่ใช่ข้อความ — ต้องเอาไป sum/pivot ต่อในไฟล์ได้
    { key: "billingStatus", header: "สถานะวางบิล", width: 18, group: "วางบิล / รับเงิน", align: "center" },
    { key: "billingInvoiced", header: "ยอดวางบิล (฿)", width: 15, group: "วางบิล / รับเงิน", align: "right", numFmt: MONEY_FMT },
    { key: "billingPaid", header: "รับเงินแล้ว (฿)", width: 15, group: "วางบิล / รับเงิน", align: "right", numFmt: MONEY_FMT },
    { key: "billingOutstanding", header: "ค้างรับ (฿)", width: 15, group: "วางบิล / รับเงิน", align: "right", numFmt: MONEY_FMT },
    // ✅ จำนวนไฟล์เอกสารแยกตามชนิด รวมทุกครั้งของแถวนั้น — บนจอเห็นเป็นไอคอนรายครั้ง (ดูง่ายเวลาไล่
    // ทีละงาน) แต่ในไฟล์ต้องเป็น "ตัวเลขต่อคอลัมน์" ถึงจะใช้งานแบบ Excel ได้จริง คือกรอง/เรียง/pivot
    // เพื่อตอบคำถามอย่าง "งานไหนบ้างที่ยังไม่มีใบส่งมอบงาน" ซึ่งเป็นเหตุผลหลักที่คนส่งออกไฟล์นี้
    // ⚠️ ที่นี่ใส่ 0 ได้ (ต่างจากคอลัมน์ยอดเงินที่เว้นว่างเมื่อยังไม่วางบิล) เพราะ "ไฟล์ 0 ไฟล์" มี
    // ความหมายชัดเจนในตัวเอง ไม่กำกวมเหมือน "ยอด 0 บาท" ที่แยกไม่ออกจาก "ยังไม่ได้วางบิล"
    // ⚠️ ต้องมี "(ไฟล์)" ต่อท้ายเสมอ — ไม่งั้นหัวคอลัมน์นี้จะซ้ำกับคอลัมน์ "ใบเสนอราคา" ในกลุ่ม
    // เอกสารอ้างอิง (ซึ่งเก็บ "เลขที่" ใบเสนอราคา) หัวข้อเดียวกัน 2 คอลัมน์คนละความหมายในชีตเดียว
    // ทำให้อ่านผิดและเขียนสูตรอ้างผิดคอลัมน์ได้ง่ายมาก
    ...JOB_DOC_TYPES.map((t) => ({
      key: `doc_${t.key}`, header: `${t.label} (ไฟล์)`, width: 16,
      group: "เอกสารแนบ (จำนวนไฟล์ · รวมทุกครั้ง)", align: "center",
    })),
  ];
  // ✅ แต่ละครั้งแสดงครบในเซลล์เดียว: วันที่ → 👷 หัวหน้าทีมของครั้งนั้น → 👥 ลูกทีมของครั้งนั้น
  // (เดิมมีแค่วันที่ + หัวหน้าทีม ลูกทีมถูกยุบไปรวมเป็นก้อนเดียวท้ายตาราง แยกไม่ออกว่าใครช่วยครั้งไหน)
  // ⚠️ เปลี่ยนชื่อกลุ่มจาก "วันที่เข้างานแต่ละครั้ง" เป็น "รายละเอียดแต่ละครั้ง" ให้ตรงกับเนื้อหาจริง
  // ที่ไม่ได้มีแค่วันที่อีกต่อไป + ขยายความกว้าง 24 → 30 รองรับรายชื่อลูกทีมที่ยาวขึ้น
  const visitCols = visitColumns.map((n) => ({
    key: `visit_${n}`, header: `ครั้งที่ ${n}`, width: 30, group: "รายละเอียดแต่ละครั้ง (วันที่ / ทีม / วางบิล / เอกสาร)", wrap: true,
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
    // ✅ หมายเหตุที่คนทำงานจดไว้เอง — วางท้ายสุดเพราะยาวไม่แน่นอน ถ้าแทรกกลางตารางจะดันคอลัมน์ที่ต้อง
    // กวาดสายตาเทียบกันทุกแถวให้เลื่อนหนีไปทางขวา (ตรงกับตำแหน่งคอลัมน์เดียวกันบนหน้าจอ)
    { key: "remark", header: "หมายเหตุ", width: 36, group: "หมายเหตุ", wrap: true },
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
      departmentTag: deptLabel(c.departmentTag),
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
      // ⚠️ เว้นว่างเมื่อคำนวณไม่ได้ (ยังไม่กรอกวันเริ่ม/สิ้นสุด) ไม่ใส่ 0 — 0 ปีไม่มีความหมายและจะไป
      // กวนค่าเฉลี่ย/การกรองใน Excel เหมือนกรณีคอลัมน์ยอดเงินที่เว้นว่างไว้ด้วยเหตุผลเดียวกัน
      durationYears: durationYears ? (durationYears(c) ?? "") : "",
      intervalMonths: c.intervalMonths ?? "",
      perYear: visitsPerYear(c.intervalMonths) ?? "",
      visitCount: c.visitCount ?? "",
      jobValue: c.jobValue ?? "",
      commission: c.commission ?? "",
      // ⚠️ เก็บเป็นสัดส่วน (0.1) ไม่ใช่ 10 — numFmt "0.00%" ของ Excel คูณ 100 ให้เองตอนแสดงผล
      // ถ้าใส่ 10 ไปตรงๆ จะกลายเป็น 1000% · เว้นว่างเมื่อคำนวณไม่ได้ ไม่ใส่ 0 (0% กับ "ไม่รู้มูลค่างาน"
      // คนละความหมาย และ 0 จะไปกวนค่าเฉลี่ยตอน pivot)
      commissionPct: (() => {
        const base = Number(c.jobValue);
        const com = Number(c.commission);
        return Number.isFinite(base) && base > 0 && Number.isFinite(com) && com > 0 ? com / base : "";
      })(),
      // ✅ ข้อความเดียวกับที่เห็นบนหน้าจอเป๊ะๆ (หมายเหตุที่พิมพ์เอง > สถานะอัตโนมัติ > "ข้อมูลไม่ครบ")
      // — ส่งฟังก์ชันกลางจากหน้าจอเข้ามา ไม่คำนวณซ้ำที่นี่ กันไฟล์กับจอพูดไม่ตรงกัน
      contractStatus: statusLabel ? statusLabel(c) : (st?.label || ""),
      missingFields: missingFields ? missingFields(c) : "",
      // ⚠️ ใช้ contractBillingSummary ตัวเดียวกับที่ตารางบนจอใช้ — ห้ามคำนวณซ้ำที่นี่ ไม่งั้นยอดในไฟล์
      // กับยอดบนจอจะไม่ตรงกัน ซึ่งเป็นเรื่องเงินและตรวจสอบย้อนหลังได้ยากมากเมื่อไฟล์ถูกส่งต่อไปแล้ว
      // ⚠️ แถวที่ยังไม่เคยวางบิลเลยเว้นว่าง ไม่ใส่ 0 — 0 บาทกับ "ยังไม่วางบิล" คนละความหมาย และ 0
      // จะไปกวนค่าเฉลี่ย/การกรองใน Excel
      // จำนวนไฟล์แต่ละชนิดของทั้งแถว (รวมทุกครั้ง) — ตัวเลขล้วนเพื่อให้กรอง/pivot ต่อได้
      ...Object.fromEntries(JOB_DOC_TYPES.map((t) => [
        `doc_${t.key}`,
        (c.visits || []).reduce((sum, v) => sum + (v?.[t.field]?.length || 0), 0),
      ])),
      ...(() => {
        const bs = contractBillingSummary(c.visits || []);
        if (!bs) return { billingStatus: "", billingInvoiced: "", billingPaid: "", billingOutstanding: "" };
        return {
          billingStatus: bs.state === "overdue" && bs.overdueDays > 0
            ? `เลยกำหนดชำระ ${bs.overdueDays} วัน`
            : `${bs.label} (${bs.invoicedCount}/${bs.totalCount} ครั้ง)`,
          billingInvoiced: bs.invoicedCount > 0 ? bs.net : "",
          billingPaid: bs.invoicedCount > 0 ? bs.paid : "",
          billingOutstanding: bs.invoicedCount > 0 ? bs.outstanding : "",
        };
      })(),
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
      remark: c.remark || "",
    };
    // ✅ ตรรกะรายครั้งเดียวกับตารางบนจอเป๊ะๆ (นับเฉพาะครั้งที่ลงตารางจริง / "รอวางแผน" ถ้ายังเป็นฉบับร่าง)
    const visitMeta = {};
    visitColumns.forEach((n) => {
      // ⚠️ เรียงตามวันที่จริงเหมือนบนจอ — เดิมไม่ได้เรียง ทำให้ลำดับวันในเซลล์เดียวกันของไฟล์กับของจอ
      // ไม่ตรงกันเวลาครั้งนั้นมีหลายช่วง (ผู้ใช้เทียบไฟล์กับจอแล้วนึกว่าข้อมูลคนละชุด)
      const visits = c.visits
        .filter((v) => !v.unscheduled && (Number(v.time) || 1) === n)
        .sort((x, y) => new Date(x.start || x.date) - new Date(y.start || y.date));
      const pendingDraft = visits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);

      // ✅ แยกลูกทีมของ "แต่ละครั้ง" ไว้ในเซลล์ของครั้งนั้นเอง — เห็นได้ทันทีว่าใครไปช่วยครั้งไหนบ้าง
      // ⚠️ 1 ครั้งอาจมีหลาย document ได้ (เข้างานหลายวันไม่ติดกัน) จึงวนทีละ document แล้วต่อด้วย \n
      const lines = visits.map((v) => {
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
      });

      // 🐛 BUG ที่แก้ (บรรทัดวางบิลซ้ำหลายรอบในครั้งเดียว): เดิมบรรทัดนี้อยู่ในลูปของแต่ละ document
      // ครั้งที่เข้างานหลายช่วงจึงมีบรรทัด [บิล] โผล่ซ้ำตามจำนวนช่วง ทั้งที่วางบิลใบเดียวต่อครั้ง —
      // และไม่ตรงกับหน้าจอที่แสดงป้ายเดียวต่อครั้ง ต้องคิดระดับ "ครั้ง" เหมือนกัน (roundBillingStatus)
      if (visits.length > 0) {
        const bst = roundBillingStatus(visits);
        if (bst.state !== "not_invoiced") {
          const num = bst.target?.billing?.invoiceNo ? " " + bst.target.billing.invoiceNo : "";
          lines.push(bst.outstanding > 0
            ? `[บิล]${num} ${bst.label} · ค้าง ${bahtText(bst.outstanding)}`
            : `[บิล]${num} ${bst.label}`);
        }

        // ✅ เอกสารที่ช่างแนบไว้ของครั้งนี้ — ชุดเดียวกับที่หน้าภาพรวมงานแสดงเป็นไอคอน
        // ⚠️ ครั้งที่ไม่มีเอกสารไม่ต้องขึ้นบรรทัดนี้ ไม่งั้นทุกเซลล์สูงขึ้นอีก 1 บรรทัดโดยไม่ได้ข้อมูลอะไร
        const docs = roundDocs(visits);
        if (docs.length > 0) {
          lines.push(`[เอกสาร] ${docs.map((d) => `${d.label} ${d.files.length}`).join(" · ")}`);
        }
      }

      values[`visit_${n}`] = visits.length > 0 ? lines.join("\n") : pendingDraft ? "รอวางแผน" : "";
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
      // 🎨 สีของช่องสถานะ — ⚠️ ตัดสินจาก st (ค่าคำนวณ) ไม่ใช่จากข้อความในเซลล์ เพราะข้อความอาจเป็น
      // หมายเหตุที่คนพิมพ์เองซึ่งจะมีคำว่าอะไรก็ได้ · ไม่มี st = ข้อมูลไม่ครบ ใช้สีเตือนสีเดียวกับบนจอ
      if (colDef.key === "contractStatus") {
        const argb = st
          ? (st.label === "หมดอายุแล้ว" ? C.expired : st.label.startsWith("ใกล้หมดอายุ") ? C.nearExpiry : C.active)
          : (values.missingFields ? C.nearExpiry : C.muted);
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb } };
      }
      if (colDef.key === "missingFields" && values.missingFields) {
        cell.font = { name: "Tahoma", size: 10, color: { argb: C.nearExpiry } };
      }
      if (colDef.key === "departmentTag") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: deptColor(c.departmentTag) } };
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
  // ใน Excel ทุกครั้ง ⚠️ ใช้สูตร SUBTOTAL() จริง (ไม่ใช่ตัวเลขนิ่งที่คำนวณมาจาก JS) เพื่อให้ยอดอัปเดต
  // ตามเองถ้าผู้ใช้ไปแก้ตัวเลขต่อในไฟล์ และ "ไม่นับแถวที่ถูก AutoFilter ซ่อนอยู่" — เจ้านายกรองดูเฉพาะ
  // ฝ่ายขาย/เฉพาะปีนี้แล้วยอดท้ายตารางจะเปลี่ยนตามให้ทันที ไม่ต้องส่งออกไฟล์ใหม่
  // 🐛 BUG ที่แก้: เดิมรวมให้แค่คอลัมน์ "มูลค่างาน" คอลัมน์เดียว ทั้งที่คอลัมน์ค่าคอม/ยอดวางบิล/รับเงิน
  // แล้ว/ค้างรับ ล้วนเป็นตัวเลขที่ต้องดูยอดรวมทั้งนั้น — และเป็นตัวเลขชุดที่เจ้านายถามถึงมากที่สุดด้วยซ้ำ
  if (rows.length > 0) {
    const firstDataRow = HEADER_ROW + 1;
    const lastDataRow = HEADER_ROW + rows.length;
    const totalRowIdx = lastDataRow + 1;
    const totalRow = ws.getRow(totalRowIdx);
    const SUM_KEYS = ["jobValue", "commission", "billingInvoiced", "billingPaid", "billingOutstanding"];
    const firstSumIdx = Math.min(...SUM_KEYS.map((k) => cols.findIndex((c) => c.key === k) + 1));

    const filledCount = rows.filter((r) => r.jobValue !== null && r.jobValue !== undefined && r.jobValue !== "" && !Number.isNaN(Number(r.jobValue))).length;
    const missingCount = rows.length - filledCount;

    // ป้ายกำกับ — merge ตั้งแต่คอลัมน์แรกจนถึงก่อนคอลัมน์ยอดแรกสุด ให้ยอดตกลงใต้คอลัมน์ของมันพอดี
    if (firstSumIdx > 1) ws.mergeCells(totalRowIdx, 1, totalRowIdx, firstSumIdx - 1);
    const labelCell = totalRow.getCell(1);
    labelCell.value = missingCount > 0
      ? `รวมทั้งหมด ${rows.length} รายการ (ระบุมูลค่างานแล้ว ${filledCount} · ยังไม่ได้กรอกอีก ${missingCount})`
      : `รวมทั้งหมด ${rows.length} รายการ`;
    labelCell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    labelCell.alignment = { vertical: "middle", horizontal: "right" };

    SUM_KEYS.forEach((key) => {
      const idx = cols.findIndex((c) => c.key === key) + 1;
      if (idx <= 0) return;
      const letter = ws.getColumn(idx).letter;
      const cell = totalRow.getCell(idx);
      cell.value = { formula: `SUBTOTAL(109,${letter}${firstDataRow}:${letter}${lastDataRow})` };
      cell.numFmt = MONEY_FMT;
      cell.font = { name: "Tahoma", size: 11, bold: true, color: { argb: C.headerText } };
      cell.alignment = { vertical: "middle", horizontal: "right" };
    });

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

/**
 * ชีต "สรุปสำหรับผู้บริหาร" — หน้าแรกที่เจ้านายเปิดดู
 *
 * ⚠️ ทำไมต้องมี: ชีตข้อมูลดิบมี 20+ คอลัมน์ × N แถว ซึ่งถูกต้องและครบถ้วนสำหรับคนทำงาน แต่คนที่ต้อง
 * ตัดสินใจไม่ได้อยากไล่อ่านทีละแถว เขาถามอยู่ไม่กี่คำถาม: ทั้งหมดกี่งาน มูลค่าเท่าไหร่ เก็บเงินได้แล้ว
 * เท่าไหร่ ค้างอยู่เท่าไหร่ ของแผนกไหนบ้าง และมีอะไรที่ต้องรีบจัดการไหม — ชีตนี้ตอบครบในหน้าเดียว
 *
 * ⚠️ ทุกตัวเลขที่นี่คำนวณจาก rows ชุดเดียวกับชีตข้อมูลดิบ (ที่ผ่านตัวกรองเดียวกับหน้าจอมาแล้ว) จึงตรง
 * กันเสมอทั้ง 2 ชีตและตรงกับหน้าจอด้วย — ห้ามดึงข้อมูลจากที่อื่นมาคำนวณเด็ดขาด
 */
function buildSummarySheet(wb, { rows, meta, contractStatusInfo, missingFields, durationYears }) {
  const ws = wb.addWorksheet("สรุปสำหรับผู้บริหาร", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { width: 34 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  // ── รวบรวมตัวเลขทั้งหมดในรอบเดียว ──────────────────────────────────────
  const blank = () => ({ count: 0, jobValue: 0, commission: 0, invoiced: 0, paid: 0, outstanding: 0 });
  const add = (acc, r) => {
    const bs = contractBillingSummary(r.visits || []);
    acc.count += 1;
    acc.jobValue += Number(r.jobValue) || 0;
    acc.commission += Number(r.commission) || 0;
    if (bs && bs.invoicedCount > 0) {
      acc.invoiced += bs.net || 0;
      acc.paid += bs.paid || 0;
      acc.outstanding += bs.outstanding || 0;
    }
    return acc;
  };

  const total = blank();
  const byDept = {};
  const byStatus = {};
  const byTitle = {};
  const byDuration = {};
  let noJobValue = 0;
  let overdueBilling = 0;
  let incompleteRows = 0;

  rows.forEach((r) => {
    add(total, r);
    const dk = r.departmentTag || DEPARTMENT.SERVICE;
    byDept[dk] = add(byDept[dk] || blank(), r);
    // ⚠️ จัดกลุ่มด้วย "สถานะจริงของสัญญา" ไม่ใช่ข้อความที่แสดงบนจอ — 2 เหตุผล:
    //   1) ป้าย "ใกล้หมดอายุ · 12 วัน" มีจำนวนวันต่อท้าย ถ้าจัดกลุ่มตามข้อความจะแตกเป็นคนละกลุ่มทุกสัญญา
    //   2) หมายเหตุที่คนพิมพ์เองเป็นข้อความอิสระ จะกลายเป็นกลุ่มละ 1 รายการเต็มไปหมดจนอ่านไม่รู้เรื่อง
    // (หมายเหตุยังอ่านได้ครบรายรายการที่ชีตข้อมูลดิบ — ที่นี่คือ "สรุป" จึงต้องยุบเป็นกลุ่มที่นับได้)
    const rst = contractStatusInfo(r);
    const sk = rst
      ? (rst.state === "expiring" ? "ใกล้หมดอายุ" : rst.label)
      : (missingFields && missingFields(r) ? "ข้อมูลไม่ครบ" : "— ไม่มีสถานะสัญญา —");
    byStatus[sk] = add(byStatus[sk] || blank(), r);
    const tk = r.title || "— ไม่ระบุประเภทงาน —";
    byTitle[tk] = add(byTitle[tk] || blank(), r);
    const dy = durationYears ? durationYears(r) : null;
    const dyk = dy ? `สัญญา ${dy} ปี` : "— ยังไม่ระบุอายุสัญญา —";
    byDuration[dyk] = add(byDuration[dyk] || blank(), r);
    if (!Number(r.jobValue)) noJobValue += 1;
    if (missingFields && missingFields(r)) incompleteRows += 1;
    const bs = contractBillingSummary(r.visits || []);
    if (bs?.state === "overdue") overdueBilling += 1;
  });

  // ── ตัวช่วยวาด ─────────────────────────────────────────────────────────
  let row = 1;
  const setTitle = (text, size, color) => {
    ws.mergeCells(row, 1, row, 6);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { name: "Tahoma", size, bold: true, color: { argb: color } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(row).height = size + 12;
    row += 1;
  };
  const sectionHead = (text) => {
    ws.mergeCells(row, 1, row, 6);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { name: "Tahoma", size: 11, bold: true, color: { argb: C.headerText } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    for (let k = 1; k <= 6; k += 1) {
      ws.getCell(row, k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.groupBg } };
      ws.getCell(row, k).border = thinBorder;
    }
    ws.getRow(row).height = 20;
    row += 1;
  };
  // หัวตารางย่อยของแต่ละหมวด — ชุดคอลัมน์เดียวกันหมดทุกหมวด อ่านซ้ำได้โดยไม่ต้องเรียนรู้ใหม่
  const BREAKDOWN_HEAD = ["", "จำนวนงาน", "มูลค่างาน (฿)", "วางบิลแล้ว (฿)", "รับเงินแล้ว (฿)", "ค้างรับ (฿)"];
  const headRow = (firstLabel) => {
    BREAKDOWN_HEAD.forEach((h, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = i === 0 ? firstLabel : h;
      cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true };
      cell.border = thinBorder;
    });
    ws.getRow(row).height = 22;
    row += 1;
  };
  const dataRow = (label, v, { bold = false, labelColor = null, zebra = false } = {}) => {
    const cells = [label, v.count, v.jobValue, v.invoiced, v.paid, v.outstanding];
    cells.forEach((val, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = val;
      cell.font = {
        name: "Tahoma", size: 10, bold: bold || i === 0,
        color: { argb: i === 0 && labelColor ? labelColor : "FF0F172A" },
      };
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : i === 1 ? "center" : "right" };
      cell.border = thinBorder;
      if (i >= 2) cell.numFmt = MONEY_FMT;
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
    });
    row += 1;
  };
  const spacer = () => { ws.getRow(row).height = 8; row += 1; };

  // ── หัวเรื่อง ──────────────────────────────────────────────────────────
  setTitle("สรุปภาพรวมงาน — สำหรับผู้บริหาร", 16, C.titleText);
  ws.mergeCells(row, 1, row, 6);
  const sub = ws.getCell(row, 1);
  sub.value = `มุมมอง: ${meta.viewLabel}  ·  ปี: ${meta.yearLabel}  ·  ${meta.filterSummary}  ·  ส่งออก ${meta.exportedAt}`;
  sub.font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.getRow(row).height = 18;
  row += 2;

  // ── แถบตัวเลขหลัก (KPI) ────────────────────────────────────────────────
  // ✅ 5 ตัวเลขที่ตอบคำถามของเจ้านายได้ทั้งหมดในบรรทัดเดียว วางไว้บนสุดก่อนตารางย่อยใดๆ — เปิดไฟล์มา
  // เห็นทันทีโดยไม่ต้องเลื่อนหรืออ่านตารางเลยสักช่อง (ตารางแยกหมวดข้างล่างคือ "แล้วมันมาจากไหน")
  // ⚠️ ป้ายกำกับอยู่แถวบน ตัวเลขอยู่แถวล่าง — อ่านเป็นคู่จากซ้ายไปขวา ไม่ใช่ตารางที่ต้องไล่หัวคอลัมน์
  const KPI = [
    ["จำนวนงานทั้งหมด", rows.length, null, C.titleText],
    ["มูลค่างานรวม", total.jobValue, MONEY_FMT, C.titleText],
    ["วางบิลแล้ว", total.invoiced, MONEY_FMT, C.visitDone],
    ["รับเงินแล้ว", total.paid, MONEY_FMT, C.active],
    ["ค้างรับ", total.outstanding, MONEY_FMT, total.outstanding > 0 ? C.expired : C.muted],
  ];
  KPI.forEach(([label], i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = label;
    cell.font = { name: "Tahoma", size: 9, bold: true, color: { argb: C.subtitleText } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { ...thinBorder, bottom: { style: "none" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
  });
  ws.getRow(row).height = 18;
  row += 1;
  KPI.forEach(([, value, fmt, color], i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = value;
    if (fmt) cell.numFmt = fmt;
    cell.font = { name: "Tahoma", size: 14, bold: true, color: { argb: color } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { ...thinBorder, top: { style: "none" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
  });
  ws.getRow(row).height = 30;
  row += 2;

  // ── ตัวเลขรวมทั้งหมด ────────────────────────────────────────────────────
  sectionHead("ภาพรวมทั้งหมด");
  headRow("รายการ");
  dataRow(`ทั้งหมด (${rows.length} รายการ)`, total, { bold: true });
  spacer();

  // ── แยกตามแผนก (คำถามแรกที่เจ้านายถามเสมอ จึงวางเป็นหมวดแรก) ──────────
  sectionHead("แยกตามแผนก");
  headRow("แผนก");
  Object.entries(byDept)
    .sort((a, b) => b[1].jobValue - a[1].jobValue)
    .forEach(([k, v], i) => dataRow(deptLabel(k), v, { labelColor: deptColor(k), zebra: i % 2 === 1 }));
  spacer();

  // ── แยกตามสถานะสัญญา ───────────────────────────────────────────────────
  sectionHead("แยกตามสถานะสัญญา");
  headRow("สถานะ");
  Object.entries(byStatus)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([k, v], i) => {
      const color = k === "หมดอายุแล้ว" ? C.expired
        : k.startsWith("ใกล้หมดอายุ") ? C.nearExpiry
        : k === "ข้อมูลไม่ครบ" ? C.nearExpiry
        : k.startsWith("—") ? C.muted
        : C.active;
      dataRow(k, v, { labelColor: color, zebra: i % 2 === 1 });
    });
  spacer();

  // ── แยกตามอายุสัญญา — สัญญายาวคือรายได้ที่ผูกไว้แล้วหลายปี ต่างจากงานปีต่อปีที่ต้องลุ้นต่อทุกปี ──
  sectionHead("แยกตามอายุสัญญา");
  headRow("อายุสัญญา");
  Object.entries(byDuration)
    // เรียงตามจำนวนปีจากน้อยไปมาก (แกะเลขจากป้าย) กลุ่ม "ยังไม่ระบุ" ไม่มีเลขจึงตกไปอยู่ท้ายสุดเสมอ
    .sort((a, b) => (parseInt(a[0].replace(/\D/g, ""), 10) || 99) - (parseInt(b[0].replace(/\D/g, ""), 10) || 99))
    .forEach(([k, v], i) => dataRow(k, v, { labelColor: k.startsWith("—") ? C.muted : null, zebra: i % 2 === 1 }));
  spacer();

  // ── แยกตามประเภทงาน — เห็นว่ารายได้มาจากงานแบบไหนเป็นหลัก ────────────
  sectionHead("แยกตามประเภทงาน");
  headRow("ประเภทงาน");
  Object.entries(byTitle)
    .sort((a, b) => b[1].jobValue - a[1].jobValue)
    .forEach(([k, v], i) => dataRow(k, v, { zebra: i % 2 === 1 }));
  spacer();

  // ── สิ่งที่ต้องจัดการ — ไม่ใช่ตัวเลขสวยๆ แต่เป็นของที่ค้างอยู่จริงและมีคนต้องไปตาม ────
  // ⚠️ ตั้งใจวางไว้ท้ายสุดแต่ใช้สีเตือน — ถ้าเอาไว้บนสุดจะกลายเป็นว่ารายงานเปิดมาเจอแต่ปัญหาก่อน
  // ทั้งที่ส่วนใหญ่ปกติดี แต่ถ้าไม่ใส่เลยก็เท่ากับซ่อนของที่ต้องรีบทำ
  sectionHead("สิ่งที่ต้องติดตาม");
  const alerts = [
    ["ข้อมูลสัญญายังไม่ครบ", incompleteRows, "รายการ", incompleteRows > 0 ? C.nearExpiry : C.muted],
    ["ยังไม่ได้กรอกมูลค่างาน", noJobValue, "รายการ", noJobValue > 0 ? C.nearExpiry : C.muted],
    ["วางบิลแล้วเลยกำหนดชำระ", overdueBilling, "รายการ", overdueBilling > 0 ? C.expired : C.muted],
    ["ยอดค้างรับรวม", total.outstanding, "฿", total.outstanding > 0 ? C.expired : C.muted],
  ];
  alerts.forEach(([label, value, unit, color], i) => {
    const l = ws.getCell(row, 1);
    l.value = label;
    l.font = { name: "Tahoma", size: 10, bold: true, color: { argb: "FF0F172A" } };
    l.alignment = { vertical: "middle", horizontal: "left" };
    l.border = thinBorder;
    ws.mergeCells(row, 2, row, 3);
    const v = ws.getCell(row, 2);
    v.value = unit === "฿" ? value : `${value.toLocaleString("th-TH")} ${unit}`;
    if (unit === "฿") v.numFmt = MONEY_FMT;
    v.font = { name: "Tahoma", size: 11, bold: true, color: { argb: color } };
    v.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    for (let k = 2; k <= 6; k += 1) ws.getCell(row, k).border = thinBorder;
    if (i % 2 === 1) {
      for (let k = 1; k <= 6; k += 1) {
        ws.getCell(row, k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      }
    }
    row += 1;
  });

  spacer();
  ws.mergeCells(row, 1, row, 6);
  const note = ws.getCell(row, 1);
  note.value = "ตัวเลขทั้งหมดคำนวณจากรายการในชีต \"ภาพรวมงาน\" ชุดเดียวกัน (ผ่านตัวกรองเดียวกับที่เห็นบนหน้าจอ) — ดูรายละเอียดรายรายการได้ที่ชีตนั้น";
  note.font = { name: "Tahoma", size: 9, italic: true, color: { argb: C.subtitleText } };
  note.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
}
