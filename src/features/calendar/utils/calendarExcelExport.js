import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";

/**
 * calendarExcelExport.js — ส่งออกตารางงานช่าง / ตารางนัดหมายฝ่ายขาย เป็นไฟล์ Excel (.xlsx)
 *
 * ✅ (8 ต.ค. 2569 ผู้ใช้: "แก้ไข export excel ให้สอดคล้องและสมบูรณ์ แบบมืออาชีพ")
 *   • แยกชุดคอลัมน์ตามตาราง — ฝ่ายขายได้คอลัมน์ของนัดหมาย (ประเภทนัด · ผู้ติดต่อ · สถานะนัด · เข้าพบ/ปิดงานเมื่อ ·
 *     รูปหน้างาน · ผลการเข้าพบ · มูลค่าโอกาส · ฝ่ายขาย) ไม่ใช่คอลัมน์ของงานช่าง (ระบบ/สัญญา/ครั้งที่/ทีม)
 *   • ชื่อรายงาน + สีประจำตาราง (ช่าง = แดง · ฝ่ายขาย = น้ำเงิน) ตรงกับหน้าจอ
 *   • ชีต "สรุป": จำนวนตามสถานะ · ตามประเภท · ตามคน (ทีมช่าง / ฝ่ายขาย) · มูลค่ารวม
 *   • พิมพ์: แนวนอน พอดีความกว้าง · หัวตารางพิมพ์ซ้ำทุกหน้า · เลขหน้าท้ายกระดาษ
 * 🐛 ที่แก้: ตัดวันหยุดราชการออก (เดิมติดมาเป็นแถวงาน) · วันที่สิ้นสุดของงานที่ "มีเวลา" ไม่ต้องลบ 1 วัน
 *    (ลบเฉพาะงานทั้งวัน ที่เก็บ end แบบ exclusive) · เบอร์โทรเก็บเป็นข้อความ (ศูนย์นำหน้าไม่หาย)
 *
 * ⚠️ ไม่ตรึงแถว/คอลัมน์ (ผู้ใช้เคยขอให้เอา freeze ออก — แนวเดียวกับไฟล์ของหน้า "ภาพรวมงาน")
 */

const MONEY_FMT = '"฿"#,##0';
const DATE_FMT = "dd/mm/yyyy";
const DT_FMT = "dd/mm/yyyy hh:mm";
const FONT = "Tahoma";

const THEMES = {
  service: { dark: "FF7F1D1D", main: "FFDC2626", zebra: "FFFDF7F7", title: "ตารางงานช่าง" },
  sales: { dark: "FF1E3A8A", main: "FF2563EB", zebra: "FFF5F8FF", title: "ตารางนัดหมายฝ่ายขาย" },
};
const GREY = { border: "FFE2E8F0", muted: "FF94A3B8", sub: "FF64748B", ink: "FF0F172A" };

const TECH_STATUS_COLOR = {
  "กำลังรอยืนยัน": "FF64748B",
  "ยืนยันแล้ว": "FF2563EB",
  "กำลังดำเนินการ": "FFA16207",
  "ดำเนินการเสร็จสิ้น": "FF16A34A",
};
const SALES_STATUS_COLOR = {
  "นัดหมายแล้ว": "FF2563EB",
  "เข้าพบแล้ว": "FF0D9488",
  "ปิดงานแล้ว": "FF16A34A",
  "เลื่อนนัด": "FFD97706",
  "ยกเลิกนัด": "FF94A3B8",
};
const APPROVAL_META = {
  approved: { label: "อนุมัติแล้ว", color: "FF059669" },
  pending: { label: "รออนุมัติ", color: "FFB45309" },
  rejected: { label: "ไม่อนุมัติ", color: "FFDC2626" },
};
const JOB_CLASS_LABEL = { contract: "งานสัญญา", project: "งานโปรเจค", general: "งานทั่วไป" };
const JOB_CLASS_COLOR = { contract: "FFF97316", project: "FF0D9488", general: "FF475569" };

