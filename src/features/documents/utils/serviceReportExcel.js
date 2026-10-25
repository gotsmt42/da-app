import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import { ISSUE_STATUS, issueStats, splitQty } from "./serviceReportData";

/**
 * serviceReportExcel.js — สรุป Service Report (ที่ AI อ่าน + คนตรวจ) ลง Excel ใช้ทำรายงานสรุปได้จริง
 *
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "สามารถเอาไปลงรายงานสรุปใน excel ได้จริง")
 *    • ชีต "สรุป Service Report" — 1 แถว = 1 งาน: ข้อมูลงานจากระบบ · สรุปงานที่ทำ · รายละเอียดงานที่ทำ (เป็นข้อ) ·
 *      สรุปปัญหาที่พบ · จำนวนปัญหาแยกสถานะ (เป็นตัวเลขจริง รวมยอด/กรองได้)
 *    • ชีต "ปัญหาที่พบ" — 1 แถว = 1 ปัญหา/อุปกรณ์ · จำนวนแยก "ตัวเลข" กับ "หน่วย" → SUM / Pivot ตามรุ่นอุปกรณ์ได้ทันที
 *    ใช้ร่วม: ปุ่ม Excel ในหน้าต่างสรุป (งานเดียว) · ส่งออก Excel หน้าการดำเนินงาน (ทุกงานที่มีสรุป)
 * ⚠️ ExcelJS ไม่ปรับความสูงแถวตามข้อความที่ตัดบรรทัดให้ — ประมาณความสูงเองจากจำนวนบรรทัด ไม่งั้นเห็นแค่บรรทัดแรก
 */

const C = { headerBg: "FF1E293B", headerText: "FFFFFFFF", title: "FF0F172A", sub: "FF64748B", zebra: "FFF8FAFC", border: "FFE2E8F0",
  warn: "FFB45309", quote: "FFC2410C", ok: "FF059669", muted: "FF94A3B8" };
