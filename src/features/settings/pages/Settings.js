/**
 * Settings — หน้า "การตั้งค่า"
 *
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "แก้ไขหน้าตั้งค่าใหม่ ใช้ยาก ไม่สวย · มืออาชีพ ละเอียด สมบูรณ์"
 *    + "อยากเห็นว่าบัญชีเข้าไว้ที่อุปกรณ์อะไรบ้าง ชื่ออะไร ที่ไหน อย่างละเอียด"
 *   • จัดเป็นกลุ่มแบบรายการตั้งค่ามาตรฐาน: หัวกลุ่ม → กล่องขาว 1 กล่อง → แถวคั่นเส้นบาง (เดิมทุกแถวเป็นการ์ดลอยแยกกัน)
 *   • เพิ่ม "อุปกรณ์ที่เข้าสู่ระบบ": ชนิดเครื่อง/รุ่น · เบราว์เซอร์ · ระบบปฏิบัติการ · ตำแหน่งโดยประมาณ + IP
 *     · เวลาใช้งานล่าสุด · ออกจากระบบทีละเครื่อง หรือทุกเครื่องยกเว้นเครื่องนี้
 *   • (5 ต.ค. 2569) "จุดนี้ให้เป็นเมนูแยกไปแสดงอีกหน้า หน้าแรกมันรกไป" — รายการอุปกรณ์ย้ายไปหน้า
 *     /settings/devices (LoginDevices.js) หน้านี้เหลือแถวสรุปจำนวนเครื่องแถวเดียว
 *   • ธีมเดียวกับทั้งแอป (ขาว · เทา · น้ำเงิน) · ใช้สีแดงเฉพาะปุ่มออกจากระบบ
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Avatar, Switch, CircularProgress, Snackbar, Alert,
} from "@mui/material";
import {
  ChevronRight, DrawOutlined, NotificationsActiveOutlined, NotificationsOffOutlined, BusinessOutlined,
  GroupOutlined, LocalOfferOutlined, ImageOutlined, AdminPanelSettingsOutlined, InfoOutlined, Logout,
  DevicesOther, PersonOutline,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import PushService from "@/shared/services/PushService";
import SessionService from "@/shared/services/SessionService";
import SignatureService from "@/shared/services/SignatureService";
import { swalLogout, hasValidAvatar } from "@/shared/utils/user";
import { can, rankLabel, systemRoleLabel } from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import useOrgSettings from "@/shared/hooks/useOrgSettings";
import { APP_NAME, APP_VERSION } from "@/shared/appInfo";
import { dest, DEST } from "@/layouts/navConfig";
import { ORG_FALLBACK } from "@/shared/services/OrgSettingService";
import SignatureSettingsDialog from "../components/SignatureSettingsDialog";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";

const GREEN = "#16a34a";
const RED = "#dc2626";
const AMBER = "#b45309";
/** ใช้งานภายใน 5 นาที = กำลังใช้งาน (ตรงกับหน้า LoginDevices) */
const isActive = (x) => moment().diff(moment(x.lastSeenAt), "minutes") < 5;

/** หัวกลุ่ม + กล่องขาว */
const Group = ({ title, hint, right, children }) => (
  <Box sx={{ mb: 2.5 }}>
    <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ px: 0.5, mb: 0.75 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: MUTED, letterSpacing: ".02em" }}>{title}</Typography>
        {hint && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{hint}</Typography>}
      </Box>
      {right}
    </Stack>
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      {children}
    </Box>
  </Box>
);

