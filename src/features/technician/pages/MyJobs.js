/**
 * MyJobs.js — v3 ("งานของฉัน" สำหรับช่าง)
 *
 * ✅ เดิมหน้านี้ผูกกับ WorkOrderService/คอลเลกชัน "workorders" ที่ไม่เคยถูกใช้งานจริงในระบบ
 *    (ว่างเปล่าเสมอ) ทำให้หน้านี้ใช้งานไม่ได้เลยตั้งแต่แรก — ระบบงานจริงคือ CalendarEvent
 *    ผ่าน EventService.getEventOp() (scope ตาม role ที่ backend อยู่แล้ว ช่างเห็นแค่งานตัวเอง)
 *    ตัวการ์ดงานใช้ TechnicianJobCard ตัวเดียวกับที่ใช้ในหน้า Operation จริง (เอกสารประจำงาน,
 *    ขอปิดงาน, สรุปงาน, คุยกับแอดมิน, ประวัติกิจกรรม) ครบทุกฟีเจอร์ ไม่ต้องมีหน้ารายละเอียดแยก
 * ✅ v3: งานที่เข้าหลายวันไม่ติดกัน (ผูกด้วย jobGroupId เดียวกัน) รวมเป็นการ์ดเดียวผ่าน
 *    JobGroupCard แทนที่จะแสดงแยกซ้ำกันทุกวัน (เทียบ pattern เดียวกับ JobGroupBlock ในหน้า
 *    Operation ฝั่งแอดมิน)
 */

import MultiDayGroupHeader, { multiDayCardSx } from "@/shared/ui/MultiDayGroup";
import { useEffect, useMemo, useState, useCallback, useRef, cloneElement } from "react";
import PdfBlobView from "@/shared/components/PdfBlobView";
import useRealtime from "@/shared/realtime/useRealtime";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import EventService from "@/shared/services/EventService";
import TechnicianJobCard from "../components/TechnicianJobPanel";
import { buildDaysPastDueMap, isFlaggedDays, isSevereDays, getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton,
  Chip, Skeleton, Dialog, DialogTitle, DialogContent, Divider,
  Tooltip, Button, Snackbar, Alert, LinearProgress, Collapse,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, WorkOutline, HourglassTop, TaskAlt, Warning,
  Download, Close, PictureAsPdf, FolderOpen, Image, Article, InsertDriveFile, AttachFile,
} from "@mui/icons-material";

// ─── file-type helpers (เหมือนกับที่ใช้ใน Operation/ServiceReportFiles) ───
const getFileType = (fileName = "") => {
  const lower = (fileName || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some((e) => lower.endsWith(e))) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "excel";
  return "unknown";
};

const fileTypeIcon = (fileName) => {
  const t = getFileType(fileName);
  if (t === "image") return <Image sx={{ color: "#10b981", fontSize: 18 }} />;
  if (t === "pdf") return <PictureAsPdf sx={{ color: "#ef4444", fontSize: 18 }} />;
  if (t === "word") return <Article sx={{ color: "#3b82f6", fontSize: 18 }} />;
  if (t === "excel") return <InsertDriveFile sx={{ color: "#10b981", fontSize: 18 }} />;
  return <AttachFile sx={{ color: "#6b7280", fontSize: 18 }} />;
};

const downloadFile = async (url, fileName) => {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error("Download error:", err);
    window.open(url, "_blank");
  }
};

