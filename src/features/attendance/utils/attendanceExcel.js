/**
 * attendanceExcel.js — ส่งออก "ประวัติเข้างาน" เป็น Excel
 * ชีต: สรุปรายคน · บันทึกเข้างาน (เรียงตามคน แล้วเวลา) — คอลัมน์เท่าที่ใช้เช็ค
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { addTable } from "@/features/operation/utils/workerLogExcel";
import { ON_SITE_M } from "../attendanceMeta";

export const placeOf = (r) => {
  const c = r.checkIn || {};
  if (c.gps !== "ok") return { label: "ไม่มี GPS", warn: true };
  if (c.distanceM == null) return { label: "มี GPS (ไม่มีพิกัดหน้างาน)", warn: false };
  return c.distanceM <= ON_SITE_M ? { label: `ตรงหน้างาน (${Math.round(c.distanceM)} ม.)`, warn: false } : { label: `ห่างหน้างาน ${(c.distanceM / 1000).toFixed(c.distanceM >= 10000 ? 0 : 1)} กม.`, warn: true };
};

export async function exportAttendance(rows, byPerson, { periodLabel, filterLabel, fileName }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TidTam";
  wb.created = new Date();
  const sub = [periodLabel, filterLabel, `${rows.length} ครั้ง`].filter(Boolean).join("  ·  ");

  addTable(wb, "สรุปรายคน", {
    title: "สรุปการเข้างานรายคน", sub,
    cols: [
      { key: "no", header: "ลำดับ", width: 7, align: "center" },
      { key: "name", header: "ผู้บันทึกเข้างาน", width: 24, bold: true },
      { key: "visits", header: "เข้างาน (ครั้ง)", width: 13, align: "center" },
      { key: "jobs", header: "จำนวนงาน", width: 11, align: "center" },
      { key: "days", header: "จำนวนวัน", width: 11, align: "center" },
      { key: "far", header: "ตำแหน่งไม่ตรง", width: 14, align: "center", color: (v) => (v ? "FFB45309" : "FF94A3B8") },
      { key: "last", header: "เข้างานล่าสุด", width: 18, align: "center", fmt: "dd/mm/yyyy hh:mm" },
    ],
    rows: byPerson.map((p, i) => ({ no: i + 1, name: p.name, visits: p.visits, jobs: p.jobs, days: p.days, far: p.far || "", last: p.last ? new Date(p.last) : "" })),
    total: { no: "", name: `รวม ${byPerson.length} คน`, visits: rows.length, jobs: "", days: "", far: byPerson.reduce((s, p) => s + p.far, 0) || "", last: "" },
  });

  const sorted = rows.slice().sort((a, b) => String(a.userName).localeCompare(String(b.userName), "th") || new Date(a.checkIn?.at) - new Date(b.checkIn?.at));
  addTable(wb, "บันทึกเข้างาน", {
    title: "บันทึกเข้างาน", sub: `${sub}\nเวลาจากเซิร์ฟเวอร์ · ตำแหน่งเทียบพิกัดหน้างาน (ตรงหน้างาน = ไม่เกิน ${ON_SITE_M} ม.)`, freezeCols: 1,
    cols: [
      { key: "name", header: "ผู้บันทึกเข้างาน", width: 20, bold: true },
      { key: "at", header: "วันเวลาเข้างาน", width: 18, align: "center", fmt: "dd/mm/yyyy hh:mm" },
      { key: "site", header: "โครงการ", width: 28, wrap: true },
      { key: "job", header: "งาน", width: 24, wrap: true },
      { key: "team", header: "ทีม", width: 24, wrap: true },
      { key: "place", header: "ตำแหน่ง", width: 22, color: (v) => (String(v).startsWith("ตรง") ? "FF059669" : String(v).startsWith("มี GPS") ? "FF0F172A" : "FFB45309") },
      { key: "note", header: "หมายเหตุ", width: 24, wrap: true },
    ],
    rows: sorted.map((r) => ({
      name: r.userName || "-", at: r.checkIn?.at ? new Date(r.checkIn.at) : "",
      site: r.job?.site || r.job?.company || r.jobLabel || "-",
      job: [r.job?.title, r.job?.system, r.jobNo].filter(Boolean).join(" · "),
      team: [r.team?.head, ...(r.team?.members || [])].filter(Boolean).filter((n, i, a) => a.indexOf(n) === i).join(", "),
      place: placeOf(r).label,
      note: [r.offSchedule ? "เข้างานนอกวันที่ลงตาราง" : "", r.hasPendingCorrection ? "รออนุมัติแก้เวลา" : "", (r.corrections || []).some((c) => c.status === "approved") ? "แก้เวลาแล้ว" : "", r.checkIn?.note || ""].filter(Boolean).join(" · "),
    })),
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
}
