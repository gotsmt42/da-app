/**
 * ServiceReportSummaryDialog — "สรุป Service Report ด้วย AI" → ตรวจ/แก้ → ยืนยัน → PDF สรุปรายงานบริการ
 *
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "ทำระบบให้อ่าน Service Report ของช่าง แล้วให้กดสร้างสรุปออกมาเป็น PDF ทำให้สมบูรณ์ที่สุด")
 *    1) กด "สรุปด้วย AI" — AI อ่านทุกไฟล์ Service Report ของงาน (รูป/PDF · ลายมือ · หลายแผ่น) แล้วบันทึกเป็น "ร่าง"
 *    2) หน้าสรุปแสดง 2 หัวข้อ: รายละเอียดงานที่ทำ · สรุปปัญหาที่พบ · จุดที่ AI อ่านไม่ชัดขึ้นกล่องส้มด้านบน ให้ตรวจก่อน
 *       🔁 (25 ต.ค. 2569 ผู้ใช้: "เอาแค่เนื้อหารายละเอียดงานที่ทำ ไม่ต้องอ่านหัวกระดาษ และท้ายกระดาษ ... และสรุปปัญหาที่พบ")
 *       ไม่แสดงข้อมูลงานซ้ำ (ผู้ใช้: "ส่วนตรงนี้ไม่ต้องอ่าน ไม่ต้องสรุปมาให้เปลือง") — Excel ยังมีเลขที่/โครงการ/วันที่ไว้กรอง
 *    3) กด "แก้ไข" แก้ได้ทุกช่อง (รายการแบบ 1 บรรทัด = 1 ข้อ · ตารางเพิ่ม/ลบแถวได้) → บันทึก หรือ "ยืนยันสรุป"
 *    4) "สร้าง PDF" — หัวกระดาษบริษัท พร้อมดาวน์โหลด/แชร์/พิมพ์ (ร่างก็ออกได้ แต่ท้ายเอกสารระบุว่าเป็นฉบับร่าง)
 *    5) "Excel" — ชีตสรุปงาน + ชีตปัญหาที่พบ (จำนวนเป็นตัวเลขจริง) ไว้ลงรายงานสรุป
 * ⚠️ jsPDF + ฟอนต์ไทย (~0.5MB) และ ExcelJS โหลดตอนกดปุ่มเท่านั้น — หน้าต่างเปิดเร็ว ไม่กระตุก
 * ⚠️ ข้อมูลอยู่ฝั่งเซิร์ฟเวอร์ (ServiceReportSummary) — งานหลายวันใช้สรุปเดียวกันทั้งงาน
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, LinearProgress,
  MenuItem, Stack, TextField, Typography, useMediaQuery,
} from "@mui/material";
import {
  AutoAwesome, Close, EditOutlined, PictureAsPdf, Refresh, TaskAlt, AddRounded, DeleteOutline, WarningAmberRounded,
  Description, CheckCircleRounded, GridOnRounded,
} from "@mui/icons-material";
import Swal from "@/shared/ui/swal";
import EventService from "@/shared/services/EventService";
import DocumentPreviewDialog from "./DocumentPreviewDialog";
import { ISSUE_STATUS, issueStats, jobInfoOf } from "../utils/serviceReportData";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, PRIMARY_BTN_SX, SUCCESS_BTN_SX } from "@/shared/ui/PageKit";

const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap", minHeight: 38 };
const EMPTY = { found: true, summary: "", workDone: [], issueSummary: "", issues: [], reviewNotes: [], confidence: "medium" };
const withDefaults = (d) => {
  const x = { ...EMPTY, ...(d || {}) };
  return { ...x, workDone: Array.isArray(x.workDone) ? x.workDone : [], issues: Array.isArray(x.issues) ? x.issues : [], reviewNotes: Array.isArray(x.reviewNotes) ? x.reviewNotes : [] };
};
const fmtAt = (d) => (d ? new Date(d).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// ─── ชิ้นส่วนแสดงผล ─────────────────────────────────────────────────────────
const Section = ({ n, title, children, right }) => (
  <Box sx={{ mt: 2 }}>
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 0.75 }}>
      <Box sx={{ minWidth: 22, height: 22, px: 0.5, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, fontSize: "0.74rem", fontWeight: 900 }}>{n}</Box>
      <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "0.95rem", color: INK, whiteSpace: "nowrap" }}>{title}</Typography>
      {right}
    </Stack>
    {children}
  </Box>
);
const Card = ({ children, sx }) => <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, ...sx }}>{children}</Box>;
const Bullets = ({ items, numbered }) => (
  <Box component={numbered ? "ol" : "ul"} sx={{ m: 0, pl: 2.5, "& li": { fontSize: "0.88rem", color: INK_2, lineHeight: 1.6, mb: 0.25 } }}>
    {items.map((t, i) => <li key={i}>{t}</li>)}
  </Box>
);
const MiniTable = ({ head, rows, aligns = [] }) => (
  <Box sx={{ overflowX: "auto", border: `1px solid ${LINE}`, borderRadius: 2 }}>
    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem",
      "& th": { bgcolor: SURFACE, color: MUTED, fontWeight: 800, fontSize: "0.74rem", textAlign: "left", px: 1, py: 0.75, whiteSpace: "nowrap", borderBottom: `1px solid ${LINE}` },
      "& td": { px: 1, py: 0.75, color: INK_2, borderTop: `1px solid ${LINE}`, verticalAlign: "top" } }}>
      <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: aligns[i] || "left" }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: aligns[j] || "left" }}>{c}</td>)}</tr>)}</tbody>
    </Box>
  </Box>
);
const ISSUE_TONE = { fixed: "#15803d", pending: "#b45309", need_quote: "#c2410c", unknown: MUTED };

/** หน้าสรุปแบบอ่าน */
function SummaryView({ d }) {
  const st = issueStats(d.issues);
  return (
    <>
      <Section n={1} title="รายละเอียดงานที่ทำ">
        <Card>
          {d.summary && <Typography sx={{ fontSize: "0.9rem", color: INK, lineHeight: 1.7, mb: d.workDone.length ? 1 : 0 }}>{d.summary}</Typography>}
          {d.workDone.length > 0 && <Bullets items={d.workDone} numbered />}
          {!d.summary && !d.workDone.length && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>ไม่มีรายละเอียดในเอกสาร</Typography>}
        </Card>
      </Section>
      <Section n={2} title="สรุปปัญหาที่พบ"
        right={st.total > 0 && (
          <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
            {st.pending > 0 && <Chip size="small" label={`ยังค้าง ${st.pending}`} sx={{ fontWeight: 800, bgcolor: "#fffbeb", color: ISSUE_TONE.pending }} />}
            {st.needQuote > 0 && <Chip size="small" label={`ต้องเสนอราคา ${st.needQuote}`} sx={{ fontWeight: 800, bgcolor: "#fff7ed", color: ISSUE_TONE.need_quote }} />}
            {st.fixed > 0 && <Chip size="small" label={`แก้แล้ว ${st.fixed}`} sx={{ fontWeight: 800, bgcolor: "#f0fdf4", color: ISSUE_TONE.fixed }} />}
          </Stack>
        )}>
        {!st.total && !d.issueSummary ? (
          <Card><Typography sx={{ fontSize: "0.88rem", color: ISSUE_TONE.fixed, fontWeight: 700 }}>ไม่พบปัญหา</Typography></Card>
        ) : (
          <>
            {d.issueSummary && <Card sx={{ mb: st.total ? 1 : 0 }}><Typography sx={{ fontSize: "0.9rem", color: INK, lineHeight: 1.7 }}>{d.issueSummary}</Typography></Card>}
            {st.total > 0 && (
              <MiniTable head={["#", "ตำแหน่ง", "ปัญหา", "อุปกรณ์ / รุ่น", "จำนวน", "สถานะ"]} aligns={["center", "left", "left", "left", "center", "center"]}
                rows={d.issues.map((r, i) => [i + 1, r.location || "-", r.problem || "-", r.part || "-", r.qty || "-",
                  <span key="s" style={{ fontWeight: 800, color: ISSUE_TONE[r.status], whiteSpace: "nowrap" }}>{ISSUE_STATUS[r.status]}</span>])} />
            )}
          </>
        )}
      </Section>
    </>
  );
}

