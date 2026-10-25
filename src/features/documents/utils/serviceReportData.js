/**
 * serviceReportData.js — ตัวช่วยข้อมูลสรุป Service Report ที่ใช้ร่วมกัน (หน้าต่างสรุป · PDF · Excel)
 * ⚠️ แยกจากไฟล์ PDF โดยตั้งใจ — Excel/หน้าจอใช้ได้โดยไม่ต้องโหลด jsPDF + ฟอนต์ไทย
 */
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { formatRoundLabel } from "@/shared/utils/contractRounds";

export const ISSUE_STATUS = { fixed: "แก้แล้ว", pending: "ยังค้าง", need_quote: "ต้องเสนอราคา", unknown: "-" };

const beYear = (m) => m.year() + 543;
/** ช่วงวันที่ของ 1 ช่วงงาน เช่น "19 ต.ค. 2569" · "19–21 ต.ค. 2569" · "30 ต.ค. – 2 พ.ย. 2569" (+ เวลา ถ้ามี) */
const sessionText = (s) => {
  const st = moment(s.start);
  if (!st.isValid()) return "";
  const en = s.end ? moment(s.end).subtract(s.allDay ? 1 : 0, "days") : st.clone();
  let d;
  if (!en.isValid() || en.isSame(st, "day") || en.isBefore(st)) d = `${st.date()} ${st.format("MMM")} ${beYear(st)}`;
  else if (en.isSame(st, "month")) d = `${st.date()}–${en.date()} ${st.format("MMM")} ${beYear(st)}`;
  else if (en.isSame(st, "year")) d = `${st.date()} ${st.format("MMM")} – ${en.date()} ${en.format("MMM")} ${beYear(en)}`;
  else d = `${st.date()} ${st.format("MMM")} ${beYear(st)} – ${en.date()} ${en.format("MMM")} ${beYear(en)}`;
  return s.startTime ? `${d} ${s.startTime}${s.endTime ? `–${s.endTime}` : ""} น.` : d;
};

/** วันเข้างานทุกช่วงของงาน (งานหลายวันไม่ติดกัน) เรียงตามวัน */
export const sessionDatesText = (sessions = []) => {
  moment.locale("th");
  return [...sessions].sort((a, b) => new Date(a.start) - new Date(b.start)).map(sessionText).filter(Boolean).join(" · ");
};

/** ชื่อช่างทุกคนในงาน — หัวหน้าทีมก่อน แล้วลูกทีม (ไม่ซ้ำ) */
export const teamNames = (sessions = []) => [...new Set(sessions.flatMap((s) => [s.team, ...(s.teamMembers || []).map((m) => m?.name)])
  .map((n) => String(n || "").trim()).filter(Boolean))];

/**
 * ข้อมูลงานจาก "ระบบ" สำหรับหัวรายงาน PDF / Excel
 * @param event    งาน (ช่วงใดช่วงหนึ่งของงาน — ใช้ jobNo/company/site/system/title/time)
 * @param sessions ทุกช่วงของงาน ({ start, end, allDay, startTime, endTime, team, teamMembers }) · ไม่ส่ง = ใช้ event เอง
 */
export const jobInfoOf = (event = {}, sessions) => {
  const ss = sessions?.length ? sessions : [event];
  const round = event.time ? formatRoundLabel(event.time, event.visitCount, event) : "";
  return {
    jobNo: event.jobNo || "",
    company: event.company || "",
    site: event.site || "",
    system: event.system || "",
    jobType: [event.title, round ? `ครั้งที่ ${round}` : ""].filter(Boolean).join(" "),
    dates: sessionDatesText(ss),
    team: teamNames(ss).join(", "),
  };
};

/** นับปัญหาตามสถานะ */
export const issueStats = (issues = []) => ({
  total: issues.length,
  pending: issues.filter((x) => x.status === "pending").length,
  needQuote: issues.filter((x) => x.status === "need_quote").length,
  fixed: issues.filter((x) => x.status === "fixed").length,
});

/** "85 ตัว" → { n: 85, unit: "ตัว" } · ไม่มีตัวเลข → { n: null, unit: ข้อความเดิม } (Excel รวมยอดได้จริง) */
export const splitQty = (qty) => {
  const m = String(qty || "").trim().match(/^([\d,]+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { n: null, unit: String(qty || "").trim() };
  return { n: Number(m[1].replace(/,/g, "")), unit: m[2].trim() };
};
