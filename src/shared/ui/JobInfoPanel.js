/**
 * JobInfoPanel — กล่อง "ข้อมูลงาน" ในหัวการ์ดงาน (หน้าการดำเนินงาน · งานของฉัน) ใช้ตัวเดียวกัน
 *
 * ✅ (12 พ.ย. 2569 ผู้ใช้: "ส่วนหัวการ์ด จัดรูปแบบให้ดูง่ายกว่านี้ · ทำให้ย่อปิดข้อมูลงานส่วนบนได้ · หน้างานของฉันก็ให้เหมือนกัน")
 *    พื้นเทาอ่อน มีเส้นคั่นทุกแถว (ใช้คู่กับ InfoLine) · หัวกล่องกดย่อ/ขยาย · จำค่าไว้ในเครื่อง (ใช้ร่วมทุกการ์ด)
 *    · แถวที่กำลังกรอกค่า (มีช่อง input) ป้ายขึ้นบน ตัวแก้ไขกว้างเต็มกล่อง
 */
import { useState } from "react";
import { Box, ButtonBase, Collapse, Stack, Typography } from "@mui/material";
import { ExpandMoreRounded as ExpandMore } from "@mui/icons-material";

const KEY = "tt-job-info-open";
const LINE = "#eef2f7";

export default function JobInfoPanel({ children, title = "ข้อมูลงาน", sx }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } });
  const toggle = (e) => {
    e?.stopPropagation?.();
    setOpen((v) => { try { localStorage.setItem(KEY, v ? "0" : "1"); } catch { /* ไม่มีที่เก็บ */ } return !v; });
  };
  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{
      width: "100%", boxSizing: "border-box", cursor: "default", px: 1.5, py: 0.25, borderRadius: "12px", bgcolor: "#f8fafc", border: `1px solid ${LINE}`,
      "& .tt-info-line": { borderTop: `1px solid ${LINE}` },
      "& .MuiCollapse-wrapperInner .tt-info-line:first-of-type": { borderTop: 0 },
      "& .MuiCollapse-wrapperInner > div > .tt-info-line:first-of-type": { borderTop: 0 },
      "& .MuiCollapse-wrapperInner > div + div > .tt-info-line:first-of-type": { borderTop: `1px solid ${LINE}` },
      "& .tt-info-line:has(input:not([type=hidden]):not([type=radio]))": { flexDirection: "column", alignItems: "stretch", gap: 0.75, py: 1 },
      "& .tt-info-line:has(input:not([type=hidden]):not([type=radio])) > div:last-of-type": { width: "100%", pt: 0, ml: "0 !important" },
      ...sx,
    }}>
      <ButtonBase onClick={toggle} aria-expanded={open}
        sx={{ width: "100%", justifyContent: "space-between", py: 0.9, fontFamily: "inherit", borderBottom: open ? `1px solid ${LINE}` : "none" }}>
        <Typography component="span" sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155" }}>{title}</Typography>
        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: "#64748b" }}>
          <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 700 }}>{open ? "ย่อ" : "แสดง"}</Typography>
          <ExpandMore sx={{ fontSize: 20, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
        </Stack>
      </ButtonBase>
      <Collapse in={open}>{children}</Collapse>
    </Box>
  );
}
