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
  Box, Stack, Typography, Tabs, Tab, Badge, Skeleton, Alert,
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

      {/* ── หัวหน้าเพจ ────────────────────────────────────────────────────
          ✅ ที่แก้ (ผู้ใช้แจ้งว่า "ดูรกตามาก"): เดิมเป็นแถบไล่สีส้มเต็มความกว้างพร้อมวงกลมตกแต่ง —
          เป็นก้อนสีที่หนักที่สุดบนหน้าทั้งที่เป็นแค่ป้ายชื่อหน้า และหน้านี้มีแถบซ้อนใต้มันอีก 3 ชั้น
          (แท็บ → คำอธิบาย → เครื่องมือ) กว่าจะถึงข้อมูลจริง
          ✅ เหลือหัวข้อ + ไอคอนสีจาง + ตัวเลขค้างเป็นตัวหนังสือ (ไม่ใช่ชิปพื้นสี) */}
      <Stack
        direction="row" alignItems="center" spacing={1.5}
        sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap
      >
        {/* ⚠️ จอมือถือ: ไอคอน+หัวข้ออยู่แถวเดียวกันเสมอ (ห่อไว้ด้วยกัน) แล้วตัวเลขค้างตกลงแถวถัดไป
            — ถ้าไม่ห่อ ไอคอนจะถูกดันไปลอยอยู่บรรทัดของตัวเองเมื่อหัวข้อกินเต็มแถว */}
        <Stack
          direction="row" alignItems="center" spacing={1.5}
          sx={{ flex: 1, minWidth: 0, flexBasis: { xs: "100%", sm: "auto" } }}
        >
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 2, flexShrink: 0,
              bgcolor: alpha(DISPATCH_ACCENT, 0.12), color: DISPATCH_ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Inbox sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.15rem", sm: "1.3rem" }, lineHeight: 1.25, color: "#0f172a" }}>
              คำขอลงงาน
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              ทุกอย่างที่รอให้คุณตัดสินใจก่อนเข้าตารางงานจริง
            </Typography>
          </Box>
        </Stack>
        {/* ตัวเลขค้าง — เป็นตัวหนังสือ ไม่ใช่ชิปพื้นสี งานด่วนใช้สีแดงพอให้เด่นโดยไม่ต้องมีพื้น */}
        <Stack direction="row" alignItems="center" spacing={1.75} sx={{ flexShrink: 0 }}>
          {urgent > 0 && (
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <Bolt sx={{ fontSize: 16, color: "#dc2626" }} />
              <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color: "#dc2626" }}>ด่วน {urgent}</Typography>
            </Stack>
          )}
          <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: TEXT_SUB }}>
            รอตัดสินใจ <Box component="span" sx={{ color: "#0f172a", fontWeight: 800 }}>{waiting + approvalCount}</Box>
          </Typography>
        </Stack>
      </Stack>

      {/* ── แท็บตาม "ที่มาของคำขอ" ─────────────────────────────────────────
          ⚠️ แยกตามแผนกต้นทาง ไม่ใช่ตามสถานะ — คนจัดคิวคิดเป็น "ของใครส่งมา" เพราะสองสายนี้
          ตัดสินใจคนละแบบ (ของเซลต้องเลือกวัน+ช่างให้ · ของช่างแค่กดอนุมัติ/ไม่อนุมัติ) */}
      {/* ✅ แท็บกลับมาเป็นเส้นใต้เรียบ — เดิมครอบด้วยการ์ดขาวมีขอบ+เงา ซึ่งบวกกับแถบคำอธิบาย
          ด้านล่างและแถบเครื่องมือ กลายเป็นกล่อง 3 ใบซ้อนกันก่อนถึงรายการจริง */}
      <Box sx={{ mb: 2, borderBottom: "1px solid", borderColor: BORDER_MAIN }}>
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
      {/* ✅ คำอธิบายแท็บเหลือบรรทัดตัวหนังสือจางๆ — เดิมเป็นแถบพื้นสี+ขอบสี+วงกลมไอคอนสี
          ซึ่งเป็นสีเดียวกับแท็บที่เพิ่งกดอยู่ข้างบน = ย้ำเรื่องเดิมด้วยสีเดิมสองรอบติดกัน */}
      <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mb: 2, px: 0.25 }}>
        {active.hint}
      </Typography>

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
