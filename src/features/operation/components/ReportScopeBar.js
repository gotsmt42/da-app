/**
 * ReportScopeBar — แถบ "หน้านี้นับอะไร" บนหัวหน้ารายงาน + เทียบกับอีกแท็บ
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "2 แท็บนี้ข้อมูลเหมือนกันไหม · จัดวางให้ดูง่าย ไม่สับสน มืออาชีพ")
 *    บรรทัดเดียว: หน่วยนับ · มูลค่า · นับตาม  +  ปุ่ม "ต่างจาก <อีกแท็บ> อย่างไร" (กางตารางเทียบ)
 *    ข้อความทั้งหมดมาจาก utils/reportScopes.js
 */
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, ButtonBase, Collapse, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { InfoOutlined, ExpandMoreRounded, CheckRounded, CompareArrowsRounded } from "@mui/icons-material";
import { INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";
import { R_CARD } from "./ReportKit";
import { REPORT_SCOPES, SCOPE_COMPARE_ROWS, SCOPE_SAME, SCOPE_DIFF } from "../utils/reportScopes";

const Tag = ({ label, value }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5, whiteSpace: "nowrap" }}>
    <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>{label}</Box>
    <Box component="span" sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{value}</Box>
  </Box>
);

/** @param scope "jobs" | "workers" */
export default function ReportScopeBar({ scope }) {
  const [open, setOpen] = useState(false);
  const me = REPORT_SCOPES[scope];
  const other = REPORT_SCOPES[scope === "jobs" ? "workers" : "jobs"];
  if (!me) return null;
  const cols = [me, other];
  return (
    <Box sx={{ ...R_CARD, mb: { xs: 1.5, sm: 2 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} gap={{ xs: 0.75, sm: 1.5 }} sx={{ px: 1.5, py: 1 }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ flex: 1, minWidth: 0, flexWrap: "wrap", rowGap: 0.5 }}>
          <InfoOutlined sx={{ fontSize: 17, color: ACCENT }} />
          <Tag label="นับเป็น" value={me.unit} />
          <Box component="span" sx={{ color: "#cbd5e1" }}>·</Box>
          <Tag label="มูลค่า" value={me.value} />
          <Box component="span" sx={{ color: "#cbd5e1" }}>·</Box>
          <Tag label="เข้าเดือนตาม" value={me.date} />
        </Stack>
        <ButtonBase onClick={() => setOpen((v) => !v)}
          sx={{ alignSelf: { xs: "flex-start", sm: "center" }, gap: 0.5, px: 1, py: 0.4, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 800, color: ACCENT, "&:hover": { bgcolor: alpha(ACCENT, 0.06) } }}>
          <CompareArrowsRounded sx={{ fontSize: 16 }} />ต่างจาก “{other.tab}” อย่างไร
          <ExpandMoreRounded sx={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </ButtonBase>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5, borderTop: `1px solid ${LINE}` }}>
          {/* ตารางเทียบ — คอลัมน์ซ้าย = หน้านี้ */}
          <Box sx={{ mt: 1.25, borderRadius: 2, border: `1px solid ${LINE}`, overflow: "hidden" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "92px 1fr 1fr", sm: "140px 1fr 1fr" }, bgcolor: "#f8fafc", borderBottom: `1px solid ${LINE}` }}>
              <Box />
              {cols.map((c, i) => (
                <Typography key={c.key} sx={{ px: 1, py: 0.75, fontSize: "0.78rem", fontWeight: 900, color: i === 0 ? ACCENT : INK }}>
                  {c.tab}{i === 0 ? " (หน้านี้)" : ""}
                </Typography>
              ))}
            </Box>
            {SCOPE_COMPARE_ROWS.map(([label, key], r) => (
              <Box key={key} sx={{ display: "grid", gridTemplateColumns: { xs: "92px 1fr 1fr", sm: "140px 1fr 1fr" }, borderTop: r ? `1px solid ${LINE}` : 0 }}>
                <Typography sx={{ px: 1, py: 0.75, fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
                {cols.map((c, i) => (
                  <Typography key={c.key} sx={{ px: 1, py: 0.75, fontSize: "0.78rem", color: "#334155", lineHeight: 1.45, bgcolor: i === 0 ? alpha(ACCENT, 0.03) : "transparent" }}>{c[key]}</Typography>
                ))}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "grid", gap: 1.25, mt: 1.25, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#15803d", mb: 0.4 }}>เหมือนกัน</Typography>
              {SCOPE_SAME.map((t) => (
                <Stack key={t} direction="row" gap={0.6} sx={{ mb: 0.3 }}>
                  <CheckRounded sx={{ fontSize: 15, color: "#15803d", mt: 0.2 }} />
                  <Typography sx={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.5 }}>{t}</Typography>
                </Stack>
              ))}
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#b45309", mb: 0.4 }}>ทำไมตัวเลขไม่เท่ากัน</Typography>
              {SCOPE_DIFF.map((t) => (
                <Stack key={t} direction="row" gap={0.6} sx={{ mb: 0.3 }}>
                  <Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#b45309", mt: 0.9, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.5 }}>{t}</Typography>
                </Stack>
              ))}
            </Box>
          </Box>
          <Button component={RouterLink} to={other.href} size="small" variant="outlined"
            sx={{ mt: 1.25, textTransform: "none", fontWeight: 800, borderRadius: 2 }}>
            ไปที่ {other.tab} ›
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