const thin = { style: "thin", color: { argb: C.border } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const FONT = "Tahoma";
const STATUS_ARGB = { pending: C.warn, need_quote: C.quote, fixed: C.ok, unknown: C.muted };

/** จำนวนบรรทัดที่ข้อความจะกินในช่องกว้าง width (ตัวอักษรไทยมีสระบน/ล่าง ไม่กินความกว้าง จึงนับแบบหยาบได้) */
const linesFor = (text, width) => String(text ?? "").split("\n")
  .reduce((n, ln) => n + Math.max(1, Math.ceil(ln.replace(/[ัิ-ฺ็-๎]/g, "").length / Math.max(4, width * 1.05))), 0);

function sheet(wb, name, { title, subtitle, cols }) {
  const ws = wb.addWorksheet(name, { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  ws.mergeCells(1, 1, 1, cols.length);
  Object.assign(ws.getCell(1, 1), { value: title, font: { name: FONT, size: 15, bold: true, color: { argb: C.title } } });
  ws.mergeCells(2, 1, 2, cols.length);
  Object.assign(ws.getCell(2, 1), { value: subtitle, font: { name: FONT, size: 10, color: { argb: C.sub } } });
  ws.getRow(1).height = 24; ws.getRow(2).height = 18; ws.getRow(3).height = 6;
  const head = ws.getRow(4);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  head.height = 32;
  ws.views = [{ state: "frozen", ySplit: 4 }];
  return ws;
}

function styleRow(row, cols, zebra) {
  let lines = 1;
  cols.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.font = { name: FONT, size: 10 };
    cell.border = border;
    cell.alignment = { vertical: "top", horizontal: c.align || "left", wrapText: Boolean(c.wrap) };
    if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
    if (c.wrap) lines = Math.max(lines, linesFor(cell.value, c.width));
  });
  row.height = Math.min(409, Math.max(20, lines * 14 + 6));
}

/**
 * เพิ่มชีตสรุป Service Report ลงสมุดงาน
 * @param jobs [{ info: jobInfoOf(), summary: { status, data, confirmedAt, confirmedBy } }] — เฉพาะงานที่มีสรุป
 * @param subtitle บรรทัดใต้ชื่อชีต (เช่น ช่วง/ตัวกรอง)
 */
export function addServiceReportSheets(wb, jobs, subtitle = "") {
  const stamp = `ส่งออก ${moment().format("DD/MM/")}${moment().year() + 543} ${moment().format("HH:mm")}`;

  // ── ชีต 1: 1 แถว = 1 งาน ────────────────────────────────────────────────
  const cols1 = [
    { key: "no", header: "ลำดับ", width: 6, align: "center" },
    { key: "jobNo", header: "เลขที่งาน", width: 16 },
    { key: "company", header: "บริษัท / ลูกค้า", width: 22, wrap: true },
    { key: "site", header: "โครงการ", width: 22, wrap: true },
    { key: "system", header: "ระบบ", width: 14, wrap: true },
    { key: "jobType", header: "ประเภทงาน / ครั้งที่", width: 18, wrap: true },
    { key: "dates", header: "วันที่เข้างาน", width: 20, wrap: true },
    { key: "team", header: "ช่างผู้ให้บริการ", width: 18, wrap: true },
    { key: "summary", header: "สรุปงานที่ทำ", width: 42, wrap: true },
    { key: "work", header: "รายละเอียดงานที่ทำ", width: 60, wrap: true },
    { key: "issueSummary", header: "สรุปปัญหาที่พบ", width: 42, wrap: true },
    { key: "issues", header: "ปัญหา (รายการ)", width: 10, align: "center" },
    { key: "pending", header: "ยังค้าง", width: 9, align: "center" },
    { key: "needQuote", header: "ต้องเสนอราคา", width: 11, align: "center" },
    { key: "fixed", header: "แก้แล้ว", width: 9, align: "center" },
    { key: "status", header: "สถานะสรุป", width: 13, align: "center" },
  ];
  const ws1 = sheet(wb, "สรุป Service Report", { title: "สรุป Service Report", subtitle: [subtitle, `${jobs.length} งาน`, stamp].filter(Boolean).join("  ·  "), cols: cols1 });
  jobs.forEach(({ info, summary }, i) => {
    const d = summary?.data || {};
    const st = issueStats(d.issues || []);
    const confirmed = summary?.status === "confirmed";
    const row = ws1.addRow({
      no: i + 1, jobNo: info.jobNo, company: info.company, site: info.site, system: info.system, jobType: info.jobType,
      dates: (info.dates || "").split(" · ").join("\n"), team: info.team,
      summary: d.summary || "",
      work: (d.workDone || []).map((w, k) => `${k + 1}. ${w}`).join("\n"),
      issueSummary: d.issueSummary || (st.total ? "" : "ไม่พบปัญหา"),
      issues: st.total, pending: st.pending, needQuote: st.needQuote, fixed: st.fixed,
      status: confirmed ? "ยืนยันแล้ว" : "ร่าง",
    });
    styleRow(row, cols1, i % 2 === 1);
    const sc = row.getCell("status");
    sc.font = { name: FONT, size: 10, bold: true, color: { argb: confirmed ? C.ok : C.warn } };
    if (st.pending) row.getCell("pending").font = { name: FONT, size: 10, bold: true, color: { argb: C.warn } };
    if (st.needQuote) row.getCell("needQuote").font = { name: FONT, size: 10, bold: true, color: { argb: C.quote } };
  });
  if (jobs.length) ws1.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + jobs.length, column: cols1.length } };

  // ── ชีต 2: 1 แถว = 1 ปัญหา / อุปกรณ์ ─────────────────────────────────────
  const cols2 = [
    { key: "no", header: "ลำดับ", width: 6, align: "center" },
    { key: "jobNo", header: "เลขที่งาน", width: 16 },
    { key: "site", header: "โครงการ", width: 22, wrap: true },
    { key: "system", header: "ระบบ", width: 14, wrap: true },
    { key: "dates", header: "วันที่เข้างาน", width: 20, wrap: true },
    { key: "item", header: "ข้อ", width: 6, align: "center" },
    { key: "location", header: "ตำแหน่ง", width: 22, wrap: true },
    { key: "problem", header: "ปัญหา / อาการ", width: 40, wrap: true },
    { key: "part", header: "อุปกรณ์ / รุ่น", width: 24, wrap: true },
    { key: "qty", header: "จำนวน", width: 9, align: "center" },
    { key: "unit", header: "หน่วย", width: 9, align: "center" },
    { key: "status", header: "สถานะ", width: 14, align: "center" },
    { key: "sumStatus", header: "สถานะสรุป", width: 12, align: "center" },
  ];
  const all = jobs.flatMap(({ info, summary }) => (summary?.data?.issues || []).map((x, k) => ({ info, summary, x, k })));
  const ws2 = sheet(wb, "ปัญหาที่พบ", { title: "ปัญหาที่พบ / อุปกรณ์ที่ต้องเปลี่ยน", subtitle: [subtitle, `${all.length} รายการ จาก ${jobs.length} งาน`, stamp].filter(Boolean).join("  ·  "), cols: cols2 });
  all.forEach(({ info, summary, x, k }, i) => {
    const q = splitQty(x.qty);
    const row = ws2.addRow({
      no: i + 1, jobNo: info.jobNo, site: info.site || info.company, system: info.system, dates: (info.dates || "").split(" · ").join("\n"),
      item: k + 1, location: x.location || "", problem: x.problem || "", part: x.part || "",
      qty: q.n ?? (q.unit || ""), unit: q.n != null ? q.unit : "",
      status: ISSUE_STATUS[x.status] || "-", sumStatus: summary?.status === "confirmed" ? "ยืนยันแล้ว" : "ร่าง",
    });
    styleRow(row, cols2, i % 2 === 1);
    row.getCell("status").font = { name: FONT, size: 10, bold: true, color: { argb: STATUS_ARGB[x.status] || C.muted } };
  });
  if (all.length) ws2.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + all.length, column: cols2.length } };
}

/** ดาวน์โหลด Excel สรุป Service Report (ใช้กับงานเดียวหรือหลายงาน) */
export async function exportServiceReportExcel(jobs, fileName, subtitle) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();
  addServiceReportSheets(wb, jobs, subtitle);
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}
