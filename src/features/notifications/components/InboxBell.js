/**
 * InboxBell — กระดิ่งแจ้งเตือนบนหัวเว็บ (แบบ LINE): ทุกเรื่องที่ระบบเด้งไปที่มือถือ ย้อนดูได้ที่นี่
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569) "ทำระบบ push แจ้งเตือนต่อให้เสร็จ ... แบบ Line"
 *   • อ่านจากกล่องแจ้งเตือนที่ server (useInbox) — มีครบทุกระบบ ไม่ใช่แค่เรื่องงานเหมือนกระดิ่งเดิม
 *   • ยังไม่อ่าน = จุดสี + ตัวหนา · กดรายการ = อ่านแล้ว + พาไปหน้านั้น · "อ่านทั้งหมด" ด้านบน
 *   • จอคอม: กล่องลอยใต้กระดิ่ง · มือถือ: แผ่นเต็มจอจากด้านล่าง
 */
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, IconButton, Badge, Tooltip, Popover, Typography, Stack, Button, Drawer, useMediaQuery, ButtonBase, CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Notifications, NotificationsNone, Close, DoneAll, Build, AccountBalanceWallet, ShoppingCart, AccessTime,
  AssignmentInd, MarkEmailUnread, CalendarMonth, DeleteSweep, Storefront,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import { departmentOf } from "@/shared/utils/roles";
import useInbox, { markInboxRead, markAllInboxRead, clearReadInbox, loadMoreInbox } from "@/shared/hooks/useInbox";

const TEXT_MAIN = "#0f172a";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";

/** ไอคอน/สีตามปลายทางของแจ้งเตือน — อ่านจาก url ไม่ต้องให้ทุก route ส่งชนิดมาเอง */
const KINDS = [
  // ⚠️ ฝ่ายขายต้องมาก่อน — "/event?dept=sales" ขึ้นต้นด้วย /event เหมือนตารางงานช่าง
  { re: /^\/sales|[?&]dept=sales/, icon: Storefront, color: "#0891b2", label: "ฝ่ายขาย" },
  { re: /^\/expenses/, icon: AccountBalanceWallet, color: "#0d9488", label: "เบิกค่าใช้จ่าย" },
  { re: /^\/purchase/, icon: ShoppingCart, color: "#4338ca", label: "จัดซื้อ" },
  { re: /^\/ot/, icon: AccessTime, color: "#0891b2", label: "OT" },
  { re: /^\/dispatch/, icon: AssignmentInd, color: "#7c3aed", label: "คำขอลงงาน" },
  { re: /^\/website/, icon: MarkEmailUnread, color: "#0f172a", label: "เว็บไซต์" },
  { re: /^\/(event|calendar)/, icon: CalendarMonth, color: "#dc2626", label: "แผนงาน" },
  { re: /^\/(operation|technician|contracts|jobs)/, icon: Build, color: "#dc2626", label: "งาน" },
];
/**
 * ✅ (9 ต.ค. 2569 ผู้ใช้: "การแจ้งเตือนของหน้าเซล ช่าง ให้แยกให้ถูกต้อง") หมวดของแจ้งเตือน — อ่านจาก url
 *   sales = นัดหมาย/ใบแจ้งงานของฝ่ายขาย · service = งานช่าง (ปฏิทิน/ดำเนินงาน/สัญญา/คำขอลงงาน) · other = เบิก/OT/จัดซื้อ/เว็บ
 */
const sectionOf = (url, myDept) => {
  const u = String(url || "");
  if (/^\/sales|[?&]dept=sales/.test(u)) return "sales";
  // ✅ เซล: "/event" คือปฏิทินนัดหมายของตัวเอง (ไม่ใช่ตารางงานช่าง) — ยกเว้น ?dept=service ที่เป็นตารางช่างจริง
  if (myDept === "sales" && /^\/(event|calendar)/.test(u) && !/[?&]dept=service/.test(u)) return "sales";
  if (/^\/(event|calendar|operation|technician|contracts|jobs|dispatch)/.test(u)) return "service";
  return "other";
};
const SECTIONS = [["all", "ทั้งหมด"], ["service", "งานช่าง"], ["sales", "ฝ่ายขาย"], ["other", "อื่นๆ"]];
/** หมวดตั้งต้นตามหน้าที่เปิดอยู่ — อยู่ตารางงานเซลก็เห็นของเซลก่อน อยู่หน้างานช่างก็เห็นของช่างก่อน */
const sectionOfPage = (loc, myDept) => {
  const s = sectionOf(`${loc.pathname}${loc.search}`, myDept);
  return s === "other" ? "all" : s;
};

const kindOf = (url) => KINDS.find((k) => k.re.test(String(url || ""))) || { icon: Notifications, color: "#475569", label: "ระบบ" };

