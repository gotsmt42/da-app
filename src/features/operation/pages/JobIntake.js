/**
 * JobIntake — เมนู "รับงาน" (9 ต.ค. 2569)
 *
 * ผู้ใช้: "รับงานคือกรอกรับงานไว้ก่อน ค่อยส่งลงตารางจริง ไม่ต้องอะไรมากมาย ทำให้เข้าใจง่ายๆ"
 *        "ทำให้ขั้นตอนต่างๆ เชื่อมโยงกัน และดูง่าย" · "ไม่ควรเอางานเก่ามารวม"
 *
 *   • เห็นเฉพาะงานที่รับผ่านปุ่ม "รับงานใหม่" (intakeAt) — งานเก่า/งานที่ลงปฏิทินตรงๆ ไม่มาปน
 *   • ทุกงานมีแถบขั้นตอนเดียวกัน: รับงาน → ลงตาราง → ช่างทำงาน → ตรวจปิดงาน → เสร็จ
 *     บอกชัดว่าอยู่ขั้นไหน และปุ่มถัดไปคืออะไร (ส่งลงตาราง / ดูงาน)
 *   • "ส่งลงตาราง" = เลือกวัน + หัวหน้าทีม + ผู้รับผิดชอบงาน ในหน้านี้เลย ไม่ต้องไปลากในปฏิทิน
 *
 * ✅ (15 ต.ค. 2569 ผู้ใช้) "1. ได้รับแจ้งงานมาเช่น PO หรือใบเสนอราคา 2. ลงงานใหม่ โดยลงว่าจากแผนกอะไร
 *    3.1 ถ้ามีเข้างาน ส่งลงตาราง ดำเนินงานแบบเดิม 3.2 ถ้าไม่มีเข้างาน เช่นส่งของ ขายของ ไปขั้นส่งใบวางบิล อัปโหลดบิล"
 *   • ฟอร์มรับงานมี: รับงานจาก (แผนก) · เอกสารต้นทาง + เลขที่ + ไฟล์ · รูปแบบงาน (ต้องเข้างาน / ไม่ต้องเข้างาน)
 *   • งานไม่ต้องเข้างาน: รับงาน → ส่งมอบ → วางบิล (อัปโหลดใบวางบิล) → เสร็จ · ไม่ขึ้นปฏิทิน/งานช่าง
 *     แต่ขึ้นหน้าติดตามวางบิลให้ตามรับเงินต่อ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveQuotationGroup, getFollowUpInfo } from "@/shared/utils/quotationTracking";
import { Link } from "react-router-dom";
import moment from "moment";
import Swal from "sweetalert2";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import {
  Box, Stack, Typography, Button, ButtonBase, Skeleton, Dialog, DialogContent, DialogActions, IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PostAddOutlined, AddRounded, EditOutlined, ChevronRight, Close, EventAvailableOutlined, FlagOutlined,
  NotesOutlined, CalendarMonthOutlined, GroupsOutlined, PersonOutlineOutlined, BuildOutlined, CallReceivedRounded, DescriptionOutlined, PhoneOutlined, HourglassTopRounded, ReportProblemOutlined,
  BlockRounded, RestoreRounded, PersonOffOutlined,
  LocalShippingOutlined, ReceiptLongOutlined, TaskAltRounded, UploadFileOutlined, AttachFileRounded, Search,
  ViewAgendaOutlined, TableRowsOutlined, RequestQuoteOutlined,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import CustomerService from "@/shared/services/CustomerService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { useAuth } from "@/features/auth/AuthContext";
import { formatThai } from "@/shared/utils/thaiDate";
import { PageHeader, EmptyState, INK, MUTED, LINE, ACCENT, SURFACE } from "@/shared/ui/PageKit";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { getAddDraftEvent, INTAKE_SOURCE_OPTS } from "@/features/calendar/components/EventForms/AddDraftEvent";
import { isUrgent, openFollowUp } from "@/shared/utils/jobFlow";
import { MiniSteps } from "@/features/attendance/components/CheckInOutPanel";
import { nextStepOf } from "@/shared/ui/JobFlow";
import { can } from "@/shared/utils/roles";
import PersonSelectField from "@/shared/ui/PersonSelectField";

const AMBER = "#d97706";
const GREEN = "#16a34a";
const RED = "#dc2626";

/** ขั้นตอนของงานที่รับไว้ — ใช้ทั้งแถบขั้นตอนและแท็บ */
// ✅ (11 ต.ค. 2569) "ช่างทำงาน" → "เข้างาน" (ขั้นนี้เริ่มเมื่อหัวหน้าทีมกดเข้างาน — คำเดียวกับการ์ดงาน)
const STAGES = ["รับงาน", "ลงตาราง", "เข้างาน", "ตรวจปิดงาน", "เสร็จ"];
/** ✅ (15 ต.ค. 2569) งานไม่ต้องเข้างาน (ส่งของ/ขายของ) */
const STAGES_NV = ["รับงาน", "ส่งมอบ", "วางบิล", "เสร็จ"];

const SOURCE_LABEL = Object.fromEntries(INTAKE_SOURCE_OPTS);
const DOC_LABEL = { po: "PO", quotation: "ใบเสนอราคา", other: "เอกสาร" };
const invoicedOf = (e) => Boolean((e.invoiceFiles || []).length || e.billing?.invoicedAt);
/** ✅ (15 ต.ค. 2569) บันทึกงาน (โน๊ต) */
const STAGES_NOTE = ["บันทึก", "ทำ", "เสร็จ"];
/** ✅ ค้างขั้นเดิมเกิน 2 วัน (ตรงกับตัวแจ้งเตือนฝั่ง server: checkAndNotifyStalledIntake) — คืนจำนวนวัน หรือ 0 */
const STALL_DAYS = 2;
const stalledDays = (e, st) => {
  const since = st.i === 0 ? e.intakeAt : st.nv && st.i === 2 ? (e.deliveredAt || e.scheduledAt) : null;
  if (!since) return 0;
  const d = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
  return d >= STALL_DAYS ? d : 0;
};

/** งานนี้อยู่ขั้นไหน + ข้อความสถานะ (bar = ตำแหน่งในแถบขั้นตอนของงานไม่ต้องเข้างาน) */
const stageOf = (e) => {
  if (e.cancelledAt) return { i: -1, label: "ยกเลิกแล้ว", color: MUTED };
  if (e.intakeNote) {
    return e.noteDoneAt
      ? { i: 4, label: "ทำแล้ว", color: GREEN, note: true, bar: STAGES_NOTE.length }
      : { i: 0, label: "รอทำ", color: AMBER, note: true, bar: 1 };
  }
  if (e.noVisit) {
    if (e.unscheduled) return { i: 0, label: "รอส่งมอบ", color: AMBER, nv: true, bar: 0 };
    if (invoicedOf(e)) return { i: 4, label: "วางบิลแล้ว", color: GREEN, nv: true, bar: STAGES_NV.length };
    return { i: 2, label: "รอวางบิล", color: AMBER, nv: true, bar: 2 };
  }
  if (e.unscheduled) return { i: 0, label: "รอส่งลงตาราง", color: AMBER };
  if (e.status === "ดำเนินการเสร็จสิ้น") return { i: 4, label: "เสร็จสิ้น", color: GREEN };
  if (e.closeRequested) return { i: 3, label: "รอตรวจปิดงาน", color: ACCENT };
  if (openFollowUp(e)) return { i: 2, label: `งานไม่เสร็จ · ${openFollowUp(e).reason}`, color: AMBER };
  if (e.status === "กำลังดำเนินการ") return { i: 2, label: "กำลังดำเนินการ", color: ACCENT };
  return { i: 1, label: "ลงตารางแล้ว", color: ACCENT };
};

/**
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "หน้างานใหม่ ติดตามว่าเข้างานแล้ว งานนี้ได้งานไหม เช่นงาน Inspection ส่งใบเสนอราคาไปแล้ว ได้งานไหม
 *    มีสถานะบอก ดูเข้าใจง่าย · มีรูปแบบแสดงเป็นตารางด้วย")
 *    "ผลเสนอราคา" ของงานที่รับไว้ — อ่านจากระบบติดตามใบเสนอราคาตัวเดียวกับหน้า "ติดตามใบเสนอราคา" (resolveQuotationGroup)
 *    งานหลายวันใช้วันล่าสุดของกลุ่มเป็นตัวแทน (ตรงกับหน้าติดตามใบเสนอราคา) · งานส่งของ/จดงาน/มี PO แล้ว ไม่มีผลเสนอราคา
 */
