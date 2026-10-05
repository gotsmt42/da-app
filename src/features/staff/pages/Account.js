/**
 * Account — หน้า "บัญชีของฉัน"
 *
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "ให้มีอะไรมากกว่านี้ · เปลี่ยนรูปหน่วงและช้ามาก · ดูมืออาชีพ แสดงข้อมูลครบถ้วน สวยงาม"
 *   • เปลี่ยนรูป: กดที่รูปได้ทันที (ไม่ต้องเปิดฟอร์ม) · ย่อรูปในเบราว์เซอร์เหลือ 512px ก่อนส่ง (เดิมส่งไฟล์ดิบหลาย MB)
 *     · แสดงรูปใหม่ทันทีระหว่างอัปโหลด (มีวงหมุนบนรูป) · ส่งเฉพาะรูป ไม่ส่งข้อมูลทั้งก้อนซ้ำ
 *   • ข้อมูลครบ: ติดต่อ · ตำแหน่งและแผนก · สิ่งที่ทำได้ในระบบ · ลายเซ็น/การแจ้งเตือน · วันที่สร้างบัญชี
 *   • ธีมเดียวกับทั้งแอป (ขาว · เทา · น้ำเงิน) — เดิมเป็นโทนเขียวทองคนละชุดกับหน้าอื่น
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Avatar, IconButton, Tooltip, Button, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert,
} from "@mui/material";
import {
  PhotoCamera, Edit, EmailOutlined, PhoneOutlined, AlternateEmail, ContentCopy, Check, BadgeOutlined,
  WorkOutline, ApartmentOutlined, AdminPanelSettingsOutlined, CheckCircle, RemoveCircleOutline,
  DrawOutlined, NotificationsNoneOutlined, ChevronRight, EventOutlined, UpdateOutlined, Close,
} from "@mui/icons-material";
import useRealtime from "@/shared/realtime/useRealtime";
import AuthService from "@/shared/services/authService";
import SignatureService from "@/shared/services/SignatureService";
import PushService from "@/shared/services/PushService";
import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import { rankLabel, systemRoleLabel, titleOf, departmentOf, DEPARTMENT_LABEL, SYSTEM_ROLE_DESC, systemRoleOf } from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import { resizeImage } from "@/shared/utils/imageResize";
import { formatThai } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";

/** สิทธิ์ที่ผู้ใช้ทั่วไปอยากรู้ว่า "ฉันทำอะไรได้บ้าง" — ชื่อเรียกแบบที่คนใช้งานเข้าใจ */
const CAPS = [
  ["งาน", [
    ["viewAllJobs", "เห็นงานของทุกคน"],
    ["approveJobs", "อนุมัติแผนงานและการปิดงาน"],
    ["editOperation", "อัปเดตงานในหน้าการดำเนินงาน"],
    ["receiveDispatch", "รับงานที่ได้รับมอบหมาย"],
    ["requestDispatch", "แจ้งงานให้ฝ่ายช่าง"],
    ["assignDispatch", "จัดคิวคำขอลงงาน"],
  ]],
  ["เอกสาร · ลูกค้า", [
    ["viewContracts", "ดูภาพรวมงานและสัญญา"],
    ["editContracts", "เพิ่ม/แก้ไขสัญญา"],
    ["viewQuotations", "ติดตามใบเสนอราคา"],
    ["viewDocuments", "เปิดเมนูเอกสาร"],
    ["editDocuments", "ออกเอกสารให้ลูกค้า"],
    ["manageMasterData", "จัดการข้อมูลลูกค้า/ประเภทงาน"],
  ]],
  ["เบิกจ่าย · OT · จัดซื้อ", [
    ["requestExpense", "ยื่นเบิก · OT · ขอซื้อ"],
    ["reviewExpense", "ตรวจสอบใบเบิก"],
    ["approveExpense", "อนุมัติใบเบิก"],
    ["disburseExpense", "อนุมัติเบิกจ่าย"],
    ["manageSystem", "ตั้งค่าองค์กรและสิทธิ์"],
  ]],
];

const Card = ({ title, icon, right, children, sx }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.04)", ...sx }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${LINE}` }}>
      <Box sx={{ color: ACCENT, display: "flex", "& svg": { fontSize: 19 } }}>{icon}</Box>
      <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.95rem", color: INK }}>{title}</Typography>
      {right}
    </Stack>
    <Box>{children}</Box>
  </Box>
);

/** แถว "ป้าย : ค่า" */
const Field = ({ icon, label, value, action, muted }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.25, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
    <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: SURFACE, color: MUTED, "& svg": { fontSize: 18 } }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: muted ? FAINT : INK, overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
    {action}
  </Stack>
);

