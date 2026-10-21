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
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import DateCell from "@/shared/ui/DateCell";
import RefDoc from "@/shared/ui/RefDoc";
import { billingStatus, BILLING_STATE_META } from "@/shared/utils/billing";
import JobKindTag from "@/shared/ui/JobKindTag";
import { resolveQuotationGroup, getFollowUpInfo, QUOTE_STATUS } from "@/shared/utils/quotationTracking";
import { Link, useLocation } from "react-router-dom";
import moment from "moment";
import Swal from "@/shared/ui/swal";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import {
  Box, Stack, Typography, Button, ButtonBase, Skeleton, Dialog, DialogContent, DialogActions, IconButton, Avatar, Collapse,
} from "@mui/material";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import { alpha } from "@mui/material/styles";
import {
  PostAddOutlined, AddRounded, EditOutlined, ChevronRight, Close, EventAvailableOutlined, FlagOutlined,
  NotesOutlined, CalendarMonthOutlined, GroupsOutlined, PersonOutlineOutlined, BuildOutlined, CallReceivedRounded, DescriptionOutlined, PhoneOutlined, HourglassTopRounded, ReportProblemOutlined,
  BlockRounded, RestoreRounded, PersonOffOutlined,
  LocalShippingOutlined, ReceiptLongOutlined, TaskAltRounded, UploadFileOutlined, AttachFileRounded, Search,
  ViewAgendaOutlined, TableRowsOutlined, RequestQuoteOutlined, ExpandMoreRounded,
  VerifiedOutlined, SendOutlined, NotificationsActiveOutlined, EditNoteOutlined, CheckCircleRounded, CancelRounded, DoNotDisturbOnOutlined,
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
import { PageHeader, EmptyState, INK, MUTED, LINE, ACCENT, SURFACE, PAGE_SX } from "@/shared/ui/PageKit";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { getAddDraftEvent, INTAKE_SOURCE_OPTS } from "@/features/calendar/components/EventForms/AddDraftEvent";
import { isUrgent, openFollowUp } from "@/shared/utils/jobFlow";
import { MiniSteps } from "@/features/attendance/components/CheckInOutPanel";
import { nextStepOf } from "@/shared/ui/JobFlow";
import { can, rankLabel } from "@/shared/utils/roles";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import DispatchList from "@/features/dispatch/components/DispatchList";
import MobileSheet from "@/shared/ui/MobileSheet";
import { initialViewMode } from "@/shared/ui/ViewToggle";


const AMBER = "#d97706";
const GREEN = "#16a34a";
const RED = "#dc2626";

/** ขั้นตอนของงานที่รับไว้ — ใช้ทั้งแถบขั้นตอนและแท็บ */
// ✅ (11 ต.ค. 2569) "ช่างทำงาน" → "เข้างาน" (ขั้นนี้เริ่มเมื่อหัวหน้าทีมกดเข้างาน — คำเดียวกับการ์ดงาน)
const STAGES = ["รับงาน", "ลงตาราง", "เข้างาน", "ตรวจปิดงาน", "เสร็จ"];
/** ✅ (15 ต.ค. 2569) งานไม่ต้องเข้างาน (ส่งของ/ขายของ) */
const STAGES_NV = ["รับงาน", "ส่งของ", "วางบิล", "เสร็จ"];

// ✅ (20 ต.ค. 2569) งานที่ลงตารางตรง / อนุมัติคำขอลงงาน ก็เข้ามาหน้านี้ — ป้ายที่มาของมันเอง
const SOURCE_LABEL = { ...Object.fromEntries(INTAKE_SOURCE_OPTS), calendar: "ตารางงาน (ลงตรง)", dispatch: "คำขอลงงาน" };
/** รับงานจาก — แผนก (+ ผู้แจ้ง สำหรับงานจากใบแจ้งงาน) */
const sourceText = (j) => [SOURCE_LABEL[j.intakeSource] || j.intakeSource, j.dispatchNo && j.intakeBy ? j.intakeBy : ""].filter(Boolean).join(" · ");
const invoicedOf = (e) => Boolean((e.invoiceFiles || []).length || e.billing?.invoicedAt);
/** ✅ (15 ต.ค. 2569) บันทึกงาน (โน๊ต) */
const STAGES_NOTE = ["บันทึก", "ทำ", "เสร็จ"];
/** ✅ ค้างขั้นเดิมเกิน 2 วัน (ตรงกับตัวแจ้งเตือนฝั่ง server: checkAndNotifyStalledIntake) — คืนจำนวนวัน หรือ 0 */
const STALL_DAYS = 2;
// 🐛 (20 ต.ค. 2569 ผู้ใช้: "ทำไมขึ้นค้างงาน ทั้งที่กำหนดเข้าเดือน ม.ค.") งานที่วางแผนเข้าเดือนข้างหน้า ยังไม่ถึงเวลาส่งลงตาราง
//    = ไม่ค้าง · นับค้างจาก "วันรับงาน หรือ ต้นเดือนที่วางแผนไว้ แล้วแต่อันไหนช้ากว่า" (server: OverdueReminder ใช้กติกาเดียวกัน)
const stalledDays = (e, st) => {
  let since = st.i === 0 ? e.intakeAt : st.nv && st.i === 2 ? (e.deliveredAt || e.scheduledAt) : null;
  if (!since) return 0;
  if (st.i === 0 && e.plannedMonth && !st.nv && !st.note) {
    const planStart = moment(e.plannedMonth, "YYYY-MM").startOf("month");
    if (planStart.isAfter(moment(since))) since = planStart.toDate();
  }
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
    if (e.unscheduled) return { i: 0, label: "รอส่งของ", color: AMBER, nv: true, bar: 0 };
    if (invoicedOf(e)) return { i: 4, label: "วางบิลแล้ว", color: GREEN, nv: true, bar: STAGES_NV.length };
    // ✅ (19 ต.ค. 2569) ส่งของแล้ว + เลือก "ไม่ต้องวางบิล" = เสร็จสิ้น
    if (e.invoiceApplicable === false) return { i: 4, label: "เสร็จสิ้น", color: GREEN, nv: true, bar: STAGES_NV.length };
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
// กล่องใบเสนอราคาตัวเดียวกับหน้าติดตามใบเสนอราคา — โหลดเมื่อกดเปิดเท่านั้น
// 🔁 (21 ต.ค. 2569 ผู้ใช้: "หน้าคำขอลงงานให้ดำเนินการรวมกันกับหน้ารับงาน แยกกันไปมาดูสับสน")
//    คำขอลงงาน (ใบแจ้งงานจากทุกฝ่าย) + แผนงานรออนุมัติ = แท็บ "คำขอ · รออนุมัติ" ในหน้านี้ (/dispatch เปิดแท็บนี้)
//    ส่วน "ลงแผนงานแล้ว" ไม่ต้องมีแยก — งานที่ลงแล้วอยู่แท็บ กำลังดำเนินการ ของหน้านี้อยู่แล้ว
const PendingApprovalsPanel = lazyWithRetry(() => import("@/features/operation/components/PendingApprovalsPanel"));
const QuotationDialogHost = lazyWithRetry(() => import("@/features/finance/pages/QuotationTracking").then((m) => ({ default: m.QuotationDialogHost })));
const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const OUTCOME = {
  // ชื่อ/สีจาก QUOTE_STATUS (ชุดเดียวกับหน้าติดตามใบเสนอราคา) — ที่นี่กำหนดแค่ปุ่ม/กลุ่ม
  waiting_file: { ...QUOTE_STATUS.waiting_file, act: "แนบใบเสนอราคา", to: "qt", group: "todo" },
  not_sent: { ...QUOTE_STATUS.not_sent, act: "ดูใบเสนอราคา", to: "qt", group: "todo" },
  sent: { ...QUOTE_STATUS.sent, act: "อัปเดตผล", to: "qt", group: "wait" },
  follow_up: { ...QUOTE_STATUS.follow_up, act: "บันทึกการติดตาม", to: "qt", group: "wait" },
  revising: { ...QUOTE_STATUS.revising, act: "อัปเดตผล", to: "qt", group: "wait" },
  approved: { ...QUOTE_STATUS.approved, act: "ดูใบเสนอราคา", to: "qt", group: "won" },
  rejected: { ...QUOTE_STATUS.rejected, act: "ดูใบเสนอราคา", to: "qt", group: "lost" },
  // ✅ (19 ต.ค. 2569 ผู้ใช้: "จะรู้ได้ไงว่างานพวกนี้มีใบเสนอราคาแนบแล้ว โดยไม่ต้องเปิดหน้าอื่น") — สถานะที่รู้ได้จากตอนรับงาน
  na: { label: "ไม่ต้องเสนอราคา", color: MUTED, quiet: true, intake: true },
  none: { label: "ยังไม่มี", color: MUTED, act: "แนบใบเสนอราคา", quiet: true, intake: true },
};
const outcomeOf = (job, st, sessions) => {
  if (!st || st.note || st.i === -1) return null;
  const list = (sessions && sessions.length ? sessions : [job]).slice().sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0));
  const anchor = list.find((e) => e.quotationStatus || (e.quotationFiles || []).length || e.quotationApplicable === true) || list[0];
  const key = resolveQuotationGroup(anchor);
  // 🔁 (19 ต.ค. 2569 ผู้ใช้: "สับสน ทำไมมีหลายหน้า ต่างกันยังไง") เดิมงานที่เข้างานแล้วทุกงานขึ้น "ยังไม่มีใบเสนอราคา"
  //    ทั้งที่งานบริการส่วนใหญ่ไม่ต้องเสนอราคา และหน้านี้มีแท็บ "ติดตามผลเสนอราคา" ซ้ำกับหน้าติดตามใบเสนอราคา
  //    → ติดตาม/อัปเดตผลที่หน้า "ติดตามใบเสนอราคา" ที่เดียว · ที่นี่โชว์ผลเฉพาะงานที่มีใบเสนอราคาจริง (อ่านอย่างเดียว + ลิงก์ไป)
  //    🔁 แต่ต้องตอบได้ในหน้านี้เลยว่า "มีใบเสนอราคาหรือยัง" → งานที่ยังไม่อยู่ในระบบติดตาม ใช้ข้อมูลตอนรับงานแทน
  //       (ใบเสนอราคา/PO ที่แนบมาตอนรับงาน · ระบุว่าไม่ต้องเสนอราคา · หรือยังไม่มี) — แสดงทุกงาน ไม่ต้องเปิดหน้าอื่น
  // 🔁 (19 ต.ค. 2569 ผู้ใช้: "เอกสารอ้างอิงทีแรก ไม่ควรมารวมกับใบเสนอราคาที่แนบภายหลัง งง") — แยกขาดจากกัน:
  //    เอกสารตอนรับงาน = คอลัมน์ "เอกสารอ้างอิง" (RefDocCell) · ช่องนี้ = ใบเสนอราคาในระบบติดตามเท่านั้น
  if (!key) {
    if (st.nv) return null; // งานส่งของ ไม่มีขั้นเสนอราคา
    const ik = anchor.quotationApplicable === false ? "na" : "none";
    return { key: ik, ...OUTCOME[ik], facts: [], amount: 0, href: null, files: [], qid: job.unscheduled ? null : anchor._id };
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
  const meta = OUTCOME[key];
  return { key, ...meta, facts, amount: Number(anchor.quotationAmount) || 0, files: anchor.quotationFiles || [], qid: anchor._id, href: meta.to === "qt" ? `/finance?tab=quotations&jobId=${anchor._id}` : `/operation/${anchor._id}` };
};

/**
 * ช่อง/แถบ "ใบเสนอราคา" — ไอคอนสีตามสถานะ · ชื่อสถานะตัวหนา · เลขที่/ข้อมูลสั้น · ขั้น 3 ขีด (แนบ → ส่งลูกค้า → ลูกค้าตอบ)
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "แก้ไขให้ดูง่าย สังเกตได้ง่าย และสวยงามกว่านี้") — เดิมเป็นป้ายตัวเล็กสีจาง กวาดตาแล้วไม่เห็น
 *    ใช้ชิ้นเดียวกันทั้งตารางและการ์ด · สถานะที่ไม่ต้องทำอะไร (ยังไม่มี / ไม่ต้องเสนอราคา) เป็นสีเทา ไม่แย่งสายตา
 */
const QUOTE_ICON = {
  none: DescriptionOutlined, na: DoNotDisturbOnOutlined, po: VerifiedOutlined,
  waiting_file: RequestQuoteOutlined, not_sent: RequestQuoteOutlined, sent: SendOutlined, follow_up: NotificationsActiveOutlined,
  revising: EditNoteOutlined, approved: CheckCircleRounded, rejected: CancelRounded,
  ref_qt: RequestQuoteOutlined, ref_doc: DescriptionOutlined,
};
const QUOTE_STEP = { none: 0, waiting_file: 0, not_sent: 1, sent: 2, follow_up: 2, revising: 2, approved: 3, rejected: 3 };
const QUOTE_STEPS = ["แนบ", "ติดตาม", "ผลลัพธ์"];

function QuoteSteps({ oc, labels = true }) {
  const n = QUOTE_STEP[oc.key];
  if (n === undefined || oc.quiet) return null;
  return (
    <Stack direction="row" gap={0.4} sx={{ mt: 0.6, maxWidth: 170 }} title={QUOTE_STEPS.map((x, i) => `${i < n ? "✓" : "○"} ${x}`).join("  ")}>
      {QUOTE_STEPS.map((x, i) => (
        <Box key={x} sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ height: 4, borderRadius: 99, bgcolor: i < n ? oc.color : "#e2e8f0" }} />
          {labels && <Typography noWrap sx={{ fontSize: "0.62rem", fontWeight: i < n ? 800 : 600, color: i < n ? "#475569" : "#94a3b8", mt: 0.2 }}>{x}</Typography>}
        </Box>
      ))}
    </Stack>
  );
}