const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
const OUTCOME = {
  none: { label: "ยังไม่มีใบเสนอราคา", color: "#64748b", act: "แนบใบเสนอราคา", to: "op", group: "todo", quiet: true },
  waiting_file: { label: "รอแนบใบเสนอราคา", color: AMBER, act: "แนบใบเสนอราคา", to: "op", group: "todo" },
  not_sent: { label: "ยังไม่ส่งใบเสนอราคา", color: AMBER, act: "บันทึกการส่ง", to: "qt", group: "todo" },
  sent: { label: "รอลูกค้าตอบ", color: "#2563eb", act: "อัปเดตผล", to: "qt", group: "wait" },
  follow_up: { label: "ถึงเวลาติดตามลูกค้า", color: "#ea580c", act: "ติดตาม / อัปเดตผล", to: "qt", group: "wait" },
  revising: { label: "กำลังปรับใบเสนอราคา", color: "#7c3aed", act: "อัปเดตผล", to: "qt", group: "wait" },
  approved: { label: "ได้งาน", color: GREEN, act: "ดูใบเสนอราคา", to: "qt", group: "won" },
  rejected: { label: "ไม่ได้งาน", color: RED, act: "ดูใบเสนอราคา", to: "qt", group: "lost" },
};
const OUTCOME_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "todo", label: "ยังไม่ส่ง", color: AMBER },
  { key: "wait", label: "รอลูกค้าตอบ", color: "#2563eb" },
  { key: "won", label: "ได้งาน", color: GREEN },
  { key: "lost", label: "ไม่ได้งาน", color: RED },
];
const outcomeOf = (job, st, sessions) => {
  if (!st || st.note || st.nv || st.i === -1) return null;
  const list = (sessions && sessions.length ? sessions : [job]).slice().sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0));
  const anchor = list.find((e) => e.quotationStatus || (e.quotationFiles || []).length || e.quotationApplicable === true) || list[0];
  let key = resolveQuotationGroup(anchor);
  if (!key) {
    // ยังไม่มีอะไรเกี่ยวกับใบเสนอราคาเลย — แสดงเฉพาะงานที่เข้างานแล้ว และไม่ได้มี PO มาตั้งแต่รับงาน
    if (st.i < 2 || job.intakeDocType === "po" || anchor.quotationApplicable === false) return null;
    key = "none";
  }
  const fu = getFollowUpInfo(anchor);
  const facts = [];
  if (anchor.quotationNo) facts.push(anchor.quotationNo);
  if (anchor.quotationAmount) facts.push(baht(anchor.quotationAmount));
  if ((key === "sent" || key === "follow_up") && anchor.quotationSentAt) {
    facts.push(`ส่ง ${formatThai(moment(anchor.quotationSentAt), "D MMM YY")}`);
    if (fu) facts.push(fu.followUpCount ? `ติดตามแล้ว ${fu.followUpCount} ครั้ง` : "ยังไม่เคยติดตาม");
  }
  if (key === "approved") {
    if (anchor.quotationPoNo) facts.push(`PO ${anchor.quotationPoNo}`);
    if (anchor.quotationDecisionAt) facts.push(`ตอบรับ ${formatThai(moment(anchor.quotationDecisionAt), "D MMM YY")}`);
  }
  if (key === "rejected" && anchor.quotationDecisionNote) facts.push(`เหตุผล: ${anchor.quotationDecisionNote}`);
  if (key === "none") facts.push("ถ้าต้องเสนอราคา แนบไฟล์ที่การ์ดงานในหน้าการดำเนินงาน");
  const meta = OUTCOME[key];
  return { key, ...meta, facts, amount: Number(anchor.quotationAmount) || 0, href: meta.to === "qt" ? `/finance?tab=quotations&jobId=${anchor._id}` : `/operation/${anchor._id}` };
};

/** แถบ "ผลเสนอราคา" ในการ์ด — สีตามผล · ข้อมูลสั้น · ปุ่มไปอัปเดตที่หน้าติดตามใบเสนอราคา */
function OutcomeBar({ oc }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} gap={1}
      sx={{ mt: 1, px: 1.25, py: 0.9, borderRadius: 2, bgcolor: oc.quiet ? SURFACE : alpha(oc.color, 0.06),
        border: `1px solid ${oc.quiet ? LINE : alpha(oc.color, 0.3)}`, borderLeft: `4px solid ${oc.color}` }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexWrap: "wrap" }}>
          <RequestQuoteOutlined sx={{ fontSize: 17, color: oc.color }} />
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED }}>ผลเสนอราคา</Typography>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 900, color: oc.color }}>{oc.label}</Typography>
        </Stack>
        {oc.facts.length > 0 && (
          <Typography sx={{ fontSize: "0.76rem", color: "#475569", mt: 0.25, overflowWrap: "anywhere" }}>{oc.facts.join(" · ")}</Typography>
        )}
      </Box>
      <Button component={Link} to={oc.href} size="small" endIcon={<ChevronRight sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN, flexShrink: 0, height: 32, px: 1.25, color: oc.quiet ? "#334155" : oc.color, border: `1px solid ${oc.quiet ? LINE : alpha(oc.color, 0.45)}`, bgcolor: "#fff", "&:hover": { bgcolor: alpha(oc.color, 0.06) } }}>
        {oc.act}
      </Button>
    </Stack>
  );
}

const TABS = [
  { key: "waiting", label: "รอดำเนินการ", short: "รอเริ่ม", test: (s) => s.i === 0 },
  { key: "active", label: "กำลังดำเนินการ", short: "กำลังทำ", test: (s) => s.i >= 1 && s.i <= 3 },
  { key: "done", label: "เสร็จแล้ว", short: "เสร็จแล้ว", test: (s) => s.i === 4 },
  // ✅ แท็บ "ยกเลิก" โชว์เฉพาะตอนมีงานที่ยกเลิก (ไม่กินที่บนมือถือโดยไม่จำเป็น)
  { key: "cancelled", label: "ยกเลิก", short: "ยกเลิก", test: (s) => s.i === -1, hideEmpty: true },
  // ✅ (19 ต.ค. 2569) งานที่เข้าไปดูหน้างาน/เสนอราคาแล้ว — ตามผลจนรู้ว่าได้งานหรือไม่
  { key: "result", label: "ติดตามผลเสนอราคา", short: "ผลเสนอราคา", test: (s, oc) => Boolean(oc) },
];

/** ข้อความกำหนดการสั้นๆ (ใช้ในตาราง) */
const scheduleShort = (j) => (j.intakeNote ? `บันทึก ${formatThai(moment(j.intakeAt), "D MMM YY")}`
  : j.noVisit ? (j.unscheduled ? "ยังไม่ส่งมอบ" : `ส่งมอบ ${formatThai(moment(j.deliveredAt || j.start), "D MMM YY")}`)
    : j.unscheduled ? (j.plannedMonth ? `ตั้งใจ ${formatThai(moment(j.plannedMonth, "YYYY-MM"), "MMM YY")}` : "ยังไม่กำหนดเดือน")
      : `เข้างาน ${formatThai(moment(j.start), "D MMM YY")}`);

/**
 * มุมมองตาราง — ข้อมูลหลักครบในแถวเดียว กวาดตาเทียบหลายงานได้เร็ว (จอแคบเลื่อนซ้าย-ขวาได้)
 * 🔁 (19 ต.ค. 2569 ผู้ใช้: "รายละเอียดให้ครบแบบหน้าการ์ดด้วย") — เพิ่มคอลัมน์รายละเอียดงาน · ทีม/ผู้ติดต่อ · ขั้นถัดไป · กำหนดเสร็จ
 *    และกดแถวเพื่อกางการ์ดเต็มใต้แถว (ไฟล์แนบ · ผลเสนอราคา · แถบขั้นตอน · ปุ่มแก้ไข/ยกเลิก ครบเหมือนมุมมองการ์ด)
 */
