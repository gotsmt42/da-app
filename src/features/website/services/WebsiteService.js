/**
 * WebsiteService — ระบบหลังบ้านของเว็บไซต์บริษัท (da-web)
 *
 * ✅ ผู้ใช้สั่ง: "ทำระบบหลังบ้านให้สมบูรณ์ เช่นแก้ไข และเพิ่มรายละเอียดสินค้า รูปภาพ หรือการแสดงผลต่างๆ"
 * ⚠️ ทุกอย่างที่บันทึกผ่าน service นี้ขึ้นเว็บสาธารณะทันที (server สั่งเว็บดึงใหม่หลังบันทึก)
 *    ยกเว้นรายการที่ตั้งเป็น "ฉบับร่าง" ซึ่งเห็นเฉพาะในหลังบ้าน
 * ⚠️ ปลายทางฝั่ง server: da-app-server/src/routes/web.js
 */
import API from "@/shared/api/axiosInstance";

/** ข้อความ error ภาษาไทยจาก server — ไม่มีก็ใช้ข้อความกลาง */
export const errorText = (err, fallback = "ทำรายการไม่สำเร็จ") =>
  err?.response?.data?.message || err?.response?.data?.error || fallback;

/** ลิงก์เว็บไซต์สาธารณะ — ใช้ทำปุ่ม "เปิดดูบนเว็บ" (ไม่ตั้ง = ไม่แสดงปุ่ม) */
export const WEBSITE_URL = String(import.meta.env.REACT_APP_WEBSITE_URL || "").replace(/\/+$/, "");

const WebsiteService = {
  /** @param {"products"|"projects"|"articles"|"brands"} col */
  async list(col) {
    const { data } = await API.get(`/web/admin/${col}`);
    return data.items || [];
  },
  async create(col, body) {
    const { data } = await API.post(`/web/admin/${col}`, body);
    return data.item;
  },
  async update(col, id, body) {
    const { data } = await API.put(`/web/admin/${col}/${id}`, body);
    return data.item;
  },
  async remove(col, id) {
    await API.delete(`/web/admin/${col}/${id}`);
  },

  /**
   * อัปโหลดรูป/PDF หนึ่งไฟล์ → { url, publicId, width, height, name, bytes }
   * ⚠️ ยังไม่ผูกกับรายการใด — ต้องกดบันทึกรายการด้วย รูปถึงจะขึ้นเว็บ
   */
  async upload(file, onProgress) {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await API.post("/web/admin/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });
    return data;
  },

  async getSettings() {
    const { data } = await API.get("/web/admin/settings");
    return data.settings;
  },
  async saveSettings(body) {
    const { data } = await API.put("/web/admin/settings", body);
    return data.settings;
  },

  // ── คำขอจากเว็บไซต์ ──
  async leads(params) {
    const { data } = await API.get("/web/leads", { params });
    return data;
  },
  async lead(id) {
    const { data } = await API.get(`/web/leads/${id}`);
    return data.lead;
  },
  async updateLead(id, body) {
    const { data } = await API.put(`/web/leads/${id}`, body);
    return data.lead;
  },
  async deleteLead(id) {
    await API.delete(`/web/leads/${id}`);
  },
  async leadSummary() {
    const { data } = await API.get("/web/leads/summary");
    return data;
  },
};

export default WebsiteService;
