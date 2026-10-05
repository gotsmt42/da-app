/**
 * Settings — หน้า "การตั้งค่า"
 *
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "แก้ไขหน้าตั้งค่าใหม่ ใช้ยาก ไม่สวย · มืออาชีพ ละเอียด สมบูรณ์"
 *    + "อยากเห็นว่าบัญชีเข้าไว้ที่อุปกรณ์อะไรบ้าง ชื่ออะไร ที่ไหน อย่างละเอียด"
 *   • จัดเป็นกลุ่มแบบรายการตั้งค่ามาตรฐาน: หัวกลุ่ม → กล่องขาว 1 กล่อง → แถวคั่นเส้นบาง (เดิมทุกแถวเป็นการ์ดลอยแยกกัน)
 *   • เพิ่ม "อุปกรณ์ที่เข้าสู่ระบบ": ชนิดเครื่อง/รุ่น · เบราว์เซอร์ · ระบบปฏิบัติการ · ตำแหน่งโดยประมาณ + IP
 *     · เวลาใช้งานล่าสุด · ออกจากระบบทีละเครื่อง หรือทุกเครื่องยกเว้นเครื่องนี้
 *   • ธีมเดียวกับทั้งแอป (ขาว · เทา · น้ำเงิน) · ใช้สีแดงเฉพาะปุ่มออกจากระบบ
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Avatar, Switch, Button, IconButton, Tooltip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Alert, Skeleton,
} from "@mui/material";
import {
  ChevronRight, DrawOutlined, NotificationsActiveOutlined, NotificationsOffOutlined, BusinessOutlined,
  GroupOutlined, LocalOfferOutlined, ImageOutlined, AdminPanelSettingsOutlined, InfoOutlined, Logout,
  LaptopMac, PhoneIphone, TabletMac, DevicesOther, PlaceOutlined, Refresh, CheckCircle, PersonOutline,
  ShieldOutlined, InstallMobile,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import PushService from "@/shared/services/PushService";
import SessionService from "@/shared/services/SessionService";
import SignatureService from "@/shared/services/SignatureService";
import { swalLogout, hasValidAvatar } from "@/shared/utils/user";
import { can, rankLabel, systemRoleLabel } from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import { formatThai } from "@/shared/utils/thaiDate";
import useOrgSettings from "@/shared/hooks/useOrgSettings";
import { APP_NAME, APP_VERSION } from "@/shared/appInfo";
import { dest, DEST } from "@/layouts/navConfig";
import { ORG_FALLBACK } from "@/shared/services/OrgSettingService";
import SignatureSettingsDialog from "../components/SignatureSettingsDialog";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";

const GREEN = "#16a34a";
const RED = "#dc2626";
const AMBER = "#b45309";

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

/** ชื่ออุปกรณ์ที่อ่านแล้วเข้าใจ */
const deviceTitle = (s) => {
  const model = [s.deviceVendor, s.deviceModel].filter(Boolean).join(" ").replace(/^Apple (iPhone|iPad)/, "$1");
  const osName = [s.os, s.osVersion].filter(Boolean).join(" ");
  if (model) return model;
  if (s.deviceType === "desktop" && osName) return `คอมพิวเตอร์ ${osName}`;
  if (osName) return `${s.deviceType === "tablet" ? "แท็บเล็ต" : "มือถือ"} ${osName}`;
  return "อุปกรณ์ไม่ทราบชนิด";
};
const deviceIcon = (t) => (t === "mobile" ? <PhoneIphone /> : t === "tablet" ? <TabletMac /> : t === "desktop" ? <LaptopMac /> : <DevicesOther />);
const placeOf = (loc = {}) => [loc.city, loc.region && loc.region !== loc.city ? loc.region : "", loc.country].filter(Boolean).join(", ");

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

  // ── อุปกรณ์ที่เข้าสู่ระบบ ──
  const [sessions, setSessions] = useState(null);
  const [sessError, setSessError] = useState("");
  const [confirm, setConfirm] = useState(null); // { type: "one"|"others", session? }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const loadSessions = useCallback(async () => {
    setSessError("");
    try { setSessions(await SessionService.list()); }
    catch (err) { setSessions([]); setSessError(err?.response?.data?.message || "โหลดรายการอุปกรณ์ไม่สำเร็จ"); }
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

  const doRevoke = async () => {
    setBusy(true);
    try {
      if (confirm.type === "others") {
        const r = await SessionService.revokeOthers();
        setToast({ type: "success", text: `ออกจากระบบอุปกรณ์อื่นแล้ว ${r.revoked || 0} เครื่อง` });
      } else {
        const r = await SessionService.revoke(confirm.session.sid);
        if (r.self) { logout(); return; }
        setToast({ type: "success", text: `ออกจากระบบ ${deviceTitle(confirm.session)} แล้ว` });
      }
      setConfirm(null);
      loadSessions();
    } catch (err) {
      setToast({ type: "error", text: err?.response?.data?.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const fullName = userData?.fname ? `${userData.fname} ${userData?.lname || ""}`.trim() : (userData?.username || "ผู้ใช้งาน");
  const nameKey = userData?.fname || userData?.username;
  const others = (sessions || []).filter((s) => !s.current);

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
      </Group>

      {/* ── อุปกรณ์ที่เข้าสู่ระบบ ── */}
      <Group
        title={`อุปกรณ์ที่เข้าสู่ระบบ${sessions ? ` (${sessions.length})` : ""}`}
        hint="เครื่องที่บัญชีนี้ยังเข้าสู่ระบบอยู่ · ตำแหน่งเป็นค่าประมาณจาก IP อินเทอร์เน็ต"
        right={(
          <Tooltip title="โหลดใหม่"><IconButton size="small" onClick={loadSessions}><Refresh sx={{ fontSize: 18 }} /></IconButton></Tooltip>
        )}
      >
        {sessions === null ? (
          <Box sx={{ p: 2 }}><Skeleton height={56} /><Skeleton height={56} /></Box>
        ) : sessError ? (
          <Typography sx={{ p: 2, fontSize: "0.86rem", color: RED }}>{sessError}</Typography>
        ) : sessions.length === 0 ? (
          <Typography sx={{ p: 2, fontSize: "0.86rem", color: MUTED }}>ยังไม่มีข้อมูลอุปกรณ์ — จะเริ่มบันทึกตั้งแต่การใช้งานครั้งถัดไป</Typography>
        ) : sessions.map((s) => {
          const browser = [s.browser, s.browserVersion?.split(".")[0]].filter(Boolean).join(" ");
          const osName = [s.os, s.osVersion].filter(Boolean).join(" ");
          const place = placeOf(s.location);
          const active = moment().diff(moment(s.lastSeenAt), "minutes") < 5;
          return (
            <Stack key={s.sid} direction="row" spacing={1.5} alignItems="flex-start"
              sx={{ px: 2, py: 1.5, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, bgcolor: s.current ? alpha8(ACCENT) : "transparent" }}>
              <Box sx={{ position: "relative", width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: s.current ? ACCENT_SOFT : SURFACE, color: s.current ? ACCENT : INK_2, border: `1px solid ${s.current ? ACCENT_LINE : LINE}`, "& svg": { fontSize: 22 } }}>
                {deviceIcon(s.deviceType)}
                {active && <Box sx={{ position: "absolute", right: -2, bottom: -2, width: 11, height: 11, borderRadius: "50%", bgcolor: GREEN, border: "2px solid #fff" }} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK }}>{deviceTitle(s)}</Typography>
                  {s.current && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.1, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, bgcolor: "#dcfce7", color: "#15803d" }}><CheckCircle sx={{ fontSize: 13 }} />อุปกรณ์นี้</Box>}
                  {s.standalone && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, px: 0.8, py: 0.1, borderRadius: 99, fontSize: "0.68rem", fontWeight: 700, bgcolor: SURFACE, color: INK_2, border: `1px solid ${LINE}` }}><InstallMobile sx={{ fontSize: 12 }} />แอปบนหน้าจอโฮม</Box>}
                </Stack>
                <Typography sx={{ fontSize: "0.8rem", color: INK_2, mt: 0.2 }}>
                  {[browser, osName && deviceTitle(s) !== `คอมพิวเตอร์ ${osName}` ? osName : ""].filter(Boolean).join(" · ") || "ไม่ทราบเบราว์เซอร์"}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.3, color: MUTED }}>
                  <PlaceOutlined sx={{ fontSize: 14, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, overflowWrap: "anywhere" }}>
                    {[place || "ไม่ทราบตำแหน่ง", s.ip ? `IP ${s.ip}` : "", s.location?.isp].filter(Boolean).join(" · ")}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 0.3 }}>
                  {active ? <Box component="span" sx={{ color: GREEN, fontWeight: 700 }}>กำลังใช้งาน</Box> : `ใช้งานล่าสุด ${moment(s.lastSeenAt).locale("th").fromNow()}`}
                  {s.createdAt ? ` · เข้าสู่ระบบ ${formatThai(moment(s.createdAt), "D MMM YY HH:mm")} น.` : ""}
                </Typography>
                {!s.current && (
                  <Box sx={{ display: { xs: "block", sm: "none" }, mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setConfirm({ type: "one", session: s })}
                  sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2, color: RED, borderColor: "#fecaca", "&:hover": { borderColor: RED, bgcolor: "#fef2f2" } }}>
                  ออกจากระบบ
                </Button>
                  </Box>
                )}
              </Box>
              {!s.current && (
                <Box sx={{ display: { xs: "none", sm: "block" } }}>
                  <Button size="small" variant="outlined" onClick={() => setConfirm({ type: "one", session: s })}
                  sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2, color: RED, borderColor: "#fecaca", "&:hover": { borderColor: RED, bgcolor: "#fef2f2" } }}>
                  ออกจากระบบ
                </Button>
                </Box>
              )}
            </Stack>
          );
        })}
        {others.length > 0 && (
          <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1, borderTop: `1px solid ${LINE}` }}>
            <Button startIcon={<Logout sx={{ fontSize: 17 }} />} onClick={() => setConfirm({ type: "others" })}
              sx={{ textTransform: "none", fontWeight: 800, color: RED, px: 1, "&:hover": { bgcolor: "#fef2f2" } }}>
              ออกจากระบบเครื่องอื่นทั้งหมด ({others.length})
            </Button>
          </Stack>
        )}
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ px: 2, py: 1.1, bgcolor: SURFACE, borderTop: `1px solid ${LINE}` }}>
          <ShieldOutlined sx={{ fontSize: 16, color: MUTED, mt: 0.2 }} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.5 }}>
            เห็นเครื่องที่ไม่รู้จัก ให้กด “ออกจากระบบ” ที่เครื่องนั้น แล้วแจ้งผู้ดูแลระบบให้เปลี่ยนรหัสผ่าน · เครื่องที่ถูกออกจากระบบจะต้องเข้าสู่ระบบใหม่
          </Typography>
        </Stack>
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

      {/* ยืนยันออกจากระบบอุปกรณ์อื่น */}
      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirm?.type === "others" ? `ออกจากระบบเครื่องอื่น ${others.length} เครื่อง?` : "ออกจากระบบอุปกรณ์นี้?"}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.9rem", color: INK_2 }}>
            {confirm?.type === "others"
              ? "ทุกเครื่องยกเว้นเครื่องที่คุณใช้อยู่ตอนนี้จะต้องเข้าสู่ระบบใหม่"
              : confirm?.session ? `${deviceTitle(confirm.session)} · ${[confirm.session.browser, placeOf(confirm.session.location)].filter(Boolean).join(" · ")} จะต้องเข้าสู่ระบบใหม่` : ""}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
          <Button variant="contained" onClick={doRevoke} disabled={busy}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: RED, "&:hover": { bgcolor: "#b91c1c", boxShadow: "none" } }}>
            {busy ? "กำลังดำเนินการ..." : "ออกจากระบบ"}
          </Button>
        </DialogActions>
      </Dialog>

      <SignatureSettingsDialog open={signOpen} onClose={() => setSignOpen(false)} onSaved={(sig) => setHasSignature(Boolean(sig))} />
      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {toast ? <Alert severity={toast.type} variant="filled" onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}

/** พื้นจางมากของแถวอุปกรณ์ปัจจุบัน */
function alpha8(hex) { return `${hex}0d`; }
