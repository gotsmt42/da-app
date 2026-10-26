/**
 * EditEventDocs — เอกสารประจำงานในฟอร์มแก้ไขงานบนปฏิทิน (editEvent)
 *
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "อยากให้เปิดดู และตรวจเอกสารหน้านี้ได้เลย ไม่ต้องเด้งไปหน้าการดำเนินงาน")
 *    กล่องสรุป (ตัวเดียวกับการ์ดหน้าการดำเนินงาน) → กด "ดู / ตรวจเอกสาร" = กางช่องเอกสาร 4 ชนิดในฟอร์มนี้เลย
 *    ดูไฟล์ (เลื่อนดูไฟล์อื่นในช่องเดียวกันได้) · แนบ/ลบได้ตามสิทธิ์ (ชุดเดียวกับหน้าการดำเนินงาน)
 * ⚠️ อยู่ในกล่อง Swal — FileUploadSection โหมด embedded (ไม่เปิด Swal ซ้อน)
 */
import { useState } from "react";
import { Box, Stack, Collapse, Typography } from "@mui/material";
import EventService from "@/shared/services/EventService";
import JobDocsSummaryCard from "@/shared/ui/JobDocsSummaryCard";
import { JOB_DOC_TYPES } from "@/shared/utils/jobDocTypes";
import { FileUploadSection, FilePreviewDialog } from "@/features/operation/components/OperationBoard";

const LABEL = { report: "Service Report", quotation: "ใบเสนอราคาเพิ่มเติม", invoice: "ใบวางบิล", completion: "ใบส่งมอบงาน" };

export default function EditEventDocs({ event: initial, currentUser, onChanged }) {
  const [event, setEvent] = useState(initial);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState({ type: null, progress: 0 });
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState({ url: null, name: "", gallery: null });

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
  const onDelete = async (id, type, fileId) => {
    setErr("");
    try { await EventService.DeleteFile(id, type, fileId); } catch (e) { setErr(e?.response?.data?.message || "ลบไฟล์ไม่สำเร็จ"); }
    await refresh();
  };

  return (
    <>
      <JobDocsSummaryCard event={event} onOpen={() => setOpen((v) => !v)} openLabel={open ? "ซ่อนเอกสาร" : "ดู / ตรวจเอกสาร"} sx={{ mt: 0, mb: 1.5 }} />
      <Collapse in={open} unmountOnExit>
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {err && <Typography sx={{ fontSize: "0.8rem", color: "#b91c1c", px: 0.5 }}>{err}</Typography>}
          {JOB_DOC_TYPES.map((t) => (
            <Box key={t.key}>
              <FileUploadSection
                card embedded event={event}
                eventId={event._id} type={t.key} label={LABEL[t.key] || t.label}
                files={event[t.field]}
                applicable={t.key === "report" ? undefined : event[`${t.key}Applicable`]}
                onUpload={onUpload} onDelete={onDelete}
                onPreview={(url, name, gallery) => setPreview({ url, name, gallery })}
                uploading={up.type === t.key} progress={up.progress}
                currentUser={currentUser}
              />
            </Box>
          ))}
        </Stack>
      </Collapse>
      <FilePreviewDialog previewUrl={preview.url} previewFileName={preview.name} gallery={preview.gallery}
        onNavigate={(f) => setPreview((p) => ({ ...p, url: f.fileUrl, name: f.fileName || "" }))}
        onClose={() => setPreview({ url: null, name: "", gallery: null })} />
    </>
  );
}
