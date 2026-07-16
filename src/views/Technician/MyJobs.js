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

import { useEffect, useMemo, useState, useCallback, cloneElement } from "react";
import moment from "moment";
import "moment/locale/th";
import EventService from "../../services/EventService";
import TechnicianJobCard from "../../components/Technician/TechnicianJobPanel";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton,
  Chip, Skeleton, Dialog, DialogTitle, DialogContent, Divider,
  Tooltip, Button, Snackbar, Alert, LinearProgress, Collapse,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, WorkOutline, HourglassTop, TaskAlt,
  Download, Close, PictureAsPdf, FolderOpen, Image, Article, InsertDriveFile, AttachFile,
  CalendarMonth, ExpandMore, ExpandLess,
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
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth
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
          <img src={previewUrl} alt={previewFileName}
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
            <iframe src={pdfBlobUrl} width="100%" height="780px" style={{ border: "none" }} title="PDF" />
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
// ที่ใช้ในหน้า Operation ฝั่งแอดมิน)
const getJobSignature = (ev) => {
  if (ev.jobGroupId) return `gid:${ev.jobGroupId}`;
  return ["company", "site", "title", "system", "team", "time"]
    .map((k) => (ev[k] || "").toString().trim().toLowerCase())
    .join("|");
};

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
  const sortedByStart = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const latestEndSession = sessions.reduce((latest, s) =>
    new Date(s.end || s.start) > new Date(latest.end || latest.start) ? s : latest
  );
  const rangeStart = moment(sortedByStart[0].start).locale("th").format("DD MMM");
  const rangeEnd = moment(latestEndSession.end || latestEndSession.start)
    .subtract(latestEndSession.allDay ? 1 : 0, "days")
    .locale("th").format("DD MMM YYYY");

  // ✅ นับ "จำนวนวันเข้างานจริง" รวมทุกวันในแต่ละช่วง ไม่ใช่แค่จำนวนช่วง/แถวที่ลงไว้
  const dayEnd = (s) => moment(s.end || s.start).subtract(s.allDay ? 1 : 0, "days").startOf("day");
  const totalWorkDays = sessions.reduce((sum, s) => {
    const days = dayEnd(s).diff(moment(s.start).startOf("day"), "days") + 1;
    return sum + Math.max(days, 1);
  }, 0);

  return (
    <Box sx={{
      borderRadius: 4, border: "1px solid", borderColor: alpha("#8b5cf6", 0.3),
      bgcolor: "background.paper", overflow: "hidden",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    }}>
      <Box
        onClick={() => setExpanded((p) => !p)}
        sx={{
          p: 2, cursor: "pointer", background: alpha("#8b5cf6", 0.04),
          borderBottom: expanded ? "1px solid" : "none", borderColor: alpha("#8b5cf6", 0.2),
        }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <CalendarMonth sx={{ fontSize: 18, color: "#8b5cf6" }} />
          <Typography variant="body2" fontWeight={700} color="#8b5cf6">
            {head.company && head.site ? `${head.company} · ${head.site}` : (head.company || head.site)}
            {head.title && ` — ${head.title}`}{head.system && ` · ${head.system}`}
          </Typography>
          <Chip label={`เข้างาน ${totalWorkDays} วัน`} size="small"
            sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha("#8b5cf6", 0.15), color: "#8b5cf6" }} />
          <Typography variant="caption" color="text.secondary">📅 {rangeStart} – {rangeEnd}</Typography>
          <IconButton size="small" sx={{ ml: "auto" }} onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}>
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Stack>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          {sortedByStart.map((s) => {
            const sStart = moment(s.start);
            const sEnd = dayEnd(s);
            const chipLabel = sStart.isSame(sEnd, "day")
              ? sStart.locale("th").format("DD MMM")
              : `${sStart.locale("th").format("DD")}-${sEnd.locale("th").format("DD MMM")}`;
            return (
              <Chip key={s._id} label={chipLabel} size="small"
                variant={s._id === anchorId ? "filled" : "outlined"}
                sx={{
                  height: 20, fontSize: "0.68rem", borderColor: alpha("#8b5cf6", 0.35),
                  bgcolor: s._id === anchorId ? alpha("#8b5cf6", 0.2) : "transparent",
                  color: "#8b5cf6", fontWeight: s._id === anchorId ? 700 : 400,
                }} />
            );
          })}
        </Stack>
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
          📄 เอกสารประจำงาน/ขอปิดงาน ใช้ร่วมกันที่วันที่ {moment(head.start).locale("th").format("DD MMM")} (วันล่าสุด)
        </Typography>
      </Box>
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

