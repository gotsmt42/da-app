/**
 * SalesAppointmentDialog — หน้ารายละเอียดนัดหมายฝ่ายขาย (เปิดเมื่อกดนัดบนปฏิทินเซล)
 *
 * ✅ ผู้ใช้สั่ง (7 ต.ค. 2569): "ปรับปรุงหน้าตารางเซลให้สมบูรณ์ เช่นเซลเข้างานแล้ว จะกดเข้าพบแล้ว และปิดงาน
 *    ต้องให้อัพรูปหน้างานก่อนด้วย · ปรับปรุง UI ให้ใช้งานง่าย สอดคล้องกับหน้าอื่นๆ มืออาชีพ"
 *
 *   ขั้นตอน:  นัดหมายแล้ว ──(แนบรูปหน้างาน ≥ 1)──▶ เข้าพบแล้ว ──(สรุปผลการเข้าพบ)──▶ ปิดงานแล้ว
 *             เลื่อนนัด / ยกเลิกนัด ได้ตลอดก่อนปิดงาน · เปิดงานที่ปิดแล้วอีกครั้ง = แอดมิน/ผู้จัดการ
 *   ⚠️ server ตรวจซ้ำทุกเงื่อนไข (PUT /events/:id/sales-status) — การปิดปุ่มบนจอมีไว้ให้รู้ว่าขาดอะไร
 *   ⚠️ แก้ข้อมูลนัด (วัน/เวลา/สถานที่/ประเภท) ยังใช้ฟอร์มเดิม (getEditSalesAppointment) ผ่าน onEdit
 */
import { useCallback, useEffect, useRef, useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Dialog, Box, Stack, Typography, IconButton, Button, TextField, CircularProgress, Tooltip, Menu, MenuItem,
  ListItemIcon, ListItemText, useMediaQuery, Alert, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, AddAPhotoOutlined, DeleteOutline, EditOutlined, MoreHoriz, CheckCircle, FlagOutlined, EventRepeat,
  EventBusy, Replay, PlaceOutlined, BusinessOutlined, AccessTime, NotesOutlined, PhotoCameraOutlined,
  LockOutlined, PhoneOutlined, PaidOutlined, EventNote,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import EventService from "@/shared/services/EventService";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import { formatThai } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";
import { SALES_TYPE_META, salesStatusMeta, toSalesStatus } from "../salesAppointmentTypes";
import SiteMapCard from "@/shared/ui/SiteMapCard";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

const GREEN = "#16a34a";
const TEAL = "#0d9488";
const RED = "#dc2626";

const STEPS = [
  { key: "นัดหมายแล้ว", label: "นัดหมาย" },
  { key: "เข้าพบแล้ว", label: "เข้าพบ" },
  { key: "ปิดงานแล้ว", label: "ปิดงาน" },
];
const stepIndex = (st) => (st === "ปิดงานแล้ว" ? 2 : st === "เข้าพบแล้ว" ? 1 : 0);

const fmtDate = (d) => (d ? formatThai(moment(d), "D MMM YY") : "");
const fmtDateTime = (d) => (d ? `${formatThai(moment(d), "D MMM YY HH:mm")} น.` : "");

/** หัวข้อกลุ่มข้อมูล */
const Section = ({ icon, title, right, children, hint, fill = false }) => (
  <Box sx={{ mt: 2.25, ...(fill ? { height: "calc(100% - 18px)", display: "flex", flexDirection: "column" } : null) }}>
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.9, minHeight: 28 }}>
      <Box sx={{ display: "flex", color: MUTED, "& svg": { fontSize: 17 } }}>{icon}</Box>
      <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 800, color: INK }}>{title}</Typography>
      {right}
    </Stack>
    {hint && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: -0.5, mb: 1 }}>{hint}</Typography>}
    {fill ? <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</Box> : children}
  </Box>
);

