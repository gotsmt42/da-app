import API from "../api/axiosInstance";

/**
 * เลขที่เอกสารแบบเดินหน้าอย่างเดียว — ออกจากฝั่ง server เสมอ
 * (ดูเหตุผลว่าทำไมออกฝั่งเบราว์เซอร์ไม่ได้ ที่ da-app-server/models/DocCounter.js)
 */
const DocNumberService = {
  /** ✅ ดูเลขถัดไปโดย "ไม่กินเลข" — ใช้เติมให้ในฟอร์มตอนเปิดกล่องออกเอกสาร */
  async peek(docType = "delivery") {
    const res = await API.get(`/doc-number/peek`, { params: { docType } });
    return res.data;
  },
  /**
   * ⚠️ กินเลขจริง — เรียกตอนกดออกเอกสารเท่านั้น ห้ามเรียกตอนเปิดกล่อง
   * ✅ eventId — ต้องส่งไปด้วยเสมอถ้ามี เพราะผู้ใช้ที่ไม่ใช่ admin/manager จะออกเลขได้เฉพาะงานที่ตัวเอง
   * เกี่ยวข้องเท่านั้น backend ใช้ค่านี้ตรวจสิทธิ์ (ดู POST /doc-number/next)
   */
  async next(docType = "delivery", eventId) {
    const res = await API.post(`/doc-number/next`, { docType, eventId });
    return res.data;
  },
};

export default DocNumberService;
