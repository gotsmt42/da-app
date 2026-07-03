/**
 * TechnicianJobPanel.jsx — v2
 *
 * ฟีเจอร์ใหม่:
 *   ✅ Step progress bar (รับงาน → กำลังทำ → เสร็จสิ้น)
 *   ✅ บันทึกสรุปงานเป็นข้อความ (workNote) พร้อม push activityLog
 *   ✅ Check-in / Check-out กด 1 ครั้ง พร้อม timestamp
 *   ✅ อัปโหลดรูปภาพ/ไฟล์งาน
 *   ✅ ส่ง activityLog กลับไปที่ parent (Operation) เพื่อแอดมินเห็น real-time
 */

import React, { useState, useRef, useCallback } from "react";
import moment from "moment";
import "moment/locale/th";
import {
  Box, Card, CardContent, Typography, Stack, Chip, Avatar,
  Button, IconButton, TextField, Collapse, Divider, LinearProgress,
  Tooltip, Badge, Alert,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import {
  Build, Assignment, Visibility, Warning, Description,
  Login, Logout, Edit, CloudUpload, CheckCircle,
  ExpandMore, ExpandLess, Circle, NoteAdd, History,
  AccessTime, PictureAsPdf, Image, Article, InsertDriveFile,
  AttachFile, Delete, Download,
} from "@mui/icons-material";

// ─── Constants ────────────────────────────────────────────────────────
const OP_COLOR = {
  "กำลังรอยืนยัน":     "#f59e0b",
  "ยืนยันแล้ว":         "#3b82f6",
  "กำลังดำเนินการ":     "#8b5cf6",
  "ดำเนินการเสร็จสิ้น": "#10b981",
};

const TYPE_ICON = {
  PM:              <Build fontSize="small" />,
  Service:         <Assignment fontSize="small" />,
  Inspection:      <Visibility fontSize="small" />,
  "ตรวจเช็คปัญหา": <Warning fontSize="small" />,
  "สำรวจระบบ":     <Description fontSize="small" />,
};

const WORK_STEPS = [
  { key: "received",    label: "รับงาน",       icon: <Assignment sx={{ fontSize: 16 }} /> },
  { key: "in_progress", label: "กำลังดำเนินการ", icon: <Build sx={{ fontSize: 16 }} /> },
  { key: "done",        label: "เสร็จสิ้น",     icon: <CheckCircle sx={{ fontSize: 16 }} /> },
];

// ─── Styled ──────────────────────────────────────────────────────────
const JobCard = styled(Card)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.96),
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: `0 2px 16px ${alpha(theme.palette.common.black, 0.06)}`,
  marginBottom: theme.spacing(2),
  overflow: "visible",
}));

const StepDot = styled(Box)(({ active, done, color }) => ({
  width: 32,
  height: 32,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: done || active
    ? (color || "#10b981")
    : alpha("#6b7280", 0.12),
  color: done || active ? "#fff" : "#9ca3af",
  border: active ? `3px solid ${alpha(color || "#10b981", 0.35)}` : "none",
  transition: "all 0.25s ease",
  flexShrink: 0,
}));

const ActionBtn = styled(Button)(({ theme, variant: v, btncolor }) => ({
  borderRadius: 10,
  fontWeight: 700,
  fontSize: "0.8rem",
  textTransform: "none",
  padding: "6px 16px",
  ...(v === "contained" && {
    background: btncolor || theme.palette.primary.main,
    color: "#fff",
    "&:hover": { background: btncolor ? alpha(btncolor, 0.85) : undefined },
  }),
  ...(v === "outlined" && {
    borderColor: btncolor || theme.palette.primary.main,
    color: btncolor || theme.palette.primary.main,
    "&:hover": { background: alpha(btncolor || theme.palette.primary.main, 0.06) },
  }),
}));

// ─── Helper ───────────────────────────────────────────────────────────
const getFileType = (fileName = "") => {
  const lower = (fileName || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some(e => lower.endsWith(e))) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "excel";
  return "unknown";
};

const fileTypeIcon = (fileName) => {
  const t = getFileType(fileName);
  if (t === "image") return <Image sx={{ color: "#10b981", fontSize: 18 }} />;
  if (t === "pdf")   return <PictureAsPdf sx={{ color: "#ef4444", fontSize: 18 }} />;
  if (t === "word")  return <Article sx={{ color: "#3b82f6", fontSize: 18 }} />;
  if (t === "excel") return <InsertDriveFile sx={{ color: "#10b981", fontSize: 18 }} />;
  return <AttachFile sx={{ color: "#6b7280", fontSize: 18 }} />;
};

