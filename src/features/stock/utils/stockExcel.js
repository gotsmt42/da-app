/**
 * ส่งออกข้อมูลสต๊อกทั้งคลังเป็น Excel
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ทำ excel ดึงข้อมูลทั้งหมดให้สมบูรณ์") — 5 ชีต (+ ใบคืน):
 *   1. คงคลัง      ทุกรายการ + ยอดในคลัง/จอง/ยืมออก/เบิกได้/สถานะ
 *   2. ใบเบิก      หัวใบ (ผู้เบิก · งาน · สถานะ · อนุมัติ · กำหนดคืน)
 *   3. รายการเบิก   หนึ่งแถวต่อรายการในใบ — กรอง/Pivot ตามงานหรือสินค้าได้ทันที
 *   4. ประวัติ      ทุกการเคลื่อนไหวของยอด
 * ⚠️ exceljs ใหญ่ — import แบบ dynamic เฉพาะตอนกดส่งออก
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import moment from "moment";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { KINDS, MOVE_TYPES, REQ_VIEW, reqView, available, isLow, isOut, outstanding } from "../stockMeta";

const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
const ZEBRA = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const BORDER = { style: "thin", color: { argb: "FFE2E8F0" } };

/** ชีตตาราง — หัวเข้มตัวขาว · ตรึงหัว · ตัวกรอง · แถวสลับสี · เส้นบาง · กว้างคอลัมน์ตามเนื้อหา */
const sheet = (wb, name, title, columns, rows) => {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([`ส่งออกเมื่อ ${thaiDateTime(new Date())} · ${rows.length} แถว`]).font = { size: 10, color: { argb: "FF64748B" } };
  const head = ws.addRow(columns.map((c) => c.h));
  head.height = 22;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEAD_FILL;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  rows.forEach((r, i) => {
    const row = ws.addRow(columns.map((c) => r[c.k] ?? ""));
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      const c = columns[n - 1];
      cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
      if (i % 2) cell.fill = ZEBRA;
      if (c?.num) { cell.numFmt = "#,##0"; cell.alignment = { horizontal: "right" }; }
      if (c?.wrap) cell.alignment = { wrapText: true, vertical: "top" };
    });
  });
  columns.forEach((c, i) => {
    const longest = Math.max(String(c.h).length, ...rows.map((r) => String(r[c.k] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(c.max || 48, Math.max(c.min || 8, longest + 2));
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } };
  return ws;
};

/**
 * @param {object} p.items     รายการในคลัง (StockService.items)
 * @param {object} p.requests  ใบเบิก (StockService.requests)
 * @param {object} p.moves     ประวัติ (StockService.moves)
 * @param {string} p.deptLabel ชื่อคลัง
 */
export async function exportStockExcel({ items = [], requests = [], moves = [], returns = [], deptLabel = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  const where = deptLabel ? `คลัง${deptLabel}` : "คลังแผนก";

  sheet(wb, "คงคลัง", `สต๊อก · ทรัพย์สิน — ${where}`, [
    { k: "code", h: "รหัส" }, { k: "name", h: "ชื่อสินค้า / ทรัพย์สิน", min: 24 }, { k: "kind", h: "ชนิด" }, { k: "category", h: "หมวดหมู่" },
    { k: "unit", h: "หน่วย" }, { k: "qty", h: "ในคลัง", num: true }, { k: "reserved", h: "จองไว้", num: true }, { k: "onLoan", h: "ยืมออก", num: true },
    { k: "avail", h: "เบิกได้", num: true }, { k: "minQty", h: "จุดเตือน", num: true }, { k: "state", h: "สถานะ" }, { k: "location", h: "ที่เก็บ" },
    { k: "active", h: "ใช้งาน" }, { k: "note", h: "หมายเหตุ", wrap: true }, { k: "photo", h: "ลิงก์รูป", max: 30 },
  ], items.map((it) => ({
    code: it.code, name: it.name, kind: KINDS[it.kind]?.label, category: it.category, unit: it.unit,
    qty: it.qty || 0, reserved: it.reserved || 0, onLoan: it.kind === "asset" ? it.onLoan || 0 : 0, avail: available(it), minQty: it.minQty || 0,
    state: it.active === false ? "ปิดใช้งาน" : isOut(it) ? "หมด" : isLow(it) ? "ใกล้หมด" : "พร้อมเบิก",
    location: it.location, active: it.active === false ? "ไม่" : "ใช่", note: it.note, photo: it.photo?.url || "",
  })));

  sheet(wb, "ใบเบิก", `ใบเบิกของ — ${where}`, [
    { k: "docNo", h: "เลขที่" }, { k: "date", h: "วันที่ยื่น" }, { k: "requester", h: "ผู้เบิก" }, { k: "position", h: "ตำแหน่ง" },
    { k: "job", h: "ใช้กับงาน", min: 30, max: 60 }, { k: "lines", h: "จำนวนรายการ", num: true }, { k: "units", h: "รวมหน่วย", num: true },
    { k: "status", h: "สถานะ" }, { k: "issuedBy", h: "อนุมัติ/จ่ายโดย" }, { k: "issuedAt", h: "วันที่จ่าย" },
    { k: "due", h: "กำหนดคืน" }, { k: "owe", h: "ยืมค้าง", num: true }, { k: "reason", h: "เหตุผลไม่อนุมัติ" }, { k: "note", h: "หมายเหตุ", wrap: true },
  ], requests.map((r) => ({
    docNo: r.docNo, date: thaiDate(r.createdAt), requester: r.requester?.name, position: r.requester?.position,
    job: r.jobTitle, lines: (r.lines || []).length, units: (r.lines || []).reduce((t, l) => t + l.qty, 0),
    status: REQ_VIEW[reqView(r)].label, issuedBy: r.issuedBy?.name || "", issuedAt: r.issuedAt ? thaiDate(r.issuedAt) : "",
    due: r.dueReturnAt ? thaiDate(r.dueReturnAt) : "", owe: outstanding(r), reason: r.rejectReason || "", note: r.note || "",
  })));

  sheet(wb, "รายการเบิก", `รายการเบิกแยกตามสินค้า — ${where}`, [
    { k: "docNo", h: "เลขที่ใบ" }, { k: "date", h: "วันที่" }, { k: "requester", h: "ผู้เบิก" }, { k: "job", h: "ใช้กับงาน", min: 30, max: 60 },
    { k: "code", h: "รหัสสินค้า" }, { k: "name", h: "รายการ", min: 24 }, { k: "kind", h: "ชนิด" }, { k: "qty", h: "จำนวน", num: true },
    { k: "unit", h: "หน่วย" }, { k: "returned", h: "คืนแล้ว", num: true }, { k: "status", h: "สถานะใบ" },
  ], requests.flatMap((r) => (r.lines || []).map((l) => ({
    docNo: r.docNo, date: thaiDate(r.createdAt), requester: r.requester?.name, job: r.jobTitle,
    code: l.code, name: l.name, kind: KINDS[l.kind]?.label, qty: l.qty, unit: l.unit,
    returned: l.kind === "asset" ? l.returnedQty || 0 : "", status: REQ_VIEW[reqView(r)].label,
  }))));

  const COND = { good: "ปกติ", damaged: "ชำรุด", lost: "สูญหาย" };
  const RT = { pending: "รอตรวจรับ", received: "รับคืนแล้ว", rejected: "ไม่รับคืน", cancelled: "ยกเลิก" };
  sheet(wb, "ใบคืน", `ใบคืนของ — ${where}`, [
    { k: "docNo", h: "เลขที่ใบคืน" }, { k: "date", h: "วันที่" }, { k: "ref", h: "อ้างใบเบิก" }, { k: "requester", h: "ผู้คืน" },
    { k: "name", h: "รายการ", min: 24 }, { k: "qty", h: "จำนวน", num: true }, { k: "unit", h: "หน่วย" }, { k: "cond", h: "สภาพ" },
    { k: "lineNote", h: "รายละเอียดสภาพ", wrap: true }, { k: "status", h: "สถานะ" }, { k: "receivedBy", h: "ผู้ตรวจรับ" }, { k: "job", h: "งาน", max: 60 },
  ], returns.flatMap((r) => r.lines.map((l) => ({
    docNo: r.docNo, date: thaiDate(r.createdAt), ref: r.requestDocNo, requester: r.requester?.name, name: l.name, qty: l.qty, unit: l.unit,
    cond: COND[l.condition] || l.condition, lineNote: l.note || "", status: RT[r.status] || r.status, receivedBy: r.receivedBy?.name || "", job: r.jobTitle,
  }))));

  sheet(wb, "ประวัติ", `ประวัติการเคลื่อนไหว — ${where}`, [
    { k: "at", h: "วันเวลา" }, { k: "type", h: "ประเภท" }, { k: "name", h: "รายการ", min: 24 }, { k: "qty", h: "จำนวน (+/−)", num: true },
    { k: "balance", h: "คงเหลือหลังรายการ", num: true }, { k: "unit", h: "หน่วย" }, { k: "docNo", h: "เลขที่ใบ" },
    { k: "job", h: "งาน", max: 60 }, { k: "by", h: "ผู้ทำรายการ" }, { k: "note", h: "หมายเหตุ", wrap: true },
  ], moves.map((m) => ({
    at: thaiDateTime(m.at), type: MOVE_TYPES[m.type]?.label || m.type, name: m.itemName, qty: m.qty, balance: m.balance,
    unit: m.unit, docNo: m.docNo, job: m.jobTitle, by: m.by?.name, note: m.note,
  })));

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `สต๊อก-${deptLabel || "แผนก"}-${moment().format("YYYYMMDD-HHmm")}.xlsx`);
}