const timeText = (d) => {
  const m = moment(d);
  if (moment().diff(m, "hours") < 22) return m.fromNow();
  if (moment().diff(m, "days") < 7) return m.format("ddd HH:mm");
  return m.format("D MMM HH:mm");
};

const Item = ({ n, onOpen }) => {
  const k = kindOf(n.url);
  const Icon = k.icon;
  const unread = !n.readAt;
  return (
    <ButtonBase onClick={() => onOpen(n)} sx={{
      width: "100%", display: "flex", alignItems: "flex-start", gap: 1.25, px: 2, py: 1.25, textAlign: "left",
      bgcolor: unread ? alpha(k.color, 0.045) : "transparent", "&:hover": { bgcolor: alpha(k.color, 0.08) },
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <Box sx={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(k.color, unread ? 0.14 : 0.07), color: unread ? k.color : TEXT_SUB }}>
        <Icon sx={{ fontSize: 19 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: unread ? 800 : 600, color: unread ? TEXT_MAIN : "#334155", lineHeight: 1.35 }}>{n.title}</Typography>
          <Typography sx={{ fontSize: "0.68rem", color: unread ? k.color : "#94a3b8", fontWeight: unread ? 700 : 500, whiteSpace: "nowrap" }}>{timeText(n.createdAt)}</Typography>
        </Stack>
        {n.body && (
          <Typography sx={{ fontSize: "0.79rem", color: unread ? "#334155" : TEXT_SUB, lineHeight: 1.4, mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>
            {n.body}
          </Typography>
        )}
        <Typography sx={{ fontSize: "0.66rem", color: "#94a3b8", mt: 0.25 }}>{k.label}</Typography>
      </Box>
      {unread && <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: "#ef4444", mt: 0.75, flexShrink: 0 }} />}
    </ButtonBase>
  );
};

export default function InboxBell({ dark = false }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();
  const { items, unread, hasMore, loaded } = useInbox();
  const [anchor, setAnchor] = useState(null);
  const [tab, setTab] = useState("all");
  const [section, setSection] = useState("all");
  const [pageSection, setPageSection] = useState("all");
  const location = useLocation();
  const { userData } = useAuth() || {};
  const myDept = departmentOf(userData);
  const [more, setMore] = useState(false);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);

  const openItem = (n) => {
    if (!n.readAt) markInboxRead(n._id);
    close();
    if (n.url) navigate(n.url);
  };
  // จำนวนแต่ละหมวด (ยังไม่อ่าน) — โชว์แถบหมวดเฉพาะตอนมีมากกว่า 1 หมวดจริง (เซล/ช่างทั่วไปไม่เห็นแถบนี้)
  const sectionStats = useMemo(() => {
    const st = { all: { n: items.length, unread: unread } };
    ["service", "sales", "other"].forEach((k) => {
      const rows = items.filter((n) => sectionOf(n.url, myDept) === k);
      st[k] = { n: rows.length, unread: rows.filter((n) => !n.readAt).length };
    });
    return st;
  }, [items, unread, myDept]);
  // หมวดที่โชว์ = หมวดที่มีรายการ + หมวดของหน้าที่เปิดอยู่ (แม้ยังว่าง — อยู่หน้าเซลต้องเห็นว่า "ฝ่ายขายยังไม่มีแจ้งเตือน")
  const usedSections = ["service", "sales", "other"].filter((k) => sectionStats[k].n > 0 || k === pageSection);
  // ✅ (9 ต.ค. 2569 ผู้ใช้: "การแจ้งเตือนให้เห็นแค่ของตัวเองก็พอ") แถบหมวดเฉพาะคนที่ไม่สังกัดแผนก (แอดมิน/ผู้จัดการ)
  const showSections = !myDept && usedSections.length > 1;
  const activeSection = showSections ? section : "all";
  const inSection = activeSection === "all" ? items : items.filter((n) => sectionOf(n.url, myDept) === activeSection);
  const list = tab === "unread" ? inSection.filter((n) => !n.readAt) : inSection;
  const fresh = list.filter((n) => moment().diff(moment(n.createdAt), "hours") < 24);
  const older = list.filter((n) => moment().diff(moment(n.createdAt), "hours") >= 24);
  const hasRead = items.some((n) => n.readAt);

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: isMobile ? "100%" : "auto", maxHeight: isMobile ? "100%" : 560 }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }}>การแจ้งเตือน</Typography>
          {unread > 0 && (
            <Button size="small" startIcon={<DoneAll sx={{ fontSize: 17 }} />} onClick={markAllInboxRead} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>
              อ่านทั้งหมด
            </Button>
          )}
          {isMobile && <IconButton size="small" aria-label="ปิด" onClick={close}><Close /></IconButton>}
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
          {[["all", "ทั้งหมด"], ["unread", `ยังไม่อ่าน${unread ? ` (${unread > 99 ? "99+" : unread})` : ""}`]].map(([v, l]) => (
            <Box key={v} component="button" type="button" onClick={() => setTab(v)} sx={{
              border: 0, cursor: "pointer", px: 1.5, height: 28, borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, fontFamily: "inherit",
              bgcolor: tab === v ? "#eff6ff" : "#f1f5f9", color: tab === v ? "#1d4ed8" : "#475569",
            }}>{l}</Box>
          ))}
        </Stack>
        {showSections && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {SECTIONS.filter(([k]) => k === "all" || usedSections.includes(k)).map(([k, l]) => {
              const on = activeSection === k;
              const u = sectionStats[k].unread;
              return (
                <Box key={k} component="button" type="button" onClick={() => setSection(k)} sx={{
                  flexShrink: 0, border: 0, borderBottom: `2px solid ${on ? "#2563eb" : "transparent"}`, cursor: "pointer", px: 1, height: 30,
                  fontSize: "0.8rem", fontWeight: on ? 800 : 600, fontFamily: "inherit", bgcolor: "transparent", color: on ? "#1d4ed8" : "#475569",
                  display: "inline-flex", alignItems: "center", gap: 0.5,
                }}>
                  {l}
                  {u > 0 && <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 99, bgcolor: "#ef4444", color: "#fff", fontSize: "0.66rem", fontWeight: 800, display: "inline-grid", placeItems: "center" }}>{u > 99 ? "99+" : u}</Box>}
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {!loaded ? (
          <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress size={24} /></Stack>
        ) : list.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 3, textAlign: "center" }}>
            <NotificationsNone sx={{ fontSize: 44, color: "#cbd5e1" }} />
            <Typography sx={{ fontWeight: 700, color: TEXT_SUB, fontSize: "0.9rem" }}>{tab === "unread" ? "อ่านครบทุกเรื่องแล้ว" : activeSection === "sales" ? "ยังไม่มีการแจ้งเตือนฝ่ายขาย" : activeSection === "service" ? "ยังไม่มีการแจ้งเตือนงานช่าง" : "ยังไม่มีการแจ้งเตือน"}</Typography>
            <Typography variant="caption" sx={{ color: "#94a3b8" }}>งานใหม่ · ใบเบิก · OT · ใบขอซื้อ ที่เกี่ยวกับคุณจะเด้งมาที่นี่และบนจอมือถือ</Typography>
          </Stack>
        ) : (
          <>
            {[["วันนี้", fresh], ["ก่อนหน้านี้", older]].filter(([, rows]) => rows.length).map(([title, rows]) => (
              <Box key={title}>
                <Typography sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: "0.72rem", fontWeight: 800, color: "#94a3b8" }}>{title}</Typography>
                {rows.map((n) => <Item key={n._id} n={n} onOpen={openItem} />)}
              </Box>
            ))}
            {hasMore && tab === "all" && (
              <Stack alignItems="center" sx={{ py: 1.25 }}>
                <Button size="small" disabled={more} onClick={async () => { setMore(true); try { await loadMoreInbox(); } finally { setMore(false); } }}
                  sx={{ textTransform: "none", fontWeight: 700 }}>{more ? "กำลังโหลด..." : "ดูเก่ากว่านี้"}</Button>
              </Stack>
            )}
          </>
        )}
      </Box>
      {hasRead && (
        <Box sx={{ borderTop: `1px solid ${BORDER}`, px: 1, py: 0.5, flexShrink: 0, pb: isMobile ? "calc(4px + env(safe-area-inset-bottom))" : 0.5 }}>
          <Button fullWidth size="small" startIcon={<DeleteSweep sx={{ fontSize: 18 }} />} onClick={clearReadInbox} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>
            ล้างรายการที่อ่านแล้ว
          </Button>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <Tooltip title="การแจ้งเตือน">
        <IconButton onClick={(e) => { const ps = sectionOfPage(location, myDept); setPageSection(ps); setSection(ps); setAnchor(e.currentTarget); }} size="small" aria-label={unread ? `การแจ้งเตือน (ยังไม่อ่าน ${unread})` : "การแจ้งเตือน"}
          sx={{ border: "1px solid", borderColor: dark ? "rgba(255,255,255,0.18)" : "divider", borderRadius: 2, color: dark ? "#fff" : "inherit" }}>
          <Badge badgeContent={unread} color="error" max={99}>
            <Notifications fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      {isMobile ? (
        <Drawer anchor="bottom" open={open} onClose={close}
          PaperProps={{ sx: { height: "88vh", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" } }}>
          {content}
        </Drawer>
      ) : (
        <Popover open={open} anchorEl={anchor} onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{ sx: { mt: 1, borderRadius: 3, width: 400, maxWidth: "94vw", boxShadow: "0 12px 40px rgba(15,23,42,.18)", overflow: "hidden" } }}>
          {content}
        </Popover>
      )}
    </>
  );
}
