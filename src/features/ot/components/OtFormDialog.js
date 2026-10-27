/**
 * OtFormDialog — ยื่น/แก้ไข ใบขออนุมัติ OT
 *
 * 🔁 (27 ต.ค. 2569 ผู้ใช้: "เอาระบบโอทีกลับมา ไม่ต้องระบุเงิน แค่กรอกชั่วโมง อิงงาน ให้สมบูรณ์"
 *    · "ให้เป็นรายการที่จะเบิก OT 1, 2, 3, 4, 5 ไปเลย"
 *    · "ระบบนี้ทำเพื่อให้พนักงานกรอกทำโอทีเองเป็นหลัก แค่ให้แอดมินตรวจสอบ และอนุมัติก่อน")
 *    พนักงานยื่นของตัวเองเท่านั้น (ไม่ต้องเลือกคน) · ฟอร์มเป็นรายการที่ 1, 2, 3 …
 *    แต่ละรายการ = วันที่ · เวลาเริ่ม-เลิก · ประเภท OT · งานที่อิง (บังคับ) · รายละเอียด
 *    เวลาเริ่มตั้งต้น 17:30 (เวลาเลิกงาน) · ประเภทเดาจากวันที่/เวลาให้ แก้เองได้ · ไม่มีเรื่องเงินในฟอร์ม
 *    แก้ใบเดิม (เช่นถูกตีกลับ) — ผู้ทำ OT คงตามใบเดิม
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, Autocomplete, MenuItem, Tooltip, CircularProgress, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, DeleteOutline, Send, Save, AccessTime, ContentCopy, Add } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { useAuth } from "@/features/auth/AuthContext";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
import { JobOptionRow } from "@/shared/ui/JobTypeChip";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import OtService, { errorText } from "../services/OtService";
import {
  OT_ACCENT, OT_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, typeMeta, lineHours, hoursText, guessType, crossesMidnight,
} from "../otMeta";
import useFormDraft, { DraftBanner } from "@/shared/hooks/useFormDraft";
import OtDayInfo, { useHolidays } from "./OtDayInfo";

let seq = 0;
const key = () => `i${Date.now()}_${(seq += 1)}`;
const today = () => moment().format("YYYY-MM-DD");
/**
 * 🔁 (27 ต.ค. 2569 ผู้ใช้: "ตัดพักออก และเวลางาน 8.30 - 17.30")
 *   ไม่มีช่องพักแล้ว (ส่ง breakMin = 0 เสมอ) · เวลาตั้งต้นตามวัน:
 *   วันทำงาน = OT หลังเลิกงาน 17:30–20:30 · วันหยุด = ทำงานเต็มวัน 08:30–17:30
 *   ผู้ใช้แก้เวลาเองแล้ว (timeTouched) = ไม่เปลี่ยนให้อีกตอนเปลี่ยนวันที่
 */
const WORKDAY_TIME = { start: "17:30", end: "20:30" };
const HOLIDAY_TIME = { start: "08:30", end: "17:30" };
const defaultTime = (date, cfg) => (guessType(date, "08:30", cfg) === "workdayOT" ? WORKDAY_TIME : HOLIDAY_TIME);

/** รายการใหม่ — ต่อจากรายการก่อนหน้า (วัน/เวลา/งานเดิม) ให้กรอกเร็ว */
const blankItem = (cfg, from) => {
  const date = from?.date || today();
  const t = from?.timeTouched ? from : defaultTime(date, cfg);
  return {
    key: key(), date, start: t.start, end: t.end, breakMin: 0, timeTouched: Boolean(from?.timeTouched),
    type: from?.typeTouched ? from.type : guessType(date, t.start, cfg), typeTouched: Boolean(from?.typeTouched),
    job: from?.job || null, task: "",
  };
};

const TimeField = ({ label, value, onChange, error }) => (
  <TextField size="small" type="time" label={label} value={value} onChange={(e) => onChange(e.target.value)}
    InputLabelProps={{ shrink: true }} inputProps={{ step: 300 }} error={error} fullWidth />
);