export default function Account() {
  const navigate = useNavigate();
  const { updateUserData, userData, refreshUserData } = useAuth();
  const { can } = usePermissions();
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState("");
  const [preview, setPreview] = useState("");          // รูปใหม่ที่เพิ่งเลือก (แสดงทันทีระหว่างอัปโหลด)
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ fname: "", lname: "", tel: "", jobTitle: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);           // { type, text }
  const [signature, setSignature] = useState(undefined);
  const [push, setPush] = useState(null);             // true/false/null
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await AuthService.getUserData();
      setUser(res?.user || null);
    } catch { /* แสดงจากข้อมูลเดิมต่อ */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime("users", () => { load(); });
  useEffect(() => {
    SignatureService.me().then(setSignature).catch(() => setSignature(null));
    (async () => {
      try { setPush(PushService.isSupported() ? Boolean(await PushService.isSubscribed()) : null); } catch { setPush(null); }
    })();
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  /** ส่งต่อข้อมูลใหม่ให้หัวเว็บ/เมนูอัปเดตทันที */
  const syncAuth = async (updated) => {
    if (updated && String(updated._id || "") === String(userData?.userId || "")) {
      updateUserData({ ...userData, ...updated, userId: String(updated._id) });
      await refreshUserData?.();
    }
  };

  const changePhoto = async (e) => {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw || !user?._id) return;
    setUploading(true);
    try {
      const file = await resizeImage(raw, { max: 512, square: true });
      setPreview(URL.createObjectURL(file));
      const fd = new FormData();
      fd.append("image", file);
      const updated = await AuthService.UpdateUser(user._id, fd);
      setUser(updated);
      await syncAuth(updated);
      setToast({ type: "success", text: "เปลี่ยนรูปโปรไฟล์แล้ว" });
    } catch (err) {
      setPreview("");
      setToast({ type: "error", text: err?.response?.data?.message || err?.message || "เปลี่ยนรูปไม่สำเร็จ" });
    } finally {
      setUploading(false);
    }
  };

  const openEdit = () => {
    setForm({ fname: user?.fname || "", lname: user?.lname || "", tel: user?.tel || "", jobTitle: user?.jobTitle || "" });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = await AuthService.UpdateUser(user._id, {
        fname: form.fname.trim(), lname: form.lname.trim(), tel: form.tel.trim(), jobTitle: form.jobTitle.trim(),
      });
      setUser(updated);
      await syncAuth(updated);
      setEditOpen(false);
      setToast({ type: "success", text: "บันทึกข้อมูลแล้ว" });
    } catch (err) {
      setToast({ type: "error", text: err?.response?.data?.message || "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  const copy = async (key, value) => {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(""), 1500); }
    catch { setCopied(""); }
  };

  if (!user) {
    return <Box sx={{ py: 10, display: "flex", justifyContent: "center" }}><CircularProgress size={30} /></Box>;
  }

  const fullName = [user.fname, user.lname].filter(Boolean).join(" ") || user.username;
  const nameKey = user.fname || user.username;
  const avatarSrc = preview || (hasValidAvatar(user.imageUrl) ? getOptimizedImageUrl(user.imageUrl, { width: 256 }) : undefined);
  const dept = departmentOf(user);
  const rank = rankLabel(user);
  const title = titleOf(user);
  const sysRole = systemRoleOf(user);

  const copyBtn = (key, value) => value ? (
    <Tooltip title={copied === key ? "คัดลอกแล้ว" : "คัดลอก"}>
      <IconButton size="small" onClick={() => copy(key, value)} sx={{ color: copied === key ? "#16a34a" : MUTED }}>
        {copied === key ? <Check sx={{ fontSize: 18 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  ) : null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1080, mx: "auto" }}>
      {/* ── การ์ดตัวตน ── */}
      <Box sx={{ mb: 2, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <Box sx={{ height: { xs: 84, sm: 104 }, background: `linear-gradient(120deg, ${ACCENT_SOFT} 0%, #e0e7ff 55%, #f1f5f9 100%)`, borderBottom: `1px solid ${LINE}` }} />
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "center", sm: "flex-start" }} spacing={{ xs: 1.5, sm: 2.5 }}
          sx={{ px: { xs: 2, sm: 3 }, pb: 2.5, mt: { xs: "-52px", sm: "-56px" } }}>
          {/* รูปโปรไฟล์ — กดเพื่อเปลี่ยนได้ทันที */}
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <Avatar src={avatarSrc} alt={fullName}
              sx={{ width: 112, height: 112, fontSize: 40, fontWeight: 800, bgcolor: personColor(nameKey), border: "4px solid #fff", boxShadow: "0 6px 18px rgba(15,23,42,.15)" }}>
              {personInitial(nameKey)}
            </Avatar>
            {uploading && (
              <Box sx={{ position: "absolute", inset: 4, borderRadius: "50%", bgcolor: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={34} sx={{ color: "#fff" }} />
              </Box>
            )}
            <Tooltip title="เปลี่ยนรูปโปรไฟล์">
              <span>
                <IconButton onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="เปลี่ยนรูปโปรไฟล์"
                  sx={{ position: "absolute", right: 0, bottom: 2, width: 34, height: 34, bgcolor: ACCENT, color: "#fff", border: "3px solid #fff", "&:hover": { bgcolor: "#1d4ed8" }, "&.Mui-disabled": { bgcolor: FAINT, color: "#fff" } }}>
                  <PhotoCamera sx={{ fontSize: 17 }} />
                </IconButton>
              </span>
            </Tooltip>
            <input ref={fileRef} hidden type="file" accept="image/*" onChange={changePhoto} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: "center", sm: "left" }, pt: { sm: "68px" } }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.35rem", sm: "1.55rem" }, color: INK, lineHeight: 1.25 }}>{fullName}</Typography>
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.25 }}>@{user.username}{title && title !== rank ? ` · ${title}` : ""}</Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 1, flexWrap: "wrap", justifyContent: { xs: "center", sm: "flex-start" } }}>
              {rank && <Box component="span" sx={{ px: 1.1, py: 0.35, borderRadius: 99, fontSize: "0.74rem", fontWeight: 800, bgcolor: ACCENT_SOFT, color: "#1d4ed8", border: `1px solid ${ACCENT_LINE}` }}>{rank}</Box>}
              {dept && <Box component="span" sx={{ px: 1.1, py: 0.35, borderRadius: 99, fontSize: "0.74rem", fontWeight: 700, bgcolor: SURFACE, color: INK_2, border: `1px solid ${LINE}` }}>{DEPARTMENT_LABEL[dept]}</Box>}
              <Box component="span" sx={{ px: 1.1, py: 0.35, borderRadius: 99, fontSize: "0.74rem", fontWeight: 700, bgcolor: SURFACE, color: INK_2, border: `1px solid ${LINE}` }}>{systemRoleLabel(user)}</Box>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, pt: { sm: "72px" } }}>
            <Button variant="outlined" startIcon={<PhotoCamera />} onClick={() => fileRef.current?.click()} disabled={uploading}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: LINE, color: INK_2, "&:hover": { borderColor: ACCENT, bgcolor: ACCENT_SOFT } }}>
              {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
            </Button>
            <Button variant="contained" startIcon={<Edit />} onClick={openEdit}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
              แก้ไขข้อมูล
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, alignItems: "start" }}>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Card title="ข้อมูลติดต่อ" icon={<PhoneOutlined />}>
            <Field icon={<EmailOutlined />} label="อีเมล" value={user.email || "ยังไม่ระบุ"} muted={!user.email} action={copyBtn("email", user.email)} />
            <Field icon={<PhoneOutlined />} label="เบอร์โทร" value={user.tel || "ยังไม่ระบุ"} muted={!user.tel} action={copyBtn("tel", user.tel)} />
            <Field icon={<AlternateEmail />} label="ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ)" value={user.username} action={copyBtn("username", user.username)} />
          </Card>

          <Card title="ตำแหน่งในบริษัท" icon={<WorkOutline />}>
            <Field icon={<BadgeOutlined />} label="ตำแหน่งในองค์กร (Rank)" value={rank || "-"} />
            <Field icon={<WorkOutline />} label="ตำแหน่งที่พิมพ์ในเอกสาร" value={user.jobTitle || `${rank || "-"} (ใช้ชื่อตำแหน่งในองค์กร)`} muted={!user.jobTitle} />
            <Field icon={<ApartmentOutlined />} label="แผนก" value={dept ? DEPARTMENT_LABEL[dept] : "ส่วนกลาง / บริหาร"} />
            <Field icon={<AdminPanelSettingsOutlined />} label={`สิทธิ์ในระบบ (Role) · ${systemRoleLabel(user)}`} value={SYSTEM_ROLE_DESC[sysRole] || "-"} />
          </Card>

          <Card title="การตั้งค่าที่เกี่ยวข้อง" icon={<DrawOutlined />}>
            {[
              {
                icon: <DrawOutlined />, label: "ลายเซ็นอิเล็กทรอนิกส์",
                value: signature === undefined ? "กำลังตรวจสอบ..." : signature ? "ตั้งไว้แล้ว — ใช้กับเอกสารที่คุณออก/อนุมัติ" : "ยังไม่ได้ตั้ง",
                ok: Boolean(signature),
              },
              {
                icon: <NotificationsNoneOutlined />, label: "การแจ้งเตือนบนอุปกรณ์นี้",
                value: push === null ? "ตั้งค่าได้ที่หน้าการตั้งค่า" : push ? "เปิดรับอยู่" : "ยังไม่เปิด",
                ok: push,
              },
            ].map((r) => (
              <Stack key={r.label} direction="row" alignItems="center" spacing={1.5} onClick={() => navigate("/about")}
                sx={{ px: 2, py: 1.25, cursor: "pointer", borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, "&:hover": { bgcolor: SURFACE } }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: SURFACE, color: MUTED, "& svg": { fontSize: 18 } }}>{r.icon}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600 }}>{r.label}</Typography>
                  <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 700, color: r.ok ? "#15803d" : r.ok === false ? "#b45309" : INK_2 }}>{r.value}</Typography>
                </Box>
                <ChevronRight sx={{ color: FAINT }} />
              </Stack>
            ))}
          </Card>
        </Stack>

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Card title="สิ่งที่คุณทำได้ในระบบ" icon={<AdminPanelSettingsOutlined />}
            right={<Typography sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700 }}>ตามตำแหน่งของคุณ</Typography>}>
            {CAPS.map(([group, items]) => (
              <Box key={group} sx={{ px: 2, py: 1.25, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED, mb: 0.75 }}>{group}</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, rowGap: 0.6, columnGap: 1.5 }}>
                  {items.map(([cap, label]) => {
                    const ok = can(cap);
                    return (
                      <Stack key={cap} direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        {ok ? <CheckCircle sx={{ fontSize: 17, color: "#16a34a" }} /> : <RemoveCircleOutline sx={{ fontSize: 17, color: "#cbd5e1" }} />}
                        <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: ok ? 700 : 500, color: ok ? INK : FAINT }}>{label}</Typography>
                      </Stack>
                    );
                  })}
                </Box>
              </Box>
            ))}
            <Typography sx={{ px: 2, py: 1.1, fontSize: "0.72rem", color: MUTED, bgcolor: SURFACE, borderTop: `1px solid ${LINE}` }}>
              ต้องการสิทธิ์เพิ่ม ติดต่อผู้ดูแลระบบ (Super Admin)
            </Typography>
          </Card>

          <Card title="ข้อมูลบัญชี" icon={<EventOutlined />}>
            <Field icon={<EventOutlined />} label="สร้างบัญชีเมื่อ" value={user.createdAt ? `${formatThai(moment(user.createdAt), "D MMMM YYYY")} · ${moment(user.createdAt).locale("th").fromNow()}` : "-"} />
            <Field icon={<UpdateOutlined />} label="แก้ไขข้อมูลล่าสุด" value={user.updatedAt ? `${formatThai(moment(user.updatedAt), "D MMM YYYY HH:mm")} น.` : "-"} />
          </Card>
        </Stack>
      </Box>

      {/* ── แก้ไขข้อมูล ── */}
      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", fontWeight: 800, borderBottom: `1px solid ${LINE}` }}>
          <Box sx={{ flex: 1 }}>แก้ไขข้อมูลส่วนตัว</Box>
          <IconButton size="small" onClick={() => setEditOpen(false)} disabled={saving}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "20px !important" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField label="ชื่อ" value={form.fname} onChange={(e) => setForm({ ...form, fname: e.target.value })} size="small" fullWidth />
            <TextField label="นามสกุล" value={form.lname} onChange={(e) => setForm({ ...form, lname: e.target.value })} size="small" fullWidth />
            <TextField label="เบอร์โทร" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} size="small" fullWidth inputProps={{ inputMode: "tel" }} />
            <TextField label="ตำแหน่งที่พิมพ์ในเอกสาร" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              size="small" fullWidth placeholder={rank} helperText="เว้นว่าง = ใช้ชื่อตำแหน่งในองค์กร" />
          </Box>
          <Typography sx={{ mt: 2, fontSize: "0.76rem", color: MUTED }}>
            อีเมล ชื่อผู้ใช้ ตำแหน่งในองค์กร และสิทธิ์ในระบบ แก้ไขได้โดยผู้ดูแลระบบเท่านั้น
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditOpen(false)} disabled={saving} sx={{ textTransform: "none", color: MUTED, fontWeight: 700 }}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving || !form.fname.trim()}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {toast ? <Alert severity={toast.type} variant="filled" onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