/** แถวตั้งค่า 1 แถว — กดได้ (onClick) หรือมีตัวควบคุมทางขวา (right) */
const Row = ({ icon, tone = ACCENT, title, desc, right, onClick, danger }) => (
  <Stack
    direction="row" alignItems="center" spacing={1.5} onClick={onClick}
    role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    sx={{
      px: 2, py: 1.4, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 },
      cursor: onClick ? "pointer" : "default", "&:hover": onClick ? { bgcolor: SURFACE } : undefined,
      "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: -2 },
    }}
  >
    <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${tone}14`, color: tone, "& svg": { fontSize: 20 } }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: danger ? RED : INK }}>{title}</Typography>
      {desc && <Typography component="div" sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.15, lineHeight: 1.45 }}>{desc}</Typography>}
    </Box>
    {right !== undefined ? right : onClick ? <ChevronRight sx={{ color: FAINT }} /> : null}
  </Stack>
);

export default function Settings() {
  const { userData, logout } = useAuth();
  const org = useOrgSettings();
  const navigate = useNavigate();
  const isAdmin = can(userData, "manageAll");
  const isSuperAdmin = can(userData, "manageSystem");

  // ── การแจ้งเตือน ──
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState("default");
  const [pushDevices, setPushDevices] = useState(null);
  const pushSupported = PushService.isSupported();
  const iosNeedsInstall = PushService.isIos() && !PushService.isStandalone();
  const loadPushStatus = useCallback(() => {
    PushService.getPermissionState().then(setPushPermission).catch(() => {});
    PushService.status().then((st) => setPushDevices(st.devices)).catch(() => {});
    if (PushService.isSupported()) PushService.isSubscribed().then(setPushSubscribed).catch(() => {});
  }, []);

  // ── ลายเซ็น ──
  const [signOpen, setSignOpen] = useState(false);
  const [hasSignature, setHasSignature] = useState(null);

  // ── อุปกรณ์ที่เข้าสู่ระบบ (แค่สรุปจำนวน — รายการเต็มอยู่หน้า /settings/devices) ──
  const [sessions, setSessions] = useState(null);
  const [toast, setToast] = useState(null);

  const loadSessions = useCallback(() => {
    SessionService.list().then(setSessions).catch(() => setSessions(false));
  }, []);

  useEffect(() => {
    loadPushStatus();
    SignatureService.me().then((sig) => setHasSignature(Boolean(sig))).catch(() => setHasSignature(false));
    loadSessions();
  }, [loadPushStatus, loadSessions]);

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      if (pushSubscribed) { await PushService.unsubscribe(); setPushSubscribed(false); setToast({ type: "success", text: "ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว" }); }
      else { await PushService.subscribe(); setPushSubscribed(true); setToast({ type: "success", text: "เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว" }); }
    } catch (error) {
      setToast({ type: "error", text: error.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setPushLoading(false);
      loadPushStatus();
    }
  };

  /** ✅ จุดออกจากระบบจุดเดียวของทั้งแอป (ผู้ใช้สั่ง "ให้เหลือแค่จุดเดียว") */
  const handleLogout = async () => {
    const result = await swalLogout();
    if (result.isConfirmed) logout();
  };

  const fullName = userData?.fname ? `${userData.fname} ${userData?.lname || ""}`.trim() : (userData?.username || "ผู้ใช้งาน");
  const nameKey = userData?.fname || userData?.username;
  const others = (sessions || []).filter((x) => !x.current);
  const activeOthers = others.filter(isActive).length;

  const pushState = iosNeedsInstall
    ? { tone: AMBER, text: "iPhone/iPad: เปิดแอปจากไอคอนบนหน้าจอโฮมก่อน — Safari กดปุ่มแชร์ → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น" }
    : !pushSupported
      ? { tone: AMBER, text: "เบราว์เซอร์นี้ไม่รองรับ — ใช้ Chrome (Android/คอม) หรือ Safari ที่ติดตั้งแอปลงหน้าจอโฮม (iPhone)" }
      : pushPermission === "denied"
        ? { tone: RED, text: "เบราว์เซอร์บล็อกการแจ้งเตือนไว้ — กดไอคอนแม่กุญแจหน้า URL → การแจ้งเตือน → อนุญาต แล้วเปิดสวิตช์อีกครั้ง" }
        : null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 860, mx: "auto" }}>
      <Box sx={{ mb: 2.5, px: 0.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1.4rem", color: INK }}>การตั้งค่า</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>บัญชี · ความปลอดภัย · การแจ้งเตือน · ข้อมูลระบบ</Typography>
      </Box>

      {/* ── โปรไฟล์ ── */}
      <Box onClick={() => navigate("/account")} role="button" tabIndex={0}
        sx={{ mb: 2.5, p: 2, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)", "&:hover": { borderColor: ACCENT_LINE } }}>
        <Avatar src={hasValidAvatar(userData?.imageUrl) ? getOptimizedImageUrl(userData.imageUrl, { width: 128 }) : undefined}
          sx={{ width: 56, height: 56, fontSize: 22, fontWeight: 800, bgcolor: personColor(nameKey) }}>
          {personInitial(nameKey)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 900, fontSize: "1.05rem", color: INK }}>{fullName}</Typography>
          <Typography noWrap sx={{ fontSize: "0.8rem", color: MUTED }}>{userData?.email || `@${userData?.username || ""}`}</Typography>
          <Stack direction="row" spacing={0.6} useFlexGap sx={{ mt: 0.6, flexWrap: "wrap", rowGap: 0.5 }}>
            <Box component="span" sx={{ px: 0.9, py: 0.2, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, bgcolor: ACCENT_SOFT, color: "#1d4ed8" }}>{rankLabel(userData)}</Box>
            <Box component="span" sx={{ px: 0.9, py: 0.2, borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, bgcolor: SURFACE, color: INK_2, border: `1px solid ${LINE}` }}>{systemRoleLabel(userData)}</Box>
          </Stack>
        </Box>
        <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.8rem", fontWeight: 700, color: ACCENT }}>ดูบัญชีของฉัน</Typography>
        <ChevronRight sx={{ color: FAINT }} />
      </Box>

      {/* ── บัญชีและความปลอดภัย ── */}
      <Group title="บัญชีและความปลอดภัย">
        <Row icon={<PersonOutline />} title="บัญชีของฉัน" desc="รูปโปรไฟล์ · ชื่อ · เบอร์โทร · ตำแหน่งที่พิมพ์ในเอกสาร" onClick={() => navigate("/account")} />
        <Row
          icon={<DrawOutlined />} tone={hasSignature ? GREEN : MUTED} title="ลายเซ็นอิเล็กทรอนิกส์" onClick={() => setSignOpen(true)}
          desc={hasSignature === null ? "กำลังตรวจสอบ..." : hasSignature
            ? <Box component="span" sx={{ color: GREEN, fontWeight: 600 }}>ตั้งไว้แล้ว — ใช้กับใบเบิก/ใบเคลม/ใบส่งมอบงานที่คุณออกหรืออนุมัติ</Box>
            : "ยังไม่ได้ตั้ง — เอกสารจะเว้นช่องให้เซ็นด้วยมือ"}
        />
        <Row
          icon={<DevicesOther />} title="อุปกรณ์ที่เข้าสู่ระบบ" onClick={() => navigate("/settings/devices")}
          desc={sessions === null ? "กำลังตรวจสอบ..." : sessions === false
            ? "ดูเครื่องที่บัญชีนี้เข้าสู่ระบบอยู่ · ออกจากระบบเครื่องที่ไม่รู้จัก"
            : <>
                {sessions.length} เครื่อง
                {others.length > 0 ? ` · เครื่องอื่น ${others.length}` : " · มีแค่เครื่องนี้"}
                {activeOthers > 0 && <Box component="span" sx={{ color: GREEN, fontWeight: 600 }}>{` · กำลังใช้งาน ${activeOthers}`}</Box>}
                {" · ดูรุ่น ตำแหน่ง และออกจากระบบรายเครื่อง"}
              </>}
          right={(
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {sessions && <Box component="span" sx={{ minWidth: 24, height: 22, px: 0.75, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, bgcolor: SURFACE, color: INK_2, border: `1px solid ${LINE}` }}>{sessions.length}</Box>}
              <ChevronRight sx={{ color: FAINT }} />
            </Stack>
          )}
        />
      </Group>

      {/* ── การแจ้งเตือน ── */}
      <Group title="การแจ้งเตือน">
        <Row
          icon={pushSubscribed ? <NotificationsActiveOutlined /> : <NotificationsOffOutlined />} tone={pushSubscribed ? ACCENT : MUTED}
          title="การแจ้งเตือนบนอุปกรณ์นี้"
          desc={pushState
            ? <Box component="span" sx={{ color: pushState.tone }}>{pushState.text}</Box>
            : <>
                {pushSubscribed ? <Box component="span" sx={{ color: GREEN, fontWeight: 600 }}>เปิดรับอยู่</Box> : "ปิดอยู่"}
                {pushDevices !== null ? ` · บัญชีของคุณเปิดรับไว้ ${pushDevices} อุปกรณ์` : ""}
                <br />เด้งบนจอเหมือน LINE: งานใหม่/มอบหมายงาน · ขอปิดงาน · ใบเบิก · OT · ใบขอซื้อ · คำขอจากเว็บ (เฉพาะที่เกี่ยวกับคุณ)
              </>}
          right={pushLoading ? <CircularProgress size={22} /> : (
            <Switch checked={pushSubscribed} disabled={!pushSupported || iosNeedsInstall || pushPermission === "denied"} onChange={handleTogglePush}
              sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: ACCENT }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: ACCENT } }} />
          )}
        />
      </Group>

      {/* ── ข้อมูลหลัก ── */}
      {isAdmin && (
        <Group title="ข้อมูลหลัก" hint="ทะเบียนที่ทั้งระบบหยิบไปใช้">
          <Row icon={<BusinessOutlined />} title={dest("customers").title} desc="ทะเบียนลูกค้าและผู้ติดต่อ · ใช้เลือกตอนเปิดงานและออกเอกสาร" onClick={() => navigate(dest("customers").href)} />
          <Row icon={<GroupOutlined />} title="พนักงาน" desc="ทะเบียนพนักงาน · บัญชีผู้ใช้ · ตำแหน่งในองค์กรของแต่ละคน" onClick={() => navigate(dest("staff").href)} />
          <Row icon={<LocalOfferOutlined />} title={dest("worktype").title} desc={DEST.worktype.sub} onClick={() => navigate(dest("worktype").href)} />
        </Group>
      )}

      {/* ── ตั้งค่าระบบ ── */}
      {isSuperAdmin && (
        <Group title="ตั้งค่าระบบ" hint="เฉพาะ Super Admin">
          <Row icon={<ImageOutlined />} title={dest("orgSettings").title} desc={DEST.orgSettings.sub} onClick={() => navigate(dest("orgSettings").href)} />
          <Row icon={<AdminPanelSettingsOutlined />} title={dest("permissions").title} desc={DEST.permissions.sub} onClick={() => navigate(dest("permissions").href)} />
        </Group>
      )}

      {/* ── เกี่ยวกับแอป + ออกจากระบบ ── */}
      <Group title="เกี่ยวกับ">
        <Row icon={<InfoOutlined />} tone={MUTED} title={`${APP_NAME} · เวอร์ชัน ${APP_VERSION || "-"}`} desc={`ใช้งานในนาม ${org?.nameTh || ORG_FALLBACK.nameTh}`} right={null} />
        <Row icon={<Logout />} tone={RED} title="ออกจากระบบ" desc="ออกจากระบบบนอุปกรณ์นี้" danger onClick={handleLogout} right={null} />
      </Group>

      <SignatureSettingsDialog open={signOpen} onClose={() => setSignOpen(false)} onSaved={(sig) => setHasSignature(Boolean(sig))} />
      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {toast ? <Alert severity={toast.type} variant="filled" onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