/** @param compact ใช้ในตาราง — บรรทัดเดียวไม่ตัดคำ · แถบขั้นไม่มีป้าย */
function QuoteCell({ oc, compact = false, caption = false }) {
  const Icon = QUOTE_ICON[oc.key] || RequestQuoteOutlined;
  const tone = oc.quiet ? "#94a3b8" : oc.color;
  const box = compact ? 26 : 30;
  const file = oc.files?.length ? oc.files[oc.files.length - 1] : null;
  return (
    <Stack direction="row" spacing={1} alignItems={oc.quiet || !oc.facts.length ? "center" : "flex-start"} sx={{ minWidth: 0 }}>
      {/* ✅ (19 ต.ค. 2569 ผู้ใช้: "ไม่ต้องให้มีไฟล์ขึ้นแสดง กินพื้นที่ รก ให้กดดูเลย") — มีไฟล์ = กดไอคอนเปิดไฟล์ได้ทันที (มีจุดคลิปเล็กบอก) */}
      <Box component={file ? "a" : "div"} href={file?.fileUrl} target={file ? "_blank" : undefined} rel={file ? "noreferrer" : undefined}
        title={file ? `เปิดไฟล์${oc.files.length > 1 ? ` (${oc.files.length} ไฟล์ · เปิดไฟล์ล่าสุด)` : ""}` : undefined}
        onClick={file ? (e) => e.stopPropagation() : undefined}
        sx={{ position: "relative", width: box, height: box, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", textDecoration: "none",
          bgcolor: oc.quiet ? "#fff" : alpha(oc.color, 0.1), color: tone, border: oc.quiet ? `1px dashed #cbd5e1` : "none",
          ...(file ? { cursor: "pointer", transition: "box-shadow .15s", "&:hover": { boxShadow: `0 0 0 2px ${alpha(tone, 0.45)}` } } : {}) }}>
        <Icon sx={{ fontSize: compact ? 16 : 18 }} />
        {file && (
          <Box component="span" sx={{ position: "absolute", right: -4, bottom: -4, width: 15, height: 15, borderRadius: "50%", bgcolor: "#fff", border: `1px solid ${LINE}`, display: "grid", placeItems: "center", color: "#475569" }}>
            <AttachFileRounded sx={{ fontSize: 10 }} />
          </Box>
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {caption && <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: "#94a3b8", lineHeight: 1.2, letterSpacing: 0.2 }}>ใบเสนอราคา</Typography>}
        <Typography noWrap={compact} title={oc.label} sx={{ fontSize: compact ? "0.8rem" : "0.84rem", fontWeight: oc.quiet ? 600 : 800, color: oc.quiet ? "#94a3b8" : oc.color, lineHeight: 1.3 }}>{oc.label}</Typography>
        {oc.facts.length > 0 && (
          <Typography noWrap={compact} title={oc.facts.join(" · ")} sx={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4, mt: 0.1, overflowWrap: "anywhere" }}>{oc.facts.slice(0, 3).join(" · ")}</Typography>
        )}
        <QuoteSteps oc={oc} labels={!compact} />
      </Box>
    </Stack>
  );
}

/** ช่อง "เอกสารอ้างอิง" (แท็บรอดำเนินการ) — ชนิด + เลขที่ของเอกสารตอนรับงาน · กดไอคอนเปิดไฟล์ */
const intakeFilesOf = (job) => (job.sitePhotoFiles || []).filter((f) => f.source === "intake");

function RefDocCell({ job, compact = true }) {
  const files = intakeFilesOf(job);
  const label = job.intakeDocType ? ({ po: "ใบสั่งซื้อ (PO)", quotation: "ใบเสนอราคา", other: "เอกสารอื่น" }[job.intakeDocType] || "เอกสาร") : files.length ? "ไฟล์แนบ" : "";
  if (!label) return <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>;
  const key = job.intakeDocType === "po" ? "po" : job.intakeDocType === "quotation" ? "ref_qt" : "ref_doc";
  const facts = [job.intakeDocNo ? `เลขที่ ${job.intakeDocNo}` : files.length ? `${files.length} ไฟล์` : "ยังไม่แนบไฟล์"];
  return <QuoteCell oc={{ key, label, color: key === "po" ? GREEN : key === "ref_qt" ? ACCENT : "#475569", facts, files }} compact={compact} />;
}

/**
 * ช่อง "ใบเสนอราคา" (แท็บกำลังดำเนินการ · เสร็จแล้ว · ยกเลิก) — เฉพาะใบเสนอราคาในระบบติดตาม
 *    • ติดตามแล้ว → สถานะ + แถบขั้น (กด = อัปเดตในกล่องใบเสนอราคา)
 *    • ยังไม่มี → "—" จางๆ · ชี้เมาส์มี "+ แนบใบเสนอราคา" (ไม่ขึ้นป้ายเทาทุกแถวให้รก)
 */
