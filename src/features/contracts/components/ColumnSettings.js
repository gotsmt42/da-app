import { useRef, useState } from "react";
import { Box, Button, Checkbox, Divider, IconButton, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ArrowDownward, ArrowUpward, DragIndicator, Lock, RestartAlt, ViewColumn } from "@mui/icons-material";
import { OVERVIEW_COLUMNS } from "@/features/contracts/hooks/useColumnLayout";

/**
 * เมนู "คอลัมน์" — จัดลำดับ / ซ่อน-แสดงคอลัมน์ของตารางภาพรวมงาน
 *
 * ✅ ทางเลือกคู่กับการลากหัวตาราง: มือถือ/แท็บเล็ตลากหัวตารางไม่ได้ (เบราว์เซอร์ไม่รองรับ drag & drop
 *    ด้วยนิ้ว) จึงมีปุ่มลูกศรขึ้น-ลงให้ทุกแถว ส่วนจอคอมลากแถวในรายการนี้สลับได้ด้วย
 * ⚠️ บนลงล่างในรายการ = ซ้ายไปขวาในตาราง
 *
 * @param layout ผลจาก useColumnLayout
 * @param unavailable Set ของคีย์ที่แท็บนี้ไม่มี (เช่น ระยะเวลาสัญญาในแท็บงานทั่วไป) — ยังจัดลำดับได้ แค่บอกไว้
 */
const ACCENT = "#dc2626";
const TEXT_SUB = "#64748b";
const LABEL = Object.fromEntries(OVERVIEW_COLUMNS.map((c) => [c.key, c]));

export default function ColumnSettings({ layout, unavailable = new Set(), compact = false }) {
  const [anchor, setAnchor] = useState(null);
  const [dragKey, setDragKey] = useState(null);
  const [over, setOver] = useState(null);
  const dragRef = useRef(null);
  const visibleCount = layout.order.length - layout.hidden.length;

  return (
    <>
      <Tooltip title="จัดลำดับ / ซ่อน-แสดงคอลัมน์" describeChild>
        <Button
          size="small" onClick={(e) => setAnchor(e.currentTarget)}
          startIcon={<ViewColumn sx={{ fontSize: 18 }} />}
          sx={{
            textTransform: "none", fontWeight: 700, borderRadius: 2, flexShrink: 0,
            color: layout.isCustomized ? ACCENT : "text.secondary",
            border: "1px solid", borderColor: layout.isCustomized ? alpha(ACCENT, 0.45) : "#e2e8f0",
            bgcolor: layout.isCustomized ? alpha(ACCENT, 0.05) : "background.paper", px: 1.25,
            "&:hover": { bgcolor: alpha(ACCENT, 0.06), borderColor: alpha(ACCENT, 0.45) },
          }}
        >
          {compact ? "คอลัมน์" : `คอลัมน์ (${visibleCount}/${layout.order.length})`}
        </Button>
      </Tooltip>
      <Popover
        open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 320, maxWidth: "calc(100vw - 24px)", borderRadius: 3, mt: 0.75 } } }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>คอลัมน์ในตาราง</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>
            ติ๊กเพื่อแสดง · ลากหรือกดลูกศรเพื่อสลับตำแหน่ง (บนสุด = ซ้ายสุด)
          </Typography>
        </Box>
        <Divider />
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0.75, maxHeight: "min(60vh, 520px)", overflowY: "auto" }}>
          {layout.order.map((key, i) => {
            const meta = LABEL[key];
            const hidden = layout.hidden.includes(key);
            const na = unavailable.has(key);
            const isOver = over?.key === key && dragKey && dragKey !== key;
            return (
              <Box
                component="li" key={key}
                draggable
                onDragStart={(e) => { dragRef.current = key; setDragKey(key); try { e.dataTransfer.setData("text/plain", key); e.dataTransfer.effectAllowed = "move"; } catch { /* */ } }}
                onDragOver={(e) => {
                  if (!dragRef.current) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const side = e.clientY < r.top + r.height / 2 ? "left" : "right";
                  if (over?.key !== key || over?.side !== side) setOver({ key, side });
                }}
                onDrop={(e) => { e.preventDefault(); if (over) layout.moveColumn(dragRef.current, over.key, over.side); dragRef.current = null; setDragKey(null); setOver(null); }}
                onDragEnd={() => { dragRef.current = null; setDragKey(null); setOver(null); }}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5, borderRadius: 2, pl: 0.25, pr: 0.5, py: 0.25,
                  opacity: dragKey === key ? 0.45 : 1,
                  boxShadow: isOver ? `inset 0 ${over.side === "left" ? 2 : -2}px 0 ${ACCENT}` : "none",
                  "&:hover": { bgcolor: "#f8fafc" },
                  "&:hover .co-grip": { color: TEXT_SUB },
                }}
              >
                <DragIndicator className="co-grip" sx={{ fontSize: 18, color: "#cbd5e1", cursor: "grab", flexShrink: 0 }} />
                <Checkbox
                  size="small" checked={!hidden} disabled={meta.locked}
                  onChange={() => layout.toggleHidden(key)}
                  sx={{ p: 0.5, "&.Mui-checked": { color: ACCENT } }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.85rem", fontWeight: 600, color: hidden ? "text.disabled" : "text.primary" }}>
                    {meta.label}
                    {meta.locked && <Lock sx={{ fontSize: 12, ml: 0.5, color: "text.disabled", verticalAlign: "-1px" }} />}
                  </Typography>
                  {na && <Typography sx={{ fontSize: "0.68rem", color: "text.disabled" }}>ไม่มีในแท็บนี้</Typography>}
                </Box>
                <IconButton size="small" disabled={i === 0} onClick={() => layout.moveBy(key, -1)} aria-label={`เลื่อน ${meta.label} ไปทางซ้าย`}>
                  <ArrowUpward sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" disabled={i === layout.order.length - 1} onClick={() => layout.moveBy(key, 1)} aria-label={`เลื่อน ${meta.label} ไปทางขวา`}>
                  <ArrowDownward sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1 }}>
          <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>จำไว้ในเครื่องนี้อัตโนมัติ</Typography>
          <Button
            size="small" startIcon={<RestartAlt sx={{ fontSize: 17 }} />} disabled={!layout.isCustomized}
            onClick={layout.reset}
            sx={{ textTransform: "none", fontWeight: 700, color: ACCENT }}
          >
            คืนค่าเริ่มต้น
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
