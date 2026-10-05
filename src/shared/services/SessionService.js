/**
 * SessionService — "อุปกรณ์ที่เข้าสู่ระบบ" ของบัญชีตัวเอง (ดู da-app-server models/LoginSession.js)
 */
import API from "../api/axiosInstance";

/** ข้อมูลรุ่นเครื่องที่เบราว์เซอร์ยอมบอก (Chrome/Edge: รุ่นมือถือจริง เช่น SM-S918B) — ไม่ได้ก็ส่งค่าว่าง ไม่รอเกิน 600ms */
export const getDeviceHints = async () => {
  const hints = {
    standalone: Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone),
  };
  try {
    const uad = navigator.userAgentData;
    if (uad?.getHighEntropyValues) {
      const v = await Promise.race([
        uad.getHighEntropyValues(["model", "platformVersion"]),
        new Promise((r) => setTimeout(() => r(null), 600)),
      ]);
      if (v) Object.assign(hints, { model: v.model || "", platformVersion: v.platformVersion || "", mobile: Boolean(uad.mobile) });
    }
  } catch { /* ไม่รองรับ */ }
  return hints;
};

const SessionService = {
  async list() {
    const res = await API.get("/auth/sessions");
    return res.data.sessions || [];
  },
  async revoke(sid) {
    return (await API.delete(`/auth/sessions/${encodeURIComponent(sid)}`)).data;
  },
  async revokeOthers() {
    return (await API.post("/auth/sessions/revoke-others")).data;
  },
  /** แจ้ง server ตอนออกจากระบบ — ไม่ต้องรอ ไม่สนผล */
  logout() {
    // ⚠️ อ่าน token ตอนนี้เลย — ผู้เรียกลบ token ทิ้งทันทีหลังบรรทัดนี้ (interceptor ของ axios ทำงานช้ากว่า)
    const token = localStorage.getItem("token");
    if (!token) return Promise.resolve();
    return API.get("/auth/logout", { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  },
};

export default SessionService;