const border = {
  top: { style: "thin", color: { argb: GREY.border } },
  left: { style: "thin", color: { argb: GREY.border } },
  bottom: { style: "thin", color: { argb: GREY.border } },
  right: { style: "thin", color: { argb: GREY.border } },
};
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
/**
 * 🐛 วันที่ใน Excel ไม่มีโซนเวลา — ExcelJS เขียน Date เป็น UTC ตรงๆ เที่ยงคืนเวลาไทย (UTC+7) จึงกลายเป็น 17:00
 *    ของ "วันก่อนหน้า" ในไฟล์ (นัด 4 ส.ค. ขึ้นเป็น 3 ส.ค.) → สร้าง Date แบบ UTC ที่ตัวเลข วัน/เวลา ตรงกับเวลาไทย
 */
const toDate = (v) => {
  if (!v) return "";
  const m = moment(v);
  return m.isValid() ? new Date(Date.UTC(m.year(), m.month(), m.date(), m.hours(), m.minutes())) : "";
};

/** ช่วงวันที่จริงของงาน — end ของงานทั้งวันเก็บแบบ exclusive (+1 วัน) ต้องลบคืน · งานที่มีเวลาไม่ต้อง */
const rangeOf = (ev) => {
  const start = moment(ev.start);
  let end = ev.end ? moment(ev.end) : start.clone();
  if (ev.allDay !== false && ev.end) end = end.clone().subtract(1, "days");
  if (end.isBefore(start, "day")) end = start.clone();
  return { start, end, days: Math.max(1, end.clone().startOf("day").diff(start.clone().startOf("day"), "days") + 1) };
};
const toSalesStatus = (s) => {
  const v = String(s || "").trim();
  if (SALES_STATUS_COLOR[v]) return v;
  return { "กำลังรอยืนยัน": "นัดหมายแล้ว", "ยืนยันแล้ว": "นัดหมายแล้ว", "กำลังดำเนินการ": "นัดหมายแล้ว", "ดำเนินการเสร็จสิ้น": "ปิดงานแล้ว" }[v] || "นัดหมายแล้ว";
};
const personName = (u) => [u?.fname, u?.lname].filter(Boolean).join(" ");

