/**
 * JobRequests — หน้า "แจ้งงานให้ช่าง" ของฝ่ายขาย (และแผนกอื่นในอนาคต)
 *
 * ทำหน้าที่เดียว: กรอกฟอร์มแจ้งงาน + ติดตามว่าใบที่ส่งไปแล้วช่างทำถึงไหน
 *
 * ⚠️ **ไม่ใช่หน้าลงแผนงาน** — เซลลงแผนงานของตัวเองที่ /event กับ /operation ซึ่งเป็นชุดเดียวกับช่าง
 * เป๊ะ (แค่ถูกกรองด้วย department ให้เห็นเฉพาะของฝ่ายขาย) หน้านี้คือ "ส่งงานข้ามแผนก" คนละเรื่องกัน
 *
 * ⚠️ เห็นเฉพาะใบที่ตัวเองส่ง — บังคับที่ server (scopeFor ใน routes/dispatch.js) ไม่ได้พึ่งการซ่อน
 * หน้าจอ ส่วนคิวรวมทั้งบริษัทอยู่ที่ /dispatch ซึ่งเป็นของแอดมิน/ผู้จัดการ
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "ปรับปรุง UI ให้สวยงาม ทันสมัย มืออาชีพ"): เดิมหัวหน้าเพจเป็นแค่แถวไอคอน+
 * ข้อความลอยบนพื้นขาว ไม่มีอัตลักษณ์ของฝ่ายขายเลย ทั้งที่หน้าอื่นของเซล (Dashboard/ปฏิทิน) มีธีมม่วง
 * ชัดเจนหมดแล้ว — เปลี่ยนเป็น hero ไล่สีม่วงแบบเดียวกับ SalesDashboard.js เป๊ะ (วงกลมจางตกแต่ง/
 * ปุ่มขาวลอยบนพื้นม่วง) ให้เข้าชุดกันทั้งฝ่าย ไม่ใช่หน้านี้หน้าเดียวที่หลุดโทน
 */
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, Stack, Typography, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Add, Engineering } from "@mui/icons-material";

import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import DispatchList from "../components/DispatchList";
import DispatchRequestDialog from "../components/DispatchRequestDialog";
import { SALES_ACCENT } from "../dispatchMeta";

const ACCENT_DEEP = "#5b21b6"; // ✅ เทียบสีเดียวกับ SalesDashboard.js — ไล่ระดับม่วงเข้มขึ้นจากขอบขวาล่าง

export default function JobRequests() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  // ✅ นับขึ้นทีละครั้งเมื่อส่งใบใหม่สำเร็จ — ใช้เป็น key ให้รายการโหลดตัวเองใหม่
  // (ง่ายและถูกต้องกว่าการยก state ของรายการขึ้นมาไว้ที่นี่ทั้งก้อน)
  const [reloadKey, setReloadKey] = useState(0);

  if (!can("requestDispatch")) return <Navigate to="/dashboard" replace />;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── Hero — เข้าชุดกับ SalesDashboard.js (ไล่สีม่วง + วงกลมจางตกแต่ง) ───── */}
      <Box
        sx={{
          position: "relative", overflow: "hidden",
          borderRadius: 4, p: { xs: 2, sm: 2.75 }, mb: 2.5,
          background: `linear-gradient(135deg, ${SALES_ACCENT} 0%, ${ACCENT_DEEP} 100%)`,
          color: "#fff",
        }}
      >
        <Box sx={{ position: "absolute", right: -40, top: -60, width: 200, height: 200, borderRadius: "50%", bgcolor: alpha("#fff", 0.08) }} />
        <Box sx={{ position: "absolute", right: 60, bottom: -80, width: 140, height: 140, borderRadius: "50%", bgcolor: alpha("#fff", 0.06) }} />

        <Stack
          direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}
          sx={{ position: "relative" }}
        >
          <Box
            sx={{
              width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
              bgcolor: alpha("#fff", 0.16), display: "flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid", borderColor: alpha("#fff", 0.3),
            }}
          >
            <Engineering sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.4rem" }, lineHeight: 1.2 }}>
              แจ้งงานให้ช่าง
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
              กรอกรายละเอียดงาน แนบรูปหน้างาน แล้วแอดมินจะเลือกช่างและนัดวันให้
            </Typography>
          </Box>
          <Button
            variant="contained" startIcon={<Add sx={{ fontSize: 18 }} />}
            onClick={() => setFormOpen(true)}
            sx={{
              textTransform: "none", fontWeight: 800, borderRadius: 2.5, px: 2.5, flexShrink: 0,
              bgcolor: "#fff", color: ACCENT_DEEP,
              width: { xs: "100%", sm: "auto" },
              "&:hover": { bgcolor: alpha("#fff", 0.9) },
            }}
          >
            แจ้งงานใหม่
          </Button>
        </Stack>
      </Box>

      <DispatchList
        key={reloadKey}
        mode="requester"
        myId={String(userData?.userId || "")}
      />

      {formOpen && (
        <DispatchRequestDialog
          onClose={() => setFormOpen(false)}
          onCreated={() => { setFormOpen(false); setReloadKey((k) => k + 1); }}
        />
      )}
    </Box>
  );
}
