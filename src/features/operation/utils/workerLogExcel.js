/**
 * workerLogExcel.js — ส่งออก "รายงานรายช่าง" เป็น Excel (.xlsx)
 *
 * ชีต: รายละเอียดรายคน · สรุปรายคน · รายเดือน (รายคน×เดือน) · [รายปี ถ้าคร่อมหลายปี] · บันทึกเข้างาน
 * ⚠️ exceljs ใหญ่ — หน้ารายงาน import ไฟล์นี้แบบ dynamic ตอนกดส่งออกเท่านั้น
 * ⚠️ ทุกคนในทีมได้มูลค่างานเต็มจำนวน — ผลรวมรายคนมากกว่ามูลค่างานจริงได้ (บอกไว้ในหัวทุกชีต)
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";

const C = {
  headerBg: "FF1E293B", headerText: "FFFFFFFF", titleText: "FF0F172A", subtitleText: "FF64748B",
  zebra: "FFF8FAFC", border: "FFE2E8F0", totalBg: "FFEFF6FF", warn: "FFB45309", ok: "FF059669", muted: "FF94A3B8",
};
const border = { top: { style: "thin", color: { argb: C.border } }, left: { style: "thin", color: { argb: C.border } }, bottom: { style: "thin", color: { argb: C.border } }, right: { style: "thin", color: { argb: C.border } } };
const MONEY = "#,##0.00";

export const monthName = (key) => {
  const [y, m] = String(key).split("-");
  return `${THAI_MONTHS_SHORT[Number(m) - 1]} ${Number(y) + 543}`;
};
const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : "");

/** ชีตตารางมาตรฐาน: หัวเรื่อง · บรรทัดรอง · หัวตาราง · แถวข้อมูล · แถวรวม(ถ้ามี) */
export function addTable(wb, name, { title, sub, cols, rows, total, freezeCols = 0 }) {
  const ws = wb.addWorksheet(name, { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width || 14 }));
  const last = cols.length;
  ws.mergeCells(1, 1, 1, last);
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { name: "Tahoma", size: 15, bold: true, color: { argb: C.titleText } };
  ws.getRow(1).height = 24;
  ws.mergeCells(2, 1, 2, last);
  ws.getCell(2, 1).value = sub;
  ws.getCell(2, 1).font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.getCell(2, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(2).height = 30;
  const HEAD = 4;
  const hr = ws.getRow(HEAD);
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  hr.height = 30;
  const paint = (row, idx, isTotal) => {
    row.height = 22;
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: "Tahoma", size: 10, bold: isTotal || c.bold, color: c.color ? { argb: c.color(cell.value, row) } : undefined };
      cell.border = border;
      cell.alignment = { vertical: "middle", horizontal: c.align || "left", wrapText: Boolean(c.wrap) };
      if (c.fmt) cell.numFmt = c.fmt;
      if (isTotal) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalBg } };
      else if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
    });
  };
  rows.forEach((r, idx) => paint(ws.addRow(r), idx, false));
  if (total) paint(ws.addRow(total), 0, true);
  ws.views = [{ state: "frozen", ySplit: HEAD, xSplit: freezeCols }];
  if (rows.length) ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: HEAD + rows.length, column: last } };
  return ws;
}

/**
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "excel ให้แสดงงานที่เข้าไปทำให้ละเอียดด้วย ว่าที่ไหน โครงการไหน ให้ดูง่ายชัดเจน")
 *    ชีตแรก "รายละเอียดรายคน" — หัวแถบสีเข้มต่อคน (ชื่อ · จำนวนครั้ง · มูลค่ารวม) แล้วตามด้วยงานทีละแถว + แถวรวมของคนนั้น
 */
