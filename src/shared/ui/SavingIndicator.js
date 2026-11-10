/**
 * SavingIndicator — ป้าย "กำลังบันทึก…" ลอยกลางจอล่าง ทุกหน้า (ต่อกับ savingTracker)
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "เวลาบันทึกอะไรที่ต้องรอโหลด ให้ขึ้นกำลังบันทึกให้ผู้ใช้รับรู้ ให้ดูสวยงาม ใช้งานง่าย ไม่สับสน ในทุกๆหน้า")
 *    • ขึ้นเฉพาะเมื่อรอเกิน 0.4 วิ (บันทึกเร็วไม่กระพริบ) · อัปโหลดไฟล์ = "กำลังอัปโหลด…"
 *    • เสร็จแล้วเปลี่ยนเป็น "บันทึกแล้ว ✓" สั้นๆ 1 วิ แล้วหายเอง (ไม่สำเร็จ = หายเงียบ — หน้านั้นแจ้งข้อผิดพลาดเอง)
 *    • อยู่เหนือทุกกล่อง (รวมฟอร์ม SweetAlert) · มือถือยกขึ้นเหนือแถบเมนูล่าง · ไม่บังการกดอะไร
 */
import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { CheckCircleRounded, CloudUploadRounded } from "@mui/icons-material";
import { subscribeSaving, snapshot } from "@/shared/api/savingTracker";

const SHOW_AFTER_MS = 400;
const DONE_MS = 1000;

export default function SavingIndicator() {
  const [view, setView] = useState(null); // null | "saving" | "upload" | "done"
  const timer = useRef(null);
  const doneTimer = useRef(null);
  const shown = useRef(false);

  useEffect(() => {
    const onChange = (s) => {
      clearTimeout(doneTimer.current);
      if (s.count > 0) {
        if (shown.current) { setView(s.upload ? "upload" : "saving"); return; }
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const now = snapshot();
          if (now.count > 0) { shown.current = true; setView(now.upload ? "upload" : "saving"); }
        }, SHOW_AFTER_MS);
        return;
      }
      clearTimeout(timer.current);
      if (shown.current && s.lastResult?.ok) {
        setView("done");
        doneTimer.current = setTimeout(() => { shown.current = false; setView(null); }, DONE_MS);
      } else {
        shown.current = false;
        setView(null);
      }
    };
    const off = subscribeSaving(onChange);
    return () => { off(); clearTimeout(timer.current); clearTimeout(doneTimer.current); };
  }, []);

  if (!view) return null;
  const done = view === "done";
  return (
    <Box role="status" aria-live="polite"
      sx={{
        position: "fixed", left: "50%", transform: "translateX(-50%)", zIndex: 30000, pointerEvents: "none",
        bottom: { xs: "calc(84px + env(safe-area-inset-bottom))", md: 28 },
        display: "inline-flex", alignItems: "center", gap: 1, height: 40, px: 1.75, borderRadius: 99,
        bgcolor: done ? "#f0fdf4" : "#fff", color: done ? "#15803d" : "#1e293b",
        border: `1px solid ${done ? "#bbf7d0" : "#e2e8f0"}`, boxShadow: "0 10px 30px -10px rgba(15,23,42,.35)",
        fontSize: "0.86rem", fontWeight: 800, whiteSpace: "nowrap",
        animation: "tt-save-in .18s ease-out", "@keyframes tt-save-in": { from: { opacity: 0, transform: "translate(-50%, 8px)" }, to: { opacity: 1, transform: "translate(-50%, 0)" } },
      }}>
      {done
        ? <CheckCircleRounded sx={{ fontSize: 20, color: "#16a34a" }} />
        : view === "upload"
          ? <CloudUploadRounded sx={{ fontSize: 20, color: "#2563eb" }} />
          : <CircularProgress size={18} thickness={5} sx={{ color: "#2563eb" }} />}
      {done ? "บันทึกแล้ว" : view === "upload" ? "กำลังอัปโหลด…" : "กำลังบันทึก…"}
    </Box>
  );
}
