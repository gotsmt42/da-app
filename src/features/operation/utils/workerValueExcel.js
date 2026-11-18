/**
 * workerValueExcel — ชีต "ผลงานรายช่าง" ในไฟล์ Excel หน้าการดำเนินงาน
 *
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "export excel ให้สรุปยอดรวมของช่างแต่ละคนว่ามูลค่าครั้งนี้ที่ลง
 *    และแจกแจงแยกแต่ละงานให้ชัดเจน")
 *    • ชีต "ผลงานรายช่าง (สรุป)"  — 1 แถว = 1 คน: จำนวนงาน · ลงแล้ว/ยังไม่ลง · % ครบ · ผลงานรวม · เฉลี่ย · ที่มาของยอด
 *      กดชื่อ = ไปที่รายการงานของคนนั้นในชีตแยกงาน
 *    • ชีต "ผลงานรายช่าง (แยกงาน)" — แยกเป็นช่วงต่อคน: ทุกงานที่มีชื่อ (วันที่ · โครงการ · บทบาท · ยอดที่ลง ·
 *      VAT · ก่อน VAT · ที่มาของยอด · วันที่ลง · เทียบมูลค่าครั้งนี้ของงาน/มูลค่างานรวม) + บรรทัดรวมของคนนั้น
 *    กติกา: ผลงานรายคน = personValueOf (ยอดที่คนนั้นลงเอง/แอดมินลงแทน · ยอดเดิมก่อนแยกช่องที่ช่างในทีมลง)
 *    รวมได้เฉพาะ "ของคนเดียวกัน" ข้ามงาน — ไม่บวกรวมระหว่างคน (ไม่มีแถวรวมทุกคน)
 */
import { excelDate } from "@/shared/utils/excelDate";
import { personValueOf, workersOfRows, jobWorkValueNet, jobTotalNet, sameWorkerName } from "@/shared/utils/workValue";

export const SUMMARY_SHEET = "ผลงานรายช่าง (สรุป)";
export const DETAIL_SHEET = "ผลงานรายช่าง (แยกงาน)";

/** ที่มาของผลงานรายคน 1 รายการ */
export function personValueSource(pv, name) {
  if (!pv) return "";
  if (pv.legacy) return "ยอดเดิม (ลงเป็นมูลค่าครั้งนี้ของงาน)";
  if (pv.by && !sameWorkerName(pv.by, name)) return `ลงแทนโดย ${pv.by}`;
  return "ลงเอง";
}

/**
 * รวมข้อมูลผลงานรายช่างจากกลุ่มงาน
 * @param jobs   [{ sessions: [event, ...] }] — 1 รายการ = 1 งาน
 * @param opts   { only: ชื่อเดียว (กรองผู้ปฏิบัติงานอยู่), roundLabel: (event) => string }
 * @returns [{ name, jobs, lead, valued, missing, total, self, proxy, legacy, entries: [...] }] เรียงผลงานมาก → น้อย
 */
export function buildWorkerValueReport(jobs, { only = "", roundLabel } = {}) {
  const per = new Map();
  (jobs || []).forEach(({ sessions }) => {
    const rows = sessions || [];
    const a = rows[0] || {};
    const start = rows.map((e) => e.start || e.date).filter(Boolean).sort()[0] || null;
    const jobValue = jobWorkValueNet(rows);
    const jobTotal = jobTotalNet(rows);
    workersOfRows(rows).forEach((name, i) => {
      if (only && name !== only) return;
      const r = per.get(name) || { name, jobs: 0, lead: 0, valued: 0, missing: 0, total: 0, self: 0, proxy: 0, legacy: 0, entries: [] };
      const pv = personValueOf(rows, name);
      const source = personValueSource(pv, name);
      r.jobs += 1;
      if (i === 0) r.lead += 1;
      if (pv) {
        r.valued += 1; r.total += pv.net;
        if (pv.legacy) r.legacy += 1; else if (source === "ลงเอง") r.self += 1; else r.proxy += 1;
      } else r.missing += 1;
      r.entries.push({
        start,
        jobNo: a.jobNo || "",
        company: a.company || "",
        site: a.site || "",
        work: [a.title, a.system, a.time ? `ครั้งที่ ${roundLabel ? roundLabel(a) : a.time}` : ""].filter(Boolean).join(" · "),
        role: i === 0 ? "หัวหน้าทีม" : "ลูกทีม",
        status: a.status || "",
        amount: pv ? pv.amount : null,
        vatIncluded: pv ? pv.vatIncluded : null,
        net: pv ? pv.net : null,
        source,
        at: pv?.at || null,
        jobValue,
        jobTotal,
      });
      per.set(name, r);
    });
  });
  const list = [...per.values()];
  list.forEach((r) => r.entries.sort((x, y) => String(x.start || "").localeCompare(String(y.start || ""))));
  return list.sort((x, y) => y.total - x.total || y.jobs - x.jobs || x.name.localeCompare(y.name, "th"));
}

