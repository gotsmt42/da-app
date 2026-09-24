import { Box, Button, IconButton, Stack, TextField, Tooltip } from "@mui/material";
import { Add, ArrowDownward, ArrowUpward, Close } from "@mui/icons-material";

import { UI } from "./WebsiteUi";

/**
 * ตัวแก้รายการที่ใช้ซ้ำหลายหน้า: รายการข้อความ (ขอบเขตงาน · คำค้น) และตารางคู่ ชื่อ–ค่า (สเปกสินค้า)
 * ⚠️ แถวว่างถูกตัดทิ้งตอนบันทึก (ดู cleanList/cleanSpecs) — ผู้ใช้กด "เพิ่ม" เผื่อไว้แล้วไม่กรอก
 *    ต้องไม่กลายเป็นบรรทัดเปล่าๆ บนเว็บ
 */

const move = (arr, i, dir) => {
  const next = [...arr];
  const j = i + dir;
  if (j < 0 || j >= next.length) return arr;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

const RowTools = ({ i, n, onMove, onRemove }) => (
  <Stack direction="row" flexShrink={0}>
    <Tooltip title="เลื่อนขึ้น"><span><IconButton size="small" disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="เลื่อนขึ้น"><ArrowUpward sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
    <Tooltip title="เลื่อนลง"><span><IconButton size="small" disabled={i === n - 1} onClick={() => onMove(i, 1)} aria-label="เลื่อนลง"><ArrowDownward sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
    <Tooltip title="ลบแถวนี้"><IconButton size="small" onClick={() => onRemove(i)} aria-label="ลบแถวนี้"><Close sx={{ fontSize: 16 }} /></IconButton></Tooltip>
  </Stack>
);

export const cleanList = (arr) => (arr || []).map((s) => String(s).trim()).filter(Boolean);
export const cleanSpecs = (arr) =>
  (arr || []).map((s) => ({ label: String(s.label || "").trim(), value: String(s.value || "").trim() })).filter((s) => s.label && s.value);

/** รายการข้อความทีละบรรทัด */
/** @param {string} [itemLabel] ชื่อของแต่ละแถวสำหรับโปรแกรมอ่านหน้าจอ เช่น "ขอบเขตงาน" → "ขอบเขตงาน ข้อ 2" */
export function StringListEditor({ value = [], onChange, placeholder = "", addText = "เพิ่มรายการ", max = 30, maxLength = 300, itemLabel = "รายการ" }) {
  const rows = value.length ? value : [""];
  return (
    <Stack spacing={1}>
      {rows.map((v, i) => (
        <Stack key={i} direction="row" spacing={0.5} alignItems="center">
          <TextField
            value={v} size="small" fullWidth placeholder={placeholder}
            inputProps={{ maxLength, "aria-label": `${itemLabel} ข้อ ${i + 1}` }}
            onChange={(e) => onChange(rows.map((x, k) => (k === i ? e.target.value : x)))}
          />
          <RowTools i={i} n={rows.length} onMove={(a, d) => onChange(move(rows, a, d))} onRemove={(a) => onChange(rows.filter((_, k) => k !== a))} />
        </Stack>
      ))}
      {rows.length < max && (
        <Box>
          <Button size="small" startIcon={<Add />} onClick={() => onChange([...rows, ""])} sx={{ textTransform: "none", fontWeight: 700, color: UI.accent }}>
            {addText}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

/** สเปกสินค้า: หัวข้อ – ค่า */
export function SpecsEditor({ value = [], onChange, max = 30 }) {
  const rows = value.length ? value : [{ label: "", value: "" }];
  const set = (i, key, v) => onChange(rows.map((r, k) => (k === i ? { ...r, [key]: v } : r)));
  return (
    <Stack spacing={1}>
      {rows.map((r, i) => (
        <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}
          sx={{ p: { xs: 1, sm: 0 }, border: { xs: `1px solid ${UI.border}`, sm: "none" }, borderRadius: 2 }}>
          <TextField value={r.label} size="small" placeholder="หัวข้อ เช่น ชนิดระบบ" inputProps={{ maxLength: 80, "aria-label": `หัวข้อข้อมูลจำเพาะ แถว ${i + 1}` }}
            onChange={(e) => set(i, "label", e.target.value)} sx={{ width: { sm: 220 }, flexShrink: 0 }} />
          <TextField value={r.value} size="small" placeholder="ค่า เช่น Addressable" fullWidth inputProps={{ maxLength: 300, "aria-label": `ค่าข้อมูลจำเพาะ แถว ${i + 1}` }}
            onChange={(e) => set(i, "value", e.target.value)} />
          <RowTools i={i} n={rows.length} onMove={(a, d) => onChange(move(rows, a, d))} onRemove={(a) => onChange(rows.filter((_, k) => k !== a))} />
        </Stack>
      ))}
      {rows.length < max && (
        <Box>
          <Button size="small" startIcon={<Add />} onClick={() => onChange([...rows, { label: "", value: "" }])} sx={{ textTransform: "none", fontWeight: 700, color: UI.accent }}>
            เพิ่มข้อมูลจำเพาะ
          </Button>
        </Box>
      )}
    </Stack>
  );
}
