/**
 * JobDocsBody — เนื้อหา "เอกสารประจำงาน" ในหน้าต่างเอกสาร (ชุดเดียวทั้งแอป)
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ทำให้มันเป็นรูปแบบหน้าเอกสารงานแบบเดียวกันกับหน้าการดำเนินงาน ให้อัพเดตตรงกันทั้งหมด")
 *    ช่าง/หัวหน้าช่าง → JobDocChecklist (ตัวเดียวกับงานของฉัน/การ์ดช่างหน้าการดำเนินงาน: มี/ไม่มี · บังคับ · ติ๊กยืนยัน SR)
 *    คนอื่น → การ์ดเอกสาร JobDocCards (ตัวเดียวกับการ์ดงานหน้าการดำเนินงาน: สถานะ · ⋮ ดาวน์โหลด/พิมพ์/แชร์/ลบ · ลากไฟล์วาง)
 *      layout "operation" = กรอบสรุป JobDocsSummaryCard (x/4 · เช็กลิสต์) + การ์ด 1 คอลัมน์ — หน้าตาเดียวกับการ์ดงานหน้าการดำเนินงาน
 *      layout "roomy"     = แถบความคืบหน้า + การ์ดใหญ่ 2 คอลัมน์บนจอคอม — หน้าต่างเอกสารในหน้า Event (ผู้ใช้ขอ 11 พ.ย. 2569)
 *    ผู้เรียกถือข้อมูล/การบันทึกเอง (onUpload · onDelete · onInputUpdate) — ตัวนี้วาดอย่างเดียว
 *
 * @param uploadOf (type) => { uploading, progress, size }
 * @param embedded อยู่ในฟอร์ม Swal (หน้า Event) — ห้ามเปิด Swal ซ้อน (ดู FileUploadSection)
 * @param tagOf    ป้ายต่อไฟล์ (เช่น ช่วงวันที่ของครั้งที่เข้าหลายช่วง)
 */
import { Box, Stack, Typography, LinearProgress } from "@mui/material";
import JobDocsSummaryCard from "@/shared/ui/JobDocsSummaryCard";
import { JOB_DOC_TYPES, isDocComplete } from "@/shared/utils/jobDocTypes";
import { JobDocCards } from "@/features/operation/components/OperationBoard";
import { JobDocChecklist, jobDocProgress } from "@/features/technician/components/JobDocChecklist";
import { isRole, TECHNICIAN_ROLES } from "@/shared/utils/roles";
import { canEditJobFiles } from "@/shared/utils/jobDocPermissions";

const CLOSED = "ดำเนินการเสร็จสิ้น";

/** แถบความคืบหน้า x/N + คำอธิบายบรรทัดเดียว (ใช้ทั้งฝั่งช่างและแบบ roomy) */
function ProgressHead({ done, total, big = false, note }) {
  const all = done === total;
  return (
    <Box sx={{ px: 0.5 }}>
      <Stack direction="row" alignItems="center" gap={big ? 1.5 : 1.25}>
        <LinearProgress variant="determinate" value={(done / total) * 100}
          sx={{ flex: 1, height: big ? 8 : 6, borderRadius: 5, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: all ? "#16a34a" : "#2563eb", borderRadius: 5 } }} />
        <Typography sx={{ fontSize: big ? { xs: "0.88rem", sm: "0.95rem" } : "0.8rem", fontWeight: 800, color: all ? "#15803d" : big ? "#0f172a" : "#334155", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {big ? `ครบ ${done}/${total} รายการ` : `${done}/${total} รายการ`}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: big ? { xs: "0.76rem", sm: "0.82rem" } : "0.72rem", color: "#64748b", mt: big ? 0.6 : 0.5 }}>{note}</Typography>
    </Box>
  );
}

export default function JobDocsBody({
  event, currentUser, onUpload, onDelete, onInputUpdate, onPreview, uploadOf,
  embedded = false, layout = "operation", tagOf = null,
}) {
  // ฝั่งช่าง (ตัดสินแบบเดียวกับหน้าดำเนินงานที่แสดงการ์ดช่างให้ TECHNICIAN_ROLES)
  if (isRole(currentUser, ...TECHNICIAN_ROLES)) {
    const pr = jobDocProgress(event);
    const locked = !canEditJobFiles(currentUser, event, "report");
    return (
      <>
        <ProgressHead done={pr.done} total={pr.total}
          note={event.status === CLOSED ? "งานนี้ปิดแล้ว — ดูเอกสารได้อย่างเดียว"
            : locked ? "คุณไม่ได้อยู่ในงานนี้ — ดูเอกสารได้อย่างเดียว"
              : pr.done === pr.total ? "เอกสารครบทุกรายการแล้ว" : `เหลืออีก ${pr.total - pr.done} รายการ จึงขอปิดงานได้ · * = ต้องมี`} />
        <JobDocChecklist embedded={embedded} event={event} isLocked={locked}
          onInputUpdate={onInputUpdate} onFileUpload={onUpload} onDeleteFile={onDelete} onPreview={onPreview}
          uploadOf={(t) => { const u = uploadOf?.(t) || {}; return { busy: Boolean(u.uploading), progress: u.progress || 0 }; }} />
      </>
    );
  }

  const cards = (
    <JobDocCards event={event} currentUser={currentUser}
      onUpload={onUpload} onDelete={onDelete} onPreview={onPreview} uploadOf={uploadOf}
      embedded={embedded} roomy={layout === "roomy"} columns={layout === "roomy" ? 2 : 1}
      refQuotes={!embedded} tagOf={tagOf} />
  );

  if (layout === "roomy") {
    const done = JOB_DOC_TYPES.filter((t) => isDocComplete(event, t.key)).length;
    return (
      <>
        <ProgressHead big done={done} total={JOB_DOC_TYPES.length}
          note={done === JOB_DOC_TYPES.length ? "เอกสารครบทุกรายการแล้ว" : "กด “แนบ” ที่การ์ด หรือลากไฟล์มาวางบนการ์ดได้เลย · PDF · รูป · Word · Excel"} />
        {cards}
      </>
    );
  }

  // หน้าตาเดียวกับการ์ดงานหน้าการดำเนินงาน: กรอบสรุป x/4 + เช็กลิสต์ → การ์ดเอกสารอยู่ในกรอบเดียวกัน (เปิดไว้เสมอ)
  return (
    <JobDocsSummaryCard event={event} expanded sx={{ mt: 0 }}>
      {cards}
    </JobDocsSummaryCard>
  );
}