/* ───────────────────────── Excel ───────────────────────── */

const F = "Tahoma";
const C = {
  headerBg: "FF1E293B", headerText: "FFFFFFFF", bandBg: "FFE8EEF7", bandText: "FF0F172A",
  title: "FF0F172A", sub: "FF64748B", border: "FFE2E8F0", zebra: "FFF8FAFC", warn: "FFB45309", accent: "FF1D4ED8", muted: "FF94A3B8",
};
const border = { top: { style: "thin", color: { argb: C.border } }, left: { style: "thin", color: { argb: C.border } }, bottom: { style: "thin", color: { argb: C.border } }, right: { style: "thin", color: { argb: C.border } } };
const MONEY = "#,##0.00";
const quoteSheet = (n) => `'${String(n).replace(/'/g, "''")}'`;

function titleBlock(ws, nCols, title, lines) {
  ws.mergeCells(1, 1, 1, nCols);
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { name: F, size: 16, bold: true, color: { argb: C.title } };
  ws.getRow(1).height = 26;
  lines.forEach((text, i) => {
    ws.mergeCells(2 + i, 1, 2 + i, nCols);
    const c = ws.getCell(2 + i, 1);
    c.value = text;
    c.font = { name: F, size: 10, bold: i === 1, color: { argb: i === 1 ? C.title : C.sub } };
    c.alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(2 + i).height = i === 1 ? 30 : 18;
  });
}

function headerRow(ws, rowNo, cols) {
  const hr = ws.getRow(rowNo);
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: F, size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  hr.height = 32;
}

/**
 * เพิ่ม 2 ชีตผลงานรายช่างลงใน workbook
 * @param meta { groupLabel, filterSummary, exportedAt }
 */