/** ── คอลัมน์ของแต่ละตาราง ── */
const SERVICE_COLS = [
  { key: "startDate", header: "วันที่เริ่ม", width: 12, group: "วันเวลา", align: "center", numFmt: DATE_FMT },
  { key: "endDate", header: "วันที่สิ้นสุด", width: 12, group: "วันเวลา", align: "center", numFmt: DATE_FMT },
  { key: "days", header: "จำนวนวัน", width: 9, group: "วันเวลา", align: "center" },
  { key: "time", header: "เวลา", width: 13, group: "วันเวลา", align: "center" },
  { key: "title", header: "ประเภทงาน", width: 14, group: "ข้อมูลงาน" },
  { key: "site", header: "โครงการ / สถานที่", width: 28, group: "ข้อมูลงาน", wrap: true },
  { key: "company", header: "บริษัท / ลูกค้า", width: 26, group: "ข้อมูลงาน", wrap: true },
  { key: "system", header: "ระบบ", width: 14, group: "ข้อมูลงาน" },
  { key: "jobClass", header: "หมวดงาน", width: 12, group: "ข้อมูลงาน", align: "center" },
  { key: "contractNo", header: "เลขที่สัญญา", width: 16, group: "สัญญา" },
  { key: "round", header: "ครั้งที่", width: 8, group: "สัญญา", align: "center" },
  { key: "status", header: "สถานะงาน", width: 17, group: "สถานะ", align: "center" },
  { key: "approval", header: "การอนุมัติ", width: 12, group: "สถานะ", align: "center" },
  { key: "team", header: "หัวหน้าทีม", width: 16, group: "ผู้เกี่ยวข้อง" },
  { key: "teamMembers", header: "ลูกทีม", width: 24, group: "ผู้เกี่ยวข้อง", wrap: true },
  { key: "responsiblePerson", header: "ผู้รับผิดชอบ", width: 16, group: "ผู้เกี่ยวข้อง" },
  { key: "contactName", header: "ผู้ติดต่อหน้างาน", width: 16, group: "ผู้ติดต่อ" },
  { key: "contactTel", header: "เบอร์โทร", width: 14, group: "ผู้ติดต่อ" },
  { key: "jobValue", header: "มูลค่างาน", width: 14, group: "มูลค่า", align: "right", numFmt: MONEY_FMT, sum: true },
];
const SALES_COLS = [
  { key: "startDate", header: "วันที่นัด", width: 12, group: "วันเวลา", align: "center", numFmt: DATE_FMT },
  { key: "endDate", header: "ถึงวันที่", width: 12, group: "วันเวลา", align: "center", numFmt: DATE_FMT },
  { key: "time", header: "เวลา", width: 13, group: "วันเวลา", align: "center" },
  { key: "title", header: "ประเภทนัด", width: 18, group: "นัดหมาย" },
  { key: "site", header: "สถานที่ / โครงการ", width: 28, group: "นัดหมาย", wrap: true },
  { key: "company", header: "ลูกค้า / บริษัท", width: 26, group: "นัดหมาย", wrap: true },
  { key: "contactName", header: "ผู้ติดต่อ", width: 16, group: "ผู้ติดต่อ" },
  { key: "contactTel", header: "เบอร์โทร", width: 14, group: "ผู้ติดต่อ" },
  { key: "status", header: "สถานะนัด", width: 13, group: "ผลการนัด", align: "center" },
  { key: "visitedAt", header: "เข้าพบเมื่อ", width: 16, group: "ผลการนัด", align: "center", numFmt: DT_FMT },
  { key: "closedAt", header: "ปิดงานเมื่อ", width: 16, group: "ผลการนัด", align: "center", numFmt: DT_FMT },
  { key: "photos", header: "รูปหน้างาน", width: 10, group: "ผลการนัด", align: "center" },
  { key: "visitResult", header: "ผลการเข้าพบ", width: 36, group: "ผลการนัด", wrap: true },
  { key: "owner", header: "ฝ่ายขาย", width: 18, group: "ผู้รับผิดชอบ" },
  { key: "description", header: "รายละเอียด", width: 32, group: "ผู้รับผิดชอบ", wrap: true },
  { key: "jobValue", header: "มูลค่าโอกาส", width: 14, group: "มูลค่า", align: "right", numFmt: MONEY_FMT, sum: true },
];

