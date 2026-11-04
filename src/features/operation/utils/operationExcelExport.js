import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { addServiceReportSheets } from "@/features/documents/utils/serviceReportExcel";
import { jobInfoOf, issueStats } from "@/features/documents/utils/serviceReportData";

const srUnreadable = (sr) => (sr?.data?.fileChecks || []).some((x) => x.status === "unreadable" || x.status === "partial");

/**
 * operationExcelExport.js — ส่งออกรายการ "แผนการดำเนินงาน" เป็นไฟล์ Excel (.xlsx) พร้อมรูปแบบ/สี
 *
 * ⚠️ แทนที่ handleExportCSV เดิม: CSV เป็นข้อความล้วน ใส่สี/ตัวหนา/ความกว้างคอลัมน์ไม่ได้เลย และ
 * ค่าทุกช่องถูกครอบด้วย " " กลายเป็นข้อความหมด — วันที่เรียงตามตัวอักษร ตัวเลขรวมยอดไม่ได้
 * ✅ .xlsx เก็บวันที่เป็น Date จริงและตัวเลขเป็น number จริง เรียง/กรอง/รวมยอดใน Excel ได้ทันที
 */

const C = {
  // 🔁 (24 ต.ค. 2569 ผู้ใช้: "export excel ให้ข้อมูลสอดคล้องกับที่แก้มา ดูง่าย ครบถ้วน") หัวตารางโทนเทาเข้ม อ่านง่าย พิมพ์ชัด
  headerBg: "FF1E293B",
  headerText: "FFFFFFFF",
  groupBg: "FF475569",
  titleText: "FF0F172A",
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
/**
 * @param stepOf     (sessions) => "รับทราบ" | "ยืนยันนัด" | "เข้างาน" | "เอกสาร" | "ขอปิดงาน" | "เสร็จสิ้น" — ขั้นตอนเดียวกับแถบบนหน้าจอ
 * @param roundLabel (event) => "1/4 - 2569-70" — ครั้งที่แบบเดียวกับหน้าจอ
 * @param srOf       (sessions) => สรุป Service Report ของงาน { status, data } | null — มี = เพิ่มชีตสรุป/ปัญหาที่พบ
 */
/** @param showValue แสดงมูลค่างานครั้งนี้ + ชีต "มูลค่างานรายช่าง" (แอดมิน/manager) */
export async function exportOperationToExcel({ jobs, meta, daysPastDueMap, isFlaggedDays, formatEventDateRange, stepOf, roundLabel, srOf, showValue = false }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DA-APP";
  wb.created = new Date();
  const ws = wb.addWorksheet("แผนการดำเนินงาน", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ✅ (2 พ.ย. 2569 ผู้ใช้: "ให้เป็นผู้รับผิดชอบ ผู้ปฏิบัติงาน 1,2,3,4 แยกช่องทุกคน") — คนที่ 1 = หัวหน้าทีม
  //    อย่างน้อย 4 ช่อง · งานไหนมีคนมากกว่านั้นเพิ่มช่องให้พอทุกคน
  const workersOf = (a) => [...new Set([a.team, ...((a.teamMembers || []).map((m) => m?.name))].filter(Boolean))];
  // มูลค่างานครั้งนี้ของงาน — ทุกวันในกลุ่มเก็บค่าเดียวกัน ใช้ค่าแรกที่มี · null = ยังไม่ใส่
  const workValueOf = (sessions) => {
    const hit = sessions.find((e) => e?.workValue !== null && e?.workValue !== undefined && e?.workValue !== "");
    return hit ? Number(hit.workValue) : null;
  };
  const workerSlots = Math.max(4, ...jobs.map((job) => workersOf(job.sessions[0] || {}).length));
  const workerCols = Array.from({ length: workerSlots }, (_, i) => (
    { key: `worker${i + 1}`, header: i === 0 ? "ผู้ปฏิบัติงาน 1 (หัวหน้าทีม)" : `ผู้ปฏิบัติงาน ${i + 1}`, width: i === 0 ? 24 : 18, group: "ผู้เกี่ยวข้อง" }
  ));
  const cols = [
    { key: "status", header: "สถานะงาน", width: 18, group: "สถานะ", align: "center" },
    { key: "step", header: "ขั้นตอนตอนนี้", width: 14, group: "สถานะ", align: "center" },
    { key: "overdue", header: "ค้างกี่วัน", width: 11, group: "สถานะ", align: "center" },
    { key: "approval", header: "การอนุมัติ", width: 13, group: "สถานะ", align: "center" },
    { key: "jobNo", header: "เลขที่งาน (JOB)", width: 17, group: "ข้อมูลงาน" },
    { key: "company", header: "บริษัท", width: 24, group: "ข้อมูลงาน" },
    { key: "site", header: "โครงการ", width: 24, group: "ข้อมูลงาน" },
    { key: "title", header: "ประเภทงาน", width: 16, group: "ข้อมูลงาน" },
    { key: "system", header: "ระบบ", width: 16, group: "ข้อมูลงาน" },
    { key: "round", header: "ครั้งที่", width: 15, group: "ข้อมูลงาน", align: "center" },
    { key: "docNo", header: "เลขที่สัญญา/เอกสาร", width: 16, group: "ข้อมูลงาน" },
    { key: "source", header: "รับงานจาก", width: 16, group: "ข้อมูลงาน" },
    { key: "dispatchNo", header: "เลขที่ใบแจ้งงาน", width: 15, group: "ข้อมูลงาน" },
    { key: "dateRange", header: "วันที่เข้างาน", width: 26, group: "กำหนดการ", wrap: true },
    { key: "startDate", header: "วันเริ่ม", width: 12, group: "กำหนดการ", align: "center" },
    { key: "endDate", header: "วันสิ้นสุด", width: 12, group: "กำหนดการ", align: "center" },
    { key: "dayCount", header: "จำนวนวัน", width: 10, group: "กำหนดการ", align: "center" },
    { key: "parts", header: "จำนวนช่วง", width: 10, group: "กำหนดการ", align: "center" },
    { key: "timeRange", header: "เวลา", width: 14, group: "กำหนดการ", align: "center" },
    { key: "responsible", header: "ผู้รับผิดชอบงาน", width: 20, group: "ผู้เกี่ยวข้อง" },
    ...workerCols,
    { key: "ack", header: "รับทราบโดย / เมื่อ", width: 24, group: "ผู้เกี่ยวข้อง", wrap: true },
    { key: "checkIn", header: "เวลาเข้างานจริง", width: 17, group: "การปฏิบัติงาน", align: "center" },
    { key: "checkOut", header: "เวลาเสร็จงานจริง", width: 17, group: "การปฏิบัติงาน", align: "center" },
    { key: "workNote", header: "รายละเอียดงานที่ทำ", width: 36, group: "การปฏิบัติงาน", wrap: true },
    { key: "closeState", header: "สถานะการปิดงาน", width: 18, group: "การปฏิบัติงาน", align: "center" },
    ...(showValue ? [{ key: "workValue", header: "มูลค่างานครั้งนี้ (บาท)", width: 18, group: "การปฏิบัติงาน", align: "right" }] : []),
    { key: "docReport", header: "Service Report", width: 14, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    { key: "docQuotation", header: "ใบเสนอราคา", width: 13, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    { key: "docInvoice", header: "ใบวางบิล", width: 12, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    { key: "docCompletion", header: "ใบส่งมอบงาน", width: 13, group: "เอกสารแนบ (ไฟล์)", align: "center" },
    // ✅ (25 ต.ค. 2569) สรุป Service Report ด้วย AI — รายละเอียดเต็มอยู่ชีต "สรุป Service Report" / "ปัญหาที่พบ"
    { key: "srStatus", header: "สรุป Service Report", width: 15, group: "สรุป Service Report (AI)", align: "center" },
    { key: "srIssues", header: "ปัญหาที่พบ (รายการ)", width: 12, group: "สรุป Service Report (AI)", align: "center" },
    { key: "srPending", header: "ยังค้าง / ต้องเสนอราคา", width: 14, group: "สรุป Service Report (AI)", align: "center" },
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

    const srRaw = srOf ? srOf(sessions) : null;
    // ⛔ AI อ่านบางไฟล์ไม่ได้ (ถ่ายไม่ชัด) — ไม่นำข้อมูลไปออกรายงาน บอกสถานะให้ถ่ายใหม่แทน
    const srBad = srRaw && srUnreadable(srRaw);
    const sr = srBad ? null : srRaw;
    const srSt = sr ? issueStats(sr.data?.issues || []) : null;
    const row = ws.addRow({
      srStatus: srBad ? "อ่านไม่ครบ (ถ่ายใหม่)" : sr ? (sr.status === "confirmed" ? "ยืนยันแล้ว" : "ร่าง") : "—",
      srIssues: srSt ? srSt.total : "",
      srPending: srSt ? srSt.pending + srSt.needQuote : "",
      status: a.status || "-",
      step: stepOf ? stepOf(sessions) : "",
      jobNo: a.jobNo || "",
      source: { sales: "ฝ่ายขาย", service: "ฝ่ายบริการ", project: "ฝ่ายโครงการ", customer: "ลูกค้าแจ้งตรง", calendar: "ลงตารางตรง", dispatch: "คำขอลงงาน" }[a.intakeSource] || "",
      dispatchNo: a.dispatchNo || "",
      parts: sessions.length,
      ...Object.fromEntries(workersOf(a).map((n, i) => [`worker${i + 1}`, n])),
      ack: (a.acks || []).map((k) => `${k.name || ""}${k.at ? ` ${moment(k.at).format("DD/MM/YY HH:mm")}` : ""}`).filter((x) => x.trim()).join(", "),
      overdue: isOverdue ? overdueDays : "",
      approval: approvalState,
      company: a.company || "",
      site: a.site || "",
      title: a.title || "",
      system: a.system || "",
      round: a.time ? (roundLabel ? roundLabel(a) : String(a.time)) : "",
      docNo: a.docNo || "",
      // ✅ ข้อความช่วงวันที่แบบอ่านง่าย (รวมทุกช่วงของงานหลายวันไม่ติดกัน) เหมือนที่เห็นบนการ์ด
      dateRange: sessions.map((e) => formatEventDateRange(e)).join("\n"),
      startDate: minStart.toDate(),
      endDate: maxEnd.toDate(),
      dayCount,
      timeRange: a.startTime || a.endTime ? `${a.startTime || "-"}-${a.endTime || "-"}` : "ทั้งวัน",
      responsible: a.responsiblePerson || "",
      checkIn: a.checkedInAt ? new Date(a.checkedInAt) : "",
      checkOut: a.checkedOutAt ? new Date(a.checkedOutAt) : "",
      workNote: [...new Set(sessions.flatMap((x) => [x.description, x.workNote]).map((v) => String(v || "").trim()).filter(Boolean))].join("\n"),
      closeState,
      ...(showValue ? { workValue: workValueOf(sessions) ?? "ยังไม่ใส่" } : {}),
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
      if (colDef.key === "workValue") {
        if (typeof cell.value === "number") { cell.numFmt = "#,##0.00"; cell.font = { name: "Tahoma", size: 10, bold: true }; }
        else cell.font = { name: "Tahoma", size: 10, color: { argb: C.warn } };
      }

      if (colDef.key === "status") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: STATUS_COLOR[a.status] || C.muted } };
      }
      if (colDef.key === "overdue" && isOverdue) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.danger } };
      }
      if (colDef.key === "approval" && approvalState !== "อนุมัติแล้ว") {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: approvalState === "รออนุมัติ" ? C.warn : C.danger } };
      }
      if (colDef.key === "srStatus") {
        cell.font = { name: "Tahoma", size: 10, bold: Boolean(sr), color: { argb: !sr ? C.muted : sr.status === "confirmed" ? C.ok : C.warn } };
      }
      if (colDef.key === "srPending" && srSt && srSt.pending + srSt.needQuote > 0) {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.warn } };
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

  // ตรึงหัวตาราง — เลื่อนลงแล้วยังเห็นชื่อคอลัมน์
  ws.views = [{ state: "frozen", ySplit: HEADER_ROW, xSplit: 0 }];
  if (jobs.length > 0) {
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + jobs.length, column: lastCol } };
  }

  // ✅ (2 พ.ย. 2569 ผู้ใช้: "ค้นหาว่าช่างคนนั้นๆ มีมูลค่างานรวมทั้งหมดเท่าไร ... และ export")
  //    ชีต "มูลค่างานรายช่าง" — ทุกคนในทีมได้มูลค่างานนั้นเต็มจำนวน (ผลรวมรายคนจึงมากกว่ามูลค่างานจริงได้)
  if (showValue && jobs.length) addWorkerValueSheet(wb, jobs, workersOf, workValueOf, meta);

  // ✅ ชีตสรุป Service Report — เฉพาะงานที่มีสรุปแล้ว เรียงตามลำดับเดียวกับชีตหลัก
  const srJobs = srOf ? jobs.map((job) => ({ sessions: job.sessions, summary: srOf(job.sessions) })).filter((x) => x.summary?.data && !srUnreadable(x.summary)) : [];
  if (srJobs.length) {
    addServiceReportSheets(wb, srJobs.map(({ sessions, summary }) => ({
      info: { ...jobInfoOf(sessions[0], sessions), jobType: [sessions[0].title, sessions[0].time && roundLabel ? `ครั้งที่ ${roundLabel(sessions[0])}` : ""].filter(Boolean).join(" ") },
      summary,
    })), `${meta.groupLabel}  ·  ${meta.filterSummary}`);
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    meta.fileName
  );
}

