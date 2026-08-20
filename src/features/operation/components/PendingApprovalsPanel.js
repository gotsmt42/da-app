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
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Chip, Button, IconButton, Tooltip, Skeleton, Collapse, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Refresh, HourglassTop, CheckCircle, Cancel, EventNote, CalendarMonth,
  ExpandMore, ExpandLess, ArrowForwardIos, TaskAlt,
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
import InfoLine from "@/shared/ui/InfoLine";
import { formatThai } from "@/shared/utils/thaiDate";

export default function PendingApprovalsPanel({ onCountChange, active = true }) {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [showRejected, setShowRejected] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // sessions[] ของกลุ่มที่กำลังจะไม่อนุมัติ
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  // ✅ รายชื่อพนักงาน — ใช้เป็นตัวเลือกช่อง "ผู้รับผิดชอบ" ที่มอบหมายได้ตรงจากการ์ดนี้เลย
  const [employees, setEmployees] = useState([]);
  const [assigningKey, setAssigningKey] = useState(null);

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

  const pendingDraftCount = pendingGroups.filter((s) => s[0].unscheduled).length;
  const pendingScheduledCount = pendingGroups.length - pendingDraftCount;

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

  const hasPending = pendingGroups.length > 0;

  return (
    <Box>
      {/* ✅ แถบหัวแผง — เหลือแค่เวลาอัปเดต + ปุ่มรีเฟรช (ชื่อหน้าอยู่บนแท็บแล้ว ไม่ต้องเขียนซ้ำ) */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {lastRefreshed ? `อัปเดตล่าสุด ${moment(lastRefreshed).locale("th").format("HH:mm:ss")}` : "กำลังโหลด..."}
        </Typography>
        <Tooltip title="รีเฟรช">
          <IconButton
            onClick={() => fetchData()}
            size="small"
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: "50%" }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ✅ สรุปภาพรวม — ออกแบบใหม่ทั้งหมด
          ⚠️ ปัญหาของแบบเดิม (4 ช่องเท่ากันเรียงกัน): ตอนไม่มีงานรออนุมัติจะขึ้นเลข "0" ติดกัน 3 ช่องรวด
          (รอคุณอนุมัติ / ยังไม่ลงตาราง / ลงตารางแล้ว) ซึ่งไม่ได้สื่ออะไรเลยนอกจากรกตา แถมช่อง
          "ไม่อนุมัติ" สีแดงเด่นเท่ากันทั้งที่เป็นแค่ข้อมูลอ้างอิงย้อนหลัง (กดทำอะไรไม่ได้แล้ว) —
          พอตัวเลขหลักเป็น 0 แต่มีเลขแดง 1 เด่นอยู่ข้างๆ และตรงกลางจอเขียนว่า "ไม่มีแผนงานรออนุมัติ"
          ทั้งสามอย่างขัดกันเองจนอ่านไม่เข้าใจว่าตกลงมีงานหรือไม่มี
          ✅ แบบใหม่: เหลือ "ตัวเลขหลัก" ตัวเดียวคือจำนวนงานที่ต้องอนุมัติ (สิ่งเดียวที่ต้องลงมือทำ)
          ส่วนการแยกย่อย (ยังไม่ลงตาราง/ลงตารางแล้ว) เป็นข้อความเล็กใต้ตัวเลข และโชว์เฉพาะตอนมีงานจริง
          เท่านั้น — ไม่มีงาน = ไม่มีเลข 0 ให้อ่านเลยสักตัว และการ์ดเปลี่ยนเป็นโทนเขียว "เคลียร์แล้ว"
          ✅ "ไม่อนุมัติ" ลดเป็นข้อความอ้างอิงเล็กๆ ไม่ใช่การ์ดสีแดงระดับเดียวกับตัวเลขหลักอีกต่อไป */}
      {loading ? (
        <Skeleton variant="rounded" height={92} sx={{ borderRadius: 3, mb: 2.5 }} />
      ) : (
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1.75, mb: 2.5,
          p: { xs: 1.75, sm: 2 }, borderRadius: 3, border: "1px solid",
          borderColor: hasPending ? alpha("#f59e0b", 0.35) : alpha("#10b981", 0.3),
          bgcolor: hasPending ? alpha("#f59e0b", 0.05) : alpha("#10b981", 0.04),
        }}>
          <Box sx={{
            width: 46, height: 46, borderRadius: 2.5, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: hasPending ? alpha("#f59e0b", 0.15) : alpha("#10b981", 0.15),
            color: hasPending ? "#b45309" : "#059669",
          }}>
            {hasPending ? <HourglassTop sx={{ fontSize: 24 }} /> : <CheckCircle sx={{ fontSize: 24 }} />}
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="baseline" gap={0.75}>
              <Typography fontWeight={800} sx={{ fontSize: "1.6rem", lineHeight: 1.05, color: hasPending ? "#b45309" : "#059669" }}>
                {pendingGroups.length}
              </Typography>
              <Typography fontWeight={700} sx={{ fontSize: "0.9rem", color: "text.primary" }}>
                งานรอคุณอนุมัติ
              </Typography>
            </Stack>

            {/* ✅ แยกย่อยเฉพาะตอนมีงานจริง — และแสดงเฉพาะกลุ่มที่มีจำนวน > 0 ด้วย (ถ้ารออนุมัติ 3 งาน
                เป็นงานที่ลงตารางแล้วทั้งหมด ก็ไม่ต้องขึ้น "ยังไม่ลงตาราง 0" ให้อ่านเปล่าๆ) */}
            {hasPending ? (
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {pendingDraftCount > 0 && (
                  <Chip
                    size="small" icon={<EventNote sx={{ fontSize: 13 }} />}
                    label={`ยังไม่ลงตาราง ${pendingDraftCount}`}
                    sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.12), color: "#0e7490", "& .MuiChip-icon": { color: "#0e7490" } }}
                  />
                )}
                {pendingScheduledCount > 0 && (
                  <Chip
                    size="small" icon={<CalendarMonth sx={{ fontSize: 13 }} />}
                    label={`ลงตารางแล้ว ${pendingScheduledCount}`}
                    sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#3b82f6", 0.12), color: "#1d4ed8", "& .MuiChip-icon": { color: "#1d4ed8" } }}
                  />
                )}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                เคลียร์ครบแล้ว — งานที่ช่าง/เซลส่งเข้ามาใหม่จะมารอที่นี่
              </Typography>
            )}
          </Box>

          {/* ✅ ข้อมูลอ้างอิงย้อนหลัง — วางชิดขวา ตัวเล็ก โทนเทา ไม่แย่งความสนใจจากตัวเลขหลัก
              (กดแล้วเลื่อน/กางรายการด้านล่างให้เลย ไม่ใช่ป้ายตายที่กดไม่ได้เหมือนเดิม) */}
          {rejectedAll.length > 0 && (
            <Box
              onClick={() => setShowRejected(true)}
              sx={{
                flexShrink: 0, textAlign: "right", cursor: "pointer", px: 1, py: 0.5, borderRadius: 2,
                "&:hover": { bgcolor: alpha("#ef4444", 0.06) },
              }}
            >
              <Typography fontWeight={800} sx={{ fontSize: "1.1rem", lineHeight: 1.1, color: "#dc2626" }}>
                {rejectedAll.length}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem", whiteSpace: "nowrap" }}>
                ไม่อนุมัติ
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ⚠️ ตัดกล่อง "ไม่มีแผนงานรออนุมัติ 🎉" กลางจอออก — ซ้ำกับการ์ดสรุปด้านบนที่บอกไปแล้วว่า
          "0 งานรอคุณอนุมัติ · เคลียร์ครบแล้ว" การมีข้อความเดียวกัน 2 ที่พร้อมช่องว่างสูงๆ คั่นกลาง
          ทำให้หน้าดูโล่งผิดปกติและอ่านซ้ำโดยไม่ได้ข้อมูลเพิ่ม */}
      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: 3 }} />)}
        </Stack>
      ) : pendingGroups.length === 0 ? null : (
        <Stack spacing={1.5}>
          {pendingGroups.map((sessions) => {
            const head = sessions[0];
            const key = getOverdueGroupKey(head);
            const busy = busyKey === key;
            const companySite = [head.company, head.site].filter(Boolean).join(" · ");
            const jobClass = classifyJob(head);
            const jobClassMeta = getJobClassMeta(jobClass);
            // ✅ วันที่ที่วางแผนไว้ — ข้อมูลสำคัญที่สุดที่ขาดไปจากการ์ดเดิม: ผู้อนุมัติต้องรู้ว่า "งานนี้จะ
            // เข้าเมื่อไหร่" ถึงจะตัดสินใจได้ (ชนงานอื่นไหม/ทันกำหนดไหม) เดิมไม่แสดงเลยสักที่
            // ⚠️ งานที่ยังไม่ลงตาราง (draft) ไม่มีวันที่จริง มีแค่ "เดือนที่ตั้งใจ" (plannedMonth)
            const dateLabel = head.unscheduled
              ? (head.plannedMonth ? `แผนเดือน ${formatThai(moment(head.plannedMonth, "YYYY-MM").locale("th"), "MMMM YYYY")}` : "ยังไม่ระบุเดือน")
              : sessions.map((s) => formatEventDateRange(s)).join(", ");
            // ✅ ทีมที่เข้างานจากทุกวันของงานนี้ (แต่ละวันอาจคนละทีม) ตัดชื่อซ้ำออก
            const teamNames = [...new Set(
              sessions.flatMap((s) => [s.team, ...(s.teamMembers || []).map((m) => m?.name)]).filter(Boolean)
            )];
            const responsibleName = head.responsiblePerson || "";
            const isAssigning = assigningKey === key;
            return (
              <Box key={key} sx={{
                p: 1.75, borderRadius: 3, border: "1px solid", borderColor: alpha("#f59e0b", 0.3),
                bgcolor: alpha("#f59e0b", 0.03),
                transition: "border-color .15s, box-shadow .15s",
                "&:hover": { borderColor: alpha("#f59e0b", 0.55), boxShadow: "0 2px 10px rgba(245,158,11,.10)" },
              }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center" sx={{ mb: 0.6 }}>
                      <Chip size="small" label="⏳ รออนุมัติ" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#f59e0b", 0.15), color: "#92400e" }} />
                      {head.unscheduled && (
                        <Chip size="small" label="📌 ยังไม่ลงตาราง" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.15), color: "#0e7490" }} />
                      )}
                      {sessions.length > 1 && (
                        <Chip size="small" label={`เข้างาน ${sessions.length} วัน`} sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#64748b", 0.15), color: "#475569" }} />
                      )}
                      {head.system && (
                        <Chip size="small" label={head.system} variant="outlined" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600, color: "text.secondary" }} />
                      )}
                      {/* ✅ ประเภทงาน (สัญญา/โปรเจค/ทั่วไป) — ใช้ตัดสินใจต่างกัน งานสัญญาผูกกับรอบที่
                          ตกลงไว้กับลูกค้าแล้ว ปฏิเสธ/เลื่อนไม่ได้ง่ายเหมือนงานทั่วไป */}
                      {jobClassMeta && (
                        <Chip
                          size="small" label={`${jobClassMeta.emoji} ${jobClassMeta.label}`}
                          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(jobClassMeta.color, 0.15), color: jobClassMeta.color }}
                        />
                      )}
                    </Stack>
                    {/* ✅ แยกชื่องานกับบริษัท/โครงการเป็นคนละบรรทัด — เดิมต่อกันด้วย " · " ในบรรทัดเดียว
                        ที่ noWrap ทำให้บนมือถือถูกตัดหายตั้งแต่ชื่อบริษัท มองไม่เห็นว่าเป็นงานของที่ไหน */}
                    <Typography fontWeight={800} fontSize="0.95rem" noWrap sx={{ letterSpacing: "-0.01em" }}>
                      {head.title || "งาน"}
                    </Typography>

                    {/* ✅ ใช้บรรทัด "ไอคอน + ป้ายกำกับ + ค่า" ชุดเดียวกับการ์ดงานในแท็บ "รายการงาน"
                        (ไอคอน/ป้ายกำกับ/ลำดับเดียวกันเป๊ะ) ตามที่ผู้ใช้ขอให้แสดงข้อมูลสอดคล้องกัน */}
                    <Stack spacing={0.3} sx={{ mt: 0.6 }}>
                      {head.system && <InfoLine icon="💻" label="ระบบ">{head.system}</InfoLine>}
                      <InfoLine icon="🏢" label="โครงการ">{companySite || "ไม่ระบุบริษัท/ไซต์"}</InfoLine>
                      {head.time && (
                        <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(head.time, head.visitCount)}</InfoLine>
                      )}
                      <InfoLine icon="📅" label="วันที่">{dateLabel}</InfoLine>
                      {teamNames.length > 0 && (
                        <InfoLine icon="👷" label="ทีม">{teamNames.join(", ")}</InfoLine>
                      )}
                      <InfoLine icon="📨" label="ผู้ส่ง">
                        {head.approvalRequestedBy || "ผู้ใช้"}
                        {head.approvalRequestedAt ? ` · ${moment(head.approvalRequestedAt).locale("th").fromNow()}` : ""}
                      </InfoLine>
                    </Stack>
                  </Box>
                  {/* ✅ 2 ทางเข้าดูงาน: ปฏิทิน (เห็นบริบทว่าชนกับงานอื่นไหม) กับหน้ารายละเอียดงาน */}
                  <Stack direction="row" gap={0.25} sx={{ flexShrink: 0 }}>
                    <Tooltip title="ดูในปฏิทิน (เจาะจงงานนี้)">
                      <IconButton size="small" onClick={() => goToCalendar(head)}>
                        <CalendarMonth sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ดูรายละเอียดงาน">
                      <IconButton size="small" onClick={() => goToDetail(head)}>
                        <ArrowForwardIos sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                {/* ✅ มอบหมาย "ผู้รับผิดชอบงาน" ได้ตรงนี้ก่อนกดอนุมัติ — จุดที่ขาดอยู่เดิมและตกหล่นบ่อย:
                    งานที่เซล/ช่างส่งเข้ามามักยังไม่มีผู้รับผิดชอบ เพราะคนส่งไม่มีสิทธิ์มอบหมายเอง
                    (backend ตอบ 403) แอดมินจึงต้องอนุมัติไปก่อนแล้วค่อยไปตามหางานนั้นในหน้าอื่นทีหลัง
                    ⚠️ เตือนให้เห็นชัดเมื่อยังไม่มอบหมาย — งานที่ไม่มีผู้รับผิดชอบจะไม่มีใครถูกแจ้งเตือน
                    และหลุดจากตัวกรอง "งานของฉัน" ของทุกคน กลายเป็นงานลอยที่ไม่มีใครดูแลจริงๆ */}
                <Box sx={{
                  mt: 1.25, p: 1.25, borderRadius: 2,
                  bgcolor: responsibleName ? alpha("#10b981", 0.06) : alpha("#ef4444", 0.05),
                  border: "1px solid",
                  borderColor: responsibleName ? alpha("#10b981", 0.25) : alpha("#ef4444", 0.25),
                }}>
                  <TextField
                    select fullWidth size="small"
                    label="ผู้รับผิดชอบงาน"
                    value={responsibleName}
                    disabled={isAssigning || busy || employees.length === 0}
                    onChange={(e) => handleAssignResponsible(sessions, e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    SelectProps={{ displayEmpty: true }}
                    helperText={
                      isAssigning
                        ? "กำลังบันทึก..."
                        : responsibleName
                        ? "มอบหมายแล้ว — เปลี่ยนได้ที่นี่"
                        : "⚠️ ยังไม่มอบหมาย — ควรเลือกก่อนอนุมัติ ไม่งั้นจะไม่มีใครได้รับแจ้งเตือนงานนี้"
                    }
                    FormHelperTextProps={{
                      sx: { fontSize: "0.68rem", m: 0, mt: 0.5, color: responsibleName ? "text.secondary" : "#b91c1c" },
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "background.paper" } }}
                  >
                    <MenuItem value=""><em>— ยังไม่มอบหมาย —</em></MenuItem>
                    {employees.map((e) => (
                      <MenuItem key={e._id} value={e.fname}>{e.fname}</MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mt: 1.25 }}>
                  <Button
                    color="success" variant="contained" size="small"
                    startIcon={<TaskAlt sx={{ fontSize: 16 }} />}
                    onClick={() => handleApprove(sessions)}
                    disabled={busy || isAssigning}
                    sx={{ flex: 1, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                  >
                    {busy ? "กำลังอนุมัติ..." : "อนุมัติ"}
                  </Button>
                  <Button
                    color="error" variant="outlined" size="small"
                    startIcon={<Cancel sx={{ fontSize: 16 }} />}
                    onClick={() => { setRejectTarget(sessions); setRejectReason(""); }}
                    disabled={busy || isAssigning}
                    sx={{ flex: 1, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                  >
                    ไม่อนุมัติ
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* ไม่อนุมัติล่าสุด — เก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น (กด "ยกเลิก" ไปแล้วต้องรอเจ้าของงานแก้ไข
          ส่งกลับเข้าคิวเอง ระบบจะพากลับมาที่ลิสต์ด้านบนอัตโนมัติ) จึงไม่มีปุ่มกดใดๆ ในนี้ */}
      {!loading && rejectedAll.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 1 }} />
          <Button
            onClick={() => setShowRejected((p) => !p)}
            endIcon={showRejected ? <ExpandLess /> : <ExpandMore />}
            sx={{ textTransform: "none", fontWeight: 700, color: "text.secondary" }}
          >
            {/* ✅ บอกให้ชัดว่ากำลังแสดงกี่รายการจากทั้งหมดเท่าไหร่ เมื่อรายการถูกตัด — เดิมขึ้นแค่ตัวเลข
                ที่ตัดแล้ว ทำให้เข้าใจว่ามีเท่านั้นจริงๆ */}
            ไม่อนุมัติล่าสุด{" "}
            {rejectedAll.length > rejectedGroups.length
              ? `(แสดง ${rejectedGroups.length} จาก ${rejectedAll.length})`
              : `(${rejectedAll.length})`}
          </Button>
          <Collapse in={showRejected}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {/* ✅ แสดงรายละเอียดให้ครบเท่าการ์ดรออนุมัติด้านบน (ตามที่ผู้ใช้ขอ) — เดิมมีแค่ชื่องาน
                  ต่อกันยาวบรรทัดเดียวกับบริษัท/โครงการแบบ noWrap (ตัดหายบนมือถือ) + คนไม่อนุมัติ/เหตุผล
                  ยัดรวมเป็นข้อความก้อนเดียว อ่านยากและไม่รู้ว่างานนี้คือวันไหน ครั้งที่เท่าไหร่ ใครเข้า
                  ⚠️ "เหตุผลที่ไม่อนุมัติ" คือข้อมูลสำคัญที่สุดของการ์ดนี้ (เจ้าของงานต้องเอาไปแก้)
                  จึงแยกออกมาเป็นกล่องของตัวเองให้เห็นชัด ไม่ใช่ต่อท้ายบรรทัดอื่นจนกลืนหาย */}
              {rejectedGroups.map((sessions) => {
                const head = sessions[0];
                const rCompanySite = [head.company, head.site].filter(Boolean).join(" · ");
                const rJobClassMeta = getJobClassMeta(classifyJob(head));
                const rDateLabel = head.unscheduled
                  ? (head.plannedMonth ? `แผนเดือน ${formatThai(moment(head.plannedMonth, "YYYY-MM").locale("th"), "MMMM YYYY")}` : "ยังไม่ระบุเดือน")
                  : sessions.map((s) => formatEventDateRange(s)).join(", ");
                const rTeamNames = [...new Set(
                  sessions.flatMap((s) => [s.team, ...(s.teamMembers || []).map((m) => m?.name)]).filter(Boolean)
                )];
                return (
                  <Box
                    key={getOverdueGroupKey(head)}
                    sx={{
                      p: 1.5, borderRadius: 2, border: "1px solid", borderColor: alpha("#ef4444", 0.25),
                      bgcolor: alpha("#ef4444", 0.03),
                      "&:hover": { borderColor: alpha("#ef4444", 0.5) },
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                      <Box minWidth={0} flex={1}>
                        <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center" sx={{ mb: 0.5 }}>
                          <Chip size="small" label="❌ ไม่อนุมัติ" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#ef4444", 0.15), color: "#991b1b" }} />
                          {head.unscheduled && (
                            <Chip size="small" label="📌 ยังไม่ลงตาราง" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.15), color: "#0e7490" }} />
                          )}
                          {sessions.length > 1 && (
                            <Chip size="small" label={`เข้างาน ${sessions.length} วัน`} sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#64748b", 0.15), color: "#475569" }} />
                          )}
                          {head.system && (
                            <Chip size="small" label={head.system} variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 600, color: "text.secondary" }} />
                          )}
                          {rJobClassMeta && (
                            <Chip size="small" label={`${rJobClassMeta.emoji} ${rJobClassMeta.label}`}
                              sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(rJobClassMeta.color, 0.15), color: rJobClassMeta.color }} />
                          )}
                        </Stack>

                        <Typography fontWeight={800} fontSize="0.9rem" noWrap sx={{ letterSpacing: "-0.01em" }}>
                          {head.title || "งาน"}
                        </Typography>

                        {/* ✅ ชุดบรรทัดข้อมูลเดียวกับการ์ดรออนุมัติด้านบนและการ์ดงานในแท็บ "รายการงาน" */}
                        <Stack spacing={0.3} sx={{ mt: 0.6 }}>
                          {head.system && <InfoLine icon="💻" label="ระบบ">{head.system}</InfoLine>}
                          <InfoLine icon="🏢" label="โครงการ">{rCompanySite || "ไม่ระบุบริษัท/ไซต์"}</InfoLine>
                          {head.time && (
                            <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(head.time, head.visitCount)}</InfoLine>
                          )}
                          <InfoLine icon="📅" label="วันที่">{rDateLabel}</InfoLine>
                          {rTeamNames.length > 0 && (
                            <InfoLine icon="👷" label="ทีม">{rTeamNames.join(", ")}</InfoLine>
                          )}
                          <InfoLine icon="👤" label="ผู้รับผิดชอบ">
                            {head.responsiblePerson || "— ยังไม่มอบหมาย —"}
                          </InfoLine>
                        </Stack>
                      </Box>
                      <Stack direction="row" gap={0.25} sx={{ flexShrink: 0 }}>
                        <Tooltip title="ดูในปฏิทิน (เจาะจงงานนี้)">
                          <IconButton size="small" onClick={() => goToCalendar(head)}>
                            <CalendarMonth sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ดูรายละเอียดงาน">
                          <IconButton size="small" onClick={() => goToDetail(head)}>
                            <ArrowForwardIos sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {/* ✅ เหตุผลที่ไม่อนุมัติ — แยกเป็นกล่องของตัวเอง เพราะเป็นสิ่งที่เจ้าของงานต้องเอาไป
                        แก้ไขจริง ไม่ควรกลืนไปกับบรรทัดข้อมูลอื่น */}
                    <Box sx={{ mt: 1, pt: 1, borderTop: "1px dashed", borderColor: alpha("#ef4444", 0.25) }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {head.approvalDecidedBy || "แอดมิน"} ไม่อนุมัติ
                        {head.approvalDecidedAt ? ` · ${moment(head.approvalDecidedAt).locale("th").fromNow()}` : ""}
                      </Typography>
                      {head.approvalRejectReason ? (
                        <Typography variant="caption" sx={{ display: "block", mt: 0.25, color: "#991b1b", fontWeight: 600 }}>
                          เหตุผล: {head.approvalRejectReason}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ display: "block", mt: 0.25, color: "text.disabled", fontStyle: "italic" }}>
                          ไม่ได้ระบุเหตุผล
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Collapse>
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
