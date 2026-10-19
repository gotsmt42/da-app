/**
 * JobRequestQueue — "คำขอลงงาน" ของฝ่ายช่าง (แอดมิน/ผู้จัดการ)
 *
 * กล่องเดียวที่รวม "ทุกอย่างที่รอให้คนจัดคิวตัดสินใจ" ไว้ที่เดียว — มี 2 สายที่มาต่างกัน:
 *   • จากฝ่ายขาย   → ใบที่เซลกรอกฟอร์มแจ้งเข้ามา ยังไม่มีวันนัด ต้องตรวจแล้วจัดลงแผนงาน
 *   • จากฝ่ายช่าง  → แผนงานที่ช่างสร้างเองในปฏิทิน ต้องรอหัวหน้าอนุมัติก่อนถึงจะยืนยันจริง
 *
 * 🧹 ที่เปลี่ยนตามที่ผู้ใช้สั่ง:
 *   • เดิมชื่อ "ใบมอบหมายงาน" — เป็นคำที่มองจากฝั่งคนจ่ายงาน ทั้งที่สิ่งที่อยู่ในคิวจริงๆ คือ
 *     "คำขอ" ที่ยังไม่ได้ตัดสินใจ ยังไม่ใช่ใบมอบหมายจนกว่าจะอนุมัติ
 *   • เดิมแท็บ "รออนุมัติ" ซ่อนอยู่ในหน้า "การดำเนินงาน" ซึ่งเป็นหน้าไล่จัดการงานที่ *อนุมัติแล้ว* —
 *     คนละขั้นของงานกัน คนที่เข้าไปดูงานที่กำลังทำอยู่ไม่ได้กำลังหาคำขอที่รอตัดสินใจ
 *
 * ✅ (9 ต.ค. 2569 ผู้ใช้: "ปรับให้ดูง่ายขึ้น ไม่จำกัดแค่ว่าฝ่ายขาย หรือ ช่าง") เลิกแยกแท็บตามแผนกต้นทาง —
 *    หน้าเดียวเห็นทุกคำขอเรียงกัน: แผนงานรออนุมัติ (กดอนุมัติได้เลย) → ใบแจ้งงาน (เลือกวัน+ทีมให้)
 *    ใครแจ้งมาก็ได้ ชื่อผู้แจ้งอยู่บนการ์ดแต่ละใบ · ส่วนที่ไม่มีรายการจะซ่อนไป
 * ⚠️ สองส่วนดึงข้อมูลเองแยกกัน (DispatchList / PendingApprovalsPanel) — ไม่ได้แชร์ state
 * เพราะเป็นคนละคอลเลกชันคนละ endpoint ตัวเลขบนแท็บจึงต้องรับกลับขึ้นมาจากแต่ละแผงเอง
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import SectionTabs from "@/shared/ui/SectionTabs";
import { Navigate } from "react-router-dom";
import {
  Box, Stack, Typography, Skeleton, Alert, TextField, IconButton, Tooltip,
} from "@mui/material";
import { Inbox, Search, Close, Refresh } from "@mui/icons-material";
import { PageHeader } from "@/shared/ui/PageKit";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import DispatchList from "../components/DispatchList";
import DispatchService from "../services/DispatchService";
import { TEXT_SUB, BORDER_MAIN } from "../dispatchMeta";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";

// ⚠️ แผงนี้อยู่ใน feature "operation" เพราะเป็นเรื่องแผนงานของช่างโดยตรง — ไม่ย้ายไฟล์มาที่นี่
// เพื่อไม่ให้ประวัติ git ของมันขาดตอน แค่เรียกใช้ข้ามฟีเจอร์ (โหลดแบบ lazy เพราะเป็นแผงใหญ่)
const PendingApprovalsPanel = lazyWithRetry(() => import("@/features/operation/components/PendingApprovalsPanel"));

export default function JobRequestQueue() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const [summary, setSummary] = useState(null);
  const [approvalCount, setApprovalCount] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(async () => {
    try { setSummary(await DispatchService.summary()); }
    catch (err) { setError(err?.response?.data?.message || "โหลดสรุปไม่สำเร็จ"); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (!can("assignDispatch")) return <Navigate to="/dashboard" replace />;

  const waiting = summary?.byStatus?.requested ?? 0;
  const urgent = summary?.urgentOpen ?? 0;

  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      <SectionTabs group="intake" edge />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* ── หัวหน้าเพจ — กล่องขาวชุดเดียวกับทุกหน้า (shared/ui/PageKit) ตามกฎออกแบบ (ผู้ใช้สั่ง 2 ต.ค. 2569
          "ธีมและ UI ยังไม่สวย ไม่สอดคล้อง") — เดิมไอคอนส้มไล่สี + ป้ายตัวเลขลอยแถวใหม่ */}
      <PageHeader
        icon={<Inbox />}
        title="คำขอลงงาน"
        subtitle="คำขอจากทุกฝ่ายที่รอตัดสินใจก่อนเข้าตารางงานจริง"
        actions={(
          <Stack alignItems="flex-end" sx={{ pl: 1.5, borderLeft: `1px solid ${BORDER_MAIN}` }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 500, color: TEXT_SUB, whiteSpace: "nowrap" }}>รอตัดสินใจ</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {waiting + approvalCount}
              {urgent > 0 && <Box component="span" sx={{ ml: 0.75, fontSize: "0.74rem", fontWeight: 600, color: "#dc2626" }}>ด่วน {urgent}</Box>}
            </Typography>
          </Stack>
        )}
      />

      {/* ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าคำขอลงงานยังแปลกๆ ทำไมมีค้นหาบนล่าง จัดวางแปลกๆ ดูยาก")
          แถบค้นหา + รีเฟรช "อันเดียว" บนสุด ค้นได้ทั้งหน้า แล้วเรียงหมวดตามลำดับงาน:
            1) แผนงานรออนุมัติ (ซ่อนเมื่อไม่มี) → 2) ใบแจ้งงานรอลงแผนงาน → 3) ลงแผนงานแล้ว (พับได้) */}
      <Box sx={{ mb: 1.75, p: 1, display: "flex", gap: 0.75, alignItems: "center", bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px" }}>
        <TextField
          size="small" fullWidth placeholder="ค้นหางาน / โครงการ / ลูกค้า / เลขที่ใบ / ผู้ส่ง" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ fontSize: 18, color: TEXT_SUB, mr: 0.6 }} />,
            endAdornment: search ? <IconButton size="small" aria-label="ล้างคำค้น" onClick={() => setSearch("")} sx={{ p: 0.25 }}><Close sx={{ fontSize: 16 }} /></IconButton> : null,
          }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#f8fafc", height: 38, fontSize: "0.86rem", "& fieldset": { borderColor: "transparent" } } }}
        />
        <Tooltip title="โหลดข้อมูลใหม่">
          <IconButton onClick={() => { setRefreshKey((k) => k + 1); loadSummary(); }} aria-label="โหลดข้อมูลใหม่"
            sx={{ width: 38, height: 38, flexShrink: 0, border: "1px solid #e2e8f0", borderRadius: "10px", color: TEXT_SUB }}>
            <Refresh sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ⚠️ mount ไว้ตลอดเพื่อให้ได้จำนวน (onCountChange) แล้วค่อยซ่อนด้วย display */}
      <Box sx={{ display: approvalCount > 0 ? "block" : "none", mb: 2.5 }}>
        <Suspense fallback={<Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />}>
          <PendingApprovalsPanel active embedded search={search} refreshKey={refreshKey} onCountChange={setApprovalCount} />
        </Suspense>
      </Box>

      <DispatchList mode="board" embedded search={search} refreshKey={refreshKey} myId={String(userData?.userId || "")} />
    </Box>
  );
}
