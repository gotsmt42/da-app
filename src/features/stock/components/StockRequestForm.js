/**
 * StockRequestForm — ยื่นใบเบิก/ยืมของจากคลังแผนก
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ต้องให้กรอกใบเบิกเพื่อขอเบิก และตัดยอดออกจากข้อมูล realtime")
 *    บังคับอิงงาน · แต่ละรายการเห็นยอด "เบิกได้" สดๆ (ฟังเรียลไทม์จากหน้าแม่) · ใส่เกินยอดไม่ได้
 *    ยื่นแล้ว = จองยอดไว้ทันที (คนอื่นเบิกชิ้นเดียวกันซ้ำไม่ได้) · ผู้ดูแลคลังอนุมัติ = ตัดยอดจริง
 *    มีทรัพย์สินในใบ → ถามวันที่จะคืน (ไม่บังคับ)
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  Autocomplete, CircularProgress, useMediaQuery, ButtonBase,
} from "@mui/material";
import { Close, DeleteOutline, Send, Add, Remove } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
import { JobOptionRow } from "@/shared/ui/JobTypeChip";
import StockService, { errorText } from "../services/StockService";
import { STOCK_ACCENT, STOCK_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, kindMeta, available, fmt } from "../stockMeta";
import { FIELD_SX, Label, Section, Thumb } from "./StockBits";

let seq = 0;
/** คอลัมน์แถวรายการบนจอกว้าง: รูป · สินค้า · เบิกได้ · จำนวน · ลบ */
const LINE_COLS = "40px minmax(0,1fr) 130px 128px 32px";
const key = () => `l${Date.now()}_${(seq += 1)}`;

