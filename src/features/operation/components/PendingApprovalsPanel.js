/**
 * PendingApprovalsPanel.js — แผงงาน "รออนุมัติ" ในหน้าการดำเนินงาน (เฉพาะแอดมิน/manager)
 *
 * ⚠️ เดิมเป็นหน้าแยกของตัวเอง (/pending-approvals) — ย้ายมาเป็นแท็บหนึ่งในหน้า "การดำเนินงาน" ตามที่
 * ผู้ใช้ขอ เพราะเป็นงานเดียวกัน (ไล่จัดการงานทีละใบ) แต่เดิมต้องสลับหน้าไปมา และตัวเลข "รอคุณอนุมัติ"
 * ก็โผล่อยู่ทั้งสองที่จนดูเหมือนคนละระบบ
 *
 * ⚠️ ทำไมยังดึงข้อมูลเองแยกจากหน้าแม่: หน้าการดำเนินงานใช้ getEventOp() ซึ่ง backend กรองด้วย
 * $or:[{resPerson},{team},{userId}] สำหรับทุก role ที่ไม่ใช่ "admin" เป๊ะๆ (ดู routes/calendarEvent.js)
 * แปลว่า manager ที่มาอนุมัติจะเห็นแค่งานของตัวเอง งานที่คนอื่นส่งขออนุมัติจะหายไปหมด — แผงนี้จึงต้องใช้
 * getEvents() (ไม่กรองตาม role) + GetDraftEvents() เองเสมอ ห้ามเปลี่ยนไปใช้ข้อมูลของหน้าแม่
 */

