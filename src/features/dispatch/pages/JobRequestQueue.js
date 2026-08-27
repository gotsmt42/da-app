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
 * ⚠️ ทั้งสองแท็บดึงข้อมูลเองแยกกัน (DispatchList / PendingApprovalsPanel) — ไม่ได้แชร์ state
 * เพราะเป็นคนละคอลเลกชันคนละ endpoint ตัวเลขบนแท็บจึงต้องรับกลับขึ้นมาจากแต่ละแผงเอง
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Box, Stack, Typography, Tabs, Tab, Badge, Skeleton, Alert, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Inbox, Storefront, HourglassTop, Bolt } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import DispatchList from "../components/DispatchList";
import DispatchService from "../services/DispatchService";
import { DISPATCH_ACCENT, TEXT_SUB, BORDER_MAIN } from "../dispatchMeta";

// ⚠️ แผงนี้อยู่ใน feature "operation" เพราะเป็นเรื่องแผนงานของช่างโดยตรง — ไม่ย้ายไฟล์มาที่นี่
// เพื่อไม่ให้ประวัติ git ของมันขาดตอน แค่เรียกใช้ข้ามฟีเจอร์ (โหลดแบบ lazy เพราะเป็นแผงใหญ่)
const PendingApprovalsPanel = lazy(() => import("@/features/operation/components/PendingApprovalsPanel"));

const ACCENT_DEEP = "#b45309"; // amber-800 — เข้าชุดกับสีตัวเลข "รอตัดสินใจ" เดิมของหน้านี้อยู่แล้ว

const SOURCES = [
  {
    key: "sales",
    label: "จากฝ่ายขาย",
    icon: <Storefront sx={{ fontSize: 18 }} />,
    color: "#8b5cf6",
    hint: "เซลกรอกฟอร์มแจ้งเข้ามา — ตรวจแล้วจัดลงแผนงานให้",
  },
  {
    key: "approvals",
    label: "จากฝ่ายช่าง",
    icon: <HourglassTop sx={{ fontSize: 18 }} />,
    color: "#f59e0b",
    hint: "ช่างสร้างแผนงานเอง — ต้องอนุมัติก่อนถึงจะยืนยันจริง",
  },
];

