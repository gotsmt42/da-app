/**
 * ExpenseBulkPrint — เลือกหลายใบแล้วพิมพ์รวดเดียว (ไฟล์เดียว · 1 ใบต่อแผ่น)
 *
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "ขอให้ระบบ print ใบ Advance / เคลมของทุกคนพร้อมกันได้ ตอนนี้ยัง print แยกทีละใบ
 *    ทำให้มันสะดวก ใช้งานง่าย สมบูรณ์ ห้ามให้ผิดพลาด")
 *    • รายการ = ใบที่กำลังแสดงในหน้า (ตามตัวกรองเดียวกัน) · ใบที่ยกเลิกไม่ถูกเลือกไว้ก่อน
 *    • เลือกทั้งหมด / ทีละคน / ทีละใบ · เรียงตามผู้เบิก (แยกกองให้แต่ละคนได้ทันที) หรือตามเลขที่
 *    • กดพิมพ์ → ExpensePrintDialog โหมด bulk: โหลดใบเต็ม + ลายเซ็นของทุกใบ แล้วรวมเป็นไฟล์เดียว
 *      โหลดใบไหนไม่ได้ = ไม่สร้างไฟล์ (บอกเลขที่ใบ) กันพิมพ์ไม่ครบโดยไม่รู้ตัว
 *    • ใบเคลมพิมพ์คู่กับใบ Advance ที่อ้างถึง (หน้า 2) เหมือนพิมพ์ทีละใบ
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Checkbox,
  ToggleButtonGroup, ToggleButton, FormControlLabel, Alert, useMediaQuery,
} from "@mui/material";
import { CloseRounded as Close, PrintRounded as Print } from "@mui/icons-material";
import ExpensePrintDialog from "./ExpensePrintDialog";
import StatusBadge from "./StatusBadge";
import { KIND_META, slipKind, baht, personFullName, TEXT_SUB, TEXT_MAIN, BORDER_MAIN } from "../expenseMeta";

/** จำกัดต่อครั้ง — ไฟล์ใหญ่เกินไปเครื่องมือถือ/เบราว์เซอร์อาจค้างตอนเตรียมพิมพ์ */
export const BULK_PRINT_MAX = 100;

const docNoKey = (no) => {
  const m = String(no || "").match(/(\d+)\/(\d{4})/);
  return m ? Number(m[2]) * 1e6 + Number(m[1]) : 0;
};

/**
 * @param {Array}  docs   ใบที่กำลังแสดง (รูปแบบเดียวกับ /api/expenses list)
 * @param {string} kind   advance | claim | contractor — ใช้ตั้งสี/ชื่อไฟล์
 * @param {string} [label] ชื่อชุด เช่น "ใบ Advance" (ใช้ในชื่อไฟล์)
 */
