/**
 * ค่าคงที่/ตัวช่วยของระบบเช็คอิน-เช็คเอาต์ (10 ต.ค. 2569)
 */
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { formatThai } from "@/shared/utils/thaiDate";
import { PlaceOutlined, PersonSearchOutlined, BadgeOutlined } from "@mui/icons-material";

/** อยู่ในรัศมีนี้ = ถือว่าอยู่ที่หน้างาน */
export const ON_SITE_M = 300;

export const RESULT_OPTIONS = [
  { key: "done", label: "ทำงานเสร็จแล้ว", hint: "พร้อมแนบเอกสารและขอปิดงาน", color: "#16a34a" },
  { key: "continue", label: "รอดำเนินการต่อ", hint: "ต้องเข้ามาทำต่ออีกวัน", color: "#d97706" },
  { key: "waiting_parts", label: "รออะไหล่", hint: "เขียนอะไหล่ที่ต้องใช้ในหมายเหตุ", color: "#dc2626" },
];
export const resultOf = (key) => RESULT_OPTIONS.find((r) => r.key === key);

/** หมายเหตุสำเร็จรูปตอนเช็คอิน — ไอคอนสื่อความหมาย (ถึงแล้ว · รอคน · รอสิทธิ์เข้าพื้นที่) */
export const NOTE_PRESETS = [
  { text: "ถึงไซต์งานแล้ว", Icon: PlaceOutlined },
  { text: "รอผู้ประสานงาน", Icon: PersonSearchOutlined },
  { text: "รออนุญาตเข้าพื้นที่", Icon: BadgeOutlined },
];

export const fmtDuration = (min) => {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  return h ? `${h} ชม. ${m % 60} นาที` : `${m} นาที`;
};

/** ตัวจับเวลา hh:mm:ss */
export const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

export const fmtDistance = (m) => (m == null ? "" : m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`);

export const fmtTime = (d) => (d ? moment(d).format("HH:mm") : "--:--");
export const fmtDayTime = (d) => (d ? formatThai(moment(d), "D MMM YY · HH:mm") : "-");

/**
 * ป้ายตำแหน่ง: อยู่หน้างาน / ห่าง X / ไม่มีพิกัดหน้างาน / ไม่มี GPS
 * @returns {{ text, tone: "ok"|"warn"|"muted" }}
 */
export function locationBadge(stamp) {
  if (!stamp) return null;
  if (stamp.gps === "denied") return { text: "ไม่อนุญาตตำแหน่ง", tone: "warn" };
  if (stamp.gps !== "ok") return { text: "ไม่มีพิกัด GPS", tone: "warn" };
  if (stamp.distanceM == null) return { text: "บันทึกพิกัดแล้ว", tone: "muted" };
  return stamp.distanceM <= ON_SITE_M
    ? { text: `อยู่ที่หน้างาน (${fmtDistance(stamp.distanceM)})`, tone: "ok" }
    : { text: `ห่างหน้างาน ${fmtDistance(stamp.distanceM)}`, tone: "warn" };
}

/** ระยะทาง (เมตร) ระหว่าง 2 พิกัด — ใช้แสดงผลก่อนกดยืนยัน (ค่าที่บันทึกจริงคำนวณที่ server) */
export function distanceM(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/**
 * ขอตำแหน่งจากเครื่อง — ไม่ throw เสมอ
 * @returns {Promise<{gps:"ok",lat,lng,accuracy}|{gps:"denied"|"unavailable"}>}
 */
export function getPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve({ gps: "unavailable" }); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ gps: "ok", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => resolve({ gps: err?.code === 1 ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

export const CORRECTION_STATUS = {
  pending: { label: "รออนุมัติ", color: "#d97706" },
  approved: { label: "อนุมัติแล้ว", color: "#16a34a" },
  rejected: { label: "ไม่อนุมัติ", color: "#dc2626" },
  superseded: { label: "ถูกแทนด้วยคำขอใหม่", color: "#94a3b8" },
};
export const FIELD_LABEL = { checkIn: "เวลาเข้างาน", checkOut: "เวลาออกงาน" };