function addWorkerValueSheet(wb, jobs, workersOf, workValueOf, meta) {
  const ws = wb.addWorksheet("มูลค่างานรายช่าง", { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const per = new Map();
  let grand = 0; let valued = 0; let missing = 0;
  jobs.forEach(({ sessions }) => {
    const a = sessions[0] || {};
    const wv = workValueOf(sessions);
    if (wv === null) missing += 1; else { grand += wv; valued += 1; }
    workersOf(a).forEach((name, i) => {
      const r = per.get(name) || { name, jobs: 0, lead: 0, valued: 0, missing: 0, total: 0 };
      r.jobs += 1;
      if (i === 0) r.lead += 1;
      if (wv === null) r.missing += 1; else { r.valued += 1; r.total += wv; }
      per.set(name, r);
    });
  });
  const rows = [...per.values()].sort((x, y) => y.total - x.total || y.jobs - x.jobs || x.name.localeCompare(y.name, "th"));
  const cols = [
    { key: "no", header: "ลำดับ", width: 7, align: "center" },
    { key: "name", header: "ผู้ปฏิบัติงาน", width: 26 },
    { key: "jobs", header: "จำนวนงาน", width: 11, align: "center" },
    { key: "lead", header: "เป็นหัวหน้าทีม", width: 13, align: "center" },
    { key: "valued", header: "ใส่มูลค่าแล้ว", width: 13, align: "center" },
    { key: "missing", header: "ยังไม่ใส่มูลค่า", width: 14, align: "center" },
    { key: "total", header: "มูลค่างานรวม (บาท)", width: 20, align: "right" },
    { key: "avg", header: "เฉลี่ย / งาน (บาท)", width: 18, align: "right" },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  ws.mergeCells(1, 1, 1, cols.length);
  ws.getCell(1, 1).value = "มูลค่างานรายช่าง";
  ws.getCell(1, 1).font = { name: "Tahoma", size: 16, bold: true, color: { argb: C.titleText } };
  ws.mergeCells(2, 1, 2, cols.length);
  ws.getCell(2, 1).value = `${meta.groupLabel}  ·  ${meta.filterSummary}  ·  ส่งออก ${meta.exportedAt}`;
  ws.getCell(2, 1).font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.mergeCells(3, 1, 3, cols.length);
  ws.getCell(3, 1).value = `มูลค่างานรวมทั้งหมด (นับงานละครั้ง) ${grand.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท จาก ${valued} งาน${missing ? ` · ยังไม่ใส่มูลค่า ${missing} งาน` : ""}  ·  หมายเหตุ: ทุกคนในทีมได้มูลค่างานนั้นเต็มจำนวน`;
  ws.getCell(3, 1).font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.titleText } };
  const HEAD = 5;
  const hr = ws.getRow(HEAD);
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });
  hr.height = 26;
  rows.forEach((r, idx) => {
    const row = ws.addRow({ no: idx + 1, name: r.name, jobs: r.jobs, lead: r.lead, valued: r.valued, missing: r.missing || "", total: r.total, avg: r.valued ? r.total / r.valued : "" });
    row.height = 22;
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: "Tahoma", size: 10, bold: c.key === "total" || c.key === "name" };
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: c.align || "left" };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (c.key === "total" || c.key === "avg") cell.numFmt = "#,##0.00";
      if (c.key === "missing" && r.missing) cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.warn } };
    });
  });
  ws.views = [{ state: "frozen", ySplit: HEAD }];
  if (rows.length) ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: HEAD + rows.length, column: cols.length } };
}

export const buildOperationFileName = (groupLabel) =>
  `แผนการดำเนินงาน-${groupLabel}-${moment().format("YYYYMMDD")}.xlsx`;
