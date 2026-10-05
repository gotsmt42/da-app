/**
 * LoginDevices — หน้า "อุปกรณ์ที่เข้าสู่ระบบ" (การตั้งค่า → บัญชีและความปลอดภัย)
 *
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "จุดนี้ให้เป็นเมนูแยกไปแสดงอีกหน้า หน้าแรกมันรกไป ให้สมบูรณ์"
 *   • หน้าการตั้งค่าเหลือแถวเดียว (สรุปจำนวนเครื่อง) กดเข้ามาหน้านี้
 *   • สรุปบนสุด: ทั้งหมด · กำลังใช้งาน · เครื่องอื่น
 *   • "อุปกรณ์นี้" แยกกลุ่มของตัวเอง (ออกจากระบบเครื่องนี้ใช้ปุ่มในหน้าการตั้งค่า)
 *   • "อุปกรณ์อื่น" เรียงตามใช้งานล่าสุด · ออกจากระบบทีละเครื่อง หรือทุกเครื่องในคลิกเดียว
 *   • ตำแหน่งเป็นค่าประมาณจาก IP (อินเทอร์เน็ตมือถือมักขึ้นเป็นเมืองของผู้ให้บริการ ไม่ใช่ที่อยู่จริง)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Skeleton,
} from "@mui/material";
import {
  LaptopMac, PhoneIphone, TabletMac, DevicesOther, PlaceOutlined, Refresh, CheckCircle,
  ShieldOutlined, InstallMobile, Logout, Language, AccessTime, LoginOutlined,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import SessionService from "@/shared/services/SessionService";
import { formatThai } from "@/shared/utils/thaiDate";
import { marketingName } from "@/shared/utils/deviceNames";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE, SUCCESS } from "@/shared/ui/PageKit";

const RED = "#dc2626";

/**
 * ⚠️ Chrome บน Android ส่ง UA แบบลดข้อมูล "Android 10; K" ทุกเครื่อง (ผู้ใช้: "เข้าด้วย S25 Ultra แต่ขึ้น Android 10")
 *    — ถ้าไม่มีรุ่นเครื่อง/เลขเวอร์ชันจาก Client Hints เลข 10 นั้นเชื่อไม่ได้ จึงไม่แสดง
 */
const osLabel = (s) => {
  const ver = s.os === "Android" && s.osVersion === "10" && !s.deviceModel ? "" : s.osVersion;
  return [s.os, ver].filter(Boolean).join(" ");
};

/** ชื่ออุปกรณ์ที่อ่านแล้วเข้าใจ — รุ่นที่รู้จักใช้ชื่อทางการค้า (SM-S938B → Samsung Galaxy S25 Ultra) */
export const deviceTitle = (s) => {
  const known = marketingName(s.deviceVendor, s.deviceModel);
  if (known) return known;
  const model = [s.deviceVendor, s.deviceModel].filter(Boolean).join(" ").replace(/^Apple (iPhone|iPad)/, "$1");
  const osName = osLabel(s);
  if (model) return model;
  if (s.deviceType === "desktop" && osName) return `คอมพิวเตอร์ ${osName}`;
  if (osName) return `${s.deviceType === "tablet" ? "แท็บเล็ต" : "มือถือ"} ${osName}`;
  return "อุปกรณ์ไม่ทราบชนิด";
};
const deviceIcon = (t) => (t === "mobile" ? <PhoneIphone /> : t === "tablet" ? <TabletMac /> : t === "desktop" ? <LaptopMac /> : <DevicesOther />);
const placeOf = (loc = {}) => [loc.city, loc.region && loc.region !== loc.city ? loc.region : "", loc.country].filter(Boolean).join(", ");
export const isActive = (s) => moment().diff(moment(s.lastSeenAt), "minutes") < 5;