/** ค่าของแต่ละแถว */
const serviceValues = (ev, { classifyJob, getApprovalState, formatRoundLabel }) => {
  const { start, end, days } = rangeOf(ev);
  const st = ev.extendedProps?.startTime || ev.startTime || "";
  const et = ev.extendedProps?.endTime || ev.endTime || "";
  const jobClass = classifyJob ? classifyJob(ev) : "";
  const approval = APPROVAL_META[getApprovalState ? getApprovalState(ev) : "approved"] || APPROVAL_META.approved;
  const members = [...new Set((ev.teamMembers || []).map((m) => m?.name).filter(Boolean).filter((n) => n !== ev.team))];
  return {
    values: {
      startDate: toDate(start), endDate: toDate(end), days,
      time: st ? `${st}${et ? ` – ${et}` : ""}` : "ทั้งวัน",
      title: ev.title || "", site: ev.site || "", company: ev.company || "", system: ev.system || "",
      jobClass: JOB_CLASS_LABEL[jobClass] || "",
      contractNo: ev.contractNo || "",
      round: ev.time ? String(formatRoundLabel ? formatRoundLabel(ev.time, ev.visitCount) : ev.time) : "",
      status: ev.status || "", approval: approval.label,
      team: ev.team || "", teamMembers: members.join(", "),
      responsiblePerson: ev.responsiblePerson || "",
      contactName: ev.contactName || "", contactTel: ev.contactTel ? String(ev.contactTel) : "",
      jobValue: Number(ev.jobValue) > 0 ? Number(ev.jobValue) : "",
    },
    colors: {
      status: TECH_STATUS_COLOR[ev.status], approval: approval.color, jobClass: JOB_CLASS_COLOR[jobClass],
    },
    groupKeys: { status: ev.status || "ไม่ระบุ", type: ev.title || "ไม่ระบุ", person: ev.team || ev.responsiblePerson || "ยังไม่มอบหมาย" },
  };
};
const salesValues = (ev) => {
  const { start, end } = rangeOf(ev);
  const st = ev.extendedProps?.startTime || ev.startTime || "";
  const et = ev.extendedProps?.endTime || ev.endTime || "";
  const status = toSalesStatus(ev.status);
  const owner = personName(ev.user);
  return {
    values: {
      startDate: toDate(start), endDate: end.isSame(start, "day") ? "" : toDate(end),
      time: st ? `${st}${et ? ` – ${et}` : ""}` : "ทั้งวัน",
      title: ev.title || "", site: ev.site || "", company: ev.company || "",
      contactName: ev.contactName || "", contactTel: ev.contactTel ? String(ev.contactTel) : "",
      status, visitedAt: toDate(ev.visitedAt), closedAt: toDate(ev.salesClosedAt),
      photos: (ev.sitePhotoFiles || []).length || "",
      visitResult: ev.visitResult || "", owner, description: ev.description || "",
      jobValue: Number(ev.jobValue) > 0 ? Number(ev.jobValue) : "",
    },
    colors: { status: SALES_STATUS_COLOR[status] },
    groupKeys: { status, type: ev.title || "ไม่ระบุ", person: owner || "ไม่ระบุ" },
  };
};

/** หัวรายงาน 2 บรรทัด + บรรทัดว่าง */
function writeTitle(ws, lastCol, theme, title, subtitle) {
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 16, bold: true, color: { argb: theme.dark } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 28;
  ws.mergeCells(2, 1, 2, lastCol);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: FONT, size: 10, color: { argb: GREY.sub } };
  s.alignment = { vertical: "middle", wrapText: true };
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 6;
}

function headerCell(cell, text, bg) {
  cell.value = text;
  cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = fill(bg);
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = border;
}