import { useEffect, useMemo, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { initialViewMode } from "@/shared/ui/ViewToggle";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Chip, Button, IconButton, Tooltip, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  HourglassTop, Cancel, EventNote, CalendarMonth,
  ArrowForwardIos, TaskAlt,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import { isPendingApproval, isRejected } from "@/shared/utils/approvalStatus";
import { getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { classifyJob, getJobClassMeta } from "@/shared/utils/jobClassification";
// ✅ ใช้บรรทัดข้อมูลตัวเดียวกับการ์ดงานในแท็บ "รายการงาน" — ข้อมูลชุดเดียวกัน (ระบบ/โครงการ/ครั้งที่/ทีม)
// จะได้แสดงหน้าตาเหมือนกันเป๊ะทั้งสองแท็บตามที่ผู้ใช้ขอ ไม่ใช่ต่างคนต่างจัดรูปแบบเอง
import { formatThai } from "@/shared/utils/thaiDate";
import { PersonChip, UnassignedChip } from "@/shared/ui/PersonChip";
import { QueueToolbar, SectionHead, AllClear, ActionCard, PeopleField, QueueRow, RowGroup, SoftPill, AMBER, BLUE } from "@/features/dispatch/components/QueueKit";

export default function PendingApprovalsPanel({ onCountChange, active = true }) {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [viewMode, setViewMode] = useState(() => initialViewMode("pendingApprovals.viewMode"));
  const [showRejected] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // sessions[] ของกลุ่มที่กำลังจะไม่อนุมัติ
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  // ✅ รายชื่อพนักงาน — ใช้เป็นตัวเลือกช่อง "ผู้รับผิดชอบ" ที่มอบหมายได้ตรงจากการ์ดนี้เลย
  const [employees, setEmployees] = useState([]);
  const [assigningKey, setAssigningKey] = useState(null);
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("all");

  // ⚠️ ทั้งสอง endpoint ตอบ 404 เมื่อไม่มีข้อมูลเลย (axios throw) จึงต้อง .catch() ทุกตัว —
  // การอนุมัติจริงยังถูกกันซ้ำอีกชั้นที่ backend (403 ถ้าไม่ใช่ admin/manager)
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [resEvents, resDrafts] = await Promise.all([
        EventService.getEvents().catch(() => ({ userEvents: [] })),
        EventService.GetDraftEvents().catch(() => ({ drafts: [] })),
      ]);
      setEvents(resEvents?.userEvents || []);
      setDrafts(resDrafts?.drafts || []);
      setLastRefreshed(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ✅ ดึงข้อมูลรอบแรกเสมอแม้ยังไม่ได้เปิดแท็บนี้ — เพราะตัวเลขบน badge ของแท็บต้องถูกต้องตั้งแต่เข้า
  // หน้ามา ไม่งั้นจะขึ้น 0 จนกว่าจะกดเข้ามาดูเอง ซึ่งทำให้ badge ไร้ประโยชน์ (จุดประสงค์คือบอกว่ามีงาน
  // ค้างโดยไม่ต้องกดเข้าไปดู)
  useEffect(() => { fetchData(); }, []);

  // ✅ เรียลไทม์: มีคำขอใหม่/อนุมัติไปแล้วจากเครื่องอื่น → ตัวเลขและรายการอัปเดตทันที
  useRealtime("events", () => { fetchData(true); });

  // ⚠️ จำมุมมองที่เลือกไว้ข้ามการเปิดหน้า (แบบแผนเดียวกับคิวคำขอจากฝ่ายขาย)
  useEffect(() => {
    try { localStorage.setItem("pendingApprovals.viewMode", viewMode); } catch { /* storage ปิดอยู่ */ }
  }, [viewMode]);
  useEffect(() => {
    (async () => {
      try {
        const res = await AuthService.getAllUserData();
        setEmployees(res?.allUser || []);
      } catch {
        setEmployees([]); // ✅ มอบหมายไม่ได้ก็ยังอนุมัติ/ไม่อนุมัติได้ตามปกติ ไม่ให้พังทั้งแผง
      }
    })();
  }, []);
  // ⚠️ แต่ "รีเฟรชอัตโนมัติทุก 30 วินาที" ให้ทำเฉพาะตอนเปิดแท็บนี้อยู่จริงเท่านั้น — ไม่งั้นจะยิง API
  // ทุก 30 วิ ตลอดเวลาที่เปิดหน้าการดำเนินงานค้างไว้ ทั้งที่ผู้ใช้อาจไม่เคยแตะแท็บนี้เลย
  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [active]);

  // ✅ งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) = 1 งาน ต้องรวมเป็นแถวเดียว ไม่งั้นแอดมินเห็น
  // งานเดียวโผล่ N แถว และ DecideApproval ก็ตัดสินทั้ง jobGroupId ให้ในครั้งเดียวอยู่แล้ว — ใช้
  // getOverdueGroupKey ตัวเดียวกับที่ countPendingJobs ใช้ ตัวเลขจะได้ตรงกับ badge บนปฏิทินเป๊ะ
  const groupBy = (list, predicate) => {
    const map = new Map();
    list.filter(predicate).forEach((e) => {
      const key = getOverdueGroupKey(e);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.values()].map((sessions) =>
      sessions.slice().sort((a, b) => new Date(a.start || a.plannedMonth || 0) - new Date(b.start || b.plannedMonth || 0))
    );
  };

  const all = useMemo(() => [...events, ...drafts], [events, drafts]);

  const pendingGroups = useMemo(() => {
    return groupBy(all, isPendingApproval).sort((a, b) =>
      new Date(b[0].approvalRequestedAt || b[0].createdAt || 0) - new Date(a[0].approvalRequestedAt || a[0].createdAt || 0)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  // 🐛 BUG ที่แก้ (ตัวเลข "ไม่อนุมัติ" ไม่ตรงกับข้อมูลจริง): เดิมตัดเหลือ 10 รายการด้วย .slice(0,10)
  // ตั้งแต่ตอนคำนวณ แล้วเอา .length ของ "ลิสต์ที่ตัดแล้ว" ไปแสดงเป็นตัวเลขสรุปทั้งในการ์ดสรุปด้านบนและ
  // หัวข้อปุ่มกางด้านล่าง — ถ้ามีงานที่ไม่อนุมัติ 25 งาน หน้าจอจะขึ้น "10" ทุกที่ ซึ่งเป็นตัวเลขที่ผิด
  // (ไม่ใช่ทั้ง "จำนวนจริง" และไม่ได้บอกด้วยว่าถูกตัดมา) ทำให้เข้าใจผิดว่ามีแค่ 10 งาน
  // ✅ แยกเป็น 2 ค่า: ยอดจริงทั้งหมด (ใช้แสดงตัวเลขสรุป) กับลิสต์ที่ตัดแล้ว (ใช้แสดงผลจริง) และบอกให้
  // ชัดตรงหัวข้อว่ากำลังแสดงกี่รายการจากทั้งหมดเท่าไหร่
  const rejectedAll = useMemo(() => {
    return groupBy(all, isRejected).sort((a, b) =>
      new Date(b[0].approvalDecidedAt || 0) - new Date(a[0].approvalDecidedAt || 0)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  // ✅ ไม่ actionable แล้ว (backend 400 ถ้าไม่ใช่ pending) — แสดงแค่ล่าสุดพอ ไม่ให้รกจอ
  const REJECTED_SHOW_LIMIT = 10;
  const rejectedGroups = useMemo(
    () => rejectedAll.slice(0, REJECTED_SHOW_LIMIT),
    [rejectedAll]
  );

  // ✅ ส่งจำนวนที่รออนุมัติกลับให้หน้าแม่ไปแสดงเป็นตัวเลขบนแท็บ — ผู้ใช้จะได้รู้ว่ามีงานค้างรออยู่
  // โดยไม่ต้องกดเข้ามาดูในแท็บนี้ก่อน
  useEffect(() => {
    if (!loading) onCountChange?.(pendingGroups.length);
  }, [pendingGroups.length, loading, onCountChange]);


  // ✅ DecideApproval ตัดสินทั้ง jobGroupId ให้ในครั้งเดียวฝั่ง backend อยู่แล้ว → ยิงแค่ id เดียว
  // (ตัวแรกของกลุ่ม) พอ ไม่ต้อง loop ทีละวัน ไม่งั้นตัวที่ 2 เป็นต้นไปจะโดน 400 "งานนี้ไม่ได้อยู่
  // ระหว่างรออนุมัติ" เพราะตัวแรกเปลี่ยนสถานะทั้งกลุ่มไปแล้ว
  const handleApprove = async (sessions) => {
    const key = getOverdueGroupKey(sessions[0]);
    setBusyKey(key);
    try {
      await EventService.DecideApproval(sessions[0]._id, "approve");
      await fetchData(true);
    } catch (err) {
      Swal.fire({ icon: "error", title: "อนุมัติไม่สำเร็จ", text: err?.response?.data?.message || err.message });
    } finally {
      setBusyKey(null);
    }
  };

  // ✅ มอบหมาย "ผู้รับผิดชอบงาน" ได้ตรงจากการ์ดนี้เลย ก่อนกดอนุมัติ — จุดที่ขาดอยู่เดิม: งานที่เซล/ช่าง
  // ส่งเข้ามามักยังไม่มีผู้รับผิดชอบ (คนส่งไม่มีสิทธิ์มอบหมายเอง — backend 403 ดู PUT /basic-info)
  // แอดมินจึงต้องอนุมัติก่อน แล้วค่อยไปตามหางานนั้นในอีกหน้าเพื่อมอบหมายทีหลัง ซึ่งตกหล่นบ่อยมาก
  // ⚠️ อัปเดตทุก document ในกลุ่มพร้อมกัน (งานเข้าหลายวันไม่ติดกัน = งานเดียว) ไม่งั้นบางวันมีผู้รับผิดชอบ
  // บางวันไม่มี — ใช้ eventIds ตรงๆ ผ่าน UpdateBasicInfo ซึ่งใช้ได้ทั้งงานสัญญาและงานทั่วไป (สิทธิ์
  // แอดมิน/manager เท่านั้น ซึ่งแผงนี้เปิดให้เฉพาะสองบทบาทนี้อยู่แล้ว)
  const handleAssignResponsible = async (sessions, name) => {
    const key = getOverdueGroupKey(sessions[0]);
    setAssigningKey(key);
    try {
      const emp = employees.find((e) => e.fname === name);
      await EventService.UpdateBasicInfo(
        sessions.map((s) => s._id),
        { responsiblePerson: name || "", responsiblePersonId: emp?._id || "" }
      );
      await fetchData(true);
    } catch (err) {
      Swal.fire({ icon: "error", title: "มอบหมายไม่สำเร็จ", text: err?.response?.data?.message || err.message });
    } finally {
      setAssigningKey(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await EventService.DecideApproval(rejectTarget[0]._id, "reject", rejectReason.trim());
      setRejectTarget(null);
      setRejectReason("");
      await fetchData(true);
    } catch (err) {
      Swal.fire({ icon: "error", title: "ดำเนินการไม่สำเร็จ", text: err?.response?.data?.message || err.message });
    } finally {
      setRejecting(false);
    }
  };

  // ✅ ไปดูงานนี้บนหน้าปฏิทินแบบเจาะจง — งานที่ลงตารางแล้วเปิดไปที่เดือน/วันของมันแล้วไฮไลต์การ์ดให้
  // (?event=) ส่วนงานที่ยังไม่ลงตารางไม่มีวันที่จริง ต้องส่งไปที่แผงงานล่วงหน้า (?draft=) แทน ซึ่งเป็น
  // ที่ที่การ์ดของมันอยู่จริง — ดูตัวรับพารามิเตอร์ทั้งสองตัวที่ EventCalendar/index.js
  const goToCalendar = (head) => {
    const q = head.unscheduled
      ? `draft=${head._id}&month=${head.plannedMonth || ""}`
      : `event=${head._id}&date=${moment(head.start).format("YYYY-MM-DD")}`;
    navigate(`/event?${q}&t=${Date.now()}`);
  };

  const goToDetail = (head) => {
    if (head.unscheduled) {
      // ⚠️ ฉบับร่างของ "สัญญา" (มี contractGroupId) ไม่โผล่ในแผงงานล่วงหน้าของปฏิทินแล้ว (ดู
      // visibleDrafts ใน EventCalendar/index.js) — ลิงก์ ?draft= จะพาไปหน้าที่ไม่มีการ์ดนี้อยู่เลย
      // ต้องส่งไปหน้า "ภาพรวมงาน" ซึ่งเป็นที่เดียวที่จัดการสัญญาฉบับร่างได้จริงแทน
      if (head.contractGroupId) {
        navigate("/contracts");
        return;
      }
      navigate(`/event?draft=${head._id}&month=${head.plannedMonth || ""}&t=${Date.now()}`);
    } else {
      navigate(`/operation/${head._id}`);
    }
  };



  // ── ค้นหา + ตัวกรองด่วน (ชุดเดียวกับแท็บ "จากฝ่ายขาย" — ดู dispatch/components/QueueKit.js) ──
  const q = search.trim().toLowerCase();
  const matchQ = (s) => !q || [s[0].title, s[0].system, s[0].company, s[0].site, s[0].responsiblePerson, s[0].approvalRequestedBy]
    .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  const QUICK = {
    all: () => true,
    scheduled: (s) => !s[0].unscheduled,
    unscheduled: (s) => Boolean(s[0].unscheduled),
    unassigned: (s) => !s[0].responsiblePerson,
  };
  const searched = pendingGroups.filter(matchQ);
  const shownGroups = searched.filter(QUICK[quick] || QUICK.all);
  const dateLabelOf = (sessions) => {
    const head = sessions[0];
    return head.unscheduled
      ? (head.plannedMonth ? `แผนเดือน ${formatThai(moment(head.plannedMonth, "YYYY-MM").locale("th"), "MMMM YYYY")}` : "ยังไม่ระบุเดือน")
      : sessions.map((s) => formatEventDateRange(s)).join(", ");
  };
  const teamOf = (sessions) => [...new Set(sessions.flatMap((s) => [s.team, ...(s.teamMembers || []).map((m) => m?.name)]).filter(Boolean))];

  return (
    <Box>
      <QueueToolbar
        search={search} onSearch={setSearch} placeholder="ค้นหางาน / โครงการ / ผู้ส่ง"
        filter={quick} onFilter={setQuick}
        filters={[
          { key: "all", label: "ทั้งหมด", count: searched.length },
          { key: "scheduled", label: "ลงตารางแล้ว", count: searched.filter(QUICK.scheduled).length, color: BLUE },
          { key: "unscheduled", label: "ยังไม่ลงตาราง", count: searched.filter(QUICK.unscheduled).length, color: "#0e7490" },
          { key: "unassigned", label: "ยังไม่มีผู้รับผิดชอบ", count: searched.filter(QUICK.unassigned).length, color: AMBER },
        ]}
        view={viewMode} onView={setViewMode} onRefresh={() => fetchData()} loading={loading}
        note={lastRefreshed ? `อัปเดต ${moment(lastRefreshed).format("HH:mm")}` : ""}
      />

      <SectionHead color={AMBER} title="รออนุมัติ" count={shownGroups.length} hint="ช่างสร้างแผนงานเอง — มอบหมายผู้รับผิดชอบ แล้วกดอนุมัติ" />

      {loading ? (
        <Stack spacing={1.25}>
          {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 3 }} />)}
        </Stack>
      ) : shownGroups.length === 0 ? (
        <AllClear text={pendingGroups.length ? "ไม่มีรายการในตัวกรองนี้" : "เคลียร์หมดแล้ว — ไม่มีแผนงานรออนุมัติ"} />
      ) : viewMode === "table" ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                {["งาน", "โครงการ / ไซต์", "ประเภท", "วันที่", "ทีมที่เข้างาน", ""].map((h, i) => (
                  <TableCell key={i} sx={{ fontWeight: 800, fontSize: "0.74rem", color: "text.secondary", whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {shownGroups.map((sessions) => {
                const head = sessions[0];
                const key = getOverdueGroupKey(head);
                const busy = busyKey === key;
                const companySite = [head.company, head.site].filter(Boolean).join(" · ");
                const jcMeta = getJobClassMeta(classifyJob(head));
                const dateLabel = head.unscheduled
                  ? (head.plannedMonth ? `แผนเดือน ${formatThai(moment(head.plannedMonth, "YYYY-MM").locale("th"), "MMM YYYY")}` : "ยังไม่ระบุเดือน")
                  : sessions.map((x) => formatEventDateRange(x)).join(", ");
                const teamNames = [...new Set(
                  sessions.flatMap((x) => [x.team, ...(x.teamMembers || []).map((m) => m?.name)]).filter(Boolean)
                )];
                return (
                  <TableRow key={key} hover sx={{ "&:last-child td": { border: 0 } }}>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }} noWrap>{head.title || "งาน"}</Typography>
                      {head.system && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>{head.system}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220, fontSize: "0.78rem" }}>
                      <Typography variant="body2" sx={{ fontSize: "0.78rem" }} noWrap>{companySite || "ไม่ระบุ"}</Typography>
                    </TableCell>
                    <TableCell>
                      {/* ⚠️ งานเก่าบางใบไม่มีข้อมูลประเภท (สร้างก่อนมีฟิลด์นี้) — ต้องมีป้าย
                          "ไม่ระบุ" ไม่ปล่อยช่องว่าง ไม่งั้นจะดูเหมือนตารางโหลดข้อมูลไม่ครบ */}
                      {jcMeta ? (
                        <Chip
                          size="small" label={jcMeta.label}
                          sx={{ height: 19, fontSize: "0.63rem", fontWeight: 700, bgcolor: alpha(jcMeta.color, 0.14), color: jcMeta.color }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>ไม่ระบุ</Typography>
                      )}
                      {head.unscheduled && (
                        <Chip size="small" label="ยังไม่ลงตาราง" sx={{ ml: 0.4, height: 19, fontSize: "0.63rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.14), color: "#0e7490" }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>{dateLabel}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", maxWidth: 150 }}>
                      <Typography variant="caption" noWrap sx={{ display: "block" }}>
                        {teamNames.length ? teamNames.join(", ") : "— ยังไม่มอบหมาย"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small" color="success" variant="contained" disabled={busy}
                          onClick={(e) => { e.stopPropagation(); handleApprove(sessions); }}
                          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5, minWidth: 0, px: 1.25 }}
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          size="small" color="error" variant="outlined" disabled={busy}
                          onClick={(e) => { e.stopPropagation(); setRejectTarget(sessions); setRejectReason(""); }}
                          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5, minWidth: 0, px: 1.25 }}
                        >
                          ไม่อนุมัติ
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack spacing={1.25} sx={{ mb: 3 }}>
          {shownGroups.map((sessions) => {
            const head = sessions[0];
            const key = getOverdueGroupKey(head);
            const busy = busyKey === key;
            const isAssigning = assigningKey === key;
            const jcMeta = getJobClassMeta(classifyJob(head));
            const responsibleName = head.responsiblePerson || "";
            const team = teamOf(sessions);
            return (
              <ActionCard
                key={key}
                date={head.unscheduled ? null : head.start} dateTone={head.unscheduled ? "amber" : "blue"}
                top={<>
                  <SoftPill color={AMBER} icon={<HourglassTop />}>รออนุมัติ</SoftPill>
                  {jcMeta && <SoftPill color={jcMeta.color}>{jcMeta.label}</SoftPill>}
                  {head.unscheduled && <SoftPill color="#0e7490" icon={<EventNote />}>ยังไม่ลงตาราง</SoftPill>}
                  {sessions.length > 1 && <SoftPill color={BLUE}>เข้างาน {sessions.length} ช่วง</SoftPill>}
                </>}
                title={[head.company, head.site].filter(Boolean).join(" · ") || "ไม่ระบุโครงการ"}
                sub={[head.title, head.system, head.time ? `ครั้งที่ ${formatRoundLabel(head.time, head.visitCount)}` : ""].filter(Boolean).join(" · ")}
                detail={`📅 ${dateLabelOf(sessions)}${team.length ? `  ·  ทีม ${team.join(", ")}` : ""}`}
                people={<>
                  <PeopleField label="ผู้ส่ง">{head.approvalRequestedBy ? <PersonChip name={head.approvalRequestedBy} size={20} /> : "-"}</PeopleField>
                  {head.approvalRequestedAt && <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>ส่ง {moment(head.approvalRequestedAt).locale("th").fromNow()}</Typography>}
                  <Stack direction="row" spacing={0.25}>
                    <Tooltip title="ดูในปฏิทิน"><IconButton size="small" onClick={(e) => { e.stopPropagation(); goToCalendar(head); }}><CalendarMonth sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                    <Tooltip title="ดูรายละเอียดงาน"><IconButton size="small" onClick={(e) => { e.stopPropagation(); goToDetail(head); }}><ArrowForwardIos sx={{ fontSize: 13 }} /></IconButton></Tooltip>
                  </Stack>
                </>}
                extra={
                  <TextField
                    select fullWidth size="small" label="ผู้รับผิดชอบงาน" value={responsibleName}
                    disabled={isAssigning || busy || employees.length === 0}
                    onChange={(e) => handleAssignResponsible(sessions, e.target.value)}
                    InputLabelProps={{ shrink: true }} SelectProps={{ displayEmpty: true }}
                    helperText={isAssigning ? "กำลังบันทึก..." : responsibleName ? "" : "ควรเลือกก่อนอนุมัติ"}
                    FormHelperTextProps={{ sx: { m: 0, mt: 0.25, fontSize: "0.68rem", color: AMBER } }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: responsibleName ? "#fff" : alpha(AMBER, 0.05) } }}
                  >
                    <MenuItem value=""><em>— ยังไม่มอบหมาย —</em></MenuItem>
                    {employees.map((e) => <MenuItem key={e._id} value={e.fname}>{e.fname}</MenuItem>)}
                  </TextField>
                }
                actions={
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained" startIcon={<TaskAlt sx={{ fontSize: 17 }} />}
                      onClick={() => handleApprove(sessions)} disabled={busy || isAssigning}
                      sx={{ flex: 1, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d", boxShadow: "none" } }}
                    >
                      {busy ? "กำลังอนุมัติ..." : "อนุมัติ"}
                    </Button>
                    <Button
                      variant="outlined" color="error" startIcon={<Cancel sx={{ fontSize: 17 }} />}
                      onClick={() => { setRejectTarget(sessions); setRejectReason(""); }} disabled={busy || isAssigning}
                      sx={{ flex: 1, textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                    >
                      ไม่อนุมัติ
                    </Button>
                  </Stack>
                }
              />
            );
          })}
        </Stack>
      )}

      {/* ไม่อนุมัติล่าสุด — ข้อมูลอ้างอิง (ไม่มีปุ่มทำงาน) แถวกระชับแบบเดียวกับหมวด "ลงแผนงานแล้ว" ของฝั่งขาย */}
      {!loading && rejectedAll.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <SectionHead color="#dc2626" title="ไม่อนุมัติล่าสุด" count={rejectedAll.length}
            hint={rejectedAll.length > rejectedGroups.length ? `แสดง ${rejectedGroups.length} รายการล่าสุด` : "รอเจ้าของงานแก้ไขแล้วส่งใหม่"} />
          <RowGroup title="งานที่ไม่อนุมัติ" count={rejectedGroups.length} color="#dc2626" defaultOpen={showRejected}>
            {rejectedGroups.map((sessions) => {
              const head = sessions[0];
              return (
                <QueueRow
                  key={getOverdueGroupKey(head)} onOpen={() => goToDetail(head)} edge="#dc2626"
                  date={head.unscheduled ? null : head.start} dateTone={head.unscheduled ? "amber" : "grey"}
                  title={[head.company, head.site].filter(Boolean).join(" · ") || head.title || "งาน"}
                  sub={`${[head.title, head.system].filter(Boolean).join(" · ")} — ${head.approvalRejectReason ? `เหตุผล: ${head.approvalRejectReason}` : "ไม่ได้ระบุเหตุผล"}`}
                  right={<>
                    {head.responsiblePerson ? <PersonChip name={head.responsiblePerson} strong size={20} /> : <UnassignedChip />}
                    <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                      {head.approvalDecidedBy || "แอดมิน"}{head.approvalDecidedAt ? ` · ${moment(head.approvalDecidedAt).locale("th").fromNow()}` : ""}
                    </Typography>
                  </>}
                />
              );
            })}
          </RowGroup>
        </Box>
      )}

      {/* Dialog: ระบุเหตุผลที่ไม่อนุมัติ — เทียบ pattern เดียวกับกล่องไม่อนุมัติคำขอปิดงานใน
          Operation/index.js (rejectDialogOpen/handleReject) */}
      <Dialog open={Boolean(rejectTarget)} onClose={() => !rejecting && setRejectTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>ไม่อนุมัติงานนี้</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            ระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี) เพื่อแจ้งให้ผู้ส่งทราบและแก้ไข
          </DialogContentText>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            placeholder="เช่น ข้อมูลลูกค้ายังไม่ครบ กรุณาตรวจสอบก่อน"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)} disabled={rejecting}>ยกเลิก</Button>
          <Button variant="contained" color="error" onClick={handleRejectConfirm} disabled={rejecting}>
            {rejecting ? "กำลังบันทึก..." : "ยืนยันไม่อนุมัติ"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