export function addWorkerValueSheets(wb, jobs, meta, opts = {}) {
  const people = buildWorkerValueReport(jobs, opts);
  if (!people.length) return;
  const sub = `${meta.groupLabel}  ·  ${meta.filterSummary}  ·  ส่งออก ${meta.exportedAt}`;
  const note = "ผลงานรายช่าง = มูลค่าครั้งนี้ที่ช่างแต่ละคนลงเอง (ก่อน VAT) — เป็นผลงานของแต่ละคน ไม่นำมารวมกันระหว่างคน · มูลค่าครั้งนี้ของงาน/มูลค่างานรวม แสดงไว้เทียบเท่านั้น";

  /* ── ชีตสรุป ── */
  const ws = wb.addWorksheet(SUMMARY_SHEET, { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const sCols = [
    { key: "no", header: "ลำดับ", width: 7, align: "center" },
    { key: "name", header: "ผู้ปฏิบัติงาน\n(กดเพื่อดูรายงาน)", width: 26 },
    { key: "jobs", header: "จำนวนงาน", width: 10, align: "center" },
    { key: "lead", header: "เป็นหัวหน้าทีม", width: 11, align: "center" },
    { key: "valued", header: "ลงผลงานแล้ว\n(งาน)", width: 12, align: "center" },
    { key: "missing", header: "ยังไม่ลง\n(งาน)", width: 10, align: "center" },
    { key: "rate", header: "ลงครบ", width: 9, align: "center" },
    { key: "total", header: "ผลงานรวม\nก่อน VAT (บาท)", width: 18, align: "right" },
    { key: "avg", header: "เฉลี่ย / งานที่ลง\n(บาท)", width: 16, align: "right" },
    { key: "note", header: "ที่มาของยอด", width: 34 },
  ];
  ws.columns = sCols.map((c) => ({ key: c.key, width: c.width }));
  titleBlock(ws, sCols.length, "ผลงานรายช่าง — สรุป", [sub, note]);
  const SH = 5;
  headerRow(ws, SH, sCols);

  /* ── ชีตแยกงาน ── */
  const wd = wb.addWorksheet(DETAIL_SHEET, { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const dCols = [
    { key: "no", header: "ลำดับ", width: 7, align: "center" },
    { key: "start", header: "วันที่เข้างาน", width: 12, align: "center" },
    { key: "jobNo", header: "เลขที่งาน", width: 15 },
    { key: "company", header: "บริษัท", width: 24 },
    { key: "site", header: "โครงการ", width: 26 },
    { key: "work", header: "งาน (ประเภท · ระบบ · ครั้งที่)", width: 26 },
    { key: "role", header: "บทบาท", width: 11, align: "center" },
    { key: "status", header: "สถานะงาน", width: 16, align: "center" },
    { key: "amount", header: "ยอดที่กรอก\n(บาท)", width: 14, align: "right" },
    { key: "vat", header: "VAT", width: 11, align: "center" },
    { key: "net", header: "ผลงาน\nก่อน VAT (บาท)", width: 16, align: "right" },
    { key: "source", header: "ที่มาของยอด", width: 26 },
    { key: "at", header: "วันที่ลง", width: 12, align: "center" },
    { key: "jobValue", header: "มูลค่าครั้งนี้ของงาน\n(เทียบ)", width: 16, align: "right" },
    { key: "jobTotal", header: "มูลค่างานรวม\n(เทียบ)", width: 16, align: "right" },
  ];
  const NET = dCols.findIndex((c) => c.key === "net") + 1;
  const netCol = String.fromCharCode(64 + NET);
  wd.columns = dCols.map((c) => ({ key: c.key, width: c.width }));
  titleBlock(wd, dCols.length, "ผลงานรายช่าง — แยกงาน", [sub, note]);
  const DH = 5;
  headerRow(wd, DH, dCols);

  let r = DH + 1;
  const bandRowOf = new Map();
  people.forEach((p) => {
    // แถบชื่อคน
    wd.mergeCells(r, 1, r, dCols.length);
    const band = wd.getCell(r, 1);
    band.value = `${p.name}   ·   ${p.jobs} งาน  ·  ลงแล้ว ${p.valued}${p.missing ? `  ·  ยังไม่ลง ${p.missing}` : ""}   ·   ผลงานรวม ฿${p.total.toLocaleString("th-TH", { maximumFractionDigits: 2 })} (ก่อน VAT)`;
    band.font = { name: F, size: 11, bold: true, color: { argb: C.bandText } };
    band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.bandBg } };
    band.alignment = { vertical: "middle", indent: 1 };
    band.border = border;
    wd.getRow(r).height = 24;
    bandRowOf.set(p.name, r);
    r += 1;
    const first = r;
    p.entries.forEach((e, i) => {
      const row = wd.getRow(r);
      const vals = {
        no: i + 1,
        start: excelDate(e.start),
        jobNo: e.jobNo, company: e.company, site: e.site, work: e.work, role: e.role, status: e.status,
        amount: e.amount ?? "",
        vat: e.amount === null ? "" : e.vatIncluded ? "รวม VAT" : "ไม่รวม VAT",
        net: e.net ?? "ยังไม่ลง",
        source: e.source,
        at: excelDate(e.at),
        jobValue: e.jobValue ?? "—",
        jobTotal: e.jobTotal ?? "—",
      };
      dCols.forEach((c, k) => {
        const cell = row.getCell(k + 1);
        cell.value = vals[c.key];
        cell.font = { name: F, size: 10 };
        cell.border = border;
        cell.alignment = { vertical: "middle", horizontal: c.align || "left", wrapText: c.key === "work" || c.key === "site" };
        if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
        if (c.key === "start" || c.key === "at") cell.numFmt = "dd/mm/yyyy";
        if (["amount", "net", "jobValue", "jobTotal"].includes(c.key) && typeof cell.value === "number") cell.numFmt = MONEY;
        if (["jobValue", "jobTotal"].includes(c.key)) cell.font = { name: F, size: 10, color: { argb: C.sub } };
        if (c.key === "net") {
          cell.font = e.net === null ? { name: F, size: 10, bold: true, color: { argb: C.warn } } : { name: F, size: 10, bold: true, color: { argb: C.title } };
        }
        if (c.key === "source" && e.source && e.source !== "ลงเอง") cell.font = { name: F, size: 10, color: { argb: C.sub } };
        if (c.key === "role" && e.role === "หัวหน้าทีม") cell.font = { name: F, size: 10, bold: true, color: { argb: C.accent } };
      });
      row.height = 22;
      r += 1;
    });
    // บรรทัดรวมของคนนี้ (สูตร SUM — แก้ตัวเลขใน Excel แล้วยอดเปลี่ยนตาม)
    wd.mergeCells(r, 1, r, NET - 1);
    const lab = wd.getCell(r, 1);
    lab.value = `รวมผลงานของ ${p.name}  (ลงแล้ว ${p.valued} จาก ${p.jobs} งาน)`;
    lab.font = { name: F, size: 10, bold: true, color: { argb: C.title } };
    lab.alignment = { vertical: "middle", horizontal: "right" };
    const tot = wd.getCell(r, NET);
    tot.value = { formula: `SUM(${netCol}${first}:${netCol}${r - 1})`, result: p.total };
    tot.numFmt = MONEY;
    tot.font = { name: F, size: 11, bold: true, color: { argb: C.title } };
    tot.alignment = { vertical: "middle", horizontal: "right" };
    for (let k = 1; k <= dCols.length; k += 1) {
      wd.getCell(r, k).border = { ...border, top: { style: "medium", color: { argb: "FF94A3B8" } } };
    }
    wd.getRow(r).height = 22;
    r += 2; // เว้น 1 บรรทัดก่อนคนถัดไป
  });
  wd.views = [{ state: "frozen", ySplit: DH }];

  /* ── แถวในชีตสรุป (ลิงก์ไปช่วงของคนนั้น) ── */
  people.forEach((p, idx) => {
    const notes = [
      p.self ? `ลงเอง ${p.self}` : "",
      p.proxy ? `ลงแทนโดยผู้ดูแล ${p.proxy}` : "",
      p.legacy ? `ยอดเดิม ${p.legacy}` : "",
    ].filter(Boolean).join(" · ");
    const row = ws.addRow({
      no: idx + 1,
      name: { text: p.name, hyperlink: `#${quoteSheet(DETAIL_SHEET)}!A${bandRowOf.get(p.name)}` },
      jobs: p.jobs, lead: p.lead, valued: p.valued, missing: p.missing || "",
      rate: p.jobs ? p.valued / p.jobs : 0,
      total: p.total,
      avg: p.valued ? p.total / p.valued : "",
      note: notes || "—",
    });
    row.height = 22;
    sCols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: F, size: 10, bold: c.key === "total" };
      cell.border = border;
      cell.alignment = { vertical: "middle", horizontal: c.align || "left" };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (c.key === "total" || c.key === "avg") cell.numFmt = MONEY;
      if (c.key === "rate") cell.numFmt = "0%";
      if (c.key === "name") cell.font = { name: F, size: 10, bold: true, underline: true, color: { argb: C.accent } };
      if ((c.key === "missing" && p.missing) || (c.key === "rate" && p.valued < p.jobs)) cell.font = { name: F, size: 10, bold: true, color: { argb: C.warn } };
      if (c.key === "note") cell.font = { name: F, size: 10, color: { argb: C.sub } };
    });
  });
  ws.views = [{ state: "frozen", ySplit: SH }];
  ws.autoFilter = { from: { row: SH, column: 1 }, to: { row: SH + people.length, column: sCols.length } };
}