function addPersonDetailSheet(wb, entries, summary, sub, note) {
  const ws = wb.addWorksheet("รายละเอียดรายคน", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const cols = [
    { key: "no", header: "ลำดับ", width: 7, align: "center" },
    { key: "date", header: "วันที่เข้างาน", width: 13, align: "center", fmt: "dd/mm/yyyy" },
    { key: "days", header: "จำนวนวัน", width: 9, align: "center" },
    { key: "site", header: "โครงการ (สถานที่)", width: 32, wrap: true, bold: true },
    { key: "company", header: "บริษัท / ลูกค้า", width: 28, wrap: true },
    { key: "job", header: "งานที่เข้าไปทำ", width: 26, wrap: true },
    { key: "jobNo", header: "เลขที่งาน", width: 16 },
    { key: "role", header: "บทบาท", width: 11, align: "center" },
    { key: "status", header: "สถานะงาน", width: 17, align: "center" },
    { key: "value", header: "มูลค่าครั้งนี้ (บาท)", width: 17, align: "right", fmt: MONEY, bold: true },
  ];
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const last = cols.length;
  ws.mergeCells(1, 1, 1, last);
  ws.getCell(1, 1).value = "รายละเอียดการเข้างานรายคน";
  ws.getCell(1, 1).font = { name: "Tahoma", size: 15, bold: true, color: { argb: C.titleText } };
  ws.getRow(1).height = 24;
  ws.mergeCells(2, 1, 2, last);
  ws.getCell(2, 1).value = `${sub}\n${note}`;
  ws.getCell(2, 1).font = { name: "Tahoma", size: 10, color: { argb: C.subtitleText } };
  ws.getCell(2, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(2).height = 30;

  const HEAD = 4;
  const hr = ws.getRow(HEAD);
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  hr.height = 28;

  const byName = new Map();
  entries.forEach((r) => { if (!byName.has(r.name)) byName.set(r.name, []); byName.get(r.name).push(r); });
  let rowIdx = HEAD + 1;
  summary.byPerson.forEach((p) => {
    const list = (byName.get(p.key) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    // แถบหัวของคนนั้น
    ws.mergeCells(rowIdx, 1, rowIdx, last);
    const h = ws.getCell(rowIdx, 1);
    h.value = `${p.key}  ·  เข้างาน ${p.visits} ครั้ง  ·  ${p.days} วัน  ·  มูลค่ารวม ${p.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท${p.missing ? `  ·  ยังไม่ใส่มูลค่า ${p.missing} ครั้ง` : ""}`;
    h.font = { name: "Tahoma", size: 11, bold: true, color: { argb: "FF1D4ED8" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    h.alignment = { vertical: "middle" };
    h.border = border;
    ws.getRow(rowIdx).height = 24;
    rowIdx += 1;
    list.forEach((r, i) => {
      const row = ws.getRow(rowIdx);
      const vals = {
        no: i + 1, date: toDate(r.date), days: r.days, site: r.site || "-", company: r.company || "-",
        job: [r.title, r.system, r.time ? `ครั้งที่ ${r.time}` : ""].filter(Boolean).join(" · ") || "-",
        jobNo: r.jobNo || "", role: r.lead ? "หัวหน้าทีม" : "ทีม", status: r.status || "", value: r.value === null ? "ยังไม่ใส่" : r.value,
      };
      cols.forEach((c, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = vals[c.key];
        cell.font = { name: "Tahoma", size: 10, bold: c.bold, color: c.key === "value" && r.value === null ? { argb: C.warn } : c.key === "status" && r.status === "ดำเนินการเสร็จสิ้น" ? { argb: C.ok } : undefined };
        cell.alignment = { vertical: "middle", horizontal: c.align || "left", wrapText: Boolean(c.wrap) };
        cell.border = border;
        if (c.fmt) cell.numFmt = c.fmt;
        if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      });
      row.height = 22;
      rowIdx += 1;
    });
    // แถวรวมของคนนั้น
    const tr = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, last - 1);
    tr.getCell(1).value = `รวม ${p.key}  (${p.visits} ครั้ง)`;
    tr.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
    tr.getCell(last).value = p.total;
    tr.getCell(last).numFmt = MONEY;
    [1, last].forEach((ci) => {
      const cell = tr.getCell(ci);
      cell.font = { name: "Tahoma", size: 10, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalBg } };
      cell.border = border;
    });
    tr.height = 22;
    rowIdx += 2; // เว้นบรรทัดก่อนคนถัดไป
  });
  ws.views = [{ state: "frozen", ySplit: HEAD }];
}

/**
 * 🔁 (4 พ.ย. 2569 ผู้ใช้: "ตาราง export excel จัดวางให้เช็คได้ง่ายๆ ข้อมูลไม่ยุ่งยาก ไม่เยอะ")
 *    เหลือ 3 ชีต คอลัมน์เท่าที่ต้องใช้เช็ค: สรุปรายคน · รายเดือน (รายคน × เดือน) · บันทึกเข้างาน (เรียงตามคน แล้ววันที่)
 *    + ชีตรายปี เฉพาะเมื่อช่วงที่เลือกคร่อมหลายปี
 * @param entries   แถวที่กรองแล้ว (buildWorkerEntries → filterEntries)
 * @param summary   summarizeEntries(entries)
 * @param meta      { periodLabel, filterLabel, fileName }
 */
export async function exportWorkerLog(entries, summary, meta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  wb.created = new Date();
  const note = "ทุกคนในทีมได้มูลค่างานนั้นเต็มจำนวน";
  const t = summary.totals;
  const thb = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // ✅ ทุกชีตบอกยอดรวมตามตัวกรองไว้บรรทัดรอง — เปิดชีตไหนก็เห็นทันทีว่าตัวเลขชุดนี้คือเงื่อนไขอะไร รวมเท่าไร
  const sub = [meta.periodLabel, meta.filterLabel, `มูลค่างานรวม ${thb(t.total)} บาท · ${t.visits} ครั้ง${t.missing ? ` (ยังไม่ใส่มูลค่า ${t.missing})` : ""}`].filter(Boolean).join("  ·  ");
  const warnIf = (v) => (v ? C.warn : C.muted);

  // 0) รายละเอียดรายคน — ชีตแรก: แยกเป็นช่วงของแต่ละคน ไล่ดูได้ทันทีว่าเข้างานไหน ที่ไหน เมื่อไร มูลค่าเท่าไร
  addPersonDetailSheet(wb, entries, summary, sub, note);

  // 1) สรุปรายคน — ใครเข้างานกี่ครั้ง ได้มูลค่าเท่าไร
  addTable(wb, "สรุปรายคน", {
    title: "สรุปรายคน",
    sub: `${sub}
${note}`,
    cols: [
      { key: "no", header: "ลำดับ", width: 7, align: "center" },
      { key: "name", header: "ผู้ปฏิบัติงาน", width: 26, bold: true },
      { key: "visits", header: "เข้างาน (ครั้ง)", width: 14, align: "center" },
      { key: "total", header: "มูลค่างานรวม (บาท)", width: 20, align: "right", fmt: MONEY, bold: true },
      { key: "missing", header: "ยังไม่ใส่มูลค่า (ครั้ง)", width: 16, align: "center", color: warnIf },
    ],
    rows: summary.byPerson.map((p, i) => ({ no: i + 1, name: p.key, visits: p.visits, total: p.total, missing: p.missing || "" })),
    total: { no: "", name: `รวม ${summary.byPerson.length} คน`, visits: t.visits, total: t.total, missing: t.missing || "" },
  });

  // 2) รายเดือน — แถว = คน · คอลัมน์ = เดือน (มูลค่า) · แถวล่างสุด = ยอดรวมของแต่ละเดือน
  const months = summary.months;
  addTable(wb, "รายเดือน", {
    title: "มูลค่างานรายเดือน (บาท)", sub: `${sub}
${note}`, freezeCols: 1,
    cols: [
      { key: "name", header: "ผู้ปฏิบัติงาน", width: 24, bold: true },
      ...months.map((m) => ({ key: m, header: monthName(m), width: 14, align: "right", fmt: MONEY })),
      { key: "sum", header: "รวม", width: 16, align: "right", fmt: MONEY, bold: true },
    ],
    rows: summary.byPerson.map((p) => {
      const cells = summary.pivot.get(p.key) || new Map();
      const row = { name: p.key, sum: p.total };
      months.forEach((m) => { row[m] = cells.get(m)?.total || ""; });
      return row;
    }),
    total: (() => {
      const row = { name: "รวมทุกคน", sum: t.total };
      months.forEach((m) => { row[m] = summary.byMonth.find((x) => x.key === m)?.total || 0; });
      return row;
    })(),
  });

  // 2b) รายปี — เฉพาะเมื่อคร่อมหลายปี
  if (summary.byYear.length > 1) {
    addTable(wb, "รายปี", {
      title: "สรุปรายปี", sub: `${sub}
${note}`,
      cols: [
        { key: "period", header: "ปี (พ.ศ.)", width: 14, bold: true, align: "center" },
        { key: "visits", header: "เข้างาน (ครั้ง)", width: 14, align: "center" },
        { key: "people", header: "ผู้ปฏิบัติงาน (คน)", width: 16, align: "center" },
        { key: "total", header: "มูลค่างานรวม (บาท)", width: 20, align: "right", fmt: MONEY, bold: true },
      ],
      rows: summary.byYear.map((y) => ({ period: String(Number(y.key) + 543), visits: y.visits, people: y.people, total: y.total })),
      total: { period: "รวม", visits: t.visits, people: t.people, total: t.total },
    });
  }

  // 3) บันทึกเข้างาน — เรียงตามคน แล้ววันที่ (ไล่เช็คทีละคนได้ทันที) · คอลัมน์เท่าที่จำเป็น
  const log = entries.slice().sort((a, b) => a.name.localeCompare(b.name, "th") || a.date.localeCompare(b.date));
  addTable(wb, "บันทึกเข้างาน", {
    title: "บันทึกเข้างานรายบุคคล", sub: `${sub}  ·  ${log.length} รายการ (1 แถว = 1 คน × 1 งาน)
${note}`, freezeCols: 1,
    cols: [
      { key: "name", header: "ผู้ปฏิบัติงาน", width: 20, bold: true },
      { key: "date", header: "วันที่เข้างาน", width: 13, align: "center", fmt: "dd/mm/yyyy" },
      { key: "site", header: "โครงการ (สถานที่)", width: 30, wrap: true },
      { key: "company", header: "บริษัท / ลูกค้า", width: 26, wrap: true },
      { key: "job", header: "งานที่เข้าไปทำ", width: 24, wrap: true },
      { key: "role", header: "บทบาท", width: 11, align: "center" },
      { key: "status", header: "สถานะ", width: 17, align: "center", color: (v) => (v === "ดำเนินการเสร็จสิ้น" ? C.ok : C.titleText) },
      { key: "value", header: "มูลค่าครั้งนี้ (บาท)", width: 18, align: "right", fmt: MONEY, bold: true, color: (v) => (typeof v === "number" ? C.titleText : C.warn) },
    ],
    rows: log.map((r) => ({
      name: r.name, date: toDate(r.date), site: r.site || "-", company: r.company || "-",
      job: [r.title, r.system, r.time ? `ครั้งที่ ${r.time}` : ""].filter(Boolean).join(" · "),
      role: r.lead ? "หัวหน้าทีม" : "ทีม", status: r.status, value: r.value === null ? "ยังไม่ใส่" : r.value,
    })),
    total: { name: `รวม ${log.length} รายการ`, date: "", site: "", company: "", job: "", role: "", status: "", value: t.total },
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${meta.fileName}.xlsx`);
}
