/**
 * ExpenseDetailDialog — รายละเอียดใบเบิก Advance / ใบเคลม + ปุ่มดำเนินการตามขั้น
 *
 * ✅ บอก "ขั้นต่อไป" ให้ชัดเสมอ (แถบสถานะด้านบน + เส้นขั้นตอน) — คนเปิดดูต้องรู้ทันทีว่าใบนี้ค้างที่ใคร
 * ✅ ปุ่มที่โชว์ขึ้นกับสิทธิ์ + สถานะ แบบเดียวกับที่ server บังคับ (ดู routes/expenses.js) — ไม่โชว์ปุ่มที่
 * กดไปก็โดนปฏิเสธ ยกเว้น "อนุมัติใบตัวเอง" ที่โชว์เป็นปุ่มปิดพร้อมเหตุผล ให้หัวหน้ารู้ว่าทำไมกดไม่ได้
 * ⚠️ นี่เป็นแค่การซ่อนปุ่ม — ขอบเขตความปลอดภัยจริงอยู่ที่ server ทุกเส้นทาง
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Chip,
  Alert, CircularProgress, useMediaQuery, TextField, MenuItem, Tooltip, Divider, Skeleton, Collapse,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Print, Edit, CheckCircle, Undo, Block, Payments, ReceiptLong, AttachFile, OpenInNew,
  DeleteOutline, Link as LinkIcon, History, TaskAlt, WarningAmber, Image as ImageIcon, Description, ExpandMore,
  AccountBalanceWallet,
} from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL } from "@/shared/utils/fileUpload";
import { thaiDate, thaiDateFull, thaiDateTime } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import ExpensePrintDialog from "./ExpensePrintDialog";
import AdvancePanel from "./AdvancePanel";
import KindBadge from "./KindBadge";
import { compareItems, COMPARE_KIND_LABEL } from "../utils/expenseCompare";
import {
  KIND_META, slipKind, statusMeta, categoryMeta, baht, fmtMoney, qtyText, differenceMeta, paymentLabel, PAYMENT_METHODS,
  fileKindLabel, jobText, isOverdueClear, money, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";

const InfoCell = ({ label, children, span }) => (
  <Box sx={{ minWidth: 0, gridColumn: span ? "1 / -1" : "auto" }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600, display: "block", lineHeight: 1.4 }}>{label}</Typography>
    <Box sx={{ fontSize: "0.9rem", fontWeight: 600, color: TEXT_MAIN, wordBreak: "break-word" }}>{children || "-"}</Box>
  </Box>
);

const Card = ({ title, icon, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.5 }}>
    {title && (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        {icon}
        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
    )}
    {children}
  </Box>
);

/** เส้นขั้นตอน — ขั้นที่ผ่านแล้วมีวันที่กำกับ */
const Steps = ({ steps, color }) => (
  <Stack direction="row" sx={{ mt: 1.5 }}>
    {steps.map((s, i) => {
      const done = Boolean(s.done);
      const current = !done && (i === 0 || steps[i - 1].done);
      const c = s.danger ? "#dc2626" : done ? color : current ? alpha(color, 0.9) : "#cbd5e1";
      return (
        <Box key={s.label} sx={{ flex: 1, minWidth: 0, position: "relative", textAlign: "center" }}>
          {i > 0 && (
            <Box sx={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2, bgcolor: done || current ? alpha(color, 0.5) : "#e2e8f0", zIndex: 0 }} />
          )}
          <Box sx={{
            width: 24, height: 24, mx: "auto", borderRadius: "50%", position: "relative", zIndex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
            bgcolor: done ? c : "#fff", color: done ? "#fff" : c, border: `2px solid ${c}`,
            boxShadow: current ? `0 0 0 4px ${alpha(color, 0.15)}` : "none",
          }}>
            {done ? <TaskAlt sx={{ fontSize: 15 }} /> : i + 1}
          </Box>
          <Typography sx={{ fontSize: { xs: "0.68rem", sm: "0.76rem" }, fontWeight: current || done ? 800 : 600, color: done || current ? TEXT_MAIN : TEXT_SUB, mt: 0.5, lineHeight: 1.2 }}>
            {s.label}
          </Typography>
          <Typography sx={{ fontSize: "0.66rem", color: TEXT_SUB, lineHeight: 1.2 }}>{s.date ? thaiDate(s.date) : " "}</Typography>
        </Box>
      );
    })}
  </Stack>
);

/**
 * ตารางเทียบรายบรรทัด ตั้งเบิก (Advance) ↔ ใช้จริง (Claim)
 * ✅ ผู้ใช้ขอให้ "ตรวจสอบและดูง่าย" — คอลัมน์ตั้งเบิกพื้นเขียวอมฟ้า คอลัมน์ใช้จริงพื้นม่วง ตรงกับสีประจำใบ
 * แถวที่ตั้งเบิกไว้แต่ไม่ได้ใช้ยังโชว์ (ขีดจาง) ผู้ตรวจจะได้เห็นว่ามีรายการหายไป ไม่ใช่เห็นแค่ยอดรวมที่ลดลง
 */
