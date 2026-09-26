import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Add, ArrowDownward, ArrowUpward, DeleteOutline } from "@mui/icons-material";

import { BLOCK_TYPES, emptyBlock } from "../utils/webContent";
import ImageManager from "./ImageManager";
import { StringListEditor } from "./ListEditors";
import { UI } from "./WebsiteUi";

/**
 * ตัวเขียนเนื้อหาบทความแบบบล็อก (ย่อหน้า · หัวข้อ · รายการ · ตาราง · หมายเหตุ · รูปภาพ)
 *
 * ⚠️ ตั้งใจไม่ใช้ตัวแก้แบบ Word/HTML — บทความเก็บเป็นบล็อก หน้าเว็บวาดเองทีละชนิด
 *    จึงไม่มีทางฝังสคริปต์ขึ้นเว็บสาธารณะได้ (ดู da-app-server/src/models/WebArticle.js)
 *    และหน้าตาทุกบทความสม่ำเสมอ ไม่มีใครเผลอใส่ตัวอักษรสีม่วงขนาด 30px กลางบทความ
 * ⚠️ ตารางต้องมีจำนวนช่องในแถวเท่าหัวตารางเสมอ — เพิ่ม/ลบคอลัมน์ที่หัวตาราง แถวปรับตามอัตโนมัติ
 */
