/**
 * SectionTabs — แถบสลับหน้าย่อยในกลุ่มเดียวกัน (อยู่บนสุดของแต่ละหน้าในกลุ่ม)
 *
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "แต่ละหน้าดูสับสน ย้อนแย้ง ซ้ำซ้อน ดูข้อมูลยาก · ปรับให้หน้าที่เชื่อมโยงกันดูง่าย หน้าไม่เยอะ
 *    ข้อมูลยังครบ" → เลือก "รวมเหลือ 4 หน้าหลัก")
 *    เมนูงานเหลือ 4 ทางเข้า: งานเข้า · ตารางงาน · การดำเนินงาน · ภาพรวมงาน
 *    หน้าที่เคยเป็นเมนูแยก (คำขอลงงาน · ประวัติเข้างาน · รายงานงาน) กลายเป็นแท็บในกลุ่มของตัวเอง
 *      • งานเข้า        = รับงาน · คำขอลงงาน/รออนุมัติ
 *      • การดำเนินงาน   = ทุกงานที่ลงตาราง · ประวัติเข้างาน · รายงานงาน
 *    ⚠️ URL เดิมทุกอันยังใช้ได้ (ลิงก์แจ้งเตือน/บุ๊กมาร์ก) — แค่ไม่มีเมนูแยกแล้ว เข้าผ่านแท็บนี้
 *    ⚠️ แต่ละแท็บโชว์ตามสิทธิ์เดียวกับเมนูเดิม · เหลือแท็บเดียว = ไม่แสดงแถบ
 */
import { Link, useLocation } from "react-router-dom";
import { Box, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useAuth } from "@/features/auth/AuthContext";
import { can, seesOperationBoard } from "@/shared/utils/roles";
import useAppBadges from "@/shared/hooks/useAppBadges";

const ACCENT = "#2563eb";

const GROUPS = {
  intake: [
    { label: "รับงาน", href: "/jobs/intake", match: (p) => p.startsWith("/jobs/intake"), badge: "jobIntake",
      show: (u) => can(u, "assignDispatch") || can(u, "editAnyJob") || can(u, "receiveDispatch") },
    { label: "คำขอลงงาน · รออนุมัติ", href: "/dispatch", match: (p) => p.startsWith("/dispatch"), badge: "dispatchQueue",
      show: (u) => can(u, "assignDispatch") },
  ],
  operation: [
    { label: "การดำเนินงาน", href: "/operation", match: (p) => p.startsWith("/operation"), badge: "closeRequests",
      show: (u) => seesOperationBoard(u) },
    { label: "ประวัติเข้างาน", href: "/attendance", match: (p) => p.startsWith("/attendance"), badge: "attendanceFixes",
      show: (u) => can(u, "viewAllJobs") || can(u, "approveJobs") },
    { label: "รายงานงาน", href: "/jobs/report", match: (p) => p.startsWith("/jobs/report"),
      show: (u) => can(u, "editOperation") || can(u, "receiveDispatch") },
  ],
};

export default function SectionTabs({ group, edge = false }) {
  const { userData } = useAuth() || {};
  const { pathname } = useLocation();
  const { badges } = useAppBadges(userData);
  const tabs = (GROUPS[group] || []).filter((t) => t.show(userData));
  if (tabs.length < 2) return null;
  return (
    <Stack direction="row" sx={{ mb: { xs: 1.25, sm: 1.75 }, p: 0.5, gap: 0.5, bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: 3,
      overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, mx: edge ? { xs: 1.5, sm: 0 } : 0 }}>
      {tabs.map((t) => {
        const on = t.match(pathname);
        const n = t.badge ? Number(badges?.[t.badge]) || 0 : 0;
        return (
          <Box key={t.href} component={Link} to={t.href} aria-current={on ? "page" : undefined}
            sx={{
              flex: { xs: "1 0 auto", sm: "0 0 auto" }, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.75,
              height: 38, px: 1.75, borderRadius: 2.5, textDecoration: "none", whiteSpace: "nowrap",
              fontSize: "0.86rem", fontWeight: on ? 800 : 600,
              color: on ? "#fff" : "#334155", bgcolor: on ? ACCENT : "transparent",
              "&:hover": { bgcolor: on ? ACCENT : alpha(ACCENT, 0.06), color: on ? "#fff" : ACCENT },
            }}>
            {t.label}
            {n > 0 && (
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-grid", placeItems: "center",
                fontSize: "0.72rem", fontWeight: 800, bgcolor: on ? "#fff" : "#dc2626", color: on ? ACCENT : "#fff" }}>{n > 99 ? "99+" : n}</Box>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
