/**
 * ContractValuePanel — มูลค่าสัญญา · รวม VAT หรือไม่ · ใบเสนอราคาของสัญญา (หน้าภาพรวมงาน)
 *
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "งานสัญญาไม่ให้มีระบุก่อน VAT/รวม VAT (รายครั้ง) เนื่องจากเป็นราคารวมที่มาจากหน้าภาพรวมอยู่แล้ว
 *    จะผิดพลาดและสับสนได้ ให้ไปดำเนินการที่หน้าภาพรวมงาน ระบุแทนว่ารวม VAT หรือไม่ พร้อมให้แนบใบเสนอราคาที่หน้านั้นเลย")
 *    • เลือก "ก่อน VAT" / "รวม VAT 7%" ของมูลค่าทั้งสัญญา → งานทุกครั้งของสัญญาใช้ค่านี้ (เซิร์ฟเวอร์ซิงก์ให้)
 *    • แนบ/ลบใบเสนอราคาของสัญญา (ชุดเดียวกันทุกครั้ง) · ให้ AI อ่านยอดจากใบเสนอราคา แล้วกดใช้ยอด Net หรือรวม VAT
 *    onPatch(fields) = อัปเดตแถวในหน้าทันที (ทุกครั้งของสัญญา) หลังเซิร์ฟเวอร์บันทึกสำเร็จ
 */
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from "@mui/material";
import {
  AddRounded as Add, UploadFileRounded as UploadFile, PictureAsPdfRounded as Pdf, ImageRounded as ImageIcon, InsertDriveFileRounded as FileIcon,
  DeleteOutlineRounded as DeleteOutline, AutoAwesomeRounded as AutoAwesome,
  EditRounded as Edit, RadioButtonCheckedRounded as RadioOn, RadioButtonUncheckedRounded as RadioOff,
} from "@mui/icons-material";
import Swal from "@/shared/ui/swal";
import EventService from "@/shared/services/EventService";
import { ACCEPT_ALL } from "@/shared/utils/fileUpload";
import { perRoundAmount } from "@/shared/utils/billing";
import { vatParts } from "@/shared/utils/workValue";

const fmt2 = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const isPdf = (f) => /pdf/i.test(f?.fileType || "") || /\.pdf$/i.test(f?.fileName || "");
const isImg = (f) => /^image\//i.test(f?.fileType || "") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f?.fileName || "");
const errMsg = (e, fb) => e?.response?.data?.message || e?.message || fb;
const KIND = { po: "PO", quotation: "ใบเสนอราคา", invoice: "ใบวางบิล", contract: "สัญญา", other: "เอกสาร" };

// เช็คครั้งเดียวต่อการเปิดหน้า — ทุกการ์ดใช้ผลเดียวกัน
let aiAvailability = null;
const aiEnabled = () => {
  if (!aiAvailability) aiAvailability = EventService.BillingScanAvailability().then((a) => Boolean(a?.enabled)).catch(() => false);
  return aiAvailability;
};