function QuoteSlot({ oc }) {
  if (!oc || oc.key === "na") return <Typography title={oc ? "ไม่ต้องเสนอราคา" : undefined} sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>;
  const tracked = !oc.intake;
  const act = tracked ? oc.act : "+ แนบใบเสนอราคา";
  const clickable = Boolean(oc.open && act);
  const c = tracked ? oc.color : ACCENT;
  return (
    <Box onClick={clickable ? (e) => { e.stopPropagation(); oc.open(); } : undefined}
      role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") { e.stopPropagation(); oc.open(); } } : undefined}
      sx={{ borderRadius: 2, m: -0.75, p: 0.75, minHeight: 34, cursor: clickable ? "pointer" : "default", transition: "background-color .15s",
        "& .qc-act": { opacity: tracked ? 0.9 : 0, transition: "opacity .15s" },
        ...(clickable ? { "&:hover": { bgcolor: alpha(c, 0.06) }, "&:hover .qc-act": { opacity: 1 }, "&:focus-visible .qc-act": { opacity: 1 } } : {}) }}>
      {tracked ? <QuoteCell oc={oc} compact /> : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1", lineHeight: 1.6 }}>—</Typography>}
      {clickable && (
        <Typography className="qc-act" sx={{ mt: 0.4, pl: tracked ? 4.25 : 0, fontSize: "0.7rem", fontWeight: 800, color: c, whiteSpace: "nowrap" }}>
          {act}{tracked ? " ›" : ""}
        </Typography>
      )}
    </Box>
  );
}

/** กล่องข้อมูลในการ์ด — หัวข้อเล็ก + คำอธิบาย · tone = ขอบซ้ายสีตามสถานะ */
function DocBox({ title, hint, tone, children }) {
  return (
    <Box sx={{ minWidth: 0, px: 1.5, py: 1.1, borderRadius: 2, bgcolor: "#fff", border: `1px solid ${LINE}`, ...(tone ? { borderLeft: `3px solid ${tone}` } : {}) }}>
      <Stack direction="row" alignItems="baseline" sx={{ mb: 0.75, flexWrap: "wrap", columnGap: 0.75 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#475569", whiteSpace: "nowrap" }}>{title}</Typography>
        {hint && <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>· {hint}</Typography>}
      </Stack>
      {children}
    </Box>
  );
}

const TABS = [
  { key: "waiting", label: "รอดำเนินการ", short: "รอเริ่ม", test: (s) => s.i === 0 },
  { key: "active", label: "กำลังดำเนินการ", short: "กำลังทำ", test: (s) => s.i >= 1 && s.i <= 3 },
  { key: "done", label: "เสร็จแล้ว", short: "เสร็จแล้ว", test: (s) => s.i === 4 },
  // ✅ แท็บ "ยกเลิก" โชว์เฉพาะตอนมีงานที่ยกเลิก (ไม่กินที่บนมือถือโดยไม่จำเป็น)
  { key: "cancelled", label: "ยกเลิก", short: "ยกเลิก", test: (s) => s.i === -1, hideEmpty: true },
];

/** ข้อความกำหนดการสั้นๆ (ใช้ในตาราง) */
const scheduleShort = (j) => (j.intakeNote ? `บันทึก ${formatThai(moment(j.intakeAt), "D MMM YY")}`
  : j.noVisit ? (j.unscheduled ? "ยังไม่ส่งของ" : `ส่งของ ${formatThai(moment(j.deliveredAt || j.start), "D MMM YY")}`)
    : j.unscheduled ? (j.plannedMonth ? `แผน ${formatThai(moment(j.plannedMonth, "YYYY-MM"), "MMM YY")}` : "ยังไม่กำหนดเดือน")
      : `เข้างาน ${formatThai(moment(j.start), "D MMM YY")}`);

/**
 * มุมมองตาราง — ข้อมูลหลักครบในแถวเดียว กวาดตาเทียบหลายงานได้เร็ว (จอแคบเลื่อนซ้าย-ขวาได้)
 * 🔁 (19 ต.ค. 2569 ผู้ใช้: "รายละเอียดให้ครบแบบหน้าการ์ดด้วย") — เพิ่มคอลัมน์รายละเอียดงาน · ทีม/ผู้ติดต่อ · ขั้นถัดไป · กำหนดเสร็จ
 *    และกดแถวเพื่อกางการ์ดเต็มใต้แถว (ไฟล์แนบ · ผลเสนอราคา · แถบขั้นตอน · ปุ่มแก้ไข/ยกเลิก ครบเหมือนมุมมองการ์ด)
 */
function JobTable({ rows, readOnlyOf, requestMode, onSchedule, onDeliver, onUploadInvoice, onNoteDone, renderCard, employees = [], refMode = false }) {
  const personOf = (name) => employees.find((u) => u.fname === name || [u.fname, u.lname].filter(Boolean).join(" ") === name);
  // 🔁 (21 ต.ค. 2569 ผู้ใช้: "หน้าจอคอมให้เปิดเป็นหน้าต่างขึ้นมาแทนการเลื่อนลง ดูใช้ยาก ไม่สมูท")
  //    กดแถว = เปิดหน้าต่างรายละเอียด (จอคอม = กล่องกลางจอ · มือถือ = แผ่นเลื่อนขึ้น) แทนการกางใต้แถว
  const [openId, setOpenId] = useState(null);
  const toggle = (id) => setOpenId(id);
  const openRow = rows.find((x) => x.j._id === openId);
  const th = { textAlign: "left", fontSize: "0.74rem", fontWeight: 800, color: MUTED, px: 1.25, py: 1, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", bgcolor: SURFACE };
  const td = { fontSize: "0.82rem", color: "#334155", px: 1.25, py: 1.1, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const sub = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.45, overflowWrap: "anywhere" };
  // เอกสารอ้างอิง (ตอนรับงาน) กับ ใบเสนอราคา (ติดตามภายหลัง) แยกคนละคอลัมน์เสมอ · แท็บรอดำเนินการยังไม่มีใบเสนอราคา
  const COLS = ["", "กำหนดการ", "เลขที่งาน", "งาน / โครงการ", "รายละเอียดงาน", "รับงานจาก", "ผู้ติดต่อ", "สถานะงาน", "เอกสารอ้างอิง", ...(refMode ? [] : ["ติดตาม (ใบเสนอราคาเพิ่ม · วางบิล)"]), "ผู้รับผิดชอบ", ""];
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", minWidth: 1560, borderCollapse: "collapse" }}>
        <thead>
          <tr>{COLS.map((h, i) => <Box component="th" key={i} sx={{ ...th, ...(i === 0 ? { width: 34, px: 0.5 } : {}) }}>{h}</Box>)}</tr>
        </thead>
        <tbody>
          {rows.map(({ j, s, oc }) => {
            const ro = readOnlyOf(j);
            const isOpen = openId === j._id;
            const stall = stalledDays(j, s);
            const owner = j.responsiblePerson ? personOf(j.responsiblePerson) : null;
            // ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้มีปุ่มเหมือนอันอื่นด้วยให้สอดคล้องสมบูรณ์") — ทุกแถวมีปุ่มสิ่งที่ต้องทำต่อ
            //    รอส่งลงตาราง · ส่งของแล้ว · อัปโหลดใบวางบิล · ทำเสร็จแล้ว · ดูงาน · (อื่นๆ) รายละเอียด
            const ghost = { ...BTN, height: 30, px: 1.25, color: ACCENT, border: `1px solid ${alpha(ACCENT, 0.4)}` };
            const action = ro
              ? (!j.unscheduled && !s.nv && !s.note ? <Button component={Link} to={`/operation/${j._id}`} size="small" sx={ghost}>ดูงาน</Button> : <Button size="small" onClick={() => toggle(j._id)} sx={{ ...ghost, color: MUTED, borderColor: LINE }}>รายละเอียด</Button>)
              : s.note
                ? (s.i === 0
                  ? <Button size="small" onClick={() => onNoteDone(j)} sx={{ ...SUCCESS, height: 30, px: 1.25 }}>ทำเสร็จแล้ว</Button>
                  : <Button size="small" onClick={() => toggle(j._id)} sx={{ ...ghost, color: MUTED, borderColor: LINE }}>รายละเอียด</Button>)
                : s.nv
                  ? (s.i === 0
                    ? <Button size="small" onClick={() => onDeliver(j)} sx={{ ...SUCCESS, height: 30, px: 1.25 }}>ส่งของแล้ว</Button>
                    : s.i === 2
                      ? (
                        <Button component="label" size="small" sx={{ ...PRIMARY, height: 30, px: 1.25 }}>
                          อัปโหลดใบวางบิล
                          <input hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => {
                            const picked = [...(e.target.files || [])];
                            e.target.value = "";
                            if (picked.length) onUploadInvoice(j, picked);
                          }} />
                        </Button>
                      )
                      : j.invoiceApplicable === false
                        ? <Button size="small" onClick={() => toggle(j._id)} sx={{ ...ghost, color: MUTED, borderColor: LINE }}>รายละเอียด</Button>
                        : <Button component={Link} to={`/finance?tab=billing&jobId=${j._id}`} size="small" sx={ghost}>ติดตามวางบิล</Button>)
                  : s.i === 0
                    ? <Button size="small" onClick={() => onSchedule(j)} sx={{ ...PRIMARY, height: 30, px: 1.25 }}>{requestMode ? "ขอลงตาราง" : "ส่งลงตาราง"}</Button>
                    : !j.unscheduled
                      ? <Button component={Link} to={`/operation/${j._id}`} size="small" sx={ghost}>ดูงาน</Button>
                      : <Button size="small" onClick={() => toggle(j._id)} sx={{ ...ghost, color: MUTED, borderColor: LINE }}>รายละเอียด</Button>;
            return [
              <Box component="tr" key={j._id} onClick={(e) => { if (!e.target.closest("a,button,label")) toggle(j._id); }}
                sx={{ cursor: "pointer", "& > td": { bgcolor: isOpen ? alpha(ACCENT, 0.04) : "transparent" }, "&:hover > td": { bgcolor: isOpen ? alpha(ACCENT, 0.06) : "#f8fafc" } }}>
                <Box component="td" sx={{ ...td, px: 0.5, textAlign: "center" }}>
                  <ChevronRight sx={{ fontSize: 20, color: "#94a3b8", transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none" }} />
                </Box>
                {/* ✅ (19 ต.ค. 2569 ผู้ใช้: "เอาช่องวันที่ไปไว้หน้าสุด ชัดเจน สวยงาม") — กล่องวันที่แบบปฏิทิน (ยังไม่ลงวัน = กล่องเส้นประบอกแผน) */}
                <Box component="td" sx={{ ...td, width: 84 }}>
                  <DateCell start={j.unscheduled || j.intakeNote ? null : (j.noVisit ? (j.deliveredAt || j.start) : j.start)} end={j.noVisit ? null : j.end} allDay={j.allDay}
                    label={scheduleShort(j)}>
                    {j.dueDate && s.i < 4 && (
                      <Typography sx={{ ...sub, mt: 0.4, color: moment(j.dueDate).isBefore(moment(), "day") ? RED : MUTED, fontWeight: 700, whiteSpace: "nowrap" }}>
                        เสร็จภายใน {formatThai(moment(j.dueDate), "D MMM")}
                      </Typography>
                    )}
                  </DateCell>
                </Box>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{j.jobNo || "—"}</Typography>
                  <Typography sx={sub}>{j.intakeNote ? "บันทึก" : j.noVisit ? "ส่งของ" : "เข้าหน้างาน"}</Typography>
                  {j.dispatchNo && <Typography sx={{ ...sub, color: "#94a3b8" }} title="เลขที่ใบแจ้งงาน">ใบแจ้ง {j.dispatchNo}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 160, maxWidth: 220 }}>
                  {!j.intakeNote && <JobKindTag event={j} sx={{ mb: 0.5 }} />}
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
                  {/* 🔁 (19 ต.ค. 2569 ผู้ใช้: "ไฟล์ขึ้นซ้ำ ให้ใส่แค่รายละเอียดงาน ไฟล์อยู่เอกสารอ้างอิง") */}
                  {j.equipment && <Typography sx={{ ...sub, mt: 0.3 }}>อุปกรณ์: {String(j.equipment).split(/\n+/).filter(Boolean).join(", ")}</Typography>}
                  {j.infoPending && j.infoPendingNote && <Typography sx={{ ...sub, color: AMBER, fontWeight: 700 }}>ขาด: {j.infoPendingNote}</Typography>}
                </Box>
                <Box component="td" sx={td}>
                  {j.intakeSource
                    ? <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>{SOURCE_LABEL[j.intakeSource] || j.intakeSource}</Typography>
                    : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                  {j.intakeSource && j.dispatchNo && j.intakeBy && <Typography sx={sub}>{j.intakeBy}</Typography>}
                </Box>
                {/* ✅ (19 ต.ค. 2569 ผู้ใช้: "แยก col ผู้ติดต่อ · ทีมช่างไม่ต้องใส่ แค่ผู้รับผิดชอบก็พอ แต่ให้มีรูป") */}
                <Box component="td" sx={{ ...td, minWidth: 130, maxWidth: 180 }}>
                  {j.contactName || j.contactTel ? (
                    <>
                      {j.contactName && <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", overflowWrap: "anywhere" }}>{j.contactName}</Typography>}
                      {j.contactTel && (
                        <Box component="a" href={`tel:${j.contactTel}`} onClick={(e) => e.stopPropagation()}
                          sx={{ mt: 0.3, display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: "0.78rem", color: ACCENT, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                          <PhoneOutlined sx={{ fontSize: 15 }} />{j.contactTel}
                        </Box>
                      )}
                    </>
                  ) : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 140, maxWidth: 190 }}>
                  <Chip color={s.color} bg={alpha(s.color, 0.1)} border="transparent">{s.label}</Chip>
                </Box>
                {/* ✅ (19 ต.ค. 2569 ผู้ใช้: "ยังดูล้นๆ ไม่สวย · กดเปิดฟอร์มติดตามใบเสนอราคาได้เลย ดำเนินการในหน้านี้")
                    บรรทัดเดียวไม่ตัดคำ · ไฟล์กดเปิดได้ · กดช่องนี้ = เปิดกล่องใบเสนอราคา (ตัวเดียวกับหน้าติดตาม) ทับหน้านี้ */}
                <Box component="td" sx={{ ...td, width: 210, minWidth: 210, maxWidth: 210 }}>
                  {/* ✅ (19 ต.ค. 2569 ผู้ใช้: "หน้ารอดำเนินการเปลี่ยนจากใบเสนอราคาเป็นเอกสารอ้างอิง") — งานยังไม่เริ่ม: โชว์เอกสารที่แนบมาตอนรับงาน */}
                  <RefDoc event={j} />
                </Box>
                {!refMode && (
                  <Box component="td" sx={{ ...td, width: 190, minWidth: 190, maxWidth: 190 }}>
                    {j.noVisit ? <BillingSlot job={j} /> : <QuoteSlot oc={oc} />}
                  </Box>
                )}
                <Box component="td" sx={{ ...td, minWidth: 170, whiteSpace: "nowrap" }}>
                  {j.responsiblePerson ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <Avatar src={hasValidAvatar(owner?.imageUrl) ? owner.imageUrl : undefined}
                        sx={{ width: 32, height: 32, fontSize: "0.85rem", fontWeight: 800, bgcolor: personColor(j.responsiblePerson), boxShadow: "0 0 0 2px #fff, 0 0 0 3px #e2e8f0" }}>
                        {personInitial(j.responsiblePerson)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap title={j.responsiblePerson} sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>{j.responsiblePerson}</Typography>
                        {owner && <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED, lineHeight: 1.3 }}>{owner.position || rankLabel(owner)}</Typography>}
                      </Box>
                    </Stack>
                  ) : <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: AMBER }}>ยังไม่ระบุ</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap", position: "sticky", right: 0, bgcolor: isOpen ? "#f5f8ff !important" : "#fff !important", boxShadow: "-8px 0 8px -8px rgba(15,23,42,.15)" }}>{action}</Box>
              </Box>,
            ];
          })}
        </tbody>
      </Box>
      <MobileSheet open={Boolean(openRow)} onClose={() => setOpenId(null)} maxWidth="lg"
        title={openRow ? (openRow.j.intakeNote ? "บันทึกงาน" : `${openRow.j.title || "งาน"}${openRow.j.system ? ` · ${openRow.j.system}` : ""}`) : ""}
        subtitle={openRow ? [openRow.j.jobNo, openRow.j.site && openRow.j.site !== "-" ? openRow.j.site : "", openRow.j.company && openRow.j.company !== openRow.j.site ? openRow.j.company : ""].filter(Boolean).join(" · ") : ""}>
        {openRow && <Box sx={{ p: { xs: 1.25, sm: 2 } }}>{renderCard(openRow.j, openRow.oc, () => setOpenId(null))}</Box>}
      </MobileSheet>
    </Box>
  );
}

// ✅ (19 ต.ค. 2569 ผู้ใช้: "ปุ่มดูไม่สวย เยื้องๆ") ปุ่มทุกแบบสูงเท่ากัน 36px · ไอคอน/ระยะเท่ากัน (เดิมปุ่มขอบกับปุ่มทึบสูงไม่เท่ากัน)
const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", fontSize: "0.82rem", height: 36, px: 1.5, lineHeight: 1, "& .MuiButton-startIcon": { mr: 0.6, ml: 0 }, "& .MuiButton-endIcon": { ml: 0.4, mr: 0 } };
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
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
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
  const [billing, setBilling] = useState(""); // "need" | "none" — ✅ (19 ต.ค. 2569) ต้องเลือกก่อนบันทึก
  const save = async () => {
    if (!date || !billing) return;
    setSaving(true);
    try {
      await EventService.DeliverJob(job._id, { date, noBilling: billing === "none" });
      let failed = 0;
      for (const f of files) {
        try { await EventService.Upload(job._id, f, "invoice"); } catch { failed += 1; }
      }
      onDone();
      Swal.fire(failed
        ? { icon: "warning", title: "บันทึกส่งของแล้ว", text: `แต่แนบใบวางบิลไม่สำเร็จ ${failed} ไฟล์ — กด “อัปโหลดใบวางบิล” ที่การ์ดงานอีกครั้ง` }
        : billing === "none"
          ? { icon: "success", title: "ส่งของแล้ว · งานเสร็จสิ้น", text: "ไม่ต้องวางบิล", timer: 1600, showConfirmButton: false }
          : { icon: "success", title: files.length ? "ส่งของ + วางบิลแล้ว" : "บันทึกส่งของแล้ว", text: files.length ? "ตามรับเงินต่อได้ที่หน้าติดตามวางบิล" : "ขั้นถัดไป: อัปโหลดใบวางบิล", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <LocalShippingOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>ส่งของแล้ว</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, pt: "20px !important", pb: 2 }}>
        <Section n={1} title="วันที่ส่งของ">
          <ThaiDatePicker label="วันที่ส่งของ" value={date} onChange={(v) => setDate(v || "")} />
        </Section>
        <Section n={2} title="งานนี้ต้องวางบิลไหม?" hint="เลือกก่อนบันทึก — ไม่ต้องวางบิล = งานเสร็จสิ้นทันที" last={billing !== "need"}>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            {[["need", "ต้องวางบิล", "แนบบิลเลย หรือแนบทีหลัง"], ["none", "ไม่ต้องวางบิล", "จบงานเลย (เสร็จสิ้น)"]].map(([k, t, d]) => (
              <ButtonBase key={k} onClick={() => setBilling(k)} sx={{ display: "block", textAlign: "left", p: 1.25, borderRadius: 2, fontFamily: "inherit",
                border: `1.5px solid ${billing === k ? ACCENT : LINE}`, bgcolor: billing === k ? alpha(ACCENT, 0.06) : "#fff" }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: billing === k ? ACCENT : INK }}>{t}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{d}</Typography>
              </ButtonBase>
            ))}
          </Box>
        </Section>
        {billing === "need" && (
        <Section n={3} title="ใบวางบิล" hint="ไม่บังคับ — ยังไม่มีบิล กดบันทึกไปก่อน แล้วอัปโหลดทีหลังที่แถว/การ์ดงาน" last>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />} sx={{ ...BTN, color: "#334155", borderColor: LINE }}>
            {files.length ? `เลือกแล้ว ${files.length} ไฟล์` : "เลือกไฟล์ใบวางบิล"}
            <input hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles([...(e.target.files || [])])} />
          </Button>
          {files.length > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, overflowWrap: "anywhere" }}>{files.map((f) => f.name).join(", ")}</Typography>
          )}
        </Section>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE }}>
          งานไม่ต้องเข้างานจะไม่ขึ้นในตารางงานช่าง · ตามรับเงินต่อได้ที่หน้าติดตามวางบิล
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!date || !billing || saving} onClick={save} sx={{ ...PRIMARY, px: 2.5 }}>
          {saving ? "กำลังบันทึก..." : billing === "none" ? "บันทึก · งานเสร็จสิ้น" : "บันทึกส่งของ"}
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

