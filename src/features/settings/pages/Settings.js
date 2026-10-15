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
  Box, Stack, Typography, Avatar, Switch, CircularProgress, Snackbar, Alert, Button, Collapse,
} from "@mui/material";
import {
  ChevronRight, DrawOutlined, NotificationsActiveOutlined, NotificationsOffOutlined, BusinessOutlined,
  GroupOutlined, LocalOfferOutlined, ImageOutlined, AdminPanelSettingsOutlined, InfoOutlined, Logout,
  DevicesOther, PersonOutline, SendToMobileOutlined, TuneOutlined, ExpandMore,
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
import { APP_NAME, APP_VERSION_LABEL } from "@/shared/appInfo";
import { dest, DEST } from "@/layouts/navConfig";
import { ORG_FALLBACK } from "@/shared/services/OrgSettingService";
import SignatureSettingsDialog from "../components/SignatureSettingsDialog";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";

const GREEN = "#16a34a";
const RED = "#dc2626";
const AMBER = "#b45309";
/** ใช้งานภายใน 5 นาที = กำลังใช้งาน (ตรงกับหน้า LoginDevices) */
const isActive = (x) => moment().diff(moment(x.lastSeenAt), "minutes") < 5;

/**
 * 🔁 (15 ต.ค. 2569 ผู้ใช้: "ทำให้ง่ายๆ" → "เอาคู่มือกลับมา แค่ไม่มีคำว่าแบบ LINE") — สวิตช์ + ปุ่มทดสอบ + คำแนะนำบรรทัดเดียว
 *    และคู่มือตั้งค่าเครื่องแบบพับไว้ (เปิดเมื่ออยากดูขั้นตอนเต็ม) เลือกเครื่องให้อัตโนมัติ
 *    ⚠️ "เด้งทับหน้าจอ" เป็นสิทธิ์ของระบบเครื่อง เว็บแอปเปิดเองไม่ได้ — Android ส่วนใหญ่เปิดไว้แล้วตั้งแต่แรก
 *       ทางที่สั้นที่สุดถ้าไม่เด้ง: กดค้างที่แจ้งเตือนทดสอบ → ตั้งค่า (ไปถึงหน้าที่ถูกต้องในแตะเดียว)
 */
const HEADS_UP_GUIDE = {
  android: {
    label: "Android",
    steps: [
      "เปิด ตั้งค่าเครื่อง → แอปพลิเคชัน → TidTam (ถ้าติดตั้งแอปไว้บนหน้าจอ) หรือ Chrome → การแจ้งเตือน",
      "เปิด “อนุญาตการแจ้งเตือน” แล้วแตะหมวดของ TidTam / เว็บไซต์ของเรา",
      "เลือก “แจ้งเตือน (มีเสียง)” และเปิด “แสดงบนหน้าจอ / ป๊อปอัป” (Pop on screen)",
      "แบตเตอรี่ของแอปเดียวกัน → ตั้งเป็น “ไม่จำกัด” เพื่อไม่ให้เครื่องหน่วงแจ้งเตือนตอนพักหน้าจอ",
      "Samsung: ตั้งค่า → การแจ้งเตือน → รูปแบบป๊อปอัป → เลือก “รายละเอียด” และตรวจว่าไม่ได้เปิดโหมดห้ามรบกวน",
    ],
  },
  ios: {
    label: "iPhone / iPad",
    steps: [
      "ต้องเปิดแอปจากไอคอนบนหน้าจอโฮม (Safari → แชร์ → “เพิ่มไปยังหน้าจอโฮม”) · iOS 16.4 ขึ้นไป",
      "ตั้งค่า → การแจ้งเตือน → TidTam → เปิด “อนุญาตการแจ้งเตือน”",
      "เปิดการแจ้งเตือนแบบ “แบนเนอร์” และเลือกรูปแบบแบนเนอร์ “ถาวร” ให้ค้างบนจอจนกว่าจะปัดออก",
      "เปิด “เสียง” และตรวจว่าโหมดโฟกัส/ห้ามรบกวนไม่ได้ปิดกั้น TidTam",
    ],
  },
  desktop: {
    label: "คอมพิวเตอร์",
    steps: [
      "Windows: ตั้งค่า → ระบบ → การแจ้งเตือน → เปิด Chrome / Edge และ “แสดงแบนเนอร์การแจ้งเตือน”",
      "Mac: การตั้งค่าระบบ → การแจ้งเตือน → Chrome → รูปแบบ “การแจ้งเตือน” (ค้างจนกว่าจะปิด)",
      "ปิดโหมดโฟกัส/ห้ามรบกวนในช่วงเวลาทำงาน",
    ],
  },
};
const detectPlatform = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (PushService.isIos()) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
};