export default function StockRequestForm({ open, dept, deptLabel, items, preset, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [job, setJob] = useState(null);
  const [jobQuery, setJobQuery] = useState("");
  const [jobOptions, setJobOptions] = useState([]);
  const [jobLoading, setJobLoading] = useState(false);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setJob(null); setNote(""); setDue(""); setTouched(false); setError("");
    setLines(preset ? [{ key: key(), itemId: preset._id, qty: 1 }] : [{ key: key(), itemId: "", qty: 1 }]);
  }, [open, preset]);

  useEffect(() => {
    if (!open) return undefined;
    setJobLoading(true);
    const t = setTimeout(() => {
      ExpenseService.jobs(jobQuery).then(setJobOptions).catch(() => setJobOptions([])).finally(() => setJobLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, jobQuery]);

  const byId = useMemo(() => new Map(items.map((it) => [it._id, it])), [items]);
  const pickable = useMemo(() => items.filter((it) => it.active !== false), [items]);
  const used = new Set(lines.map((l) => l.itemId).filter(Boolean));
  const setLine = (k, patch) => setLines((cur) => cur.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const filled = lines.filter((l) => l.itemId && l.qty > 0);
  const over = filled.some((l) => l.qty > available(byId.get(l.itemId)));
  const hasAsset = filled.some((l) => byId.get(l.itemId)?.kind === "asset");
  const jobLabel = (j) => (j ? (jobText(j) || j.title || "") : "");

  const submit = async () => {
    setTouched(true);
    if (!job) { setError("กรุณาเลือกงานที่จะใช้ของ — ทุกใบเบิกต้องอิงงาน"); return; }
    if (!filled.length) { setError("เลือกรายการที่จะเบิกอย่างน้อย 1 รายการ"); return; }
    if (over) { setError("มีรายการที่เบิกเกินยอดคงเหลือ"); return; }
    setBusy(true); setError("");
    try {
      const r = await StockService.createRequest({
        dept, eventId: job._id, note, dueReturnAt: hasAsset && due ? due : "",
        lines: filled.map((l) => ({ item: l.itemId, qty: l.qty })),
      });
      onSaved(r);
    } catch (err) {
      setError(errorText(err, "ยื่นใบเบิกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const totalQty = filled.reduce((t, l) => t + l.qty, 0);
  const addLine = () => setLines((cur) => [...cur, { key: key(), itemId: "", qty: 1 }]);

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1.08rem" }}>ใบเบิกของ</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>คลัง{deptLabel || ""} · ยื่นแล้วจองยอดทันที · ตัดยอดเมื่อผู้ดูแลคลังอนุมัติ</Typography>
        </Box>
        <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ bgcolor: "#f8fafc", pt: "16px !important", pb: 2 }}>
        <Stack spacing={1.5}>
          <Section n={1} title="ใช้กับงาน" hint="ทุกใบเบิกต้องอิงงาน — ดูย้อนหลังได้ว่างานไหนใช้ของอะไร" error={touched && !job}>
            <Autocomplete
              options={jobOptions} value={job} loading={jobLoading} filterOptions={(x) => x}
              onChange={(_, v) => setJob(v)}
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
                <TextField {...params} size="small" sx={FIELD_SX} placeholder="ค้นหาชื่องาน / โครงการ / เลขที่" error={touched && !job}
                  InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
            />
          </Section>

          <Section n={2} title="รายการที่จะเบิก" hint="ใส่ได้ไม่เกินยอดที่เบิกได้ของแต่ละรายการ"
            right={<Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB, fontWeight: 700, whiteSpace: "nowrap" }}>{filled.length} รายการ</Typography>}>
            <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden" }}>
              {/* หัวตาราง (จอกว้าง) */}
              <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: LINE_COLS, columnGap: 1.5, alignItems: "center", px: 1.5, py: 0.9, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER_MAIN}` }}>
                {["", "สินค้า / ทรัพย์สิน", "เบิกได้", "จำนวน", ""].map((h, i) => (
                  <Typography key={i} sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 800 }}>{h}</Typography>
                ))}
              </Box>
              {lines.map((l, idx) => {
                const it = byId.get(l.itemId);
                const av = available(it);
                const bad = it && l.qty > av;
                return (
                  <Box key={l.key} sx={{ px: 1.5, py: 1.25, borderTop: idx ? `1px solid ${BORDER_MAIN}` : 0, bgcolor: bad ? "#fef2f2" : "#fff",
                    display: "grid", columnGap: 1.5, rowGap: 1, alignItems: "center",
                    gridTemplateColumns: { xs: "40px minmax(0,1fr) auto auto", sm: LINE_COLS },
                    gridTemplateAreas: { xs: '"pic item item item" "pic avail qty del"', sm: '"pic item avail qty del"' } }}>
                    <Box sx={{ gridArea: "pic", alignSelf: { xs: "start", sm: "center" } }}>
                      {it ? <Thumb item={it} size={40} /> : (
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, border: "1.5px dashed #d7dde5", color: "#94a3b8", fontWeight: 800, fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{idx + 1}</Box>
                      )}
                    </Box>
                    <Autocomplete
                      sx={{ gridArea: "item", minWidth: 0 }}
                      options={pickable} value={it || null}
                      onChange={(_, v) => setLine(l.key, { itemId: v?._id || "", qty: 1 })}
                      getOptionLabel={(o) => o.name || ""}
                      getOptionDisabled={(o) => (used.has(o._id) && o._id !== l.itemId) || available(o) <= 0}
                      isOptionEqualToValue={(o, v) => o._id === v._id}
                      groupBy={(o) => o.category || kindMeta(o.kind).full}
                      renderOption={({ key: k, ...li }, o) => (
                        <li {...li} key={o._id}>
                          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: "100%", minWidth: 0 }}>
                            <Thumb item={o} size={34} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.88rem" }}>{o.name}</Typography>
                              <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{[o.code, kindMeta(o.kind).label, o.location].filter(Boolean).join(" · ")}</Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: available(o) > 0 ? TEXT_MAIN : "#dc2626", whiteSpace: "nowrap" }}>
                              {available(o) > 0 ? `${fmt(available(o))} ${o.unit}` : "หมด"}
                            </Typography>
                          </Stack>
                        </li>
                      )}
                      noOptionsText="ไม่มีของในคลังนี้"
                      renderInput={(params) => <TextField {...params} size="small" sx={FIELD_SX} placeholder="ค้นหา / เลือกสินค้า" error={touched && !l.itemId && lines.length === 1} />}
                    />
                    <Typography sx={{ gridArea: "avail", fontSize: "0.82rem", fontWeight: 700, color: bad ? "#dc2626" : it ? TEXT_MAIN : "#cbd5e1", whiteSpace: "nowrap" }}>
                      {it ? <>{fmt(av)} <Box component="span" sx={{ color: TEXT_SUB, fontWeight: 500 }}>{it.unit}</Box>{bad ? " · เกินยอด" : ""}</> : "—"}
                      <Box component="span" sx={{ display: { sm: "none" }, color: TEXT_SUB, fontWeight: 500 }}>{it ? " เบิกได้" : ""}</Box>
                    </Typography>
                    <Stack direction="row" alignItems="center" sx={{ gridArea: "qty", justifySelf: { xs: "end", sm: "start" }, height: 36, border: `1px solid ${bad ? "#fca5a5" : "#d7dde5"}`, borderRadius: 2, bgcolor: "#fff", opacity: it ? 1 : 0.45 }}>
                      <IconButton size="small" disabled={!it || l.qty <= 1} onClick={() => setLine(l.key, { qty: Math.max(1, l.qty - 1) })}><Remove sx={{ fontSize: 17 }} /></IconButton>
                      <TextField variant="standard" value={l.qty} disabled={!it} onChange={(e) => setLine(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 0)) })}
                        inputProps={{ inputMode: "numeric", style: { textAlign: "center", width: 40, fontWeight: 800 } }} InputProps={{ disableUnderline: true }} />
                      <IconButton size="small" disabled={!it || l.qty >= av} onClick={() => setLine(l.key, { qty: l.qty + 1 })}><Add sx={{ fontSize: 17 }} /></IconButton>
                    </Stack>
                    <IconButton size="small" sx={{ gridArea: "del", justifySelf: "end", color: "#94a3b8" }} disabled={lines.length === 1} onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}>
                      <DeleteOutline sx={{ fontSize: 19 }} />
                    </IconButton>
                  </Box>
                );
              })}
              <ButtonBase onClick={addLine} sx={{ width: "100%", justifyContent: "flex-start", gap: 0.75, px: 1.5, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, fontFamily: "inherit", fontWeight: 700, fontSize: "0.86rem", color: STOCK_DARK, "&:hover": { bgcolor: "#fffbeb" } }}>
                <Add sx={{ fontSize: 19 }} />เพิ่มรายการ
              </ButtonBase>
            </Box>
          </Section>

          <Section n={3} title="รายละเอียดเพิ่มเติม">
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: hasAsset ? "240px minmax(0,1fr)" : "1fr" } }}>
              {hasAsset && (
                <Box>
                  <Label hint="ไม่บังคับ">คืนทรัพย์สินภายใน</Label>
                  <ThaiDatePicker value={due} onChange={(v) => setDue(v || "")} />
                </Box>
              )}
              <Box>
                <Label>หมายเหตุ</Label>
                <TextField fullWidth size="small" sx={FIELD_SX} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={hasAsset ? 1 : 2}
                  placeholder="เช่น ใช้เปลี่ยนสายไฟห้องควบคุม ชั้น 3" />
              </Box>
            </Box>
          </Section>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${BORDER_MAIN}` }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", color: TEXT_SUB }}>
          รวม <b style={{ color: TEXT_MAIN }}>{filled.length}</b> รายการ{totalQty ? ` · ${fmt(totalQty)} หน่วย` : ""}{due && hasAsset ? ` · คืน ${moment(due).format("D/M")}` : ""}
        </Typography>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB, fontWeight: 700 }}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={busy || over} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Send />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", bgcolor: STOCK_ACCENT, "&:hover": { bgcolor: STOCK_DARK, boxShadow: "none" } }}>
          ยื่นใบเบิก
        </Button>
      </DialogActions>
    </Dialog>
  );
}
