/**
 * JobRequestQueue — "คำขอลงงาน · รออนุมัติ" ของฝ่ายช่าง (แอดมิน/ผู้จัดการ)
 *
 * กล่องเดียวที่รวม "ทุกอย่างที่รอให้คนจัดคิวตัดสินใจ" — 2 สายที่มาต่างกัน:
 *   • แผนงานที่ช่างสร้างเองในปฏิทิน → รอหัวหน้าอนุมัติก่อนยืนยันจริง (PendingApprovalsPanel)
 *   • ใบแจ้งงานจากทุกฝ่าย (ยังไม่มีวันนัด) → ตรวจแล้วจัดลงแผนงาน (DispatchList)
 *
 * 🔁 (21 ต.ค. 2569 ผู้ใช้: "แก้ไขหน้าคำขอลงงานให้ UX/UI สอดคล้อง สีสัน การจัดวาง ทุกขนาดจอ · ขนาดเท่ากับหน้ารับงาน")
 *    รูปแบบเดียวกับหน้ารับงาน: แท็บตามขั้น (ตัวเลขบนแท็บ) · ช่องค้นหาขาว · เต็มความกว้าง · หน้าว่างแบบเดียวกัน
 *    เดิมเป็นหัวข้อจุดสีเรียงลงมา 3 หมวด + ช่องค้นหาพื้นเทาซ้อนในกล่อง (คนละแบบกับหน้ารับงาน)
 * ⚠️ สองแผงดึงข้อมูลเองแยกกัน (คนละ endpoint) — ตัวเลขบนแท็บรับกลับขึ้นมาจากแต่ละแผง
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import SectionTabs from "@/shared/ui/SectionTabs";
import { Navigate } from "react-router-dom";
import { Box, Stack, Skeleton, Alert, IconButton, Tooltip, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Inbox, Search, Close, Refresh, TaskAlt } from "@mui/icons-material";
import { PageHeader, PAGE_SX, EmptyState, INK, MUTED, LINE, ACCENT, SURFACE } from "@/shared/ui/PageKit";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import DispatchList from "../components/DispatchList";
import DispatchService from "../services/DispatchService";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";

// ⚠️ แผงนี้อยู่ใน feature "operation" เพราะเป็นเรื่องแผนงานของช่างโดยตรง — เรียกใช้ข้ามฟีเจอร์
const PendingApprovalsPanel = lazyWithRetry(() => import("@/features/operation/components/PendingApprovalsPanel"));

const TABS = [
  { key: "approve", label: "แผนงานรออนุมัติ", short: "รออนุมัติ" },
  { key: "waiting", label: "รอลงแผนงาน", short: "รอลงแผน" },
  { key: "assigned", label: "ลงแผนงานแล้ว", short: "ลงแล้ว" },
];

export default function JobRequestQueue() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const [summary, setSummary] = useState(null);
  const [approvalCount, setApprovalCount] = useState(null);
  const [listCounts, setListCounts] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState(null);
  const [picked, setPicked] = useState(false);

  const loadSummary = useCallback(async () => {
    try { setSummary(await DispatchService.summary()); }
    catch (err) { setError(err?.response?.data?.message || "โหลดสรุปไม่สำเร็จ"); }
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const counts = { approve: approvalCount ?? 0, waiting: listCounts?.waiting ?? 0, assigned: listCounts?.assigned ?? 0 };
  const ready = listCounts !== null; // แผงอนุมัติโหลดช้า/ล้มเหลว ไม่ให้ค้างทั้งหน้า (ตัวเลขอัปเดตเมื่อมาถึง)
  // แท็บเริ่มต้น = ขั้นแรกที่มีงานรอ (จนกว่าผู้ใช้จะเลือกเอง)
  useEffect(() => {
    if (!ready || approvalCount === null || picked) return;
    setTab(counts.approve > 0 ? "approve" : counts.waiting > 0 ? "waiting" : "assigned");
  }, [ready, approvalCount, picked, counts.approve, counts.waiting]);
  const cur = tab || "waiting";

  if (!can("assignDispatch")) return <Navigate to="/dashboard" replace />;

  const urgent = summary?.urgentOpen ?? 0;

  return (
    <Box sx={{ ...PAGE_SX, maxWidth: "none" }}>
      <SectionTabs group="intake" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      <PageHeader
        icon={<Inbox />}
        title="คำขอลงงาน · รออนุมัติ"
        subtitle="แผนงานที่รออนุมัติ และใบแจ้งงานจากทุกฝ่ายที่รอลงตารางงานจริง"
        actions={urgent > 0 ? (
          <Box sx={{ px: 1.25, height: 32, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: "#fef2f2", color: "#dc2626", fontSize: "0.8rem", fontWeight: 800, whiteSpace: "nowrap" }}>ด่วน {urgent}</Box>
        ) : null}
      />

      {/* แท็บขั้นตอน — หน้าตาเดียวกับแท็บ รอดำเนินการ / กำลังดำเนินการ ของหน้ารับงาน */}
      <Stack direction="row" gap={{ xs: 0.4, sm: 1 }} sx={{ mb: 1.5, p: { xs: 0.4, sm: 0 }, borderRadius: { xs: 2.5, sm: 0 }, bgcolor: { xs: "#eef2f7", sm: "transparent" } }}>
        {TABS.map((t) => {
          const on = cur === t.key;
          return (
            <ButtonBase key={t.key} onClick={() => { setPicked(true); setTab(t.key); }} sx={{
              flex: { xs: "1 1 0", sm: "0 0 auto" }, minWidth: 0, height: { xs: 34, sm: 40 }, px: { xs: 0.5, sm: 1.75 }, borderRadius: { xs: 2, sm: 2.5 },
              fontSize: { xs: "0.78rem", sm: "0.84rem" }, fontWeight: 800, gap: { xs: 0.45, sm: 0.6 }, whiteSpace: "nowrap", overflow: "hidden", fontFamily: "inherit",
              border: { xs: 0, sm: `1.5px solid ${on ? ACCENT : LINE}` },
              bgcolor: on ? { xs: "#fff", sm: alpha(ACCENT, 0.07) } : { xs: "transparent", sm: "#fff" },
              boxShadow: on ? { xs: "0 1px 3px rgba(15,23,42,.14)", sm: "none" } : "none",
              color: on ? { xs: INK, sm: ACCENT } : { xs: MUTED, sm: "#334155" },
            }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t.label}</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{t.short}</Box>
              <Box component="span" sx={{ minWidth: { xs: 18, sm: 20 }, height: { xs: 18, sm: 20 }, px: 0.55, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: { xs: "0.68rem", sm: "0.72rem" },
                bgcolor: on ? ACCENT : { xs: "rgba(100,116,139,.14)", sm: SURFACE }, color: on ? "#fff" : MUTED }}>{counts[t.key]}</Box>
            </ButtonBase>
          );
        })}
      </Stack>

      {/* ค้นหา + รีเฟรช — ชุดเดียวกับหน้ารับงาน */}
      <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1, height: 40, px: 1.5, borderRadius: 2.5, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          <Search sx={{ fontSize: 18, color: "#94a3b8" }} />
          <Box component="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา งาน / โครงการ / ลูกค้า / เลขที่ใบ / ผู้ส่ง"
            sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, fontSize: "0.86rem", fontFamily: "inherit", bgcolor: "transparent", color: INK }} />
          {search && <IconButton size="small" aria-label="ล้างคำค้น" onClick={() => setSearch("")}><Close sx={{ fontSize: 16 }} /></IconButton>}
        </Box>
        <Tooltip title="โหลดข้อมูลใหม่">
          <IconButton onClick={() => { setRefreshKey((k) => k + 1); loadSummary(); }} aria-label="โหลดข้อมูลใหม่"
            sx={{ width: 40, height: 40, flexShrink: 0, border: `1px solid ${LINE}`, borderRadius: 2.5, bgcolor: "#fff", color: MUTED }}>
            <Refresh sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {!ready && <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: 3 }} />)}</Stack>}

      {/* ⚠️ ทั้งสองแผง mount ไว้ตลอด (ได้ตัวเลขบนแท็บ) แล้วซ่อนด้วย display */}
      <Box sx={{ display: ready && cur === "approve" ? "block" : "none" }}>
        {counts.approve === 0 && <EmptyState icon={<TaskAlt />} title={search ? "ไม่พบแผนงานที่ค้นหา" : "ไม่มีแผนงานรออนุมัติ"} hint="แผนงานที่ช่างลงในปฏิทินเอง จะมารออนุมัติที่นี่" />}
        <Box sx={{ display: counts.approve > 0 ? "block" : "none" }}>
          <Suspense fallback={<Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />}>
            <PendingApprovalsPanel active embedded search={search} refreshKey={refreshKey} onCountChange={setApprovalCount} />
          </Suspense>
        </Box>
      </Box>
      <Box sx={{ display: ready && cur !== "approve" ? "block" : "none" }}>
        <DispatchList mode="board" embedded section={cur === "assigned" ? "assigned" : "waiting"} search={search} refreshKey={refreshKey}
          myId={String(userData?.userId || "")} onCounts={setListCounts} />
      </Box>
    </Box>
  );
}
