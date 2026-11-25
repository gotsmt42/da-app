/**
 * JobDocsDialog.js — เอกสารประจำงานของ "ครั้งที่ N" 1 ครั้ง (Service Report / ใบเสนอราคาเพิ่มเติม /
 * เอกสารการเงิน / ใบส่งมอบงาน) เปิดจากหน้าภาพรวมงานโดยไม่ต้องข้ามไปหน้าการดำเนินงาน
 *
 * 🔁 (25 พ.ย. 2569 ผู้ใช้: "ทำให้มันเป็นรูปแบบหน้าเอกสารงานแบบเดียวกันกับหน้าการดำเนินงาน ให้อัพเดตตรงกันทั้งหมด")
 *    เดิมกล่องนี้เขียนรายการเอกสารแบบย่อของตัวเอง (ลบไม่ได้ · แนบทีละไฟล์ · ไม่มีสถานะ "ไม่มี/ช่างยังไม่ยืนยัน/รอช่างตอบ"
 *    · สิทธิ์คนละชุด) → ใช้ชิ้นส่วนชุดเดียวกับการ์ดงานหน้าการดำเนินงาน (JobDocsBody → JobDocsSummaryCard + JobDocCards)
 *    แก้ที่ตัวกลางที่เดียว = ทุกหน้าเปลี่ยนตาม · สิทธิ์แนบ/ลบ = jobDocPermissions (กติกาเดียวกับ server)
 *    แนบ/ลบ/ติ๊ก บันทึกประวัติแบบเดียวกับหน้าการดำเนินงาน แล้วให้หน้าภาพรวมงานดึงข้อมูลใหม่ (ป้ายในตารางอัปเดตพร้อมกัน)
 *
 * ⚠️ 1 ครั้งมีได้หลายช่วงวัน (เข้างานไม่ต่อเนื่อง) — ไฟล์กระจายอยู่หลาย document:
 *    • แสดงรวมทุกช่วง (ติดป้ายวันที่ให้รู้ว่ามาจากช่วงไหน)
 *    • ไฟล์ใหม่/สถานะเอกสาร → ช่วงล่าสุด (= การ์ดหลักของกลุ่มในหน้าการดำเนินงาน ซึ่งยึดวันล่าสุดถือเอกสาร)
 *    • ลบ → document ที่ไฟล์นั้นอยู่จริง
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import MobileSheet from "@/shared/ui/MobileSheet";
import EventService from "@/shared/services/EventService";
import { JOB_DOC_TYPES } from "@/shared/utils/jobDocTypes";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { FilePreviewDialog } from "@/features/operation/components/OperationBoard";
import JobDocsBody from "@/features/documents/components/JobDocsBody";
import { uploadJobDocFiles, deleteJobDocFile, jobDocErrorText } from "@/shared/utils/jobDocActions";

const IDLE = { type: null, progress: 0, size: "" };
const APPLICABLE_KEYS = ["quotationApplicable", "invoiceApplicable", "completionApplicable"];
const fileKey = (f) => String(f?._id || f?.fileUrl || "");

/**
 * @param {Array}    props.roundVisits  งานทุก document ของครั้งนี้ (null/ว่าง = ปิดกล่อง)
 * @param {number}   props.round        เลขครั้งที่ (สัญญาจริง) · ไม่ส่ง = งานทั่วไป
 * @param {string}   props.title        บรรทัดรองสำรอง (ใช้เมื่อไม่มีข้อมูลงาน)
 * @param {Function} props.onChanged    ดึงข้อมูลหน้าใหม่ (await ได้) — กล่องนี้แสดงข้อมูลสดจาก roundVisits เสมอ
 * @param {object}   props.currentUser  ผู้ใช้ปัจจุบัน (สิทธิ์แนบ/ลบ · ช่าง = โมดูลเอกสารฝั่งช่าง)
 */