const CompareTable = ({ items, advanceItems, wide }) => {
  const A = KIND_META.advance;
  const C = KIND_META.claim;
  const { rows, plannedTotal, actualTotal } = compareItems(items || [], advanceItems || []);
  const diffTotal = money(actualTotal - plannedTotal);
  const diffColor = (d) => (d === 0 ? TEXT_SUB : d > 0 ? "#1d4ed8" : "#d97706");
  const diffText = (d) => (d === 0 ? "—" : `${d > 0 ? "+" : "−"}${fmtMoney(Math.abs(d))}`);
  if (!rows.length) return null;

  if (!wide) {
    return (
      <Stack spacing={1}>
        {rows.map((r, i) => {
          const cat = categoryMeta(r.category);
          const faded = r.kind === "unused";
          return (
            <Box key={r.key} sx={{ p: 1, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, opacity: faded ? 0.8 : 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="baseline">
                <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, fontWeight: 700 }}>{i + 1}.</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: "0.86rem", flex: 1, minWidth: 0, textDecoration: faded ? "line-through" : "none" }}>{r.description}{r.person?.name ? <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · {r.person.name}</Box> : null}</Typography>
                {COMPARE_KIND_LABEL[r.kind] && <Chip size="small" label={COMPARE_KIND_LABEL[r.kind]} sx={{ height: 18, fontSize: "0.62rem", fontWeight: 800 }} />}
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", ml: 2 }}>
                <Box component="span" sx={{ color: cat.color, fontWeight: 700 }}>{cat.label}</Box>
                {r.actual ? ` · ${qtyText(r.actual)}` : ""}{r.receiptNo ? ` · ใบเสร็จ ${r.receiptNo}` : ""}
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 0.5, mt: 0.75 }}>
                <Box sx={{ px: 0.75, py: 0.4, borderRadius: 1.5, bgcolor: A.soft }}>
                  <Typography sx={{ fontSize: "0.62rem", color: A.dark, fontWeight: 800 }}>ตั้งเบิก</Typography>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: A.dark }}>{r.planned ? fmtMoney(r.plannedAmount) : "-"}</Typography>
                </Box>
                <Box sx={{ px: 0.75, py: 0.4, borderRadius: 1.5, bgcolor: C.soft }}>
                  <Typography sx={{ fontSize: "0.62rem", color: C.dark, fontWeight: 800 }}>ใช้จริง</Typography>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: C.dark }}>{fmtMoney(r.actualAmount)}</Typography>
                </Box>
                <Box sx={{ px: 0.75, py: 0.4, textAlign: "right" }}>
                  <Typography sx={{ fontSize: "0.62rem", color: TEXT_SUB, fontWeight: 800 }}>ต่าง</Typography>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: diffColor(r.diff) }}>{diffText(r.diff)}</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 0.5, p: 1, borderRadius: 2, bgcolor: "#f1f5f9" }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, color: A.dark }}>{fmtMoney(plannedTotal)}</Typography>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, color: C.dark }}>{fmtMoney(actualTotal)}</Typography>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, textAlign: "right", color: diffColor(diffTotal) }}>{diffText(diffTotal)}</Typography>
        </Box>
      </Stack>
    );
  }

  const grid = "32px minmax(0, 1fr) 118px 118px 96px";
  const cell = { px: 1, py: 0.85, fontSize: "0.84rem" };
  const head = { ...cell, fontSize: "0.74rem", fontWeight: 800, color: TEXT_SUB };
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: grid, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER_MAIN}` }}>
        <Typography sx={head}>#</Typography>
        <Typography sx={head}>รายการ</Typography>
        <Typography sx={{ ...head, textAlign: "right", bgcolor: A.soft, color: A.dark }}>ตั้งเบิก (Advance)</Typography>
        <Typography sx={{ ...head, textAlign: "right", bgcolor: C.soft, color: C.dark }}>ใช้จริง (Claim)</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>ส่วนต่าง</Typography>
      </Box>
      {rows.map((r, i) => {
        const cat = categoryMeta(r.category);
        const faded = r.kind === "unused";
        return (
          <Box key={r.key} sx={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${BORDER_MAIN}`, alignItems: "stretch" }}>
            <Typography sx={{ ...cell, color: TEXT_SUB, fontWeight: 700 }}>{i + 1}</Typography>
            <Box sx={{ ...cell, minWidth: 0, opacity: faded ? 0.75 : 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography sx={{ fontWeight: 700, fontSize: "0.86rem", textDecoration: faded ? "line-through" : "none" }}>{r.description}{r.person?.name ? <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · {r.person.name}</Box> : null}</Typography>
                {COMPARE_KIND_LABEL[r.kind] && <Chip size="small" label={COMPARE_KIND_LABEL[r.kind]} sx={{ height: 18, fontSize: "0.62rem", fontWeight: 800 }} />}
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                <Box component="span" sx={{ color: cat.color, fontWeight: 700 }}>{cat.label}</Box>
                {r.actual ? ` · ${qtyText(r.actual)}` : r.planned ? ` · ตั้งไว้ ${qtyText(r.planned)}` : ""}
                {r.receiptNo ? ` · ใบเสร็จ ${r.receiptNo}` : ""}{r.detail ? ` · ${r.detail}` : ""}
              </Typography>
            </Box>
            <Typography sx={{ ...cell, textAlign: "right", bgcolor: A.soft, color: A.dark, fontWeight: 800 }}>{r.planned ? fmtMoney(r.plannedAmount) : "-"}</Typography>
            <Typography sx={{ ...cell, textAlign: "right", bgcolor: C.soft, color: C.dark, fontWeight: 800 }}>{fmtMoney(r.actualAmount)}</Typography>
            <Typography sx={{ ...cell, textAlign: "right", color: diffColor(r.diff), fontWeight: 800 }}>{diffText(r.diff)}</Typography>
          </Box>
        );
      })}
      <Box sx={{ display: "grid", gridTemplateColumns: grid, bgcolor: "#f1f5f9" }}>
        <Box />
        <Typography sx={{ ...cell, fontWeight: 900 }}>รวม</Typography>
        <Typography sx={{ ...cell, textAlign: "right", fontWeight: 900, color: A.dark, bgcolor: alpha(A.color, 0.12) }}>{fmtMoney(plannedTotal)}</Typography>
        <Typography sx={{ ...cell, textAlign: "right", fontWeight: 900, color: C.dark, bgcolor: alpha(C.color, 0.12) }}>{fmtMoney(actualTotal)}</Typography>
        <Typography sx={{ ...cell, textAlign: "right", fontWeight: 900, color: diffColor(diffTotal) }}>{diffText(diffTotal)}</Typography>
      </Box>
    </Box>
  );
};

