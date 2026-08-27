/**
 * ReviewDialog — ขั้น "ตรวจสอบ" ของผู้จัดการ/แอดมิน ก่อนงานจากต่างแผนกจะเข้าตารางช่าง
 *
 * ⚠️ **อนุมัติ = ลงแผนงานให้เลยในคำขอเดียว** ไม่ใช่แค่เปลี่ยนสถานะแล้วค่อยไปสร้างแผนงานทีหลัง —
 * ถ้าแยกเป็น 2 ขั้น จะเกิดใบที่ "อนุมัติแล้ว" แต่ไม่มีวันนัดอยู่ในระบบ ซึ่งในสายตาช่างกับลูกค้า
 * ไม่ต่างอะไรกับยังไม่อนุมัติ และไม่มีใครรู้ว่าตกหล่นจนกว่าลูกค้าจะโทรมาถาม
 * (ฝั่ง server บังคับเรื่องนี้ด้วย: POST /dispatch/:id/approve ต้องมี start เสมอ)
 *
 * ⚠️ ไม่อนุมัติต้องมีเหตุผลเสมอ — ตีกลับเปล่าๆ ทำให้ผู้แจ้งส่งกลับมาเหมือนเดิมแล้ววนอยู่อย่างนั้น
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, MenuItem, Alert, Stack, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircle, Cancel } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import DispatchService from "../services/DispatchService";
import { TEXT_SUB, BORDER_MAIN } from "../dispatchMeta";

/**
 * @param {"approve"|"reject"} mode  สิ่งที่ผู้ใช้เลือกไว้แล้วจากปุ่มในกล่องใบแจ้งงาน
 *
 * 🐛 ที่แก้ (ผู้ใช้แจ้งว่า "ปุ่มอนุมัติมี 2 ที่"): เดิมกล่องนี้มีปุ่มสลับ อนุมัติ/ไม่อนุมัติ อยู่ข้างใน
 * ด้วย ทั้งที่ผู้ใช้เพิ่งเลือกไปแล้วจากปุ่มด้านนอก — กลายเป็นถามซ้ำเรื่องเดิมสองรอบ และคำว่า
 * "อนุมัติ" โผล่ 2 ที่ในจอเดียว (ปุ่มสลับด้านบน + ปุ่มยืนยันด้านล่าง) จนไม่รู้ว่าต้องกดอันไหน
 * ✅ กล่องนี้ทำงานเดียวตามที่ถูกเรียกมา — เปลี่ยนใจให้กดยกเลิกแล้วเลือกปุ่มอีกอัน
 */
