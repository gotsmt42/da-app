/**
 * StockReturnForm — ยื่นใบคืนของ (RT) จากใบเบิกที่จ่ายของแล้ว
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ไม่ให้ผิดพลาดในการจัดการของ ของหาย ต้องมีใบคืนสินค้าด้วย" → "ใบคืนของ + สภาพของ")
 *   แต่ละรายการ: จำนวนที่คืน (ไม่เกินที่คืนได้) · สภาพ ปกติ / ชำรุด / สูญหาย (สูญหายเฉพาะทรัพย์สิน) · หมายเหตุ
 *   แนบรูปของที่คืนได้ไม่เกิน 6 รูป (หลักฐาน) · ผู้ดูแลคลังยื่นแทนแล้ว "ตรวจรับทันที" ได้
 *   "คืนได้" = เบิกไป − คืน/ปิดแล้ว − อยู่ในใบคืนอื่นที่รอตรวจรับ (server ตรวจซ้ำอีกชั้น)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  CircularProgress, useMediaQuery, ButtonBase, Checkbox, FormControlLabel,
} from "@mui/material";
import { Close, Add, Remove, AttachFile, AssignmentReturn, InsertDriveFile } from "@mui/icons-material";

import { prepareUploadFile, ACCEPT_ALL } from "@/shared/utils/fileUpload";
import StockService, { errorText } from "../services/StockService";
import { STOCK_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, CONDITIONS, fmt } from "../stockMeta";
import { FIELD_SX, Label, Section, Thumb, KindTag } from "./StockBits";

const RT_TONE = "#0f766e";
const MAX_PHOTOS = 6;

export default function StockReturnForm({ open, request: sr, items = [], canManage, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [held, setHeld] = useState(null); // lineId → จำนวนในใบคืนที่รอตรวจรับ
  const [rows, setRows] = useState({});
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState([]);
  const [receiveNow, setReceiveNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const photoOf = useMemo(() => new Map(items.map((it) => [String(it._id), it])), [items]);

  useEffect(() => {
    if (!open || !sr) return;
    setRows({}); setNote(""); setPhotos([]); setError(""); setReceiveNow(true); setHeld(null);
    StockService.returns({ requestId: sr._id, status: "pending", scope: canManage ? undefined : "mine" })
      .then((list) => {
        const m = {};
        list.forEach((d) => d.lines.forEach((l) => { m[l.lineId] = (m[l.lineId] || 0) + l.qty; }));
        setHeld(m);
      })
      .catch(() => setHeld({}));
  }, [open, sr, canManage]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), [photos]);

  const lines = (sr?.lines || []).map((l) => ({ ...l, can: Math.max(0, l.qty - (l.returnedQty || 0) - (held?.[String(l._id)] || 0)) }));
  const row = (id) => rows[id] || { qty: 0, condition: "good", note: "" };
  const setRow = (id, patch) => setRows((cur) => ({ ...cur, [id]: { ...row(id), ...patch } }));
  const picked = lines.filter((l) => row(String(l._id)).qty > 0);
  const totalQty = picked.reduce((t, l) => t + row(String(l._id)).qty, 0);
  const needNote = picked.some((l) => row(String(l._id)).condition !== "good" && !row(String(l._id)).note.trim());

  const addPhotos = async (files) => {
    const room = MAX_PHOTOS - photos.length;
    const out = [];
    for (const f of [...files].slice(0, room)) {
      // eslint-disable-next-line no-await-in-loop -- บีบอัดทีละรูป
      // ✅ (ผู้ใช้: "ให้เพิ่มรูปแบบไฟล์ได้ด้วย") รับทั้งรูปและเอกสาร (PDF/Word/Excel) — ชนิดที่อนุญาตตาม fileUpload กลาง
      const r = await prepareUploadFile(f);
      if (r.ok) out.push({ file: r.file, preview: URL.createObjectURL(r.file), isImage: r.file.type.startsWith("image/") });
    }
    setPhotos((cur) => [...cur, ...out]);
  };

  const submit = async () => {
    if (!picked.length) { setError("ใส่จำนวนที่จะคืนอย่างน้อย 1 รายการ"); return; }
    if (needNote) { setError("รายการที่ชำรุด/สูญหาย กรุณาระบุรายละเอียด"); return; }
    setBusy(true); setError("");
    try {
      const doc = await StockService.createReturn({
        requestId: sr._id, note, receiveNow: canManage && receiveNow,
        lines: picked.map((l) => ({ lineId: l._id, ...row(String(l._id)) })),
      }, photos.map((p) => p.file));
      onSaved(doc);
    } catch (err) {
      setError(errorText(err, "ยื่นใบคืนไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1.08rem" }}>ใบคืนของ</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }} noWrap>อ้างใบเบิก {sr?.docNo} · {sr?.requester?.name}</Typography>
        </Box>
        <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ bgcolor: "#f8fafc", pt: "16px !important" }}>
        <Stack spacing={1.5}>
          <Section n={1} title="รายการที่คืน" hint="ใส่จำนวนและสภาพของจริงที่ส่งคืน — ผู้ดูแลคลังจะตรวจก่อนรับเข้า">
            <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden" }}>
              {lines.map((l, i) => {
                const id = String(l._id);
                const r = row(id);
                const off = l.can <= 0;
                return (
                  <Box key={id} sx={{ px: 1.5, py: 1.25, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0, bgcolor: r.qty > 0 ? "#f0fdfa" : "#fff", opacity: off ? 0.55 : 1 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Thumb item={photoOf.get(String(l.item)) || { kind: l.kind }} size={42} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{l.name}</Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <KindTag kind={l.kind} />
                          <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }} noWrap>
                            เบิก {fmt(l.qty)} · คืนได้ {fmt(l.can)} {l.unit}{held?.[id] ? ` (รอตรวจ ${fmt(held[id])})` : ""}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack direction="row" alignItems="center" sx={{ height: 36, border: `1px solid #d7dde5`, borderRadius: 2, bgcolor: "#fff", flexShrink: 0 }}>
                        <IconButton size="small" disabled={off || r.qty <= 0} onClick={() => setRow(id, { qty: r.qty - 1 })}><Remove sx={{ fontSize: 17 }} /></IconButton>
                        <TextField variant="standard" value={r.qty} disabled={off}
                          onChange={(e) => setRow(id, { qty: Math.min(l.can, Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0))) })}
                          inputProps={{ inputMode: "numeric", style: { textAlign: "center", width: 36, fontWeight: 800 } }} InputProps={{ disableUnderline: true }} />
                        <IconButton size="small" disabled={off || r.qty >= l.can} onClick={() => setRow(id, { qty: r.qty + 1 })}><Add sx={{ fontSize: 17 }} /></IconButton>
                      </Stack>
                    </Stack>
                    {r.qty > 0 && (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1, pl: { sm: 6.5 } }}>
                        <Stack direction="row" sx={{ p: 0.4, borderRadius: 2, bgcolor: "#f1f5f9", flexShrink: 0 }}>
                          {Object.entries(CONDITIONS).filter(([, c]) => !c.assetOnly || l.kind === "asset").map(([k, c]) => {
                            const on = r.condition === k;
                            return (
                              <ButtonBase key={k} onClick={() => setRow(id, { condition: k })}
                                sx={{ px: 1.5, height: 30, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: on ? 800 : 600,
                                  color: on ? c.color : TEXT_SUB, bgcolor: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 2px rgba(15,23,42,.12)" : "none" }}>
                                {c.label}
                              </ButtonBase>
                            );
                          })}
                        </Stack>
                        {r.condition !== "good" ? (
                          <TextField size="small" fullWidth sx={FIELD_SX} value={r.note} onChange={(e) => setRow(id, { note: e.target.value })}
                            placeholder={r.condition === "lost" ? "เล่าเหตุการณ์ที่หาย (บังคับ)" : "อาการชำรุด (บังคับ)"} error={!r.note.trim()} />
                        ) : (
                          <Typography sx={{ fontSize: "0.76rem", color: CONDITIONS.good.color, alignSelf: "center" }}>{CONDITIONS.good.effect}</Typography>
                        )}
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Section>

          <Section n={2} title="หลักฐาน · หมายเหตุ" hint={`แนบรูปหรือไฟล์ (PDF · Word · Excel) ไม่เกิน ${MAX_PHOTOS} ไฟล์ — ใช้ยืนยันสภาพตอนส่งคืน`}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, mb: 1.5 }}>
              {photos.map((p, i) => (
                <Box key={p.preview} sx={{ position: "relative", width: 76, height: 76, borderRadius: 2, overflow: "hidden", border: `1px solid ${BORDER_MAIN}` }}>
                  {p.isImage ? <Box component="img" src={p.preview} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
                    <Stack alignItems="center" justifyContent="center" spacing={0.25} sx={{ width: "100%", height: "100%", bgcolor: "#f8fafc", px: 0.5 }}>
                      <InsertDriveFile sx={{ fontSize: 26, color: "#dc2626" }} />
                      <Typography noWrap sx={{ fontSize: "0.62rem", color: TEXT_SUB, maxWidth: "100%" }}>{p.file.name}</Typography>
                    </Stack>
                  )}
                  <IconButton size="small" onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
                    sx={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, bgcolor: "rgba(15,23,42,.6)", color: "#fff", "&:hover": { bgcolor: "rgba(15,23,42,.8)" } }}>
                    <Close sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              {photos.length < MAX_PHOTOS && (
                <ButtonBase onClick={() => fileRef.current?.click()} sx={{ width: 76, height: 76, borderRadius: 2, border: "2px dashed #d7dde5", flexDirection: "column", gap: 0.25, color: TEXT_SUB, fontFamily: "inherit", fontSize: "0.72rem" }}>
                  <AttachFile sx={{ fontSize: 24, color: "#94a3b8" }} />แนบไฟล์
                </ButtonBase>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT_ALL} multiple hidden onChange={(e) => { const f = e.target.files; if (f?.length) addPhotos(f); e.target.value = ""; }} />
            </Stack>
            <Label>หมายเหตุ</Label>
            <TextField fullWidth size="small" sx={FIELD_SX} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} placeholder="เช่น ใช้ไม่หมด คืนส่วนที่เหลือ" />
            {canManage && (
              <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={receiveNow} onChange={(e) => setReceiveNow(e.target.checked)} />}
                label={<Typography sx={{ fontSize: "0.86rem" }}>ตรวจรับคืนทันที <Box component="span" sx={{ color: TEXT_SUB }}>(ผู้ดูแลคลังรับของจากมือผู้คืนแล้ว)</Box></Typography>} />
            )}
          </Section>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${BORDER_MAIN}` }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", color: TEXT_SUB }}>
          คืน <b style={{ color: TEXT_MAIN }}>{picked.length}</b> รายการ{totalQty ? ` · ${fmt(totalQty)} หน่วย` : ""}
        </Typography>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB, fontWeight: 700 }}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={busy || held === null || !picked.length}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <AssignmentReturn />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", bgcolor: RT_TONE, "&:hover": { bgcolor: STOCK_DARK, boxShadow: "none" } }}>
          {canManage && receiveNow ? "บันทึกและรับคืน" : "ยื่นใบคืน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