const today = () => moment().format("YYYY-MM-DD");

/**
 * กล่องยืนยันการดำเนินการ (อนุมัติ / ตีกลับ / ยกเลิก / จ่ายเงิน / ปิดส่วนต่าง)
 * ⚠️ อยู่ module scope — ประกาศในตัว component หลักจะทำให้ช่องกรอกหลุดโฟกัสทุกตัวอักษร
 */
const ActionDialog = ({ action, expense, busy, error, onCancel, onSubmit }) => {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);
  useEffect(() => {
    if (!action) return;
    setForm({
      reason: "", note: "", paidAt: today(), method: "transfer", ref: "",
      dueClearAt: action === "pay" ? (expense?.dueClearAt ? moment(expense.dueClearAt).format("YYYY-MM-DD") : moment().add(7, "days").format("YYYY-MM-DD")) : "",
      files: [],
    });
  }, [action, expense?._id, expense?.dueClearAt]);
  if (!action) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const slip = slipKind(expense);
  const reimburse = slip === "reimburse";
  const diff = differenceMeta(expense?.difference, slip);
  const cfg = {
    approve: {
      title: "อนุมัติ", color: "#059669", button: "ยืนยันอนุมัติ",
      body: reimburse
        ? `อนุมัติแล้วบริษัทต้องจ่ายคืนให้ ${expense?.requester?.name || "ผู้เบิก"} ${baht(expense?.total)}`
        : expense?.kind === "claim"
          ? (money(expense?.difference) === 0 ? "ใช้จริงพอดีกับยอด Advance — อนุมัติแล้วใบ Advance จะเคลียร์ทันที" : `อนุมัติแล้วรอ${diff.short} ${baht(diff.amount)} ก่อนปิดใบ`)
          : `อนุมัติยอด ${baht(expense?.total)} — ขั้นต่อไปคือบันทึกการจ่ายเงิน`,
    },
    reject: { title: "ตีกลับให้แก้ไข", color: "#dc2626", button: "ตีกลับ", body: "ผู้เบิกจะได้รับแจ้งพร้อมเหตุผล และแก้ไขส่งใหม่ในใบเดิมได้" },
    cancel: {
      title: "ยกเลิกใบนี้", color: "#64748b", button: "ยืนยันยกเลิก",
      // ⚠️ ใบสำรองจ่ายไม่มี Advance ให้คืนสถานะ — ข้อความของใบเคลมใช้กับมันไม่ได้
      body: expense?.kind === "claim" && !reimburse
        ? "ใบ Advance ที่อ้างถึงจะกลับไปรอเคลียร์ และออกใบเคลมใหม่ได้"
        : "ยกเลิกแล้วย้อนกลับไม่ได้ (เลขที่เอกสารจะไม่ถูกนำกลับมาใช้)",
    },
    pay: { title: "บันทึกการจ่ายเงิน Advance", color: KIND_META.advance.color, button: "บันทึกจ่ายเงิน", body: `จ่ายให้ ${expense?.requester?.name || "-"} จำนวน ${baht(expense?.total)}` },
    settle: reimburse
      ? {
        title: "บันทึกจ่ายคืนค่าสำรองจ่าย", color: KIND_META.reimburse.color, button: "บันทึกจ่ายคืน",
        body: `จ่ายคืนให้ ${expense?.requester?.name || "ผู้เบิก"} ${baht(expense?.total)} — บันทึกแล้วใบนี้จะเสร็จสิ้น`,
      }
      : {
        title: money(expense?.difference) > 0 ? "บันทึกจ่ายเงินเพิ่ม" : "บันทึกรับเงินคืน", color: KIND_META.claim.color, button: "ปิดส่วนต่าง",
        body: `${diff.label} ${baht(diff.amount)} — บันทึกแล้วใบ Advance จะเคลียร์เรียบร้อย`,
      },
  }[action];
  const needReason = action === "reject";
  const payLike = action === "pay" || action === "settle";

  return (
    <Dialog open onClose={() => !busy && onCancel()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{cfg.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>{cfg.body}</Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <Stack spacing={1.5}>
          {payLike && (
            <>
              <ThaiDatePicker label={action === "pay" ? "วันที่จ่ายเงิน" : "วันที่"} value={form.paidAt} onChange={(v) => setForm((f) => ({ ...f, paidAt: v || today() }))} />
              <TextField select size="small" label="วิธีการ" value={form.method || "transfer"} onChange={set("method")}>
                {PAYMENT_METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
              <TextField size="small" label="เลขอ้างอิง (ไม่บังคับ)" placeholder="เช่น ธนาคาร / เลขที่รายการ" value={form.ref || ""} onChange={set("ref")} />
              {action === "pay" && (
                <ThaiDatePicker label="กำหนดเคลียร์" value={form.dueClearAt} onChange={(v) => setForm((f) => ({ ...f, dueClearAt: v || "" }))}
                  helperText="ระบบจะเตือนผู้เบิกทุกวันเมื่อเลยกำหนดแล้วยังไม่ส่งใบเคลม" />
              )}
              <input ref={fileRef} type="file" hidden accept={ACCEPT_ALL} multiple onChange={(e) => { const fl = Array.from(e.target.files || []); setForm((f) => ({ ...f, files: [...(f.files || []), ...fl].slice(0, 5) })); e.target.value = ""; }} />
              <Box>
                <Button size="small" startIcon={<AttachFile />} onClick={() => fileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>
                  แนบสลิป / หลักฐาน
                </Button>
                {(form.files || []).map((f, i) => (
                  <Chip key={`${f.name}-${i}`} size="small" label={f.name} onDelete={() => setForm((x) => ({ ...x, files: x.files.filter((_, j) => j !== i) }))} sx={{ m: 0.25, maxWidth: "100%" }} />
                ))}
              </Box>
            </>
          )}
          {(needReason || action === "cancel") && (
            <TextField
              size="small" label={needReason ? "เหตุผลที่ตีกลับ *" : "เหตุผล (ไม่บังคับ)"} value={form.reason || ""} onChange={set("reason")}
              multiline minRows={2} autoFocus inputProps={{ maxLength: 500 }}
              placeholder={needReason ? "เช่น ใบเสร็จค่าน้ำมันไม่ชัด กรุณาแนบใหม่" : ""}
            />
          )}
          {(action === "approve" || payLike) && (
            <TextField size="small" label="หมายเหตุ (ไม่บังคับ)" value={form.note || ""} onChange={set("note")} inputProps={{ maxLength: 500 }} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
        <Button
          variant="contained" disabled={busy || (needReason && !String(form.reason || "").trim())}
          onClick={() => onSubmit(form)}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: cfg.color, "&:hover": { bgcolor: cfg.color, filter: "brightness(0.92)", boxShadow: "none" } }}
        >
          {cfg.button}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function ExpenseDetailDialog({ open, expenseId, reloadKey = 0, notice = null, onLoaded, onClose, onChanged, onEdit, onCreateClaim, onOpenOther }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const [panelOpen, setPanelOpen] = useState(false);
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  // ✅ ข้อความผลการทำรายการอยู่ "ในกล่อง" ไม่ใช่ Snackbar — บนมือถือ Snackbar ลอยทับแถบปุ่มล่างของกล่อง
  // (พิมพ์/แชร์/อนุมัติ) จนกดไม่ได้หลายวินาทีหลังส่งใบ
  const [toast, setToast] = useState("");
  const [toastSeverity, setToastSeverity] = useState("success");
  const [printOpen, setPrintOpen] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!expenseId) return;
    setLoading(true); setLoadError("");
    try {
      const doc = await ExpenseService.get(expenseId);
      setExpense(doc);
      // ✅ บอกหน้าแม่ว่าใบนี้เป็นชนิดไหน — หน้า /expenses/<id> (มาจากลิงก์แจ้งเตือน) จะได้รู้ว่าต้องโชว์
      // พื้นหลังเป็นหน้าใบ Advance หรือใบเคลม และตอนปิดกล่องควรพากลับไปหน้าไหน
      onLoaded?.(doc);
    } catch (err) {
      setLoadError(errorText(err, "เปิดใบนี้ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoaded เป็น callback ของหน้าแม่ ไม่ควรทำให้ผูกใหม่ทุกครั้ง
  }, [expenseId]);

  useEffect(() => {
    if (!open) return;
    setExpense(null); setAction("");
    setToast(notice?.text || "");
    setToastSeverity(notice?.severity || "success");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ข้อความแจ้งผลอ่านเฉพาะตอนเปิดใบ
  }, [open, load]);

  // ✅ บันทึกการแก้ไขจากฟอร์มขณะกล่องนี้เปิดอยู่ (id เดิม) — ข้อความผลต้องขึ้นด้วย
  useEffect(() => {
    if (open && notice?.text) { setToastSeverity(notice.severity || "success"); setToast(notice.text); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ทำงานเฉพาะตอนมีข้อความใหม่
  }, [notice]);

  // ✅ โหลดใหม่เมื่อข้อมูลเปลี่ยนจากที่อื่น (แก้ไขใบจากฟอร์ม / ดำเนินการสำเร็จ) — id เดิม effect ด้านบนจึงไม่ทำงาน
  // ⚠️ ไม่ล้างข้อมูลเดิมก่อนโหลด ไม่งั้นหน้าจอกระพริบเป็นโครงร่างทุกครั้งที่กดปุ่ม
  useEffect(() => {
    if (open && reloadKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งใจให้ทำงานเฉพาะตอน reloadKey เปลี่ยน
  }, [reloadKey]);

  const me = String(userData?.userId || "");
  const e = expense;
  const kind = e?.kind || "advance";
  /**
   * ⚠️ "ชนิดที่ใช้แสดงผล" ไม่เท่ากับ kind — ใบสำรองจ่ายมี kind = "claim" แต่ไม่มี Advance ให้เทียบเลย
   * ทุกส่วนที่เกี่ยวกับการเทียบยอด/ใบอ้างอิง ต้องเช็ค isClearClaim ไม่ใช่ isClaimKind
   */
  const slip = slipKind(e);
  const isReimburse = slip === "reimburse";
  const meta = KIND_META[slip];
  const st = statusMeta(e?.status, slip);
  const isOwner = e && (e.requester?.userId === me || e.createdBy?.userId === me);
  const canApprove = can("approveExpense");
  const viewAll = can("viewAllExpenses");
  const selfBlocked = e && e.requester?.userId === me && !can("manageAll");
  const editable = e && ["pending", "rejected"].includes(e.status);
  const canEdit = editable && (isOwner || viewAll);
  const canCancel = e && ((isOwner && editable) || (canApprove && ["pending", "rejected", "approved"].includes(e.status)));
  const canAddFiles = e && e.status !== "cancelled" && (isOwner || canApprove);
  const canRemoveFile = e && (canApprove ? e.status !== "cancelled" : canEdit);
  const overdue = isOverdueClear(e);

  const applyResult = (updated, message) => {
    setAction("");
    setActionError("");
    setToastSeverity("success");
    setToast(message);
    if (updated) setExpense((cur) => ({ ...cur, ...updated }));
    onChanged?.(updated);
  };

  const runAction = async (form) => {
    setBusy(true); setActionError("");
    try {
      let updated;
      const files = (form.files || []).map((file) => ({ file, kind: "transfer_slip" }));
      if (action === "approve") updated = await ExpenseService.approve(e._id, form.note);
      if (action === "reject") updated = await ExpenseService.reject(e._id, form.reason);
      if (action === "cancel") updated = await ExpenseService.cancel(e._id, form.reason);
      if (action === "pay") updated = (await ExpenseService.pay(e._id, { paidAt: form.paidAt, method: form.method, ref: form.ref, note: form.note, dueClearAt: form.dueClearAt }, files)).expense;
      if (action === "settle") updated = (await ExpenseService.settle(e._id, { paidAt: form.paidAt, method: form.method, ref: form.ref, note: form.note }, files)).expense;
      const msg = { approve: "อนุมัติเรียบร้อย", reject: "ตีกลับให้แก้ไขแล้ว", cancel: "ยกเลิกแล้ว", pay: "บันทึกการจ่ายเงินแล้ว", settle: "ปิดส่วนต่างเรียบร้อย" }[action];
      applyResult(updated, msg);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (list) => {
    const files = Array.from(list || []).map((file) => ({ file, kind: kind === "claim" ? "receipt" : file.type.startsWith("image/") ? "photo" : "other" }));
    if (!files.length) return;
    setBusy(true);
    try {
      const { expense: updated, rejected } = await ExpenseService.addFiles(e._id, files);
      applyResult(updated, rejected.length ? `แนบได้บางไฟล์ — ${rejected.map((r) => r.message).join(", ")}` : "แนบไฟล์แล้ว");
    } catch (err) {
      setToastSeverity("error"); setToast(errorText(err, "แนบไฟล์ไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (file) => {
    if (!window.confirm(`ลบไฟล์ "${file.fileName}" ?`)) return;
    setBusy(true);
    try {
      applyResult(await ExpenseService.removeFile(e._id, file._id), "ลบไฟล์แล้ว");
    } catch (err) {
      setToastSeverity("error"); setToast(errorText(err, "ลบไฟล์ไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  // ── ขั้นต่อไป ────────────────────────────────────────────────────────
  const nextStep = useMemo(() => {
    if (!e) return null;
    const diff = differenceMeta(e.difference, slip);
    if (e.status === "pending") return { severity: "warning", text: canApprove && !selfBlocked ? "รอคุณพิจารณาอนุมัติ" : "รอหัวหน้าพิจารณาอนุมัติ" };
    if (e.status === "rejected") return { severity: "error", text: `ถูกตีกลับโดย ${e.rejectedBy?.name || "-"}: ${e.rejectReason || "-"}` };
    if (e.status === "cancelled") return { severity: "info", text: `ยกเลิกโดย ${e.cancelledBy?.name || "-"} ${e.cancelledAt ? `เมื่อ ${thaiDate(e.cancelledAt)}` : ""}${e.cancelReason ? ` · ${e.cancelReason}` : ""}` };
    if (kind === "advance") {
      if (e.status === "approved") return { severity: "info", text: `อนุมัติแล้ว — รอบันทึกการจ่ายเงิน ${baht(e.total)}` };
      if (e.status === "paid") {
        return overdue
          ? { severity: "error", text: `เลยกำหนดเคลียร์ (${thaiDate(e.dueClearAt)}) — กรุณาส่งใบเคลม` }
          : { severity: "info", text: `รับเงินแล้ว — ส่งใบเคลมพร้อมใบเสร็จ${e.dueClearAt ? ` ภายใน ${thaiDateFull(e.dueClearAt)}` : ""}` };
      }
      if (e.status === "clearing") return { severity: "info", text: `ส่งใบเคลม ${e.claimDocNo || ""} แล้ว — รอตรวจ/ปิดส่วนต่าง` };
      if (e.status === "cleared") return { severity: "success", text: `เคลียร์เรียบร้อยด้วยใบเคลม ${e.claimDocNo || ""}` };
    } else if (isReimburse) {
      if (e.status === "approved") return { severity: "info", text: `อนุมัติแล้ว — รอบริษัทจ่ายคืน ${baht(e.total)}` };
      if (e.status === "settled") return { severity: "success", text: `จ่ายคืนเรียบร้อย ${baht(e.total)}` };
    } else {
      if (e.status === "approved") return { severity: "info", text: `อนุมัติแล้ว — รอ${diff.short} ${baht(diff.amount)}` };
      if (e.status === "settled") return { severity: "success", text: diff.amount ? `ปิดส่วนต่างเรียบร้อย (${diff.short} ${baht(diff.amount)})` : "เคลียร์เรียบร้อย ไม่มีส่วนต่าง" };
    }
    return null;
  }, [e, kind, slip, isReimburse, overdue, canApprove, selfBlocked]);

  const steps = useMemo(() => {
    if (!e) return [];
    if (kind === "advance") {
      return [
        { label: "ส่งขอเบิก", done: true, date: e.submittedAt || e.createdAt },
        { label: "อนุมัติ", done: Boolean(e.approvedAt) && !["pending", "rejected"].includes(e.status), date: e.approvedAt, danger: e.status === "rejected" },
        { label: "จ่ายเงิน", done: ["paid", "clearing", "cleared"].includes(e.status), date: e.payment?.at },
        { label: "เคลียร์", done: e.status === "cleared", danger: overdue },
      ];
    }
    return [
      { label: isReimburse ? "ส่งขอเบิกคืน" : "ส่งเคลม", done: true, date: e.submittedAt || e.createdAt },
      { label: "อนุมัติ", done: ["approved", "settled"].includes(e.status), date: e.approvedAt, danger: e.status === "rejected" },
      { label: isReimburse ? "จ่ายคืน" : "ปิดส่วนต่าง", done: e.status === "settled", date: e.status === "settled" ? e.payment?.at : null },
    ];
  }, [e, kind, isReimburse, overdue]);

  const isClaimKind = kind === "claim";
  const isClearClaim = isClaimKind && !isReimburse;
  // ✅ ผู้ใช้ขอให้ใบเคลมมีรายละเอียดของ Advance "ข้างๆ" — จอกว้างวางเป็นคอลัมน์ขวา ติดอยู่กับที่ขณะเลื่อน
  const sidePanel = isClearClaim && e?.advanceDoc;

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose?.()} fullWidth maxWidth={isClearClaim ? "lg" : "md"} fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
        <DialogTitle sx={{ p: 0 }}>
          {/* ✅ หัวกล่องเป็นสีประจำชนิดใบ — Advance เขียวอมฟ้า / Claim ม่วง พร้อมป้าย ADVANCE/CLAIM */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{
            px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${alpha(meta.color, 0.25)}`,
            borderTop: `5px solid ${meta.color}`, bgcolor: meta.soft,
          }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: meta.color, color: "#fff",
            }}>
              {isReimburse ? <AccountBalanceWallet sx={{ fontSize: 21 }} /> : isClaimKind ? <ReceiptLong sx={{ fontSize: 21 }} /> : <Payments sx={{ fontSize: 21 }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <KindBadge kind={slip} />
                <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3, color: meta.dark }} noWrap>
                  {e?.docNo || meta.label}
                </Typography>
              </Stack>
              {e && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.4 }}>
                  <Chip size="small" label={st.label} sx={{ height: 20, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha(st.color, 0.12), color: st.color }} />
                  {overdue && <Chip size="small" icon={<WarningAmber sx={{ fontSize: "14px !important" }} />} label="เลยกำหนดเคลียร์" sx={{ height: 20, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha("#dc2626", 0.1), color: "#dc2626" }} />}
                </Stack>
              )}
            </Box>
            <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "14px !important" }}>
          {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{loadError}</Alert>}
          {!e && loading && (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={90} />
              <Skeleton variant="rounded" height={160} />
              <Skeleton variant="rounded" height={120} />
            </Stack>
          )}
          {e && (
            <Box sx={{
              display: "grid", gap: 2, alignItems: "start",
              gridTemplateColumns: { xs: "1fr", md: sidePanel ? "minmax(0, 1fr) 330px" : "1fr" },
            }}>
            <Box sx={{ minWidth: 0 }}>
              {toast && <Alert severity={toastSeverity} onClose={() => setToast("")} sx={{ mb: 1.5, borderRadius: 2 }}>{toast}</Alert>}

              <Card>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.35 }}>{e.subject}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                      {thaiDateFull(e.docDate)} · {e.requester?.name}{e.requester?.position ? ` (${e.requester.position})` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { sm: "right" } }}>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{isReimburse ? "ยอดขอเบิกคืน" : kind === "claim" ? "ใช้จ่ายจริง" : "ยอดขอเบิก"}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.45rem", color: meta.color, lineHeight: 1.1 }}>{baht(e.total)}</Typography>
                  </Box>
                </Stack>
                {nextStep && <Alert severity={nextStep.severity} sx={{ mt: 1.5, borderRadius: 2, py: 0.25, "& .MuiAlert-message": { fontSize: "0.84rem", fontWeight: 600 } }}>{nextStep.text}</Alert>}
                {e.status !== "cancelled" && <Steps steps={steps} color={meta.color} />}
              </Card>

              {/* ✅ ใบสำรองจ่ายไม่มีใบ Advance ให้เทียบ — ข้ามการ์ดเทียบยอดไปใช้ตารางรายการธรรมดาแทน
                  (การ์ดเทียบที่มีช่อง "ยอดเบิก Advance" เป็น 0 ตลอดคือข้อมูลที่ทำให้เข้าใจผิด ไม่ใช่ข้อมูลที่ขาด) */}
              {isClearClaim && (
                <Card title={isDesktop ? "เทียบรายการ: ตั้งเบิก (Advance) กับ ใช้จริง (Claim)" : "เทียบกับใบ Advance"} icon={<LinkIcon sx={{ fontSize: 18, color: meta.color }} />}
                  action={e.advanceId && (
                    <Button size="small" onClick={() => onOpenOther?.(e.advanceId)} endIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                      sx={{ textTransform: "none", fontWeight: 800, color: KIND_META.advance.dark, whiteSpace: "nowrap" }}>
                      {e.advance?.docNo}
                    </Button>
                  )}>
                  {(() => {
                    const d = differenceMeta(e.difference, slip);
                    return (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1, mb: 1.5 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: KIND_META.advance.soft, border: `1px solid ${alpha(KIND_META.advance.color, 0.3)}` }}>
                          <Typography variant="caption" sx={{ color: KIND_META.advance.dark, fontWeight: 800 }}>ยอดเบิก Advance</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: KIND_META.advance.dark }}>{baht(e.advance?.total)}</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: KIND_META.claim.soft, border: `1px solid ${alpha(KIND_META.claim.color, 0.3)}` }}>
                          <Typography variant="caption" sx={{ color: KIND_META.claim.dark, fontWeight: 800 }}>ใช้จ่ายจริง</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: KIND_META.claim.dark }}>{baht(e.total)}</Typography>
                        </Box>
                        <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, p: 1, borderRadius: 2, bgcolor: alpha(d.color, 0.08), border: `1px solid ${alpha(d.color, 0.3)}` }}>
                          <Typography variant="caption" sx={{ color: d.color, fontWeight: 800 }}>{d.label}</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: d.color }}>{d.amount ? baht(d.amount) : "—"}</Typography>
                        </Box>
                      </Box>
                    );
                  })()}
                  <CompareTable items={e.items} advanceItems={e.advanceDoc?.items} wide={isDesktop} />
                  {!e.items?.length && e.note && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>ไม่มีรายการใช้จริง — ดูหมายเหตุ</Typography>}
                </Card>
              )}

              {/* จอแคบ: รายละเอียดใบ Advance พับไว้ใต้ตารางเทียบ */}
              {sidePanel && !isDesktop && (
                <Box sx={{ mb: 1.5 }}>
                  <Button fullWidth onClick={() => setPanelOpen((v) => !v)}
                    endIcon={<ExpandMore sx={{ transform: panelOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                    sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 800, color: KIND_META.advance.dark, bgcolor: KIND_META.advance.soft, border: `1px solid ${alpha(KIND_META.advance.color, 0.35)}`, borderRadius: 2.5, px: 1.5 }}>
                    {panelOpen ? "ซ่อนรายละเอียดใบ Advance" : `ดูรายละเอียดใบ Advance ${e.advance?.docNo || ""}`}
                  </Button>
                  <Collapse in={panelOpen} unmountOnExit>
                    <AdvancePanel advance={e.advanceDoc} onOpen={() => onOpenOther?.(e.advanceId)} sx={{ mt: 1 }} />
                  </Collapse>
                </Box>
              )}

              <Card title="ข้อมูลเอกสาร">
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
                  <InfoCell label="เลขที่">{e.docNo}</InfoCell>
                  <InfoCell label="วันที่">{thaiDate(e.docDate)}</InfoCell>
                  <InfoCell label="ถึง">{e.to}</InfoCell>
                  <InfoCell label="ผู้เบิกเงิน">{e.requester?.name}</InfoCell>
                  <InfoCell label="ตำแหน่ง">{e.requester?.position}</InfoCell>
                  {e.createdBy?.userId && e.createdBy.userId !== e.requester?.userId && <InfoCell label="ออกใบแทนโดย">{e.createdBy.name}</InfoCell>}
                  <InfoCell label="งานที่ผูก" span>{e.eventId || e.job?.title ? `${jobText(e.job)}${e.job?.start ? ` · ${thaiDate(e.job.start)}` : ""}` : "ไม่ผูกงาน"}</InfoCell>
                  {isReimburse && <InfoCell label="ที่มาของเงิน">ผู้เบิกสำรองจ่ายเอง (ไม่มีใบ Advance)</InfoCell>}
                  {kind === "advance" && e.dueClearAt && <InfoCell label="กำหนดเคลียร์"><Box component="span" sx={{ color: overdue ? "#dc2626" : "inherit" }}>{thaiDate(e.dueClearAt)}</Box></InfoCell>}
                  {kind === "advance" && e.claimId && (
                    <InfoCell label="ใบเคลม">
                      <Button size="small" onClick={() => onOpenOther?.(e.claimId)} sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 700 }}>{e.claimDocNo}</Button>
                    </InfoCell>
                  )}
                  {e.approvedAt && !["pending", "rejected"].includes(e.status) && <InfoCell label="ผู้อนุมัติ">{e.approvedBy?.name} · {thaiDate(e.approvedAt)}</InfoCell>}
                  {e.payment?.at && ((kind === "advance" && ["paid", "clearing", "cleared"].includes(e.status)) || (kind === "claim" && e.status === "settled" && money(e.difference) !== 0)) && (
                    <InfoCell label={kind === "advance" ? "การจ่ายเงิน" : isReimburse ? "การจ่ายคืน" : "ปิดส่วนต่าง"} span>
                      {thaiDate(e.payment.at)} · {paymentLabel(e.payment.method)}{e.payment.ref ? ` · ${e.payment.ref}` : ""}{e.payment.by?.name ? ` · โดย ${e.payment.by.name}` : ""}{e.payment.note ? ` · ${e.payment.note}` : ""}
                    </InfoCell>
                  )}
                  {e.note && <InfoCell label="หมายเหตุ" span>{e.note}</InfoCell>}
                </Box>
              </Card>

              {!isClearClaim && (
                <Card title={`รายการ (${e.items?.length || 0})`} action={<Typography sx={{ fontWeight: 800, color: meta.color }}>{baht(e.total)}</Typography>}>
                  {!e.items?.length && <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีรายการค่าใช้จ่าย{e.note ? " — ดูหมายเหตุ" : ""}</Typography>}
                  <Stack divider={<Divider flexItem />} spacing={1}>
                    {(e.items || []).map((it, i) => {
                      const cat = categoryMeta(it.category);
                      return (
                        <Stack key={it._id || i} direction="row" spacing={1.25} alignItems="flex-start">
                          <Typography sx={{ width: 20, color: TEXT_SUB, fontWeight: 700, fontSize: "0.82rem", pt: 0.2 }}>{i + 1}</Typography>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{it.description}{it.person?.name ? <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · {it.person.name}</Box> : null}</Typography>
                            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                              <Chip size="small" label={cat.label} sx={{ height: 18, fontSize: "0.66rem", fontWeight: 700, bgcolor: alpha(cat.color, 0.1), color: cat.color }} />
                              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{qtyText(it)}</Typography>
                              {it.receiptNo && <Typography variant="caption" sx={{ color: TEXT_SUB }}>· ใบเสร็จ {it.receiptNo}</Typography>}
                            </Stack>
                            {it.detail && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{it.detail}</Typography>}
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.92rem" }}>{fmtMoney(it.amount)}</Typography>
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Card>
              )}

              <Card title={`หลักฐาน / ไฟล์แนบ (${e.attachments?.length || 0})`} icon={<AttachFile sx={{ fontSize: 18, color: TEXT_SUB }} />}
                action={canAddFiles && (
                  <Button size="small" startIcon={<AttachFile />} disabled={busy} onClick={() => fileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>แนบเพิ่ม</Button>
                )}>
                <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(ev) => { uploadFiles(ev.target.files); ev.target.value = ""; }} />
                {!e.attachments?.length ? (
                  <Typography variant="body2" sx={{ color: TEXT_SUB }}>{kind === "claim" ? "ยังไม่มีใบเสร็จแนบ" : "ไม่มีไฟล์แนบ"}</Typography>
                ) : (
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                    {e.attachments.map((f) => {
                      const isImg = String(f.fileType || "").startsWith("image/");
                      return (
                        <Stack key={f._id} direction="row" spacing={1} alignItems="center" sx={{ p: 0.75, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, minWidth: 0 }}>
                          <Box component="a" href={f.fileUrl} target="_blank" rel="noreferrer" sx={{
                            width: 44, height: 44, borderRadius: 1.5, flexShrink: 0, overflow: "hidden", bgcolor: "#f1f5f9",
                            display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_SUB,
                          }}>
                            {isImg ? <Box component="img" src={f.fileUrl} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                              : String(f.fileType).includes("pdf") ? <Description /> : <ImageIcon />}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography component="a" href={f.fileUrl} target="_blank" rel="noreferrer" sx={{ fontSize: "0.82rem", fontWeight: 700, color: TEXT_MAIN, textDecoration: "none", display: "block" }} noWrap>{f.fileName}</Typography>
                            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{fileKindLabel(f.kind)} · {f.uploadedBy} · {thaiDate(f.uploadedAt)}</Typography>
                          </Box>
                          {canRemoveFile && (
                            <Tooltip title="ลบไฟล์"><IconButton size="small" disabled={busy} onClick={() => removeFile(f)}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
                          )}
                        </Stack>
                      );
                    })}
                  </Box>
                )}
              </Card>

              <Card title="ประวัติ" icon={<History sx={{ fontSize: 18, color: TEXT_SUB }} />}>
                <Stack spacing={1}>
                  {[...(e.activityLog || [])].reverse().map((a, i) => (
                    <Stack key={a._id || i} direction="row" spacing={1.25}>
                      <Box sx={{ width: 8, height: 8, mt: 0.8, borderRadius: "50%", flexShrink: 0, bgcolor: i === 0 ? meta.color : "#cbd5e1" }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600 }}>{a.detail}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB }}>{a.userName} · {thaiDateTime(a.timestamp)}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            </Box>
            {sidePanel && isDesktop && (
              <Box sx={{ position: "sticky", top: 0, minWidth: 0 }}>
                <AdvancePanel advance={e.advanceDoc} onOpen={() => onOpenOther?.(e.advanceId)} />
              </Box>
            )}
            </Box>
          )}
        </DialogContent>

        {e && (
          <DialogActions sx={{ px: { xs: 1, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button onClick={() => setPrintOpen(true)} startIcon={<Print sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 700, mr: "auto" }}>
              พิมพ์ / แชร์
            </Button>
            {canCancel && (
              <Button onClick={() => setAction("cancel")} startIcon={<Block sx={{ fontSize: 17 }} />} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>
                ยกเลิก
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => onEdit?.(e)} startIcon={<Edit sx={{ fontSize: 17 }} />} sx={{ textTransform: "none", fontWeight: 700 }}>
                {e.status === "rejected" ? "แก้ไข / ส่งใหม่" : "แก้ไข"}
              </Button>
            )}
            {canApprove && e.status === "pending" && (
              <>
                <Button onClick={() => setAction("reject")} disabled={selfBlocked} startIcon={<Undo sx={{ fontSize: 17 }} />} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>
                  ตีกลับ
                </Button>
                <Tooltip title={selfBlocked ? "อนุมัติใบของตัวเองไม่ได้ — ให้หัวหน้าท่านอื่นเป็นผู้อนุมัติ" : ""}>
                  <span>
                    <Button variant="contained" disabled={selfBlocked} onClick={() => setAction("approve")} startIcon={<CheckCircle sx={{ fontSize: 18 }} />}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>
                      อนุมัติ
                    </Button>
                  </span>
                </Tooltip>
              </>
            )}
            {canApprove && kind === "advance" && e.status === "approved" && (
              <Button variant="contained" onClick={() => setAction("pay")} startIcon={<Payments sx={{ fontSize: 18 }} />}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: meta.color, "&:hover": { bgcolor: meta.dark, boxShadow: "none" } }}>
                บันทึกจ่ายเงิน
              </Button>
            )}
            {canApprove && kind === "claim" && e.status === "approved" && (
              <Button variant="contained" onClick={() => setAction("settle")} startIcon={<TaskAlt sx={{ fontSize: 18 }} />}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: meta.color, "&:hover": { bgcolor: meta.dark, boxShadow: "none" } }}>
                {isReimburse ? "บันทึกจ่ายคืน" : money(e.difference) > 0 ? "บันทึกจ่ายเพิ่ม" : "บันทึกรับเงินคืน"}
              </Button>
            )}
            {kind === "advance" && e.status === "paid" && (isOwner || viewAll) && (
              <Button variant="contained" onClick={() => onCreateClaim?.(e)} startIcon={<ReceiptLong sx={{ fontSize: 18 }} />}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: KIND_META.claim.color, "&:hover": { bgcolor: KIND_META.claim.dark, boxShadow: "none" } }}>
                ออกใบเคลม
              </Button>
            )}
          </DialogActions>
        )}
      </Dialog>

      <ActionDialog action={action} expense={e} busy={busy} error={actionError} onCancel={() => { setAction(""); setActionError(""); }} onSubmit={runAction} />
      <ExpensePrintDialog open={printOpen} expense={e} onClose={() => setPrintOpen(false)} />
    </>
  );
}
