// productService.js
import API from "../api/axiosInstance";
// ✅ ตรวจชนิด/ขนาด + บีบอัดรูป ทำที่ชั้น service เพื่อให้ทุกหน้าที่เรียกได้ประโยชน์เหมือนกันหมด
// ไม่ต้องไล่ใส่ทีละกล่องอัปโหลด (และไม่มีทางลืมจุดใดจุดหนึ่ง)
import { prepareUploadFile } from "@/shared/utils/fileUpload";

/**
 * เตรียม body ของคำขอที่ "อาจจะ" มีไฟล์แนบ
 *
 * 🐛 ที่แก้: เดิมส่ง FormData เสมอไม่ว่าจะแนบไฟล์หรือไม่ — แต่ multipart อ่านค่าออกมาเป็น req.body
 * ได้ก็ต่อเมื่อ route ฝั่ง server มี multer คั่นอยู่ (express.json อ่าน multipart ไม่ได้) พอ route ไหน
 * ไม่มี multer req.body จะว่าง "ทั้งก้อน" แล้วโผล่เป็น error ที่ชี้ไปผิดที่ เช่น "ยอดรับเงินต้องมากกว่า 0"
 * ทั้งที่กรอกยอดมาถูกต้อง — หาสาเหตุยากมากเพราะข้อความไม่ได้บอกว่าเป็นเรื่องการ parse
 * ✅ ไม่มีไฟล์ = ส่ง JSON ธรรมดา ซึ่งอ่านได้ทุกกรณี (multer ปล่อยผ่าน request ที่ไม่ใช่ multipart อยู่แล้ว
 * จึงใช้ได้กับ route ที่มีและไม่มี multer เหมือนกัน) · มีไฟล์ = multipart ตามเดิม
 * ⚠️ ต้องระบุ Content-Type เองตอนส่ง FormData เพราะ axiosInstance ตั้ง application/json ไว้เป็นค่าเริ่มต้น
 */
const withOptionalFile = async (fields, file, fileField) => {
  if (!file) return [fields, undefined];
  const prepared = await prepareUploadFile(file);
  if (!prepared.ok) throw new Error(prepared.message);
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) formData.append(k, v);
  });
  formData.append(fileField, prepared.file);
  return [formData, { headers: { "Content-Type": "multipart/form-data" } }];
};