const Section = ({ title, hint, right, children }) => (
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

/** รายละเอียด 1 บรรทัด: ไอคอนเล็ก + ข้อความ */
const Meta = ({ icon, children }) => (
  <Stack direction="row" spacing={0.6} alignItems="flex-start" sx={{ color: MUTED, mt: 0.35 }}>
    <Box sx={{ display: "flex", mt: "1px", "& svg": { fontSize: 14 } }}>{icon}</Box>
    <Typography sx={{ fontSize: "0.76rem", color: MUTED, overflowWrap: "anywhere", lineHeight: 1.45 }}>{children}</Typography>
  </Stack>
);

const DeviceRow = ({ s, onRevoke }) => {
  const browser = [s.browser, s.browserVersion?.split(".")[0]].filter(Boolean).join(" ");
  const osName = osLabel(s);
  const title = deviceTitle(s);
  const code = marketingName(s.deviceVendor, s.deviceModel) ? s.deviceModel : "";
  const place = placeOf(s.location);
  const active = isActive(s);
  const sub = [browser, osName && !title.endsWith(osName) ? osName : "", code].filter(Boolean).join(" · ") || "ไม่ทราบเบราว์เซอร์";
  const revokeBtn = onRevoke && (
    <Button size="small" variant="outlined" onClick={onRevoke}
      sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2, color: RED, borderColor: "#fecaca", "&:hover": { borderColor: RED, bgcolor: "#fef2f2" } }}>
      ออกจากระบบ
    </Button>
  );
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start"
      sx={{ px: 2, py: 1.6, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
      <Box sx={{ position: "relative", width: 44, height: 44, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: s.current ? ACCENT_SOFT : SURFACE, color: s.current ? ACCENT : INK_2, border: `1px solid ${s.current ? ACCENT_LINE : LINE}`, "& svg": { fontSize: 22 } }}>
        {deviceIcon(s.deviceType)}
        {active && <Box sx={{ position: "absolute", right: -2, bottom: -2, width: 11, height: 11, borderRadius: "50%", bgcolor: SUCCESS, border: "2px solid #fff" }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK }}>{title}</Typography>
          {s.current && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.1, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, bgcolor: "#dcfce7", color: "#15803d" }}><CheckCircle sx={{ fontSize: 13 }} />เครื่องที่ใช้อยู่</Box>}
          {s.standalone && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, px: 0.8, py: 0.1, borderRadius: 99, fontSize: "0.68rem", fontWeight: 700, bgcolor: SURFACE, color: INK_2, border: `1px solid ${LINE}` }}><InstallMobile sx={{ fontSize: 12 }} />แอปบนหน้าจอโฮม</Box>}
        </Stack>
        <Typography sx={{ fontSize: "0.8rem", color: INK_2, mt: 0.2 }}>{sub}</Typography>
        <Meta icon={<PlaceOutlined />}>{place || "ไม่ทราบตำแหน่ง"}{s.location?.isp ? ` · ${s.location.isp}` : ""}</Meta>
        {s.ip && <Meta icon={<Language />}>IP {s.ip}</Meta>}
        <Meta icon={<AccessTime />}>
          {active
            ? <Box component="span" sx={{ color: SUCCESS, fontWeight: 700 }}>กำลังใช้งาน</Box>
            : `ใช้งานล่าสุด ${moment(s.lastSeenAt).locale("th").fromNow()}`}
        </Meta>
        {s.createdAt && <Meta icon={<LoginOutlined />}>เข้าสู่ระบบเมื่อ {formatThai(moment(s.createdAt), "D MMM YY HH:mm")} น.</Meta>}
        {revokeBtn && <Box sx={{ display: { xs: "block", sm: "none" }, mt: 1.1 }}>{revokeBtn}</Box>}
      </Box>
      {revokeBtn && <Box sx={{ display: { xs: "none", sm: "block" } }}>{revokeBtn}</Box>}
    </Stack>
  );
};