function JobCard({ job, outcome, readOnly, requestMode, onSchedule, onDeliver, onUploadInvoice, onNoteDone, onEdit, onCancel, onRestore, inRow = false, inSheet = false, employees = [] }) {
  const owner = job.responsiblePerson ? employees.find((u) => u.fname === job.responsiblePerson || [u.fname, u.lname].filter(Boolean).join(" ") === job.responsiblePerson) : null;
  const st = stageOf(job);
  const stall = stalledDays(job, st);
  // ไฟล์ตอนรับงานที่เป็นใบเสนอราคา/PO แสดงในแถบใบเสนอราคาแล้ว — ไม่ซ้ำด้านล่าง
  const intakeDocs = (job.sitePhotoFiles || []).filter((f) => f.source === "intake");
  const invoiceFiles = job.invoiceFiles || [];
  const [uploading, setUploading] = useState(false);
  // ✅ (20 ต.ค. 2569 ผู้ใช้: "ให้พับรายละเอียดได้ และเริ่ม default ดูรกและกินพื้นที่") การ์ดเริ่มแบบพับ — กางดูรายละเอียด/เอกสารเมื่อกด
  //    (กางใต้แถวตาราง inRow = เปิดเสมอ เพราะผู้ใช้กดกางเอง)
  // 🔁 (21 ต.ค. 2569) ทุกขนาดจอเปิดรายละเอียดเป็นหน้าต่าง — การ์ดในรายการพับเสมอ
  const open = false;
  const showMore = inRow;
  // ✅ (20 ต.ค. 2569 ผู้ใช้: "หน้านี้ให้เป็นรูปแบบเลื่อนขึ้นเมื่อกดดูรายละเอียด แบบหน้าดำเนินงาน")
  //    มือถือ: "ดูรายละเอียด" = แผ่นรายละเอียดเลื่อนขึ้นจากล่าง (ลากลงปิดได้) แทนการกางในการ์ด
  const [sheetOpen, setSheetOpen] = useState(false);
  const fu = openFollowUp(job);
  const team = [job.team, ...(job.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
  const when = job.noVisit && !job.unscheduled
    ? `ส่งของ ${formatThai(moment(job.deliveredAt || job.start), "D MMM YYYY")}`
    : job.unscheduled
    ? (job.plannedMonth ? `แผนเข้างาน ${formatThai(moment(job.plannedMonth, "YYYY-MM"), "MMMM YYYY")}` : "ยังไม่กำหนดเดือน")
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
        <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "17px !important" }} />}
          sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
        <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "17px !important" }} />}
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
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "17px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onDeliver(job)} startIcon={<LocalShippingOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...SUCCESS, flex: { xs: 1.6, sm: "0 0 auto" } }}>ส่งของแล้ว</Button>
    </>
  ) : st.nv ? (
    <>
      <Button component={Link} to={`/finance?tab=billing&jobId=${job._id}`} variant="outlined" startIcon={<ReceiptLongOutlined sx={{ fontSize: "17px !important" }} />}
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
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "17px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onSchedule(job)} startIcon={<EventAvailableOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } }}>{requestMode ? "ขอลงตาราง" : "ส่งลงตาราง"}</Button>
    </>
  ) : (
    <Button component={Link} to={`/operation/${job._id}`} variant="outlined" endIcon={<ChevronRight />}
      sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>ดูงาน</Button>
  );

  // ปุ่มเดียวคือ "ดูงาน" (งานที่ลงตารางแล้ว) — มือถือย้ายไปมุมขวาบนของการ์ด
  const viewOnly = !readOnly && st.i > 0 && !st.note && !st.nv;

  // ✅ (15 ต.ค. 2569 ผู้ใช้: "หน้านี้ทำให้สวยงาม และดูข้อมูลง่ายด้วย")
  //    การ์ดแยกใบ: หัว (สถานะ · เลข Job · ป้าย) → ชื่องาน + โครงการ → ตารางข้อมูล "ป้าย : ค่า" → แถบขั้นตอนพื้นเทาด้านล่าง
  const nx = job.cancelledAt ? null : st.note
    ? (st.i === 0 ? { title: "ทำงานนี้", desc: "เสร็จแล้วกด “ทำเสร็จแล้ว”" } : null)
    : st.nv
      ? (st.i === 0 ? { title: "ส่งของ", desc: "ส่งของให้ลูกค้าแล้ว กด “ส่งของแล้ว” (แนบใบวางบิลได้เลย)" }
        : st.i === 2 ? { title: "วางบิล", desc: "กด “อัปโหลดใบวางบิล” แล้วตามรับเงินที่หน้าติดตามวางบิล" } : null)
      : job.unscheduled
        ? { title: "ส่งลงตาราง", desc: "เลือกวันเข้างาน ผู้รับผิดชอบงาน และหัวหน้าทีม" }
        : st.i >= 0 && st.i < 4 ? nextStepOf(job, "admin") : null;
  const place = [job.site && job.site !== "-" ? job.site : "", job.company && job.company !== job.site ? job.company : ""].filter(Boolean).join(" · ");
  const schedule = job.intakeNote
    ? (job.noteDoneAt ? `ทำเสร็จ ${formatThai(moment(job.noteDoneAt), "D MMM YYYY")}${job.noteDoneBy ? ` · ${job.noteDoneBy}` : ""}` : `บันทึก ${formatThai(moment(job.intakeAt), "D MMM YYYY")}`)
    : job.noVisit && job.unscheduled ? "ยังไม่ส่งของ" : when;
  const ModeIcon = job.intakeNote ? NotesOutlined : job.noVisit ? LocalShippingOutlined : BuildOutlined;
  const modeLabel = job.intakeNote ? "บันทึก" : job.noVisit ? "ส่งของ" : "เข้าหน้างาน";
  const tone = st.i === -1 ? MUTED : ACCENT;

  // ✅ (15 ต.ค. 2569 ผู้ใช้: "ยังจัดวางไม่สวย UI ดูยาก ไม่มืออาชีพ" · "ทำให้ชัดเจน ดูง่าย สวยงาม")
  //    แถวเดียวอ่านจบ: ไอคอนรูปแบบงาน · ชื่องาน + เลข Job · โครงการ · ข้อมูลสั้นเรียงบรรทัดเดียว | ปุ่มด้านขวา
  //    ท้ายการ์ด: สถานะ + สิ่งที่ต้องทำต่อ (ซ้าย) · แถบขั้นตอน (ขวา)
  return (
    // 🔁 (19 ต.ค. 2569 ผู้ใช้: "แบบตาราง ปุ่มดูซ้ำซ้อน รก") inRow = กางใต้แถวตาราง — ตัดหัวการ์ด (ชื่อ/ป้าย/ผู้ติดต่อ ซึ่งแถวมีแล้ว)
    //    เหลือเฉพาะข้อมูลที่แถวไม่มี (รายละเอียด · เอกสาร · ใบเสนอราคา · ขั้นตอน) และปุ่มอยู่ที่เดียว (แถวซ่อนปุ่มตอนกาง)
    <>
    <Box
      // ✅ (20 ต.ค. 2569 ผู้ใช้: "หน้ารับงานให้กดที่การ์ดเปิดรายละเอียดได้เลย") แตะตรงไหนของการ์ดก็เปิดรายละเอียด
      //    (มือถือ = แผ่นเลื่อนขึ้น · จอคอม = กาง/พับ) · ยกเว้นปุ่ม/ลิงก์/ช่องกรอกในการ์ดที่มีหน้าที่ของตัวเอง
      onClick={inRow ? undefined : (e) => {
        if (e.target.closest("button, a, input, label, textarea, [role=button]")) return;
        setSheetOpen(true); // 🔁 (21 ต.ค. 2569) จอคอมก็เปิดเป็นหน้าต่าง (เดิมกางลงในการ์ด)
      }}
      sx={inRow ? { bgcolor: "#fff", borderRadius: 2, overflow: "hidden", border: `1px solid ${LINE}` } : { cursor: "pointer", bgcolor: "#fff", border: `1px solid ${LINE}`, borderLeft: { xs: `4px solid ${st.color}`, sm: `1px solid ${LINE}` }, borderRadius: 3, overflow: "hidden", boxShadow: { xs: "0 1px 3px rgba(15,23,42,.06)", sm: "none" }, transition: "border-color .15s, box-shadow .15s", "&:hover": { borderColor: "#cbd5e1", boxShadow: "0 4px 14px -8px rgba(15,23,42,.18)" } }}>
      {/* 🔁 (19 ต.ค. 2569 ผู้ใช้: "ให้ขยายเต็ม") ปุ่มย้ายขึ้นแถวชื่องาน (จอคอม) — เนื้อหาด้านล่างกว้างเต็มการ์ด ไม่เหลือช่องว่างด้านขวา */}
      <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.75 }}>
        <Stack direction="row" gap={1.5} sx={{ minWidth: 0 }}>
          {/* ✅ (15 ต.ค. 2569 ผู้ใช้: "ให้บอกด้วยว่างานอะไร ส่งของ จดงาน เข้างาน") — ไอคอน + ชื่อรูปแบบงานใต้ไอคอน */}
          {!inRow && (
          <Stack alignItems="center" spacing={0.4} sx={{ width: 52, flexShrink: 0, display: { xs: "none", sm: "flex" } }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: alpha(tone, 0.08), color: tone }}>
              <ModeIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: tone, lineHeight: 1.2, textAlign: "center", whiteSpace: "nowrap" }}>{modeLabel}</Typography>
          </Stack>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!inRow && (
            <Stack direction="row" gap={1.5} alignItems="flex-start">
            {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "ยังดูจืด แยกงานยาก") มือถือ: กล่องวันที่แบบปฏิทินหน้าชื่องาน — กวาดตาแยกงานได้ทันที */}
            <Box sx={{ display: { xs: "block", sm: "none" }, flexShrink: 0 }}>
              {(() => {
                // 🔁 (20 ต.ค. 2569 ผู้ใช้: "ตรงวันที่ยังดูไม่สวย รก ไม่ลงตัว") ไอคอนปฏิทินขนาดเท่ากันทุกใบ: แถบบน = เดือน · กลาง = วัน (ตัวใหญ่) · ล่าง = วัน/ระยะ
                const d = job.intakeNote ? job.intakeAt : job.unscheduled ? null : (job.noVisit ? (job.deliveredAt || job.start) : job.start);
                if (d) {
                  const m = moment(d);
                  const isToday = m.isSame(moment(), "day");
                  // 🔁 (20 ต.ค. 2569 ผู้ใช้: "ทำไมสีวันที่ไม่เหมือนกัน") สีเดียวกันทุกใบ — วันนี้บอกด้วยคำว่า "วันนี้" สีน้ำเงินด้านล่างเท่านั้น
                  return <DateTile head={formatThai(m, "MMM YY")} big={m.format("D")} foot={isToday ? "วันนี้" : formatThai(m, "ddd")} footColor={isToday ? ACCENT : null} />;
                }
                if (job.plannedMonth && !job.noVisit) {
                  const r = scheduleTagOf(job, schedule);
                  const pm = moment(job.plannedMonth, "YYYY-MM");
                  return <DateTile dashed head="แผน" big={formatThai(pm, "MMM")} small foot={r.rel || formatThai(pm, "YY")} color={r.accent || "#64748b"} />;
                }
                return <DateTile dashed head={job.noVisit ? "ส่งของ" : "วันเข้างาน"} big="—" foot="ยังไม่กำหนด" color="#94a3b8" />;
              })()}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "มือถือยังจัดวางไม่สวย") มือถือ: ไม่มีคอลัมน์ไอคอนซ้าย — ย้ายเป็นบรรทัดเล็กเหนือชื่องาน ทุกอย่างชิดซ้ายแนวเดียวกับปุ่ม */}
            <Stack direction="row" alignItems="center" sx={{ display: { xs: "flex", sm: "none" }, flexWrap: "wrap", columnGap: 0.6, mb: 0.4, minWidth: 0 }}>
              <ModeIcon sx={{ fontSize: 15, color: "#64748b" }} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", whiteSpace: "nowrap" }}>{modeLabel}</Typography>
              {job.jobNo && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>· {job.jobNo}</Typography>}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ flexWrap: "wrap", rowGap: 0.25 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK, lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: job.intakeNote ? "pre-line" : undefined }}>
                {job.intakeNote ? (job.description || "บันทึกงาน") : <>{job.title || "งาน"}{job.system ? ` · ${job.system}` : ""}</>}
              </Typography>
              {job.jobNo && <Typography component="span" sx={{ display: { xs: "none", sm: "inline" }, fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8" }}>{job.jobNo}</Typography>}
              {isUrgent(job) && st.i < 4 && <Chip color="#fff" bg={RED} border={RED}>⚡ ด่วน</Chip>}
              {stall > 0 && <Chip color={RED} bg={alpha(RED, 0.08)} border="transparent">⏰ ค้าง {stall} วัน</Chip>}
              {job.approvalStatus === "pending" && <Chip color={AMBER} bg={alpha(AMBER, 0.12)} border="transparent">รออนุมัติ</Chip>}
              {job.approvalStatus === "rejected" && <Chip color={RED} bg={alpha(RED, 0.08)} border="transparent">ไม่อนุมัติ</Chip>}
              {job.infoPending && st.i < 4 && <Chip color={AMBER} bg={alpha(AMBER, 0.12)} border="transparent">รอข้อมูล</Chip>}
            </Stack>
            {place && <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#475569", mt: 0.2, overflowWrap: "anywhere" }}>{place}</Typography>}
            </Box>
            {actions && <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, display: { xs: "none", md: "flex" } }}>{actions}</Stack>}
            {viewOnly && (
              <Button component={Link} to={`/operation/${job._id}`} size="small" endIcon={<ChevronRight sx={{ fontSize: "16px !important", ml: -0.5 }} />}
                sx={{ display: { xs: "inline-flex", md: "none" }, flexShrink: 0, height: 30, px: 1.1, minWidth: 0, borderRadius: 2, textTransform: "none", fontWeight: 800, fontSize: "0.76rem",
                  color: "#334155", border: `1px solid ${LINE}`, bgcolor: "#fff", "&:hover": { bgcolor: SURFACE } }}>ดูงาน</Button>
            )}
            </Stack>
            )}

            {/* ✅ (17 ต.ค. 2569) แถวแรก = ป้ายข้อมูลสำคัญโทนเทา (กำหนดเวลา · เสร็จภายใน · ที่มา · เอกสาร) — สีเฉพาะเดือนนี้/เลยกำหนด
                แถวที่สอง = ข้อมูลประกอบ (ผู้รับผิดชอบ · ทีม · ผู้ติดต่อ) */}
            {!inRow && (<>
            {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "มือถือยังไม่เป็นระเบียบ") มือถือ: ข้อมูลเรียงเป็นรายการบรรทัดละเรื่อง ขอบซ้ายตรงกัน */}
            <Stack direction="row" sx={{ display: { xs: "none", sm: "flex" }, flexWrap: "wrap", gap: 0.75, mt: 1 }}>
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
              {job.intakeSource && <Tag icon={CallReceivedRounded}>รับงานจาก{sourceText(job)}</Tag>}
            </Stack>
            <Stack direction="row" sx={{ display: { xs: "none", sm: "flex" }, flexWrap: "wrap", columnGap: 2, rowGap: 0.5, mt: 0.9, "&:empty": { display: "none !important" } }}>
              {job.responsiblePerson && <Fact icon={PersonOutlineOutlined}>{job.responsiblePerson}</Fact>}
              {!job.unscheduled && !job.noVisit && !job.intakeNote && <Fact icon={GroupsOutlined}>{team || "ยังไม่มอบหมายทีม"}</Fact>}
              {(job.contactName || job.contactTel) && (
                <Fact icon={PhoneOutlined}>
                  {job.contactName || ""}{job.contactName && job.contactTel ? " · " : ""}
                  {job.contactTel && <Box component="a" href={`tel:${job.contactTel}`} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{job.contactTel}</Box>}
                </Fact>
              )}
            </Stack>
            {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "ทำให้สวย มืออาชีพ") มือถือ: ตารางข้อมูล ป้ายซ้าย · ค่าขวา บรรทัดละเรื่อง เส้นคั่นบาง */}
            {(() => {
              const t = scheduleTagOf(job, schedule);
              const late = due && moment(job.dueDate).isBefore(moment(), "day");
              const rows = [
                ["สถานะ", <Chip color={st.color} bg={alpha(st.color, 0.1)} border="transparent">{st.label}</Chip>],
                ["กำหนดการ", <><t.icon sx={{ fontSize: 15, color: t.accent || ACCENT, mr: 0.5, verticalAlign: "-2px" }} />{t.text.replace(/^แผนเข้างาน /, "แผน ")}{t.rel && <Box component="span" sx={{ ml: 0.5, fontWeight: 800, color: t.accent || MUTED }}>· {t.rel}</Box>}</>],
                due && st.i < 4 ? ["เสร็จภายใน", <>{due}{late && <Box component="span" sx={{ ml: 0.5, color: RED, fontWeight: 800 }}>· เลยกำหนด</Box>}</>] : null,
                job.intakeSource ? ["รับงานจาก", sourceText(job)] : null,
                job.responsiblePerson ? ["ผู้รับผิดชอบ", <Stack direction="row" alignItems="center" gap={0.75}><PersonPic name={job.responsiblePerson} owner={owner} size={24} /><span>{job.responsiblePerson}</span></Stack>] : null,
                !job.unscheduled && !job.noVisit && !job.intakeNote ? ["ทีม", team || <Box component="span" sx={{ color: "#94a3b8" }}>ยังไม่มอบหมาย</Box>] : null,
                job.contactName || job.contactTel ? ["ผู้ติดต่อ", <>{job.contactName || ""}{job.contactName && job.contactTel ? " · " : ""}
                  {job.contactTel && <Box component="a" href={`tel:${job.contactTel}`} sx={{ color: ACCENT, fontWeight: 800, textDecoration: "none" }}>{job.contactTel}</Box>}</>] : null,
              ].filter(Boolean);
              // 🔁 (20 ต.ค. 2569 ผู้ใช้: "ตอนยังไม่เปิดดู หลายบรรทัดกินพื้นที่ ทำให้กะทัดรัด") พับ = บรรทัดสรุปเดียว · กาง = ตารางเต็ม
              const who = job.responsiblePerson || (team && !job.unscheduled ? team : "") || (job.intakeSource ? `จาก${SOURCE_LABEL[job.intakeSource] || job.intakeSource}` : "");
              return (<>
                <Stack direction="row" alignItems="center" gap={1} sx={{ display: { xs: open ? "none" : "flex", sm: "none" }, mt: 1.1, pt: 1.1, borderTop: `1px dashed ${LINE}`, minWidth: 0 }}>
                  {job.responsiblePerson ? (
                    <Stack direction="row" alignItems="center" gap={0.9} sx={{ flex: 1, minWidth: 0 }}>
                      <PersonPic name={job.responsiblePerson} owner={owner} size={30} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK, lineHeight: 1.25 }}>{job.responsiblePerson}</Typography>
                        <Typography noWrap sx={{ fontSize: "0.68rem", color: MUTED, lineHeight: 1.25 }}>{owner ? (owner.position || rankLabel(owner)) : "ผู้รับผิดชอบงาน"}{team && !job.unscheduled && team !== job.responsiblePerson ? ` · ทีม ${team}` : ""}</Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack direction="row" alignItems="center" gap={0.6} sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ width: 30, height: 30, borderRadius: 99, display: "grid", placeItems: "center", border: `1px dashed #cbd5e1`, color: "#94a3b8", flexShrink: 0 }}><PersonOutlineOutlined sx={{ fontSize: 17 }} /></Box>
                      <Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED }}>{who || "ยังไม่มีผู้รับผิดชอบ"}</Typography>
                    </Stack>
                  )}
                  <Box sx={{ flexShrink: 0 }}><Chip color={st.color} bg={alpha(st.color, 0.1)} border="transparent">{st.label}</Chip></Box>
                </Stack>
                <Box sx={{ display: { xs: open ? "block" : "none", sm: "none" }, mt: 1.25, borderTop: `1px solid ${LINE}` }}>
                  {rows.map(([k, v]) => (
                    <Stack key={k} direction="row" gap={1.5} sx={{ py: 0.75, borderBottom: `1px solid ${LINE}` }}>
                      <Typography sx={{ width: 84, flexShrink: 0, fontSize: "0.76rem", color: MUTED, fontWeight: 600 }}>{k}</Typography>
                      <Typography component="div" sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>{v}</Typography>
                    </Stack>
                  ))}
                </Box>
              </>);
            })()}
            </>)}
            {!inRow && (() => {
              const refN = (job.intakeDocType || job.intakeDocNo ? 1 : 0) || ((job.sitePhotoFiles || []).some((f) => f.source === "intake") ? 1 : 0);
              const bits = [
                job.intakeNote ? "" : job.description ? (job.noVisit ? "รายการที่ต้องส่ง" : "รายละเอียดงาน") : "ยังไม่มีรายละเอียด",
                job.intakeNote ? "" : refN ? `เอกสารอ้างอิง${job.intakeDocNo ? ` ${job.intakeDocNo}` : ""}` : "",
                outcome && !outcome.intake ? `ใบเสนอราคาเพิ่ม: ${outcome.label}` : "",
                job.noVisit && invoiceFiles.length ? `ใบวางบิล ${invoiceFiles.length}` : "",
              ].filter(Boolean);
              return (
                <ButtonBase onClick={() => setSheetOpen(true)} aria-haspopup="dialog"
                  sx={{ mt: { xs: 1, sm: 1.25 }, width: "100%", justifyContent: "flex-start", gap: 0.75, px: 1.1, py: { xs: 0.6, sm: 0.8 }, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: open ? "#fff" : SURFACE, textAlign: "left", "&:hover": { borderColor: "#cbd5e1" } }}>
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Box component="span" sx={{ fontWeight: 800, color: "#334155" }}>{open ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}</Box>
                    {!open && bits.length > 0 && <> · {bits.join(" · ")}</>}
                  </Typography>
                  <ExpandMoreRounded sx={{ fontSize: 20, color: MUTED, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
                </ButtonBase>
              );
            })()}
            <Collapse in={showMore} timeout={inRow ? 0 : "auto"} unmountOnExit>
            {/* 🔁 (21 ต.ค. 2569 ผู้ใช้: "รายละเอียดไม่ตรง ไม่ครบถ้วน · ให้ดูง่ายสวยงาม") หน้าต่างรายละเอียด: สรุปข้อมูลงานครบในกล่องเดียว
                (กำหนดการ · สถานะ · รับงานจาก · เลขที่ใบแจ้ง · ผู้รับผิดชอบ · หัวหน้าทีม · ผู้ติดต่อ · โครงการ) */}
            {inSheet && !job.intakeNote && (() => {
              const t = scheduleTagOf(job, schedule);
              const late = due && moment(job.dueDate).isBefore(moment(), "day");
              const cells = [
                ["กำหนดการ", <>{t.text}{t.rel && <Box component="span" sx={{ ml: 0.5, fontWeight: 700, color: t.accent || MUTED }}>· {t.rel}</Box>}</>],
                ["สถานะ", <Chip color={st.color} bg={alpha(st.color, 0.1)} border="transparent">{st.label}</Chip>],
                due ? ["เสร็จภายใน", <>{due}{late && st.i < 4 && <Box component="span" sx={{ ml: 0.5, color: RED, fontWeight: 800 }}>· เลยกำหนด</Box>}</>] : null,
                ["เลขที่งาน", job.jobNo || <Box component="span" sx={{ color: "#94a3b8" }}>—</Box>],
                job.intakeSource ? ["รับงานจาก", sourceText(job)] : null,
                job.dispatchNo ? ["ใบแจ้งงาน", job.dispatchNo] : null,
                job.intakeAt ? ["วันที่รับงาน", formatThai(moment(job.intakeAt), "D MMM YYYY")] : null,
                ["ผู้รับผิดชอบ", job.responsiblePerson
                  ? <Stack direction="row" alignItems="center" gap={0.75}><PersonPic name={job.responsiblePerson} owner={owner} size={22} /><span>{job.responsiblePerson}</span>{owner && <Box component="span" sx={{ color: MUTED, fontWeight: 500, fontSize: "0.74rem" }}>{owner.position || rankLabel(owner)}</Box>}</Stack>
                  : <Box component="span" sx={{ color: AMBER }}>ยังไม่ระบุ</Box>],
                !job.unscheduled && !job.noVisit ? ["หัวหน้าทีม", team || <Box component="span" sx={{ color: "#94a3b8" }}>ยังไม่มอบหมาย</Box>] : null,
                ["ผู้ติดต่อ", job.contactName || job.contactTel ? <>{job.contactName || ""}{job.contactName && job.contactTel ? " · " : ""}{job.contactTel && <Box component="a" href={`tel:${job.contactTel}`} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{job.contactTel}</Box>}</> : <Box component="span" sx={{ color: "#94a3b8" }}>—</Box>],
                place ? ["โครงการ / ลูกค้า", place] : null,
              ].filter(Boolean);
              return (
                <Box sx={{ mb: 1.5, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", md: "repeat(3, minmax(0,1fr))" },
                  border: `1px solid ${LINE}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
                  {cells.map(([k, v]) => (
                    <Box key={k} sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${LINE}`, borderRight: { sm: `1px solid ${LINE}` }, minWidth: 0, mb: "-1px", mr: "-1px" }}>
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, mb: 0.25 }}>{k}</Typography>
                      <Typography component="div" sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, overflowWrap: "anywhere", lineHeight: 1.45 }}>{v}</Typography>
                    </Box>
                  ))}
                </Box>
              );
            })()}
            {/* บันทึกงานในแถวตาราง: แสดงข้อความบันทึกเต็ม + ทำเสร็จเมื่อไร/โดยใคร (หัวการ์ดถูกซ่อน) */}
            {inRow && job.intakeNote && (
              <Box sx={{ px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE, border: `1px solid ${LINE}` }}>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8", mb: 0.25 }}>บันทึกงาน</Typography>
                <Typography sx={{ fontSize: "0.86rem", color: "#334155", lineHeight: 1.55, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{job.description || "—"}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.6 }}>
                  บันทึก {formatThai(moment(job.intakeAt), "D MMM YYYY")}{job.intakeBy ? ` · ${job.intakeBy}` : ""}
                  {job.noteDoneAt ? ` · ทำเสร็จ ${formatThai(moment(job.noteDoneAt), "D MMM YYYY HH:mm")}${job.noteDoneBy ? ` โดย ${job.noteDoneBy}` : ""}` : ""}
                </Typography>
              </Box>
            )}
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
            {/* ✅ (19 ต.ค. 2569 ผู้ใช้: "ทำตรงนี้ให้ดูง่าย") — 2 กล่องคู่กัน หัวข้อชัด ไม่ปนกัน:
                เอกสารอ้างอิง (ได้มาตอนรับงาน + ไฟล์) | ใบเสนอราคา (ติดตามภายหลัง + ปุ่มดำเนินการ) */}
            {!job.intakeNote && (() => {
              const showQuote = Boolean(outcome);
              const hasRef = Boolean(job.intakeDocType || job.intakeDocNo || intakeDocs.length);
              const c = outcome && !outcome.intake ? outcome.color : ACCENT;
              return (
                <Box sx={{ display: "grid", gap: 1, mt: 1, gridTemplateColumns: { xs: "1fr", md: showQuote ? "1fr 1fr" : "1fr" } }}>
                  <DocBox title="เอกสารอ้างอิง" hint="ได้มาตอนรับงาน (ใบเสนอราคาเดิม / PO)">
                    {hasRef ? <RefDocCell job={job} compact={false} /> : <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>ไม่มีเอกสารอ้างอิง</Typography>}
                    {intakeDocs.length > 0 && <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}><FileLinks files={intakeDocs} /></Stack>}
                  </DocBox>
                  {showQuote && (
                    // ✅ (19 ต.ค. 2569 ผู้ใช้: "อธิบายให้เข้าใจว่าใบเสนอราคาเพิ่มเติมงานนี้มีไหม")
                    //    ใบเสนอราคาเพิ่มเติม = เสนองาน/อะไหล่ที่พบตอนเข้าหน้างาน (คนละใบกับใบเสนอราคาที่ได้มาตอนรับงาน ด้านซ้าย)
                    <DocBox title="ใบเสนอราคาเพิ่มเติม" hint="งาน/อะไหล่ที่พบหน้างาน" tone={outcome.intake ? null : outcome.color}>
                      <Stack direction="row" alignItems="center" gap={1.25} sx={{ flexWrap: "wrap" }}>
                        <Box sx={{ flex: 1, minWidth: 180 }}>
                          {outcome.intake ? (
                            <>
                              <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: "#475569" }}>
                                {outcome.key === "na" ? "งานนี้ไม่มีเสนอราคาเพิ่มเติม" : "ยังไม่มีใบเสนอราคาเพิ่มเติม"}
                              </Typography>
                              <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8", mt: 0.2, lineHeight: 1.45 }}>
                                {outcome.key === "na" ? "ระบุไว้แล้วว่าไม่ต้องเสนอราคา" : "ถ้าเข้าหน้างานแล้วพบงานเพิ่ม/อะไหล่ที่ต้องเสนอราคา แนบใบเสนอราคาที่นี่ ระบบจะติดตามผลให้จนรู้ว่าได้งานไหม"}
                              </Typography>
                            </>
                          ) : <QuoteCell oc={outcome} />}
                        </Box>
                        {outcome.key !== "na" && (outcome.open || (!outcome.intake && outcome.href)) && (
                          <Button size="small" {...(outcome.open ? { onClick: outcome.open } : { component: Link, to: outcome.href })}
                            startIcon={outcome.intake ? <AddRounded sx={{ fontSize: "17px !important" }} /> : null}
                            endIcon={outcome.intake ? null : <ChevronRight sx={{ fontSize: "16px !important" }} />}
                            sx={{ ...BTN, flexShrink: 0, color: c, border: `1px ${outcome.intake ? "dashed" : "solid"} ${alpha(c, 0.45)}`, bgcolor: "#fff", "&:hover": { bgcolor: alpha(c, 0.06) } }}>
                            {outcome.intake ? "แนบใบเสนอราคา" : outcome.act}
                          </Button>
                        )}
                      </Stack>
                    </DocBox>
                  )}
                </Box>
              );
            })()}
            {job.noVisit && invoiceFiles.length > 0 && (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                <FileLinks files={invoiceFiles} label="ใบวางบิล" />
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
            </Collapse>
          </Box>
        </Stack>
        {/* 🔁 (20 ต.ค. 2569 ผู้ใช้: "ย่อการ์ดลงอีก ดูยาวไป · ดูงาน เห็นด้านขวาว่าง") มือถือ: ปุ่ม "ดูงาน" ย้ายขึ้นมุมขวาบน ไม่กินแถวเต็ม */}
        {actions && <Stack direction="row" spacing={0.75} sx={{ mt: { xs: 1.25, md: 1.5 }, justifyContent: inRow ? "flex-end" : "flex-start", display: inRow ? "flex" : { xs: viewOnly ? "none" : "flex", md: "none" } }}>{actions}</Stack>}
      </Box>

      {/* ท้ายการ์ด: สถานะ + สิ่งที่ต้องทำต่อ | แถบขั้นตอน */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1, md: 2.5 }} alignItems={{ md: "center" }}
        sx={{ px: { xs: 1.75, sm: 2.25 }, py: { xs: 0.85, sm: 1.1 }, bgcolor: SURFACE, borderTop: `1px solid ${LINE}` }}>
        <Stack sx={{ flex: 1, minWidth: 0, flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "flex-start", md: "center" }, gap: { xs: 0.25, md: 1 } }}>
          <Box sx={{ display: inRow ? "inline-flex" : { xs: "none", sm: "inline-flex" } }}><Chip color={st.color} bg={alpha(st.color, 0.1)} border="transparent">{st.label}</Chip></Box>
          {nx && !inRow && showMore && <Typography sx={{ display: { xs: "block", sm: "none" }, fontSize: "0.68rem", fontWeight: 800, color: "#94a3b8", letterSpacing: 0.3 }}>ขั้นถัดไป</Typography>}
          {nx && (
            <Typography sx={{ fontSize: "0.8rem", color: "#334155", minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere",
              ...(showMore ? {} : { whiteSpace: { xs: "nowrap", sm: "normal" }, overflow: { xs: "hidden", sm: "visible" }, textOverflow: { xs: "ellipsis", sm: "clip" } }) }}>
              <Box component="span" sx={{ fontWeight: 800, color: INK }}>{nx.title}</Box>
              <Box component="span" sx={{ color: MUTED }}> — {nx.desc}</Box>
            </Typography>
          )}
        </Stack>
        {st.i >= 0 && showMore && <Box sx={{ width: { xs: "100%", md: 360 }, flexShrink: 0 }}><StageBar stage={st} /></Box>}
      </Stack>
    </Box>
    {!inRow && (
      <MobileSheet open={sheetOpen} maxWidth="lg" onClose={() => setSheetOpen(false)}
        title={job.intakeNote ? "บันทึกงาน" : `${job.title || "งาน"}${job.system ? ` · ${job.system}` : ""}`}
        subtitle={[job.jobNo, place].filter(Boolean).join(" · ")}>
        <Box sx={{ p: { xs: 1.25, sm: 2 } }}>
          <JobCard inRow inSheet job={job} outcome={outcome} readOnly={readOnly} requestMode={requestMode} employees={employees}
            onSchedule={(j) => { setSheetOpen(false); onSchedule?.(j); }} onDeliver={(j) => { setSheetOpen(false); onDeliver?.(j); }}
            onUploadInvoice={onUploadInvoice} onNoteDone={onNoteDone} onEdit={(j) => { setSheetOpen(false); onEdit?.(j); }}
            onCancel={(j) => { setSheetOpen(false); onCancel?.(j); }} onRestore={onRestore} />
        </Box>
      </MobileSheet>
    )}
    </>
  );
}