// ─── กลุ่มสถานะแท็บ ───
const GROUPS = [
  { key: "active", label: "งานที่ต้องทำ", icon: <WorkOutline sx={{ fontSize: 15 }} />, color: "#3b82f6" },
  { key: "pending", label: "รอแอดมินอนุมัติ", icon: <HourglassTop sx={{ fontSize: 15 }} />, color: "#f59e0b" },
  { key: "closed", label: "เสร็จสิ้น", icon: <TaskAlt sx={{ fontSize: 15 }} />, color: "#10b981" },
];

const matchesGroup = (event, group) => {
  if (group === "pending") return event.closeRequested === true && event.status !== "ดำเนินการเสร็จสิ้น";
  if (group === "closed") return event.status === "ดำเนินการเสร็จสิ้น";
  // active: งานที่ยืนยันแล้ว/กำลังดำเนินการ และยังไม่ได้ขอปิด
  return ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(event.status) && !event.closeRequested;
};

export default function MyJobs() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("active");
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");

  const [uploadingState, setUploadingState] = useState({ quotation: null, report: null, invoice: null, completion: null });
  const [uploadProgressState, setUploadProgressState] = useState({ quotation: 0, report: 0, invoice: 0, completion: 0 });
  const [isUploadingState, setIsUploadingState] = useState({ quotation: false, report: false, invoice: false, completion: false });

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EventService.getEventOp();
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

  // ✅ รีเฟรชอัตโนมัติทุก 15 วินาที เพื่อให้เห็นผลอนุมัติ/ไม่อนุมัติปิดงานจากแอดมินแบบ realtime
  useEffect(() => {
    const interval = setInterval(() => fetchJobs(true), 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const groupCounts = useMemo(() => {
    const counts = { active: 0, pending: 0, closed: 0 };
    events.forEach((e) => {
      if (matchesGroup(e, "active")) counts.active += 1;
      else if (matchesGroup(e, "pending")) counts.pending += 1;
      else if (matchesGroup(e, "closed")) counts.closed += 1;
    });
    return counts;
  }, [events]);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = events.filter((e) => {
      if (!matchesGroup(e, group)) return false;
      if (!keyword) return true;
      return [e.company, e.site, e.title, e.system, e.docNo]
        .some((v) => (v || "").toLowerCase().includes(keyword));
    });
    return list.sort((a, b) =>
      group === "closed"
        ? moment(b.start).valueOf() - moment(a.start).valueOf()
        : moment(a.start).valueOf() - moment(b.start).valueOf()
    );
  }, [events, group, search]);

  // ✅ รวมงานที่เข้าหลายวันไม่ติดกัน (jobGroupId/ลายเซ็นเดียวกัน) เป็นการ์ดเดียว แทนที่จะแยกโชว์
  // ซ้ำกันทุกวัน — ลำดับกลุ่มยึดตามลำดับที่ปรากฏครั้งแรกใน filteredJobs (เรียงตามวันที่อยู่แล้ว)
  const jobGroups = useMemo(() => {
    const map = new Map();
    filteredJobs.forEach((ev) => {
      const key = getJobSignature(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return [...map.values()].map((sessions) =>
      sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start))
    );
  }, [filteredJobs]);

  const handleInputUpdate = useCallback(async (id, data) => {
    try {
      await EventService.UpdateEvent(id, data);
      setEvents((prev) => prev.map((e) => (e._id !== id ? e : { ...e, ...data, activityLog: data.activityLog ?? e.activityLog })));
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "บันทึกไม่สำเร็จ", severity: "error" });
    }
  }, []);

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
          onUploadProgress: (pe) => {
            setUploadProgressState((p) => ({ ...p, [type]: Math.round((pe.loaded * 100) / pe.total) }));
          },
        });
        successCount++;
      }
      setSnackbar({ open: true, msg: `อัปโหลด ${successCount} ไฟล์เรียบร้อย`, severity: "success" });
    } catch {
      setSnackbar({
        open: true,
        msg: successCount > 0 ? `อัปโหลดสำเร็จ ${successCount}/${files.length} ไฟล์ (มีไฟล์ที่ล้มเหลว)` : "อัปโหลดไม่สำเร็จ",
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
    <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 2, pb: 4, maxWidth: 720, mx: "auto" }}>
      {/* ── หัวข้อ + รีเฟรช ── */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>งานของฉัน</Typography>
          <Typography variant="caption" color="text.secondary">
            {lastRefreshed ? `อัปเดตล่าสุด ${moment(lastRefreshed).locale("th").format("HH:mm:ss")}` : "กำลังโหลด..."}
          </Typography>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={() => fetchJobs()} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Refresh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── ค้นหา ── */}
      <TextField
        fullWidth size="small" placeholder="ค้นหาโครงการ, ไซต์, ประเภทงาน, เลขเอกสาร..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      {/* ── แท็บกลุ่มสถานะ — เลื่อนแนวนอนได้บนจอแคบ ── */}
      <Stack direction="row" gap={1} sx={{ mb: 2, overflowX: "auto", pb: 0.5 }}>
        {GROUPS.map((g) => {
          const active = group === g.key;
          return (
            <Chip
              key={g.key}
              icon={g.icon}
              label={`${g.label} (${groupCounts[g.key]})`}
              onClick={() => setGroup(g.key)}
              sx={{
                fontWeight: 700, fontSize: "0.78rem", flexShrink: 0, height: 32,
                bgcolor: active ? g.color : "transparent",
                color: active ? "#fff" : "text.secondary",
                border: "1px solid", borderColor: active ? g.color : "divider",
                "& .MuiChip-icon": { color: active ? "#fff" : g.color },
                "&:hover": { bgcolor: active ? g.color : "action.hover" },
              }}
            />
          );
        })}
      </Stack>

      {/* ── รายการงาน ── */}
      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 4 }} />
          ))}
        </Stack>
      ) : filteredJobs.length === 0 ? (
        <Box sx={{
          textAlign: "center", py: 6, px: 2, borderRadius: 4,
          border: "1px dashed", borderColor: "divider", color: "text.disabled",
        }}>
          {GROUPS.find((g) => g.key === group)?.icon &&
            <Box sx={{ opacity: 0.3, mb: 1 }}>
              {cloneElement(GROUPS.find((g) => g.key === group).icon, { sx: { fontSize: 40 } })}
            </Box>}
          <Typography variant="body2">
            {search ? "ไม่พบงานที่ตรงกับคำค้นหา" : `ยังไม่มีงานในหมวด "${GROUPS.find((g) => g.key === group)?.label}"`}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {jobGroups.map((sessions) => (
            <JobGroupCard
              key={sessions[0].jobGroupId || sessions[0]._id}
              sessions={sessions}
              onInputUpdate={handleInputUpdate}
              onFileUpload={handleFileUpload}
              onDeleteFile={handleDeleteFile}
              onPreview={(url, name) => { setPreviewUrl(url); setPreviewFileName(name); }}
              uploadingState={uploadingState}
              isUploadingState={isUploadingState}
              uploadProgressState={uploadProgressState}
            />
          ))}
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