export default function ReviewDialog({ dispatch, mode = "approve", onClose, onReviewed }) {
  const isMobile = useMediaQuery("(max-width:700px)");
  const [start, setStart] = useState(moment().add(1, "day").format("YYYY-MM-DD"));
  const [end, setEnd] = useState(moment().add(1, "day").format("YYYY-MM-DD"));
  // ✅ ใบที่เคยกดมอบหมายไว้แล้ว (ก่อนจะมีขั้นตอนลงแผนงาน) ต้องเติมคนเดิมกลับมาให้
  // ไม่ให้ต้องเลือกซ้ำ และกันเลือกคนละคนกับที่แจ้งผู้รับงานไปแล้วโดยไม่ตั้งใจ
  const [responsibleId, setResponsibleId] = useState(() => String(dispatch?.assignees?.[0]?.userId || ""));
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    DispatchService.assignable()
      .then((rows) => { if (alive) setPeople(rows || []); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, []);

  // ⚠️ วันสิ้นสุดต้องขยับตามวันเริ่มเสมอเมื่อมันหล่นไปอยู่ก่อนวันเริ่ม — ปล่อยไว้จะโดน server
  // ปฏิเสธ 400 ทั้งที่ผู้ใช้แค่เลื่อนวันเริ่มไปข้างหน้าเฉยๆ
  useEffect(() => {
    if (end && start && moment(end).isBefore(moment(start), "day")) setEnd(start);
  }, [start, end]);

  const dayCount = useMemo(() => {
    if (!start || !end) return 1;
    return Math.max(1, moment(end).diff(moment(start), "days") + 1);
  }, [start, end]);

  if (!dispatch) return null;

  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (mode === "approve") {
        const { dispatch: updated } = await DispatchService.approve(dispatch._id, {
          start, end, responsiblePersonId: responsibleId || undefined,
        });
        onReviewed?.(updated, "approved");
      } else {
        if (!reason.trim()) { setError("กรุณาระบุเหตุผล เพื่อให้ผู้แจ้งแก้ไขได้ถูกจุด"); return; }
        const updated = await DispatchService.reject(dispatch._id, reason.trim());
        onReviewed?.(updated, "rejected");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const approving = mode === "approve";

  return (
    <Dialog open onClose={() => !busy && onClose?.()} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 30, height: 30, borderRadius: 2, flexShrink: 0,
              bgcolor: alpha(approving ? "#10b981" : "#ef4444", 0.14),
              color: approving ? "#059669" : "#dc2626",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {approving ? <CheckCircle sx={{ fontSize: 18 }} /> : <Cancel sx={{ fontSize: 18 }} />}
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>
            {approving ? "อนุมัติและลงตารางงาน" : "ตีกลับให้ผู้แจ้งแก้ไข"}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: TEXT_SUB }}>
          {[dispatch.dispatchNo, dispatch.title, dispatch.customer?.company].filter(Boolean).join(" · ")}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}


        {approving ? (
          <Box>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1 }}>
              อนุมัติแล้วระบบจะสร้างแผนงานในตารางงานให้ทันที ช่างจะเห็นงานนี้ในหน้าการดำเนินงานของตัวเอง
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 1.5 }}>
              <ThaiDatePicker label="วันที่เข้างาน" value={start} onChange={setStart} />
              <ThaiDatePicker label="ถึงวันที่" value={end} onChange={setEnd} />
            </Box>

            <TextField
              select fullWidth size="small" label="ผู้รับผิดชอบ"
              value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}
              helperText="เว้นว่างได้ถ้ายังไม่รู้ว่าใครว่าง — มอบหมายทีหลังได้จากกล่องใบแจ้งงาน"
              FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
            >
              <MenuItem value="">— ยังไม่ระบุ —</MenuItem>
              {people.map((u) => (
                <MenuItem key={u._id} value={u._id}>
                  {[u.fname, u.lname].filter(Boolean).join(" ") || u.username}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ mt: 2, p: 1.25, borderRadius: 2, bgcolor: alpha("#10b981", 0.07), border: "1px solid", borderColor: alpha("#10b981", 0.3) }}>
              <Typography variant="caption" sx={{ color: "#047857", fontWeight: 700 }}>
                จะลงแผนงาน {dayCount > 1 ? `${dayCount} วัน · ` : ""}
                {moment(start).format("D MMM")}
                {dayCount > 1 ? ` – ${moment(end).format("D MMM")}` : ""}
                {responsibleId
                  ? ` · ${(() => {
                      const u = people.find((x) => String(x._id) === String(responsibleId));
                      return u ? [u.fname, u.lname].filter(Boolean).join(" ") || u.username : "";
                    })()}`
                  : " · ยังไม่ระบุผู้รับผิดชอบ"}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1 }}>
              ใบนี้จะถูกตีกลับไปให้ผู้แจ้งแก้ไข แล้วส่งกลับมาตรวจใหม่ได้ — ใบเดิม ไม่ใช่ใบใหม่
            </Typography>
            <TextField
              fullWidth multiline minRows={3} autoFocus
              label="เหตุผลที่ไม่อนุมัติ"
              placeholder="เช่น ยังไม่แนบใบ PO / ข้อมูลหน้างานไม่พอ ต้องระบุชั้นและจำนวนจุด"
              value={reason} onChange={(e) => setReason(e.target.value)}
              error={!reason.trim() && Boolean(error)}
            />
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.75 }}>
              ข้อความนี้จะถูกส่งแจ้งเตือนไปหาผู้แจ้งทันที
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${BORDER_MAIN}` }}>
        <Button onClick={() => onClose?.()} disabled={busy} sx={{ textTransform: "none" }}>ยกเลิก</Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained" onClick={submit} disabled={busy || (!approving && !reason.trim())}
          sx={{
            textTransform: "none", fontWeight: 800, borderRadius: 2, px: 3,
            bgcolor: approving ? "#10b981" : "#ef4444",
            "&:hover": { bgcolor: approving ? "#059669" : "#dc2626" },
          }}
        >
          {busy ? "กำลังบันทึก..." : approving ? "ยืนยันลงตารางงาน" : "ยืนยันตีกลับ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