// ─── FilePreviewDialog (ตัวเดียวกับ pattern ที่ใช้ทั่วแอป) ───
const FilePreviewDialog = ({ previewUrl, previewFileName, onClose }) => {
  const type = getFileType(previewFileName || previewUrl || "");
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    if (type !== "pdf" || !previewUrl) {
      setPdfBlobUrl(null);
      setPdfError(false);
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    setPdfLoading(true);
    setPdfError(false);
    fetch(previewUrl)
      .then((res) => { if (!res.ok) throw new Error("โหลดไฟล์ไม่สำเร็จ"); return res.blob(); })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setPdfError(true); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [type, previewUrl]);

  return (
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth fullScreen={window.matchMedia?.("(max-width:600px)").matches}
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        {fileTypeIcon(previewFileName)}
        <Typography fontWeight={700} noWrap flex={1}>{previewFileName || "ดูไฟล์"}</Typography>
        <Stack direction="row" gap={0.5}>
          {previewUrl && (
            <Tooltip title="ดาวน์โหลด">
              <IconButton onClick={() => downloadFile(previewUrl, previewFileName)}><Download /></IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {type === "image" && (
          <img src={getOptimizedImageUrl(previewUrl)} alt={previewFileName}
            style={{ maxWidth: "100%", maxHeight: 780, display: "block", margin: "0 auto", padding: 16 }} />
        )}
        {type === "pdf" && (
          pdfLoading ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <LinearProgress sx={{ mx: 6, mb: 2, borderRadius: 1 }} />
              <Typography variant="body2">กำลังโหลดไฟล์...</Typography>
            </Box>
          ) : pdfError ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <PictureAsPdf sx={{ fontSize: 48, opacity: 0.3 }} />
              <Typography>ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้</Typography>
              <Button size="small" variant="outlined" sx={{ mt: 1.5, borderRadius: 2 }}
                onClick={() => downloadFile(previewUrl, previewFileName)}>
                ดาวน์โหลดแทน
              </Button>
            </Box>
          ) : pdfBlobUrl ? (
            <PdfBlobView url={pdfBlobUrl} />
          ) : null
        )}
        {(type === "word" || type === "excel") && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
            width="100%" height="780px" style={{ border: "none" }} title="Office" />
        )}
        {type === "unknown" && (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <FolderOpen sx={{ fontSize: 48 }} />
            <Typography>ไม่สามารถแสดงไฟล์นี้ได้</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── JobGroupCard ───────────────────────────────────────────────────────
// ✅ งานที่เข้าหลายวันไม่ติดกัน (ผูกกันด้วย jobGroupId เดียวกัน หรือลายเซ็น company/site/title/
// system/team/time เดียวกันสำหรับงานเก่าก่อนมี jobGroupId) เดิมแสดงเป็นการ์ดแยกซ้ำกันทุกวัน —
// รวมเป็นการ์ดเดียว วันล่าสุด (sessions[0]) ถือเอกสารประจำงาน/ขอปิดงานของทั้งกลุ่ม ส่วนวันอื่นซ่อน
// ส่วนนี้ไป กดขยายเพื่อดู/จัดการแต่ละวันแยกกันได้ตามเดิม (เทียบ pattern เดียวกับ JobGroupBlock
// ที่ใช้ในหน้า Operation ฝั่งแอดมิน) — ใช้ getOverdueGroupKey จาก util กลางแทนฟังก์ชันซ้ำของตัวเอง
const JobGroupCard = ({ sessions, ...cardProps }) => {
  const [expanded, setExpanded] = useState(false);
  const isGrouped = sessions.length > 1;
  const anchorId = sessions[0]._id;

  const renderCard = (event) => (
    <TechnicianJobCard
      key={event._id}
      event={event}
      {...cardProps}
      hideDocuments={isGrouped && event._id !== anchorId}
      noOuterCard={isGrouped}
    />
  );

  if (!isGrouped) return renderCard(sessions[0]);

  const head = sessions[0];
  // ✅ หัวการ์ดงานหลายช่วงวัน — ตัวกลางชุดเดียวกับหน้าการดำเนินงาน (shared/ui/MultiDayGroup)
  return (
    <Box sx={multiDayCardSx(STATUS_DOT[head.status] || "#94a3b8")}>
      <MultiDayGroupHeader sessions={sessions} anchorId={anchorId} expanded={expanded} onToggle={() => setExpanded((p) => !p)}
        title={`${head.company && head.site ? `${head.company} · ${head.site}` : (head.company || head.site || "")}${head.title ? ` — ${head.title}` : ""}${head.system ? ` · ${head.system}` : ""}`} />
      <Collapse in={expanded}>
        {sessions.map((event, i) => (
          <Box key={event._id}>
            {i > 0 && <Divider />}
            {renderCard(event)}
          </Box>
        ))}
      </Collapse>
    </Box>
  );
};

/** สีสถานะงาน (แถบซ้ายการ์ดกลุ่ม) — ชุดเดียวกับหน้าการดำเนินงาน */
const STATUS_DOT = { กำลังรอยืนยัน: "#f59e0b", ยืนยันแล้ว: "#3b82f6", กำลังดำเนินการ: "#8b5cf6", ดำเนินการเสร็จสิ้น: "#10b981" };

// ─── กลุ่มสถานะแท็บ ───
const GROUPS = [
  { key: "active", label: "งานที่ต้องทำ", short: "ต้องทำ", icon: <WorkOutline sx={{ fontSize: 15 }} />, color: "#2563eb" },
  // ✅ เดิมไม่มีทางเห็นงานค้างแยกจากงานทั่วไปเลยในหน้านี้ (ต้องไปเปิดหน้า Operation ต่างหาก) —
  // เพิ่มแท็บนี้โดยตรง ใช้เกณฑ์เดียวกับหน้า Operation เป๊ะๆ (เลยกำหนด 1 สัปดาห์ขึ้นไป, งานหลายวัน
  // ไม่ติดกันนับเป็น 1 งาน คิดจากวันสุดท้าย) ผ่าน util กลาง
  { key: "overdue", label: "ค้างงาน", icon: <Warning sx={{ fontSize: 15 }} />, color: "#dc2626" },
  { key: "pending", label: "รอแอดมินอนุมัติ", short: "รออนุมัติ", icon: <HourglassTop sx={{ fontSize: 15 }} />, color: "#d97706" },
  { key: "closed", label: "เสร็จสิ้น", icon: <TaskAlt sx={{ fontSize: 15 }} />, color: "#059669" },
];

const matchesGroup = (event, group, daysPastDueMap) => {
  if (group === "pending") return event.closeRequested === true && event.status !== "ดำเนินการเสร็จสิ้น";
  if (group === "closed") return event.status === "ดำเนินการเสร็จสิ้น";
  const isOverdue = isFlaggedDays(daysPastDueMap.get(event._id)?.days);
  if (group === "overdue") return isOverdue;
  // active: งานที่ยืนยันแล้ว/กำลังดำเนินการ, ยังไม่ได้ขอปิด, และยังไม่เข้าเกณฑ์ค้างงาน
  // (ค้างงานแยกไปแท็บ "ค้างงาน" โดยเฉพาะแล้ว ไม่ต้องซ้ำสองที่)
  return ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(event.status) && !event.closeRequested && !isOverdue;
};

export default function MyJobs() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setLastRefreshed] = useState(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("active");
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");
  // ✅ perf: reference คงที่ — จำเป็นให้แถวไฟล์ที่ memo ไว้ (เทียบ props ด้วย reference) bail out
  // re-render ได้จริง ไม่งั้น prop นี้เปลี่ยนทุกครั้งที่ MyJobs re-render ทำให้ memo ไม่มีผลอะไรเลย
  const handlePreviewFile = useCallback((url, name) => { setPreviewUrl(url); setPreviewFileName(name); }, []);

  const [uploadingState, setUploadingState] = useState({ quotation: null, report: null, invoice: null, completion: null });
  const [uploadProgressState, setUploadProgressState] = useState({ quotation: 0, report: 0, invoice: 0, completion: 0 });
  const [isUploadingState, setIsUploadingState] = useState({ quotation: false, report: false, invoice: false, completion: false });

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ⚠️ detail = ขอ activityLog มาด้วย — การ์ดงานของช่าง (TechnicianJobPanel) แสดงประวัติ
      //    และหน้านี้บันทึกต่อท้ายด้วย ถ้าไม่ขอ ประวัติเดิมจะถูกเขียนทับหาย
      const res = await EventService.getEventOp({ detail: true });
      setEvents(res?.userEvents || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      if (!silent) setSnackbar({ open: true, msg: "โหลดรายการงานไม่สำเร็จ", severity: "error" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ✅ เรียลไทม์: แอดมินอนุมัติ/ตีกลับปิดงาน หรือมอบหมายงานใหม่ → เห็นทันที
  useRealtime("events", () => { fetchJobs(true); });

  // ✅ รีเฟรชอัตโนมัติทุก 15 วินาที เพื่อให้เห็นผลอนุมัติ/ไม่อนุมัติปิดงานจากแอดมินแบบ realtime
  useEffect(() => {
    const interval = setInterval(() => fetchJobs(true), 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // ✅ ต้องคำนวณจาก events ทั้งหมด (ไม่ผ่านตัวกรองอื่นมาก่อน) เพื่อให้ทุกกลุ่มงานครบทุกแถวเสมอ
  // เทียบ pattern เดียวกับหน้า Operation
  const daysPastDueMap = useMemo(() => buildDaysPastDueMap(events), [events]);

  // ✅ เดิมนับทุกแถว event ดิบ — งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) ตอนนี้อัปเดตทั้ง
  // กลุ่มพร้อมกันแล้ว (ขอปิดงาน/อนุมัติ/ไม่อนุมัติ ดู handleRequestClose, handleStatusUpdate) ทำให้
  // ตัวเลขบนแท็บเพี้ยนสูงกว่าจำนวนงานจริง (1 งานเข้า 3 วัน ขึ้นเป็น "3 งาน") — จัดกลุ่มด้วย
  // getOverdueGroupKey ก่อนนับ นับแค่ 1 ครั้งต่อกลุ่ม (ทุกวันในกลุ่มเดียวกันควรมีสถานะตรงกันอยู่แล้ว
  // จากการ propagate ทั้งกลุ่มทุกครั้งที่อัปเดต จึงใช้แถวไหนของกลุ่มมาตัดสินก็ได้ผลลัพธ์เดียวกัน)
  const groupCounts = useMemo(() => {
    const counts = { active: 0, overdue: 0, pending: 0, closed: 0 };
    const seen = new Set();
    events.forEach((e) => {
      const key = getOverdueGroupKey(e);
      if (seen.has(key)) return;
      seen.add(key);
      if (matchesGroup(e, "active", daysPastDueMap)) counts.active += 1;
      else if (matchesGroup(e, "overdue", daysPastDueMap)) counts.overdue += 1;
      else if (matchesGroup(e, "pending", daysPastDueMap)) counts.pending += 1;
      else if (matchesGroup(e, "closed", daysPastDueMap)) counts.closed += 1;
    });
    return counts;
  }, [events, daysPastDueMap]);

  // ✅ เปิดหน้ามาครั้งแรก ถ้าไม่มีงานที่ต้องทำแต่มีงานค้าง → พาไปหมวดค้างงานเลย (ไม่ต้องเจอหน้าว่างก่อน)
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || loading || !events.length) return;
    autoPickedRef.current = true;
    if (groupCounts.active === 0 && groupCounts.overdue > 0) setGroup("overdue");
  }, [loading, events.length, groupCounts]);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = events.filter((e) => {
      if (!matchesGroup(e, group, daysPastDueMap)) return false;
      if (!keyword) return true;
      return [e.company, e.site, e.title, e.system, e.docNo]
        .some((v) => (v || "").toLowerCase().includes(keyword));
    });
    return list.sort((a, b) =>
      group === "closed"
        ? moment(b.start).valueOf() - moment(a.start).valueOf()
        : moment(a.start).valueOf() - moment(b.start).valueOf()
    );
  }, [events, group, search, daysPastDueMap]);

  // ✅ รวมงานที่เข้าหลายวันไม่ติดกัน (jobGroupId/ลายเซ็นเดียวกัน) เป็นการ์ดเดียว แทนที่จะแยกโชว์
  // ซ้ำกันทุกวัน — ลำดับกลุ่มยึดตามลำดับที่ปรากฏครั้งแรกใน filteredJobs (เรียงตามวันที่อยู่แล้ว)
  const jobGroups = useMemo(() => {
    const map = new Map();
    filteredJobs.forEach((ev) => {
      const key = getOverdueGroupKey(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return [...map.values()].map((sessions) =>
      sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start))
    );
  }, [filteredJobs]);


  // ✅ (9 ต.ค. 2569) ขั้นตอนทำงาน — รับงาน/งานไม่เสร็จ ส่งงานทั้งกลุ่มกลับมา เอามาแทนในหน้าจอเลย
  const handlePatched = useCallback((docs) => {
    if (!docs?.length) return;
    const byId = new Map(docs.map((d) => [d._id, d]));
    setEvents((prev) => prev.map((e) => (byId.has(e._id) ? { ...e, ...byId.get(e._id), activityLog: e.activityLog } : e)));
  }, []);

  const handleInputUpdate = useCallback(async (id, data) => {
    try {
      await EventService.UpdateEvent(id, data);
      setEvents((prev) => prev.map((e) => (e._id !== id ? e : { ...e, ...data, activityLog: data.activityLog ?? e.activityLog })));
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "บันทึกไม่สำเร็จ", severity: "error" });
    }
  }, []);

  // ✅ งานที่เข้าหลายวัน (ผูกด้วย jobGroupId เดียวกัน) ถือเป็นงานเดียวกัน — action บางอย่าง (เช่น
  // "ขอปิดงาน") ต้องอัปเดตทุกวันในกลุ่มพร้อมกัน ไม่งั้นวันที่กดขอไปจะแยกไปอยู่คนละแท็บกับวันที่เหลือ
  // ในกลุ่มเดียวกัน (เทียบ pattern เดียวกับ getGroupEventIds/handleStatusUpdate ในหน้า Operation)
  const getGroupEventIds = useCallback((id) => {
    const target = events.find((e) => e._id === id);
    if (!target?.jobGroupId) return [id];
    return events.filter((e) => e.jobGroupId === target.jobGroupId).map((e) => e._id);
  }, [events]);

  const handleStatusUpdate = useCallback(async (id, updates) => {
    try {
      const ids = getGroupEventIds(id);
      await Promise.all(ids.map((gid) => EventService.UpdateEvent(gid, updates)));
      setEvents((prev) => prev.map((e) => (ids.includes(e._id) ? { ...e, ...updates } : e)));
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "บันทึกไม่สำเร็จ", severity: "error" });
    }
  }, [getGroupEventIds]);

  const handleDeleteFile = useCallback(async (eventId, type, fileId) => {
    try {
      await EventService.DeleteFile(eventId, type, fileId);
      setSnackbar({ open: true, msg: "ลบไฟล์เรียบร้อย", severity: "success" });
      await fetchJobs(true);
    } catch {
      setSnackbar({ open: true, msg: "ลบไฟล์ไม่สำเร็จ", severity: "error" });
    }
  }, [fetchJobs]);

  const handleFileUpload = useCallback(async (fileOrFiles, eventId, type) => {
    const files = Array.from(fileOrFiles?.length !== undefined ? fileOrFiles : [fileOrFiles]);
    if (files.length === 0) return;

    setUploadingState((p) => ({ ...p, [type]: eventId }));
    setIsUploadingState((p) => ({ ...p, [type]: true }));

    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgressState((p) => ({ ...p, [type]: 0 }));
        await EventService.Upload(eventId, files[i], type, {
          // ✅ เดิมหลอดโหลดขึ้น 100% ทันทีที่ส่งไฟล์ครบ (upload transfer เสร็จ) แต่เซิร์ฟเวอร์อาจยัง
          // ประมวลผลต่ออยู่ ทำให้หลอดโหลดเต็ม 100 ทั้งที่ยังไม่เสร็จจริง — จำกัดไว้ที่ 99% ระหว่างส่ง
          // ไฟล์ แล้วค่อยขึ้น 100% ตอน await resolve จริงๆ (เซิร์ฟเวอร์ตอบกลับมาแล้ว)
          onUploadProgress: (pe) => {
            const pct = Math.round((pe.loaded * 100) / pe.total);
            setUploadProgressState((p) => ({ ...p, [type]: Math.min(pct, 99) }));
          },
        });
        setUploadProgressState((p) => ({ ...p, [type]: 100 }));
        successCount++;
      }
      setSnackbar({ open: true, msg: `อัปโหลด ${successCount} ไฟล์เรียบร้อย`, severity: "success" });
    } catch (err) {
      // ✅ บอกเหตุผลจริง (ไฟล์ใหญ่เกิน · ชนิดไม่รองรับ · งานปิดแล้ว) — เดิมขึ้นแค่ "อัปโหลดไม่สำเร็จ"
      const d = err?.response?.data;
      const why = (typeof d === "string" ? d : d?.message || d?.error) || err?.message || "";
      setSnackbar({
        open: true,
        msg: (successCount > 0 ? `อัปโหลดสำเร็จ ${successCount}/${files.length} ไฟล์ (มีไฟล์ที่ล้มเหลว)` : "อัปโหลดไม่สำเร็จ") + (why ? ` — ${why}` : ""),
        severity: "error",
      });
    } finally {
      await fetchJobs(true);
      setIsUploadingState((p) => ({ ...p, [type]: false }));
      setTimeout(() => {
        setUploadingState((p) => ({ ...p, [type]: null }));
        setUploadProgressState((p) => ({ ...p, [type]: 0 }));
      }, 800);
    }
  }, [fetchJobs]);

  return (
    <Box sx={{ px: { xs: 0.5, sm: 1.5 }, pt: 1.5, pb: 4, maxWidth: 860, mx: "auto" }}>
      {/* ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "UI มองง่ายขึ้น มืออาชีพ แสดงผลครบ" — หัวกล่องขาวชุดเดียวกับทุกหน้า
          · สถานะ 4 หมวดเห็นครบทุกช่องโดยไม่ต้องเลื่อน (เดิมเป็นชิปเลื่อนแนวนอน หมวดท้ายถูกตัดหาย) */}
      {/* ✅ หัวหน้าแบบทักทาย + สรุปวันนี้ (ผู้ใช้: "สีสันจืด ไม่ดึงดูดให้ทำงาน") — พื้นน้ำเงินไล่เฉดอ่อนๆ ตัวหนังสือขาว */}
      {/* ✅ หัวหน้าโทนเรียบ (ผู้ใช้: "สีหัวข้อเด่นเกิน ดูรก") — ขาว ขอบเทา · สีเหลือแค่ไอคอนและข้อความสรุป */}
      <Stack direction="row" alignItems="center" spacing={1.25}
        sx={{ mb: 1.25, px: 1.5, py: 1.1, borderRadius: 3, bgcolor: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eff6ff", color: "#2563eb" }}>
          <WorkOutline sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: "#0f172a", lineHeight: 1.3 }}>งานของฉัน</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 600, color: !loading && groupCounts.overdue > 0 ? "#b91c1c" : "#64748b" }}>
            {loading ? "กำลังโหลดงาน…" : groupCounts.overdue > 0
              ? `มีงานค้าง ${groupCounts.overdue} งาน — ส่งงาน/ขอปิดงานให้เรียบร้อย`
              : groupCounts.active > 0 ? `วันนี้มีงานต้องทำ ${groupCounts.active} งาน` : "ไม่มีงานค้าง เยี่ยมมาก 🎉"}
          </Typography>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton size="small" onClick={() => fetchJobs()} sx={{ width: 36, height: 36, border: "1px solid #e2e8f0", borderRadius: 2.5, color: "#334155" }}>
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ✅ แถวเดียว 4 ช่อง — สีประจำหมวด (ฟ้า/แดง/ส้ม/เขียว) ที่ไอคอนและตัวเลข · ช่องที่เลือกพื้นอ่อน+ขอบสีหมวด */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75, mb: 1.25 }}>
        {GROUPS.map((g) => {
          const on = group === g.key;
          const n = groupCounts[g.key];
          return (
            <Box key={g.key} component="button" type="button" onClick={() => setGroup(g.key)} title={g.label}
              sx={{
                position: "relative", font: "inherit", cursor: "pointer", py: 0.6, px: 0.5, borderRadius: 2, minWidth: 0, textAlign: "center",
                bgcolor: on ? alpha(g.color, 0.1) : "#fff",
                border: `1.5px solid ${on ? g.color : "#e2e8f0"}`,
                boxShadow: on ? `0 2px 8px ${alpha(g.color, 0.18)}` : "none",
                transition: "all .15s",
              }}>
              {/* ไอคอน + ตัวเลขบรรทัดเดียว · ชื่อหมวดบรรทัดล่าง */}
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                <Box sx={{
                  width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  bgcolor: on ? g.color : alpha(g.color, 0.12), color: on ? "#fff" : g.color, "& svg": { fontSize: 12 },
                }}>{g.icon}</Box>
                <Typography sx={{ fontSize: "0.98rem", fontWeight: 900, lineHeight: 1.3, color: n > 0 ? g.color : "#94a3b8" }}>{n}</Typography>
              </Stack>
              <Typography noWrap sx={{ fontSize: "0.66rem", fontWeight: 800, color: on ? g.color : "#64748b", lineHeight: 1.3 }}>{g.short || g.label}</Typography>
              {g.key === "overdue" && n > 0 && !on && (
                <Box sx={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", bgcolor: "#dc2626", boxShadow: "0 0 0 3px rgba(220,38,38,.18)" }} />
              )}
            </Box>
          );
        })}
      </Box>

      <TextField
        fullWidth size="small" placeholder="ค้นหาโครงการ / ไซต์ / ประเภทงาน / เลขเอกสาร"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff", height: 40, fontSize: "0.9rem" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      {/* ── รายการงาน ── */}
      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 4 }} />
          ))}
        </Stack>
      ) : filteredJobs.length === 0 ? (
        /* ✅ กล่อง "ไม่มีงาน" เดิมมีแค่ไอคอนจางๆ กับข้อความบรรทัดเดียว แล้วเหลือพื้นที่ว่างทั้งหน้า —
           ช่างที่เปิดมาเจอหน้านี้จะไม่รู้ว่า "ไม่มีงานจริงๆ" หรือ "งานไปอยู่แท็บอื่น" (เช่นอยู่แท็บ
           งานที่ต้องทำ 0 งาน ทั้งที่มีงานค้าง 1 งานรออยู่ในอีกแท็บ) ✅ บอกให้ชัดว่าหมวดอื่นมีงานอยู่กี่งาน
           พร้อมปุ่มกดข้ามไปได้เลย และถ้าไม่เหลืองานที่ไหนจริงๆ ค่อยบอกว่าเคลียร์หมดแล้ว */
        (() => {
          const activeGroup = GROUPS.find((g) => g.key === group);
          // หมวดอื่นที่ยังมีงานค้างอยู่ (ไม่นับ "เสร็จสิ้น" — ไม่ใช่งานที่ต้องลงมือทำแล้ว)
          const otherWithJobs = GROUPS.filter(
            (g) => g.key !== group && g.key !== "closed" && groupCounts[g.key] > 0
          );
          return (
            <Box sx={{
              textAlign: "center", py: 5, px: 2, borderRadius: 3,
              border: "1px dashed #e2e8f0", bgcolor: "#fff",
            }}>
              {activeGroup?.icon && (
                <Box sx={{ opacity: 0.3, mb: 1, color: "text.disabled" }}>
                  {cloneElement(activeGroup.icon, { sx: { fontSize: 40 } })}
                </Box>
              )}
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                {search
                  ? "ไม่พบงานที่ตรงกับคำค้นหา"
                  : `ยังไม่มีงานในหมวด "${activeGroup?.label}"`}
              </Typography>

              {search ? (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                  ลองพิมพ์ชื่อโครงการ ไซต์ หรือเลขเอกสารให้สั้นลง
                </Typography>
              ) : otherWithJobs.length > 0 ? (
                <>
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5, mb: 1.25 }}>
                    แต่ยังมีงานรออยู่ในหมวดอื่น — กดเพื่อดูได้เลย
                  </Typography>
                  <Stack direction="row" gap={0.75} justifyContent="center" flexWrap="wrap">
                    {otherWithJobs.map((g) => (
                      <Chip
                        key={g.key}
                        icon={cloneElement(g.icon, { sx: { fontSize: 15 } })}
                        label={`${g.label} (${groupCounts[g.key]})`}
                        onClick={() => setGroup(g.key)}
                        sx={{
                          fontWeight: 700, fontSize: "0.72rem", cursor: "pointer",
                          bgcolor: alpha(g.color, 0.12), color: g.color,
                          "& .MuiChip-icon": { color: g.color },
                          "&:hover": { bgcolor: alpha(g.color, 0.22) },
                        }}
                      />
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                  เคลียร์งานครบแล้ว 🎉 งานใหม่ที่ถูกมอบหมายจะมาแสดงที่นี่
                </Typography>
              )}
            </Box>
          );
        })()
      ) : (
        <Stack spacing={2}>
          {jobGroups.map((sessions) => {
            // ✅ ในแท็บ "ค้างงาน" ให้เห็นความรุนแรงต่างกันชัดๆ ก่อนเปิดการ์ด (เทียบ pattern เดียวกับ
            // หน้า Operation) — เลย 1 สัปดาห์ = แจ้งเตือนสีเหลือง, เลย 2 สัปดาห์ = ค้างงานเต็มตัวสีแดง
            // ✅ เช็คซ้ำด้วย isFlaggedDays อีกชั้น (เทียบ pattern เดียวกับหน้า Operation) กันป้าย
            // "เลยกำหนด" ติดลบไร้ความหมายหลุดมาแสดง ถ้าวันที่คำนวณได้ดันไม่เข้าเกณฑ์ค้างจริง
            // ✅ แสดงทุกหมวด ไม่ใช่เฉพาะแท็บค้างงาน
            const daysPastDueRaw = group === "closed" ? null : daysPastDueMap.get(sessions[0]._id)?.days ?? null;
            const daysPastDue = isFlaggedDays(daysPastDueRaw) ? daysPastDueRaw : null;
            const severeOverdue = isSevereDays(daysPastDue);
            return (
              <Box key={sessions[0].jobGroupId || sessions[0]._id}>
                {daysPastDue !== null && (
                  <Stack direction="row" alignItems="center" gap={0.75}
                    sx={{
                      mb: -1.5, pb: 2, pt: 0.75, px: 1.75, borderRadius: "16px 16px 0 0",
                      bgcolor: severeOverdue ? "#fef2f2" : "#fffbeb", border: `1px solid ${severeOverdue ? "#fecaca" : "#fde68a"}`, borderBottom: 0,
                    }}>
                    <Warning sx={{ fontSize: 16, color: severeOverdue ? "#dc2626" : "#d97706" }} />
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: severeOverdue ? "#b91c1c" : "#92400e" }}>
                      {severeOverdue ? `ค้างงาน ${daysPastDue} วัน` : `เลยกำหนด ${daysPastDue} วัน`}
                    </Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: severeOverdue ? "#b91c1c" : "#92400e", opacity: 0.8 }}>· ส่งงาน/ขอปิดงานด้วย</Typography>
                  </Stack>
                )}
                <JobGroupCard
                  sessions={sessions}
                  onPatched={handlePatched}
                  onInputUpdate={handleInputUpdate}
                  onStatusUpdate={handleStatusUpdate}
                  onFileUpload={handleFileUpload}
                  onDeleteFile={handleDeleteFile}
                  onPreview={handlePreviewFile}
                  uploadingState={uploadingState}
                  isUploadingState={isUploadingState}
                  uploadProgressState={uploadProgressState}
                />
              </Box>
            );
          })}
        </Stack>
      )}

      <FilePreviewDialog
        previewUrl={previewUrl}
        previewFileName={previewFileName}
        onClose={() => { setPreviewUrl(null); setPreviewFileName(""); }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