const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
const HEADS_UP_HINT = () => (PushService.isIos()
  ? "ไม่เด้งบนจอ? ตั้งค่าเครื่อง → การแจ้งเตือน → TidTam → เปิด “แบนเนอร์”"
  : isAndroid()
    ? "ไม่เด้งบนจอ? กดค้างที่แจ้งเตือน → ตั้งค่า → เปิด “ป๊อปอัป / แสดงบนหน้าจอ”"
    : "ไม่เด้งบนจอ? เปิดการแจ้งเตือนของ Chrome ในตั้งค่าเครื่อง");
/** เปิดหน้าเดิมในแอป Chrome (เบราว์เซอร์ในแอปอื่น เช่น LINE/Facebook รับแจ้งเตือนไม่ได้) */
const openInChrome = () => {
  const { host, pathname, search } = window.location;
  window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
};

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
  const canMasterData = can(userData, "manageMasterData");

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

  // ── ทดสอบแจ้งเตือน: ส่งหน่วง 5 วินาที ให้ผู้ใช้ออกจากแอป/ล็อกจอทัน (แอปเปิดอยู่จะเด้งเป็นแบนเนอร์ในแอปแทน) ──
  const [testCountdown, setTestCountdown] = useState(0);
  const [testSent, setTestSent] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState(detectPlatform);
  useEffect(() => {
    if (testCountdown <= 0) return undefined;
    const t = setTimeout(() => setTestCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [testCountdown]);
  const handleTestPush = async () => {
    try {
      await PushService.test(5);
      setTestCountdown(5);
      setTestSent(true);
      setToast({ type: "info", text: "ออกจากแอปได้เลย — แจ้งเตือนจะเด้งใน 5 วินาที" });
    } catch (error) {
      setToast({ type: "error", text: error?.response?.data?.message || "ส่งแจ้งเตือนทดสอบไม่สำเร็จ" });
    }
  };

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
      ? { tone: AMBER, text: isAndroid() ? "เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้ — เปิดใน Chrome" : "เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้ — ใช้ Chrome" }
      : pushPermission === "denied"
        ? { tone: RED, text: "เบราว์เซอร์บล็อกการแจ้งเตือนไว้ — กดไอคอนแม่กุญแจหน้า URL → การแจ้งเตือน → อนุญาต แล้วเปิดสวิตช์อีกครั้ง" }
        : null;

  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.5, sm: 2.5 }, maxWidth: 860, mx: "auto" }}>
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
            : pushSubscribed
              ? <><Box component="span" sx={{ color: GREEN, fontWeight: 600 }}>เปิดรับอยู่</Box>{pushDevices ? ` · ${pushDevices} อุปกรณ์` : ""}</>
              : "เปิดสวิตช์เพื่อรับแจ้งเตือนงานที่เกี่ยวกับคุณ"}
          right={!pushSupported && !iosNeedsInstall && isAndroid()
            ? (
              <Button size="small" variant="contained" disableElevation onClick={openInChrome}
                sx={{ flexShrink: 0, borderRadius: 2, fontWeight: 800, bgcolor: ACCENT }}>
                เปิดใน Chrome
              </Button>
            )
            : pushLoading ? <CircularProgress size={22} /> : (
              <Switch checked={pushSubscribed} disabled={!pushSupported || iosNeedsInstall || pushPermission === "denied"} onChange={handleTogglePush}
                sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: ACCENT }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: ACCENT } }} />
            )}
        />
        {pushSubscribed && (
          <Row
            icon={<SendToMobileOutlined />} tone={GREEN}
            title="ทดสอบแจ้งเตือน"
            desc={testCountdown > 0
              ? <Box component="span" sx={{ color: GREEN, fontWeight: 700 }}>ออกจากแอปได้เลย — เด้งใน {testCountdown} วินาที</Box>
              : testSent ? HEADS_UP_HINT() : "กดแล้วออกจากแอป แจ้งเตือนจะเด้งขึ้นบนจอ"}
            right={(
              <Button size="small" variant="contained" disableElevation disabled={testCountdown > 0} onClick={handleTestPush}
                sx={{ flexShrink: 0, borderRadius: 2, fontWeight: 800, bgcolor: GREEN, "&:hover": { bgcolor: "#15803d" } }}>
                {testCountdown > 0 ? testCountdown : "ทดสอบ"}
              </Button>
            )}
          />
        )}
        <Row
          icon={<TuneOutlined />}
          title="วิธีตั้งค่าให้แจ้งเตือนเด้งทับหน้าจอ"
          desc="ตั้งค่าเครื่องครั้งเดียว — ให้แจ้งเตือนขึ้นแบนเนอร์บนจอพร้อมเสียง แม้กำลังใช้แอปอื่นอยู่"
          onClick={() => setGuideOpen((o) => !o)}
          right={<ExpandMore sx={{ color: FAINT, transition: "transform .2s", transform: guideOpen ? "rotate(180deg)" : "none" }} />}
        />
        <Collapse in={guideOpen} unmountOnExit>
          <Box sx={{ px: 2, pb: 2, pt: 0.5, borderTop: `1px solid ${LINE}`, bgcolor: SURFACE }}>
            <Stack direction="row" gap={0.75} sx={{ my: 1.25, flexWrap: "wrap" }}>
              {Object.entries(HEADS_UP_GUIDE).map(([key, g]) => {
                const on = guidePlatform === key;
                return (
                  <Box key={key} component="button" type="button" onClick={() => setGuidePlatform(key)}
                    sx={{ height: 32, px: 1.5, borderRadius: 99, font: "inherit", cursor: "pointer", fontSize: "0.8rem",
                      fontWeight: on ? 800 : 600, color: on ? "#fff" : INK_2, bgcolor: on ? ACCENT : "#fff",
                      border: `1px solid ${on ? ACCENT : LINE}` }}>
                    {g.label}
                  </Box>
                );
              })}
            </Stack>
            <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 1 }}>
              {HEADS_UP_GUIDE[guidePlatform].steps.map((t, i) => (
                <Box component="li" key={t} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                  <Box sx={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", bgcolor: ACCENT_SOFT, color: ACCENT,
                    border: `1px solid ${ACCENT_LINE}`, display: "grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 800 }}>{i + 1}</Box>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.5 }}>{t}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ mt: 1.5, fontSize: "0.76rem", color: MUTED, lineHeight: 1.5 }}>
              ตั้งเสร็จแล้วกด “ทดสอบ” ด้านบน แล้วออกจากแอป — ถ้าแบนเนอร์เด้งลงมาจากขอบบนจอพร้อมเสียง แปลว่าใช้งานได้ครบ
            </Typography>
          </Box>
        </Collapse>
      </Group>

      {/* ── ข้อมูลหลัก ── */}
      {/* ✅ (8 ต.ค. 2569) แต่ละแถวโชว์ตามสิทธิ์ที่ใช้เปิดหน้านั้นจริง — เดิมโชว์ทั้งกลุ่มตาม Role แล้วกดเข้าไปโดนเด้งกลับ
          บัญชีผู้ใช้ = สิทธิ์ระบบ (Role) · ลูกค้า/ประเภทงาน = สิทธิ์ทำงาน “จัดการข้อมูลหลัก” (Rank) */}
      {(isAdmin || canMasterData) && (
        <Group title="ข้อมูลหลัก" hint="ทะเบียนที่ทั้งระบบหยิบไปใช้">
          {canMasterData && <Row icon={<BusinessOutlined />} title={dest("customers").title} desc="ทะเบียนลูกค้าและผู้ติดต่อ · ใช้เลือกตอนเปิดงานและออกเอกสาร" onClick={() => navigate(dest("customers").href)} />}
          <Row icon={<GroupOutlined />} title={isAdmin ? "พนักงานและบัญชีผู้ใช้" : "ภาระงานทีมช่าง"} desc={isAdmin ? "ทะเบียนพนักงาน · เพิ่ม/แก้บัญชีผู้ใช้ · ตำแหน่งในองค์กรของแต่ละคน" : "งานที่ช่างแต่ละคนถืออยู่"} onClick={() => navigate(isAdmin ? "/staff?tab=registry" : dest("staff").href)} />
          {canMasterData && <Row icon={<LocalOfferOutlined />} title={dest("worktype").title} desc={DEST.worktype.sub} onClick={() => navigate(dest("worktype").href)} />}
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
        <Row icon={<InfoOutlined />} tone={MUTED} title={`${APP_NAME} · เวอร์ชัน ${APP_VERSION_LABEL || "-"}`} desc={`ใช้งานในนาม ${org?.nameTh || ORG_FALLBACK.nameTh}`} right={null} />
        <Row icon={<Logout />} tone={RED} title="ออกจากระบบ" desc="ออกจากระบบบนอุปกรณ์นี้" danger onClick={handleLogout} right={null} />
      </Group>

      <SignatureSettingsDialog open={signOpen} onClose={() => setSignOpen(false)} onSaved={(sig) => setHasSignature(Boolean(sig))} />
      <Snackbar open={Boolean(toast)} autoHideDuration={toast?.type === "info" ? 4500 : 2600} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {toast ? <Alert severity={toast.type} variant="filled" onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