export default function ContractValuePanel({ contract: c, canEdit = false, onPatch, flat = false }) {
  // flat = อยู่ในการ์ดของหน้าแล้ว — เนื้อในเป็นส่วนเรียบคั่นด้วยเส้น ไม่ซ้อนการ์ด
  const boxSx = flat ? { py: 1.25 } : cardSx;
  const gid = c?.key;
  const jobValue = Number(c?.jobValue);
  const hasValue = c?.jobValue !== null && c?.jobValue !== undefined && c?.jobValue !== "" && Number.isFinite(jobValue);
  const vat = c?.jobValueVatIncluded; // true | false | null (ยังไม่ระบุ)
  const files = c?.contractQuotationFiles || [];
  const rounds = Number(c?.visitCount) || 0;
  const parts = hasValue && jobValue > 0 ? vatParts(jobValue, vat === true) : null;
  const perRound = hasValue && rounds > 1 ? perRoundAmount(jobValue, rounds, 1) : null;

  const [busy, setBusy] = useState(""); // vat | upload | scan | apply | del:<id>
  const [ai, setAi] = useState({ enabled: false, result: null, error: "" });
  // ✅ (10 พ.ย. 2569 ผู้ใช้: "ไม่สามารถกรอกราคางานได้") ใส่/แก้มูลค่าสัญญาได้ในกล่องนี้เลย
  const [valEdit, setValEdit] = useState(null); // null = ไม่ได้แก้ · string = ข้อความในช่อง
  const valNum = valEdit === null ? null : Number(String(valEdit).replace(/[,\s฿]/g, ""));
  const valBad = valEdit !== null && String(valEdit).trim() !== "" && !(Number.isFinite(valNum) && valNum >= 0);
  const saveValue = async () => {
    if (valBad) return;
    const v = String(valEdit).trim() === "" ? null : valNum;
    if ((v === null && !hasValue) || v === jobValue) { setValEdit(null); return; }
    if (await save({ jobValue: v }, "value")) setValEdit(null);
  };
  const fileRef = useRef(null);
  useEffect(() => {
    let alive = true;
    if (canEdit) aiEnabled().then((on) => alive && setAi((s) => ({ ...s, enabled: on })));
    return () => { alive = false; };
  }, [canEdit]);

  const save = async (fields, kind) => {
    setBusy(kind);
    try {
      await EventService.UpdateContractFields(gid, fields);
      onPatch?.({ ...fields, ...(fields.jobValueVatIncluded !== undefined ? { workValueVatIncluded: fields.jobValueVatIncluded === true } : {}) });
      return true;
    } catch (e) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: errMsg(e, "ลองใหม่อีกครั้ง") });
      return false;
    } finally { setBusy(""); }
  };

  const onPickVat = (_, v) => {
    if (v === null || busy) return;
    const next = v === "1";
    if (next === vat) return;
    save({ jobValueVatIncluded: next }, "vat");
  };

  const onUpload = async (e) => {
    const list = [...(e.target.files || [])];
    e.target.value = "";
    if (!list.length) return;
    setBusy("upload");
    const added = [];
    try {
      for (const f of list) added.push(await EventService.UploadContractQuotationFile(gid, f));
    } catch (err) {
      Swal.fire({ icon: "error", title: "แนบไฟล์ไม่สำเร็จ", text: errMsg(err, "ลองใหม่อีกครั้ง") });
    } finally {
      const ok = added.filter(Boolean);
      if (ok.length) onPatch?.({ contractQuotationFiles: [...files, ...ok] });
      setBusy("");
    }
  };

  const onDelete = async (f) => {
    const r = await Swal.fire({
      icon: "warning", title: "ลบไฟล์นี้?", text: f.fileName || "", showCancelButton: true,
      confirmButtonText: "ลบไฟล์", cancelButtonText: "ยกเลิก", confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    setBusy(`del:${f._id}`);
    try {
      await EventService.DeleteContractQuotationFile(gid, f._id);
      onPatch?.({ contractQuotationFiles: files.filter((x) => String(x._id) !== String(f._id)) });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ลบไม่สำเร็จ", text: errMsg(err, "ลองใหม่อีกครั้ง") });
    } finally { setBusy(""); }
  };

  const onScan = async () => {
    setBusy("scan");
    setAi((s) => ({ ...s, result: null, error: "" }));
    try {
      const r = await EventService.ScanContractValue(gid);
      setAi((s) => ({ ...s, result: r, error: r?.found ? "" : `AI ยังหายอดที่ชัดเจนไม่เจอ${r?.note ? ` — ${r.note}` : ""}` }));
    } catch (err) {
      setAi((s) => ({ ...s, error: errMsg(err, "AI อ่านไฟล์ไม่สำเร็จ") }));
    } finally { setBusy(""); }
  };

  const applyAi = async (useGross) => {
    const r = ai.result;
    if (!r) return;
    const amount = useGross ? r.grandTotal : r.amountBeforeVat;
    if (await save({ jobValue: amount, jobValueVatIncluded: useGross }, "apply")) setAi((s) => ({ ...s, result: null }));
  };

  const fileIcon = (f) => (isPdf(f) ? <Pdf sx={{ fontSize: 20, color: "#dc2626" }} /> : isImg(f) ? <ImageIcon sx={{ fontSize: 20, color: "#2563eb" }} /> : <FileIcon sx={{ fontSize: 20, color: "#64748b" }} />);
  const canScan = canEdit && ai.enabled && files.some((f) => isPdf(f) || isImg(f));
  const aiSrc = ai.result?.found ? [KIND[ai.result.docType] || "เอกสาร", ai.result.docNo].filter(Boolean).join(" ") : "";
  const vatSet = vat === true || vat === false;
  const pickFile = () => fileRef.current?.click();

  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ทำให้ดูสวยงามและดูง่ายกว่านี้ ให้กระชับเข้าใจง่าย และเข้าธีม")
  //    2 กล่อง: มูลค่าสัญญา (ยอด · เลือก VAT · สรุปยอด) / ใบเสนอราคา (ไฟล์ · AI) — ตัวหนังสือน้อย อ่านจบในทีเดียว
  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ display: "flex", flexDirection: "column", gap: flat ? 0 : 1.5 }}>
      {canEdit && <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={onUpload} />}

      {/* ── มูลค่าสัญญา ── */}
      {/* 🔁 (10 พ.ย. 2569 ผู้ใช้: "การจัดวางและใช้สีดูไม่เหมาะสม ทำให้ดูสับสน สังเกตยาก")
            ยอด + ป้ายสถานะ VAT อยู่หัวการ์ด · คำถามชัดๆ "ยอดนี้รวม VAT แล้วหรือยัง?" · ตัวเลือกเป็นการ์ดมีวงกลมเลือก
            (เลือกแล้ว = กรอบฟ้าเข้ม) แต่ละตัวเลือกบอกยอดอีกฝั่งให้เห็นก่อนเลือก · สรุป 3 ช่อง · ยอดต่อครั้งแยกแถบของตัวเอง */}
      <Box sx={boxSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={labelSx}>มูลค่าสัญญา</Typography>
          {canEdit && valEdit === null && (
            <Button size="small" onClick={() => setValEdit(hasValue ? String(jobValue) : "")} disabled={Boolean(busy)} startIcon={<Edit sx={{ fontSize: 15 }} />}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem", borderRadius: 2, color: "#2563eb", minWidth: 0, py: 0.25 }}>
              {hasValue ? "แก้มูลค่า" : "ใส่มูลค่า"}
            </Button>
          )}
        </Stack>
        {valEdit !== null ? (
          <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ mt: 0.75 }}>
            <TextField autoFocus size="small" fullWidth value={valEdit} onChange={(e) => setValEdit(e.target.value)} error={valBad}
              placeholder="เช่น 120,000" helperText={valBad ? "ใส่เป็นตัวเลข 0 ขึ้นไป" : "มูลค่าทั้งสัญญา (ทุกครั้งรวมกัน)"}
              onKeyDown={(e) => { if (e.key === "Enter") saveValue(); if (e.key === "Escape") setValEdit(null); }}
              inputProps={{ inputMode: "decimal", autoComplete: "off" }}
              InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "1rem", fontWeight: 700, bgcolor: "#fff" } }} />
            <Button variant="contained" disableElevation onClick={saveValue} disabled={valBad || Boolean(busy)}
              sx={{ height: 40, borderRadius: 2, textTransform: "none", fontWeight: 700, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" }, flexShrink: 0 }}>
              {busy === "value" ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "บันทึก"}
            </Button>
            <Button onClick={() => setValEdit(null)} disabled={Boolean(busy)} sx={{ height: 40, textTransform: "none", color: "#64748b", minWidth: 0, flexShrink: 0 }}>ยกเลิก</Button>
          </Stack>
        ) : (
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.25 }}>
          <Typography onClick={canEdit && !hasValue ? () => setValEdit("") : undefined}
            sx={{ fontSize: hasValue ? "1.6rem" : "1.05rem", fontWeight: 800, lineHeight: 1.25, color: hasValue ? "#0f172a" : canEdit ? "#2563eb" : "#b45309", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", cursor: canEdit && !hasValue ? "pointer" : "default" }}>
            {hasValue ? `฿${fmt(jobValue)}` : canEdit ? "+ ใส่มูลค่าสัญญา" : "ยังไม่ระบุมูลค่า"}
          </Typography>
          {hasValue && (
            <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
              ...(vatSet ? { bgcolor: "#eff6ff", color: "#1d4ed8" } : { bgcolor: "#fef3c7", color: "#92400e" }) }}>
              {vatSet ? (vat ? "รวม VAT แล้ว" : "ยังไม่รวม VAT") : "ยังไม่ระบุ VAT"}
            </Box>
          )}
        </Stack>
        )}

        <Typography sx={{ mt: 1.75, mb: 0.75, fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>ยอดนี้รวม VAT แล้วหรือยัง?</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <VatOption selected={vat === false} busy={busy === "vat" && vat !== false} disabled={!canEdit || Boolean(busy)}
            title="ยังไม่รวม VAT" sub={hasValue && jobValue > 0 ? `+VAT = ฿${fmt2(vatParts(jobValue, false).gross)}` : "ยอด Net"}
            onClick={() => onPickVat(null, "0")} />
          <VatOption selected={vat === true} busy={busy === "vat" && vat !== true} disabled={!canEdit || Boolean(busy)}
            title="รวม VAT 7% แล้ว" sub={hasValue && jobValue > 0 ? `ก่อน VAT ฿${fmt2(vatParts(jobValue, true).net)}` : "ยอดรวมภาษี"}
            onClick={() => onPickVat(null, "1")} />
        </Box>
        {!vatSet && (
          <Typography sx={{ mt: 0.9, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "#fffbeb", borderLeft: "3px solid #f59e0b", fontSize: "0.74rem", color: "#92400e", lineHeight: 1.45 }}>
            {canEdit ? "กรุณาเลือก — ระหว่างนี้งานแต่ละครั้งคิดเป็นยอดก่อน VAT" : "ยังไม่ได้ระบุ — งานแต่ละครั้งคิดเป็นยอดก่อน VAT"}
          </Typography>
        )}

        {parts && vatSet && (
          <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #eef2f7", overflow: "hidden" }}>
            <Stat label="ก่อน VAT" value={`฿${fmt2(parts.net)}`} />
            <Stat label="VAT 7%" value={`฿${fmt2(parts.vat)}`} divider />
            <Stat label="รวมทั้งสิ้น" value={`฿${fmt2(parts.gross)}`} strong divider />
          </Box>
        )}
        {perRound !== null && (
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 1, px: 1.25, py: 0.9, borderRadius: 2, bgcolor: "#eff6ff" }}>
            <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: "#1e40af" }}>มูลค่างานต่อครั้ง · {rounds} ครั้ง</Typography>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: "#1d4ed8", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              ≈ ฿{fmt(perRound)}
              <Box component="span" sx={{ ml: 0.5, fontSize: "0.66rem", fontWeight: 600, color: "#3b82f6" }}>{vat === true ? "รวม VAT" : "ก่อน VAT"}</Box>
            </Typography>
          </Stack>
        )}
        <Typography sx={{ mt: 1, fontSize: "0.68rem", color: "#94a3b8" }}>งานทุกครั้งของสัญญานี้ใช้ VAT ตามที่เลือกตรงนี้</Typography>
      </Box>

      {/* ── ใบเสนอราคา ── */}
      <Box sx={flat ? { ...boxSx, borderTop: "1px solid #f1f5f9" } : boxSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography sx={labelSx}>ใบเสนอราคา{files.length ? ` (${files.length})` : ""}</Typography>
          {canEdit && files.length > 0 && (
            <Button size="small" onClick={pickFile} disabled={Boolean(busy)}
              startIcon={busy === "upload" ? <CircularProgress size={13} /> : <Add sx={{ fontSize: 16 }} />}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem", borderRadius: 2, color: "#2563eb", minWidth: 0, py: 0.25 }}>
              {busy === "upload" ? "กำลังแนบ…" : "เพิ่มไฟล์"}
            </Button>
          )}
        </Stack>

        {files.length === 0 ? (
          canEdit ? (
            <Box component="button" type="button" onClick={pickFile} disabled={Boolean(busy)}
              sx={{ mt: 1, width: "100%", display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: 2.5, cursor: "pointer", font: "inherit", textAlign: "left",
                border: "1.5px dashed #cbd5e1", bgcolor: "#fff", "&:hover": { borderColor: "#2563eb", bgcolor: "#f8fbff" }, "&:disabled": { opacity: 0.7, cursor: "default" } }}>
              <Box sx={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eff6ff", color: "#2563eb", flexShrink: 0 }}>
                {busy === "upload" ? <CircularProgress size={16} /> : <UploadFile sx={{ fontSize: 20 }} />}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f172a" }}>{busy === "upload" ? "กำลังแนบ…" : "แนบใบเสนอราคา"}</Typography>
                <Typography sx={{ fontSize: "0.7rem", color: "#64748b" }}>PDF หรือรูปภาพ · แนบแล้วให้ AI อ่านยอดได้</Typography>
              </Box>
            </Box>
          ) : (
            <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: "#94a3b8" }}>ยังไม่มีไฟล์</Typography>
          )
        ) : (
          <Stack sx={{ mt: 1 }} gap={0.75}>
            {files.map((f) => (
              <Stack key={f._id || f.fileUrl} direction="row" alignItems="center" gap={1}
                sx={{ pl: 1.1, pr: 0.5, py: 0.75, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #eef2f7" }}>
                {fileIcon(f)}
                <Box component="a" href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                  sx={{ flex: 1, minWidth: 0, color: "#1e293b", textDecoration: "none", "&:hover .cv-name": { color: "#2563eb" } }}>
                  <Typography noWrap className="cv-name" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{f.fileName || "ไฟล์"}</Typography>
                  {(f.uploadedBy || f.uploadedAt) && (
                    <Typography noWrap sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                      {[f.uploadedBy, f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : ""].filter(Boolean).join(" · ")}
                    </Typography>
                  )}
                </Box>
                {canEdit && (
                  <Tooltip title="ลบไฟล์">
                    <span>
                      <IconButton size="small" onClick={() => onDelete(f)} disabled={Boolean(busy)} sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626" } }}>
                        {busy === `del:${f._id}` ? <CircularProgress size={14} /> : <DeleteOutline sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Stack>
        )}

        {canScan && !ai.result?.found && (
          <Button fullWidth size="small" variant="outlined" onClick={onScan} disabled={Boolean(busy)}
            startIcon={busy === "scan" ? <CircularProgress size={13} /> : <AutoAwesome sx={{ fontSize: 16 }} />}
            sx={{ mt: 1.25, height: 38, textTransform: "none", fontWeight: 700, fontSize: "0.8rem", borderRadius: 2.5, borderColor: "#bfdbfe", color: "#2563eb", "&:hover": { borderColor: "#93c5fd", bgcolor: "#eff6ff" } }}>
            {busy === "scan" ? "AI กำลังอ่าน…" : "ให้ AI อ่านมูลค่าจากใบเสนอราคา"}
          </Button>
        )}
        {ai.error && <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: "#b45309" }}>{ai.error}</Typography>}
        {ai.result?.found && (
          <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2.5, bgcolor: "#eff6ff", border: "1px solid #dbeafe" }}>
            <Stack direction="row" alignItems="center" gap={0.6}>
              <AutoAwesome sx={{ fontSize: 15, color: "#2563eb" }} />
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e40af" }}>AI อ่านได้จาก {aiSrc}</Typography>
            </Stack>
            {ai.result.note && <Typography sx={{ fontSize: "0.7rem", color: "#b45309", mt: 0.4 }}>{ai.result.note}</Typography>}
            <Stack direction="row" gap={0.75} sx={{ mt: 1 }}>
              {[[false, ai.result.amountBeforeVat, "ก่อน VAT"], [true, ai.result.grandTotal, "รวม VAT"]].map(([gross, amt, label]) => (
                <Button key={label} variant="outlined" disabled={Boolean(busy) || !(amt > 0)} onClick={() => applyAi(gross)}
                  sx={{ flex: 1, flexDirection: "column", alignItems: "flex-start", textTransform: "none", borderRadius: 2, bgcolor: "#fff", borderColor: "#bfdbfe", color: "#0f172a", lineHeight: 1.3, py: 0.75, px: 1.25, "&:hover": { bgcolor: "#fff", borderColor: "#2563eb" } }}>
                  <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 600, color: "#64748b" }}>ใช้ยอด{label}</Box>
                  <Box component="span" sx={{ fontSize: "0.92rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>฿{fmt(amt)}</Box>
                </Button>
              ))}
            </Stack>
            <Button size="small" onClick={() => setAi((s) => ({ ...s, result: null }))} disabled={Boolean(busy)}
              sx={{ mt: 0.5, textTransform: "none", fontSize: "0.72rem", color: "#64748b", minWidth: 0, px: 0.5 }}>
              ไม่ใช้ผลนี้
            </Button>
          </Box>
        )}
      </Box>

    </Box>
  );
}

const cardSx = { p: 1.5, borderRadius: 3, bgcolor: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(15,23,42,.04)" };
const labelSx = { fontSize: "0.8rem", fontWeight: 700, color: "#334155" };

const Stat = ({ label, value, strong = false, divider = false }) => (
  <Box sx={{ px: 1, py: 0.9, textAlign: "center", minWidth: 0, ...(divider ? { borderLeft: "1px solid #eef2f7" } : {}), ...(strong ? { bgcolor: "#fff" } : {}) }}>
    <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: "#64748b" }}>{label}</Typography>
    <Typography noWrap sx={{ fontSize: strong ? "0.84rem" : "0.78rem", fontWeight: strong ? 800 : 600, color: strong ? "#0f172a" : "#334155", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
  </Box>
);

const VatOption = ({ selected, title, sub, onClick, disabled, busy }) => (
  <Box component="button" type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
    sx={{ display: "flex", alignItems: "flex-start", gap: 0.9, p: 1.1, borderRadius: 2.5, textAlign: "left", font: "inherit", cursor: disabled ? "default" : "pointer",
      border: "1.5px solid", borderColor: selected ? "#2563eb" : "#e2e8f0", bgcolor: selected ? "#eff6ff" : "#fff",
      boxShadow: selected ? "0 0 0 3px rgba(37,99,235,.12)" : "none", transition: "border-color .15s, background-color .15s",
      "&:hover:not(:disabled)": { borderColor: selected ? "#2563eb" : "#93c5fd" }, "&:disabled": { opacity: selected ? 1 : 0.75 } }}>
    {busy ? <CircularProgress size={18} sx={{ mt: 0.15, flexShrink: 0 }} />
      : selected ? <RadioOn sx={{ fontSize: 20, color: "#2563eb", flexShrink: 0 }} />
        : <RadioOff sx={{ fontSize: 20, color: "#cbd5e1", flexShrink: 0 }} />}
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.3, color: selected ? "#1d4ed8" : "#1e293b" }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.68rem", lineHeight: 1.35, color: "#64748b", fontVariantNumeric: "tabular-nums", mt: 0.2 }}>{sub}</Typography>
    </Box>
  </Box>
);
