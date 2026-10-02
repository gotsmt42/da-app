/**
 * PrFormDialog — ออก/แก้ไข ใบขอซื้อสินค้า (PR)
 *
 * ✅ ผู้ใช้สั่ง: "ใบขอซื้อสินค้า PR ให้รายละเอียดครบถ้วน และมืออาชีพ สมบูรณ์"
 *   ข้อมูลที่ฝ่ายจัดซื้อต้องใช้ครบในใบเดียว: สินค้า + ยี่ห้อ/รุ่น/สเปก · จำนวน/หน่วย · ราคาประมาณการ ·
 *   ความเร่งด่วน · ต้องการใช้ภายใน · ส่งของที่ไหน · ใช้กับงานไหน · ร้านที่แนะนำ · แนบใบเสนอราคา/สเปก
 * ✅ พิมพ์ชื่อสินค้าที่เคยขอ → เติมสเปก/หน่วย/ราคาล่าสุดให้ (จากใบเก่า)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, Autocomplete, MenuItem, Tooltip, CircularProgress, ToggleButton, ToggleButtonGroup, Checkbox, FormControlLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, Add, DeleteOutline, AttachFile, Send, Save, ShoppingCart, HistoryEdu } from "@mui/icons-material";
import SignatureService from "@/shared/services/SignatureService";
import { useAuth } from "@/features/auth/AuthContext";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL, formatBytes, MAX_UPLOAD_MB } from "@/shared/utils/fileUpload";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
import PurchaseService, { errorText } from "../services/PurchaseService";
import {
  PR_ACCENT, PR_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, PRIORITIES, PR_CATEGORIES, FILE_KINDS, money, fmtMoney, baht,
} from "../prMeta";

let seq = 0;
const key = () => `p${Date.now()}_${(seq += 1)}`;
const blank = () => ({ key: key(), code: "", description: "", spec: "", qty: 1, unit: "ชิ้น", estUnitPrice: "", note: "" });
const numberField = { inputMode: "decimal", onWheel: (e) => e.currentTarget.blur() };

const Section = ({ title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.75 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: PR_ACCENT }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: TEXT_MAIN }}>{title}</Typography>
        {hint && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.3 }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Box>
);

export default function PrFormDialog({ open, request, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const editing = Boolean(request?._id);
  const [suggest, setSuggest] = useState({ suppliers: [], deliverTo: [], units: [], products: [] });
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);

  const [docDate, setDocDate] = useState(moment().format("YYYY-MM-DD"));
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [neededBy, setNeededBy] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [category, setCategory] = useState("material");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [job, setJob] = useState(null);
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState([blank()]);
  const [vatRate, setVatRate] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const fileRef = useRef(null);
  const { userData } = useAuth();
  /** ✅ ลายเซ็นอิเล็กทรอนิกส์ช่อง "ผู้ขอซื้อ" — ติ๊กเลือกได้ (เหมือนใบเบิก) · แก้ใบคนอื่นไม่มีช่องนี้ */
  const [mySignature, setMySignature] = useState(null);
  const [useSignature, setUseSignature] = useState(true);
  const isMine = !editing || request?.requester?.userId === userData?.userId;

  useEffect(() => {
    if (!open) return undefined;
    setError(""); setTouched(false); setFiles([]); setSaving(false);
    let alive = true;
    PurchaseService.suggest().then((s) => alive && setSuggest(s)).catch(() => {});
    SignatureService.me().then((sig) => alive && setMySignature(sig)).catch(() => {});
    setUseSignature(editing ? Boolean(request.signatures?.requester?.hash) : true);
    if (editing) {
      const r = request;
      setDocDate(r.docDate ? moment(r.docDate).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD"));
      setSubject(r.subject || ""); setPriority(r.priority || "normal");
      setNeededBy(r.neededBy ? moment(r.neededBy).format("YYYY-MM-DD") : "");
      setCategory(r.category || "material"); setContactName(r.contactName || ""); setContactPhone(r.contactPhone || "");
      setDeliverTo(r.deliverTo || ""); setPurpose(r.purpose || ""); setSupplier(r.suggestedSupplier || ""); setNote(r.note || "");
      setJob(r.eventId ? { _id: r.eventId, ...r.job } : null);
      setItems((r.items || []).map((it) => ({ key: key(), _id: it._id, code: it.code || "", description: it.description, spec: it.spec || "", qty: it.qty, unit: it.unit || "", estUnitPrice: it.estUnitPrice || "", note: it.note || "" })));
      setVatRate(r.vatRate || 0);
    } else {
      setDocDate(moment().format("YYYY-MM-DD")); setSubject(""); setPriority("normal"); setNeededBy(""); setDeliverTo("");
      setCategory("material"); setContactName(""); setContactPhone("");
      setPurpose(""); setSupplier(""); setNote(""); setJob(null); setItems([blank()]); setVatRate(0);
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

  const setItem = (k, patch) => setItems((rows) => rows.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const pickProduct = (k, v) => {
    if (!v || typeof v === "string") { setItem(k, { description: String(v || "").slice(0, 300) }); return; }
    setItems((rows) => rows.map((r) => (r.key !== k ? r : {
      ...r, code: r.code || v.code || "", description: v.description, spec: r.spec || v.spec || "", unit: v.unit || r.unit, estUnitPrice: r.estUnitPrice || v.lastPrice || "",
    })));
  };

  const valid = items.filter((it) => String(it.description).trim());
  const subtotal = useMemo(() => money(valid.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.estUnitPrice) || 0), 0)), [valid]);
  const vat = money(subtotal * (vatRate / 100));
  const total = money(subtotal + vat);

  const problems = [];
  if (!subject.trim()) problems.push("ระบุเรื่องที่ขอซื้อ");
  if (!valid.length) problems.push("เพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
  if (valid.some((it) => !(Number(it.qty) > 0))) problems.push("จำนวนต้องมากกว่า 0");
  if (neededBy && moment(neededBy).isBefore(moment(docDate))) problems.push("วันที่ต้องการใช้ต้องไม่ก่อนวันที่ขอ");

  const submit = async () => {
    setTouched(true);
    if (problems.length) { setError(`กรุณา${problems.join(" · ")}`); return; }
    setSaving(true); setError("");
    const fields = {
      docDate, subject: subject.trim(), priority, neededBy: neededBy || "", deliverTo: deliverTo.trim(), eventId: job?._id || "",
      category, contactName: contactName.trim(), contactPhone: contactPhone.trim(),
      purpose: purpose.trim(), suggestedSupplier: supplier.trim(), note: note.trim(), vatRate,
      ...(isMine && mySignature ? { useSignature } : {}),
      items: valid.map(({ key: k, ...it }) => ({ ...it, qty: Number(it.qty) || 0, estUnitPrice: Number(it.estUnitPrice) || 0 })),
    };
    try {
      const payload = files.map((f) => ({ file: f.file, kind: f.kind }));
      const out = editing ? await PurchaseService.update(request._id, fields, payload) : await PurchaseService.create(fields, payload);
      onSaved?.(out.request, {
        created: !editing,
        warn: out.rejected?.length ? `บันทึกแล้ว แต่มีไฟล์ที่แนบไม่ได้: ${out.rejected.map((r) => r.name).join(", ")}` : "",
      });
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
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: PR_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShoppingCart sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }} noWrap>{editing ? `แก้ไข ${request.docNo}` : "ออกใบขอซื้อสินค้า (PR)"}</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">ตรวจสอบ → อนุมัติ → ฝ่ายจัดซื้อสั่งซื้อ → รับของ</Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "16px !important", pb: 1 }}>
        {resubmit && request.rejectReason && <Alert severity="warning" sx={{ mb: 1.75, borderRadius: 2 }}><b>ถูกตีกลับ:</b> {request.rejectReason} — แก้แล้วกด “ส่งใหม่”</Alert>}

        <Section title="ข้อมูลการขอซื้อ" hint="ฝ่ายจัดซื้อใช้ข้อมูลนี้จัดลำดับและส่งของให้ถูกที่ ถูกเวลา">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField size="small" label="เรื่อง *" value={subject} onChange={(e) => setSubject(e.target.value)} sx={{ gridColumn: { sm: "1 / -1" } }}
              error={touched && !subject.trim()} inputProps={{ maxLength: 300 }} placeholder="เช่น ขอซื้ออุปกรณ์ติดตั้งระบบ Fire Alarm ชั้น 5–8" />
            <ThaiDatePicker label="วันที่ขอ" value={docDate} onChange={(v) => setDocDate(v || moment().format("YYYY-MM-DD"))} />
            <ThaiDatePicker label="ต้องการใช้ภายในวันที่" value={neededBy} onChange={(v) => setNeededBy(v || "")} helperText="ว่าง = ไม่ระบุ" />
            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", mb: 0.5 }}>ความเร่งด่วน</Typography>
              <ToggleButtonGroup exclusive size="small" value={priority} onChange={(_, v) => v && setPriority(v)}
                sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 2 } }}>
                {PRIORITIES.map((p) => (
                  <ToggleButton key={p.value} value={p.value} sx={{ "&.Mui-selected": { color: `${p.value === "normal" ? "#fff" : p.color} !important`, bgcolor: `${p.value === "normal" ? "#334155" : alpha(p.color, 0.12)} !important` } }}>
                    {p.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <TextField select size="small" label="ประเภทการซื้อ" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ gridColumn: { sm: "1 / -1" } }}>
              {PR_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
            <Autocomplete
              sx={{ gridColumn: { sm: "1 / -1" } }}
              options={job && !jobOptions.some((j) => j._id === job._id) ? [job, ...jobOptions] : jobOptions}
              value={job} loading={jobLoading} filterOptions={(x) => x}
              onChange={(_, v) => { setJob(v); if (v && !deliverTo) setDeliverTo(v.site || v.company || ""); }}
              onInputChange={(_, v, r) => { if (r === "input") setJobQuery(v); }}
              isOptionEqualToValue={(o, v) => o._id === v._id}
              getOptionLabel={(o) => [jobText(o) || o.title || "", jobRangeText(o)].filter(Boolean).join(" · ")}
              renderInput={(params) => (
                <TextField {...params} size="small" label="ใช้กับงาน / โครงการ" placeholder="ค้นหาชื่องาน / โครงการ (ไม่บังคับ)"
                  InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
            />
            <Autocomplete freeSolo options={suggest.deliverTo || []} value={deliverTo} inputValue={deliverTo}
              onInputChange={(_, v) => setDeliverTo(v)} onChange={(_, v) => setDeliverTo(v || "")} sx={{ gridColumn: { sm: "1 / -1" } }}
              renderInput={(params) => <TextField {...params} size="small" label="สถานที่ส่งของ" placeholder="เช่น หน้างาน Centara Grand Bangkok / สำนักงาน" />} />
            <TextField size="small" label="ผู้รับของ ณ จุดส่ง" value={contactName} onChange={(e) => setContactName(e.target.value)} inputProps={{ maxLength: 120 }} placeholder="ว่าง = ผู้ขอซื้อ" />
            <TextField size="small" label="เบอร์ติดต่อผู้รับของ" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputProps={{ maxLength: 40, inputMode: "tel" }} />
            <TextField size="small" label="วัตถุประสงค์ / เหตุผลการซื้อ" value={purpose} onChange={(e) => setPurpose(e.target.value)} multiline minRows={2}
              sx={{ gridColumn: { sm: "1 / -1" } }} inputProps={{ maxLength: 1000 }} placeholder="เช่น ใช้ติดตั้งตามสัญญางวดที่ 2 / ของเดิมชำรุดต้องเปลี่ยน" />
          </Box>
        </Section>

        <Section title={`รายการสินค้า (${valid.length})`} hint="ระบุยี่ห้อ/รุ่น/สเปกให้ชัด ฝ่ายจัดซื้อสั่งถูกตัวโดยไม่ต้องถามกลับ"
          action={<Typography sx={{ fontWeight: 900, whiteSpace: "nowrap" }}>{baht(total)}</Typography>}>
          <Stack spacing={1.25}>
            {items.map((row, i) => (
              <Box key={row.key} sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                <Box sx={{ display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 80px 100px 130px" } }}>
                  <Autocomplete freeSolo options={suggest.products || []} sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
                    value={row.description} inputValue={row.description}
                    onInputChange={(_, v, r) => { if (r === "input") setItem(row.key, { description: v.slice(0, 300) }); }}
                    onChange={(_, v) => pickProduct(row.key, v)}
                    getOptionLabel={(o) => (typeof o === "string" ? o : o.description)}
                    renderOption={({ key: k, ...li }, o) => (
                      <li {...li} key={o.description}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{o.description}</Typography>
                          <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{[o.spec, o.unit, o.lastPrice ? `ล่าสุด ${baht(o.lastPrice)}` : ""].filter(Boolean).join(" · ")}</Typography>
                        </Box>
                      </li>
                    )}
                    renderInput={(params) => <TextField {...params} size="small" label={`#${i + 1} ชื่อสินค้า *`} error={touched && !String(row.description).trim()} />} />
                  <TextField size="small" label="จำนวน" type="number" value={row.qty} onChange={(e) => setItem(row.key, { qty: e.target.value })}
                    inputProps={{ min: 0, step: "any", ...numberField }} error={!(Number(row.qty) > 0)} />
                  <Autocomplete freeSolo options={suggest.units || []} value={row.unit} inputValue={row.unit}
                    onInputChange={(_, v) => setItem(row.key, { unit: v.slice(0, 30) })} onChange={(_, v) => setItem(row.key, { unit: v || "" })}
                    renderInput={(params) => <TextField {...params} size="small" label="หน่วย" />} />
                  <TextField size="small" label="ราคา/หน่วย (ประมาณ)" type="number" value={row.estUnitPrice} onChange={(e) => setItem(row.key, { estUnitPrice: e.target.value })}
                    inputProps={{ min: 0, step: "any", ...numberField }} sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }} />
                  <TextField size="small" label="รหัสสินค้า / Part No." value={row.code} onChange={(e) => setItem(row.key, { code: e.target.value })}
                    sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }} inputProps={{ maxLength: 60 }} placeholder="ไม่บังคับ" />
                  <TextField size="small" label="ยี่ห้อ / รุ่น / สเปก" value={row.spec} onChange={(e) => setItem(row.key, { spec: e.target.value })}
                    sx={{ gridColumn: { xs: "1 / -1", md: "2 / -1" } }} inputProps={{ maxLength: 500 }} placeholder="เช่น Hochiki ALN-EN · 24VDC · มี มอก." />
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <TextField size="small" variant="standard" placeholder="หมายเหตุรายการ (ไม่บังคับ)" value={row.note} onChange={(e) => setItem(row.key, { note: e.target.value })}
                    sx={{ flex: 1, minWidth: 0, "& input": { fontSize: "0.82rem" } }} inputProps={{ maxLength: 300 }} />
                  <Typography sx={{ fontWeight: 800, minWidth: 90, textAlign: "right" }}>{fmtMoney((Number(row.qty) || 0) * (Number(row.estUnitPrice) || 0))}</Typography>
                  <Tooltip title="ลบรายการ"><span>
                    <IconButton size="small" disabled={items.length === 1} onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}><DeleteOutline fontSize="small" /></IconButton>
                  </span></Tooltip>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setItems((rows) => [...rows, blank()])} disabled={items.length >= 80}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, color: PR_ACCENT, borderColor: alpha(PR_ACCENT, 0.5) }}>เพิ่มรายการ</Button>
            <Box sx={{ flex: 1 }} />
            <TextField select size="small" label="VAT" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} sx={{ width: 150 }}>
              <MenuItem value={0}>ราคายังไม่รวม VAT / ไม่มี</MenuItem>
              <MenuItem value={7}>บวก VAT 7%</MenuItem>
            </TextField>
          </Stack>
          <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: alpha(PR_ACCENT, 0.05), border: `1px dashed ${alpha(PR_ACCENT, 0.35)}` }}>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" sx={{ color: TEXT_SUB }}>รวมก่อน VAT</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtMoney(subtotal)}</Typography></Stack>
            {vatRate > 0 && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" sx={{ color: TEXT_SUB }}>VAT 7%</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtMoney(vat)}</Typography></Stack>}
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}><Typography sx={{ fontWeight: 900 }}>ยอดประมาณการรวม</Typography><Typography sx={{ fontWeight: 900, fontSize: "1.15rem" }}>{fmtMoney(total)}</Typography></Stack>
          </Box>
        </Section>

        <Section title="ร้านค้าและเอกสารประกอบ" hint="แนบใบเสนอราคาจากร้านค้า / สเปก / รูปของเดิม ช่วยให้อนุมัติและสั่งซื้อเร็วขึ้น">
          <Stack spacing={1.5}>
            <Autocomplete freeSolo options={suggest.suppliers || []} value={supplier} inputValue={supplier}
              onInputChange={(_, v) => setSupplier(v)} onChange={(_, v) => setSupplier(v || "")}
              renderInput={(params) => <TextField {...params} size="small" label="ร้านค้าที่แนะนำ (ไม่บังคับ)" />} />
            <TextField size="small" label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }} />
            <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(e) => {
              const arr = Array.from(e.target.files || []).map((file) => ({ key: key(), file, kind: file.type.startsWith("image/") ? "photo" : "quotation" }));
              setFiles((cur) => [...cur, ...arr].slice(0, 15)); e.target.value = "";
            }} />
            <Box onClick={() => fileRef.current?.click()} sx={{ p: 1.5, border: `1px dashed ${alpha(PR_ACCENT, 0.45)}`, borderRadius: 2, textAlign: "center", cursor: "pointer", "&:hover": { bgcolor: alpha(PR_ACCENT, 0.04) } }}>
              <AttachFile sx={{ color: PR_ACCENT }} />
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: PR_ACCENT }}>แนบใบเสนอราคา / สเปก / รูปถ่าย</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>JPG PNG HEIC PDF Word Excel · ไฟล์ละไม่เกิน {MAX_UPLOAD_MB} MB</Typography>
            </Box>
            {files.map((f) => (
              <Stack key={f.key} direction="row" alignItems="center" spacing={1} sx={{ p: 0.75, pl: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }} noWrap>{f.file.name}</Typography>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>{formatBytes(f.file.size)}</Typography>
                </Box>
                <TextField select size="small" value={f.kind} onChange={(e) => setFiles((cur) => cur.map((x) => (x.key === f.key ? { ...x, kind: e.target.value } : x)))} sx={{ width: 160 }}>
                  {FILE_KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
                </TextField>
                <IconButton size="small" onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}><Close fontSize="small" /></IconButton>
              </Stack>
            ))}
            {isMine && mySignature && (
              <Box sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                <FormControlLabel sx={{ mr: 0 }}
                  control={<Checkbox size="small" checked={useSignature} onChange={(e) => setUseSignature(e.target.checked)} sx={{ "&.Mui-checked": { color: PR_ACCENT } }} />}
                  label={<Stack direction="row" alignItems="center" spacing={0.75}><HistoryEdu sx={{ fontSize: 17, color: PR_ACCENT }} /><Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>ลงลายเซ็นอิเล็กทรอนิกส์ของฉันในช่อง “ผู้ขอซื้อ”</Typography></Stack>} />
                <Box component="img" src={mySignature.image} alt="" sx={{ display: "block", ml: 3.75, height: 32, maxWidth: 150, objectFit: "contain", opacity: useSignature ? 1 : 0.28 }} />
              </Box>
            )}
            {editing && request.attachments?.length > 0 && <Typography variant="caption" sx={{ color: TEXT_SUB }}>มีไฟล์แนบเดิม {request.attachments.length} ไฟล์ (จัดการได้ในหน้ารายละเอียด)</Typography>}
          </Stack>
        </Section>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1 }}>
        {error ? <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert> : (
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>ประมาณการ</Typography>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>{baht(total)} · {valid.length} รายการ</Typography>
          </Box>
        )}
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB, display: { xs: error ? "none" : "inline-flex", sm: "inline-flex" } }}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save /> : <Send />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: PR_ACCENT, "&:hover": { bgcolor: PR_DARK, boxShadow: "none" } }}>
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

