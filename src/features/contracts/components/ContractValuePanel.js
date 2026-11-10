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
import { Box, Button, CircularProgress, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import {
  AttachFileRounded as AttachFile, PictureAsPdfRounded as Pdf, ImageRounded as ImageIcon, InsertDriveFileRounded as FileIcon,
  DeleteOutlineRounded as DeleteOutline, AutoAwesomeRounded as AutoAwesome, InfoOutlined as Info,
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

const segSx = {
  bgcolor: "#f1f5f9", p: 0.25, borderRadius: 2,
  "& .MuiToggleButton-root": { border: 0, borderRadius: "7px !important", px: 1.25, py: 0.35, textTransform: "none", fontSize: "0.76rem", fontWeight: 600, color: "#64748b" },
  "& .Mui-selected": { bgcolor: "#fff !important", color: "#1d4ed8 !important", boxShadow: "0 1px 2px rgba(15,23,42,.12)" },
};

export default function ContractValuePanel({ contract: c, canEdit = false, onPatch }) {
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

  const fileIcon = (f) => (isPdf(f) ? <Pdf sx={{ fontSize: 18, color: "#dc2626" }} /> : isImg(f) ? <ImageIcon sx={{ fontSize: 18, color: "#2563eb" }} /> : <FileIcon sx={{ fontSize: 18, color: "#64748b" }} />);
  const canScan = canEdit && ai.enabled && files.some((f) => isPdf(f) || isImg(f));
  const aiSrc = ai.result?.found ? [KIND[ai.result.docType] || "เอกสาร", ai.result.docNo].filter(Boolean).join(" ") : "";

  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      {/* มูลค่า + VAT */}
      <Box>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1} flexWrap="wrap">
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#64748b" }}>มูลค่าทั้งสัญญา</Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: hasValue ? "#0f172a" : "#b45309", fontVariantNumeric: "tabular-nums" }}>
            {hasValue ? `฿${fmt(jobValue)}` : "ยังไม่ระบุมูลค่า"}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <ToggleButtonGroup size="small" exclusive value={vat === true ? "1" : vat === false ? "0" : null} onChange={onPickVat}
            disabled={!canEdit || Boolean(busy)} sx={segSx} aria-label="มูลค่าสัญญานี้คือ">
            <ToggleButton value="0">ก่อน VAT (Net)</ToggleButton>
            <ToggleButton value="1">รวม VAT 7%</ToggleButton>
          </ToggleButtonGroup>
          {busy === "vat" && <CircularProgress size={14} />}
        </Stack>
        {vat !== true && vat !== false ? (
          <Typography sx={{ mt: 0.6, fontSize: "0.72rem", color: "#b45309", lineHeight: 1.45 }}>
            ยังไม่ระบุว่ารวม VAT หรือไม่ — ระหว่างนี้งานแต่ละครั้งคิดเป็นยอดก่อน VAT
          </Typography>
        ) : parts && (
          <Typography sx={{ mt: 0.6, fontSize: "0.74rem", color: "#64748b", fontVariantNumeric: "tabular-nums", lineHeight: 1.5 }}>
            ก่อน VAT ฿{fmt2(parts.net)} · VAT ฿{fmt2(parts.vat)} · รวม VAT ฿{fmt2(parts.gross)}
          </Typography>
        )}
        {perRound !== null && (
          <Typography sx={{ mt: 0.25, fontSize: "0.72rem", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
            มูลค่างานรายครั้ง ≈ ฿{fmt(perRound)} ({vat === true ? "รวม VAT" : "ก่อน VAT"} · ÷ {rounds} ครั้ง ครั้งสุดท้ายรับเศษ)
          </Typography>
        )}
      </Box>

      {/* ใบเสนอราคาของสัญญา */}
      <Box sx={{ borderTop: "1px solid #eef2f7", pt: 1.1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#64748b" }}>
            ใบเสนอราคาของสัญญา{files.length ? ` · ${files.length} ไฟล์` : ""}
          </Typography>
          {canEdit && (
            <>
              <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={onUpload} />
              <Button size="small" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}
                startIcon={busy === "upload" ? <CircularProgress size={13} /> : <AttachFile sx={{ fontSize: 16 }} />}
                sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem", borderRadius: 2, color: "#2563eb", minWidth: 0 }}>
                {busy === "upload" ? "กำลังแนบ…" : "แนบใบเสนอราคา"}
              </Button>
            </>
          )}
        </Stack>
        {files.length === 0 ? (
          <Typography sx={{ mt: 0.4, fontSize: "0.74rem", color: "#94a3b8" }}>
            {canEdit ? "ยังไม่มีไฟล์ — แนบ PDF/รูปใบเสนอราคา แล้วให้ AI ช่วยอ่านมูลค่าได้" : "ยังไม่มีไฟล์"}
          </Typography>
        ) : (
          <Stack sx={{ mt: 0.5 }} gap={0.5}>
            {files.map((f) => (
              <Stack key={f._id || f.fileUrl} direction="row" alignItems="center" gap={1}
                sx={{ px: 1, py: 0.6, borderRadius: 1.5, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
                {fileIcon(f)}
                <Box component="a" href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                  sx={{ flex: 1, minWidth: 0, color: "#1e293b", textDecoration: "none", "&:hover": { color: "#2563eb" } }}>
                  <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{f.fileName || "ไฟล์"}</Typography>
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
                        {busy === `del:${f._id}` ? <CircularProgress size={14} /> : <DeleteOutline sx={{ fontSize: 17 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Stack>
        )}

        {canScan && (
          <Button size="small" variant="outlined" onClick={onScan} disabled={Boolean(busy)}
            startIcon={busy === "scan" ? <CircularProgress size={13} /> : <AutoAwesome sx={{ fontSize: 15 }} />}
            sx={{ mt: 1, textTransform: "none", fontWeight: 700, fontSize: "0.76rem", borderRadius: 2, borderColor: "#c7d2fe", color: "#4338ca" }}>
            {busy === "scan" ? "AI กำลังอ่านใบเสนอราคา…" : "ให้ AI อ่านมูลค่าจากใบเสนอราคา"}
          </Button>
        )}
        {ai.error && (
          <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: "#92400e" }}>⚠ {ai.error}</Typography>
        )}
        {ai.result?.found && (
          <Box sx={{ mt: 0.9, p: 1.1, borderRadius: 2, border: "1px solid #e0e7ff", bgcolor: "#f8faff" }}>
            <Typography sx={{ fontSize: "0.8rem", color: "#334155", fontVariantNumeric: "tabular-nums" }}>
              <b>AI อ่านได้</b> · ก่อน VAT ฿{fmt2(ai.result.amountBeforeVat)} · รวม VAT ฿{fmt2(ai.result.grandTotal)}
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "#64748b", mt: 0.25 }}>
              จาก {aiSrc}{ai.result.fileName ? ` · ${ai.result.fileName}` : ""}
            </Typography>
            {ai.result.note && <Typography sx={{ fontSize: "0.7rem", color: "#92400e", mt: 0.4 }}>⚠ {ai.result.note}</Typography>}
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.9 }}>
              {[[false, ai.result.amountBeforeVat, "ใช้ยอด Net", "บันทึกเป็นก่อน VAT"], [true, ai.result.grandTotal, "ใช้ยอดรวม VAT", "บันทึกเป็นรวม VAT"]].map(([gross, amt, label, sub]) => (
                <Button key={label} size="small" variant="outlined" disabled={Boolean(busy) || !(amt > 0)} onClick={() => applyAi(gross)}
                  sx={{ flex: "1 1 140px", flexDirection: "column", textTransform: "none", borderRadius: 2, borderColor: "#bfdbfe", color: "#1d4ed8", lineHeight: 1.3, py: 0.6 }}>
                  <Box component="span" sx={{ fontWeight: 700, fontSize: "0.78rem" }}>{label} ฿{fmt(amt)}</Box>
                  <Box component="span" sx={{ fontWeight: 500, fontSize: "0.66rem", color: "#64748b" }}>
                    {sub}{hasValue && Number(amt) !== jobValue ? ` · แทน ฿${fmt(jobValue)}` : ""}
                  </Box>
                </Button>
              ))}
            </Stack>
          </Box>
        )}
      </Box>

      <Stack direction="row" gap={0.6} alignItems="flex-start" sx={{ color: "#64748b" }}>
        <Info sx={{ fontSize: 14, mt: 0.15 }} />
        <Typography sx={{ fontSize: "0.68rem", lineHeight: 1.45 }}>
          มูลค่างานแต่ละครั้งของสัญญานี้ใช้การระบุ VAT ตรงนี้ (แก้ในฟอร์มรายครั้งไม่ได้) — ยอดรวมและการวางบิลถอด VAT ให้อัตโนมัติ
        </Typography>
      </Stack>
    </Box>
  );
}