export default function JobDocsDialog({ roundVisits, round, title, onClose, onChanged, currentUser }) {
  const [up, setUp] = useState(IDLE);
  const [err, setErr] = useState("");
  const [overlay, setOverlay] = useState({}); // id → ค่าที่เพิ่งติ๊ก/เลือก (แสดงทันทีระหว่างรอข้อมูลใหม่)
  const [preview, setPreview] = useState({ url: null, name: "", gallery: null, index: null });

  // ⚠️ คงเนื้อหาชุดสุดท้ายไว้ระหว่างกล่องกำลังปิด (แผ่นเลื่อนลง) — ไม่ให้แผ่นว่างวาบ
  const open = Boolean(roundVisits?.length);
  const lastRef = useRef({ visits: [], round: null, title: "" });
  if (open) lastRef.current = { visits: roundVisits, round, title };
  const { visits: rawVisits, round: shownRound, title: shownTitle } = lastRef.current;

  const visits = useMemo(
    () => rawVisits.map((v) => (overlay[v._id] ? { ...v, ...overlay[v._id] } : v)),
    [rawVisits, overlay],
  );
  // ช่วงล่าสุด = ตัวถือเอกสารของครั้งนี้ (ตรงกับการ์ดหลักของกลุ่มในหน้าการดำเนินงาน)
  const anchor = useMemo(
    () => visits.reduce((a, v) => (!a || new Date(v.start) > new Date(a.start) ? v : a), null),
    [visits],
  );
  const multi = visits.length > 1;

  // งาน "รวมทั้งครั้ง" สำหรับวาด/นับความครบ — ไฟล์ทุกช่วง · ติ๊กยืนยัน SR/ตอบ "มี" จากช่วงไหนก็นับ
  const docEvent = useMemo(() => {
    if (!anchor || !multi) return anchor;
    const merged = { ...anchor };
    JOB_DOC_TYPES.forEach((t) => { merged[t.field] = visits.flatMap((v) => v[t.field] || []); });
    merged.documentSentReport = Boolean(anchor.documentSentReport)
      || visits.some((v) => v.documentSentReport && (v.reportFiles || []).length > 0);
    APPLICABLE_KEYS.forEach((k) => { if (visits.some((v) => v[k] === true)) merged[k] = true; });
    return merged;
  }, [anchor, visits, multi]);

  // ป้ายวันที่ต่อไฟล์ — เฉพาะครั้งที่เข้าหลายช่วง
  const tagOf = useMemo(() => {
    if (!multi) return null;
    const m = new Map();
    visits.forEach((v) => JOB_DOC_TYPES.forEach((t) => (v[t.field] || []).forEach((f) => m.set(fileKey(f), formatEventDateRange(v)))));
    return (f) => m.get(fileKey(f)) || null;
  }, [visits, multi]);

  const ownerOf = useCallback((type, fileId) => visits.find((v) =>
    (v[`${type}Files`] || []).some((f) => String(f._id) === String(fileId))) || anchor, [visits, anchor]);

  const onUpload = async (fileList, _id, type) => {
    if (!anchor?._id) return;
    setErr("");
    setUp({ type, progress: 0, size: "" });
    try {
      await uploadJobDocFiles(anchor._id, fileList, type, ({ percent, sizeText }) => setUp({ type, progress: percent, size: sizeText }));
    } catch (e) {
      setErr(jobDocErrorText(e, "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง"));
    }
    // ✅ รอข้อมูลใหม่ก่อนเลิกแถบอัปโหลด — ไฟล์ที่เพิ่งแนบโผล่ในกล่องทันที ไม่มีช่วงที่ "หายไป"
    await onChanged?.();
    setUp(IDLE);
  };
  const onDelete = async (_id, type, fileId) => {
    const owner = ownerOf(type, fileId);
    if (!owner?._id) return;
    setErr("");
    const file = (owner[`${type}Files`] || []).find((f) => String(f._id) === String(fileId)) || { _id: fileId };
    try { await deleteJobDocFile(owner._id, type, file); } catch (e) { setErr(jobDocErrorText(e, "ลบไฟล์ไม่สำเร็จ")); }
    await onChanged?.();
  };
  // ติ๊กยืนยัน Service Report · ตอบ "มี/ไม่มี" (ฝั่งช่าง) — แสดงทันที แล้วดึงข้อมูลจริงตาม
  const onInputUpdate = async (id, patch) => {
    setErr("");
    const { activityLog: _log, ...shown } = patch || {}; // ประวัติไม่ต้องวาด
    setOverlay((o) => ({ ...o, [id]: { ...(o[id] || {}), ...shown } }));
    try { await EventService.UpdateEvent(id, patch); } catch (e) { setErr(jobDocErrorText(e, "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง")); }
    await onChanged?.();
    setOverlay((o) => { const n = { ...o }; delete n[id]; return n; });
  };

  const heading = [shownRound ? `ครั้งที่ ${shownRound}` : null, anchor?.site].filter(Boolean).join(" · ") || "เอกสารประจำงาน";
  const subheading = anchor
    ? [anchor.company, [anchor.title, anchor.system].filter(Boolean).join(" "), visits.slice().sort((a, b) => new Date(a.start) - new Date(b.start)).map(formatEventDateRange).join(", ")]
      .filter(Boolean).join(" · ")
    : shownTitle;

  return (
    <>
      {/* ⚠️ zIndex 1300 (ชั้นเดียวกับ Dialog) — มือถือเปิดได้จากในกล่องรายละเอียดงาน (Dialog) ซึ่งแผ่นล่างชั้นปกติ (1200) จะไปอยู่ใต้
          · ชั้นเท่ากันแล้วตัวที่เปิดทีหลังอยู่บน (เมนู ⋮ / ดูไฟล์ ที่เปิดจากในแผ่นนี้ก็ยังลอยเหนือแผ่น) */}
      <MobileSheet open={open} onClose={onClose} maxWidth="sm" zIndex={1300} title={heading} subtitle={subheading}
        footer={(
          <Stack direction="row" justifyContent="flex-end">
            <Button onClick={onClose} variant="contained" disableElevation
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, px: 3, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
              เสร็จสิ้น
            </Button>
          </Stack>
        )}>
        {docEvent && (
          <Stack spacing={1.25} sx={{ p: { xs: 1.25, sm: 2 } }}>
            {err && <Alert severity="error" onClose={() => setErr("")} sx={{ py: 0 }}>{String(err)}</Alert>}
            <JobDocsBody layout="operation" event={docEvent} currentUser={currentUser} tagOf={tagOf}
              onUpload={onUpload} onDelete={onDelete} onInputUpdate={onInputUpdate}
              onPreview={(url, name, gallery, index) => setPreview({ url, name, gallery, index: Number.isInteger(index) ? index : null })}
              uploadOf={(t) => ({ uploading: up.type === t, progress: up.progress, size: up.size })} />
            {multi && (
              <Typography sx={{ px: 0.5, fontSize: "0.72rem", color: "#94a3b8" }}>
                ครั้งนี้เข้างาน {visits.length} ช่วง — แสดงเอกสารรวมทุกช่วง · ไฟล์ใหม่แนบไว้ที่ช่วงล่าสุด ({formatEventDateRange(anchor)}) เหมือนหน้าการดำเนินงาน
              </Typography>
            )}
          </Stack>
        )}
      </MobileSheet>
      <FilePreviewDialog previewUrl={preview.url} previewFileName={preview.name} previewIndex={preview.index} gallery={preview.gallery}
        onNavigate={(f, i) => setPreview((p) => ({ ...p, url: f.fileUrl, name: f.fileName || "", index: Number.isInteger(i) ? i : null }))}
        onClose={() => setPreview({ url: null, name: "", gallery: null, index: null })} />
    </>
  );
}
