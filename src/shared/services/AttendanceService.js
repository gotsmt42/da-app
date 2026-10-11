import API from "../api/axiosInstance";

/**
 * เช็คอินเข้างานของช่าง (10 ต.ค. 2569) — ดู routes/attendance.js ฝั่ง server
 * 🧹 11 ต.ค. 2569 ตัดเช็คเอาต์ออก (ผู้ใช้: ช่างต้องวิ่งหลายงาน ทำงานได้ยาก)
 * 🔒 ไม่มีการส่งเวลาจากเครื่องเลย — server ใช้เวลาของตัวเองตอนรับคำขอ
 * ทุกคำสั่งคืน serverNow มาด้วย ใช้เทียบนาฬิกาเครื่อง
 */
/**
 * ✅ (11 ต.ค. 2569 แก้แอพช้า) การ์ดงานทุกใบเรียก ofEvent ของตัวเองตอนแสดงผล — รวมคำขอที่เกิดในจังหวะเดียวกัน
 *    เป็นคำขอเดียว GET /attendance/events?ids=... (เดิมหน้าเดียวยิงหลายสิบคำขอพร้อมกัน)
 */
let batch = null;
const flushBatch = async () => {
  const cur = batch;
  batch = null;
  const ids = [...cur.keys()];
  try {
    const { data } = await API.get("/attendance/events", { params: { ids: ids.join(",") } });
    ids.forEach((id) => cur.get(id).forEach((w) => w.resolve({ attendance: data?.byEvent?.[id] || [], serverNow: data?.serverNow })));
  } catch (err) {
    ids.forEach((id) => cur.get(id).forEach((w) => w.reject(err)));
  }
};

const AttendanceService = {
  /** @param opts.group ทั้งงานหลายวัน · opts.site ขอพิกัดหน้างานด้วย */
  async ofEvent(eventId, { group = false, site = false } = {}) {
    if (!group && !site && eventId) {
      return new Promise((resolve, reject) => {
        if (!batch) {
          batch = new Map();
          setTimeout(flushBatch, 30);
        }
        const id = String(eventId);
        if (!batch.has(id)) batch.set(id, []);
        batch.get(id).push({ resolve, reject });
      });
    }
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