/** ชีตสรุป: ตารางนับตามกลุ่ม */
function writeSummary(wb, theme, title, subtitle, rowsInfo, mode) {
  const ws = wb.addWorksheet("สรุป", { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 32 }, { width: 12 }, { width: 16 }, { width: 4 }, { width: 32 }, { width: 12 }, { width: 16 }];
  writeTitle(ws, 7, theme, `${title} — สรุป`, subtitle);

  const total = rowsInfo.reduce((a, r) => a + (Number(r.values.jobValue) || 0), 0);
  const kpi = [
    ["จำนวนทั้งหมด", rowsInfo.length, ""],
    [mode === "sales" ? "มูลค่าโอกาสรวม" : "มูลค่างานรวม", total, MONEY_FMT],
  ];
  let r = 4;
  kpi.forEach(([label, val, fmt]) => {
    const a = ws.getCell(r, 1); a.value = label; a.font = { name: FONT, size: 11, bold: true, color: { argb: GREY.ink } }; a.border = border; a.fill = fill(theme.zebra);
    ws.mergeCells(r, 2, r, 3);
    const b = ws.getCell(r, 2); b.value = val; b.font = { name: FONT, size: 12, bold: true, color: { argb: theme.dark } }; b.alignment = { horizontal: "right" }; b.border = border;
    if (fmt) b.numFmt = fmt;
    ws.getRow(r).height = 22;
    r += 1;
  });

  const block = (col, startRow, heading, key, colorMap) => {
    const counts = new Map();
    rowsInfo.forEach((x) => {
      const k = x.groupKeys[key];
      const cur = counts.get(k) || { n: 0, v: 0 };
      cur.n += 1; cur.v += Number(x.values.jobValue) || 0;
      counts.set(k, cur);
    });
    headerCell(ws.getCell(startRow, col), heading, theme.dark);
    headerCell(ws.getCell(startRow, col + 1), "จำนวน", theme.dark);
    headerCell(ws.getCell(startRow, col + 2), "มูลค่า", theme.dark);
    let rr = startRow + 1;
    [...counts.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([k, v], i) => {
      const c1 = ws.getCell(rr, col); c1.value = k;
      const c2 = ws.getCell(rr, col + 1); c2.value = v.n; c2.alignment = { horizontal: "center" };
      const c3 = ws.getCell(rr, col + 2); c3.value = v.v || ""; c3.numFmt = MONEY_FMT; c3.alignment = { horizontal: "right" };
      [c1, c2, c3].forEach((c) => { c.border = border; c.font = { name: FONT, size: 10 }; if (i % 2) c.fill = fill(theme.zebra); });
      if (colorMap?.[k]) c1.font = { name: FONT, size: 10, bold: true, color: { argb: colorMap[k] } };
      rr += 1;
    });
    return rr;
  };
  const top = r + 1;
  const endA = block(1, top, mode === "sales" ? "สถานะนัด" : "สถานะงาน", "status", mode === "sales" ? SALES_STATUS_COLOR : TECH_STATUS_COLOR);
  const endB = block(5, top, mode === "sales" ? "ประเภทนัด" : "ประเภทงาน", "type");
  block(1, Math.max(endA, endB) + 1, mode === "sales" ? "ฝ่ายขาย" : "หัวหน้าทีม / ผู้รับผิดชอบ", "person");
}

/**
 * สร้างและดาวน์โหลดไฟล์ Excel
 * @param {object} p
 * @param {Array}  p.rows   งานที่ผ่านตัวกรองแล้ว (โครงสร้างเดียวกับที่ปฏิทินใช้)
 * @param {"service"|"sales"} [p.mode]
 * @param {Object} p.meta   { fileName, title?, filterSummary, exportedAt, exportedBy? }
 */