function JobTable({ rows, readOnlyOf, requestMode, onSchedule, onDeliver, renderCard }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const th = { textAlign: "left", fontSize: "0.74rem", fontWeight: 800, color: MUTED, px: 1.25, py: 1, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", bgcolor: SURFACE };
  const td = { fontSize: "0.82rem", color: "#334155", px: 1.25, py: 1.1, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const sub = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.45, overflowWrap: "anywhere" };
  const COLS = ["", "เลข Job", "งาน / โครงการ", "รายละเอียดงาน", "รับจาก · เอกสาร", "กำหนดการ", "ทีม · ผู้ติดต่อ", "สถานะงาน", "ผลเสนอราคา", "ผู้รับผิดชอบ", ""];
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", minWidth: 1120, borderCollapse: "collapse" }}>
        <thead>
          <tr>{COLS.map((h, i) => <Box component="th" key={i} sx={{ ...th, ...(i === 0 ? { width: 34, px: 0.5 } : {}) }}>{h}</Box>)}</tr>
        </thead>
        <tbody>
          {rows.map(({ j, s, oc }) => {
            const doc = j.intakeDocType || j.intakeDocNo ? `${DOC_LABEL[j.intakeDocType] || "เอกสาร"}${j.intakeDocNo ? ` ${j.intakeDocNo}` : ""}` : "";
            const ro = readOnlyOf(j);
            const isOpen = open.has(j._id);
            const stall = stalledDays(j, s);
            const team = [j.team, ...(j.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(", ");
            const files = (j.sitePhotoFiles || []).filter((f) => f.source === "intake").length;
            const nx = j.cancelledAt ? null : s.note ? (s.i === 0 ? "ทำงานนี้ แล้วกด “ทำเสร็จแล้ว”" : null)
              : s.nv ? (s.i === 0 ? "ส่งมอบ แล้วกด “ส่งมอบแล้ว”" : s.i === 2 ? "อัปโหลดใบวางบิล" : null)
                : j.unscheduled ? "เลือกวันเข้างาน ผู้รับผิดชอบ และหัวหน้าทีม" : s.i >= 0 && s.i < 4 ? nextStepOf(j, "admin")?.title : null;
            const action = !ro && s.i === 0 && !s.note
              ? (s.nv
                ? <Button size="small" onClick={() => onDeliver(j)} sx={{ ...SUCCESS, height: 30, px: 1.25 }}>ส่งมอบแล้ว</Button>
                : <Button size="small" onClick={() => onSchedule(j)} sx={{ ...PRIMARY, height: 30, px: 1.25 }}>{requestMode ? "ขอลงตาราง" : "ส่งลงตาราง"}</Button>)
              : !j.unscheduled && !s.nv && !s.note
                ? <Button component={Link} to={`/operation/${j._id}`} size="small" sx={{ ...BTN, height: 30, px: 1.25, color: ACCENT, border: `1px solid ${alpha(ACCENT, 0.4)}` }}>ดูงาน</Button>
                : null;
            return [
              <Box component="tr" key={j._id} onClick={(e) => { if (!e.target.closest("a,button")) toggle(j._id); }}
                sx={{ cursor: "pointer", "& > td": { bgcolor: isOpen ? alpha(ACCENT, 0.04) : "transparent" }, "&:hover > td": { bgcolor: isOpen ? alpha(ACCENT, 0.06) : "#f8fafc" } }}>
                <Box component="td" sx={{ ...td, px: 0.5, textAlign: "center" }}>
                  <ChevronRight sx={{ fontSize: 20, color: "#94a3b8", transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none" }} />
                </Box>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{j.jobNo || "—"}</Typography>
                  <Typography sx={sub}>{j.intakeNote ? "จดงาน" : j.noVisit ? "ส่งของ" : "เข้างาน"}</Typography>
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 160, maxWidth: 220 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK, overflowWrap: "anywhere" }}>
                    {j.intakeNote ? "บันทึกงาน" : [j.title, j.system].filter(Boolean).join(" · ") || "งาน"}
                  </Typography>
                  <Typography sx={sub}>{[j.site && j.site !== "-" ? j.site : "", j.company && j.company !== j.site ? j.company : ""].filter(Boolean).join(" · ")}</Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.4 }}>
                    {isUrgent(j) && s.i < 4 && <Chip color="#fff" bg={RED} border={RED}>⚡ ด่วน</Chip>}
                    {stall > 0 && <Chip color={RED} bg={alpha(RED, 0.08)} border="transparent">ค้าง {stall} วัน</Chip>}
                    {j.approvalStatus === "pending" && <Chip color={AMBER} bg={alpha(AMBER, 0.12)} border="transparent">รออนุมัติ</Chip>}
                    {j.infoPending && s.i < 4 && <Chip color={AMBER} bg={alpha(AMBER, 0.12)} border="transparent">รอข้อมูล</Chip>}
                  </Stack>
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170, maxWidth: 240 }}>
                  <Typography sx={{ ...sub, color: j.description ? "#334155" : "#cbd5e1", fontSize: "0.78rem", whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {j.description || "—"}
                  </Typography>
                  {(files > 0 || j.equipment) && (
                    <Typography sx={{ ...sub, mt: 0.3 }}>{[files > 0 && `📎 ${files} ไฟล์`, j.equipment && `อุปกรณ์: ${String(j.equipment).split(/\n+/).filter(Boolean).join(", ")}`].filter(Boolean).join(" · ")}</Typography>
                  )}
                  {j.infoPending && j.infoPendingNote && <Typography sx={{ ...sub, color: AMBER, fontWeight: 700 }}>ขาด: {j.infoPendingNote}</Typography>}
                </Box>
                <Box component="td" sx={td}>
                  <Typography sx={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{j.intakeSource ? `จาก${SOURCE_LABEL[j.intakeSource] || j.intakeSource}` : "—"}</Typography>
                  {doc && <Typography sx={sub}>{doc}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                  {scheduleShort(j)}
                  {j.dueDate && s.i < 4 && (
                    <Typography sx={{ ...sub, color: moment(j.dueDate).isBefore(moment(), "day") ? RED : MUTED, fontWeight: 700 }}>
                      เสร็จภายใน {formatThai(moment(j.dueDate), "D MMM YY")}
                    </Typography>
                  )}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 120, maxWidth: 170 }}>
                  <Typography sx={{ fontSize: "0.78rem", overflowWrap: "anywhere" }}>{!j.unscheduled && !j.noVisit && !j.intakeNote ? (team || "ยังไม่มอบหมายทีม") : "—"}</Typography>
                  {(j.contactName || j.contactTel) && (
                    <Typography sx={sub}>
                      {j.contactName || ""}{j.contactName && j.contactTel ? " · " : ""}
                      {j.contactTel && <Box component="a" href={`tel:${j.contactTel}`} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{j.contactTel}</Box>}
                    </Typography>
                  )}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 140, maxWidth: 190 }}>
                  <Chip color={s.color} bg={alpha(s.color, 0.1)} border="transparent">{s.label}</Chip>
                  {nx && <Typography sx={{ ...sub, mt: 0.4 }}>ต่อไป: {nx}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 140, maxWidth: 200 }}>
                  {oc ? (
                    <Box component={Link} to={oc.href} sx={{ textDecoration: "none", display: "block" }}>
                      <Chip color={oc.quiet ? "#475569" : oc.color} bg={oc.quiet ? SURFACE : alpha(oc.color, 0.1)} border="transparent">{oc.label}</Chip>
                      {oc.facts.length > 0 && !oc.quiet && <Typography sx={{ ...sub, mt: 0.3 }}>{oc.facts.slice(0, 3).join(" · ")}</Typography>}
                    </Box>
                  ) : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>{j.responsiblePerson || <Box component="span" sx={{ color: "#cbd5e1" }}>—</Box>}</Box>
                <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap", position: "sticky", right: 0, bgcolor: isOpen ? "#f5f8ff !important" : "#fff !important", boxShadow: "-8px 0 8px -8px rgba(15,23,42,.15)" }}>{action}</Box>
              </Box>,
              isOpen && (
                <tr key={`${j._id}-detail`}>
                  <Box component="td" colSpan={COLS.length} sx={{ p: 1.25, bgcolor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
                    {renderCard(j, oc)}
                  </Box>
                </tr>
              ),
            ];
          })}
        </tbody>
      </Box>
    </Box>
  );
}

const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", fontSize: "0.82rem" };
const PRIMARY = { ...BTN, bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } };
// ✅ (15 ต.ค. 2569 ผู้ใช้: "ใช้สีให้ถูกต้องตามปุ่มต่างๆ หรือการดำเนินการ") — ปุ่มจบขั้น (ทำเสร็จ/ส่งมอบแล้ว) = เขียว · ไปขั้นถัดไป = น้ำเงิน · ยกเลิก = แดง
const SUCCESS = { ...BTN, bgcolor: GREEN, color: "#fff", "&:hover": { bgcolor: "#15803d", boxShadow: "none" } };

/** แถบขั้นตอน 5 ช่อง — ผ่านแล้วสีเขียว · ขั้นปัจจุบันสีของสถานะ · ยังไม่ถึงสีเทา (กว้างเท่ากันทุกจอ ไม่ล้น) */
// ✅ (11 ต.ค. 2569 ผู้ใช้: "สายขั้นตอนควรเป็นสีสัน รูปแบบเดียวกันทั้งหมดที่เกี่ยวข้องกัน") — ใช้แถบขั้นตอนตัวเดียวกับการ์ดงาน
//    (วงเขียว ✓ = ผ่านแล้ว · วงน้ำเงินมีเลข = ขั้นปัจจุบัน · วงขาว = ยังไม่ถึง) แทนแถบสีเดิม
function StageBar({ stage }) {
  return (
    <Box>
      <MiniSteps labels={stage.note ? STAGES_NOTE : stage.nv ? STAGES_NV : STAGES} current={stage.note || stage.nv ? stage.bar : stage.i === 4 ? STAGES.length : stage.i} />
    </Box>
  );
}

/** หัวข้อย่อยในกล่องส่งลงตาราง: เลขลำดับ + ชื่อ + คำอธิบายสั้น */
const Section = ({ n, title, hint, last, children }) => (
  <Box sx={{ pb: last ? 0 : 2, mb: last ? 0 : 2, borderBottom: last ? 0 : `1px dashed ${LINE}` }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT, fontSize: "0.72rem", fontWeight: 900 }}>{n}</Box>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>{title}</Typography>
    </Stack>
    {children}
    {hint && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.6, px: 0.25 }}>{hint}</Typography>}
  </Box>
);

/**
 * กล่องส่งลงตาราง — เลือกวันเริ่ม/วันสิ้นสุด หัวหน้าทีม และผู้รับผิดชอบงาน
 *
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ให้เลือกผู้รับผิดชอบงานได้ด้วย ให้สมบูรณ์และสอดคล้อง")
 *   • หัวหน้าทีม = คนที่เข้างานรอบนี้ (team/resPerson) · ผู้รับผิดชอบงาน = คนดูแลทั้งงาน (responsiblePerson)
 *     — แยกกันแบบเดียวกับหัวกล่องแก้ไขงาน (EditEvent) และหน้าภาพรวมงาน
 *   • บันทึกผู้รับผิดชอบผ่าน /events/basic-info ตัวเดียวกับหน้าอื่น → ทุกหน้าเห็นชื่อเดียวกัน
 *   • มอบหมายได้เฉพาะผู้มีสิทธิ์ editContracts (เหมือน EditEvent · server เช็คซ้ำ) — คนอื่นเห็นชื่อแต่เลือกไม่ได้
 */