// ─── WorkStepBar ─────────────────────────────────────────────────────
const WorkStepBar = ({ currentStep }) => {
  const stepIndex = WORK_STEPS.findIndex(s => s.key === currentStep);
  return (
    <Box sx={{ px: 1, py: 1.5 }}>
      <Stack direction="row" alignItems="center">
        {WORK_STEPS.map((step, i) => {
          const done   = i < stepIndex;
          const active = i === stepIndex;
          const color  = i === 2 ? "#10b981" : i === 1 ? "#8b5cf6" : "#3b82f6";
          return (
            <React.Fragment key={step.key}>
              <Stack alignItems="center" gap={0.5} sx={{ flex: i < WORK_STEPS.length - 1 ? "0 0 auto" : "0 0 auto" }}>
                <StepDot active={active ? 1 : 0} done={done ? 1 : 0} color={color}>
                  {done ? <CheckCircle sx={{ fontSize: 16 }} /> : step.icon}
                </StepDot>
                <Typography
                  variant="caption"
                  fontWeight={active ? 700 : 500}
                  color={done || active ? color : "text.disabled"}
                  sx={{ fontSize: "0.65rem", whiteSpace: "nowrap" }}>
                  {step.label}
                </Typography>
              </Stack>
              {i < WORK_STEPS.length - 1 && (
                <Box sx={{
                  flex: 1, height: 3, mx: 0.75, borderRadius: 2, mb: 2.5,
                  background: done
                    ? "linear-gradient(90deg, #3b82f6, #8b5cf6)"
                    : alpha("#6b7280", 0.12),
                  transition: "background 0.3s ease",
                }} />
              )}
            </React.Fragment>
          );
        })}
      </Stack>
    </Box>
  );
};

