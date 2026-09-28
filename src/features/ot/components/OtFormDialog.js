/**
 * OtFormDialog — ยื่น/แก้ไข ใบขออนุมัติ OT
 *
 * ✅ ผู้ใช้สั่ง: "ทำระบบเบิกโอทีด้วย ให้มืออาชีพ และสมบูรณ์" · ยื่นเองหรือหัวหน้ายื่นให้ทีม · ผูกงาน + เวลาเข้า-ออก
 * ✅ กรอกง่าย: ตั้ง "วันที่ + เวลา + งาน" ครั้งเดียว แล้วเลือกคนได้หลายคน → ได้แถวของทุกคนทันที
 *    ระบบเดาประเภท OT จากวันที่ (วันหยุดนักขัตฤกษ์/วันหยุดประจำสัปดาห์) และคำนวณชั่วโมงให้เอง
 * 🔒 ฟอร์มไม่แสดงยอดเงิน — ค่าจ้างต่อชั่วโมงเป็นข้อมูลลับ server คำนวณเงินเอง (ดูในใบได้ตามสิทธิ์)
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, Autocomplete, MenuItem, Chip, Tooltip, CircularProgress, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, DeleteOutline, Send, Save, AccessTime, ContentCopy, GroupAdd, EventBusy } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { useAuth } from "@/features/auth/AuthContext";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
import OtService, { errorText } from "../services/OtService";
import {
  OT_ACCENT, OT_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, typeMeta, lineHours, hoursText, guessType, holidayNote, crossesMidnight,
} from "../otMeta";

let seq = 0;
const key = () => `l${Date.now()}_${(seq += 1)}`;
const today = () => moment().format("YYYY-MM-DD");
const BREAKS = [0, 15, 30, 45, 60, 90];

/** ⚠️ module scope — ประกาศในตัวฟอร์มจะทำให้ช่องกรอกหลุดโฟกัสทุกตัวอักษร */
const Section = ({ title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.75 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: OT_ACCENT }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: TEXT_MAIN }}>{title}</Typography>
        {hint && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.3 }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Box>
);

const TimeField = ({ label, value, onChange, error }) => (
  <TextField size="small" type="time" label={label} value={value} onChange={(e) => onChange(e.target.value)}
    InputLabelProps={{ shrink: true }} inputProps={{ step: 300 }} error={error} fullWidth />
);