export default function OtFormDialog({ open, request, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const editing = Boolean(request?._id);

  const [cfg, setCfg] = useState(null);
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [owners, setOwners] = useState([]); // ผู้ทำ OT — ใบใหม่ = ตัวเอง · แก้ใบเดิม = ตามใบ
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const draft = useFormDraft({
    key: editing ? `ot:edit:${request._id}` : "ot:new:v3",
    enabled: Boolean(open),
    data: { items, note },
    restore: (d) => {
      if (Array.isArray(d.items) && d.items.length) setItems(d.items);
      setNote(d.note || "");
    },
  });

  const me = useMemo(() => {
    const name = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "ฉัน";
    return { userId: String(userData?.userId || ""), name };
  }, [userData]);

  useEffect(() => {
    if (!open) return undefined;
    setError(""); setSaving(false); setTouched(false);
    let alive = true;
    OtService.config().then((c) => alive && setCfg(c)).catch(() => {});
    if (editing) {
      // แถวของคนเดียวกันที่วัน/เวลา/งานเดียวกัน → รายการเดียว
      const map = new Map();
      const persons = new Map();
      (request.lines || []).forEach((l) => {
        persons.set(l.person.userId, { userId: l.person.userId, name: l.person.name });
        const d = moment(l.date).format("YYYY-MM-DD");
        const k = [d, l.start, l.end, l.breakMin || 0, l.type, l.task || "", l.eventId || ""].join("|");
        if (!map.has(k)) {
          map.set(k, {
            key: key(), date: d, start: l.start, end: l.end, breakMin: 0, timeTouched: true, type: l.type, typeTouched: true,
            job: l.eventId ? { _id: l.eventId, title: "", __label: l.jobTitle } : null, task: l.task || "",
          });
        }
      });
      setOwners([...persons.values()]);
      setItems([...map.values()]);
      setNote(request.note || "");
    } else {
      setOwners([]);
      setItems([blankItem(null)]); setNote("");
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปิดกล่อง/เปลี่ยนใบ
  }, [open, request?._id]);

  useEffect(() => {
    if (!open) return undefined;
    setJobLoading(true);
    const t = setTimeout(() => {
      ExpenseService.jobs(jobQuery).then(setJobOptions).catch(() => setJobOptions([])).finally(() => setJobLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, jobQuery]);

  const holidays = useHolidays(cfg);
  const who = owners.length ? owners : [me];
  const jobLabel = (j) => (j ? (j.__label || jobText(j) || j.title || "") : "");

  const setItem = (k, patch) => setItems((cur) => cur.map((it) => {
    if (it.key !== k) return it;
    const next = { ...it, ...patch };
    if ("start" in patch || "end" in patch) next.timeTouched = true;
    // เปลี่ยนวัน → ตั้งเวลาตามชนิดวัน (ถ้ายังไม่เคยแก้เวลาเอง)
    if ("date" in patch && !next.timeTouched) Object.assign(next, defaultTime(next.date, cfg));
    // เปลี่ยนวัน/เวลาเริ่มแล้วเดาประเภทใหม่ — เว้นแต่ผู้ใช้เลือกประเภทเองไว้แล้ว
    if (!next.typeTouched && ("date" in patch || "start" in patch)) next.type = guessType(next.date, next.start, cfg);
    return next;
  }));
  const addItem = () => setItems((cur) => [...cur, blankItem(cfg, cur[cur.length - 1])]);
  const copyNextDay = (it) => setItems((cur) => {
    const d = moment(it.date).add(1, "day").format("YYYY-MM-DD");
    const i = cur.findIndex((x) => x.key === it.key);
    const t = it.timeTouched ? it : defaultTime(d, cfg);
    const copy = { ...it, key: key(), date: d, start: t.start, end: t.end, type: it.typeTouched ? it.type : guessType(d, t.start, cfg) };
    return [...cur.slice(0, i + 1), copy, ...cur.slice(i + 1)];
  });

  const totalHours = useMemo(() => items.reduce((s, it) => s + (lineHours(it.start, it.end, it.breakMin) || 0), 0), [items]);

  const problems = [];
  if (!items.length) problems.push("เพิ่มรายการ OT อย่างน้อย 1 รายการ");
  if (items.some((it) => !it.job)) problems.push("เลือกงานที่ทำ OT ให้ครบทุกรายการ");
  if (items.some((it) => lineHours(it.start, it.end, it.breakMin) === null)) problems.push("ตรวจสอบเวลาเริ่ม-เลิกให้ครบทุกรายการ");

  const submit = async () => {
    setTouched(true);
    if (problems.length) { setError(`กรุณา${problems.join(" · ")}`); return; }
    setSaving(true); setError("");
    const sorted = [...items].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const payload = {
      subject: editing ? request.subject || "" : "", note: note.trim(),
      lines: sorted.flatMap((it) => who.map((p) => ({
        person: { userId: p.userId, name: p.name }, date: it.date, type: it.type, start: it.start, end: it.end,
        breakMin: 0, task: it.task, eventId: it.job?._id || "",
      }))),
    };
    try {
      const saved = editing ? await OtService.update(request._id, payload) : await OtService.create(payload);
      draft.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
      onSaved?.(saved, { created: !editing });
    } catch (err) {
      setError(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const resubmit = editing && request.status === "rejected";

  return (
    <Dialog open={open} onClose={(_, r) => { if (saving || r === "backdropClick") return; onClose?.(); }}
      fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, bgcolor: "#f8fafc" } }}>
      <DialogTitle sx={{ p: 0, bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: OT_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AccessTime sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }} noWrap>
              {editing ? `แก้ไข ${request.docNo}` : "ยื่นขออนุมัติ OT"}
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              กรอกรายการ OT ของคุณ → แอดมินตรวจสอบ → อนุมัติ
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
        {/* ผู้ทำ OT (ตัวเอง) — แสดงเพื่อยืนยัน ไม่ต้องเลือก */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: { xs: 2, sm: 2.5 }, py: 1, borderBottom: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}>
          {who.map((p) => (
            <Stack key={p.userId} direction="row" alignItems="center" spacing={0.75}>
              <Avatar sx={{ width: 24, height: 24, fontSize: "0.72rem", fontWeight: 800, bgcolor: personColor(p.name) }}>{personInitial(p.name)}</Avatar>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: TEXT_MAIN }}>{p.name}</Typography>
            </Stack>
          ))}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>
            {items.length} รายการ · <b style={{ color: TEXT_MAIN }}>{hoursText(totalHours)}</b>
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.25, sm: 2.5 }, pt: "14px !important", pb: 1 }}>
        <DraftBanner draft={draft} />
        {resubmit && request.rejectReason && (
          <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}><b>ถูกตีกลับ:</b> {request.rejectReason} — แก้แล้วกด “ส่งใหม่”</Alert>
        )}

        {/* ── รายการ OT 1, 2, 3 … ── */}
        <Stack spacing={1.25}>
          {items.map((it, i) => {
            const h = lineHours(it.start, it.end, it.breakMin);
            const tm = typeMeta(it.type);
            const bad = h === null || (touched && !it.job);
            const opts = it.job && !jobOptions.some((j) => j._id === it.job._id) ? [it.job, ...jobOptions] : jobOptions;
            return (
              <Box key={it.key} sx={{ bgcolor: "#fff", border: `1px solid ${bad ? "#fca5a5" : BORDER_MAIN}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)", overflow: "hidden" }}>
                {/* หัวรายการ: เลขที่ · ประเภท · ชั่วโมง · คัดลอก/ลบ */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${BORDER_MAIN}` }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: OT_ACCENT, color: "#fff", fontWeight: 900, fontSize: "0.86rem" }}>{i + 1}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: TEXT_MAIN, lineHeight: 1.3 }} noWrap>รายการที่ {i + 1}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: 700, color: tm.color }}>
                      {tm.label}{cfg?.multipliers?.[it.type] ? ` ×${cfg.multipliers[it.type]}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: h === null ? "#dc2626" : TEXT_MAIN, lineHeight: 1.2 }}>{h === null ? "เวลาไม่ถูก" : hoursText(h)}</Typography>
                  </Box>
                  <Tooltip title="คัดลอกไปวันถัดไป"><IconButton size="small" onClick={() => copyNextDay(it)}><ContentCopy sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                  <Tooltip title={items.length === 1 ? "ต้องมีอย่างน้อย 1 รายการ" : "ลบรายการนี้"}>
                    <span><IconButton size="small" disabled={items.length === 1} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></span>
                  </Tooltip>
                </Stack>

                <Box sx={{ p: 1.5, display: "grid", gap: 1.25, alignItems: "start", gridTemplateColumns: { xs: "repeat(6, 1fr)", md: "repeat(12, 1fr)" } }}>
                  {/* งานที่อิง — สำคัญสุด อยู่บนสุดเต็มแถว */}
                  <Autocomplete
                    sx={{ gridColumn: "1 / -1" }}
                    options={opts} value={it.job} loading={jobLoading} filterOptions={(x) => x}
                    onChange={(_, v) => setItem(it.key, { job: v })}
                    onInputChange={(_, v, r) => { if (r === "input") setJobQuery(v); }}
                    onOpen={() => setJobQuery("")}
                    isOptionEqualToValue={(o, v) => o._id === v._id}
                    getOptionLabel={(o) => [jobLabel(o), jobRangeText(o)].filter(Boolean).join(" · ")}
                    renderOption={({ key: k, ...li }, o) => (
                      <li {...li} key={o._id}>
                        <JobOptionRow job={o} main={jobLabel(o)} sub={[jobRangeText(o), o.docNo ? `เลขที่ ${o.docNo}` : "", o.status || ""].filter(Boolean).join(" · ")} />
                      </li>
                    )}
                    noOptionsText="ไม่พบงาน"
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="งานที่ทำ OT *" error={touched && !it.job} placeholder="ค้นหาชื่องาน / โครงการ"
                        InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
                    )}
                  />
                  <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" } }}>
                    <ThaiDatePicker label="วันที่" value={it.date} onChange={(v) => setItem(it.key, { date: v || it.date })} />
                  </Box>
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 2" } }}><TimeField label="เริ่ม" value={it.start} onChange={(v) => setItem(it.key, { start: v })} error={h === null} /></Box>
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 2" } }}><TimeField label="เลิก" value={it.end} onChange={(v) => setItem(it.key, { end: v })} error={h === null} /></Box>
                  <TextField select size="small" label="ประเภท OT" value={it.type} onChange={(e) => setItem(it.key, { type: e.target.value, typeTouched: true })}
                    sx={{ gridColumn: { xs: "1 / -1", md: "span 4" }, "& .MuiSelect-select": { color: tm.color, fontWeight: 700 } }}>
                    {OT_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}{cfg?.multipliers?.[t.value] ? ` (×${cfg.multipliers[t.value]})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  {/* วันหยุด/วันทำงานของวันที่เลือก — ชุดเดียวกับปฏิทินงาน */}
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <OtDayInfo date={it.date} cfg={cfg} holidays={holidays} onPickDate={(d) => setItem(it.key, { date: d })} />
                  </Box>
                  <TextField size="small" label="รายละเอียดงานที่ทำ" value={it.task} onChange={(e) => setItem(it.key, { task: e.target.value })}
                    sx={{ gridColumn: "1 / -1" }} inputProps={{ maxLength: 300 }}
                    placeholder="เช่น เดินสายสัญญาณชั้น 5 ต่อจากเวลางาน"
                    helperText={crossesMidnight(it.start, it.end) ? "ข้ามเที่ยงคืน — นับต่อเนื่องถึงวันถัดไป" : undefined} />
                </Box>
              </Box>
            );
          })}
        </Stack>
        <Button fullWidth variant="outlined" startIcon={<Add />} onClick={addItem}
          sx={{ mt: 1.25, height: 44, textTransform: "none", fontWeight: 800, borderRadius: 2.5, borderStyle: "dashed", bgcolor: "#fff", color: OT_DARK, borderColor: alpha(OT_ACCENT, 0.5), "&:hover": { borderStyle: "dashed", borderColor: OT_ACCENT, bgcolor: alpha(OT_ACCENT, 0.04) } }}>
          เพิ่มรายการที่ {items.length + 1}
        </Button>

        <TextField size="small" fullWidth label="เหตุผล / หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2}
          inputProps={{ maxLength: 1000 }} placeholder="เช่น ลูกค้าขอให้เข้างานนอกเวลาเพื่อไม่กระทบการเปิดร้าน"
          sx={{ mt: 1.5, mb: 0.5, bgcolor: "#fff" }} />
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1, bgcolor: "#fff" }}>
        {error ? (
          <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>
        ) : (
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>รวม {items.length} รายการ</Typography>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>{hoursText(totalHours)}</Typography>
          </Box>
        )}
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB, display: { xs: error ? "none" : "inline-flex", sm: "inline-flex" } }}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save /> : <Send />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: OT_ACCENT, "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
