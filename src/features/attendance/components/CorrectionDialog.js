/**
 * ขอแก้เวลาเช็คอิน/เช็คเอาต์ (10 ต.ค. 2569)
 * 🔒 ช่างแก้เวลาเองไม่ได้ — ยื่นคำขอพร้อมเหตุผล แล้วรอแอดมินอนุมัติ (เก็บประวัติทุกครั้ง)
 * ✅ แอดมิน/ผู้จัดการยื่นเอง = มีผลทันที (ยังบันทึกประวัติว่าใครแก้ จากเท่าไรเป็นเท่าไร เพราะอะไร)
 */
import { useEffect, useState } from "react";
import moment from "moment";
import {
  Box, Stack, Typography, Button, ButtonBase, Dialog, DialogContent, DialogActions, IconButton, TextField,
} from "@mui/material";
import { Close, EditCalendarOutlined } from "@mui/icons-material";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import AttendanceService from "@/shared/services/AttendanceService";
import { INK, MUTED, LINE, ACCENT, ACCENT_SOFT } from "@/shared/ui/PageKit";
import { FIELD_LABEL, fmtDayTime } from "../attendanceMeta";

export default function CorrectionDialog({ open, row, isApprover, onClose, onDone }) {
  const [field, setField] = useState("checkIn");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const current = row ? (field === "checkIn" ? row.checkIn?.at : row.checkOut?.at) : null;

  useEffect(() => {
    if (!open || !row) return;
    setField("checkIn");
    setReason("");
    setErr("");
  }, [open, row]);
  useEffect(() => {
    if (!current) return;
    setDay(moment(current).format("YYYY-MM-DD"));
    setTime(moment(current).format("HH:mm"));
  }, [current]);

  const fields = ["checkIn", ...(row?.status === "checked_out" ? ["checkOut"] : [])];
  const ok = day && /^\d{2}:\d{2}$/.test(time) && reason.trim();

  const submit = async () => {
    if (!ok) return;
    setSaving(true);
    setErr("");
    try {
      const toAt = moment(`${day} ${time}`, "YYYY-MM-DD HH:mm").toISOString();
      const data = await AttendanceService.requestCorrection(row._id, { field, toAt, reason: reason.trim() });
      onDone?.(data.attendance);
    } catch (e) {
      setErr(e?.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT }}>
          <EditCalendarOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>{isApprover ? "แก้เวลา" : "ขอแก้เวลา"}</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{row?.userName} · {row?.jobLabel}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        {fields.length > 1 && (
          <Stack direction="row" gap={1} sx={{ mb: 2 }}>
            {fields.map((f) => (
              <ButtonBase key={f} onClick={() => setField(f)}
                sx={{ flex: 1, py: 1, borderRadius: 2, fontFamily: "inherit", fontWeight: 800, fontSize: "0.84rem",
                  border: `1.5px solid ${field === f ? ACCENT : LINE}`, bgcolor: field === f ? ACCENT_SOFT : "#fff", color: field === f ? ACCENT : INK }}>
                {FIELD_LABEL[f]}
              </ButtonBase>
            ))}
          </Stack>
        )}
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.25 }}>
          เวลาที่บันทึกไว้: <b style={{ color: INK }}>{fmtDayTime(current)}</b>
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 1.25 }}>
          <ThaiDatePicker label="วันที่" value={day} onChange={(v) => setDay(v || "")} />
          <TextField size="small" type="time" label="เวลา" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Box>
        <TextField fullWidth multiline minRows={2} size="small" label="เหตุผลที่ต้องแก้" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น กดเข้างานช้ากว่าเวลาจริง · สัญญาณเน็ตหลุด" sx={{ mt: 2 }} inputProps={{ maxLength: 500 }} />
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1.25 }}>
          {isApprover ? "มีผลทันที และบันทึกประวัติการแก้ไขไว้" : "ส่งให้แอดมินอนุมัติ — เวลาจะเปลี่ยนเมื่ออนุมัติแล้ว และเก็บประวัติไว้ทุกครั้ง"}
        </Typography>
        {err && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#dc2626", fontWeight: 700 }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}` }}>
        <Button onClick={onClose} disabled={saving} sx={{ fontWeight: 800, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disableElevation disabled={!ok || saving} onClick={submit}
          sx={{ fontWeight: 900, borderRadius: 2, px: 2.5, bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8" } }}>
          {saving ? "กำลังบันทึก…" : isApprover ? "บันทึกเวลาใหม่" : "ส่งคำขอ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
