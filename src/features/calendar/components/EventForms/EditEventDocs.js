/**
 * EditEventDocs — เอกสารประจำงานในฟอร์มแก้ไขงานบนปฏิทิน (editEvent)
 *
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "อยากให้เปิดดู และตรวจเอกสารหน้านี้ได้เลย ไม่ต้องเด้งไปหน้าการดำเนินงาน")
 *    กล่องสรุป (ตัวเดียวกับการ์ดหน้าการดำเนินงาน) → กด "ดู / ตรวจเอกสาร" = กางช่องเอกสาร 4 ชนิดในฟอร์มนี้เลย
 *    ดูไฟล์ (เลื่อนดูไฟล์อื่นในช่องเดียวกันได้) · แนบ/ลบได้ตามสิทธิ์ (ชุดเดียวกับหน้าการดำเนินงาน)
 * ⚠️ อยู่ในกล่อง Swal — FileUploadSection โหมด embedded (ไม่เปิด Swal ซ้อน)
 * 🔁 (4 พ.ย. 2569 ผู้ใช้: "ตรวจเอกสารให้กดเปิดเด้งขึ้นมา ไม่ต้องเลื่อนลงดูยาก") เดิมกางลงในฟอร์ม (ต้องเลื่อนหา)
 *    → เปิดเป็นหน้าต่างเด้งขึ้น (MobileSheet: มือถือ = แผ่นเลื่อนขึ้น · คอม = กล่องกลางจอ) ซ้อนบนฟอร์มแก้ไขงาน
 * 🔁 (10 พ.ย. 2569 ผู้ใช้: "หน้าของช่างต้องทำให้เหมือนกับหน้าดำเนินงานด้วยทุกอย่าง ต้องบอกว่ามีเอกสารหรือไม่มี บางอย่างก็บังคับ")
 *    ช่าง/หัวหน้าช่าง = โมดูลเอกสารฝั่งช่างตัวเดียวกับหน้าดำเนินงาน/งานของฉัน (JobDocChecklist):
 *    Service Report บังคับ (แนบ + ติ๊กยืนยัน) · เอกสารอื่นตอบ "มี/ไม่มี" · ความคืบหน้า x/4 · ไม่ได้อยู่ในงาน/งานปิด = ดูอย่างเดียว
 *    แอดมิน/เจ้าหน้าที่ = ช่องเอกสารแบบตรวจ (FileUploadSection) เหมือนเดิม
 * 🔁 (25 พ.ย. 2569 ผู้ใช้: "...แบบเดียวกันกับหน้าการดำเนินงาน ให้อัพเดตตรงกันทั้งหมด")
 *    เนื้อหาย้ายไปตัวกลาง JobDocsBody (ใช้ร่วมกับกล่องเอกสารหน้าภาพรวมงาน) · แนบ/ลบบันทึกประวัติแบบเดียวกับหน้าการดำเนินงาน (jobDocActions)
 *    หน้านี้คง layout "roomy" (การ์ดใหญ่ 2 คอลัมน์บนจอคอม) ตามที่ผู้ใช้ขอไว้ 11 พ.ย.
 */
import { useState } from "react";
import { Stack, Typography } from "@mui/material";
import MobileSheet from "@/shared/ui/MobileSheet";
import EventService from "@/shared/services/EventService";
import JobDocsSummaryCard from "@/shared/ui/JobDocsSummaryCard";
import { FilePreviewDialog } from "@/features/operation/components/OperationBoard";
import JobDocsBody from "@/features/documents/components/JobDocsBody";
import { uploadJobDocFiles, deleteJobDocFile, jobDocErrorText } from "@/shared/utils/jobDocActions";

const IDLE = { type: null, progress: 0, size: "" };

export default function EditEventDocs({ event: initial, currentUser, onChanged }) {
  const [event, setEvent] = useState(initial);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(IDLE);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState({ url: null, name: "", gallery: null, index: null });

  const refresh = async () => {
    try {
      const res = await EventService.GetEventById(event._id);
      const ev = res?.event || res;
      if (ev?._id) setEvent((p) => ({ ...p, ...ev, start: p.start, end: p.end, allDay: p.allDay }));
    } catch { /* ใช้ข้อมูลเดิม */ }
    onChanged?.();
  };
  const onUpload = async (fileList, id, type) => {
    setErr("");
    setUp({ type, progress: 0, size: "" });
    try {
      await uploadJobDocFiles(id, fileList, type, ({ percent, sizeText }) => setUp({ type, progress: percent, size: sizeText }));
    } catch (e) {
      setErr(jobDocErrorText(e, "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง"));
    }
    await refresh();
    setUp(IDLE);
  };
  // บันทึกสถานะเอกสาร (ติ๊กยืนยัน · มี/ไม่มี) + activityLog — แสดงผลทันที แล้วดึงข้อมูลจริงตาม
  const onInputUpdate = async (id, patch) => {
    setErr("");
    setEvent((p) => ({ ...p, ...patch }));
    try { await EventService.UpdateEvent(id, patch); } catch (e) { setErr(jobDocErrorText(e, "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง")); }
    await refresh();
  };
  const onDelete = async (id, type, fileId) => {
    setErr("");
    const file = (event[`${type}Files`] || []).find((f) => String(f._id) === String(fileId)) || { _id: fileId };
    try { await deleteJobDocFile(id, type, file); } catch (e) { setErr(jobDocErrorText(e, "ลบไฟล์ไม่สำเร็จ")); }
    await refresh();
  };

  return (
    <>
      <JobDocsSummaryCard event={event} onOpen={() => setOpen(true)} openLabel="ดู / ตรวจเอกสาร"
        sx={{ mt: 0, mb: 1.5, borderRadius: "14px", borderColor: "#e6e9ef", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }} />
      <MobileSheet open={open} onClose={() => setOpen(false)} zIndex={20010} maxWidth="md"
        title="เอกสารประจำงาน"
        subtitle={[event.title, event.system, event.site].filter(Boolean).join(" · ")}>
        <Stack spacing={1.5} sx={{ p: { xs: 1.25, sm: 2.5 } }}>
          {err && <Typography sx={{ fontSize: "0.8rem", color: "#b91c1c", px: 0.5 }}>{err}</Typography>}
          {/* 🔁 (11 พ.ย. 2569 ผู้ใช้: "กดเปิดเอกสารประจำงานทำให้ดูดีกว่านี้ จัดการง่าย ดูง่าย ยังดูเล็กๆไปหน้าจอคอม")
              ฝั่งแอดมิน: แถบความคืบหน้า x/4 บนสุด · การ์ดเอกสารขนาดใหญ่ (roomy) · จอคอมวาง 2 คอลัมน์ เห็นครบ 4 ชนิดในจอเดียว */}
          <JobDocsBody embedded layout="roomy" event={event} currentUser={currentUser}
            onUpload={onUpload} onDelete={onDelete} onInputUpdate={onInputUpdate}
            onPreview={(url, name, gallery, index) => setPreview({ url, name, gallery, index: Number.isInteger(index) ? index : null })}
            uploadOf={(t) => ({ uploading: up.type === t, progress: up.progress, size: up.size })} />
        </Stack>
      </MobileSheet>
      <FilePreviewDialog zIndex={20020} previewUrl={preview.url} previewFileName={preview.name} previewIndex={preview.index} gallery={preview.gallery}
        onNavigate={(f, i) => setPreview((p) => ({ ...p, url: f.fileUrl, name: f.fileName || "", index: Number.isInteger(i) ? i : null }))}
        onClose={() => setPreview({ url: null, name: "", gallery: null, index: null })} />
    </>
  );
}
