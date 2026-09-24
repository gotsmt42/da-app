import { useCallback, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Snackbar, Stack, Typography,
} from "@mui/material";
import { OpenInNew } from "@mui/icons-material";

import { WEBSITE_URL } from "../services/WebsiteService";

/**
 * ชิ้นส่วนร่วมของหน้าหลังบ้านเว็บไซต์ทุกหน้า — หัวหน้า · สถานะ · ยืนยันการลบ · แจ้งผล
 * ⚠️ ทุกหน้าใช้ชุดเดียวกัน ผู้ดูแลจะได้เจอปุ่ม/ข้อความ/ตำแหน่งเดิมทุกหน้า (การโต้ตอบที่คาดเดาได้)
 */

export const UI = {
  accent: "#dc2626",
  text: "#0f172a",
  sub: "#64748b",
  border: "#e2e8f0",
  soft: "#f8fafc",
};

export const cardSx = { bgcolor: "#fff", border: `1px solid ${UI.border}`, borderRadius: 3, p: { xs: 2, sm: 2.5 } };

/** หัวหน้า + ปุ่มเปิดดูหน้าจริงบนเว็บ */
export function WebPageHeader({ title, subtitle, sitePath, actions }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "flex-start" }}
      justifyContent="space-between" sx={{ mb: 2.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.5rem" }, color: UI.text }}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ color: UI.sub, fontSize: "0.9rem", mt: 0.25 }}>{subtitle}</Typography>}
      </Box>
      <Stack direction="row" spacing={1} flexShrink={0} flexWrap="wrap" useFlexGap>
        {/* ⚠️ ขึ้นเฉพาะเมื่อตั้ง REACT_APP_WEBSITE_URL แล้ว — ไม่มีลิงก์ที่กดแล้วไปไม่ถึง */}
        {WEBSITE_URL && sitePath !== undefined && (
          <Button
            component="a" href={`${WEBSITE_URL}${sitePath}`} target="_blank" rel="noopener noreferrer"
            variant="outlined" color="inherit" endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: UI.border }}
          >
            ดูบนเว็บไซต์
          </Button>
        )}
        {actions}
      </Stack>
    </Stack>
  );
}

/** ป้ายเผยแพร่/ฉบับร่าง — สีต่างกันชัดเจน ดูแวบเดียวรู้ว่ารายการไหนขึ้นเว็บแล้ว */
export function StatusChip({ status }) {
  const published = status === "published";
  return (
    <Chip
      size="small"
      label={published ? "เผยแพร่" : "ฉบับร่าง"}
      sx={{
        height: 22, fontWeight: 700, fontSize: "0.72rem",
        bgcolor: published ? "#dcfce7" : "#f1f5f9",
        color: published ? "#166534" : "#475569",
      }}
    />
  );
}

/** กล่องยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ */
export function ConfirmDialog({ open, title, detail, confirmText = "ลบ", busy, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      {detail && (
        <DialogContent>
          <Typography sx={{ color: UI.sub, fontSize: "0.92rem" }}>{detail}</Typography>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} color="inherit" sx={{ textTransform: "none", fontWeight: 700 }}>ยกเลิก</Button>
        <Button onClick={onConfirm} disabled={busy} variant="contained" color="error"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * แจ้งผลการทำรายการ: error ค้างอยู่จนกว่าจะปิด (ต้องอ่าน) · สำเร็จหายเองใน 3 วินาที (ไม่ต้องอ่าน)
 * @returns {{ ok: (msg: string) => void, fail: (msg: string) => void, node: JSX.Element }}
 */
export function useFeedback() {
  const [okMsg, setOk] = useState("");
  const [errMsg, setErr] = useState("");
  const ok = useCallback((m) => { setErr(""); setOk(m); }, []);
  const fail = useCallback((m) => setErr(m), []);
  const node = (
    <>
      {errMsg && <Alert severity="error" onClose={() => setErr("")} sx={{ mb: 2 }}>{errMsg}</Alert>}
      <Snackbar
        open={Boolean(okMsg)} autoHideDuration={3000} onClose={() => setOk("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setOk("")} sx={{ fontWeight: 600 }}>{okMsg}</Alert>
      </Snackbar>
    </>
  );
  return { ok, fail, node };
}

/** ส่วนแสดงเมื่อยังไม่มีรายการ */
export function EmptyBox({ title, detail, action }) {
  return (
    <Box sx={{ ...cardSx, textAlign: "center", py: 6, borderStyle: "dashed" }}>
      <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      {detail && <Typography sx={{ color: UI.sub, fontSize: "0.9rem", mt: 0.5, maxWidth: 460, mx: "auto" }}>{detail}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

/**
 * ชื่อช่องในฟอร์ม — ระบุว่าบังคับหรือไม่ และคำอธิบายสั้น
 * ⚠️ ส่ง htmlFor (= id ของช่องกรอก) ทุกครั้งที่ป้ายนี้ใช้กับช่องกรอกช่องเดียว — ป้ายจะเป็น <label for>
 *    จริง โปรแกรมอ่านหน้าจอจึงบอกชื่อช่องได้ และกดที่ชื่อแล้วเคอร์เซอร์เข้าช่อง
 *    🐛 เดิมเป็นแค่ข้อความ ช่องทั้งฟอร์มจึงไม่มีชื่อเลย (ตรวจเจอจากการทดสอบด้วย Playwright)
 */
export function FieldLabel({ children, required, hint, htmlFor }) {
  return (
    <Box sx={{ mb: 0.75 }}>
      <Typography component={htmlFor ? "label" : "span"} htmlFor={htmlFor} sx={{ fontWeight: 700, fontSize: "0.88rem" }}>
        {children}
        {required && <Box component="span" sx={{ color: UI.accent }}> *</Box>}
      </Typography>
      {hint && <Typography sx={{ color: UI.sub, fontSize: "0.78rem" }}>{hint}</Typography>}
    </Box>
  );
}