/** ไอคอนปฏิทินบนการ์ดมือถือ — กว้าง/สูงเท่ากันทุกใบ แถวการ์ดเรียงตรงกัน */
// 🔁 (20 ต.ค. 2569 ผู้ใช้: "ลดขนาดวันที่ลงอีกให้พอดี") กว้าง 48 · ตัวเลข 1.1rem
const DateTile = ({ head, big, foot, color = "#475569", footColor = null, dashed = false, small = false }) => (
  <Box sx={{ width: 48, borderRadius: 1.75, overflow: "hidden", textAlign: "center", bgcolor: "#fff",
    border: `1px ${dashed ? "dashed" : "solid"} ${dashed ? "#cbd5e1" : "#d5dce5"}` }}>
    <Box sx={{ py: 0.1, bgcolor: dashed ? SURFACE : "#475569", color: dashed ? "#64748b" : "#fff", fontSize: "0.58rem", fontWeight: 800, lineHeight: 1.5, whiteSpace: "nowrap" }}>{head}</Box>
    <Typography sx={{ fontSize: small ? "0.9rem" : "1.1rem", fontWeight: 900, lineHeight: 1.15, pt: small ? 0.35 : 0.15, color: dashed ? color : INK, fontVariantNumeric: "tabular-nums" }}>{big}</Typography>
    <Typography sx={{ fontSize: "0.56rem", fontWeight: 700, lineHeight: 1.3, pb: 0.3, color: footColor || (dashed ? color : MUTED), whiteSpace: "nowrap" }}>{foot}</Typography>
  </Box>
);