/** แถวข้อมูล ป้ายซ้าย ค่าขวา */
const InfoRow = ({ icon, label, children, tone }) => (
  <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ py: 0.9, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
    <Box sx={{ display: "flex", color: tone || FAINT, mt: "1px", "& svg": { fontSize: 17 } }}>{icon}</Box>
    <Typography sx={{ width: 88, flexShrink: 0, fontSize: "0.78rem", color: MUTED, fontWeight: 600 }}>{label}</Typography>
    <Box sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", color: INK, fontWeight: 600, overflowWrap: "anywhere" }}>{children}</Box>
  </Stack>
);

/** แถบขั้นตอน 3 จุด */
function Stepper({ status, ev }) {
  const cancelled = status === "ยกเลิกนัด";
  const idx = stepIndex(status);
  const dates = [ev.start, ev.visitedAt, ev.salesClosedAt];
  return (
    <Stack direction="row" alignItems="flex-start" sx={{ px: 0.5 }}>
      {STEPS.map((s, i) => {
        const done = !cancelled && i <= idx;
        const current = !cancelled && i === idx;
        const c = done ? (i === 2 ? GREEN : i === 1 ? TEAL : ACCENT) : LINE;
        return (
          <Box key={s.key} sx={{ flex: 1, position: "relative", textAlign: "center" }}>
            {i > 0 && (
              <Box sx={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2, bgcolor: !cancelled && i <= idx ? c : LINE, zIndex: 0 }} />
            )}
            <Box sx={{
              position: "relative", zIndex: 1, mx: "auto", width: 24, height: 24, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: done ? c : "#fff", border: `2px solid ${done ? c : LINE}`, color: "#fff",
              boxShadow: current ? `0 0 0 4px ${alpha(c, 0.18)}` : "none",
            }}>
              {done ? <CheckCircle sx={{ fontSize: 16 }} /> : <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT }}>{i + 1}</Typography>}
            </Box>
            <Typography sx={{ mt: 0.5, fontSize: "0.74rem", fontWeight: 800, color: done ? INK : FAINT }}>{s.label}</Typography>
            <Typography sx={{ fontSize: "0.66rem", color: MUTED, minHeight: 16 }}>{done && dates[i] ? fmtDate(dates[i]) : ""}</Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * @param {object}   props
 * @param {string}   props.eventId       id ของนัด (null = ปิด)
 * @param {object}   props.userData
 * @param {boolean}  props.isAdminOrManager
 * @param {Function} props.onClose
 * @param {Function} props.onChanged     โหลดปฏิทินใหม่หลังเปลี่ยนแปลง
 * @param {Function} props.onEdit        เปิดฟอร์มแก้ไขข้อมูลนัด (วัน/เวลา/สถานที่)
 * @param {Function} props.onDelete      ลบนัด
 */
export default function SalesAppointmentDialog({ eventId, userData, isAdminOrManager, onClose, onChanged, onEdit, onDelete, onNextAppointment }) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [ev, setEv] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [resultDirty, setResultDirty] = useState(false);
  const [err, setErr] = useState("");
  const [menuEl, setMenuEl] = useState(null);
  const [viewer, setViewer] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const r = await EventService.GetEventById(eventId);
      setEv(r.event);
      setResult(r.event?.visitResult || "");
      setResultDirty(false);
      setLoadErr("");
    } catch (e) {
      setLoadErr(e?.response?.data?.message || "โหลดนัดหมายไม่สำเร็จ");
    }
  }, [eventId]);

  useEffect(() => { setEv(null); setErr(""); setLoadErr(""); load(); }, [load]);

  if (!eventId) return null;

  const status = toSalesStatus(ev?.status);
  const sm = salesStatusMeta(ev?.status);
  const type = SALES_TYPE_META[ev?.title] || SALES_TYPE_META["อื่นๆ"];
  const photos = ev?.sitePhotoFiles || [];
  const uid = String(userData?.userId || userData?._id || "");
  const isOwner = ev && (String(ev.userId) === uid || ev.responsiblePersonId === uid);
  const canAct = Boolean(ev) && (isAdminOrManager || isOwner);
  const closed = status === "ปิดงานแล้ว";
  const cancelled = status === "ยกเลิกนัด";
  const locked = closed && !isAdminOrManager;
  const owner = ev?.user ? [ev.user.fname, ev.user.lname].filter(Boolean).join(" ") : "";

  const dateText = (() => {
    if (!ev) return "";
    const s = moment(ev.start);
    if (!s.isValid()) return "-";
    let e = ev.end ? moment(ev.end) : null;
    if (ev.allDay && e) e = e.clone().subtract(1, "day");
    const day = e && !e.isSame(s, "day") ? `${fmtDate(s)} – ${fmtDate(e)}` : formatThai(s, "dddd D MMMM YYYY");
    const time = ev.startTime ? ` · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ""} น.` : ev.allDay ? " · ทั้งวัน" : "";
    return day + time;
  })();

  const saveStatus = async (next, extra = {}) => {
    setErr("");
    setBusy(next || "result");
    try {
      const body = { ...extra };
      if (next) body.status = next;
      if (resultDirty || next === "ปิดงานแล้ว") body.visitResult = result;
      const r = await EventService.SalesStatus(ev._id, body);
      setEv((cur) => ({ ...cur, ...r.event }));
      setResultDirty(false);
      onChanged?.();
      if (next) {
        Swal.fire({ toast: true, position: "top", icon: "success", showConfirmButton: false, timer: 1800, title: `บันทึกสถานะ “${next}” แล้ว` });
      }
    } catch (e) {
      setErr(e?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy("");
    }
  };

  const onPick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setErr("");
    setUploading(files.length);
    let failed = 0;
    for (const f of files) {
      try { await EventService.Upload(ev._id, f, "sitePhoto"); }
      catch { failed += 1; }
      setUploading((n) => n - 1);
    }
    if (failed) setErr(`อัปโหลดไม่สำเร็จ ${failed} รูป — ลองใหม่อีกครั้ง`);
    await load();
    onChanged?.();
  };

  const removePhoto = async (p) => {
    const ok = await Swal.fire({
      icon: "warning", title: "ลบรูปนี้?", showCancelButton: true, confirmButtonText: "ลบรูป", cancelButtonText: "ยกเลิก",
      confirmButtonColor: RED, reverseButtons: true,
    });
    if (!ok.isConfirmed) return;
    try { await EventService.DeleteFile(ev._id, "sitePhoto", p._id); await load(); onChanged?.(); }
    catch (e2) { setErr(e2?.response?.data?.message || "ลบรูปไม่สำเร็จ"); }
  };

  const needPhoto = photos.length === 0;
  const needResult = !result.trim();

  // ── ปุ่มหลักตามขั้นตอน ──
  const primary = (() => {
    if (!canAct || cancelled) return null;
    if (status === "นัดหมายแล้ว" || status === "เลื่อนนัด") {
      return {
        label: "บันทึกว่าเข้าพบแล้ว", next: "เข้าพบแล้ว", color: TEAL, icon: <CheckCircle />,
        blocked: needPhoto ? "แนบรูปหน้างานอย่างน้อย 1 รูปก่อน" : "",
      };
    }
    if (status === "เข้าพบแล้ว") {
      return {
        label: "ปิดงาน", next: "ปิดงานแล้ว", color: GREEN, icon: <FlagOutlined />,
        blocked: needPhoto ? "แนบรูปหน้างานอย่างน้อย 1 รูปก่อน" : needResult ? "สรุปผลการเข้าพบก่อนปิดงาน" : "",
      };
    }
    return null;
  })();

  const checklist = primary ? [
    { ok: !needPhoto, text: `รูปหน้างาน (${photos.length} รูป)` },
    ...(primary.next === "ปิดงานแล้ว" ? [{ ok: !needResult, text: "สรุปผลการเข้าพบ" }] : []),
  ] : [];

  return (
    <Dialog open={Boolean(eventId)} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg"
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, maxWidth: { md: 1120 }, overflow: "hidden", display: "flex", flexDirection: "column" } }}>
      {/* ── หัว ── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.75, borderBottom: `1px solid ${LINE}`, bgcolor: "#fff", flexShrink: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, bgcolor: alpha(type.color, 0.1), border: `1px solid ${alpha(type.color, 0.2)}` }}>
            {type.icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: type.color }}>{ev?.title || "นัดหมาย"}</Typography>
              {ev && (
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 22, px: 0.9, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha(sm.color, 0.1), color: sm.color }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: sm.color }} />{status}
                </Box>
              )}
            </Stack>
            <Typography sx={{ fontSize: "1.08rem", fontWeight: 900, color: INK, lineHeight: 1.3, mt: 0.2, overflowWrap: "anywhere" }}>
              {ev?.site || (loadErr ? "—" : "กำลังโหลด…")}
            </Typography>
            {ev?.company && ev.company !== ev.site && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{ev.company}</Typography>}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="ปิด" sx={{ mt: -0.5, mr: -1 }}><Close /></IconButton>
        </Stack>
      </Box>

      {/* ── เนื้อหา ── */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, pb: 2.5, pt: 2, bgcolor: SURFACE }}>
        {loadErr ? (
          <Alert severity="error">{loadErr}</Alert>
        ) : !ev ? (
          <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}><CircularProgress size={28} /></Box>
        ) : (
          <>
            {/* ✅ (8 ต.ค. 2569 "แมพให้เอาไว้บนสุด") แผนที่หน้างานเต็มความกว้างบนสุด — แบบเดียวกับฟอร์มงานช่าง */}
            {(ev.site || ev.company) && (
              <Box sx={{ mb: 2 }}>
                <SiteMapCard company={ev.company} site={ev.site} canEdit={isAdminOrManager} height={fullScreen ? 170 : 210} />
              </Box>
            )}

            <Box sx={{ p: 1.75, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
              {cancelled ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <EventBusy sx={{ color: MUTED }} />
                  <Typography sx={{ fontSize: "0.86rem", color: INK_2, fontWeight: 700 }}>นัดนี้ถูกยกเลิกแล้ว</Typography>
                </Stack>
              ) : <Stepper status={status} ev={ev} />}
            </Box>

            {/* ✅ (8 ต.ค. 2569 "ขยายหน้านี้ · แบ่งส่วนที่ควรแบ่ง") จอคอม 2 คอลัมน์:
                ซ้าย = ข้อมูลนัด · ขวา = รูปหน้างาน · ผลการเข้าพบอยู่ล่างเต็มความกว้าง */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) minmax(0,1fr)" }, columnGap: 3, alignItems: "stretch" }}>
            <Box sx={{ minWidth: 0 }}>
            <Section fill icon={<NotesOutlined />} title="ข้อมูลนัดหมาย"
              right={canAct && !locked && onEdit ? (
                <Button size="small" startIcon={<EditOutlined sx={{ fontSize: 16 }} />} onClick={() => onEdit(ev)}
                  sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, py: 0.2 }}>แก้ไข</Button>
              ) : null}>
              <Box sx={{ flex: 1, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, overflow: "hidden" }}>
                {/* ✅ (8 ต.ค. 2569 "เอาชื่อฝ่ายขายขึ้นก่อน ให้รู้ว่าเป็นงานของใคร") เจ้าของนัดเป็นหัวกล่อง */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.5, py: 1.1, bgcolor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
                  <Avatar
                    src={hasValidAvatar(ev.user?.imageUrl) ? getOptimizedImageUrl(ev.user.imageUrl, { width: 96 }) : undefined}
                    sx={{ width: 38, height: 38, fontSize: 16, fontWeight: 800, bgcolor: personColor(owner || "?") }}>
                    {personInitial(owner || "?")}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED }}>ฝ่ายขายผู้รับผิดชอบ</Typography>
                    <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 900, color: INK }}>{owner || "ไม่ระบุ"}</Typography>
                  </Box>
                </Stack>
                <Box sx={{ px: 1.5 }}>
                <InfoRow icon={<AccessTime />} label="วัน-เวลา">{dateText}</InfoRow>
                <InfoRow icon={<PlaceOutlined />} label="สถานที่">{ev.site || "-"}</InfoRow>
                <InfoRow icon={<BusinessOutlined />} label="ลูกค้า">{ev.company || <Box component="span" sx={{ color: FAINT }}>ไม่ระบุ</Box>}</InfoRow>
                {(ev.contactName || ev.contactTel) && (
                  <InfoRow icon={<PhoneOutlined />} label="ผู้ติดต่อ">
                    {ev.contactName || ""}
                    {ev.contactTel && (
                      <Box component="a" href={`tel:${String(ev.contactTel).replace(/[^\d+]/g, "")}`}
                        sx={{ ml: ev.contactName ? 1 : 0, color: ACCENT, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                        {ev.contactTel}
                      </Box>
                    )}
                  </InfoRow>
                )}
                {Number(ev.jobValue) > 0 && (
                  <InfoRow icon={<PaidOutlined />} label="มูลค่า">
                    ฿{Number(ev.jobValue).toLocaleString("th-TH")}
                    <Box component="span" sx={{ ml: 0.75, fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>โอกาสการขาย</Box>
                  </InfoRow>
                )}
                {ev.visitedAt && (
                  <InfoRow icon={<CheckCircle />} tone={TEAL} label="เข้าพบเมื่อ">
                    {fmtDateTime(ev.visitedAt)}
                    {ev.visitedBy && <Box component="span" sx={{ ml: 0.75, fontWeight: 500, color: MUTED, fontSize: "0.8rem" }}>โดย {ev.visitedBy}</Box>}
                  </InfoRow>
                )}
                {ev.salesClosedAt && (
                  <InfoRow icon={<FlagOutlined />} tone={GREEN} label="ปิดงานเมื่อ">
                    {fmtDateTime(ev.salesClosedAt)}
                    {ev.salesClosedBy && <Box component="span" sx={{ ml: 0.75, fontWeight: 500, color: MUTED, fontSize: "0.8rem" }}>โดย {ev.salesClosedBy}</Box>}
                  </InfoRow>
                )}
                </Box>
                {ev.description && (
                  <InfoRow icon={<NotesOutlined />} label="รายละเอียด">
                    <Box component="span" sx={{ whiteSpace: "pre-wrap", fontWeight: 500, color: INK_2 }}>{ev.description}</Box>
                  </InfoRow>
                )}
              </Box>
            </Section>

            </Box>

            <Box sx={{ minWidth: 0 }}>
            {/* ── รูปหน้างาน ── */}
            <Section fill icon={<PhotoCameraOutlined />} title={`รูปหน้างาน${photos.length ? ` · ${photos.length} รูป` : ""}`}
              right={canAct && !locked && !cancelled ? (
                <Button size="small" startIcon={uploading ? <CircularProgress size={14} /> : <AddAPhotoOutlined sx={{ fontSize: 17 }} />}
                  disabled={Boolean(uploading)} onClick={() => fileRef.current?.click()}
                  sx={{ textTransform: "none", fontWeight: 800, color: ACCENT, py: 0.2 }}>
                  {uploading ? `กำลังอัปโหลด ${uploading}` : "เพิ่มรูป"}
                </Button>
              ) : null}>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
              <Box sx={{ flex: 1, p: 1.25, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 1 }}>
              {photos.length === 0 ? (
                <Box
                  role={canAct && !locked && !cancelled ? "button" : undefined}
                  onClick={canAct && !locked && !cancelled && !uploading ? () => fileRef.current?.click() : undefined}
                  sx={{
                    flex: 1, py: 3, px: 2, borderRadius: 2, textAlign: "center", bgcolor: SURFACE,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    border: `1.5px dashed ${canAct && !cancelled ? "#cbd5e1" : LINE}`,
                    cursor: canAct && !locked && !cancelled ? "pointer" : "default",
                    "&:hover": canAct && !locked && !cancelled ? { borderColor: ACCENT, bgcolor: "#f8fbff" } : undefined,
                  }}>
                  {uploading ? <CircularProgress size={24} /> : <AddAPhotoOutlined sx={{ fontSize: 30, color: FAINT }} />}
                  <Typography sx={{ mt: 0.75, fontSize: "0.86rem", fontWeight: 700, color: INK_2 }}>
                    {canAct && !cancelled ? "แตะเพื่อถ่าย/เลือกรูปหน้างาน" : "ยังไม่มีรูปหน้างาน"}
                  </Typography>
                  {canAct && !cancelled && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>เลือกได้หลายรูปพร้อมกัน · ระบบย่อขนาดให้อัตโนมัติ</Typography>}
                </Box>
              ) : (
                // ✅ (8 ต.ค. 2569 "จุดวางรูปยังไม่สวย ไม่เต็ม") จำนวนคอลัมน์ตามจำนวนรูป ให้เต็มความกว้างเสมอ
                //    1 รูป(+ปุ่มเพิ่ม) = 2 คอลัมน์ · 2 รูป = 3 · มากกว่านั้น = 4 (มือถือสูงสุด 3) · สัดส่วน 4:3 แบบรูปถ่ายหน้างาน
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: (() => {
                  const n = photos.length + (canAct && !locked && !cancelled ? 1 : 0);
                  const c = n <= 2 ? 2 : n <= 3 ? 3 : 4;
                  return { xs: `repeat(${Math.min(c, 3)}, minmax(0,1fr))`, sm: `repeat(${c}, minmax(0,1fr))` };
                })() }}>
                  {photos.map((p) => (
                    <Box key={p._id} sx={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 2, overflow: "hidden", bgcolor: "#e2e8f0", border: `1px solid ${LINE}`, "&:hover img": { transform: "scale(1.03)" } }}>
                      <Box component="img" src={getOptimizedImageUrl(p.fileUrl, { width: 320 })} alt={p.fileName} loading="lazy"
                        onClick={() => setViewer(p)}
                        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in", transition: "transform .2s" }} />
                      {canAct && !locked && (
                        <IconButton size="small" onClick={() => removePhoto(p)} aria-label="ลบรูป"
                          sx={{ position: "absolute", top: 4, right: 4, width: 26, height: 26, bgcolor: "rgba(15,23,42,.6)", color: "#fff", "&:hover": { bgcolor: RED } }}>
                          <DeleteOutline sx={{ fontSize: 15 }} />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  {canAct && !locked && !cancelled && (
                    <Box role="button" onClick={() => !uploading && fileRef.current?.click()}
                      sx={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 2, border: "1.5px dashed #cbd5e1", bgcolor: SURFACE, cursor: "pointer", "&:hover": { borderColor: ACCENT, bgcolor: "#f8fbff" } }}>
                      <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, color: MUTED }}>
                        {uploading ? <CircularProgress size={20} /> : <AddAPhotoOutlined />}
                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, mt: 0.4 }}>เพิ่มรูป</Typography>
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}
              {!cancelled && (
                <Typography sx={{ mt: "auto", fontSize: "0.72rem", color: MUTED }}>
                  ต้องแนบอย่างน้อย 1 รูปก่อนบันทึก “เข้าพบแล้ว” และ “ปิดงาน”
                </Typography>
              )}
              </Box>
            </Section>


            </Box>
            </Box>

            {/* ── ผลการเข้าพบ — เต็มความกว้างใต้ 2 คอลัมน์ (8 ต.ค. 2569 "ให้ขยายให้เต็มช่อง") ── */}
            {!cancelled && ((status !== "นัดหมายแล้ว" && status !== "เลื่อนนัด") || result) && (
              <Section icon={<FlagOutlined />} title="ผลการเข้าพบ"
                hint={status === "เข้าพบแล้ว" ? "สรุปสิ่งที่คุยกับลูกค้า ความต้องการ และขั้นตอนต่อไป — จำเป็นก่อนปิดงาน" : null}>
                {locked || !canAct ? (
                  <Box sx={{ p: 1.75, minHeight: 150, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, fontSize: "0.92rem", lineHeight: 1.7, color: INK_2, whiteSpace: "pre-wrap" }}>
                    {result || <Box component="span" sx={{ color: FAINT }}>ยังไม่มีสรุปผล</Box>}
                  </Box>
                ) : (
                  <>
                    <TextField
                      value={result} onChange={(e) => { setResult(e.target.value); setResultDirty(true); }}
                      multiline minRows={6} maxRows={16} fullWidth placeholder="เช่น ลูกค้าสนใจระบบ Fire Alarm 3 อาคาร · ขอใบเสนอราคาภายในศุกร์นี้"
                      sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 2.5, fontSize: "0.92rem", lineHeight: 1.7, alignItems: "flex-start" } }}
                    />
                    {resultDirty && (
                      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.75 }}>
                        <Button size="small" onClick={() => saveStatus(null)} disabled={Boolean(busy)}
                          sx={{ textTransform: "none", fontWeight: 800, color: ACCENT }}>
                          {busy === "result" ? "กำลังบันทึก…" : "บันทึกผลการเข้าพบ"}
                        </Button>
                      </Stack>
                    )}
                  </>
                )}
              </Section>
            )}


            {!canAct && (
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 2, color: MUTED }}>
                <LockOutlined sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: "0.76rem" }}>ดูได้อย่างเดียว — แก้ไขได้เฉพาะฝ่ายขายเจ้าของนัดและแอดมิน</Typography>
              </Stack>
            )}
            {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setErr("")}>{err}</Alert>}
          </>
        )}
      </Box>

      {/* ── ปุ่มล่าง ── */}
      {ev && canAct && (
        <Box sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, bgcolor: "#fff", flexShrink: 0 }}>
          {primary && checklist.some((c) => !c.ok) && (
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
              {checklist.map((c) => (
                <Stack key={c.text} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: c.ok ? GREEN : "#fff", border: `1.5px solid ${c.ok ? GREEN : "#cbd5e1"}` }}>
                    {c.ok && <CheckCircle sx={{ fontSize: 14, color: "#fff" }} />}
                  </Box>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: c.ok ? INK_2 : "#b45309" }}>{c.text}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="ตัวเลือกอื่น">
              <IconButton onClick={(e) => setMenuEl(e.currentTarget)} sx={{ border: `1px solid ${LINE}`, borderRadius: 2 }}>
                <MoreHoriz />
              </IconButton>
            </Tooltip>
            {(status === "เข้าพบแล้ว" || closed) && onNextAppointment && (
              <Button variant="outlined" startIcon={<EventNote />} onClick={() => onNextAppointment(ev)}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap", display: { xs: closed ? "inline-flex" : "none", sm: "inline-flex" } }}>
                นัดครั้งถัดไป
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {primary ? (
              <Tooltip title={primary.blocked}>
                <span>
                  <Button variant="contained" startIcon={busy === primary.next ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : primary.icon}
                    disabled={Boolean(primary.blocked) || Boolean(busy)} onClick={() => saveStatus(primary.next)}
                    sx={{ ...PRIMARY_BTN_SX, px: 2.5, py: 1, bgcolor: primary.color, "&:hover": { bgcolor: primary.color, filter: "brightness(.92)", boxShadow: "none" } }}>
                    {primary.label}
                  </Button>
                </span>
              </Tooltip>
            ) : closed && isAdminOrManager ? (
              <Button variant="outlined" startIcon={<Replay />} disabled={Boolean(busy)} onClick={() => saveStatus("เข้าพบแล้ว")}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}>เปิดงานอีกครั้ง</Button>
            ) : cancelled ? (
              <Button variant="outlined" startIcon={<Replay />} disabled={Boolean(busy)} onClick={() => saveStatus("นัดหมายแล้ว")}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}>กลับมานัดหมาย</Button>
            ) : (
              <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ปิด</Button>
            )}
          </Stack>
          <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}
            anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}>
            {onNextAppointment && (
              <MenuItem onClick={() => { setMenuEl(null); onNextAppointment(ev); }}>
                <ListItemIcon><EventNote fontSize="small" sx={{ color: ACCENT }} /></ListItemIcon><ListItemText>นัดครั้งถัดไปกับลูกค้านี้</ListItemText>
              </MenuItem>
            )}
            {!locked && onEdit && (
              <MenuItem onClick={() => { setMenuEl(null); onEdit(ev); }}>
                <ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon><ListItemText>แก้ไขวัน/เวลา/สถานที่</ListItemText>
              </MenuItem>
            )}
            {!closed && !cancelled && status !== "เลื่อนนัด" && (
              <MenuItem onClick={() => { setMenuEl(null); saveStatus("เลื่อนนัด"); }}>
                <ListItemIcon><EventRepeat fontSize="small" sx={{ color: "#d97706" }} /></ListItemIcon><ListItemText>ลูกค้าขอเลื่อนนัด</ListItemText>
              </MenuItem>
            )}
            {!closed && !cancelled && (
              <MenuItem onClick={() => { setMenuEl(null); saveStatus("ยกเลิกนัด"); }}>
                <ListItemIcon><EventBusy fontSize="small" /></ListItemIcon><ListItemText>ยกเลิกนัด</ListItemText>
              </MenuItem>
            )}
            {status === "เข้าพบแล้ว" && (
              <MenuItem onClick={() => { setMenuEl(null); saveStatus("นัดหมายแล้ว"); }}>
                <ListItemIcon><Replay fontSize="small" /></ListItemIcon><ListItemText>ย้อนกลับเป็น “นัดหมายแล้ว”</ListItemText>
              </MenuItem>
            )}
            {!locked && onDelete && (
              <MenuItem onClick={() => { setMenuEl(null); onDelete(ev); }} sx={{ color: RED }}>
                <ListItemIcon><DeleteOutline fontSize="small" sx={{ color: RED }} /></ListItemIcon><ListItemText>ลบนัดหมาย</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </Box>
      )}

      {/* ดูรูปขนาดใหญ่ */}
      <Dialog open={Boolean(viewer)} onClose={() => setViewer(null)} maxWidth="lg"
        PaperProps={{ sx: { bgcolor: "#0f172a", borderRadius: 2, overflow: "hidden" } }}>
        {viewer && (
          <Box sx={{ position: "relative" }}>
            <Box component="img" src={getOptimizedImageUrl(viewer.fileUrl, { width: 1600 })} alt={viewer.fileName}
              sx={{ display: "block", maxWidth: "92vw", maxHeight: "86vh", objectFit: "contain" }} />
            <IconButton onClick={() => setViewer(null)} sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,.5)", color: "#fff" }}><Close /></IconButton>
            <Typography sx={{ px: 1.5, py: 1, fontSize: "0.76rem", color: "#cbd5e1" }}>
              {viewer.uploadedBy ? `${viewer.uploadedBy} · ` : ""}{fmtDateTime(viewer.uploadedAt)}
            </Typography>
          </Box>
        )}
      </Dialog>
    </Dialog>
  );
}
