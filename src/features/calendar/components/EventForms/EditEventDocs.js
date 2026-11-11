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
 */
import { useState } from "react";
import { Box, Stack, Typography, LinearProgress } from "@mui/material";
import MobileSheet from "@/shared/ui/MobileSheet";
import EventService from "@/shared/services/EventService";
import JobDocsSummaryCard from "@/shared/ui/JobDocsSummaryCard";
import { JOB_DOC_TYPES, isDocComplete } from "@/shared/utils/jobDocTypes";
import { FileUploadSection, FilePreviewDialog } from "@/features/operation/components/OperationBoard";
import { JobDocChecklist, jobDocProgress } from "@/features/technician/components/JobDocChecklist";
import { isRole, TECHNICIAN_ROLES } from "@/shared/utils/roles";
import { canEditJobFiles } from "@/shared/utils/jobDocPermissions";

const LABEL = { report: "Service Report", quotation: "ใบเสนอราคาเพิ่มเติม", invoice: "เอกสารการเงิน", completion: "ใบส่งมอบงาน" };

export default function EditEventDocs({ event: initial, currentUser, onChanged }) {
  const [event, setEvent] = useState(initial);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState({ type: null, progress: 0 });
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState({ url: null, name: "", gallery: null, index: null });
  // ฝั่งช่าง (ตัดสินแบบเดียวกับหน้าดำเนินงานที่แสดงการ์ดช่างให้ TECHNICIAN_ROLES)
  const techView = isRole(currentUser, ...TECHNICIAN_ROLES);

  const refresh = async () => {
    try {
      const res = await EventService.GetEventById(event._id);
      const ev = res?.event || res;
      if (ev?._id) setEvent((p) => ({ ...p, ...ev, start: p.start, end: p.end, allDay: p.allDay }));
    } catch { /* ใช้ข้อมูลเดิม */ }
    onChanged?.();
  };
  const onUpload = async (fileList, id, type) => {
    const files = Array.from(fileList?.length !== undefined ? fileList : [fileList]);
    if (!files.length) return;
    setErr("");
    setUp({ type, progress: 0 });
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop -- อัปโหลดทีละไฟล์ให้แถบความคืบหน้าถูกต้อง
        await EventService.Upload(id, file, type, {
          onUploadProgress: (pe) => setUp((u) => ({ ...u, progress: Math.min(99, Math.round((pe.loaded * 100) / (pe.total || 1))) })),
        });
      }
    } catch (e) {
      setErr(e?.response?.data?.message || "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setUp({ type: null, progress: 0 });
    await refresh();
  };
  // บันทึกสถานะเอกสาร (ติ๊กยืนยัน · มี/ไม่มี) + activityLog — แสดงผลทันที แล้วดึงข้อมูลจริงตาม
  const onInputUpdate = async (id, patch) => {
    setErr("");
    setEvent((p) => ({ ...p, ...patch }));
    try { await EventService.UpdateEvent(id, patch); } catch (e) { setErr(e?.response?.data?.message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    await refresh();
  };
  const onDelete = async (id, type, fileId) => {
    setErr("");
    try { await EventService.DeleteFile(id, type, fileId); } catch (e) { setErr(e?.response?.data?.message || "ลบไฟล์ไม่สำเร็จ"); }
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
          {techView && (() => {
            const pr = jobDocProgress(event);
            const all = pr.done === pr.total;
            const locked = !canEditJobFiles(currentUser, event, "report");
            return (
              <>
                <Box sx={{ px: 0.5 }}>
                  <Stack direction="row" alignItems="center" gap={1.25}>
                    <LinearProgress variant="determinate" value={(pr.done / pr.total) * 100}
                      sx={{ flex: 1, height: 6, borderRadius: 5, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: all ? "#16a34a" : "#2563eb", borderRadius: 5 } }} />
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: all ? "#15803d" : "#334155", whiteSpace: "nowrap" }}>{pr.done}/{pr.total} รายการ</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: "0.72rem", color: "#64748b", mt: 0.5 }}>
                    {event.status === "ดำเนินการเสร็จสิ้น" ? "งานนี้ปิดแล้ว — ดูเอกสารได้อย่างเดียว"
                      : locked ? "คุณไม่ได้อยู่ในงานนี้ — ดูเอกสารได้อย่างเดียว"
                        : all ? "เอกสารครบทุกรายการแล้ว" : `เหลืออีก ${pr.total - pr.done} รายการ จึงขอปิดงานได้ · * = ต้องมี`}
                  </Typography>
                </Box>
                <JobDocChecklist embedded event={event} isLocked={locked}
                  onInputUpdate={onInputUpdate} onFileUpload={onUpload} onDeleteFile={onDelete}
                  onPreview={(url, name, gallery, index) => setPreview({ url, name, gallery, index: Number.isInteger(index) ? index : null })}
                  uploadOf={(t) => ({ busy: up.type === t, progress: up.progress })} />
              </>
            );
          })()}
          {/* 🔁 (11 พ.ย. 2569 ผู้ใช้: "กดเปิดเอกสารประจำงานทำให้ดูดีกว่านี้ จัดการง่าย ดูง่าย ยังดูเล็กๆไปหน้าจอคอม")
              ฝั่งแอดมิน: แถบความคืบหน้า x/4 บนสุด · การ์ดเอกสารขนาดใหญ่ (roomy) · จอคอมวาง 2 คอลัมน์ เห็นครบ 4 ชนิดในจอเดียว */}
          {!techView && (() => {
            const done = JOB_DOC_TYPES.filter((t) => isDocComplete(event, t.key)).length;
            const all = done === JOB_DOC_TYPES.length;
            return (
              <Box sx={{ px: { xs: 0.5, sm: 0.25 } }}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <LinearProgress variant="determinate" value={(done / JOB_DOC_TYPES.length) * 100}
                    sx={{ flex: 1, height: 8, borderRadius: 5, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: all ? "#16a34a" : "#2563eb", borderRadius: 5 } }} />
                  <Typography sx={{ fontSize: { xs: "0.88rem", sm: "0.95rem" }, fontWeight: 800, color: all ? "#15803d" : "#0f172a", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    ครบ {done}/{JOB_DOC_TYPES.length} รายการ
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: { xs: "0.76rem", sm: "0.82rem" }, color: "#64748b", mt: 0.6 }}>
                  {all ? "เอกสารครบทุกรายการแล้ว" : "กด “แนบ” ที่การ์ด หรือลากไฟล์มาวางบนการ์ดได้เลย · PDF · รูป · Word · Excel"}
                </Typography>
              </Box>
            );
          })()}
          {!techView && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 1.25, md: 1.5 } }}>
          {JOB_DOC_TYPES.map((t) => (
            <Box key={t.key} sx={{ minWidth: 0 }}>
              <FileUploadSection
                card embedded roomy event={event}
                eventId={event._id} type={t.key} label={LABEL[t.key] || t.label}
                files={event[t.field]}
                applicable={t.key === "report" ? undefined : event[`${t.key}Applicable`]}
                onUpload={onUpload} onDelete={onDelete}
                onPreview={(url, name, gallery, index) => setPreview({ url, name, gallery, index: Number.isInteger(index) ? index : null })}
                uploading={up.type === t.key} progress={up.progress}
                currentUser={currentUser}
              />
            </Box>
          ))}
          </Box>
          )}
        </Stack>
      </MobileSheet>
      <FilePreviewDialog zIndex={20020} previewUrl={preview.url} previewFileName={preview.name} previewIndex={preview.index} gallery={preview.gallery}
        onNavigate={(f, i) => setPreview((p) => ({ ...p, url: f.fileUrl, name: f.fileName || "", index: Number.isInteger(i) ? i : null }))}
        onClose={() => setPreview({ url: null, name: "", gallery: null, index: null })} />
    </>
  );
}