/** รูปผู้รับผิดชอบ (ไม่มีรูป = ตัวอักษรแรกบนสีประจำตัว) */
const PersonPic = ({ name, owner, size = 30 }) => (
  <Avatar src={hasValidAvatar(owner?.imageUrl) ? owner.imageUrl : undefined}
    sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0, boxShadow: "0 0 0 2px #fff, 0 0 0 3px #e2e8f0" }}>
    {personInitial(name)}
  </Avatar>
);

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
    display: "inline-flex", alignItems: "center", gap: 0.6, height: { xs: 22, sm: 26 }, px: { xs: 0, sm: 1 }, borderRadius: 1.5, maxWidth: "100%",
    fontSize: "0.78rem", fontWeight: 700, color: "#334155", bgcolor: { xs: "transparent", sm: dashed ? "transparent" : SURFACE },
    border: { xs: 0, sm: `1px ${dashed ? "dashed" : "solid"} ${accent ? alpha(accent, 0.45) : LINE}` }, whiteSpace: "nowrap", overflow: "hidden",
  }}>
    {Icon && <Icon sx={{ fontSize: 16, flexShrink: 0, color: accent || "#94a3b8" }} />}
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
    text: `แผนเข้างาน ${formatThai(moment(job.plannedMonth, "YYYY-MM"), "MMM YYYY")}`,
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
  const fromDispatch = useLocation().pathname.startsWith("/dispatch");
  const [tab, setTab] = useState(fromDispatch ? "requests" : "waiting");
  const [scheduling, setScheduling] = useState(null);
  const [delivering, setDelivering] = useState(null);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState(() => new Map()); // jobGroupId/_id → ทุกวันของงาน (หาใบเสนอราคาของกลุ่ม)
  const [view, setView] = useState(() => initialViewMode("tt-intake-view"));
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
  // ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้มีคอนเฟิร์มด้วย ทุกจุดที่มีการกดปุ่ม") — ถามก่อนเปลี่ยนสถานะทุกครั้ง
  const noteDone = async (job, undo = false) => {
    const ok = await Swal.fire({
      icon: "question",
      title: undo ? "นำบันทึกนี้กลับมาทำต่อ?" : "ทำงานนี้เสร็จแล้ว?",
      html: `<div style="font-size:14px;color:#475569;white-space:pre-line">${String(job.description || "บันทึกงาน").replace(/[<>&]/g, "")}</div>`,
      showCancelButton: true,
      confirmButtonText: undo ? "นำกลับมาทำต่อ" : "ทำเสร็จแล้ว",
      confirmButtonColor: undo ? ACCENT : GREEN,
    });
    if (!ok.isConfirmed) return;
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
    const ok = await Swal.fire({
      icon: "question", title: "นำงานนี้กลับมา?",
      html: `<div style="font-size:14px;color:#475569">${[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ").replace(/[<>&]/g, "")}</div>`,
      text: undefined, showCancelButton: true, confirmButtonText: "นำกลับมา",
    });
    if (!ok.isConfirmed) return;
    try {
      await EventService.CancelIntake(job._id, { restore: true });
      await load(); refreshAppBadges(); setTab("waiting");
      Swal.fire({ icon: "success", title: "นำงานกลับมาแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };

  // ✅ กดที่ใบเสนอราคา → เปิดกล่องใบเสนอราคา (ตัวเดียวกับหน้าติดตามใบเสนอราคา) ในหน้านี้เลย — คนที่มีสิทธิ์ดูการเงิน
  const [quote, setQuote] = useState(null); // { id }
  const canQuote = can(userData, "viewFinance");
  const withStage = useMemo(() => (jobs || []).map((j) => {
    const s = stageOf(j);
    const oc = outcomeOf(j, s, groups.get(String(j.jobGroupId || j._id)));
    if (oc) oc.open = canQuote && oc.qid ? () => setQuote({ id: oc.qid }) : null;
    return { j, s, oc };
  }), [jobs, groups, canQuote]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, withStage.filter((x) => t.test(x.s, x.oc)).length])), [withStage]);
  // ✅ (19 ต.ค. 2569 ผู้ใช้: "ถ้าเป็นหน้าว่าง ให้เอาข้อมูลหน้าดำเนินการมาวาง · มีรอดำเนินการค่อยสลับให้แสดงแค่รอดำเนินการ")
  //    แท็บเริ่มต้นเลือกเอง: มีงานรอ → รอดำเนินการ · ไม่มี → กำลังดำเนินการ (จนกว่าผู้ใช้จะกดเลือกแท็บเอง)
  const [tabPicked, setTabPicked] = useState(fromDispatch);
  // คำขอ · รออนุมัติ (เฉพาะคนจัดคิว) — ตัวเลขรับมาจากแผงทั้งสอง (mount ไว้ตลอด)
  const canQueue = can(userData, "assignDispatch");
  const [approveN, setApproveN] = useState(null);
  const [reqCounts, setReqCounts] = useState(null);
  const reqTotal = (approveN || 0) + (reqCounts?.waiting || 0);
  const reqReady = !canQueue || (approveN !== null && reqCounts !== null);
  useEffect(() => {
    if (!jobs || tabPicked || !reqReady) return;
    setTab(canQueue && reqTotal > 0 ? "requests" : counts.waiting > 0 ? "waiting" : "active");
  }, [jobs, counts.waiting, tabPicked, reqReady, canQueue, reqTotal]);
  const tabsShown = [
    ...(canQueue && (reqTotal > 0 || tab === "requests") ? [{ key: "requests", label: "คำขอ · รออนุมัติ", short: "คำขอ" }] : []),
    ...TABS.filter((t) => !t.hideEmpty || counts[t.key] > 0 || tab === t.key),
  ];
  const tabCount = (k) => (k === "requests" ? reqTotal : counts[k] || 0);
  const list = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    // ✅ ค้นหา: ชื่องาน · โครงการ · บริษัท · เลข Job · เลขเอกสาร · ผู้รับผิดชอบ
    const kw = q.trim().toLowerCase();
    const hit = (j) => !kw || [j.title, j.system, j.site, j.company, j.jobNo, j.intakeDocNo, j.responsiblePerson, j.description]
      .some((v) => String(v || "").toLowerCase().includes(kw));
    return withStage.filter((x) => t.test(x.s, x.oc) && hit(x.j))
      // ✅ (11 ต.ค. 2569 ผู้ใช้: "งานใหม่ที่ลงตารางควรมาที่บนสุดด้วย") — ล่าสุดขึ้นก่อนทุกแท็บ
      //    กำลังทำ = เรียงตามเวลาส่งลงตาราง (scheduledAt) · รอลงตาราง = งานด่วนก่อน แล้วรับเข้าล่าสุด · เสร็จแล้ว = ปิดล่าสุด
      .sort(({ j: a }, { j: b }) => (tab === "done"
        ? new Date(b.closeApprovedAt || b.updatedAt || 0) - new Date(a.closeApprovedAt || a.updatedAt || 0)
        : tab === "active"
          ? new Date(b.scheduledAt || b.createdAt || b.intakeAt || 0) - new Date(a.scheduledAt || a.createdAt || a.intakeAt || 0)
          : (isUrgent(b) - isUrgent(a)) || new Date(b.intakeAt || 0) - new Date(a.intakeAt || 0)));
  }, [withStage, tab, q]);
  // ✅ (19 ต.ค. 2569 ผู้ใช้: "ทำระบบแบ่งหน้าด้วยให้สมบูรณ์") การ์ด 10 / ตาราง 20 ต่อหน้า · เปลี่ยนแท็บ/ค้นหา/มุมมอง = กลับหน้า 1
  const pg = usePaged(list, view === "table" ? 20 : 10);
  const { setPage } = pg;
  useEffect(() => { setPage(1); }, [tab, q, view, setPage]);
  const goPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    // ✅ (19 ต.ค. 2569 ผู้ใช้: "ถ้ามันล้นให้ขยายตารางออกอีก") มุมมองตาราง = กว้างเต็มพื้นที่ (ไม่จำกัด 1500)
    <Box sx={{ ...PAGE_SX, maxWidth: "none" }}>
      <PageHeader icon={<PostAddOutlined />} title="งานเข้า · รับงาน"
        subtitle="รับงาน → ลงตารางเข้าหน้างาน หรือ ส่งของ → วางบิล · กดช่องใบเสนอราคาเพื่ออัปเดตได้ทันที"
        actions={canCreate
          ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} disabled={!jobs} sx={{ ...PRIMARY, height: 40, px: { xs: 1.25, sm: 2 } }}>รับงานใหม่</Button>
          : <Box component="span" sx={{ px: 1.25, py: 0.5, borderRadius: 99, fontSize: "0.74rem", fontWeight: 700, color: MUTED, bgcolor: SURFACE, border: `1px solid ${LINE}`, whiteSpace: "nowrap" }}>ดูอย่างเดียว</Box>} />

      {/* แท็บตามขั้นตอน */}
      {/* 🔁 (20 ต.ค. 2569 ผู้ใช้: "แถบเลือกข้างบนหน้าจอมือถือดูรก กินพื้นที่ เช่น รอเริ่ม กำลังทำ")
          มือถือ: แถบแบ่งช่องแถวเดียวในกรอบเดียว (ชื่อ + จำนวนบรรทัดเดียว สูง 34) · ช่องที่เลือก = พื้นขาวยกขึ้น ไม่ใช้กรอบน้ำเงินทุกช่อง */}
      <Stack direction="row" sx={{ mb: 1.5, gap: { xs: 0.4, sm: 0.75 }, p: { xs: 0.4, sm: 0 }, borderRadius: { xs: 2.5, sm: 0 }, bgcolor: { xs: "#eef2f6", sm: "transparent" },
        overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {tabsShown.map((t) => {
          const on = tab === t.key;
          return (
            <ButtonBase key={t.key} onClick={() => { setTabPicked(true); setTab(t.key); }} sx={{
              flex: { xs: "1 1 0", sm: "0 0 auto" }, minWidth: 0, height: { xs: 34, sm: 40 }, px: { xs: 0.5, sm: 1.75 }, borderRadius: { xs: 2, sm: 2.5 },
              flexDirection: "row", fontSize: { xs: "0.78rem", sm: "0.84rem" }, fontWeight: 800, gap: { xs: 0.45, sm: 0.6 }, whiteSpace: "nowrap", overflow: "hidden",
              border: { xs: 0, sm: `1.5px solid ${on ? ACCENT : LINE}` },
              bgcolor: on ? { xs: "#fff", sm: alpha(ACCENT, 0.07) } : { xs: "transparent", sm: "#fff" },
              boxShadow: on ? { xs: "0 1px 3px rgba(15,23,42,.14)", sm: "none" } : "none",
              color: on ? { xs: INK, sm: ACCENT } : { xs: MUTED, sm: "#334155" },
            }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t.label}</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{t.short}</Box>
              <Box component="span" sx={{ minWidth: { xs: 18, sm: 20 }, height: { xs: 18, sm: 20 }, px: 0.55, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: { xs: "0.68rem", sm: "0.72rem" },
                bgcolor: on ? ACCENT : { xs: "rgba(100,116,139,.14)", sm: SURFACE }, color: on ? "#fff" : MUTED,
                ...(t.key === "requests" && !on && reqTotal > 0 ? { bgcolor: "#d97706", color: "#fff" } : {}) }}>{tabCount(t.key)}</Box>
            </ButtonBase>
          );
        })}
      </Stack>

      {/* ค้นหา + สลับมุมมอง การ์ด / ตาราง · ตาราง: กดแถวเพื่อกางรายละเอียดเต็ม */}
      <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1, height: 40, px: 1.5, borderRadius: 2.5, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          <Search sx={{ fontSize: 18, color: "#94a3b8" }} />
          <Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่องาน / โครงการ / เลขที่งาน / เลขเอกสาร"
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

      {/* ── แท็บ คำขอ · รออนุมัติ — แผงทั้งสอง mount ไว้ตลอด (ได้ตัวเลขบนแท็บ) ซ่อนด้วย display ── */}
      {canQueue && (
        <Box sx={{ display: tab === "requests" ? "block" : "none" }}>
          {reqReady && reqTotal === 0 && (
            <EmptyState icon={<PostAddOutlined />} title={q ? "ไม่พบคำขอที่ค้นหา" : "ไม่มีคำขอรออนุมัติ"}
              hint="แผนงานที่ช่างลงเอง และใบแจ้งงานจากฝ่ายอื่น จะมารอตัดสินใจที่นี่" />
          )}
          <Box sx={{ display: approveN > 0 ? "block" : "none", mb: 2 }}>
            <Suspense fallback={<Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />}>
              <PendingApprovalsPanel active embedded search={q} onCountChange={setApproveN} />
            </Suspense>
          </Box>
          <Box sx={{ display: reqCounts?.waiting > 0 ? "block" : "none" }}>
            <Typography sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1, px: 0.5, fontSize: "0.86rem", fontWeight: 800, color: INK }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#d97706" }} />
              ใบแจ้งงานรอลงแผนงาน
              <Box component="span" sx={{ fontWeight: 600, fontSize: "0.76rem", color: MUTED }}>{reqCounts?.waiting || 0} · ยังไม่มีวันนัด — ตรวจรายละเอียด แล้วเลือกวันเข้างาน + ช่าง</Box>
            </Typography>
            <DispatchList mode="board" embedded section="waiting" search={q} myId={String(userData?.userId || "")} onCounts={setReqCounts} />
          </Box>
        </Box>
      )}

      {tab === "requests" ? null : !jobs ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : list.length ? (
        view === "table" ? (
          <>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.75, px: 0.5 }}>กดที่แถวเพื่อดูรายละเอียดทั้งหมด</Typography>
          <JobTable rows={pg.rows} employees={employees} refMode={tab === "waiting"} readOnlyOf={(j) => !canManage && !isMine(j)} requestMode={!canManage} onSchedule={setScheduling} onDeliver={setDelivering} onUploadInvoice={uploadInvoice} onNoteDone={noteDone}
            renderCard={(j, oc, close) => <JobCard inRow inSheet employees={employees} job={j} outcome={oc} readOnly={!canManage && !isMine(j)} requestMode={!canManage}
              onSchedule={(x) => { close?.(); setScheduling(x); }} onDeliver={(x) => { close?.(); setDelivering(x); }} onUploadInvoice={uploadInvoice} onNoteDone={noteDone}
              onEdit={(x) => { close?.(); openForm(x); }} onCancel={(x) => { close?.(); cancelJob(x); }} onRestore={restoreJob} />} />
          <PageBar {...pg} setPage={goPage} unit="งาน" />
          </>
        ) : (
          <>
          <Stack spacing={1.25}>{pg.rows.map(({ j, oc }) => <JobCard key={j._id} employees={employees} job={j} outcome={oc} readOnly={!canManage && !isMine(j)} requestMode={!canManage} onSchedule={setScheduling} onDeliver={setDelivering} onUploadInvoice={uploadInvoice} onNoteDone={noteDone} onEdit={openForm} onCancel={cancelJob} onRestore={restoreJob} />)}</Stack>
          <PageBar {...pg} setPage={goPage} unit="งาน" />
          </>
        )
      ) : (
        <EmptyState icon={<PostAddOutlined />}
          title={q ? "ไม่พบงานที่ค้นหา" : tab === "waiting" ? "ไม่มีงานรอดำเนินการ" : tab === "active" ? "ไม่มีงานที่กำลังดำเนินการ" : tab === "cancelled" ? "ไม่มีงานที่ยกเลิก" : "ยังไม่มีงานที่เสร็จ"}
          hint={tab === "waiting" && canCreate ? "ได้งานมาแล้ว กด “รับงานใหม่” เพื่อกรอกเก็บไว้ก่อน" : undefined}
          action={tab === "waiting" && canCreate ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} sx={{ ...PRIMARY, mt: 1 }}>รับงานใหม่</Button> : null} />
      )}

      {delivering && (
        <DeliverDialog job={delivering} onClose={() => setDelivering(null)}
          onDone={async () => { setDelivering(null); await load(); refreshAppBadges(); }} />
      )}

      {quote && (
        <Suspense fallback={null}>
          <QuotationDialogHost eventId={quote.id} onClose={() => setQuote(null)} onChanged={load} />
        </Suspense>
      )}
      {scheduling && (
        <ScheduleDialog job={scheduling} employees={employees} canAssignResponsible={can(userData, "editContracts")} requestMode={!canManage} onClose={() => setScheduling(null)}
          onDone={async () => { setScheduling(null); await load(); refreshAppBadges(); }} />
      )}
    </Box>
  );
}

