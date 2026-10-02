/**
 * PurchaseService — เรียก /api/purchase (ใบขอซื้อสินค้า PR)
 * ⚠️ ส่ง multipart เฉพาะตอนมีไฟล์ · ฟิลด์อาร์เรย์/อ็อบเจกต์ต้อง JSON.stringify ก่อนใส่ FormData
 */
import API from "@/shared/api/axiosInstance";
import { prepareUploadFile } from "@/shared/utils/fileUpload";

const UPLOAD_TIMEOUT = 120_000;

/** @param {Array<{file: File, kind: string}>} files */
const buildBody = async (fields, files = []) => {
  const accepted = [];
  const rejected = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop -- บีบอัดทีละไฟล์ ไม่ให้กิน RAM พร้อมกัน
    const r = await prepareUploadFile(f.file);
    if (r.ok) accepted.push({ file: r.file, kind: f.kind || "other" }); else rejected.push({ name: f.file?.name, message: r.message });
  }
  if (!accepted.length) return { body: fields, config: undefined, rejected };
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === "object" ? JSON.stringify(v) : v);
  });
  accepted.forEach(({ file, kind }) => { fd.append("files", file); fd.append("fileKinds", kind); });
  return { body: fd, config: { headers: { "Content-Type": "multipart/form-data" }, timeout: UPLOAD_TIMEOUT }, rejected };
};

const send = async (method, url, fields, files) => {
  const { body, config, rejected } = await buildBody(fields, files);
  const res = await API[method](url, body, config);
  return { request: res.data.request, rejected };
};

const PurchaseService = {
  async summary() { return (await API.get("/purchase/summary")).data; },
  async suggest() { return (await API.get("/purchase/suggest")).data; },
  async list(params = {}) { return (await API.get("/purchase", { params })).data.requests || []; },
  async get(id) { return (await API.get(`/purchase/${id}`)).data.request; },
  create: (fields, files) => send("post", "/purchase", fields, files),
  update: (id, fields, files) => send("put", `/purchase/${id}`, fields, files),
  order: (id, fields, files) => send("post", `/purchase/${id}/order`, fields, files),
  receive: (id, fields, files) => send("post", `/purchase/${id}/receive`, fields, files),
  addFiles: (id, files) => send("post", `/purchase/${id}/files`, {}, files),
  async review(id, note = "", useSignature = true) { return (await API.post(`/purchase/${id}/review`, { note, useSignature })).data.request; },
  async approve(id, note = "", useSignature = true) { return (await API.post(`/purchase/${id}/approve`, { note, useSignature })).data.request; },
  /** ลายเซ็นที่ผนึกในใบ — ล้มเหลวคืน {} (ยังพิมพ์ได้ เว้นช่องเซ็นมือ) */
  async signatures(id) {
    try { return (await API.get(`/purchase/${id}/signatures`)).data.signatures || {}; } catch { return {}; }
  },
  async reject(id, reason) { return (await API.post(`/purchase/${id}/reject`, { reason })).data.request; },
  async cancel(id, reason = "") { return (await API.post(`/purchase/${id}/cancel`, { reason })).data.request; },
  async removeFile(id, fileId) { return (await API.delete(`/purchase/${id}/files/${fileId}`)).data.request; },
};

export const errorText = (err, fallback = "ทำรายการไม่สำเร็จ") =>
  err?.response?.data?.message || (err?.code === "ECONNABORTED" ? "เครือข่ายช้าเกินไป ลองใหม่อีกครั้ง" : "") || err?.message || fallback;

export default PurchaseService;