export default function ArticleBlockEditor({ value = [], onChange, onError }) {
  const set = (i, block) => onChange(value.map((b, k) => (k === i ? block : b)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (type, at = value.length) => {
    const next = [...value];
    next.splice(at, 0, emptyBlock(type));
    onChange(next);
  };

  return (
    <Stack spacing={1.5}>
      {value.map((b, i) => (
        <Box key={i} sx={{ border: `1px solid ${UI.border}`, borderRadius: 2, bgcolor: "#fff" }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.5, bgcolor: UI.soft, borderBottom: `1px solid ${UI.border}`, borderRadius: "8px 8px 0 0" }}>
            <TextField
              select size="small" value={b.type} variant="standard"
              onChange={(e) => {
                const next = emptyBlock(e.target.value);
                // ⚠️ ย้ายข้อความเดิมตามไปเฉพาะชนิดที่มีช่องข้อความ — บล็อกรูปไม่มี text
                set(i, "text" in next ? { ...next, text: b.text ?? "" } : next);
              }}
              InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: "0.82rem" } }}
            >
              {BLOCK_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="เลื่อนขึ้น"><span><IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น"><ArrowUpward sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            <Tooltip title="เลื่อนลง"><span><IconButton size="small" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="เลื่อนลง"><ArrowDownward sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            <Tooltip title="ลบบล็อกนี้"><IconButton size="small" color="error" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="ลบบล็อกนี้"><DeleteOutline sx={{ fontSize: 17 }} /></IconButton></Tooltip>
          </Stack>

          <Box sx={{ p: 1.25 }}>
            {(b.type === "p" || b.type === "note") && (
              <TextField value={b.text || ""} onChange={(e) => set(i, { ...b, text: e.target.value })}
                multiline minRows={b.type === "p" ? 3 : 2} fullWidth size="small" inputProps={{ maxLength: 5000 }}
                placeholder={b.type === "p" ? "พิมพ์ย่อหน้า…" : "ข้อความในกล่องหมายเหตุ (เน้นข้อควรระวัง/เคล็ดลับ)"} />
            )}
            {b.type === "h2" && (
              <TextField value={b.text || ""} onChange={(e) => set(i, { ...b, text: e.target.value })}
                fullWidth size="small" inputProps={{ maxLength: 200, style: { fontWeight: 800, fontSize: "1.05rem" } }} placeholder="หัวข้อย่อย" />
            )}
            {b.type === "list" && (
              <StringListEditor value={b.items || []} onChange={(items) => set(i, { ...b, items })} placeholder="ข้อความหนึ่งข้อ" addText="เพิ่มข้อ" maxLength={1000} itemLabel="รายการในบทความ" />
            )}
            {b.type === "table" && <TableBlock block={b} onChange={(nb) => set(i, nb)} />}
            {b.type === "image" && (
              <Stack spacing={1.25}>
                {/* ⚠️ ใช้ตัวจัดการรูปตัวเดียวกับที่อื่นทั้งระบบ — อัปขึ้น Cloudinary แล้วเก็บ url+publicId
                    ไม่ใช่ช่องให้วางลิงก์เอง (ลิงก์ภายนอกหายเมื่อไรก็ได้ และเป็นช่องให้ยัดของแปลกปลอม) */}
                <ImageManager
                  single value={b.image ? [b.image] : []}
                  onChange={(arr) => set(i, { ...b, image: arr[0] || null })}
                  onError={onError} label="รูปในบทความ"
                  hint="อัปแล้วอย่าลืมกดบันทึกบทความ รูปถึงจะขึ้นเว็บ"
                />
                <TextField value={b.caption || ""} onChange={(e) => set(i, { ...b, caption: e.target.value })}
                  fullWidth size="small" inputProps={{ maxLength: 300 }} placeholder="คำบรรยายใต้รูป (ไม่บังคับ)" />
              </Stack>
            )}
          </Box>
        </Box>
      ))}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography sx={{ color: UI.sub, fontSize: "0.82rem", mr: 0.5 }}>เพิ่ม:</Typography>
        {BLOCK_TYPES.map((t) => (
          <Button key={t.value} size="small" variant="outlined" color="inherit" startIcon={<Add sx={{ fontSize: 16 }} />}
            onClick={() => add(t.value)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: UI.border }}>
            {t.label}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

function TableBlock({ block, onChange }) {
  const head = block.head || [];
  const rows = block.rows || [];
  const setHead = (c, v) => onChange({ ...block, head: head.map((h, k) => (k === c ? v : h)) });
  const setCell = (r, c, v) => onChange({ ...block, rows: rows.map((row, k) => (k === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
  const addCol = () => onChange({ head: [...head, ""], rows: rows.map((r) => [...r, ""]), type: "table" });
  const delCol = (c) => head.length > 1 && onChange({ ...block, head: head.filter((_, k) => k !== c), rows: rows.map((r) => r.filter((_, k) => k !== c)) });
  const addRow = () => onChange({ ...block, rows: [...rows, head.map(() => "")] });
  const delRow = (r) => onChange({ ...block, rows: rows.filter((_, k) => k !== r) });

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ borderCollapse: "collapse", minWidth: "100%", "& td": { p: 0.4, verticalAlign: "top" } }}>
        <tbody>
          <tr>
            {head.map((h, c) => (
              <td key={c}>
                <Stack direction="row" alignItems="center">
                  <TextField value={h} onChange={(e) => setHead(c, e.target.value)} size="small" placeholder={`หัวคอลัมน์ ${c + 1}`}
                    inputProps={{ maxLength: 200, style: { fontWeight: 700 } }} sx={{ minWidth: 140 }} />
                  {head.length > 1 && <IconButton size="small" onClick={() => delCol(c)} aria-label="ลบคอลัมน์"><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>}
                </Stack>
              </td>
            ))}
            <td><Button size="small" onClick={addCol} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>+ คอลัมน์</Button></td>
          </tr>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>
                  <TextField value={cell} onChange={(e) => setCell(r, c, e.target.value)} size="small" fullWidth multiline inputProps={{ maxLength: 500 }} sx={{ minWidth: 140 }} />
                </td>
              ))}
              <td><IconButton size="small" onClick={() => delRow(r)} aria-label="ลบแถว"><DeleteOutline sx={{ fontSize: 16 }} /></IconButton></td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Button size="small" startIcon={<Add />} onClick={addRow} sx={{ mt: 0.5, textTransform: "none", fontWeight: 700, color: UI.accent }}>เพิ่มแถว</Button>
    </Box>
  );
}
