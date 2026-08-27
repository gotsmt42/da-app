/**
 * DispatchService — เรียก /api/dispatch (ใบมอบหมายงานข้ามแผนก)
 *
 * ⚠️ multipart เฉพาะตอนมีไฟล์จริงๆ (เหตุผลเดียวกับ SalesService/EventService)
 * ⚠️ ฟิลด์ที่เป็น array (checklist / parts / userIds) ต้อง JSON.stringify ก่อนใส่ FormData —
 * FormData แปลงทุกค่าเป็นสตริง ถ้า append array ตรงๆ จะได้ "[object Object]" ฝั่ง server
 */
import API from "@/shared/api/axiosInstance";
import { prepareUploadFiles } from "@/shared/utils/fileUpload";

const DispatchService = {
  /** ใบทั้งหมดที่เรามีสิทธิ์เห็น (server กรองให้ตามบทบาท) */
  async list(params = {}) {
    const res = await API.get("/dispatch", { params });
    return res.data.dispatches || [];
  },

  async summary() {
    const res = await API.get("/dispatch/summary");
    return res.data;
  },

  /** รายชื่อคนที่มอบหมายงานได้ (เฉพาะคนที่มีสิทธิ์จ่ายงานเรียกได้) */
  async assignable() {
    const res = await API.get("/dispatch/assignable");
    return res.data.users || [];
  },

  async get(id) {
    const res = await API.get(`/dispatch/${id}`);
    return res.data.dispatch;
  },

  /**
   * ส่งคำขอมอบหมายงาน (แนบไฟล์ได้หลายไฟล์ในคำขอเดียว)
   * @returns {{dispatch: object, rejected: Array}} rejected = ไฟล์ที่ถูกปฏิเสธพร้อมเหตุผล
   */
  /**
   * @param {Array<{file: File, docType: string}>} files ไฟล์พร้อม "ชนิดเอกสาร"
   * ⚠️ multipart แนบ metadata กับไฟล์แต่ละใบตรงๆ ไม่ได้ — ส่ง docTypes[] เป็นอาร์เรย์คู่ขนาน
   * ที่เรียงตรงกับ files[] ฝั่ง server อ่านด้วย docTypeAt(req, i) ⚠️ ถ้าไฟล์ใบไหนถูกปฏิเสธตอน
   * ตรวจชนิด/ขนาด ต้องตัด docType ของใบนั้นออกด้วย ไม่งั้นลำดับจะเลื่อนทั้งชุดแล้วป้ายสลับกันหมด
   */
  async create({ files, checklist, parts, ...fields }) {
    const accepted = [];
    const docTypes = [];
    let rejected = [];
    if (files?.length) {
      const raw = files.map((f) => (f instanceof File ? { file: f, docType: "other" } : f));
      const prepared = await prepareUploadFiles(raw.map((r) => r.file));
      rejected = prepared.rejected;
      const rejectedNames = new Set(prepared.rejected.map((r) => r.name || r.file?.name));
      raw.forEach((r) => { if (!rejectedNames.has(r.file.name)) docTypes.push(r.docType || "other"); });
      accepted.push(...prepared.accepted);
    }

    let body = { ...fields, checklist, parts };
    let config;
    if (accepted.length) {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, v);
      });
      // ⚠️ array ต้อง stringify — FormData ทำให้เป็น "[object Object]" ถ้าใส่ตรงๆ
      if (checklist?.length) fd.append("checklist", JSON.stringify(checklist));
      if (parts?.length) fd.append("parts", JSON.stringify(parts));
      accepted.forEach((f, i) => {
        fd.append("files", f);
        fd.append("docTypes", docTypes[i] || "other");
      });
      body = fd;
      config = { headers: { "Content-Type": "multipart/form-data" } };
    }

    const res = await API.post("/dispatch", body, config);
    return { dispatch: res.data.dispatch, rejected };
  },

  /** มอบหมาย/แก้ผู้รับงาน — ส่ง userIds ทั้งชุดเสมอ (คนที่หายไปจากชุด = ถูกถอดออก) */
  async assign(id, userIds) {
    const res = await API.post(`/dispatch/${id}/assign`, { userIds });
    return res.data.dispatch;
  },

  /** ผู้รับงานอัปเดตสถานะของตัวเอง */
  async setAssigneeStatus(id, userId, { status, note, declineReason, file }) {
    let body = { status, note, declineReason };
    let config;
    if (file) {
      const prepared = await prepareUploadFiles([file]);
      if (prepared.rejected.length) throw new Error(prepared.rejected[0].message);
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v);
      });
      fd.append("file", prepared.accepted[0]);
      body = fd;
      config = { headers: { "Content-Type": "multipart/form-data" } };
    }
    const res = await API.patch(`/dispatch/${id}/assignees/${userId}/status`, body, config);
    return res.data.dispatch;
  },

  async toggleChecklist(id, itemId, done) {
    const res = await API.patch(`/dispatch/${id}/checklist/${itemId}`, { done });
    return res.data.dispatch;
  },

  async addFile(id, file, docType = "other") {
    const prepared = await prepareUploadFiles([file]);
    if (prepared.rejected.length) throw new Error(prepared.rejected[0].message);
    const fd = new FormData();
    fd.append("file", prepared.accepted[0]);
    fd.append("docType", docType);
    const res = await API.post(`/dispatch/${id}/files`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.dispatch;
  },

  /**
   * อนุมัติ = ลงแผนงานใน /event ให้เลยในคำขอเดียว ไม่ใช่แค่เปลี่ยนสถานะ
   * (ถ้าแยก 2 ขั้น จะเกิดใบที่ 'อนุมัติแล้ว' แต่ไม่มีวันนัด ซึ่งไม่ต่างจากยังไม่อนุมัติในสายตาลูกค้า)
   */
  async approve(id, { start, end, responsiblePersonId }) {
    const res = await API.post(`/dispatch/${id}/approve`, { start, end, responsiblePersonId });
    return res.data;
  },

  /** ไม่อนุมัติ — เหตุผลบังคับกรอก (ฝั่ง server ปฏิเสธ 400 ถ้าว่าง) */
  async reject(id, reason) {
    const res = await API.post(`/dispatch/${id}/reject`, { reason });
    return res.data.dispatch;
  },

  /** ผู้แจ้งแก้ไขแล้วส่งตรวจใหม่ — ใบเดิม ไม่ใช่ใบใหม่ (เลขที่ใบและประวัติจึงต่อเนื่อง) */
  async resubmit(id, fields = {}) {
    const res = await API.post(`/dispatch/${id}/resubmit`, fields);
    return res.data.dispatch;
  },

  /** ⚠️ ยกเลิก ไม่ใช่ลบ — ใบที่จ่ายงานไปแล้วต้องเหลือร่องรอย (ดูเหตุผลที่ routes/dispatch.js) */
  async cancel(id, reason) {
    const res = await API.post(`/dispatch/${id}/cancel`, { reason });
    return res.data.dispatch;
  },
};

export default DispatchService;