function ScheduleDialog({ job, employees, canAssignResponsible, requestMode, onClose, onDone }) {
  const defStart = job.plannedMonth && job.plannedMonth > moment().format("YYYY-MM")
    ? moment(job.plannedMonth, "YYYY-MM").startOf("month").format("YYYY-MM-DD")
    : moment().add(1, "day").format("YYYY-MM-DD");
  const [start, setStart] = useState(defStart);
  const [end, setEnd] = useState(defStart);
  const [team, setTeam] = useState(job.team || "");
  const initialResp = job.responsiblePerson || "";
  const [resp, setResp] = useState(initialResp);
  const [saving, setSaving] = useState(false);
  const people = useMemo(
    () => employees.filter((u) => u.fname).slice().sort((a, b) => a.fname.localeCompare(b.fname, "th")),
    [employees],
  );
  // ✅ (10 ต.ค. 2569 ผู้ใช้: "ผู้รับผิดชอบงานขึ้นก่อน และทำ UI ให้สวยงาม เห็นรูปด้วย") — ช่องเลือกชื่อแบบมีรูป
  //    ตัวเดียวกับหน้าภาพรวมงาน/ใบเบิก (PersonSelectField) · ชื่อเดิมที่ไม่อยู่ในรายชื่อพนักงานแล้วยังต้องเห็นอยู่
  const optionsWith = (v) => [
    ...people.map((u) => ({ id: u.fname, name: [u.fname, u.lname].filter(Boolean).join(" "), avatar: u.imageUrl, note: u.jobTitle || undefined })),
    ...(v && !people.some((u) => u.fname === v) ? [{ id: v, name: v }] : []),
  ];
  const PICK = { width: "100%", height: 48, borderRadius: 2.5 };
  const ok = start && (!end || end >= start);

  const save = async () => {
    if (!ok) return;
    setSaving(true);
    try {
      const emp = employees.find((u) => u.fname === team);
      const last = end || start;
      await EventService.ScheduleDraftEvent(job._id, {
        date: start, start, end: moment(last).add(1, "day").format("YYYY-MM-DD"),
        ...(team ? { team, resPerson: emp?._id || "" } : {}),
      });
      // ผู้รับผิดชอบงาน — หลังลงตารางสำเร็จเท่านั้น (ถ้าส่งลงตารางไม่ผ่าน จะไม่มีอะไรถูกเปลี่ยน)
      let respFailed = false;
      if (canAssignResponsible && resp !== initialResp) {
        const person = people.find((u) => u.fname === resp);
        try {
          await EventService.UpdateBasicInfo([job._id], { responsiblePerson: resp, responsiblePersonId: person?._id ? String(person._id) : "" });
        } catch {
          respFailed = true;
        }
      }
      onDone();
      if (respFailed) {
        Swal.fire({ icon: "warning", title: "ส่งลงตารางแล้ว", text: "แต่บันทึกผู้รับผิดชอบงานไม่สำเร็จ — แก้ได้จากหน้าแก้ไขงาน" });
        return;
      }
      Swal.fire(requestMode
        ? { icon: "success", title: "ส่งขออนุมัติแล้ว", text: "แอดมินจะได้รับแจ้ง — อนุมัติแล้วงานจะขึ้นในตารางงานช่าง", confirmButtonColor: "#2563eb" }
        : { icon: "success", title: "ส่งลงตารางแล้ว", text: "งานขึ้นในตารางงานช่างเรียบร้อย", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ส่งลงตารางไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <EventAvailableOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>{requestMode ? "ขอลงตาราง" : "ส่งลงตาราง"}</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, pt: "20px !important", pb: 2 }}>
        {/* ✅ ลำดับ: ผู้รับผิดชอบงาน (ดูแลทั้งงาน) → วันเข้างาน → หัวหน้าทีมที่เข้างาน (รอบนี้) */}
        <Section n={1} title="ผู้รับผิดชอบงาน" hint={canAssignResponsible ? "ดูแลงานนี้ทั้งงาน ตั้งแต่ลงตารางจนปิดงาน" : "มอบหมายได้เฉพาะแอดมิน/ผู้จัดการ"}>
          <PersonSelectField
            label="" title="เลือกผู้รับผิดชอบงาน" value={resp} onChange={setResp}
            allValue="" allLabel="ยังไม่ได้มอบหมาย" allIcon={PersonOffOutlined}
            options={optionsWith(resp)} disabled={!canAssignResponsible} sx={PICK}
          />
        </Section>
        <Section n={2} title="วันเข้างาน">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
            <ThaiDatePicker label="วันที่เข้างาน" value={start} onChange={(v) => { setStart(v || ""); if (!end || (v && end < v)) setEnd(v || ""); }} />
            <ThaiDatePicker label="ถึงวันที่" value={end} onChange={(v) => setEnd(v || "")} minDate={start ? moment(start) : undefined} />
          </Box>
        </Section>
        <Section n={3} title="หัวหน้าทีมที่เข้างาน" hint="นำทีมเข้าหน้างานรอบนี้ · ไม่บังคับ มอบหมายทีหลังได้" last>
          <PersonSelectField
            label="" title="เลือกหัวหน้าทีม" value={team} onChange={setTeam}
            allValue="" allLabel="ยังไม่ระบุ" allIcon={PersonOffOutlined}
            options={optionsWith(team)} sx={PICK}
          />
        </Section>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE }}>
          {requestMode
            ? "ส่งขออนุมัติให้แอดมิน — อนุมัติแล้วงานจะขึ้นในตารางงานช่าง (ติดตามได้ที่การ์ดงานนี้)"
            : "ส่งแล้วงานจะขึ้นในตารางงานช่างทันที · เวลา/ลูกทีมเพิ่มได้ภายหลังจากหน้าตารางงาน"}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!ok || saving} onClick={save} sx={{ ...PRIMARY, px: 2.5 }}>
          {saving ? "กำลังส่ง..." : requestMode ? "ส่งขออนุมัติ" : "ส่งลงตาราง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * ✅ (15 ต.ค. 2569) ส่งมอบงานที่ไม่ต้องเข้างาน (ส่งของ/ขายของ) — วันที่ส่งมอบ + แนบใบวางบิลได้เลย (ไม่บังคับ)
 *    แนบใบวางบิลแล้ว = งานเสร็จในหน้านี้ · ยังไม่แนบ = ค้างที่แท็บ "กำลังดำเนินการ" ขั้น "รอวางบิล"
 */
function DeliverDialog({ job, onClose, onDone }) {
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await EventService.DeliverJob(job._id, { date });
      let failed = 0;
      for (const f of files) {
        try { await EventService.Upload(job._id, f, "invoice"); } catch { failed += 1; }
      }
      onDone();
      Swal.fire(failed
        ? { icon: "warning", title: "บันทึกส่งมอบแล้ว", text: `แต่แนบใบวางบิลไม่สำเร็จ ${failed} ไฟล์ — กด “อัปโหลดใบวางบิล” ที่การ์ดงานอีกครั้ง` }
        : { icon: "success", title: files.length ? "ส่งมอบ + วางบิลแล้ว" : "บันทึกส่งมอบแล้ว", text: files.length ? "ตามรับเงินต่อได้ที่หน้าติดตามวางบิล" : "ขั้นถัดไป: อัปโหลดใบวางบิล", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <LocalShippingOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>ส่งมอบแล้ว</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, pt: "20px !important", pb: 2 }}>
        <Section n={1} title="วันที่ส่งมอบ / ส่งของ">
          <ThaiDatePicker label="วันที่ส่งมอบ" value={date} onChange={(v) => setDate(v || "")} />
        </Section>
        <Section n={2} title="ใบวางบิล" hint="ไม่บังคับ — ยังไม่มีบิล กดบันทึกไปก่อน แล้วอัปโหลดทีหลังที่การ์ดงาน" last>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />} sx={{ ...BTN, color: "#334155", borderColor: LINE }}>
            {files.length ? `เลือกแล้ว ${files.length} ไฟล์` : "เลือกไฟล์ใบวางบิล"}
            <input hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles([...(e.target.files || [])])} />
          </Button>
          {files.length > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, overflowWrap: "anywhere" }}>{files.map((f) => f.name).join(", ")}</Typography>
          )}
        </Section>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE }}>
          งานไม่ต้องเข้างานจะไม่ขึ้นในตารางงานช่าง · ตามรับเงินต่อได้ที่หน้าติดตามวางบิล
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!date || saving} onClick={save} sx={{ ...PRIMARY, px: 2.5 }}>
          {saving ? "กำลังบันทึก..." : "บันทึกส่งมอบ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** ลิงก์ไฟล์เล็กๆ (เอกสารรับงาน / ใบวางบิล) — กดเปิดในแท็บใหม่ */
// ✅ (15 ต.ค. 2569 ผู้ใช้: "ไฟล์แนบ ยังไม่สวย ดูยาก") — การ์ดไฟล์เล็ก: รูปย่อ (รูปภาพ) / ไอคอนตามชนิด + ชื่อไฟล์ + ที่มา
const isImageFile = (f) => /^image\//.test(f.fileType || "") || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.fileName || f.fileUrl || "");
const extOf = (f) => (String(f.fileName || f.fileUrl || "").split(".").pop() || "").slice(0, 4).toUpperCase();
const thumbOf = (url) => (/res\.cloudinary\.com\/.+\/image\/upload\//.test(url || "") ? url.replace("/image/upload/", "/image/upload/c_fill,w_80,h_80,q_auto,f_auto/") : url);
const FileLinks = ({ files, label = "เอกสารรับงาน" }) => (
  <>
    {files.map((f) => {
      const img = isImageFile(f);
      const ext = extOf(f);
      const color = ext === "PDF" ? RED : /^XLS/.test(ext) ? GREEN : /^DOC/.test(ext) ? ACCENT : MUTED;
      return (
        <Box key={f._id || f.fileUrl} component="a" href={f.fileUrl} target="_blank" rel="noreferrer" title={f.fileName}
          sx={{ display: "inline-flex", alignItems: "center", gap: 1, width: { xs: "100%", sm: 240 }, p: 0.6, pr: 1.25, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", textDecoration: "none", transition: "border-color .15s, box-shadow .15s", "&:hover": { borderColor: ACCENT, boxShadow: `0 0 0 3px ${alpha(ACCENT, 0.08)}` } }}>
          {img ? (
            <Box component="img" src={thumbOf(f.fileUrl)} alt="" loading="lazy"
              sx={{ width: 36, height: 36, borderRadius: 1.5, objectFit: "cover", flexShrink: 0, bgcolor: SURFACE }} />
          ) : (
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.1), color, fontSize: "0.62rem", fontWeight: 900 }}>
              {ext || <AttachFileRounded sx={{ fontSize: 16 }} />}
            </Box>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{f.fileName || "ไฟล์"}</Typography>
            <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 600, color: "#94a3b8", lineHeight: 1.3 }}>{label}</Typography>
          </Box>
        </Box>
      );
    })}
  </>
);

/** บรรทัดข้อมูล: ไอคอน + ข้อความ (ตัดบรรทัดได้ ไม่ล้น) */
const Line = ({ icon: Icon, children, color = "#475569", strong }) => (
  <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
    <Icon sx={{ fontSize: 15, color: "#94a3b8", mt: "2px", flexShrink: 0 }} />
    <Typography sx={{ fontSize: "0.8rem", color, fontWeight: strong ? 700 : 500, lineHeight: 1.45, minWidth: 0, overflowWrap: "anywhere" }}>{children}</Typography>
  </Stack>
);

function JobCard({ job, outcome, readOnly, requestMode, onSchedule, onDeliver, onUploadInvoice, onNoteDone, onEdit, onCancel, onRestore }) {
  const st = stageOf(job);
  const stall = stalledDays(job, st);
  const intakeDocs = (job.sitePhotoFiles || []).filter((f) => f.source === "intake");
  const invoiceFiles = job.invoiceFiles || [];
  const [uploading, setUploading] = useState(false);
  const fu = openFollowUp(job);
  const team = [job.team, ...(job.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
  const when = job.noVisit && !job.unscheduled
    ? `ส่งมอบ ${formatThai(moment(job.deliveredAt || job.start), "D MMM YYYY")}`
    : job.unscheduled
    ? (job.plannedMonth ? `ตั้งใจเข้างาน ${formatThai(moment(job.plannedMonth, "YYYY-MM"), "MMMM YYYY")}` : "ยังไม่กำหนดเดือน")
    : `เข้างาน ${formatThai(moment(job.start), "D MMM YYYY")}${job.startTime ? ` ${job.startTime}` : ""}`;
  const due = job.dueDate ? formatThai(moment(job.dueDate), "D MMM YYYY") : "";

  const GHOST = { ...BTN, color: "#334155", borderColor: LINE, "&:hover": { borderColor: "#cbd5e1", bgcolor: SURFACE } };
  // 👀 ดูอย่างเดียว (ช่าง) — ไม่มีปุ่มดำเนินการใดๆ
  const actions = readOnly ? null : st.i === -1 ? (
    <Button variant="outlined" onClick={() => onRestore(job)} startIcon={<RestoreRounded sx={{ fontSize: "17px !important" }} />}
      sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>นำกลับมา</Button>
  ) : st.note ? (
    st.i === 0 ? (
      <>
        <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
          sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
        <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
          sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
        <Button variant="contained" onClick={() => onNoteDone(job)} startIcon={<TaskAltRounded sx={{ fontSize: "17px !important" }} />}
          sx={{ ...SUCCESS, flex: { xs: 1.6, sm: "0 0 auto" } }}>ทำเสร็จแล้ว</Button>
      </>
    ) : (
      <Button variant="outlined" onClick={() => onNoteDone(job, true)} startIcon={<RestoreRounded sx={{ fontSize: "17px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>นำกลับมาทำต่อ</Button>
    )
  ) : st.nv && st.i === 0 ? (
    <>
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onDeliver(job)} startIcon={<LocalShippingOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...SUCCESS, flex: { xs: 1.6, sm: "0 0 auto" } }}>ส่งมอบแล้ว</Button>
    </>
  ) : st.nv ? (
    <>
      <Button component={Link} to="/finance?tab=billing" variant="outlined" startIcon={<ReceiptLongOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>ติดตามวางบิล</Button>
      <Button component="label" variant={st.i === 2 ? "contained" : "outlined"} disabled={uploading} startIcon={<UploadFileOutlined sx={{ fontSize: "17px !important" }} />}
        sx={st.i === 2 ? { ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } } : { ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>
        {uploading ? "กำลังอัปโหลด..." : st.i === 2 ? "อัปโหลดใบวางบิล" : "แนบบิลเพิ่ม"}
        <input hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={async (e) => {
          const picked = [...(e.target.files || [])];
          e.target.value = "";
          if (!picked.length) return;
          setUploading(true);
          await onUploadInvoice(job, picked);
          setUploading(false);
        }} />
      </Button>
    </>
  ) : st.i === 0 ? (
    <>
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onSchedule(job)} startIcon={<EventAvailableOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } }}>{requestMode ? "ขอลงตาราง" : "ส่งลงตาราง"}</Button>
    </>
  ) : (
    <Button component={Link} to={`/operation/${job._id}`} variant="outlined" endIcon={<ChevronRight />}
      sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { borderColor: ACCENT, bgcolor: alpha(ACCENT, 0.04) } }}>ดูงาน</Button>
  );

  // ✅ (15 ต.ค. 2569 ผู้ใช้: "หน้านี้ทำให้สวยงาม และดูข้อมูลง่ายด้วย")
  //    การ์ดแยกใบ: หัว (สถานะ · เลข Job · ป้าย) → ชื่องาน + โครงการ → ตารางข้อมูล "ป้าย : ค่า" → แถบขั้นตอนพื้นเทาด้านล่าง
  const nx = job.cancelledAt ? null : st.note
    ? (st.i === 0 ? { title: "ทำงานนี้", desc: "เสร็จแล้วกด “ทำเสร็จแล้ว”" } : null)
    : st.nv
      ? (st.i === 0 ? { title: "ส่งมอบ", desc: "ส่งของให้ลูกค้าแล้ว กด “ส่งมอบแล้ว” (แนบใบวางบิลได้เลย)" }
        : st.i === 2 ? { title: "วางบิล", desc: "กด “อัปโหลดใบวางบิล” แล้วตามรับเงินที่หน้าติดตามวางบิล" } : null)
      : job.unscheduled
        ? { title: "ส่งลงตาราง", desc: "เลือกวันเข้างาน ผู้รับผิดชอบงาน และหัวหน้าทีม" }
        : st.i >= 0 && st.i < 4 ? nextStepOf(job, "admin") : null;
  const place = [job.site && job.site !== "-" ? job.site : "", job.company && job.company !== job.site ? job.company : ""].filter(Boolean).join(" · ");
  const doc = job.intakeDocType || job.intakeDocNo ? `${DOC_LABEL[job.intakeDocType] || "เอกสาร"}${job.intakeDocNo ? ` ${job.intakeDocNo}` : ""}` : "";
  const schedule = job.intakeNote
    ? (job.noteDoneAt ? `ทำเสร็จ ${formatThai(moment(job.noteDoneAt), "D MMM YYYY")}${job.noteDoneBy ? ` · ${job.noteDoneBy}` : ""}` : `บันทึก ${formatThai(moment(job.intakeAt), "D MMM YYYY")}`)
    : job.noVisit && job.unscheduled ? "ยังไม่ส่งมอบ" : when;
  const ModeIcon = job.intakeNote ? NotesOutlined : job.noVisit ? LocalShippingOutlined : BuildOutlined;
  const modeLabel = job.intakeNote ? "จดงาน" : job.noVisit ? "ส่งของ" : "เข้างาน";
  const tone = st.i === -1 ? MUTED : ACCENT;

  // ✅ (15 ต.ค. 2569 ผู้ใช้: "ยังจัดวางไม่สวย UI ดูยาก ไม่มืออาชีพ" · "ทำให้ชัดเจน ดูง่าย สวยงาม")
  //    แถวเดียวอ่านจบ: ไอคอนรูปแบบงาน · ชื่องาน + เลข Job · โครงการ · ข้อมูลสั้นเรียงบรรทัดเดียว | ปุ่มด้านขวา
  //    ท้ายการ์ด: สถานะ + สิ่งที่ต้องทำต่อ (ซ้าย) · แถบขั้นตอน (ขวา)
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", transition: "border-color .15s, box-shadow .15s", "&:hover": { borderColor: "#cbd5e1", boxShadow: "0 4px 14px -8px rgba(15,23,42,.18)" } }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.5, md: 2 }} alignItems={{ md: "center" }} sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.75 }}>
        <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          {/* ✅ (15 ต.ค. 2569 ผู้ใช้: "ให้บอกด้วยว่างานอะไร ส่งของ จดงาน เข้างาน") — ไอคอน + ชื่อรูปแบบงานใต้ไอคอน */}
          <Stack alignItems="center" spacing={0.4} sx={{ width: 52, flexShrink: 0 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: alpha(tone, 0.08), color: tone }}>
              <ModeIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: tone, lineHeight: 1.2, textAlign: "center", whiteSpace: "nowrap" }}>{modeLabel}</Typography>
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ flexWrap: "wrap", rowGap: 0.25 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK, lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: job.intakeNote ? "pre-line" : undefined }}>
                {job.intakeNote ? (job.description || "บันทึกงาน") : <>{job.title || "งาน"}{job.system ? ` · ${job.system}` : ""}</>}
              </Typography>
              {job.jobNo && <Typography component="span" sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8" }}>{job.jobNo}</Typography>}
              {isUrgent(job) && st.i < 4 && <Chip color="#fff" bg={RED} border={RED}>⚡ ด่วน</Chip>}
              {stall > 0 && <Chip color={RED} bg={alpha(RED, 0.08)} border="transparent">⏰ ค้าง {stall} วัน</Chip>}
              {job.approvalStatus === "pending" && <Chip color={AMBER} bg={alpha(AMBER, 0.12)} border="transparent">รออนุมัติ</Chip>}
              {job.approvalStatus === "rejected" && <Chip color={RED} bg={alpha(RED, 0.08)} border="transparent">ไม่อนุมัติ</Chip>}
              {job.infoPending && st.i < 4 && <Chip color={AMBER} bg={alpha(AMBER, 0.12)} border="transparent">รอข้อมูล</Chip>}
            </Stack>
            {place && <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#475569", mt: 0.2, overflowWrap: "anywhere" }}>{place}</Typography>}

            {/* ✅ (17 ต.ค. 2569) แถวแรก = ป้ายข้อมูลสำคัญโทนเทา (กำหนดเวลา · เสร็จภายใน · ที่มา · เอกสาร) — สีเฉพาะเดือนนี้/เลยกำหนด
                แถวที่สอง = ข้อมูลประกอบ (ผู้รับผิดชอบ · ทีม · ผู้ติดต่อ) */}
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
              {(() => {
                const t = scheduleTagOf(job, schedule);
                return (
                  <Tag icon={t.icon} accent={t.accent} dashed={t.dashed}>
                    {t.text}
                    {t.rel && <Box component="span" sx={{ ml: 0.5, fontWeight: t.accent ? 800 : 600, color: t.accent || "#64748b" }}>· {t.rel}</Box>}
                  </Tag>
                );
              })()}
              {due && st.i < 4 && (() => {
                const late = moment(job.dueDate).isBefore(moment(), "day");
                return <Tag icon={FlagOutlined} accent={late ? RED : null}>เสร็จภายใน {due}{late && <Box component="span" sx={{ ml: 0.5, color: RED, fontWeight: 800 }}>· เลยกำหนด</Box>}</Tag>;
              })()}
              {job.intakeSource && <Tag icon={CallReceivedRounded}>จาก{SOURCE_LABEL[job.intakeSource] || job.intakeSource}</Tag>}
              {doc && <Tag icon={DescriptionOutlined}>{doc}</Tag>}
            </Stack>
            <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 2, rowGap: 0.5, mt: 0.9 }}>
              {job.responsiblePerson && <Fact icon={PersonOutlineOutlined}>{job.responsiblePerson}</Fact>}
              {!job.unscheduled && !job.noVisit && !job.intakeNote && <Fact icon={GroupsOutlined}>{team || "ยังไม่มอบหมายทีม"}</Fact>}
              {(job.contactName || job.contactTel) && (
                <Fact icon={PhoneOutlined}>
                  {job.contactName || ""}{job.contactName && job.contactTel ? " · " : ""}
                  {job.contactTel && <Box component="a" href={`tel:${job.contactTel}`} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{job.contactTel}</Box>}
                </Fact>
              )}
            </Stack>
            {/* ✅ (15 ต.ค. 2569 ผู้ใช้: "แสดงรายละเอียดงานคร่าวๆด้วย") — กล่องรายละเอียด (ไม่เกิน 3 บรรทัด) + อุปกรณ์ที่ต้องเตรียม */}
            {!job.intakeNote && (
              <Box sx={{ mt: 1, px: 1.25, py: 0.9, borderRadius: 2, bgcolor: SURFACE, border: `1px solid ${LINE}` }}>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8", mb: 0.25 }}>{job.noVisit ? "รายการที่ต้องส่ง" : "รายละเอียดงาน"}</Typography>
                <Typography sx={{ fontSize: "0.82rem", color: job.description ? "#334155" : "#94a3b8", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {job.description || "ยังไม่ได้ใส่รายละเอียด — กด “แก้ไข” เพื่อเพิ่ม"}
                </Typography>
                {job.equipment && (
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, overflowWrap: "anywhere" }}>
                    <Box component="span" sx={{ fontWeight: 800 }}>อุปกรณ์:</Box> {String(job.equipment).split(/\n+/).map((x) => x.trim()).filter(Boolean).join(" · ")}
                  </Typography>
                )}
              </Box>
            )}
            {outcome && <OutcomeBar oc={outcome} />}
            {(intakeDocs.length > 0 || (job.noVisit && invoiceFiles.length > 0)) && (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                <FileLinks files={intakeDocs} />
                {job.noVisit && invoiceFiles.length > 0 && <FileLinks files={invoiceFiles} label="ใบวางบิล" />}
              </Stack>
            )}
            {(job.infoPending && job.infoPendingNote) || (fu && st.i === 2) || st.i === -1 ? (
              <Stack spacing={0.4} sx={{ mt: 0.9 }}>
                {job.infoPending && job.infoPendingNote && <Line icon={HourglassTopRounded} color={AMBER}>ขาด: {job.infoPendingNote}</Line>}
                {fu && st.i === 2 && <Line icon={ReportProblemOutlined} color={AMBER} strong>{fu.reason}{fu.note ? ` — ${fu.note}` : ""} · ผู้รับผิดชอบต่อ: {fu.nextOwner}</Line>}
                {st.i === -1 && (
                  <Line icon={BlockRounded} color={RED} strong>
                    เหตุผล: {job.cancelReason || "-"} · ยกเลิกโดย {job.cancelledBy || "-"} {formatThai(moment(job.cancelledAt), "D MMM YYYY HH:mm")}
                  </Line>
                )}
              </Stack>
            ) : null}
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, width: { xs: "100%", md: "auto" } }}>{actions}</Stack>
      </Stack>

      {/* ท้ายการ์ด: สถานะ + สิ่งที่ต้องทำต่อ | แถบขั้นตอน */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1, md: 2.5 }} alignItems={{ md: "center" }}
        sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.1, bgcolor: SURFACE, borderTop: `1px solid ${LINE}` }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          <Chip color={st.color} bg={alpha(st.color, 0.1)} border="transparent">{st.label}</Chip>
          {nx && (
            <Typography sx={{ fontSize: "0.8rem", color: "#334155", minWidth: 0, overflowWrap: "anywhere" }}>
              <Box component="span" sx={{ fontWeight: 800, color: INK }}>{nx.title}</Box>
              <Box component="span" sx={{ color: MUTED }}> — {nx.desc}</Box>
            </Typography>
          )}
        </Stack>
        {st.i >= 0 && <Box sx={{ width: { xs: "100%", md: 360 }, flexShrink: 0 }}><StageBar stage={st} /></Box>}
      </Stack>
    </Box>
  );
}