const EventService = {
  async getEvents() {
    try {
      const response = await API.get(`/events`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user events:", error);
      throw error;
    }
  },
  /**
   * @param {object} [opts]
   * @param {"responsible"} [opts.scope] — โหมดเข้มงวด: เห็นเฉพาะงานที่ระบุตัวเองเป็น "ผู้รับผิดชอบหลัก"
   *   ไว้ตรงๆ (ไม่อิงทีมที่เข้างาน/ลูกทีม และไม่รวมงานที่ยังไม่มอบหมาย) — ใช้เฉพาะหน้า "ภาพรวมงาน"
   *   ตามที่ผู้ใช้ระบุ หน้าอื่นไม่ต้องส่งมา จะได้ตัวกรองเดิมทุกประการ (ดู GET /event-op ฝั่ง server)
   */
  async getEventOp(opts = {}) {
    try {
      const response = await API.get(`/events/event-op`, { params: opts.scope ? { scope: opts.scope } : {} });
      return response.data;
    } catch (error) {
      console.error("Error fetching user events:", error);
      throw error;
    }
  },

  async GetServiceReportFiles() {
    try {
      const response = await API.get(`/events/documents`);
      return response.data;
    } catch (error) {
      console.error("Error fetching service report files:", error);
      throw error;
    }
  },

  async GetEventById(id) {
    try {
      const response = await API.get(`/events/${id}`); // ดึง event ตาม id
      return response.data;
    } catch (error) {
      console.error("Error fetching event by ID:", error);
      throw error;
    }
  },

  async LineNotify(description) {
    try {
      await API.post(`/events/linenotify`, description);
    } catch (error) {
      console.error("Error fetching user linenotify:", error);
      throw error;
    }
  },
  async AddEvent(newEvent) {
    try {
      const response = await API.post(`/events`, newEvent); // เพิ่มข้อมูลสินค้า
      return response.data.events;
    } catch (error) {
      console.error("Error fetching Event:", error);
      throw error;
    }
  },

  async UpdateEvent(id, updatedEvent) {
    try {
      const response = await API.put(`/events/${id}`, updatedEvent); // เพิ่มข้อมูลสินค้า
      return response.data;
    } catch (error) {
      console.error("Error fetching user event:", error);
      throw error;
    }
  },

  async updateDocumentStatus(id, documentSent, documentFile) {
    try {
      const response = await API.put(`/events/${id}`, {
        documentSent,
        documentFile,
      });
      return response.data;
    } catch (error) {
      console.error("Error updating document status:", error);
      throw error;
    }
  },

  // ✅ Authorization header ผูกมากับทุก request อยู่แล้วผ่าน axios interceptor (axiosInstance.js
  // อ่าน token จาก localStorage ให้อัตโนมัติ) — เดิมดึง userData มาแค่เพื่อหยิบ .token มาใส่ header
  // ซ้ำอีกชั้น เป็น request เปล่าประโยชน์ที่ยิงก่อนทุกครั้ง (ดับเบิลจำนวน request ทั้งหมดของหน้านี้)
  async Upload(id, file, type, config = {}) {
    try {
      const prepared = await prepareUploadFile(file);
      if (!prepared.ok) throw new Error(prepared.message);

      const formData = new FormData();
      formData.append("file", prepared.file);
      formData.append("type", type);

      const response = await API.put(`/events/upload/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        ...config, // ✅ รองรับ onUploadProgress หรืออื่น ๆ
      });

      return response.data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  // ── การวางบิล / รับเงิน ──────────────────────────────────────────────
  // ⚠️ ห้ามส่งยอด VAT / หัก ณ ที่จ่าย / ยอดสุทธิ ขึ้นไปเอง — server คำนวณให้เสมอจากยอดก่อนภาษี
  // กับอัตราภาษี (ดู shared/utils/billing.js ฝั่ง server) ส่งขึ้นไปก็ไม่ถูกใช้
  async SaveBilling(id, payload) {
    const res = await API.put(`/events/${id}/billing`, payload);
    return res.data;
  },

  /**
   * บันทึกการรับเงิน 1 รายการ (แนบสลิป/ใบเสร็จไปด้วยได้ในคำขอเดียว)
   *
   * ⚠️ ไม่มีไฟล์แนบ = ส่ง JSON · มีไฟล์ = multipart (ดูเหตุผลที่ withOptionalFile ด้านบน)
   */
  async AddPayment(id, { slip, ...fields }) {
    const [body, config] = await withOptionalFile(fields, slip, "slip");
    const res = await API.post(`/events/${id}/billing/payment`, body, config);
    return res.data;
  },

  /**
   * แก้เลขที่ใบเสร็จ / แนบสลิปให้รายการรับเงินที่บันทึกไปแล้ว
   * ⚠️ แก้ยอดเงิน/วันที่ไม่ได้โดยตั้งใจ (ดูเหตุผลที่ route ฝั่ง server) — ถ้าจะแก้ต้องลบแล้วบันทึกใหม่
   */
  async UpdatePayment(id, paymentId, { slip, ...fields }) {
    const [body, config] = await withOptionalFile(fields, slip, "slip");
    const res = await API.patch(`/events/${id}/billing/payment/${paymentId}`, body, config);
    return res.data;
  },

  /** ให้ AI อ่านยอดจากรูปใบวางบิล — คืนค่ามาเติมในฟอร์มเท่านั้น ไม่ได้บันทึกอะไร */
  async ScanInvoice(id, fileId) {
    const res = await API.post(`/events/${id}/billing/scan`, { fileId });
    return res.data;
  },

  async BillingScanAvailability() {
    const res = await API.get("/events/billing/scan-availability");
    return res.data;
  },

  async DeletePayment(id, paymentId) {
    const res = await API.delete(`/events/${id}/billing/payment/${paymentId}`);
    return res.data;
  },

  async AddQuotationFollowUp(id, { note, file }) {
    try {
      const formData = new FormData();
      formData.append("note", note);
      if (file) {
        const prepared = await prepareUploadFile(file);
        if (!prepared.ok) throw new Error(prepared.message);
        formData.append("file", prepared.file);
      }

      const response = await API.put(`/events/${id}/quotation-followup`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data;
    } catch (error) {
      console.error("Error adding quotation follow-up:", error);
      throw error;
    }
  },

  async DeleteFile(id, type, fileId) {
    try {
      const response = await API.put(`/events/delete-file/${id}`, { type, fileId });
      return response.data;
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },
  // ✅ งาน "วางแผนล่วงหน้า" (ยังไม่ลงตาราง) — จัดกลุ่มตามเดือนที่ตั้งใจ (plannedMonth)
  async AddDraftEvent(draft) {
    try {
      const response = await API.post(`/events/draft`, draft);
      return response.data.event;
    } catch (error) {
      console.error("Error creating draft event:", error);
      throw error;
    }
  },

  /** @param {object} [opts] — รองรับ scope เดียวกับ getEventOp (ดูคำอธิบายที่นั่น) */
  async GetDraftEvents(opts = {}) {
    try {
      const response = await API.get(`/events/drafts`, { params: opts.scope ? { scope: opts.scope } : {} });
      return response.data;
    } catch (error) {
      console.error("Error fetching draft events:", error);
      throw error;
    }
  },

  async ScheduleDraftEvent(id, scheduleData) {
    try {
      const response = await API.put(`/events/${id}/schedule`, scheduleData);
      return response.data.event;
    } catch (error) {
      console.error("Error scheduling draft event:", error);
      throw error;
    }
  },

  async UpdateDraftEvent(id, draft) {
    try {
      const response = await API.put(`/events/${id}/draft`, draft);
      return response.data.event;
    } catch (error) {
      console.error("Error updating draft event:", error);
      throw error;
    }
  },

  // ✅ ย้ายงานที่ลงตารางแล้วกลับไปเป็นงานวางแผนล่วงหน้า (ยังไม่ลงตาราง)
  async UnscheduleEvent(id, plannedMonth) {
    try {
      const response = await API.put(`/events/${id}/unschedule`, { plannedMonth });
      return response.data.event;
    } catch (error) {
      console.error("Error unscheduling event:", error);
      throw error;
    }
  },

  // ✅ แก้ไขข้อมูลสัญญา (contractNo/quotationNo/contractStart/contractEnd/visitCount/jobValue)
  // พร้อมกันทุก "ครั้ง" ที่อยู่ในสัญญาเดียวกัน (contractGroupId) — กันข้อมูลเพี้ยนไม่ตรงกันระหว่างครั้ง
  async UpdateContractFields(contractGroupId, payload) {
    try {
      const response = await API.put(`/events/contract/${contractGroupId}`, payload);
      return response.data;
    } catch (error) {
      console.error("Error updating contract fields:", error);
      throw error;
    }
  },

  // ✅ รวมงานเก่า (ที่ยังไม่มี contractGroupId) ที่เลือกไว้ให้กลายเป็นสัญญาเดียวกัน — ดูรายละเอียด
  // การจัดเรียง "ครั้งที่" อัตโนมัติที่ PUT /events/contract/merge
  async MergeIntoContract(payload) {
    try {
      const response = await API.put(`/events/contract/merge`, payload);
      return response.data;
    } catch (error) {
      console.error("Error merging events into contract:", error);
      throw error;
    }
  },

  async DeleteContract(contractGroupId) {
    try {
      const response = await API.delete(`/events/contract/${contractGroupId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting contract:", error);
      throw error;
    }
  },

  // ✅ ย้าย "งานทั่วไป" (ยังไม่มี contractGroupId) เข้าเป็นครั้งที่ N ของสัญญาที่มีอยู่แล้ว —
  // ใช้แก้ไขกรณีจัดกลุ่มผิด (สร้างเป็นงานเดี่ยวทั้งที่จริงควรอยู่ในสัญญานี้)
  async AttachToContract(contractGroupId, payload) {
    try {
      const response = await API.put(`/events/contract/${contractGroupId}/attach`, payload);
      return response.data;
    } catch (error) {
      console.error("Error attaching event to contract:", error);
      throw error;
    }
  },

  // ✅ แยกครั้งที่ N ออกจากสัญญา กลับไปเป็นงานทั่วไปเดี่ยวๆ — ใช้แก้ไขกรณีจัดกลุ่มผิดในทิศทางกลับกัน
  async DetachFromContract(contractGroupId, payload) {
    try {
      const response = await API.put(`/events/contract/${contractGroupId}/detach`, payload);
      return response.data;
    } catch (error) {
      console.error("Error detaching round from contract:", error);
      throw error;
    }
  },

  // ✅ ย้าย "ครั้งที่ N" ไปเป็นครั้งที่อื่นในสัญญาเดียวกัน — ย้ายยกทั้งครั้ง (ทุก document ของครั้งนั้น
  // พร้อมกัน วันที่/สถานะ/ทีม/ประวัติงานติดไปครบ) ถ้าปลายทางมีครั้งอยู่แล้วจะ "สลับที่กัน" ไม่ใช่เขียนทับ
  async MoveContractRound(contractGroupId, payload) {
    try {
      const response = await API.put(`/events/contract/${contractGroupId}/move-round`, payload);
      return response.data;
    } catch (error) {
      console.error("Error moving contract round:", error);
      throw error;
    }
  },

  // ✅ แก้ไขบริษัท/โครงการ/ระบบ/ประเภทงาน พร้อมกันทุก document ของ "แถว" เดียวกัน (ทั้งสัญญาจริงและ
  // งานทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม) — ใช้กับการแก้ไข inline ในตาราง "ภาพรวมงาน"
  async UpdateBasicInfo(eventIds, payload) {
    try {
      const response = await API.put(`/events/basic-info`, { eventIds, ...payload });
      return response.data;
    } catch (error) {
      console.error("Error updating basic info:", error);
      throw error;
    }
  },

  // ✅ จัดหมวดหมู่งานที่ไม่มี contractGroupId — classification: "" (ยังไม่จัดกลุ่ม) / "general"
  // (งานทั่วไป) / "project" (งานโปรเจค) — ก่อนจัดจะโชว์เป็น "ยังไม่จัดกลุ่ม" เสมอ
  async ClassifyJob(id, classification) {
    try {
      const response = await API.put(`/events/${id}/classify`, { classification });
      return response.data;
    } catch (error) {
      console.error("Error classifying event:", error);
      throw error;
    }
  },

  // ✅ อนุมัติ/ไม่อนุมัติงานที่ช่าง/เซล (ใครก็ตามที่ไม่ใช่แอดมิน/manager) เป็นคนสร้าง — decision:
  // "approve" | "reject", reason ใช้เฉพาะตอน reject (ไม่บังคับ)
  async DecideApproval(id, decision, reason) {
    try {
      const response = await API.put(`/events/${id}/approval`, { decision, reason });
      return response.data;
    } catch (error) {
      console.error("Error deciding job approval:", error);
      throw error;
    }
  },

  async DeleteEvent(id) {
    try {
      await API.delete(`/events/${id}`); // ลบข้อมูลสินค้า
      console.log("Delete Event Success");
    } catch (error) {
      console.error("Error Delete event:", error);
      throw error;
    }
  },

  // เพิ่มฟังก์ชันสำหรับการสร้าง, อัปเดต, และลบสินค้าตามที่ต้องการ
};

export default EventService;
