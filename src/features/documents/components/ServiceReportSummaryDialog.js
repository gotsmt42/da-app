/**
 * ServiceReportSummaryDialog — "สรุป Service Report ด้วย AI" → ตรวจ/แก้ → ยืนยัน → PDF สรุปรายงานบริการ
 *
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "ทำระบบให้อ่าน Service Report ของช่าง แล้วให้กดสร้างสรุปออกมาเป็น PDF ทำให้สมบูรณ์ที่สุด")
 *    1) กด "สรุปด้วย AI" — AI อ่านทุกไฟล์ Service Report ของงาน (รูป/PDF · ลายมือ · หลายแผ่น) แล้วบันทึกเป็น "ร่าง"
 *    2) หน้าสรุปแสดงตามหัวข้อฟอร์ม Service Report · จุดที่ AI อ่านไม่ชัดขึ้นกล่องส้มด้านบน ให้ตรวจก่อน
 *    3) กด "แก้ไข" แก้ได้ทุกช่อง (รายการแบบ 1 บรรทัด = 1 ข้อ · ตารางเพิ่ม/ลบแถวได้) → บันทึก หรือ "ยืนยันสรุป"
 *    4) "สร้าง PDF" — หัวกระดาษบริษัท พร้อมดาวน์โหลด/แชร์/พิมพ์ (ร่างก็ออกได้ แต่ท้ายเอกสารระบุว่าเป็นฉบับร่าง)
 * ⚠️ ข้อมูลอยู่ฝั่งเซิร์ฟเวอร์ (ServiceReportSummary) — งานหลายวันใช้สรุปเดียวกันทั้งงาน
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, LinearProgress,
  MenuItem, Stack, Switch, TextField, Typography, useMediaQuery, FormControlLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AutoAwesome, Close, EditOutlined, PictureAsPdf, Refresh, TaskAlt, AddRounded, DeleteOutline, WarningAmberRounded,
  Description, CheckCircleRounded,
} from "@mui/icons-material";
import { jsPDF } from "jspdf";
import thSarabunFont from "@/assets/fonts/THSarabunNew_base64";
import Swal from "@/shared/ui/swal";
import EventService from "@/shared/services/EventService";
import DocumentPreviewDialog from "./DocumentPreviewDialog";
import { generateServiceReportSummaryPdf, RESULT_META, ISSUE_STATUS, CHECK_RESULT, datesText } from "../utils/serviceReportSummaryPdf";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, PRIMARY_BTN_SX, SUCCESS_BTN_SX } from "@/shared/ui/PageKit";

const hex = (rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap", minHeight: 38 };
const EMPTY = {
  job: { dates: [], jobType: "", pmRound: "", project: "", system: "", contactName: "", contactPosition: "", contactPhone: "" },
  systemStatus: [], checks: [], workDone: [], issues: [], result: "unknown",
  followUp: { revisit: false, revisitDate: "", needQuotation: false, coordinateWith: "" },
  customer: { comment: "", signed: false, name: "", signDate: "" },
  technicians: [], summary: "", highlights: [], recommendations: [], reviewNotes: [], confidence: "medium",
};
const withDefaults = (d) => ({
  ...EMPTY, ...(d || {}),
  job: { ...EMPTY.job, ...(d?.job || {}) },
  followUp: { ...EMPTY.followUp, ...(d?.followUp || {}) },
  customer: { ...EMPTY.customer, ...(d?.customer || {}) },
});
const fmtAt = (d) => (d ? new Date(d).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// ─── ชิ้นส่วนแสดงผล ─────────────────────────────────────────────────────────
const Section = ({ n, title, children, right }) => (
  <Box sx={{ mt: 2 }}>
    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
      <Box sx={{ minWidth: 22, height: 22, px: 0.5, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, fontSize: "0.74rem", fontWeight: 900 }}>{n}</Box>
      <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "0.95rem", color: INK }}>{title}</Typography>
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
function SummaryView({ d, meta }) {
  const rm = RESULT_META[d.result] || RESULT_META.unknown;
  let n = 0;
  const next = () => { n += 1; return n; };
  const fu = d.followUp || {};
  const info = [
    ["โครงการ", d.job.project || meta.site], ["ระบบ", d.job.system || meta.system],
    ["ประเภทงาน", [d.job.jobType, d.job.pmRound ? `ครั้งที่ ${d.job.pmRound}` : ""].filter(Boolean).join(" ")],
    ["วันที่เข้างาน", datesText(d.job.dates)],
    ["ผู้ติดต่อ", [d.job.contactName, d.job.contactPosition, d.job.contactPhone].filter(Boolean).join(" · ")],
    ["ช่าง", d.technicians.join(", ")],
  ].filter(([, v]) => v);
  return (
    <>
      <Card sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
        {info.map(([k, v]) => (
          <Box key={k} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, fontWeight: 700 }}>{k}</Typography>
            <Typography sx={{ fontSize: "0.88rem", color: INK, fontWeight: 700, overflowWrap: "anywhere" }}>{v}</Typography>
          </Box>
        ))}
      </Card>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.25, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: hex(rm.fill), border: `1px solid ${alpha(hex(rm.rgb), 0.35)}`, flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: INK }}>ผลการทำงาน</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: hex(rm.rgb) }}>{rm.label}</Typography>
        <Box sx={{ flex: 1 }} />
        {fu.revisit && <Chip size="small" label={`ต้องเข้าอีก${fu.revisitDate ? ` ${fu.revisitDate}` : ""}`} sx={{ fontWeight: 700 }} />}
        {fu.needQuotation && <Chip size="small" label="ต้องเสนอราคา" sx={{ fontWeight: 700, bgcolor: "#fff7ed", color: "#c2410c" }} />}
      </Stack>
      {(d.summary || d.highlights.length > 0) && (
        <Section n={next()} title="บทสรุป">
          <Card>
            {d.summary && <Typography sx={{ fontSize: "0.9rem", color: INK_2, lineHeight: 1.7 }}>{d.summary}</Typography>}
            {d.highlights.length > 0 && <Box sx={{ mt: d.summary ? 1 : 0 }}><Bullets items={d.highlights} /></Box>}
          </Card>
        </Section>
      )}
      {d.systemStatus.length > 0 && (
        <Section n={next()} title="สถานะระบบ (ก่อน → หลัง)">
          <MiniTable head={["รายการ", "ก่อนเข้า", "หลังเสร็จ"]} aligns={["left", "center", "center"]}
            rows={d.systemStatus.map((r) => [r.item, r.before || "-", <b key="a" style={{ color: INK }}>{r.after || "-"}</b>])} />
        </Section>
      )}
      {d.checks.length > 0 && (
        <Section n={next()} title="ผลตรวจเช็คพื้นฐาน">
          <MiniTable head={["รายการ", "ค่าที่วัด / ข้อมูล", "ผล"]} aligns={["left", "left", "center"]}
            rows={d.checks.map((r) => [r.item, r.value || "-", <span key="r" style={{ fontWeight: 800, color: r.result === "abnormal" ? "#b91c1c" : r.result === "normal" ? "#15803d" : MUTED }}>{CHECK_RESULT[r.result]}</span>])} />
        </Section>
      )}
      {d.workDone.length > 0 && (
        <Section n={next()} title="รายละเอียดงานที่ทำ"><Card><Bullets items={d.workDone} numbered /></Card></Section>
      )}
      {d.issues.length > 0 && (
        <Section n={next()} title="ปัญหาที่พบ / อุปกรณ์ที่ต้องเปลี่ยน">
          <MiniTable head={["#", "ตำแหน่ง", "ปัญหา", "อุปกรณ์ / รุ่น", "จำนวน", "สถานะ"]} aligns={["center", "left", "left", "left", "center", "center"]}
            rows={d.issues.map((r, i) => [i + 1, r.location || "-", r.problem || "-", r.part || "-", r.qty || "-",
              <span key="s" style={{ fontWeight: 800, color: ISSUE_TONE[r.status], whiteSpace: "nowrap" }}>{ISSUE_STATUS[r.status]}</span>])} />
        </Section>
      )}
      {(d.recommendations.length > 0 || fu.coordinateWith) && (
        <Section n={next()} title="ข้อเสนอแนะและการติดตาม">
          <Card><Bullets items={[...d.recommendations, fu.coordinateWith ? `ประสานงานกับ ${fu.coordinateWith}` : ""].filter(Boolean)} /></Card>
        </Section>
      )}
      {(d.customer.comment || d.customer.signed || d.customer.name) && (
        <Section n={next()} title="ลูกค้า">
          <Card>
            {d.customer.comment && <Typography sx={{ fontSize: "0.88rem", color: INK_2 }}>ความเห็น: {d.customer.comment}</Typography>}
            <Typography sx={{ fontSize: "0.86rem", color: d.customer.signed ? "#15803d" : "#b45309", fontWeight: 700 }}>
              {d.customer.signed ? "ลูกค้าลงนามแล้ว" : "ยังไม่พบลายเซ็นลูกค้า"}{d.customer.name ? ` · ${d.customer.name}` : ""}{d.customer.signDate ? ` · ${d.customer.signDate}` : ""}
            </Typography>
          </Card>
        </Section>
      )}
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
  const job = (k, v) => setD({ ...d, job: { ...d.job, [k]: v } });
  const [datesTextVal, setDatesTextVal] = useState(() => d.job.dates.map((x) => [x.date, x.timeIn, x.timeOut].join(" ")).join("\n"));
  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      <Section n={1} title="ข้อมูลงาน">
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField {...tf} label="โครงการ / สถานที่" value={d.job.project} onChange={(e) => job("project", e.target.value)} />
          <TextField {...tf} label="ระบบ" value={d.job.system} onChange={(e) => job("system", e.target.value)} />
          <TextField {...tf} label="ประเภทงาน" value={d.job.jobType} onChange={(e) => job("jobType", e.target.value)} />
          <TextField {...tf} label="PM ครั้งที่" value={d.job.pmRound} onChange={(e) => job("pmRound", e.target.value)} />
          <TextField {...tf} label="ผู้ติดต่อ" value={d.job.contactName} onChange={(e) => job("contactName", e.target.value)} />
          <TextField {...tf} label="ตำแหน่ง / โทร" value={[d.job.contactPosition, d.job.contactPhone].filter(Boolean).join(" / ")}
            onChange={(e) => { const [pos, tel] = e.target.value.split("/").map((x) => x.trim()); setD({ ...d, job: { ...d.job, contactPosition: pos || "", contactPhone: tel || "" } }); }} />
          <TextField {...tf} multiline minRows={2} label="วันที่ เวลาเข้า เวลาออก (บรรทัดละวัน เช่น 2026-10-22 09:00 17:00)" value={datesTextVal}
            onChange={(e) => {
              setDatesTextVal(e.target.value);
              job("dates", linesToArr(e.target.value).map((ln) => { const [date = "", timeIn = "", timeOut = ""] = ln.split(/\s+/); return { date, timeIn, timeOut }; }));
            }} />
          <TextField {...tf} multiline minRows={2} label="ช่างผู้ให้บริการ (บรรทัดละคน)" value={d.technicians.join("\n")} onChange={(e) => setD({ ...d, technicians: linesToArr(e.target.value) })} />
        </Box>
      </Section>
      <Section n={2} title="ผลการทำงาน">
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField {...tf} select label="ผลการทำงาน" value={d.result} onChange={(e) => setD({ ...d, result: e.target.value })}>
            {Object.entries(RESULT_META).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </TextField>
          <TextField {...tf} label="ประสานงานกับ" value={d.followUp.coordinateWith} onChange={(e) => setD({ ...d, followUp: { ...d.followUp, coordinateWith: e.target.value } })} />
          <FormControlLabel control={<Switch checked={d.followUp.revisit} onChange={(e) => setD({ ...d, followUp: { ...d.followUp, revisit: e.target.checked } })} />} label="ต้องเข้าอีก" />
          <TextField {...tf} type="date" label="วันที่นัดเข้าอีก" value={d.followUp.revisitDate} onChange={(e) => setD({ ...d, followUp: { ...d.followUp, revisitDate: e.target.value } })} />
          <FormControlLabel control={<Switch checked={d.followUp.needQuotation} onChange={(e) => setD({ ...d, followUp: { ...d.followUp, needQuotation: e.target.checked } })} />} label="ต้องทำใบเสนอราคา" />
        </Box>
      </Section>
      <Section n={3} title="บทสรุป">
        <TextField {...tf} multiline minRows={4} label="บทสรุป" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
        <TextField {...tf} multiline minRows={2} sx={{ mt: 1 }} label="ประเด็นสำคัญ (บรรทัดละข้อ)" value={d.highlights.join("\n")} onChange={(e) => setD({ ...d, highlights: linesToArr(e.target.value) })} />
      </Section>
      <Section n={4} title="สถานะระบบ (ก่อน → หลัง)">
        <RowEditor rows={d.systemStatus} onChange={(v) => setD({ ...d, systemStatus: v })} blank={{ item: "", before: "", after: "" }}
          cols={[{ key: "item", label: "รายการ", flex: 2 }, { key: "before", label: "ก่อนเข้า" }, { key: "after", label: "หลังเสร็จ" }]} />
      </Section>
      <Section n={5} title="ผลตรวจเช็คพื้นฐาน">
        <RowEditor rows={d.checks} onChange={(v) => setD({ ...d, checks: v })} blank={{ item: "", value: "", result: "normal" }}
          cols={[{ key: "item", label: "รายการ", flex: 1.5 }, { key: "value", label: "ค่าที่วัด / ข้อมูล", flex: 2 }, { key: "result", label: "ผล", select: CHECK_RESULT }]} />
      </Section>
      <Section n={6} title="รายละเอียดงานที่ทำ">
        <TextField {...tf} multiline minRows={5} label="บรรทัดละ 1 เรื่อง" value={d.workDone.join("\n")} onChange={(e) => setD({ ...d, workDone: linesToArr(e.target.value) })} />
      </Section>
      <Section n={7} title="ปัญหาที่พบ / อุปกรณ์ที่ต้องเปลี่ยน">
        <RowEditor rows={d.issues} onChange={(v) => setD({ ...d, issues: v })} blank={{ location: "", problem: "", part: "", qty: "", status: "pending" }}
          cols={[{ key: "location", label: "ตำแหน่ง" }, { key: "problem", label: "ปัญหา / อาการ", flex: 2, multiline: true }, { key: "part", label: "อุปกรณ์ / รุ่น", flex: 1.4 },
            { key: "qty", label: "จำนวน", flex: 0.7 }, { key: "status", label: "สถานะ", select: ISSUE_STATUS }]} />
      </Section>
      <Section n={8} title="ข้อเสนอแนะ">
        <TextField {...tf} multiline minRows={3} label="บรรทัดละข้อ" value={d.recommendations.join("\n")} onChange={(e) => setD({ ...d, recommendations: linesToArr(e.target.value) })} />
      </Section>
      <Section n={9} title="ลูกค้า">
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField {...tf} label="ความเห็นลูกค้า" value={d.customer.comment} onChange={(e) => setD({ ...d, customer: { ...d.customer, comment: e.target.value } })} />
          <TextField {...tf} label="ชื่อผู้ลงนาม" value={d.customer.name} onChange={(e) => setD({ ...d, customer: { ...d.customer, name: e.target.value } })} />
          <FormControlLabel control={<Switch checked={d.customer.signed} onChange={(e) => setD({ ...d, customer: { ...d.customer, signed: e.target.checked } })} />} label="ลูกค้าลงนามแล้ว" />
          <TextField {...tf} type="date" label="วันที่ลงนาม" value={d.customer.signDate} onChange={(e) => setD({ ...d, customer: { ...d.customer, signDate: e.target.value } })} />
        </Box>
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
  const meta = useMemo(() => ({
    jobNo: event?.jobNo || "", company: event?.company || "", site: event?.site || "", system: event?.system || "", title: event?.title || "",
    fileCount: summary?.data?.fileCount || summary?.files?.length || 0,
    confirmedBy: summary?.status === "confirmed" ? summary?.confirmedBy : "", confirmedAt: summary?.confirmedAt,
  }), [event, summary]);

  const scan = async (force = false) => {
    setScanning(true);
    try {
      const r = await EventService.ScanServiceReport(id, force);
      setState((s) => ({ ...s, summary: r.summary }));
      setEditing(false);
      onChanged?.(r.summary?.status || "draft");
    } catch (err) {
      const res = err?.response?.data;
      if (err?.response?.status === 409 && res?.needForce) {
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
      const out = await generateServiceReportSummaryPdf({ jsPDF, thSarabunFont, data: editing ? withDefaults(draft) : data, meta, mode: "blob" });
      setPreview(out);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "สร้าง PDF ไม่สำเร็จ", text: "กรุณาลองใหม่" });
    }
    setPdfBusy(false);
  };

  const files = state.files || [];
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
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5, mb: 2 }}>อ่านลายมือ แยกหัวข้อ และเขียนบทสรุป — ใช้เวลาประมาณ 30 วินาที ถึง 2 นาที อย่าปิดหน้านี้</Typography>
              <LinearProgress sx={{ maxWidth: 320, mx: "auto", borderRadius: 99 }} />
            </Card>
          ) : !summary ? (
            <Card sx={{ py: 3, textAlign: "center" }}>
              <Description sx={{ fontSize: 40, color: FAINT }} />
              <Typography sx={{ fontWeight: 800, color: INK, mt: 1 }}>{files.length ? `มี Service Report ${files.length} ไฟล์ในงานนี้` : "ยังไม่มีไฟล์ Service Report ในงานนี้"}</Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5, maxWidth: 460, mx: "auto" }}>
                AI จะอ่านทุกไฟล์ (รูปถ่าย/สแกน/PDF รวมลายมือ) แล้วสรุปเป็นหัวข้อ: สถานะระบบ ผลตรวจเช็ค งานที่ทำ ปัญหาและอุปกรณ์ที่ต้องเปลี่ยน ข้อเสนอแนะ — ตรวจ/แก้ได้ก่อนออก PDF
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
                {summary.editedAt ? ` · แก้ไขล่าสุด ${fmtAt(summary.editedAt)} ${summary.editedBy}` : ""}
                {confirmed ? ` · ยืนยันโดย ${summary.confirmedBy} ${fmtAt(summary.confirmedAt)}` : ""}
              </Typography>
              {editing ? <SummaryEditor d={draft} setD={setDraft} /> : <SummaryView d={data} meta={meta} />}
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
                {state.canEdit && <Button startIcon={<Refresh />} onClick={() => scan(false)} disabled={!state.enabled} sx={{ ...BTN, color: MUTED }}>อ่านใหม่</Button>}
                {state.canEdit && <Button startIcon={<EditOutlined />} onClick={() => { setDraft(withDefaults(summary.data)); setEditing(true); }} sx={{ ...BTN, color: ACCENT }}>แก้ไข</Button>}
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