export async function exportCalendarEventsToExcel({ rows, mode = "service", meta, classifyJob, getApprovalState, formatRoundLabel }) {
  const theme = THEMES[mode] || THEMES.service;
  const title = meta.title || theme.title;
  const cols = mode === "sales" ? SALES_COLS : SERVICE_COLS;
  const data = (rows || []).filter((ev) => !ev?.extendedProps?.isHoliday && !ev?.isHoliday);
  const rowsInfo = data.map((ev) => (mode === "sales" ? salesValues(ev) : serviceValues(ev, { classifyJob, getApprovalState, formatRoundLabel })));

  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  wb.created = new Date();

  const ws = wb.addWorksheet(mode === "sales" ? "นัดหมาย" : "งาน", {
    pageSetup: {
      orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 },
    },
    headerFooter: { oddFooter: `&L${title}&Rหน้า &P / &N` },
  });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = cols.length;
  const subtitle = [
    meta.filterSummary,
    `รวม ${data.length} รายการ`,
    `ส่งออก ${meta.exportedAt}${meta.exportedBy ? ` โดย ${meta.exportedBy}` : ""}`,
  ].filter(Boolean).join("  ·  ");
  writeTitle(ws, lastCol, theme, title, subtitle);

  // แถว 4: กลุ่มคอลัมน์ · แถว 5: หัวคอลัมน์
  const GROUP_ROW = 4;
  const HEADER_ROW = 5;
  let gStart = 1;
  for (let i = 0; i < cols.length; i += 1) {
    if (i === cols.length - 1 || cols[i + 1].group !== cols[i].group) {
      const gEnd = i + 1;
      if (gEnd > gStart) ws.mergeCells(GROUP_ROW, gStart, GROUP_ROW, gEnd);
      for (let k = gStart; k <= gEnd; k += 1) headerCell(ws.getCell(GROUP_ROW, k), k === gStart ? cols[i].group : null, theme.main);
      gStart = gEnd + 1;
    }
  }
  ws.getRow(GROUP_ROW).height = 20;
  cols.forEach((c, idx) => headerCell(ws.getRow(HEADER_ROW).getCell(idx + 1), c.header, theme.dark));
  ws.getRow(HEADER_ROW).height = 30;
  ws.pageSetup.printTitlesRow = `${GROUP_ROW}:${HEADER_ROW}`;

  rowsInfo.forEach(({ values, colors }, rIdx) => {
    const row = ws.addRow(values);
    // ความสูงตามบรรทัดจริงของช่องที่ห่อบรรทัด (ExcelJS ไม่ขยายให้เอง)
    const lines = Math.max(1, ...cols.filter((c) => c.wrap).map((c) => {
      const v = String(values[c.key] || "");
      return v ? Math.ceil(v.length / Math.max(8, c.width * 1.1)) + (v.split("\n").length - 1) : 1;
    }));
    row.height = Math.max(22, Math.min(lines, 8) * 15);
    cols.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      cell.font = { name: FONT, size: 10, color: { argb: GREY.ink } };
      cell.border = border;
      cell.alignment = { vertical: c.wrap ? "top" : "middle", horizontal: c.align || "left", wrapText: Boolean(c.wrap) };
      if (rIdx % 2 === 1) cell.fill = fill(theme.zebra);
      if (c.numFmt) cell.numFmt = c.numFmt;
      if (c.key === "contactTel") cell.numFmt = "@";
      const color = colors[c.key];
      if (color) cell.font = { name: FONT, size: 10, bold: true, color: { argb: color } };
      if (c.key === "responsiblePerson" && !values.responsiblePerson) {
        cell.value = "— ยังไม่มอบหมาย —";
        cell.font = { name: FONT, size: 10, italic: true, color: { argb: GREY.muted } };
      }
    });
  });

  if (data.length > 0) {
    const firstData = HEADER_ROW + 1;
    const lastData = HEADER_ROW + data.length;
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastData, column: lastCol } };

    // แถวรวมท้ายตาราง — สูตร SUBTOTAL (เปลี่ยนตามการกรองใน Excel)
    const sumIdx = cols.findIndex((c) => c.sum) + 1;
    const totalRow = ws.getRow(lastData + 1);
    const filled = rowsInfo.filter((x) => x.values.jobValue !== "").length;
    if (sumIdx > 1) ws.mergeCells(lastData + 1, 1, lastData + 1, sumIdx - 1);
    const label = totalRow.getCell(1);
    label.value = `รวม${mode === "sales" ? "มูลค่าโอกาส" : "มูลค่างาน"} (${filled}/${data.length} รายการที่ระบุมูลค่า)`;
    label.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    label.alignment = { vertical: "middle", horizontal: "right" };
    if (sumIdx > 0) {
      const L = ws.getColumn(sumIdx).letter;
      const c = totalRow.getCell(sumIdx);
      c.value = { formula: `SUBTOTAL(109,${L}${firstData}:${L}${lastData})` };
      c.numFmt = MONEY_FMT;
      c.font = { name: FONT, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      c.alignment = { vertical: "middle", horizontal: "right" };
    }
    for (let k = 1; k <= lastCol; k += 1) {
      const c = totalRow.getCell(k);
      c.fill = fill(theme.dark);
      c.border = border;
    }
    totalRow.height = 24;
  } else {
    ws.mergeCells(HEADER_ROW + 1, 1, HEADER_ROW + 1, lastCol);
    const c = ws.getCell(HEADER_ROW + 1, 1);
    c.value = "ไม่มีรายการตามตัวกรองที่เลือก";
    c.font = { name: FONT, size: 10, italic: true, color: { argb: GREY.muted } };
    c.alignment = { horizontal: "center" };
  }

  writeSummary(wb, theme, title, subtitle, rowsInfo, mode);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), meta.fileName);
}