export default function ExpenseBulkPrint({ open, onClose, docs = [], kind = "advance", label = "ใบเบิก", note = "" }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [order, setOrder] = useState("person");
  const [withCancelled, setWithCancelled] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [printJob, setPrintJob] = useState(null);
  const meta = KIND_META[kind] || KIND_META.advance;

  const pool = useMemo(() => docs.filter((d) => d?._id && (withCancelled || d.status !== "cancelled")), [docs, withCancelled]);
  // เปิดกล่อง / เปลี่ยนชุดใบ = เลือกทุกใบที่ยังไม่ยกเลิกไว้ก่อน (งานที่ทำบ่อยที่สุด: พิมพ์ทั้งหมด)
  useEffect(() => {
    if (open) setPicked(new Set(pool.filter((d) => d.status !== "cancelled").map((d) => String(d._id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตตอนเปิด/ชุดใบเปลี่ยนเท่านั้น
  }, [open, docs]);

  const groups = useMemo(() => {
    const sorted = [...pool].sort((a, b) => (order === "person"
      ? personFullName(a.requester).localeCompare(personFullName(b.requester), "th") || docNoKey(a.docNo) - docNoKey(b.docNo)
      : docNoKey(a.docNo) - docNoKey(b.docNo)));
    if (order !== "person") return [{ key: "all", name: "", rows: sorted }];
    const m = new Map();
    sorted.forEach((d) => {
      const name = personFullName(d.requester) || "-";
      if (!m.has(name)) m.set(name, { key: name, name, rows: [] });
      m.get(name).rows.push(d);
    });
    return [...m.values()];
  }, [pool, order]);

  const orderedPicked = groups.flatMap((g) => g.rows).filter((d) => picked.has(String(d._id)));
  const n = orderedPicked.length;
  const tooMany = n > BULK_PRINT_MAX;
  const claims = orderedPicked.filter((d) => d.kind === "claim" && slipKind(d) === "claim").length;

  const toggle = (ids, on) => setPicked((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  });
  const allIds = pool.map((d) => String(d._id));
  const allOn = allIds.length > 0 && allIds.every((id) => picked.has(id));

  const startPrint = () => {
    if (!n || tooMany) return;
    const people = new Set(orderedPicked.map((d) => personFullName(d.requester))).size;
    setPrintJob({
      docs: orderedPicked.map((d) => ({ _id: d._id, docNo: d.docNo })),
      kind,
      title: `${label} ${n} ใบ${people > 1 ? ` (${people} คน)` : people === 1 ? ` · ${personFullName(orderedPicked[0].requester)}` : ""}`,
      orderLabel: order === "person" ? "เรียงตามผู้เบิก" : "เรียงตามเลขที่",
    });
  };

  return (
    <>
      <Dialog open={open && !printJob} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, maxHeight: isMobile ? "100%" : "88vh" } }}>
        <DialogTitle sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}`, borderTop: `5px solid ${meta.color}` }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: meta.color, color: "#fff", flexShrink: 0 }}>
              <Print sx={{ fontSize: 21 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3 }}>พิมพ์หลายใบพร้อมกัน</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>เลือกใบที่ต้องการ · รวมเป็นไฟล์เดียว ขึ้นแผ่นใหม่ทุกใบ</Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="ปิด"><Close /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {note && <Alert severity="info" sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{note}</Alert>}
          {/* ตัวเลือก: ลำดับ · เลือกทั้งหมด · รวมใบที่ยกเลิก */}
          <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" sx={{ px: 2, py: 1.25, gap: 1, borderBottom: `1px solid ${BORDER_MAIN}`, bgcolor: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
            <FormControlLabel
              sx={{ mr: "auto", "& .MuiFormControlLabel-label": { fontSize: "0.86rem", fontWeight: 700 } }}
              control={<Checkbox size="small" checked={allOn} indeterminate={!allOn && picked.size > 0} onChange={(e) => toggle(allIds, e.target.checked)} />}
              label={`เลือกทั้งหมด (${pool.length})`}
            />
            <ToggleButtonGroup size="small" exclusive value={order} onChange={(_, v) => v && setOrder(v)}
              sx={{ bgcolor: "#eef2f7", p: 0.3, borderRadius: 2, "& .MuiToggleButton-root": { border: 0, borderRadius: "7px !important", textTransform: "none", fontWeight: 700, fontSize: "0.78rem", px: 1.25, py: 0.35, color: TEXT_SUB },
                "& .Mui-selected": { bgcolor: "#fff !important", color: `${TEXT_MAIN} !important`, boxShadow: "0 1px 2px rgba(15,23,42,.12)" } }}>
              <ToggleButton value="person">เรียงตามผู้เบิก</ToggleButton>
              <ToggleButton value="docNo">เรียงตามเลขที่</ToggleButton>
            </ToggleButtonGroup>
            {docs.some((d) => d.status === "cancelled") && (
              <FormControlLabel sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem", color: TEXT_SUB } }}
                control={<Checkbox size="small" checked={withCancelled} onChange={(e) => setWithCancelled(e.target.checked)} />} label="แสดงใบที่ยกเลิก" />
            )}
          </Stack>

          {pool.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: "center", color: TEXT_SUB }}>ไม่มีใบในรายการที่แสดงอยู่ — ปรับตัวกรองก่อน</Typography>
          ) : groups.map((g) => {
            const ids = g.rows.map((d) => String(d._id));
            const on = ids.filter((id) => picked.has(id)).length;
            return (
              <Box key={g.key}>
                {g.name && (
                  <Stack direction="row" alignItems="center" sx={{ px: 1.25, py: 0.4, bgcolor: "#fff", borderBottom: `1px solid ${BORDER_MAIN}` }}>
                    <Checkbox size="small" checked={on === ids.length} indeterminate={on > 0 && on < ids.length} onChange={(e) => toggle(ids, e.target.checked)} />
                    <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.88rem", color: TEXT_MAIN }}>{g.name}</Typography>
                    <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, pr: 1 }}>เลือก {on}/{ids.length} ใบ</Typography>
                  </Stack>
                )}
                {g.rows.map((d) => {
                  const id = String(d._id);
                  const sk = slipKind(d);
                  return (
                    <Stack key={id} direction="row" alignItems="center" spacing={0.5} onClick={() => toggle([id], !picked.has(id))}
                      sx={{ pl: g.name ? 3 : 1.25, pr: 2, py: 0.6, cursor: "pointer", borderBottom: "1px solid #f1f5f9", opacity: d.status === "cancelled" ? 0.6 : 1, "&:hover": { bgcolor: "#f8fafc" } }}>
                      <Checkbox size="small" checked={picked.has(id)} onClick={(e) => e.stopPropagation()} onChange={(e) => toggle([id], e.target.checked)} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", whiteSpace: "nowrap", color: KIND_META[sk]?.dark || TEXT_MAIN }}>{d.docNo || "-"}</Typography>
                          <Box component="span" sx={{ flexShrink: 0, px: 0.75, py: 0.1, borderRadius: 1, fontSize: "0.66rem", fontWeight: 700, color: KIND_META[sk]?.dark, bgcolor: KIND_META[sk]?.soft }}>
                            {sk === "claim" ? "ใบเคลม + Advance" : KIND_META[sk]?.short}
                          </Box>
                          {!g.name && <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{personFullName(d.requester)}</Typography>}
                        </Stack>
                        <Typography noWrap sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>{d.subject || d.job?.title || "-"}</Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.25} sx={{ flexShrink: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{baht(d.total)}</Typography>
                        <StatusBadge status={d.status} kind={sk} />
                      </Stack>
                    </Stack>
                  );
                })}
              </Box>
            );
          })}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, flexDirection: "column", alignItems: "stretch", gap: 1 }}>
          {tooMany && <Alert severity="warning" sx={{ py: 0 }}>พิมพ์ได้ครั้งละไม่เกิน {BULK_PRINT_MAX} ใบ — เลือกออกบางส่วน หรือกรองทีละคน/ทีละเดือน</Alert>}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ m: "0 !important" }}>
            <Typography sx={{ flex: 1, fontSize: "0.8rem", color: TEXT_SUB, lineHeight: 1.4 }}>
              เลือก <b style={{ color: TEXT_MAIN }}>{n}</b> ใบ{claims ? ` · ใบเคลม ${claims} ใบพิมพ์คู่ใบ Advance (2 แผ่น)` : ""}
            </Typography>
            <Button onClick={onClose} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
            <Button variant="contained" disableElevation onClick={startPrint} disabled={!n || tooMany} startIcon={<Print />}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.25, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
              พิมพ์ {n} ใบ
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <ExpensePrintDialog open={Boolean(printJob)} bulk={printJob} onClose={() => { setPrintJob(null); onClose?.(); }} />
    </>
  );
}
