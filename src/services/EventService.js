// productService.js
import API from "../API/axiosInstance";

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
  async getEventOp() {
    try {
      const response = await API.get(`/events/event-op`);
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
      const formData = new FormData();
      formData.append("file", file);
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

  async AddQuotationFollowUp(id, { note, file }) {
    try {
      const formData = new FormData();
      formData.append("note", note);
      if (file) formData.append("file", file);

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

  async GetDraftEvents() {
    try {
      const response = await API.get(`/events/drafts`);
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