/**
 * ช่องติดตามวางบิลของงานส่งของ (ตารางงานเข้า)
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "ใบวางบิลจะดูยังไง กดดูยาก ให้เปิดได้เลย · สถานะการติดตามให้ดูง่าย สวยงาม")
 *    สถานะ (ยังไม่วางบิล / รอชำระ / เลยกำหนดชำระ / ชำระครบ / ไม่ต้องวางบิล) + ปุ่ม "เปิดใบวางบิล" + ลิงก์ติดตาม
 */
function BillingSlot({ job }) {
  if (job.unscheduled) return <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>;
  if (job.invoiceApplicable === false) {
    return (
      <Stack direction="row" spacing={0.6} alignItems="center">
        <TaskAltRounded sx={{ fontSize: 16, color: "#94a3b8" }} />
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b" }}>ไม่ต้องวางบิล</Typography>
      </Stack>
    );
  }
  const files = job.invoiceFiles || [];
  const st = job.billing?.invoicedAt ? billingStatus(job.billing) : files.length ? { state: "unpaid", label: "วางบิลแล้ว" } : { state: "not_invoiced", label: "ยังไม่วางบิล" };
  const color = st.state === "not_invoiced" ? AMBER : (BILLING_STATE_META[st.state]?.color || ACCENT);
  const last = files[files.length - 1];
  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box sx={{ width: 26, height: 26, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.12), color }}>
          <ReceiptLongOutlined sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 800, color, lineHeight: 1.3 }}>{st.label}</Typography>
          <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED, lineHeight: 1.3 }}>
            {job.billing?.invoiceNo ? `เลขที่ ${job.billing.invoiceNo}` : files.length ? `ใบวางบิล ${files.length} ไฟล์` : "แนบใบวางบิลจากปุ่มท้ายแถว"}
          </Typography>
        </Box>
      </Stack>
      {(last || job.billing?.invoicedAt) && (
        <Stack direction="row" gap={0.75} sx={{ mt: 0.6, pl: 4.25, flexWrap: "wrap" }}>
          {last && (
            <Box component="a" href={last.fileUrl} target="_blank" rel="noreferrer" title={last.fileName}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 24, px: 0.9, borderRadius: 99, bgcolor: alpha(ACCENT, 0.08), color: ACCENT, fontSize: "0.7rem", fontWeight: 800, textDecoration: "none", "&:hover": { bgcolor: alpha(ACCENT, 0.14) } }}>
              <AttachFileRounded sx={{ fontSize: 13 }} />เปิดใบวางบิล
            </Box>
          )}
          <Box component={Link} to={`/finance?tab=billing&jobId=${job._id}`}
            sx={{ display: "inline-flex", alignItems: "center", height: 24, px: 0.9, borderRadius: 99, border: `1px solid ${LINE}`, color: "#334155", fontSize: "0.7rem", fontWeight: 800, textDecoration: "none", "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
            ติดตาม ›
          </Box>
        </Stack>
      )}
    </Box>
  );
}