/** ป้ายเม็ดยาเล็ก (สถานะ / ด่วน / ค้าง) */
const Chip = ({ children, color = "#334155", bg = SURFACE, border = LINE }) => (
  <Box component="span" sx={{ px: 0.9, height: 22, display: "inline-flex", alignItems: "center", gap: 0.4, flexShrink: 0, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color, bgcolor: bg, border: `1px solid ${border}`, whiteSpace: "nowrap" }}>{children}</Box>
);
/**
 * ป้ายข้อมูลสำคัญ (กำหนดเวลา · ที่มา · เอกสาร)
 * 🔁 (17 ต.ค. 2569 ผู้ใช้: "สีดูรกเกินไป ไม่มืออาชีพ") — ป้ายโทนเทาเดียวกันหมด · สีใช้เฉพาะ "สิ่งที่ต้องรีบดู"
 *    (เดือนนี้ = ส้ม · เลยกำหนด = แดง) ที่ไอคอนกับคำต่อท้ายเท่านั้น ไม่ระบายพื้น
 */
const Tag = ({ icon: Icon, accent, dashed, children }) => (
  <Box component="span" sx={{
    display: "inline-flex", alignItems: "center", gap: 0.6, height: 26, px: 1, borderRadius: 1.5, maxWidth: "100%",
    fontSize: "0.78rem", fontWeight: 700, color: "#334155", bgcolor: dashed ? "transparent" : SURFACE,
    border: `1px ${dashed ? "dashed" : "solid"} ${accent ? alpha(accent, 0.45) : LINE}`, whiteSpace: "nowrap", overflow: "hidden",
  }}>
    {Icon && <Icon sx={{ fontSize: 15, flexShrink: 0, color: accent || "#94a3b8" }} />}
    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</Box>
  </Box>
);
/** ป้ายกำหนดเวลา: เดือนที่ตั้งใจเข้างาน (+ อีกกี่เดือน) · วันเข้างาน · ส่งมอบ · บันทึก — accent เฉพาะเดือนนี้/เลยกำหนด */
const scheduleTagOf = (job, text) => {
  if (job.intakeNote || job.noVisit || !job.unscheduled) {
    return { icon: job.noVisit ? LocalShippingOutlined : job.unscheduled || job.intakeNote ? CalendarMonthOutlined : EventAvailableOutlined, text };
  }
  if (!job.plannedMonth) return { icon: CalendarMonthOutlined, text: "ยังไม่กำหนดเดือนเข้างาน", dashed: true };
  const diff = moment(job.plannedMonth, "YYYY-MM").diff(moment().startOf("month"), "months");
  return {
    icon: CalendarMonthOutlined,
    accent: diff < 0 ? RED : diff === 0 ? AMBER : null,
    text: `ตั้งใจเข้างาน ${formatThai(moment(job.plannedMonth, "YYYY-MM"), "MMM YYYY")}`,
    rel: diff > 0 ? `อีก ${diff} เดือน` : diff === 0 ? "เดือนนี้" : `เลยมา ${-diff} เดือน`,
  };
};
/** ข้อมูลสั้น 1 ชิ้น: ไอคอนเทา + ข้อความ */
const Fact = ({ icon: Icon, children }) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
    <Icon sx={{ fontSize: 15, color: "#94a3b8", flexShrink: 0 }} />
    <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155", overflowWrap: "anywhere" }}>{children}</Typography>
  </Stack>
);

