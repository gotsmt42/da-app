/**
 * QuoteOnlyDialog — เพิ่ม/แก้ "ใบเสนอราคาแยก" (ไม่ผูกงานเข้างาน) พร้อมเลือกอ้างอิงงานหรือสัญญา
 *
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "เพิ่มให้สามารถอัพไฟล์ต่างหากได้ และเลือกอิงงานต่างๆ หรืองานสัญญาได้ · อัพเดตให้ตรงกันทั้งหมด
 *    · บางทีงานไม่ได้อิงงานเสมอ ต้องเสนอราคาแยกไป และมาอัพลงเพื่อติดตามได้ · โดยเฉพาะงานสัญญาที่หมดอายุแล้วต้องเสนอราคาใหม่")
 *    • อ้างอิง: ไม่อิง (ใบลอย) · อิงงานในตาราง · อิงสัญญา (สัญญาหมดอายุ/ใกล้หมดขึ้นก่อน)
 *    • เลือกงาน/สัญญาแล้ว ลูกค้า/โครงการเติมให้ตรงกับต้นทาง (ไม่ต้องพิมพ์ซ้ำ · แก้ได้)
 *    • แนบไฟล์ใบเสนอราคาได้เลย → ระบบเริ่มนับติดตามอัตโนมัติ (ระบบติดตามชุดเดียวกับใบอื่นทุกอย่าง)
 *
 * @param events   งานที่หน้าโหลดไว้ (ใช้ทำตัวเลือกงาน/สัญญา)
 * @param initial  { kind, eventId, contractGroupId } — เปิดจากลิงก์ (เช่น หน้าภาพรวมงาน "เสนอราคาต่อสัญญา")
 * @param edit     ใบเสนอราคาแยกที่จะแก้ (ไม่ส่ง = เพิ่มใหม่)
 * @param onSaved  (eventId) => void
 */
import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Box, Stack, Typography, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Autocomplete, CircularProgress, Alert, useMediaQuery,
} from "@mui/material";
import { CloseRounded as Close, AttachFileRounded as AttachFile, LinkRounded as LinkIcon, LinkOffRounded as LinkOff, AssignmentRounded as Assignment, HandshakeRounded as Handshake, RequestQuoteRounded as RequestQuote, SaveRounded as Save } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import FileKindThumb from "@/shared/ui/FileKindThumb";
import { formatThai } from "@/shared/utils/thaiDate";

const TEXT_MAIN = "#0f172a";
const TEXT_SUB = "#64748b";
const BORDER = "#e6e9ef";
const ACCENT = "#2563eb";

/** สัญญาจากงานที่โหลดไว้ — 1 ตัวเลือกต่อสัญญา · หมดอายุ/ใกล้หมด (60 วัน) ขึ้นก่อน */
export const contractOptionsOf = (events) => {
  const map = new Map();
  (events || []).forEach((e) => {
    if (!e?.contractGroupId || e.quoteOnly) return;
    const cur = map.get(e.contractGroupId);
    if (!cur) map.set(e.contractGroupId, { contractGroupId: e.contractGroupId, contractNo: e.contractNo || "", company: e.company || "", site: e.site || "", title: e.title || "", system: e.system || "", contractEnd: e.contractEnd || null });
    else if (!cur.contractEnd && e.contractEnd) cur.contractEnd = e.contractEnd;
  });
  const today = moment().startOf("day");
  return [...map.values()].map((c) => {
    const end = c.contractEnd ? moment(c.contractEnd) : null;
    const days = end ? end.startOf("day").diff(today, "days") : null;
    return { ...c, state: days == null ? "" : days < 0 ? "expired" : days <= 60 ? "expiring" : "active", days };
  }).sort((a, b) => ({ expired: 0, expiring: 1, active: 2, "": 3 }[a.state] - { expired: 0, expiring: 1, active: 2, "": 3 }[b.state]) || String(a.site).localeCompare(String(b.site), "th"));
};