export default function JobRequestQueue() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [approvalCount, setApprovalCount] = useState(0);
  const [error, setError] = useState("");

  const requested = searchParams.get("tab");
  const activeKey = SOURCES.some((s) => s.key === requested) ? requested : "sales";
  const active = SOURCES.find((s) => s.key === activeKey);

  const loadSummary = useCallback(async () => {
    try { setSummary(await DispatchService.summary()); }
    catch (err) { setError(err?.response?.data?.message || "โหลดสรุปไม่สำเร็จ"); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ⚠️ replace:true — สลับแท็บไม่ควรทิ้งประวัติไว้ทุกครั้ง ไม่งั้นกด back หลังสลับไปมา 5 รอบ
  // ต้องกดย้อน 5 ครั้งกว่าจะออกจากหน้านี้ได้ (แบบแผนเดียวกับ TabbedPage.js)
  const changeTab = (_, key) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  if (!can("assignDispatch")) return <Navigate to="/dashboard" replace />;

  const waiting = summary?.byStatus?.requested ?? 0;
  const urgent = summary?.urgentOpen ?? 0;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 1500, mx: "auto" }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* ✅ ที่แก้ (ผู้ใช้ขอ: "ปรับแต่งในส่วนของแอดมินด้วย ให้ UI ทันสมัย สวยงาม ดูง่าย ใช้งานง่าย
          และมืออาชีพ"): เดิมหัวหน้าเพจเป็นกล่องไอคอนจางๆ บนพื้นขาวเหมือนกับที่เพิ่งปรับของฝั่งเซลไป
          — ยกเป็น hero ไล่สีเช่นกัน แต่ใช้สีส้ม/อำพัน (DISPATCH_ACCENT) แทนม่วง เพื่อให้ "หน้าคิวของ
          หัวหน้า" มีอัตลักษณ์ของตัวเอง แยกจาก "หน้าแจ้งงานของเซล" ที่เป็นม่วง แม้ใช้ list เดียวกันข้างใน
          ก็ตาม — ตัวเลขด่วน/รอตัดสินใจย้ายไปเป็นชิปลอยบนพื้นสีแทนที่จะแยกอยู่ข้างๆ หัวข้อเฉยๆ */}
      <Box
        sx={{
          position: "relative", overflow: "hidden",
          borderRadius: 4, p: { xs: 2, sm: 2.75 }, mb: 2.5,
          background: `linear-gradient(135deg, ${DISPATCH_ACCENT} 0%, ${ACCENT_DEEP} 100%)`,
          color: "#fff",
        }}
      >
        <Box sx={{ position: "absolute", right: -40, top: -60, width: 200, height: 200, borderRadius: "50%", bgcolor: alpha("#fff", 0.08) }} />
        <Box sx={{ position: "absolute", right: 60, bottom: -80, width: 140, height: 140, borderRadius: "50%", bgcolor: alpha("#fff", 0.06) }} />

        <Stack
          direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}
          sx={{ position: "relative" }} flexWrap="wrap" useFlexGap
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                bgcolor: alpha("#fff", 0.16), display: "flex", alignItems: "center", justifyContent: "center",
                border: "1.5px solid", borderColor: alpha("#fff", 0.3),
              }}
            >
              <Inbox sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.4rem" }, lineHeight: 1.2 }}>
                คำขอลงงาน
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                ทุกอย่างที่รอให้คุณตัดสินใจก่อนเข้าตารางงานจริง
              </Typography>
            </Box>
          </Stack>
          {/* ✅ ตัวเลขที่ต้องรู้ก่อนกดเข้าไปดู — งานด่วนต้องเด่นกว่าจำนวนรวมเสมอ */}
          <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
            {urgent > 0 && (
              <Chip
                icon={<Bolt sx={{ fontSize: 15 }} />} label={`ด่วน ${urgent}`}
                sx={{ height: 30, fontWeight: 800, bgcolor: "#fff", color: "#dc2626", "& .MuiChip-icon": { color: "inherit" } }}
              />
            )}
            <Chip
              label={`รอตัดสินใจ ${waiting + approvalCount}`}
              sx={{ height: 30, fontWeight: 800, bgcolor: alpha("#fff", 0.18), color: "#fff", border: "1px solid", borderColor: alpha("#fff", 0.32) }}
            />
          </Stack>
        </Stack>
      </Box>

      {/* ── แท็บตาม "ที่มาของคำขอ" ─────────────────────────────────────────
          ⚠️ แยกตามแผนกต้นทาง ไม่ใช่ตามสถานะ — คนจัดคิวคิดเป็น "ของใครส่งมา" เพราะสองสายนี้
          ตัดสินใจคนละแบบ (ของเซลต้องเลือกวัน+ช่างให้ · ของช่างแค่กดอนุมัติ/ไม่อนุมัติ)
          ✅ ยกเป็นการ์ดขอบมนมีเงาแทนเส้นใต้เปล่าๆ — เข้าชุดกับแผงเครื่องมือของ DispatchList ข้างล่าง */}
      <Box
        sx={{
          borderRadius: 3, mb: 2, bgcolor: "#fff", border: "1px solid", borderColor: BORDER_MAIN,
          boxShadow: "0 1px 2px rgba(15, 23, 42, .05)", overflow: "hidden",
        }}
      >
        <Tabs
          value={activeKey} onChange={changeTab}
          variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
          sx={{
            minHeight: 46, px: 0.5,
            "& .MuiTab-root": {
              textTransform: "none", fontWeight: 700,
              fontSize: { xs: "0.78rem", sm: "0.88rem" },
              minHeight: 46, color: TEXT_SUB, gap: { xs: 0.5, sm: 1 },
              minWidth: 0, px: { xs: 1.25, sm: 2.5 },
            },
            "& .Mui-selected": { color: `${active.color} !important` },
            "& .MuiTabs-indicator": { backgroundColor: active.color, height: 3, borderRadius: 2 },
          }}
        >
          {SOURCES.map((s) => {
            const count = s.key === "sales" ? waiting : approvalCount;
            return (
              <Tab
                key={s.key} value={s.key} iconPosition="start" label={s.label}
                icon={
                  <Badge
                    badgeContent={count} color="warning" invisible={count === 0}
                    sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 15, minWidth: 15 } }}
                  >
                    {s.icon}
                  </Badge>
                }
              />
            );
          })}
        </Tabs>
      </Box>

      {/* คำอธิบายว่าแท็บนี้คืออะไร — สองสายนี้หน้าตาคล้ายกันแต่ทำคนละอย่าง ถ้าไม่บอกจะสับสน
          ✅ ไอคอนย้ายเข้าวงกลมพื้นสีอ่อน เข้าชุดกับ pattern ไอคอน-ในวงกลมที่ใช้ทั้งแอปตอนนี้ */}
      <Stack
        direction="row" alignItems="center" spacing={1.25}
        sx={{
          mb: 2, px: 1.75, py: 1.1, borderRadius: 2.5,
          bgcolor: alpha(active.color, 0.07),
          border: "1px solid", borderColor: alpha(active.color, 0.2),
        }}
      >
        <Box
          sx={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            bgcolor: alpha(active.color, 0.15), color: active.color,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {active.icon}
        </Box>
        <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>{active.hint}</Typography>
      </Stack>

      {/* ⚠️ ต้อง mount แผงรออนุมัติไว้ตลอด แล้วซ่อนด้วย display แทนการถอดออกจาก DOM —
          ตัวเลขบน badge มาจากแผงนั้นเอง ถ้า unmount ตอนอยู่แท็บอื่น badge จะเป็น 0 เสมอ
          จนกว่าจะกดเข้าไปดู ซึ่งทำให้ badge ไร้ประโยชน์ทั้งหมด (แบบแผนเดียวกับที่ OperationBoard
          เคยใช้ตอนแผงนี้ยังเป็นแท็บอยู่ที่นั่น) ส่วน prop active หยุดรีเฟรชอัตโนมัติเมื่อไม่ได้เปิดอยู่
          จึงไม่ได้แลกมาด้วยการยิง request ทิ้ง */}
      <Box sx={{ display: activeKey === "sales" ? "block" : "none" }}>
        <DispatchList mode="board" myId={String(userData?.userId || "")} />
      </Box>
      <Box sx={{ display: activeKey === "approvals" ? "block" : "none" }}>
        <Suspense fallback={<Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />}>
          <PendingApprovalsPanel active={activeKey === "approvals"} onCountChange={setApprovalCount} />
        </Suspense>
      </Box>
    </Box>
  );
}