// ─── แก้ไข ──────────────────────────────────────────────────────────────────
const linesToArr = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const tf = { size: "small", fullWidth: true, InputLabelProps: { shrink: true } };

/** ตารางแก้ไขแบบแถว: cols = [{ key, label, flex, select? }] */
function RowEditor({ rows, cols, onChange, blank }) {
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Stack spacing={1}>
      {rows.map((r, i) => (
        <Stack key={i} direction={{ xs: "column", sm: "row" }} gap={0.75} sx={{ p: 1, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          {cols.map((c) => (
            <TextField key={c.key} {...tf} label={c.label} value={r[c.key] ?? ""} select={Boolean(c.select)}
              onChange={(e) => set(i, c.key, e.target.value)} sx={{ flex: c.flex || 1 }} multiline={c.multiline}>
              {c.select && Object.entries(c.select).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
          ))}
          <IconButton size="small" aria-label="ลบแถว" onClick={() => onChange(rows.filter((_, j) => j !== i))} sx={{ alignSelf: "center" }}><DeleteOutline fontSize="small" /></IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddRounded />} onClick={() => onChange([...rows, { ...blank }])} sx={{ ...BTN, alignSelf: "flex-start", color: ACCENT }}>เพิ่มแถว</Button>
    </Stack>
  );
}

function SummaryEditor({ d, setD }) {
  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      <Section n={1} title="รายละเอียดงานที่ทำ">
        <TextField {...tf} multiline minRows={3} label="สรุปงานที่ทำ (2–4 ประโยค)" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
        <TextField {...tf} multiline minRows={6} sx={{ mt: 1 }} label="รายละเอียดงานที่ทำ (บรรทัดละ 1 เรื่อง)" value={d.workDone.join("\n")} onChange={(e) => setD({ ...d, workDone: linesToArr(e.target.value) })} />
      </Section>
      <Section n={2} title="สรุปปัญหาที่พบ">
        <TextField {...tf} multiline minRows={3} label="สรุปปัญหาที่พบ (ไม่พบปัญหา = เว้นว่าง)" value={d.issueSummary} onChange={(e) => setD({ ...d, issueSummary: e.target.value })} />
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 700, mt: 1.25, mb: 0.75 }}>รายการปัญหา / อุปกรณ์ที่ต้องเปลี่ยน (1 แถว = 1 จุด หรือ 1 รุ่น)</Typography>
        <RowEditor rows={d.issues} onChange={(v) => setD({ ...d, issues: v })} blank={{ location: "", problem: "", part: "", qty: "", status: "pending" }}
          cols={[{ key: "location", label: "ตำแหน่ง" }, { key: "problem", label: "ปัญหา / อาการ", flex: 2, multiline: true }, { key: "part", label: "อุปกรณ์ / รุ่น", flex: 1.4 },
            { key: "qty", label: "จำนวน", flex: 0.7 }, { key: "status", label: "สถานะ", select: ISSUE_STATUS }]} />
      </Section>
    </Stack>
  );
}

/**
 * @param event  งาน (ใช้ _id + ข้อมูลประกอบ PDF: jobNo · company · site · system · title)
 */
export default function ServiceReportSummaryDialog({ open, onClose, event, onChanged }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [state, setState] = useState({ loading: true });
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const id = event?._id;

  const load = useCallback(async () => {
    if (!id) return;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await EventService.GetServiceReportSummary(id);
      setState({ loading: false, ...r });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.message || "โหลดไม่สำเร็จ" });
    }
  }, [id]);
  useEffect(() => { if (open) { setEditing(false); load(); } }, [open, load]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const summary = state.summary;
  const data = useMemo(() => withDefaults(summary?.data), [summary]);
  const info = useMemo(() => jobInfoOf(event || {}, state.sessions), [event, state.sessions]);
  const meta = useMemo(() => ({
    fileCount: summary?.data?.fileCount || summary?.files?.length || 0,
    confirmedBy: summary?.status === "confirmed" ? summary?.confirmedBy : "", confirmedAt: summary?.confirmedAt,
  }), [summary]);

  const scan = async (force = false) => {
    setScanning(true);
    try {
      const r = await EventService.ScanServiceReport(id, force);
      setState((s) => ({ ...s, summary: r.summary, rescanLeft: r.rescanLeft ?? s.rescanLeft }));
      setEditing(false);
      onChanged?.(r.summary?.status || "draft");
    } catch (err) {
      const res = err?.response?.data;
      if (err?.response?.status === 429) {
        setState((s) => ({ ...s, rescanLeft: 0 }));
        Swal.fire({ icon: "warning", title: "อ่านใหม่ครบโควตาวันนี้แล้ว", text: res?.message });
      } else if (err?.response?.status === 409 && res?.needForce) {
        const ok = await Swal.fire({ icon: "warning", title: "อ่านใหม่ทับสรุปเดิม?", text: res.message, showCancelButton: true, confirmButtonText: "อ่านใหม่", cancelButtonText: "ยกเลิก" });
        if (ok.isConfirmed) { setScanning(false); scan(true); return; }
      } else {
        Swal.fire({ icon: "error", title: "สรุปด้วย AI ไม่สำเร็จ", text: res?.message || (err?.code === "ECONNABORTED" ? "ใช้เวลานานเกินไป ลองใหม่อีกครั้ง" : "กรุณาลองใหม่") });
      }
    }
    setScanning(false);
  };

  const save = async (confirm) => {
    setSaving(true);
    try {
      const r = await EventService.SaveServiceReportSummary(id, editing ? draft : undefined, confirm);
      setState((s) => ({ ...s, summary: r.summary }));
      setEditing(false);
      onChanged?.(r.summary?.status || (confirm ? "confirmed" : "draft"));
      if (confirm) Swal.fire({ icon: "success", title: "ยืนยันสรุปแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
    setSaving(false);
  };

  const makePdf = async () => {
    setPdfBusy(true);
    try {
      const [{ jsPDF }, { default: thSarabunFont }, { generateServiceReportSummaryPdf }] = await Promise.all([
        import("jspdf"), import("@/assets/fonts/THSarabunNew_base64"), import("../utils/serviceReportSummaryPdf"),
      ]);
      const out = await generateServiceReportSummaryPdf({ jsPDF, thSarabunFont, data: editing ? withDefaults(draft) : data, info, meta, mode: "blob" });
      setPreview(out);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "สร้าง PDF ไม่สำเร็จ", text: "กรุณาลองใหม่" });
    }
    setPdfBusy(false);
  };

  const [xlsBusy, setXlsBusy] = useState(false);
  const makeExcel = async () => {
    setXlsBusy(true);
    try {
      const { exportServiceReportExcel } = await import("../utils/serviceReportExcel");
      const safe = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").trim();
      await exportServiceReportExcel([{ info, summary: { ...summary, data: editing ? withDefaults(draft) : data } }],
        `สรุป Service Report ${safe(info.jobNo)} ${safe(info.site)}.xlsx`.replace(/\s+/g, " "), [info.jobNo, info.site].filter(Boolean).join(" · "));
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "ส่งออก Excel ไม่สำเร็จ", text: "กรุณาลองใหม่" });
    }
    setXlsBusy(false);
  };

  const files = state.files || [];
  // 💰 อ่านใหม่ได้ 3 ครั้ง/วัน/งาน (เซิร์ฟเวอร์บังคับ — หน้าจอบอกให้รู้ก่อนกด)
  const rescanLeft = state.rescanLeft ?? 3;
  const confirmed = summary?.status === "confirmed";
  const lowConfidence = data.confidence === "low";

  return (
    <>
      <Dialog open={open} onClose={scanning || saving ? undefined : onClose} fullScreen={isMobile} fullWidth maxWidth="md"
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, bgcolor: SURFACE } }}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.25, bgcolor: "#fff", borderBottom: `1px solid ${LINE}`, pt: isMobile ? "calc(10px + env(safe-area-inset-top))" : 1.25 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, flexShrink: 0 }}><AutoAwesome sx={{ fontSize: 20 }} /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>สรุป Service Report</Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[event?.jobNo, event?.site || event?.company].filter(Boolean).join(" · ")}</Typography>
          </Box>
          {summary && (
            <Chip size="small" icon={confirmed ? <CheckCircleRounded /> : undefined} label={confirmed ? "ยืนยันแล้ว" : "ร่าง"}
              sx={{ fontWeight: 800, bgcolor: confirmed ? "#f0fdf4" : "#fffbeb", color: confirmed ? "#15803d" : "#b45309", "& .MuiChip-icon": { color: "#16a34a" } }} />
          )}
          <IconButton onClick={onClose} disabled={scanning || saving} aria-label="ปิด"><Close /></IconButton>
        </Stack>

        <DialogContent sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5 }}>
          {state.loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={28} /></Stack>
          ) : state.error ? (
            <Alert severity="error">{state.error}</Alert>
          ) : scanning ? (
            <Card sx={{ textAlign: "center", py: 4 }}>
              <AutoAwesome sx={{ fontSize: 34, color: ACCENT, mb: 1 }} />
              <Typography sx={{ fontWeight: 800, color: INK }}>AI กำลังอ่าน Service Report {files.length} ไฟล์…</Typography>
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 2 }}>อ่านเนื้อหางานที่ทำและปัญหาที่พบ (ข้ามหัวกระดาษ/ลายเซ็น) — ใช้เวลาประมาณ 30 วินาที ถึง 2 นาที อย่าปิดหน้านี้</Typography>
              <LinearProgress sx={{ maxWidth: 320, mx: "auto", borderRadius: 99 }} />
            </Card>
          ) : !summary ? (
            <Card sx={{ py: 3, textAlign: "center" }}>
              <Description sx={{ fontSize: 40, color: FAINT }} />
              <Typography sx={{ fontWeight: 800, color: INK, mt: 1 }}>{files.length ? `มี Service Report ${files.length} ไฟล์ในงานนี้` : "ยังไม่มีไฟล์ Service Report ในงานนี้"}</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5, maxWidth: 460, mx: "auto" }}>
                AI อ่านเฉพาะเนื้อหาในทุกไฟล์ (รูปถ่าย/สแกน/PDF รวมลายมือ) ไม่อ่านหัวกระดาษและท้ายกระดาษ แล้วสรุปเป็น 2 หัวข้อ: รายละเอียดงานที่ทำ · สรุปปัญหาที่พบ — ตรวจ/แก้ได้ก่อนออก PDF / Excel
              </Typography>
              {!state.enabled && <Alert severity="warning" sx={{ mt: 2, textAlign: "left" }}>ยังไม่ได้เปิดใช้งาน AI ที่เซิร์ฟเวอร์ (ต้องตั้งค่า ANTHROPIC_API_KEY)</Alert>}
              <Button variant="contained" startIcon={<AutoAwesome />} disabled={!files.length || !state.enabled} onClick={() => scan(false)} sx={{ ...PRIMARY_BTN_SX, ...BTN, mt: 2.5, px: 3 }}>
                สรุปด้วย AI
              </Button>
            </Card>
          ) : (
            <>
              {(data.reviewNotes.length > 0 || lowConfidence || !data.found) && !confirmed && (
                <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ mb: 1.5, borderRadius: 2.5, "& .MuiAlert-message": { width: "100%" } }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", mb: 0.25 }}>
                    {!data.found ? "AI ไม่แน่ใจว่าไฟล์เป็น Service Report" : lowConfidence ? "AI อ่านได้ไม่ชัดหลายจุด — ตรวจกับต้นฉบับก่อนยืนยัน" : "จุดที่ควรตรวจกับต้นฉบับ"}
                  </Typography>
                  {data.reviewNotes.length > 0 && <Bullets items={data.reviewNotes} />}
                </Alert>
              )}
              <Typography sx={{ fontSize: "0.74rem", color: FAINT, mb: 1 }}>
                อ่านจาก {meta.fileCount} ไฟล์ · {fmtAt(summary.scannedAt)}{summary.scannedBy ? ` โดย ${summary.scannedBy}` : ""}
                {/* 💰 ค่า AI ที่ใช้จริง (25 ต.ค. 2569 ผู้ใช้: "ทำให้ประหยัดขึ้น 2 เท่า") — อ่านใหม่ = จ่ายเพิ่ม จึงบอกยอดสะสมด้วย */}
                {summary.usage?.costUsd > 0 ? ` · ค่า AI ~$${summary.usage.costUsd.toFixed(3)}` : ""}
                {summary.scanCount > 1 ? ` (รวม $${(summary.totalCostUsd || 0).toFixed(3)} จาก ${summary.scanCount} ครั้ง)` : ""}
                {summary.editedAt ? ` · แก้ไขล่าสุด ${fmtAt(summary.editedAt)} ${summary.editedBy}` : ""}
                {confirmed ? ` · ยืนยันโดย ${summary.confirmedBy} ${fmtAt(summary.confirmedAt)}` : ""}
              </Typography>
              {editing ? <SummaryEditor d={draft} setD={setDraft} /> : <SummaryView d={data} />}
            </>
          )}
        </DialogContent>

        {summary && !scanning && (
          <DialogActions sx={{ px: 2, py: 1.25, bgcolor: "#fff", borderTop: `1px solid ${LINE}`, gap: 1, flexWrap: "wrap", "& > :not(style) ~ :not(style)": { ml: 0 }, pb: isMobile ? "calc(10px + env(safe-area-inset-bottom))" : 1.25 }}>
            {editing ? (
              <>
                <Button onClick={() => setEditing(false)} disabled={saving} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="outlined" onClick={() => save(false)} disabled={saving} sx={{ ...BTN }}>บันทึกร่าง</Button>
                <Button variant="contained" startIcon={<TaskAlt />} onClick={() => save(true)} disabled={saving} sx={{ ...SUCCESS_BTN_SX, ...BTN }}>บันทึกและยืนยัน</Button>
              </>
            ) : (
              <>
                {state.canEdit && <Button startIcon={<Refresh />} onClick={async () => {
                  // 💰 อ่านใหม่ = จ่ายค่า AI อีกรอบ — ถามก่อน กันกดเล่น/กดพลาด
                  const c = summary.usage?.costUsd;
                  const ok = await Swal.fire({ icon: "question", title: "ให้ AI อ่านใหม่?",
                    text: `ใช้เครดิต AI อีกครั้ง${c ? ` (ประมาณ $${c.toFixed(3)})` : ""} · วันนี้อ่านใหม่ได้อีก ${rescanLeft} ครั้ง`,
                    showCancelButton: true, confirmButtonText: "อ่านใหม่", cancelButtonText: "ยกเลิก" });
                  if (ok.isConfirmed) scan(false);
                }} disabled={!state.enabled || rescanLeft <= 0} sx={{ ...BTN, color: MUTED }}>{rescanLeft <= 0 ? "อ่านใหม่ (ครบวันนี้)" : `อ่านใหม่ (${rescanLeft})`}</Button>}
                {state.canEdit && <Button startIcon={<EditOutlined />} onClick={() => { setDraft(withDefaults(summary.data)); setEditing(true); }} sx={{ ...BTN, color: ACCENT }}>แก้ไข</Button>}
                <Button startIcon={xlsBusy ? <CircularProgress size={16} /> : <GridOnRounded />} onClick={makeExcel} disabled={xlsBusy} sx={{ ...BTN, color: "#15803d" }}>Excel</Button>
                {/* มือถือ: ปุ่มรองแถวบน · ยืนยัน/สร้าง PDF แถวล่างเต็มกว้าง */}
                <Box sx={isMobile ? { flexBasis: "100%", height: 0 } : { flex: 1 }} />
                {state.canEdit && !confirmed && <Button variant="outlined" color="success" startIcon={<TaskAlt />} onClick={() => save(true)} disabled={saving} sx={{ ...BTN, flex: isMobile ? 1 : "none" }}>ยืนยันสรุป</Button>}
                <Button variant="contained" startIcon={pdfBusy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <PictureAsPdf />} onClick={makePdf} disabled={pdfBusy} sx={{ ...PRIMARY_BTN_SX, ...BTN, flex: isMobile ? 1 : "none" }}>
                  สร้าง PDF
                </Button>
              </>
            )}
          </DialogActions>
        )}
      </Dialog>

      <DocumentPreviewDialog
        open={Boolean(preview)}
        title="สรุปรายงานบริการ"
        preview={preview}
        issued
        docNumber={event?.jobNo || ""}
        headerTitle="สรุปรายงานบริการ (PDF)"
        headerSub={[event?.jobNo, confirmed ? "ฉบับยืนยันแล้ว" : "ฉบับร่าง — ยังไม่ได้ยืนยันสรุป"].filter(Boolean).join(" · ")}
        onClose={() => setPreview(null)}
        onBack={() => setPreview(null)}
      />
    </>
  );
}