/** งานในตารางที่อ้างอิงได้ — 1 ตัวเลือกต่องาน (งานหลายวันรวมเป็นงานเดียว) ใหม่สุดก่อน */
export const jobOptionsOf = (events) => {
  const map = new Map();
  (events || []).forEach((e) => {
    if (!e?._id || e.quoteOnly || e.isHoliday || e.cancelledAt) return;
    const k = e.jobGroupId || e._id;
    const cur = map.get(k);
    if (!cur || new Date(e.start) < new Date(cur.start)) map.set(k, e);
  });
  return [...map.values()].sort((a, b) => new Date(b.start) - new Date(a.start)).slice(0, 400);
};

const stateChip = (c) => {
  if (!c.state || c.state === "active") return null;
  const exp = c.state === "expired";
  return (
    <Box component="span" sx={{ ml: 0.75, px: 0.75, height: 18, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.64rem", fontWeight: 800,
      bgcolor: exp ? "#fef2f2" : "#fffbeb", color: exp ? "#b91c1c" : "#b45309" }}>
      {exp ? `หมดอายุ ${-c.days} วัน` : `อีก ${c.days} วันหมดอายุ`}
    </Box>
  );
};

export default function QuoteOnlyDialog({ open, events, initial = null, edit = null, onClose, onSaved, onUploadFiles }) {
  const phone = useMediaQuery("(max-width:600px)");
  const contracts = useMemo(() => contractOptionsOf(events), [events]);
  const jobs = useMemo(() => jobOptionsOf(events), [events]);
  const [kind, setKind] = useState("none");
  const [contract, setContract] = useState(null);
  const [job, setJob] = useState(null);
  const [f, setF] = useState({ company: "", site: "", title: "", system: "", description: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErr(""); setBusy(false); setFiles([]);
    const ref = edit ? edit.quoteRef : initial;
    const k = ref?.kind === "contract" ? "contract" : ref?.kind === "event" ? "event" : "none";
    setKind(k);
    const c = k === "contract" ? contracts.find((x) => x.contractGroupId === ref.contractGroupId) || null : null;
    const j = k === "event" ? jobs.find((x) => x._id === ref.eventId || (x.jobGroupId && events.find((e) => e._id === ref.eventId)?.jobGroupId === x.jobGroupId)) || null : null;
    setContract(c); setJob(j);
    const src = c || j;
    setF(edit
      ? { company: edit.company || "", site: edit.site || "", title: edit.title || "", system: edit.system || "", description: edit.description || "" }
      : { company: src?.company || "", site: src?.site || "", title: c ? "เสนอราคาต่อสัญญา" : j ? `${j.title || ""}${j.system ? ` · ${j.system}` : ""}`.trim() : "", system: src?.system || "", description: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งค่าตอนเปิดกล่องเท่านั้น
  }, [open]);

  const pickContract = (c) => {
    setContract(c);
    if (c) setF((x) => ({ ...x, company: c.company || x.company, site: c.site || x.site, system: c.system || x.system, title: x.title && x.title !== "ใบเสนอราคา" ? x.title : "เสนอราคาต่อสัญญา" }));
  };
  const pickJob = (j) => {
    setJob(j);
    if (j) setF((x) => ({ ...x, company: j.company || x.company, site: j.site || x.site, system: j.system || x.system, title: x.title || `${j.title || ""}${j.system ? ` · ${j.system}` : ""}`.trim() }));
  };
  const refBody = kind === "contract" && contract ? { kind: "contract", contractGroupId: contract.contractGroupId }
    : kind === "event" && job ? { kind: "event", eventId: job._id } : null;
  const missingRef = (kind === "contract" && !contract) || (kind === "event" && !job);
  const invalid = !f.site.trim() || missingRef;

  const save = async () => {
    if (invalid || busy) return;
    setBusy(true); setErr("");
    try {
      const body = { company: f.company.trim(), site: f.site.trim(), title: f.title.trim(), system: f.system.trim(), description: f.description.trim(), quoteRef: refBody };
      const res = edit ? await EventService.UpdateQuoteRef(edit._id, body) : await EventService.CreateQuoteOnly(body);
      const id = res?.event?._id || edit?._id;
      if (id && files.length) await onUploadFiles?.(files, id, "quotation");
      onSaved?.(id);
    } catch (e) {
      setErr(e?.response?.data?.message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const seg = (v, label, Icon) => {
    const on = kind === v;
    return (
      <Box key={v} component="button" type="button" onClick={() => setKind(v)} aria-pressed={on}
        sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6, height: 42, px: 1, border: 0, borderRadius: 2, cursor: "pointer", font: "inherit",
          fontSize: "0.84rem", fontWeight: on ? 800 : 600, bgcolor: on ? "#fff" : "transparent", color: on ? ACCENT : "#475569", boxShadow: on ? "0 1px 3px rgba(15,23,42,.14)" : "none" }}>
        <Icon sx={{ fontSize: 18 }} /><Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md" fullScreen={phone}
      PaperProps={{ sx: { borderRadius: phone ? 0 : 3, maxWidth: phone ? "100%" : 720 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, pb: 1.25, borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: ACCENT, flexShrink: 0 }}><RequestQuote sx={{ fontSize: 20 }} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }}>{edit ? "แก้ไขใบเสนอราคาแยก" : "เพิ่มใบเสนอราคา"}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>แนบไฟล์แล้วระบบเริ่มนับติดตามให้อัตโนมัติ</Typography>
        </Box>
        <IconButton size="small" aria-label="ปิด" onClick={onClose} disabled={busy}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: "16px !important", overflowX: "hidden" }}>
        <Stack spacing={1.75}>
          {err && <Alert severity="error" sx={{ borderRadius: 2 }}>{err}</Alert>}
          {/* อ้างอิง */}
          <Box>
            <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6, fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN, mb: 0.75 }}>
              <LinkIcon sx={{ fontSize: 18, color: ACCENT }} />ใบเสนอราคานี้อ้างอิงกับ
            </Typography>
            <Stack direction="row" sx={{ gap: 0.5, p: 0.5, borderRadius: 2.5, bgcolor: "#f1f5f9" }}>
              {seg("none", "ไม่อิง", LinkOff)}
              {seg("event", "งานในตาราง", Assignment)}
              {seg("contract", "สัญญา", Handshake)}
            </Stack>
            {kind === "contract" && (
              <Autocomplete sx={{ mt: 1 }} options={contracts} value={contract} onChange={(_, v) => pickContract(v)}
                getOptionLabel={(c) => [c.contractNo, c.site || c.company].filter(Boolean).join(" · ") || "สัญญา"}
                isOptionEqualToValue={(a, b) => a.contractGroupId === b.contractGroupId}
                renderOption={(props, c) => (
                  <li {...props} key={c.contractGroupId}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN }}>{c.contractNo || "ไม่มีเลขที่สัญญา"}{stateChip(c)}</Typography>
                      <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{[c.site || c.company, c.system, c.contractEnd ? `สิ้นสุด ${formatThai(c.contractEnd, "D MMM YYYY")}` : ""].filter(Boolean).join(" · ")}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(p) => <TextField {...p} size="small" label="เลือกสัญญา *" placeholder="พิมพ์เลขที่สัญญา / โครงการ" helperText="สัญญาหมดอายุ / ใกล้หมดอายุ ขึ้นก่อน" />}
                noOptionsText="ไม่พบสัญญา" />
            )}
            {kind === "event" && (
              <Autocomplete sx={{ mt: 1 }} options={jobs} value={job} onChange={(_, v) => pickJob(v)}
                getOptionLabel={(j) => [j.jobNo, j.title, j.site || j.company].filter(Boolean).join(" · ") || "งาน"}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                renderOption={(props, j) => (
                  <li {...props} key={j._id}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN }}>{[j.title, j.system].filter(Boolean).join(" · ") || "งาน"}</Typography>
                      <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{[j.site || j.company, j.jobNo, j.start ? formatThai(j.start, "D MMM YY") : ""].filter(Boolean).join(" · ")}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(p) => <TextField {...p} size="small" label="เลือกงาน *" placeholder="พิมพ์ชื่องาน / โครงการ / เลขที่งาน" />}
                noOptionsText="ไม่พบงาน" />
            )}
          </Box>

          {/* ลูกค้า / เรื่อง */}
          <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))" } }}>
            <TextField size="small" label="บริษัท / ลูกค้า" value={f.company} onChange={(e) => setF((x) => ({ ...x, company: e.target.value }))} inputProps={{ maxLength: 200 }} />
            <TextField size="small" label="โครงการ / สถานที่ *" value={f.site} onChange={(e) => setF((x) => ({ ...x, site: e.target.value }))} inputProps={{ maxLength: 200 }} error={!f.site.trim() && f.company !== ""} />
            <TextField size="small" label="เรื่อง" placeholder="เช่น เสนอราคาต่อสัญญา PM ปี 2570 / เปลี่ยนอุปกรณ์" value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} inputProps={{ maxLength: 200 }} />
            <TextField size="small" label="ระบบ (ถ้ามี)" value={f.system} onChange={(e) => setF((x) => ({ ...x, system: e.target.value }))} inputProps={{ maxLength: 120 }} />
          </Box>
          <TextField size="small" multiline minRows={2} label="รายละเอียด (ถ้ามี)" value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} inputProps={{ maxLength: 2000 }} />

          {/* ไฟล์ */}
          {!edit && (
            <Box sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${BORDER}` }}>
              <input ref={fileRef} type="file" hidden multiple accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => { const fl = Array.from(e.target.files || []); e.target.value = ""; if (fl.length) setFiles((x) => [...x, ...fl].slice(0, 10)); }} />
              <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6, fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN }}>
                <AttachFile sx={{ fontSize: 18, color: ACCENT }} />ไฟล์ใบเสนอราคา <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}>· แนบทีหลังได้</Box>
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mb: 1 }}>แนบแล้ว AI อ่านเลขที่ / มูลค่าให้ และเริ่มนับวันติดตามทันที</Typography>
              {files.length > 0 && (
                <Box sx={{ mb: 0.75, px: 1.25, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                  {files.map((fl, i) => (
                    <Stack key={`${fl.name}-${i}`} direction="row" alignItems="center" gap={1.25} sx={{ py: 0.75, borderTop: i ? "1px solid #f1f5f9" : 0, minWidth: 0 }}>
                      <FileKindThumb name={fl.name} size={34} />
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: TEXT_MAIN }}>{fl.name}</Typography>
                      <IconButton size="small" aria-label="เอาไฟล์ออก" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} sx={{ color: "#94a3b8" }}><Close sx={{ fontSize: 17 }} /></IconButton>
                    </Stack>
                  ))}
                </Box>
              )}
              <Button size="small" fullWidth startIcon={<AttachFile sx={{ fontSize: 16 }} />} onClick={() => fileRef.current?.click()} disabled={busy}
                sx={{ height: 40, textTransform: "none", fontWeight: 800, borderRadius: 2, border: "1px dashed #93c5fd", color: ACCENT, bgcolor: "#f8fbff", "&:hover": { bgcolor: "#eff6ff" } }}>
                {files.length ? "แนบไฟล์เพิ่ม" : "แนบไฟล์ใบเสนอราคา"}
              </Button>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: `1px solid ${BORDER}`, pb: phone ? "calc(12px + env(safe-area-inset-bottom))" : 1.5, "& > button": { flex: phone ? 1 : "0 0 auto", minHeight: 44 } }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Button variant="contained" disabled={busy || invalid} onClick={save}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", borderRadius: 2, px: 2.5, bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
          {busy ? "กำลังบันทึก..." : edit ? "บันทึกการแก้ไข" : files.length ? "บันทึก · เริ่มติดตาม" : "บันทึกใบเสนอราคา"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