export default function JobIntake() {
  const { userData } = useAuth() || {};
  // ✅ (15 ต.ค. 2569 ผู้ใช้: "ให้ช่างเข้ามาดูได้ด้วย แต่ไม่สามารถดำเนินการได้") — คนจัดคิว = จัดการได้ · คนอื่น = ดูอย่างเดียว
  const canManage = can(userData, "assignDispatch") || can(userData, "editAnyJob");
  // ✅ (15 ต.ค. 2569 ผู้ใช้: "ช่างกดเพิ่มงานได้ แต่งานที่ขอลงตารางต้องไปขอลงงานแบบเดิม" → ส่งขออนุมัติ)
  //    ช่าง: รับงานใหม่ได้ + จัดการงานที่ตัวเองรับไว้ (แก้ไข/ยกเลิก/ขอลงตาราง/ส่งมอบ/ทำเสร็จ) · งานของคนอื่นดูอย่างเดียว
  //    งานที่ช่างรับเป็น "รออนุมัติ" อัตโนมัติ (server) → ขอลงตารางแล้วแอดมินอนุมัติที่หน้าคำขอลงงาน
  const canCreate = canManage || can(userData, "receiveDispatch");
  const me = String(userData?.userId || "");
  const isMine = (j) => String(j.userId || "") === me;
  const [jobs, setJobs] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [rawDrafts, setRawDrafts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("waiting");
  const [scheduling, setScheduling] = useState(null);
  const [delivering, setDelivering] = useState(null);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState(() => new Map()); // jobGroupId/_id → ทุกวันของงาน (หาใบเสนอราคาของกลุ่ม)
  const [ocFilter, setOcFilter] = useState("all");
  const [view, setView] = useState(() => { try { return localStorage.getItem("tt-intake-view") || "card"; } catch { return "card"; } });
  const changeView = (v) => { setView(v); try { localStorage.setItem("tt-intake-view", v); } catch { /* ignore */ } };
  const groupOf = (arr) => {
    const m = new Map();
    arr.forEach((e) => { const k = String(e.jobGroupId || e._id); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
    return m;
  };

  const load = useCallback(async () => {
    try {
      if (!canManage) {
        // ดูอย่างเดียว: รายการงานใหม่ทั้งแผนก (ไม่รวมที่ยกเลิก) — เส้นเดียว ไม่ต้องดึงงานทั้งระบบ
        const all = await EventService.GetIntakeList().catch(() => []);
        setGroups(groupOf(all));
        const seenRo = new Set();
        setJobs(all.filter((e) => !e.cancelledAt)
          .filter((e) => { const k = e.jobGroupId || e._id; if (seenRo.has(k)) return false; seenRo.add(k); return true; }));
        return;
      }
      const [dr, ev] = await Promise.all([
        EventService.GetDraftEvents({ includeCancelled: true }).catch(() => null),
        EventService.getEventOp().catch(() => null),
      ]);
      const drafts = Array.isArray(dr?.drafts) ? dr.drafts : [];
      const events = ev?.userEvents || [];
      setRawDrafts(drafts.filter((d) => !d.cancelledAt));
      setRawEvents(events);
      setGroups(groupOf(events));
      // ✅ เฉพาะงานที่รับผ่านเมนูนี้ — งานหลายวันรวมเป็นงานเดียว (ใช้วันแรก)
      const seen = new Set();
      const list = [...drafts, ...events.slice().sort((a, b) => new Date(a.start) - new Date(b.start))]
        .filter((e) => e.intakeAt)
        .filter((e) => { const k = e.jobGroupId || e._id; if (seen.has(k)) return false; seen.add(k); return true; });
      setJobs(list);
    } catch {
      setJobs((p) => p || []);
    }
  }, [canManage]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { AuthService.getAllUserData().then((r) => setEmployees(r?.allUser || [])).catch(() => {}); }, []);
  useRealtime("events", () => { load(); });

  const openForm = (existingDraft) => getAddDraftEvent({
    intake: true,
    defaultMonth: moment().format("YYYY-MM"),
    existingDraft,
    events: rawEvents,
    drafts: rawDrafts,
    userData,
    onSaved: async () => { await load(); refreshAppBadges(); setTab("waiting"); },
    CustomerService, AuthService, JobTypeService, SystemTypeService, EventService, Swal, TomSelect, moment,
  });

  // ✅ ยกเลิกงานที่รับไว้แต่ไม่ได้ทำ — บังคับเหตุผล · เก็บไว้ในแท็บ "ยกเลิก" นำกลับมาได้
  const cancelJob = async (job) => {
    const r = await Swal.fire({
      title: "ยกเลิกงานนี้?",
      html: `<div style="font-size:14px;color:#475569">${[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</div>`,
      input: "textarea",
      inputLabel: "เหตุผลที่ยกเลิก",
      inputPlaceholder: "เช่น ลูกค้ายกเลิก / ได้ช่างที่อื่นแล้ว / รับงานซ้ำ",
      inputValidator: (v) => (!String(v || "").trim() ? "กรุณาระบุเหตุผล" : undefined),
      showCancelButton: true,
      confirmButtonText: "ยกเลิกงาน",
      cancelButtonText: "ไม่ยกเลิก",
      confirmButtonColor: RED,
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    try {
      await EventService.CancelIntake(job._id, { reason: r.value });
      await load(); refreshAppBadges();
      Swal.fire({ icon: "success", title: "ยกเลิกงานแล้ว", text: "ดูย้อนหลังได้ที่แท็บ “ยกเลิก”", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ยกเลิกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };
  // ✅ (15 ต.ค. 2569) บันทึกงาน → ทำเสร็จแล้ว / นำกลับมาทำต่อ
  const noteDone = async (job, undo = false) => {
    try {
      await EventService.NoteDone(job._id, undo ? { undo: true } : {});
      await load(); refreshAppBadges();
      if (undo) setTab("waiting");
      Swal.fire({ icon: "success", title: undo ? "นำกลับมาทำต่อแล้ว" : "ทำเสร็จแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };
  // ✅ (15 ต.ค. 2569) อัปโหลดใบวางบิลของงานไม่ต้องเข้างาน
  const uploadInvoice = async (job, files) => {
    let failed = 0;
    for (const f of files) {
      try { await EventService.Upload(job._id, f, "invoice"); } catch { failed += 1; }
    }
    await load(); refreshAppBadges();
    Swal.fire(failed
      ? { icon: "warning", title: "อัปโหลดไม่ครบ", text: `ไม่สำเร็จ ${failed} จาก ${files.length} ไฟล์ — ลองใหม่อีกครั้ง` }
      : { icon: "success", title: "แนบใบวางบิลแล้ว", text: "ตามรับเงินต่อได้ที่หน้าติดตามวางบิล", timer: 1600, showConfirmButton: false });
  };
  const restoreJob = async (job) => {
    try {
      await EventService.CancelIntake(job._id, { restore: true });
      await load(); refreshAppBadges(); setTab("waiting");
      Swal.fire({ icon: "success", title: "นำงานกลับมาแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };

  const withStage = useMemo(() => (jobs || []).map((j) => {
    const s = stageOf(j);
    return { j, s, oc: outcomeOf(j, s, groups.get(String(j.jobGroupId || j._id))) };
  }), [jobs, groups]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, withStage.filter((x) => t.test(x.s, x.oc)).length])), [withStage]);
  // สรุปผลเสนอราคา (แท็บติดตามผล) — จำนวนต่อกลุ่ม · อัตราได้งาน · มูลค่าที่ได้
  const ocStats = useMemo(() => {
    const c = { all: 0, todo: 0, wait: 0, won: 0, lost: 0, wonValue: 0 };
    withStage.forEach(({ oc }) => { if (!oc) return; c.all += 1; c[oc.group] += 1; if (oc.group === "won") c.wonValue += oc.amount; });
    return c;
  }, [withStage]);
  const list = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    // ✅ ค้นหา: ชื่องาน · โครงการ · บริษัท · เลข Job · เลขเอกสาร · ผู้รับผิดชอบ
    const kw = q.trim().toLowerCase();
    const hit = (j) => !kw || [j.title, j.system, j.site, j.company, j.jobNo, j.intakeDocNo, j.responsiblePerson, j.description]
      .some((v) => String(v || "").toLowerCase().includes(kw));
    return withStage.filter((x) => t.test(x.s, x.oc) && hit(x.j) && (tab !== "result" || ocFilter === "all" || x.oc?.group === ocFilter))
      // ✅ (11 ต.ค. 2569 ผู้ใช้: "งานใหม่ที่ลงตารางควรมาที่บนสุดด้วย") — ล่าสุดขึ้นก่อนทุกแท็บ
      //    กำลังทำ = เรียงตามเวลาส่งลงตาราง (scheduledAt) · รอลงตาราง = งานด่วนก่อน แล้วรับเข้าล่าสุด · เสร็จแล้ว = ปิดล่าสุด
      .sort(({ j: a, oc: oa }, { j: b, oc: ob }) => (tab === "result"
        // ติดตามผล: ต้องทำก่อน (ยังไม่ส่ง/ถึงเวลาติดตาม) → รอตอบ → ได้/ไม่ได้งาน
        ? (["todo", "wait", "won", "lost"].indexOf(oa?.group) - ["todo", "wait", "won", "lost"].indexOf(ob?.group))
          || ((ob?.key === "follow_up") - (oa?.key === "follow_up"))
          || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        : tab === "done"
          ? new Date(b.closeApprovedAt || b.updatedAt || 0) - new Date(a.closeApprovedAt || a.updatedAt || 0)
          : tab === "active"
            ? new Date(b.scheduledAt || b.createdAt || b.intakeAt || 0) - new Date(a.scheduledAt || a.createdAt || a.intakeAt || 0)
            : (isUrgent(b) - isUrgent(a)) || new Date(b.intakeAt || 0) - new Date(a.intakeAt || 0)));
  }, [withStage, tab, q, ocFilter]);

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: view === "table" ? 1500 : 1000, mx: "auto" }}>
      <PageHeader icon={<PostAddOutlined />} title="งานใหม่"
        subtitle="รับงาน → ส่งลงตาราง หรือ ส่งมอบ + วางบิล"
        actions={canCreate
          ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} disabled={!jobs} sx={{ ...PRIMARY, height: 40, px: { xs: 1.25, sm: 2 } }}>รับงานใหม่</Button>
          : <Box component="span" sx={{ px: 1.25, py: 0.5, borderRadius: 99, fontSize: "0.74rem", fontWeight: 700, color: MUTED, bgcolor: SURFACE, border: `1px solid ${LINE}`, whiteSpace: "nowrap" }}>ดูอย่างเดียว</Box>} />

      {/* แท็บตามขั้นตอน */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {TABS.filter((t) => !(t.hideEmpty || t.key === "result") || counts[t.key] > 0 || tab === t.key).map((t) => {
          const on = tab === t.key;
          return (
            <ButtonBase key={t.key} onClick={() => setTab(t.key)} sx={{
              // ✅ มือถือ: ตัวเลขบน ชื่อล่าง — 4 แท็บไม่ล้นจอ (ผู้ใช้แจ้งแท็บแรกตกขอบ)
              flex: { xs: "1 0 auto", sm: "0 0 auto" }, minWidth: { xs: 64, sm: 0 }, height: { xs: 54, sm: 40 }, px: { xs: 0.5, sm: 1.75 }, borderRadius: 2.5,
              flexDirection: { xs: "column-reverse", sm: "row" }, fontSize: { xs: "0.74rem", sm: "0.84rem" }, fontWeight: 800, gap: { xs: 0.2, sm: 0.6 }, whiteSpace: "nowrap", overflow: "hidden",
              border: `1.5px solid ${on ? ACCENT : LINE}`, bgcolor: on ? alpha(ACCENT, 0.07) : "#fff", color: on ? ACCENT : "#334155",
            }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t.label}</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{t.short}</Box>
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.72rem", bgcolor: on ? ACCENT : SURFACE, color: on ? "#fff" : MUTED }}>{counts[t.key] || 0}</Box>
            </ButtonBase>
          );
        })}
      </Stack>

      {/* ค้นหา + สลับมุมมอง การ์ด / ตาราง · ตาราง: กดแถวเพื่อกางรายละเอียดเต็ม */}
      <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1, height: 40, px: 1.5, borderRadius: 2.5, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          <Search sx={{ fontSize: 18, color: "#94a3b8" }} />
          <Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่องาน / โครงการ / เลข Job / เลขเอกสาร"
            sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, fontSize: "0.86rem", fontFamily: "inherit", bgcolor: "transparent", color: INK }} />
          {q && <IconButton size="small" onClick={() => setQ("")}><Close sx={{ fontSize: 16 }} /></IconButton>}
        </Box>
        <Stack direction="row" sx={{ flexShrink: 0, p: 0.4, borderRadius: 2.5, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          {[["card", ViewAgendaOutlined, "การ์ด"], ["table", TableRowsOutlined, "ตาราง"]].map(([k, Ico, label]) => (
            <ButtonBase key={k} onClick={() => changeView(k)} aria-label={`มุมมอง${label}`}
              sx={{ height: 30, px: 1.1, gap: 0.5, borderRadius: 2, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 800,
                color: view === k ? "#fff" : "#475569", bgcolor: view === k ? ACCENT : "transparent" }}>
              <Ico sx={{ fontSize: 17 }} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{label}</Box>
            </ButtonBase>
          ))}
        </Stack>
      </Stack>

      {/* แท็บติดตามผล: สรุป + กรองตามผล */}
      {tab === "result" && (
        <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 3, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
            {OUTCOME_FILTERS.map((f) => {
              const on = ocFilter === f.key;
              const color = f.color || "#334155";
              return (
                <ButtonBase key={f.key} onClick={() => setOcFilter(f.key)}
                  sx={{ height: 32, px: 1.25, gap: 0.6, borderRadius: 99, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: on ? 800 : 600,
                    color: on ? color : "#475569", bgcolor: on ? alpha(color, 0.08) : "transparent", border: `1px solid ${on ? alpha(color, 0.5) : LINE}` }}>
                  {f.color && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: f.color }} />}
                  {f.label}
                  <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 800, bgcolor: on ? color : SURFACE, color: on ? "#fff" : MUTED }}>{ocStats[f.key] || 0}</Box>
                </ButtonBase>
              );
            })}
          </Stack>
          {(ocStats.won + ocStats.lost) > 0 && (
            <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#475569" }}>
              อัตราได้งาน <Box component="span" sx={{ fontWeight: 900, color: GREEN }}>{Math.round((ocStats.won / (ocStats.won + ocStats.lost)) * 100)}%</Box>
              {" "}({ocStats.won} จาก {ocStats.won + ocStats.lost} งานที่ลูกค้าตอบแล้ว)
              {ocStats.wonValue > 0 && <> · มูลค่างานที่ได้ <Box component="span" sx={{ fontWeight: 900, color: INK }}>{baht(ocStats.wonValue)}</Box></>}
            </Typography>
          )}
        </Box>
      )}

      {!jobs ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : list.length ? (
        view === "table" ? (
          <>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.75, px: 0.5 }}>กดแถวเพื่อดูรายละเอียดเต็ม (ไฟล์แนบ · ขั้นตอน · แก้ไข/ยกเลิก)</Typography>
          <JobTable rows={list} readOnlyOf={(j) => !canManage && !isMine(j)} requestMode={!canManage} onSchedule={setScheduling} onDeliver={setDelivering}
            renderCard={(j, oc) => <JobCard job={j} outcome={oc} readOnly={!canManage && !isMine(j)} requestMode={!canManage} onSchedule={setScheduling} onDeliver={setDelivering} onUploadInvoice={uploadInvoice} onNoteDone={noteDone} onEdit={openForm} onCancel={cancelJob} onRestore={restoreJob} />} />
          </>
        ) : (
          <Stack spacing={1.25}>{list.map(({ j, oc }) => <JobCard key={j._id} job={j} outcome={oc} readOnly={!canManage && !isMine(j)} requestMode={!canManage} onSchedule={setScheduling} onDeliver={setDelivering} onUploadInvoice={uploadInvoice} onNoteDone={noteDone} onEdit={openForm} onCancel={cancelJob} onRestore={restoreJob} />)}</Stack>
        )
      ) : (
        <EmptyState icon={<PostAddOutlined />}
          title={q ? "ไม่พบงานที่ค้นหา" : tab === "waiting" ? "ไม่มีงานรอดำเนินการ" : tab === "active" ? "ไม่มีงานที่กำลังดำเนินการ" : tab === "cancelled" ? "ไม่มีงานที่ยกเลิก" : tab === "result" ? "ไม่มีงานในกลุ่มนี้" : "ยังไม่มีงานที่เสร็จ"}
          hint={tab === "waiting" && canCreate ? "ได้งานมาแล้ว กด “รับงานใหม่” เพื่อกรอกเก็บไว้ก่อน" : undefined}
          action={tab === "waiting" && canCreate ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} sx={{ ...PRIMARY, mt: 1 }}>รับงานใหม่</Button> : null} />
      )}

      {delivering && (
        <DeliverDialog job={delivering} onClose={() => setDelivering(null)}
          onDone={async () => { setDelivering(null); await load(); refreshAppBadges(); }} />
      )}

      {scheduling && (
        <ScheduleDialog job={scheduling} employees={employees} canAssignResponsible={can(userData, "editContracts")} requestMode={!canManage} onClose={() => setScheduling(null)}
          onDone={async () => { setScheduling(null); await load(); refreshAppBadges(); }} />
      )}
    </Box>
  );
}
