import API from "../API/axiosInstance";

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
  /** ⚠️ กินเลขจริง — เรียกตอนกดออกเอกสารเท่านั้น ห้ามเรียกตอนเปิดกล่อง */
  async next(docType = "delivery") {
    const res = await API.post(`/doc-number/next`, { docType });
    return res.data;
  },
};

export default DocNumberService;