// ─── WorkNoteEditor ───────────────────────────────────────────────────
const WorkNoteEditor = ({ eventId, currentNote, onSave, userName }) => {
  const [editing, setEditing] = useState(false);
  const [note,    setNote]    = useState(currentNote || "");
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await onSave(eventId, note.trim(), userName);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <Box>
        {currentNote ? (
          <Box sx={{
            p: 1.5, borderRadius: 2, border: "1px solid",
            borderColor: alpha("#3b82f6", 0.2),
            background: alpha("#3b82f6", 0.03),
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Typography variant="caption" color="text.secondary"
                sx={{ whiteSpace: "pre-line", lineHeight: 1.7, flex: 1 }}>
                {currentNote}
              </Typography>
              <IconButton size="small" onClick={() => { setNote(currentNote); setEditing(true); }}>
                <Edit sx={{ fontSize: 15 }} />
              </IconButton>
            </Stack>
          </Box>
        ) : (
          <ActionBtn
            variant="outlined"
            btncolor="#3b82f6"
            startIcon={<NoteAdd sx={{ fontSize: 16 }} />}
            onClick={() => setEditing(true)}
            fullWidth>
            เขียนสรุปงานที่ทำ
          </ActionBtn>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        multiline minRows={3} maxRows={8}
        fullWidth autoFocus
        placeholder="สรุปงานที่ทำ เช่น ตรวจสอบระบบ FA ชั้น 3, เปลี่ยนหัวสปริงเกอร์ 2 หัว..."
        value={note}
        onChange={e => setNote(e.target.value)}
        size="small"
        sx={{
          "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.85rem" },
          mb: 1,
        }}
      />
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button size="small" onClick={() => setEditing(false)}
          sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.78rem" }}>
          ยกเลิก
        </Button>
        <ActionBtn
          variant="contained"
          btncolor="#3b82f6"
          size="small"
          disabled={!note.trim() || saving}
          onClick={handleSave}>
          {saving ? "กำลังบันทึก..." : "บันทึกสรุปงาน"}
        </ActionBtn>
      </Stack>
    </Box>
  );
};

// ─── Main: TechnicianJobCard ──────────────────────────────────────────
const TechnicianJobCard = ({
  event,
  onStatusUpdate,
  onInputUpdate,
  onFileUpload,
  onDeleteFile,
  uploadingState,
  isUploadingState,
  uploadProgressState,
  currentUserRole,
  isTechnicianView = true,
}) => {
  const [expanded,   setExpanded]   = useState(false);
  const [localStep,  setLocalStep]  = useState(
    event.status === "ดำเนินการเสร็จสิ้น" ? "done"
    : event.status === "กำลังดำเนินการ"   ? "in_progress"
    : "received"
  );
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const fileRef = useRef();

  // ดึง userName จาก localStorage
  const payload  = JSON.parse(localStorage.getItem("payload") || "{}");
  const userName = payload?.name || payload?.username || "ช่าง";

  // ── push activityLog ─────────────────────────────────────────────
  const pushLog = useCallback(async (action, detail = "") => {
    const newLog = {
      action,
      detail,
      userName,
      timestamp: new Date().toISOString(),
    };
    const updated = [...(event.activityLog || []), newLog];
    await onInputUpdate(event._id, { activityLog: updated });
  }, [event._id, event.activityLog, onInputUpdate, userName]);

  // ── Check In ────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (event.checkedInAt) return; // กันกด 2 ครั้ง
    setCheckingIn(true);
    const now = new Date().toISOString();
    await onInputUpdate(event._id, {
      checkedInAt: now,
      status: "กำลังดำเนินการ",
    });
    await pushLog("check_in", `เช็คอิน ${moment(now).format("HH:mm")}`);
    setLocalStep("in_progress");
    onStatusUpdate(event._id, { status: "กำลังดำเนินการ" });
    setCheckingIn(false);
  };

  // ── Check Out ───────────────────────────────────────────────────
  const handleCheckOut = async () => {
    if (event.checkedOutAt) return;
    setCheckingOut(true);
    const now = new Date().toISOString();
    await onInputUpdate(event._id, {
      checkedOutAt: now,
      status: "ดำเนินการเสร็จสิ้น",
    });
    await pushLog("check_out", `เช็คเอาท์ ${moment(now).format("HH:mm")}`);
    setLocalStep("done");
    onStatusUpdate(event._id, { status: "ดำเนินการเสร็จสิ้น" });
    setCheckingOut(false);
  };

  // ── Save Work Note ───────────────────────────────────────────────
  const handleSaveNote = async (eventId, note, uName) => {
    await onInputUpdate(eventId, { workNote: note });
    await pushLog("note_saved", note.slice(0, 80) + (note.length > 80 ? "…" : ""));
  };

  // ── File Upload ──────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileUpload(file, event._id, "report");
      pushLog("file_uploaded", file.name);
    }
  };

  // ── Duration ────────────────────────────────────────────────────
  const duration = event.checkedInAt && event.checkedOutAt
    ? moment.duration(moment(event.checkedOutAt).diff(moment(event.checkedInAt))).humanize()
    : null;

  const statusColor = OP_COLOR[event.status] || "#6b7280";

  return (
    <JobCard>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>

        {/* ── Header ── */}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
          <Stack direction="row" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
            <Avatar sx={{
              width: 44, height: 44, flexShrink: 0,
              background: alpha(statusColor, 0.14),
              color: statusColor,
            }}>
              {TYPE_ICON[event.title] || <Build />}
            </Avatar>
            <Box minWidth={0} flex={1}>
              <Stack direction="row" gap={0.5} flexWrap="wrap" mb={0.4}>
                <Chip
                  size="small"
                  label={event.status || "ไม่ระบุ"}
                  sx={{
                    height: 22, fontSize: "0.7rem", fontWeight: 700,
                    bgcolor: alpha(statusColor, 0.12),
                    color: statusColor,
                    border: `1px solid ${alpha(statusColor, 0.3)}`,
                  }}
                />
                {event.title  && <Chip label={event.title}  size="small" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />}
                {event.system && <Chip label={event.system} size="small" variant="outlined" color="secondary" sx={{ height: 22, fontSize: "0.7rem" }} />}
              </Stack>
              <Typography fontWeight={800} fontSize="0.95rem">
                {event.company || "—"} · {event.site || "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                📅 {moment(event.start).locale("th").format("DD MMM YYYY HH:mm")}
                {event.docNo && <> · 📄 {event.docNo}</>}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={() => setExpanded(p => !p)}
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Stack>

        {/* ── Step Bar ── */}
        <Box sx={{ mt: 2, mb: 0.5 }}>
          <WorkStepBar currentStep={localStep} />
        </Box>

        {/* ── Check In / Out Row ── */}
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap" sx={{ mt: 1.5 }}>
          {!event.checkedInAt ? (
            <ActionBtn
              variant="contained"
              btncolor="#8b5cf6"
              startIcon={<Login sx={{ fontSize: 16 }} />}
              onClick={handleCheckIn}
              disabled={checkingIn}>
              {checkingIn ? "กำลังเช็คอิน..." : "เช็คอิน"}
            </ActionBtn>
          ) : (
            <Stack direction="row" alignItems="center" gap={0.75}
              sx={{ px: 1.5, py: 0.6, borderRadius: 2, bgcolor: alpha("#8b5cf6", 0.08) }}>
              <Login sx={{ fontSize: 14, color: "#8b5cf6" }} />
              <Typography variant="caption" fontWeight={700} color="#8b5cf6">
                เข้างาน {moment(event.checkedInAt).format("HH:mm")}
              </Typography>
            </Stack>
          )}

          {event.checkedInAt && !event.checkedOutAt ? (
            <ActionBtn
              variant="contained"
              btncolor="#10b981"
              startIcon={<Logout sx={{ fontSize: 16 }} />}
              onClick={handleCheckOut}
              disabled={checkingOut}>
              {checkingOut ? "กำลังบันทึก..." : "เสร็จงาน / เช็คเอาท์"}
            </ActionBtn>
          ) : event.checkedOutAt ? (
            <Stack direction="row" alignItems="center" gap={0.75}
              sx={{ px: 1.5, py: 0.6, borderRadius: 2, bgcolor: alpha("#10b981", 0.08) }}>
              <Logout sx={{ fontSize: 14, color: "#10b981" }} />
              <Typography variant="caption" fontWeight={700} color="#10b981">
                เสร็จงาน {moment(event.checkedOutAt).format("HH:mm")}
              </Typography>
              {duration && (
                <Typography variant="caption" color="text.disabled">· ใช้เวลา {duration}</Typography>
              )}
            </Stack>
          ) : null}
        </Stack>

        {/* ── Expanded: WorkNote + Upload ── */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            {/* สรุปงาน */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                สรุปงานที่ทำ
              </Typography>
              <WorkNoteEditor
                eventId={event._id}
                currentNote={event.workNote}
                onSave={handleSaveNote}
                userName={userName}
              />
            </Box>

            {/* อัปโหลดรายงาน */}
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                รายงาน / รูปภาพงาน
              </Typography>

              {event.reportFileName ? (
                <Stack direction="row" alignItems="center" gap={1} sx={{
                  p: 1.5, borderRadius: 2, border: "1px solid",
                  borderColor: alpha("#10b981", 0.25),
                  background: alpha("#10b981", 0.04),
                }}>
                  {fileTypeIcon(event.reportFileName)}
                  <Typography variant="caption" fontWeight={600} flex={1} noWrap>
                    {event.reportFileName}
                  </Typography>
                  <IconButton size="small" component="a" href={event.reportFileUrl} download target="_blank">
                    <Download sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ) : isUploadingState?.report ? (
                <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "primary.main" }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    กำลังอัปโหลด...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgressState?.report || 0}
                    sx={{ borderRadius: 2, height: 6 }}
                  />
                </Box>
              ) : (
                <>
                  <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} />
                  <ActionBtn
                    variant="outlined"
                    btncolor="#f59e0b"
                    startIcon={<CloudUpload sx={{ fontSize: 16 }} />}
                    onClick={() => fileRef.current?.click()}
                    fullWidth>
                    อัปโหลดรายงาน / รูปภาพ
                  </ActionBtn>
                </>
              )}
            </Box>

            {/* ActivityLog mini (ของช่างเอง) */}
            {(event.activityLog || []).length > 0 && (
              <Box>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                  <History sx={{ fontSize: 14 }} /> ประวัติกิจกรรม ({event.activityLog.length})
                </Typography>
                <Stack spacing={0.75} sx={{ pl: 1.5, borderLeft: "2px solid", borderColor: "divider" }}>
                  {[...(event.activityLog)].reverse().slice(0, 5).map((log, i) => (
                    <Stack key={i} direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="caption" color="text.disabled">
                        {moment(log.timestamp).format("HH:mm")}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {log.action === "check_in"   ? "เช็คอิน"
                        : log.action === "check_out"  ? "เช็คเอาท์"
                        : log.action === "note_saved" ? "บันทึกสรุปงาน"
                        : log.action === "file_uploaded" ? "อัปโหลดไฟล์"
                        : log.action}
                      </Typography>
                      {log.detail && (
                        <Typography variant="caption" color="text.disabled" noWrap sx={{ maxWidth: 200 }}>
                          · {log.detail}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Collapse>

      </CardContent>
    </JobCard>
  );
};

export default TechnicianJobCard;