export default function OtFormDialog({ open, request, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const editing = Boolean(request?._id);

  const [cfg, setCfg] = useState(null);
  const [people, setPeople] = useState([]);
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  // ── ตัวช่วยเพิ่มแถว ──
  const [job, setJob] = useState(null);
  const [date, setDate] = useState(today());
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("20:00");
  const [breakMin, setBreakMin] = useState(0);
  const [task, setTask] = useState("");
  const [who, setWho] = useState([]);
  // ── รายการ ──
  const [lines, setLines] = useState([]);
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    setError(""); setSaving(false);
    let alive = true;
    OtService.config().then((c) => alive && setCfg(c)).catch(() => {});
    OtService.people().then((p) => {
      if (!alive) return;
      setPeople(p);
      if (!editing) setWho(p.filter((u) => u.userId === userData?.userId));
    }).catch(() => {});
    if (editing) {
      setLines((request.lines || []).map((l) => ({
        key: key(), person: { userId: l.person.userId, name: l.person.name }, date: moment(l.date).format("YYYY-MM-DD"),
        type: l.type, start: l.start, end: l.end, breakMin: l.breakMin || 0, task: l.task || "",
        eventId: l.eventId || "", jobTitle: l.jobTitle || "", typeTouched: true,
      })));
      setSubject(request.subject || "");
      setNote(request.note || "");
      const first = (request.lines || []).find((l) => l.eventId);
      setJob(first ? { _id: first.eventId, title: first.jobTitle } : null);
    } else {
      setLines([]); setSubject(""); setNote(""); setJob(null);
      setDate(today()); setStart("17:00"); setEnd("20:00"); setBreakMin(0); setTask("");
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

  const jobLabel = (j) => (j ? (jobText(j) || j.title || "") : "");
  const helperHours = lineHours(start, end, breakMin);
  const helperType = guessType(date, start, cfg);
  const helperHoliday = holidayNote(date, cfg);

  /** ✅ เพิ่มแถวให้ทุกคนที่เลือก ด้วยวัน/เวลา/งานเดียวกัน (หัวหน้ายื่นให้ทีมได้ในคลิกเดียว) */
  const addForPeople = () => {
    if (!who.length) { setError("เลือกพนักงานที่ทำ OT อย่างน้อย 1 คน"); return; }
    if (helperHours === null) { setError("ตรวจสอบเวลาเริ่ม-เลิก OT"); return; }
    setError("");
    setLines((cur) => [
      ...cur,
      ...who.map((p) => ({
        key: key(), person: { userId: p.userId, name: p.fullName || p.name }, date, type: helperType, start, end, breakMin, task,
        eventId: job?._id || "", jobTitle: jobLabel(job), typeTouched: false,
      })),
    ]);
  };

  const setLine = (k, patch) => setLines((cur) => cur.map((l) => {
    if (l.key !== k) return l;
    const next = { ...l, ...patch };
    // เปลี่ยนวัน/เวลาเริ่มแล้วเดาประเภทใหม่ — เว้นแต่ผู้ใช้เลือกประเภทเองไว้แล้ว
    if (!next.typeTouched && ("date" in patch || "start" in patch)) next.type = guessType(next.date, next.start, cfg);
    return next;
  }));
  const copyNextDay = (l) => setLines((cur) => {
    const d = moment(l.date).add(1, "day").format("YYYY-MM-DD");
    return [...cur, { ...l, key: key(), date: d, type: l.typeTouched ? l.type : guessType(d, l.start, cfg) }];
  });

  const sorted = useMemo(() => [...lines].sort((a, b) => (a.date + a.start + a.person.name).localeCompare(b.date + b.start + b.person.name)), [lines]);
  const totals = useMemo(() => {
    const t = { hours: 0, byType: {}, people: new Set() };
    lines.forEach((l) => {
      const h = lineHours(l.start, l.end, l.breakMin) || 0;
      t.hours += h;
      t.byType[l.type] = (t.byType[l.type] || 0) + h;
      t.people.add(l.person.userId);
    });
    return t;
  }, [lines]);

  const problems = [];
  if (!lines.length) problems.push("เพิ่มรายการ OT อย่างน้อย 1 รายการ");
  if (lines.some((l) => lineHours(l.start, l.end, l.breakMin) === null)) problems.push("ตรวจสอบเวลาเริ่ม-เลิกให้ครบทุกแถว");
  if (lines.some((l) => !l.date)) problems.push("ระบุวันที่ให้ครบทุกแถว");

  const submit = async () => {
    if (problems.length) { setError(`กรุณา${problems.join(" · ")}`); return; }
    setSaving(true); setError("");
    const payload = {
      subject: subject.trim(), note: note.trim(),
      lines: sorted.map((l) => ({
        person: l.person, date: l.date, type: l.type, start: l.start, end: l.end, breakMin: l.breakMin, task: l.task, eventId: l.eventId,
      })),
    };
    try {
      const saved = editing ? await OtService.update(request._id, payload) : await OtService.create(payload);
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
      fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: OT_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AccessTime sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }} noWrap>
              {editing ? `แก้ไข ${request.docNo}` : "ยื่นขออนุมัติ OT"}
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              ระบบคำนวณชั่วโมงและประเภท OT ให้ · อนุมัติแล้วจ่ายพร้อมเงินเดือน
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "16px !important", pb: 1 }}>
        {resubmit && request.rejectReason && (
          <Alert severity="warning" sx={{ mb: 1.75, borderRadius: 2 }}><b>ถูกตีกลับ:</b> {request.rejectReason} — แก้แล้วกด “ส่งใหม่”</Alert>
        )}

        {/* ── ตัวช่วยเพิ่มแถว ─────────────────────────────────────────── */}
        <Section title="เพิ่มรายการ OT" hint="ตั้งวัน-เวลา-งานครั้งเดียว เลือกได้หลายคน แล้วกด “เพิ่มลงรายการ”">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr 1fr", sm: "1.3fr 1fr 1fr 0.9fr" } }}>
            <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
              <ThaiDatePicker label="วันที่ทำ OT" value={date} onChange={(v) => setDate(v || today())}
                helperText={helperHoliday ? `วันหยุด: ${helperHoliday}` : " "} />
            </Box>
            <TimeField label="เริ่ม" value={start} onChange={setStart} />
            <TimeField label="เลิก" value={end} onChange={setEnd} />
            <TextField select size="small" label="พัก" value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
              {BREAKS.map((b) => <MenuItem key={b} value={b}>{b ? `${b} นาที` : "ไม่มีพัก"}</MenuItem>)}
            </TextField>
            <Autocomplete
              sx={{ gridColumn: "1 / -1" }}
              options={job && !jobOptions.some((j) => j._id === job._id) ? [job, ...jobOptions] : jobOptions}
              value={job} loading={jobLoading} filterOptions={(x) => x}
              onChange={(_, v) => setJob(v)}
              onInputChange={(_, v, r) => { if (r === "input") setJobQuery(v); }}
              isOptionEqualToValue={(o, v) => o._id === v._id}
              getOptionLabel={(o) => [jobLabel(o), jobRangeText(o)].filter(Boolean).join(" · ")}
              renderInput={(params) => (
                <TextField {...params} size="small" label="งานที่ทำ OT (แนะนำให้ผูก)" placeholder="ค้นหาชื่องาน / โครงการ"
                  InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
            />
            <TextField size="small" label="รายละเอียดงานที่ทำ" value={task} onChange={(e) => setTask(e.target.value)} sx={{ gridColumn: "1 / -1" }}
              inputProps={{ maxLength: 300 }} placeholder="เช่น เดินสายสัญญาณชั้น 5 ต่อจากเวลางาน / แก้ไขระบบเสียหายฉุกเฉิน" />
            <Autocomplete
              multiple disableCloseOnSelect sx={{ gridColumn: "1 / -1" }}
              options={people} value={who} onChange={(_, v) => setWho(v)}
              isOptionEqualToValue={(o, v) => o.userId === v.userId}
              getOptionLabel={(o) => o.fullName || o.name}
              renderOption={({ key: k, ...li }, o) => (
                <li {...li} key={o.userId}>
                  <Avatar src={o.imageUrl?.startsWith("http") ? o.imageUrl : undefined} sx={{ width: 24, height: 24, mr: 1, fontSize: 12 }}>{(o.name || "?").charAt(0)}</Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{o.fullName}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{o.position}</Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => <TextField {...params} size="small" label="พนักงานที่ทำ OT" placeholder={who.length ? "" : "เลือกได้หลายคน (หัวหน้างานยื่นให้ทีม)"} />}
            />
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, flex: 1 }}>
              {helperHours === null ? "ตรวจสอบเวลาเริ่ม-เลิก" : (
                <>
                  <b style={{ color: TEXT_MAIN }}>{hoursText(helperHours)}</b> ต่อคน · ประเภท <b style={{ color: typeMeta(helperType).color }}>{typeMeta(helperType).label}</b>
                  {crossesMidnight(start, end) ? " · ข้ามเที่ยงคืน" : ""}
                </>
              )}
            </Typography>
            <Button variant="contained" startIcon={<GroupAdd />} onClick={addForPeople}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: OT_ACCENT, "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
              เพิ่มลงรายการ{who.length > 1 ? ` (${who.length} คน)` : ""}
            </Button>
          </Stack>
        </Section>

        {/* ── รายการ ─────────────────────────────────────────────── */}
        <Section title={`รายการ OT (${lines.length})`} hint="แก้วัน/เวลา/ประเภทรายแถวได้ · ระบบกันเวลาซ้อนกันของคนเดียวกัน"
          action={<Typography sx={{ fontWeight: 900, color: TEXT_MAIN, whiteSpace: "nowrap" }}>{hoursText(totals.hours)}</Typography>}>
          {!lines.length && (
            <Stack alignItems="center" spacing={0.5} sx={{ py: 3, color: TEXT_SUB }}>
              <EventBusy sx={{ fontSize: 34, color: "#cbd5e1" }} />
              <Typography variant="body2">ยังไม่มีรายการ — ตั้งค่าด้านบนแล้วกด “เพิ่มลงรายการ”</Typography>
            </Stack>
          )}
          <Stack spacing={1}>
            {sorted.map((l) => {
              const h = lineHours(l.start, l.end, l.breakMin);
              const tm = typeMeta(l.type);
              const hol = holidayNote(l.date, cfg);
              return (
                <Box key={l.key} sx={{ p: 1.25, border: `1px solid ${h === null ? "#fca5a5" : BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: alpha(OT_ACCENT, 0.12), color: OT_DARK }}>{(l.person.name || "?").charAt(0)}</Avatar>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", flex: 1, minWidth: 0 }} noWrap>{l.person.name}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: "0.92rem" }}>{h === null ? "—" : hoursText(h)}</Typography>
                    <Tooltip title="คัดลอกไปวันถัดไป"><IconButton size="small" onClick={() => copyNextDay(l)}><ContentCopy sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                    <Tooltip title="ลบแถว"><IconButton size="small" onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                  <Box sx={{ display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: { xs: "1fr 1fr", md: "1.3fr 0.9fr 0.9fr 0.9fr 1.3fr" } }}>
                    <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
                      <ThaiDatePicker label="วันที่" value={l.date} onChange={(v) => setLine(l.key, { date: v || l.date })} helperText={hol ? `วันหยุด: ${hol}` : undefined} />
                    </Box>
                    <TimeField label="เริ่ม" value={l.start} onChange={(v) => setLine(l.key, { start: v })} error={h === null} />
                    <TimeField label="เลิก" value={l.end} onChange={(v) => setLine(l.key, { end: v })} error={h === null} />
                    <TextField select size="small" label="พัก" value={l.breakMin} onChange={(e) => setLine(l.key, { breakMin: Number(e.target.value) })}>
                      {BREAKS.map((b) => <MenuItem key={b} value={b}>{b ? `${b} น.` : "ไม่มี"}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="ประเภท" value={l.type} onChange={(e) => setLine(l.key, { type: e.target.value, typeTouched: true })}
                      sx={{ "& .MuiSelect-select": { color: tm.color, fontWeight: 700 } }}>
                      {OT_TYPES.map((t) => (
                        <MenuItem key={t.value} value={t.value}>
                          {t.label}{cfg?.multipliers?.[t.value] ? ` (×${cfg.multipliers[t.value]})` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <TextField size="small" variant="standard" fullWidth placeholder="งานที่ทำ (ไม่บังคับ)" value={l.task}
                    onChange={(e) => setLine(l.key, { task: e.target.value })} sx={{ mt: 1, "& input": { fontSize: "0.84rem" } }} inputProps={{ maxLength: 300 }} />
                  {l.jobTitle && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.5 }} noWrap>งาน: {l.jobTitle}</Typography>}
                </Box>
              );
            })}
          </Stack>
          {lines.length > 0 && (
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 1.5 }}>
              <Chip size="small" label={`${totals.people.size} คน`} sx={{ fontWeight: 800 }} />
              {OT_TYPES.filter((t) => totals.byType[t.value]).map((t) => (
                <Chip key={t.value} size="small" label={`${t.label} ${hoursText(totals.byType[t.value])}`}
                  sx={{ fontWeight: 800, bgcolor: t.bg, color: t.color }} />
              ))}
            </Stack>
          )}
        </Section>

        <Section title="หมายเหตุ" hint="เหตุผลที่ต้องทำ OT ช่วยให้อนุมัติเร็วขึ้น">
          <Stack spacing={1.5}>
            <TextField size="small" label="เรื่อง (ไม่บังคับ — ว่างไว้ระบบตั้งให้)" value={subject} onChange={(e) => setSubject(e.target.value)} inputProps={{ maxLength: 300 }} />
            <TextField size="small" label="เหตุผล / หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }}
              placeholder="เช่น ลูกค้าขอให้เข้างานนอกเวลาเพื่อไม่กระทบการเปิดร้าน" />
          </Stack>
          {cfg && !cfg.myRateSet && (
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>
              ยอดเงิน OT คำนวณจากค่าจ้างต่อชั่วโมงที่ฝ่ายบัญชีตั้งไว้ — ดูยอดของตัวเองได้ในใบหลังผ่านการตรวจสอบ
            </Typography>
          )}
        </Section>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1 }}>
        {error ? (
          <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>
        ) : (
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>รวม</Typography>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>{hoursText(totals.hours)} · {totals.people.size} คน</Typography>
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

