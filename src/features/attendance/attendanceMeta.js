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

/**
 * ✅ (15 ต.ค. 2569 ผู้ใช้: "ตำแหน่งเวลากดบันทึกให้แม่นยำที่สุด ไม่ให้ผิดพลาด")
 * ติดตามตำแหน่งต่อเนื่องตลอดที่เปิดหน้าบันทึก (watchPosition + GPS ความแม่นยำสูง) แล้วเลือก "ค่าที่แม่นที่สุด
 * ในช่วงล่าสุด" — getCurrentPosition ครั้งเดียวมักได้ค่าจากเสาสัญญาณ/Wi-Fi (คลาด 100–2,000 ม.) ก่อน GPS จะล็อกได้
 *   • ไม่รับค่าเก่าที่เครื่องจำไว้ (timestamp ก่อนเริ่มติดตาม)
 *   • ค่าที่ดีที่สุด = ความคลาดเคลื่อน (accuracy) ต่ำสุด ภายใน FRESH_MS ล่าสุด — เดินไปที่อื่นแล้วจะไม่ใช้ค่าเก่า
 * @param onUpdate (pos) => void   pos = { gps:"ok", lat, lng, accuracy, at } | { gps:"denied"|"unavailable" }
 * @returns stop()
 */
export const GPS_GOOD_M = 30;      // แม่นพอ — ล็อก GPS ได้แล้ว
export const GPS_OK_M = 100;       // ใช้ได้ แต่ควรรอให้แม่นขึ้น
export const GPS_MIN_WAIT_MS = 15000; // ยังไม่แม่นพอ ต้องรออย่างน้อยเท่านี้ก่อนยอมให้บันทึก
const FRESH_MS = 45000;
export function watchBestPosition(onUpdate) {
  if (typeof navigator === "undefined" || !navigator.geolocation) { onUpdate({ gps: "unavailable" }); return () => {}; }
  const startedAt = Date.now();
  const readings = [];
  let gotAny = false;
  const pick = () => {
    const now = Date.now();
    const recent = readings.filter((r) => now - r.at <= FRESH_MS);
    if (!recent.length) return null;
    return recent.reduce((b, r) => (r.accuracy < b.accuracy ? r : b));
  };
  const id = navigator.geolocation.watchPosition(
    (p) => {
      // ค่าที่เครื่องจำไว้ก่อนเปิดหน้านี้ = อาจเป็นตำแหน่งเก่า (อีกที่หนึ่ง) — ไม่ใช้
      if (p.timestamp && p.timestamp < startedAt - 2000) return;
      gotAny = true;
      readings.push({ gps: "ok", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 9999), at: Date.now() });
      if (readings.length > 60) readings.shift();
      const best = pick();
      if (best) onUpdate({ ...best, samples: readings.length, startedAt });
    },
    (err) => {
      if (err?.code === 1) onUpdate({ gps: "denied" });
      else if (!gotAny) onUpdate({ gps: "unavailable" });
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export const CORRECTION_STATUS = {
  pending: { label: "รออนุมัติ", color: "#d97706" },
  approved: { label: "อนุมัติแล้ว", color: "#16a34a" },
  rejected: { label: "ไม่อนุมัติ", color: "#dc2626" },
  superseded: { label: "ถูกแทนด้วยคำขอใหม่", color: "#94a3b8" },
};
export const FIELD_LABEL = { checkIn: "เวลาเข้างาน", checkOut: "เวลาออกงาน" };
