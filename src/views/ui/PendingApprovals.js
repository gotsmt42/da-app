/**
 * PendingApprovals.js — "แผนงานรออนุมัติ" (เฉพาะแอดมิน/manager)
 *
 * จุดที่ขาดอยู่เดิม: งานที่ช่าง/เซล (ไม่ใช่แอดมิน/manager) ส่งเข้าระบบต้องรออนุมัติก่อน (ดู
 * utils/approvalStatus.js) แต่ไม่มีหน้ารวมให้ไล่อนุมัติทีละงาน — เห็นได้แค่กระจายอยู่บนปฏิทิน
 * (สีเทา/ลายทาง) หรือแผงงานล่วงหน้า (ป้ายเล็กๆ) ต้องเปิดทีละงานผ่าน EditEvent.js เท่านั้น
 * หน้านี้จึงรวมทุกงาน/แผนงานที่รออนุมัติมาไว้ที่เดียว อนุมัติ/ไม่อนุมัติได้ตรงนี้เลย
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import {
  Box, Stack, Typography, Chip, Button, IconButton, Tooltip, Skeleton, Collapse,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Refresh, HourglassTop, CheckCircle, Cancel, EventNote, CalendarMonth,
  ExpandMore, ExpandLess, ArrowForwardIos, TaskAlt,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import { useAuth } from "../../auth/AuthContext";
import EventService from "../../services/EventService";
import { isPendingApproval, isRejected } from "../../utils/approvalStatus";
import { getOverdueGroupKey } from "../../utils/overdueJobs";

export default function PendingApprovals() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const role = userData?.role?.toLowerCase();
  const isAdminOrManager = ["admin", "manager"].includes(role);

  const [events, setEvents] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [showRejected, setShowRejected] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // sessions[] ของกลุ่มที่กำลังจะไม่อนุมัติ
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // ✅ ใช้ getEvents() (GET /events, ไม่กรองตาม role) ไม่ใช่ getEventOp() — getEventOp กรองด้วย
  // $or:[{resPerson},{team},{userId}] สำหรับทุก role ที่ไม่ใช่ "admin" เป๊ะๆ (ดู routes/calendarEvent.js)
  // แปลว่า manager ที่มาอนุมัติงานจะเห็นแค่งานของตัวเอง งานที่คนอื่นส่งมาขออนุมัติจะหายไปหมด
  // ส่วน GET /events/drafts เช็ค isAdminOrManager ถูกต้องอยู่แล้ว — ทั้งสอง endpoint ตอบ 404 เมื่อไม่มี
  // ข้อมูลเลย (axios throw) จึงต้อง .catch() ทุกตัว — การอนุมัติจริงยังถูกกันซ้ำอีกชั้นที่ backend
  // (403 ถ้าไม่ใช่ admin/manager) หน้านี้เช็ค role แค่ฝั่ง UX เท่านั้น
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

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

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

  const rejectedGroups = useMemo(() => {
    return groupBy(all, isRejected).sort((a, b) =>
      new Date(b[0].approvalDecidedAt || 0) - new Date(a[0].approvalDecidedAt || 0)
    ).slice(0, 10); // ✅ ไม่ actionable แล้ว (backend 400 ถ้าไม่ใช่ pending) — โชว์แค่ล่าสุดพอ ไม่ให้รกจอ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

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

  const goToDetail = (head) => {
    if (head.unscheduled) {
      navigate(`/event?draft=${head._id}&month=${head.plannedMonth || ""}&t=${Date.now()}`);
    } else {
      navigate(`/operation/${head._id}`);
    }
  };

  // ✅ กันช่าง/เซลเปิดหน้านี้ตรงๆ ผ่าน URL — เทียบ pattern เดียวกับ TeamWorkload.js (AdminRoute เดิม
  // ไม่รองรับ manager จึงเช็ค role เองในนี้แทน) การอนุมัติจริงยังถูกกัน 403 ฝั่ง backend อยู่ดี
  if (!loading && !isAdminOrManager) return <Navigate to="/dashboard" replace />;

  const statTiles = [
    { label: "รอคุณอนุมัติ", value: pendingGroups.length, color: "#f59e0b", icon: <HourglassTop sx={{ fontSize: 16 }} /> },
    { label: "แผนล่วงหน้า", value: pendingDraftCount, color: "#0891b2", icon: <EventNote sx={{ fontSize: 16 }} /> },
    { label: "ลงตารางแล้ว", value: pendingScheduledCount, color: "#3b82f6", icon: <CalendarMonth sx={{ fontSize: 16 }} /> },
    { label: "ไม่อนุมัติล่าสุด", value: rejectedGroups.length, color: "#ef4444", icon: <Cancel sx={{ fontSize: 16 }} /> },
  ];

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 2, pb: 4, maxWidth: 820, mx: "auto" }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>แผนงานรออนุมัติ</Typography>
          <Typography variant="caption" color="text.secondary">
            {lastRefreshed ? `อัปเดตล่าสุด ${moment(lastRefreshed).locale("th").format("HH:mm:ss")}` : "กำลังโหลด..."}
          </Typography>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={() => fetchData()} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "50%", width: 40, height: 40 }}>
            <Refresh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* สรุปภาพรวม */}
      <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, mb: 2.5,
        p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
      }}>
        {statTiles.map((s, i) => (
          <Box key={i} sx={{ textAlign: "center" }}>
            <Box sx={{ color: s.color, mb: 0.25 }}>{s.icon}</Box>
            {loading ? <Skeleton width={28} sx={{ mx: "auto" }} /> : (
              <Typography fontWeight={800} fontSize="1.1rem">{s.value}</Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: 3 }} />)}
        </Stack>
      ) : pendingGroups.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
          <CheckCircle sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography variant="body2">ไม่มีแผนงานรออนุมัติ 🎉</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {pendingGroups.map((sessions) => {
            const head = sessions[0];
            const key = getOverdueGroupKey(head);
            const busy = busyKey === key;
            return (
              <Box key={key} sx={{
                p: 1.75, borderRadius: 3, border: "1px solid", borderColor: alpha("#f59e0b", 0.25),
                bgcolor: alpha("#f59e0b", 0.03),
              }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip size="small" label="⏳ รออนุมัติ" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#f59e0b", 0.15), color: "#92400e" }} />
                      {head.unscheduled && (
                        <Chip size="small" label="📌 ยังไม่ลงตาราง" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.15), color: "#0e7490" }} />
                      )}
                      {sessions.length > 1 && (
                        <Chip size="small" label={`เข้างาน ${sessions.length} วัน`} sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha("#64748b", 0.15), color: "#475569" }} />
                      )}
                    </Stack>
                    <Typography fontWeight={700} fontSize="0.92rem" noWrap>
                      {head.title || "งาน"} · {[head.company, head.site].filter(Boolean).join(" · ") || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3 }}>
                      {head.system ? `${head.system} · ` : ""}
                      {head.approvalRequestedBy || "ผู้ใช้"} ส่งขออนุมัติ
                      {head.approvalRequestedAt ? ` · ${moment(head.approvalRequestedAt).locale("th").fromNow()}` : ""}
                    </Typography>
                  </Box>
                  <Tooltip title="ดูรายละเอียด">
                    <IconButton size="small" onClick={() => goToDetail(head)} sx={{ flexShrink: 0 }}>
                      <ArrowForwardIos sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mt: 1.25 }}>
                  <Button
                    color="success" variant="contained" size="small"
                    startIcon={<TaskAlt sx={{ fontSize: 16 }} />}
                    onClick={() => handleApprove(sessions)}
                    disabled={busy}
                    sx={{ flex: 1, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                  >
                    {busy ? "กำลังอนุมัติ..." : "อนุมัติ"}
                  </Button>
                  <Button
                    color="error" variant="outlined" size="small"
                    startIcon={<Cancel sx={{ fontSize: 16 }} />}
                    onClick={() => { setRejectTarget(sessions); setRejectReason(""); }}
                    disabled={busy}
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
      {!loading && rejectedGroups.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Button
            onClick={() => setShowRejected((p) => !p)}
            endIcon={showRejected ? <ExpandLess /> : <ExpandMore />}
            sx={{ textTransform: "none", fontWeight: 700, color: "text.secondary" }}
          >
            ไม่อนุมัติล่าสุด ({rejectedGroups.length})
          </Button>
          <Collapse in={showRejected}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {rejectedGroups.map((sessions) => {
                const head = sessions[0];
                return (
                  <Box
                    key={getOverdueGroupKey(head)}
                    onClick={() => goToDetail(head)}
                    sx={{
                      p: 1.5, borderRadius: 2, border: "1px solid", borderColor: alpha("#ef4444", 0.25),
                      bgcolor: alpha("#ef4444", 0.03), cursor: "pointer",
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.3 }}>
                      <Chip size="small" label="❌ ไม่อนุมัติ" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#ef4444", 0.15), color: "#991b1b" }} />
                      <Typography fontWeight={700} fontSize="0.85rem" noWrap>
                        {head.title || "งาน"} · {[head.company, head.site].filter(Boolean).join(" · ") || "—"}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {head.approvalDecidedBy || "แอดมิน"} ไม่อนุมัติ
                      {head.approvalDecidedAt ? ` · ${moment(head.approvalDecidedAt).locale("th").fromNow()}` : ""}
                      {head.approvalRejectReason ? ` · เหตุผล: ${head.approvalRejectReason}` : ""}
                    </Typography>
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
