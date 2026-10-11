import API from "../api/axiosInstance";

/**
 * เช็คอินเข้างานของช่าง (10 ต.ค. 2569) — ดู routes/attendance.js ฝั่ง server
 * 🧹 11 ต.ค. 2569 ตัดเช็คเอาต์ออก (ผู้ใช้: ช่างต้องวิ่งหลายงาน ทำงานได้ยาก)
 * 🔒 ไม่มีการส่งเวลาจากเครื่องเลย — server ใช้เวลาของตัวเองตอนรับคำขอ
 * ทุกคำสั่งคืน serverNow มาด้วย ใช้เทียบนาฬิกาเครื่อง
 */
const AttendanceService = {
  /** @param opts.group ทั้งงานหลายวัน · opts.site ขอพิกัดหน้างานด้วย */
  async ofEvent(eventId, { group = false, site = false } = {}) {
    const { data } = await API.get(`/attendance/event/${eventId}`, { params: { group: group ? 1 : undefined, site: site ? 1 : undefined } });
    return data;
  },
  async list(params = {}) {
    const { data } = await API.get("/attendance", { params });
    return data;
  },
  async checkIn(payload) {
    const { data } = await API.post("/attendance/check-in", payload);
    return data;
  },
  async requestCorrection(id, payload) {
    const { data } = await API.post(`/attendance/${id}/corrections`, payload);
    return data;
  },
  async decideCorrection(id, cid, payload) {
    const { data } = await API.put(`/attendance/${id}/corrections/${cid}`, payload);
    return data;
  },
};

export default AttendanceService;