const Stat = ({ label, value, tone = INK }) => (
  <Box sx={{ flex: 1, minWidth: 0, px: 2, py: 1.4, borderLeft: `1px solid ${LINE}`, "&:first-of-type": { borderLeft: 0 } }}>
    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
    <Typography sx={{ fontSize: "1.35rem", fontWeight: 900, color: tone, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
  </Box>
);

export default function LoginDevices() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null); // { type: "one"|"others", session? }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try { setSessions(await SessionService.list()); }
    catch (err) { setSessions([]); setError(err?.response?.data?.message || "โหลดรายการอุปกรณ์ไม่สำเร็จ"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => (sessions || []).filter((s) => s.current), [sessions]);
  const others = useMemo(
    () => (sessions || []).filter((s) => !s.current).sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt)),
    [sessions],
  );
  const activeCount = (sessions || []).filter(isActive).length;

  const doRevoke = async () => {
    setBusy(true);
    try {
      if (confirm.type === "others") {
        const r = await SessionService.revokeOthers();
        setToast({ type: "success", text: `ออกจากระบบเครื่องอื่นแล้ว ${r.revoked || 0} เครื่อง` });
      } else {
        const r = await SessionService.revoke(confirm.session.sid);
        if (r.self) { logout(); return; }
        setToast({ type: "success", text: `ออกจากระบบ ${deviceTitle(confirm.session)} แล้ว` });
      }
      setConfirm(null);
      load();
    } catch (err) {
      setToast({ type: "error", text: err?.response?.data?.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 860, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5, px: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: INK, lineHeight: 1.25 }}>อุปกรณ์ที่เข้าสู่ระบบ</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>เครื่องที่บัญชีของคุณยังเข้าสู่ระบบอยู่</Typography>
        </Box>
        <Tooltip title="โหลดใหม่">
          <IconButton onClick={() => { setSessions(null); load(); }} sx={{ border: `1px solid ${LINE}`, bgcolor: "#fff", borderRadius: 2 }}>
            <Refresh sx={{ fontSize: 20, color: INK_2 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* สรุป */}
      <Stack direction="row" sx={{ mb: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <Stat label="ทั้งหมด" value={sessions ? sessions.length : "–"} />
        <Stat label="กำลังใช้งาน" value={sessions ? activeCount : "–"} tone={activeCount ? SUCCESS : INK} />
        <Stat label="เครื่องอื่น" value={sessions ? others.length : "–"} />
      </Stack>

      {sessions === null ? (
        <Section title="กำลังโหลด"><Box sx={{ p: 2 }}><Skeleton height={64} /><Skeleton height={64} /></Box></Section>
      ) : error ? (
        <Section title="อุปกรณ์">
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontSize: "0.86rem", color: RED, fontWeight: 600 }}>{error}</Typography>
            <Button size="small" onClick={load} sx={{ mt: 1, textTransform: "none", fontWeight: 700 }}>ลองอีกครั้ง</Button>
          </Box>
        </Section>
      ) : sessions.length === 0 ? (
        <Section title="อุปกรณ์">
          <Typography sx={{ p: 2, fontSize: "0.86rem", color: MUTED }}>ยังไม่มีข้อมูลอุปกรณ์ — จะเริ่มบันทึกตั้งแต่การเข้าสู่ระบบครั้งถัดไป</Typography>
        </Section>
      ) : (
        <>
          {current.length > 0 && (
            <Section title="อุปกรณ์นี้">
              {current.map((s) => <DeviceRow key={s.sid} s={s} />)}
            </Section>
          )}

          <Section
            title={`อุปกรณ์อื่น (${others.length})`}
            hint="เรียงตามการใช้งานล่าสุด"
          >
            {others.length === 0 ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
                <CheckCircle sx={{ fontSize: 18, color: SUCCESS }} />
                <Typography sx={{ fontSize: "0.86rem", color: INK_2 }}>ไม่มีเครื่องอื่นเข้าสู่ระบบด้วยบัญชีนี้</Typography>
              </Stack>
            ) : (
              <>
                {others.map((s) => <DeviceRow key={s.sid} s={s} onRevoke={() => setConfirm({ type: "one", session: s })} />)}
                <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${LINE}`, bgcolor: SURFACE }}>
                  <Button startIcon={<Logout sx={{ fontSize: 17 }} />} onClick={() => setConfirm({ type: "others" })}
                    sx={{ textTransform: "none", fontWeight: 800, color: RED, px: 1, "&:hover": { bgcolor: "#fef2f2" } }}>
                    ออกจากระบบเครื่องอื่นทั้งหมด ({others.length})
                  </Button>
                </Box>
              </>
            )}
          </Section>
        </>
      )}

      {/* คำแนะนำความปลอดภัย */}
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ p: 1.75, borderRadius: 3, bgcolor: SURFACE, border: `1px solid ${LINE}` }}>
        <ShieldOutlined sx={{ fontSize: 20, color: ACCENT, mt: 0.1 }} />
        <Box>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK }}>ข้อแนะนำด้านความปลอดภัย</Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25, "& li": { fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 } }}>
            <li>เห็นเครื่องที่ไม่รู้จัก ให้กด “ออกจากระบบ” ที่เครื่องนั้นทันที แล้วแจ้งผู้ดูแลระบบให้เปลี่ยนรหัสผ่าน</li>
            <li>เครื่องที่ถูกออกจากระบบจะต้องกรอกชื่อผู้ใช้และรหัสผ่านใหม่จึงจะใช้งานต่อได้</li>
            <li>ตำแหน่งเป็นค่าประมาณจาก IP อินเทอร์เน็ต — เน็ตมือถืออาจแสดงเป็นเมืองของผู้ให้บริการ ไม่ใช่ที่อยู่จริง</li>
            <li>เครื่องที่ไม่ได้ใช้งานเกิน 40 วันจะหายจากรายการเอง</li>
          </Box>
        </Box>
      </Stack>

      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirm?.type === "others" ? `ออกจากระบบเครื่องอื่น ${others.length} เครื่อง?` : "ออกจากระบบเครื่องนี้?"}
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

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {toast ? <Alert severity={toast.type} variant="filled" onClose={() => setToast(null)}>{toast.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
}
