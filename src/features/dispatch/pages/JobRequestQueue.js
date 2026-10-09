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
import { Navigate } from "react-router-dom";
import {
  Box, Stack, Typography, Skeleton, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Inbox, AssignmentOutlined, HourglassTop } from "@mui/icons-material";
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

/** หัวข้อแต่ละส่วน — ไอคอนสี · ชื่อ · จำนวน · คำอธิบายสั้น */
function SectionHead({ icon, color, title, count, hint }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25, px: 0.25 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.12), color, flexShrink: 0, "& svg": { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: "#0f172a" }}>
          {title}
          {count > 0 && <Box component="span" sx={{ ml: 0.75, px: 0.9, py: 0.1, borderRadius: 99, fontSize: "0.76rem", fontWeight: 800, color, bgcolor: alpha(color, 0.12) }}>{count}</Box>}
        </Typography>
        <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{hint}</Typography>
      </Box>
    </Stack>
  );
}

export default function JobRequestQueue() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const [summary, setSummary] = useState(null);
  const [approvalCount, setApprovalCount] = useState(0);
  const [error, setError] = useState("");

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
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* ── หัวหน้าเพจ — กล่องขาวชุดเดียวกับทุกหน้า (shared/ui/PageKit) ตามกฎออกแบบ (ผู้ใช้สั่ง 2 ต.ค. 2569
          "ธีมและ UI ยังไม่สวย ไม่สอดคล้อง") — เดิมไอคอนส้มไล่สี + ป้ายตัวเลขลอยแถวใหม่ */}
      <PageHeader
        icon={<Inbox />}
        title="คำขอลงงาน"
        subtitle="คำขอจากทุกฝ่ายที่รอตัดสินใจก่อนเข้าตารางงานจริง"
        actions={(
          <Stack alignItems="flex-end" sx={{ pl: 1.5, borderLeft: `1px solid ${BORDER_MAIN}` }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: TEXT_SUB, whiteSpace: "nowrap" }}>รอตัดสินใจ</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: "#0f172a", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {waiting + approvalCount}
              {urgent > 0 && <Box component="span" sx={{ ml: 0.75, fontSize: "0.74rem", fontWeight: 800, color: "#dc2626" }}>ด่วน {urgent}</Box>}
            </Typography>
          </Stack>
        )}
      />

      {/* ✅ แผนงานรออนุมัติ — งานที่มีวันนัดแล้ว แค่กดอนุมัติ/ไม่อนุมัติ (ซ่อนส่วนนี้เมื่อไม่มีรายการ)
          ⚠️ mount ไว้ตลอดเพื่อให้ได้จำนวน (onCountChange) แล้วค่อยซ่อนด้วย display */}
      <Box sx={{ display: approvalCount > 0 ? "block" : "none", mb: 3 }}>
        <SectionHead icon={<HourglassTop />} color="#d97706" title="แผนงานรออนุมัติ" count={approvalCount}
          hint="ลงวันในตารางไว้แล้ว — ตรวจแล้วกดอนุมัติ หรือไม่อนุมัติพร้อมเหตุผล" />
        <Suspense fallback={<Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />}>
          <PendingApprovalsPanel active onCountChange={setApprovalCount} />
        </Suspense>
      </Box>

      {/* ✅ ใบแจ้งงาน — ใครแจ้งมาก็ได้ (ชื่อผู้แจ้งอยู่บนการ์ด) ยังไม่มีวันนัด ต้องเลือกวัน + ทีมให้ */}
      <SectionHead icon={<AssignmentOutlined />} color="#2563eb" title="ใบแจ้งงาน" count={waiting}
        hint={`แจ้งเข้ามาแล้ว ยังไม่มีวันนัด — ตรวจแล้วเลือกวันและทีมให้${urgent > 0 ? ` · ด่วน ${urgent} ใบ` : ""}`} />
      <DispatchList mode="board" myId={String(userData?.userId || "")} />
    </Box>
  );
}
