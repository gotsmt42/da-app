/**
 * QueueKit — ชิ้นส่วนหน้าตาชุดเดียวของหน้า "คำขอลงงาน" ทั้งสองแท็บ (จากฝ่ายขาย / จากฝ่ายช่าง)
 *
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "สีจืดเกินไป ข้อมูลดูยาก จัดการยาก" + "หน้าจากฝ่ายช่างก็ไม่เหมือนกัน สับสน"
 *    สองแท็บเคยออกแบบคนละแบบ (ฝั่งขาย = กระดาน 2 คอลัมน์ · ฝั่งช่าง = การ์ดสีส้มทั้งใบ) → ใช้ชุดเดียวกัน:
 *      แถบเครื่องมือ (ค้นหา · ตัวกรองด่วน · มุมมอง · รีเฟรช)
 *      → หมวด "ต้องจัดการ" (การ์ดเต็ม มีปุ่มทำงานในตัว)
 *      → หมวดประวัติ (แถวกระชับ พับเก็บได้)
 *    ทุกแถว/การ์ดขึ้นต้นด้วยกล่องวันที่ — สิ่งแรกที่คนจัดคิวต้องรู้คือ "งานนี้เข้าวันไหน"
 */
import { useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { Box, Stack, Typography, IconButton, Tooltip, TextField, ButtonBase, Collapse, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Search, Close, Refresh, ExpandMore, ChevronRight, TaskAlt } from "@mui/icons-material";
import ViewToggle from "@/shared/ui/ViewToggle";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT } from "@/shared/ui/PageKit";

export const AMBER = "#d97706";
export const BLUE = ACCENT;

/** กล่องวันที่ — เดือนบน · วันที่ตัวใหญ่ · ไม่มีวัน = "ยังไม่ลงวัน" สีส้ม */
export function DateBlock({ date, label, tone = "blue", size = 54 }) {
  const c = tone === "amber" ? AMBER : tone === "grey" ? MUTED : BLUE;
  const m = date ? moment(date).locale("th") : null;
  return (
    <Box sx={{
      width: size, flexShrink: 0, alignSelf: "flex-start", borderRadius: 2, overflow: "hidden", textAlign: "center",
      border: `1px solid ${alpha(c, 0.25)}`, bgcolor: "#fff",
    }}>
      <Box sx={{ bgcolor: alpha(c, 0.12), color: c, fontSize: "0.64rem", fontWeight: 800, py: 0.2, lineHeight: 1.5 }}>
        {m ? m.format("MMM") : "ยังไม่"}
      </Box>
      <Box sx={{ py: 0.35, lineHeight: 1.1 }}>
        <Typography sx={{ fontWeight: 900, fontSize: m ? "1.2rem" : "0.74rem", color: m ? INK : c, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
          {m ? m.format("D") : (label || "ลงวัน")}
        </Typography>
        {m && <Typography sx={{ fontSize: "0.6rem", color: MUTED, fontWeight: 700 }}>{m.format("ddd")}</Typography>}
      </Box>
    </Box>
  );
}

/** ป้ายพื้นอ่อน + จุด (สถานะ/ประเภท) */
export function SoftPill({ color = MUTED, children, icon }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.5, height: 22, px: 0.9, borderRadius: 99, whiteSpace: "nowrap",
      bgcolor: alpha(color, 0.1), color, fontSize: "0.7rem", fontWeight: 800, flexShrink: 0,
      "& svg": { fontSize: 13 },
    }}>
      {icon || <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color }} />}
      {children}
    </Box>
  );
}

/**
 * แถบเครื่องมือ — ค้นหา · ตัวกรองด่วน (ชิปมีตัวเลข) · จำนวน · มุมมอง · รีเฟรช
 * filters: [{ key, label, count, color }]
 */
export function QueueToolbar({ search, onSearch, placeholder, filters = [], filter, onFilter, view, onView, onRefresh, loading, note }) {
  return (
    <Box sx={{ mb: 2, p: 1, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <TextField
          size="small" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ fontSize: 19, color: MUTED, mr: 0.75 }} />,
            endAdornment: search ? <IconButton size="small" aria-label="ล้างคำค้น" onClick={() => onSearch("")} sx={{ p: 0.25 }}><Close sx={{ fontSize: 16 }} /></IconButton> : null,
          }}
          sx={{
            flex: { md: "0 1 360px" },
            "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: SURFACE, height: 40, fontSize: "0.86rem", "& fieldset": { borderColor: "transparent" }, "&:hover fieldset": { borderColor: LINE }, "&.Mui-focused": { bgcolor: "#fff" } },
          }}
        />
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flex: 1, minWidth: 0, flexWrap: "wrap", alignItems: "center" }}>
          {filters.map((f) => {
            const on = f.key === filter;
            const c = f.color || INK_2;
            return (
              <ButtonBase key={f.key} onClick={() => onFilter(f.key)} sx={{
                height: 32, px: 1.25, borderRadius: 99, gap: 0.6, fontFamily: "inherit",
                border: "1px solid", borderColor: on ? c : LINE, bgcolor: on ? alpha(c, 0.08) : "#fff",
                color: on ? c : INK_2, fontSize: "0.78rem", fontWeight: on ? 800 : 600,
                "&:hover": { borderColor: c },
              }}>
                {f.label}
                <Box component="span" sx={{
                  minWidth: 20, height: 18, px: 0.5, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.68rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
                  bgcolor: f.count ? alpha(c, on ? 0.18 : 0.12) : "#f1f5f9", color: f.count ? c : FAINT,
                }}>{f.count}</Box>
              </ButtonBase>
            );
          })}
          {note && <Typography sx={{ fontSize: "0.72rem", color: FAINT, ml: 0.5 }}>{note}</Typography>}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, alignSelf: { xs: "flex-end", md: "center" } }}>
          {onView && <ViewToggle value={view} onChange={onView} />}
          <Tooltip title="โหลดข้อมูลใหม่">
            <IconButton size="small" onClick={onRefresh} aria-label="โหลดข้อมูลใหม่"
              sx={{ color: MUTED, border: `1px solid ${LINE}`, borderRadius: 2, width: 36, height: 36 }}>
              <Refresh sx={{ fontSize: 19, ...(loading ? { animation: "qkSpin 1s linear infinite", "@keyframes qkSpin": { to: { transform: "rotate(360deg)" } } } : {}) }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

/** หัวหมวด — จุดสี · ชื่อ · คำอธิบาย · จำนวน */
export function SectionHead({ color, title, hint, count, right }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25, px: 0.25 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 0 4px ${alpha(color, 0.15)}`, flexShrink: 0 }} />
      <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK }}>{title}</Typography>
      <Box component="span" sx={{ px: 0.9, height: 22, borderRadius: 99, display: "inline-flex", alignItems: "center", bgcolor: alpha(color, 0.12), color, fontWeight: 900, fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" }}>{count}</Box>
      {hint && <Typography noWrap sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.76rem", color: MUTED, minWidth: 0 }}>{hint}</Typography>}
      <Box sx={{ flex: 1 }} />
      {right}
    </Stack>
  );
}

/** กล่อง "เคลียร์หมดแล้ว" แถวเดียว — ไม่กินที่เท่าคอลัมน์ว่างทั้งคอลัมน์ */
export function AllClear({ text }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5, px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#16a34a", 0.06), border: `1px solid ${alpha("#16a34a", 0.2)}` }}>
      <TaskAlt sx={{ color: "#16a34a", fontSize: 22 }} />
      <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#166534" }}>{text}</Typography>
    </Stack>
  );
}

/**
 * การ์ดคำขอที่ต้องจัดการ — กล่องวันที่ · เนื้อหา · ปุ่มทำงาน (ขวาบนจอใหญ่ / ล่างบนมือถือ)
 * แถบซ้ายสีส้ม = รอคุณตัดสินใจ
 */
export function ActionCard({ date, dateTone, dateLabel, top, title, sub, detail, people, actions, extra, onOpen, urgent }) {
  const edge = urgent ? "#dc2626" : AMBER;
  return (
    <Box sx={{
      position: "relative", bgcolor: "#fff", borderRadius: 3, border: `1px solid ${LINE}`, overflow: "hidden",
      boxShadow: "0 1px 2px rgba(15,23,42,.05)", transition: "box-shadow .15s, border-color .15s",
      "&:hover": { borderColor: alpha(edge, 0.45), boxShadow: `0 6px 18px -10px ${alpha(edge, 0.5)}` },
    }}>
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: edge }} />
      <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.25, md: 2 }} sx={{ pl: 2.25, pr: 1.75, py: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0, cursor: onOpen ? "pointer" : "default" }} onClick={onOpen}>
          <DateBlock date={date} tone={dateTone} label={dateLabel} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {top && <Stack direction="row" spacing={0.6} useFlexGap alignItems="center" sx={{ flexWrap: "wrap", mb: 0.5 }}>{top}</Stack>}
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK, lineHeight: 1.35 }}>{title}</Typography>
            {sub && <Typography sx={{ fontSize: "0.8rem", color: INK_2, fontWeight: 600, mt: 0.15 }}>{sub}</Typography>}
            {detail && (
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {detail}
              </Typography>
            )}
            {people && <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>{people}</Stack>}
          </Box>
        </Stack>
        {(actions || extra) && (
          <Stack spacing={1} sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0, justifyContent: "center" }}>
            {extra}
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

/** คู่ "ป้ายเล็ก + ค่า" สำหรับแถวคน (ผู้แจ้ง / ผู้รับผิดชอบ) */
export function PeopleField({ label, children }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, whiteSpace: "nowrap" }}>{label}</Typography>
      <Box sx={{ minWidth: 0, display: "flex" }}>{children}</Box>
    </Stack>
  );
}

/** แถวกระชับในหมวดประวัติ */
export function QueueRow({ date, dateTone, title, sub, right, onOpen, edge }) {
  return (
    <ButtonBase onClick={onOpen} sx={{
      width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, fontFamily: "inherit",
      borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, borderLeft: `3px solid ${edge || "transparent"}`,
      "&:hover": { bgcolor: SURFACE },
    }}>
      <DateBlock date={date} tone={dateTone} size={46} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.88rem", color: INK }}>{title}</Typography>
        {sub && <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{sub}</Typography>}
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, display: { xs: "none", sm: "flex" } }}>{right}</Stack>
      <ChevronRight sx={{ color: FAINT, fontSize: 20, flexShrink: 0 }} />
    </ButtonBase>
  );
}

/** กลุ่มแถวในกล่องขาว พร้อมหัวกลุ่ม · แสดงทีละ limit แถว · พับได้ */
export function RowGroup({ title, count, color = MUTED, children, defaultOpen = true, limit = 6 }) {
  const [open, setOpen] = useState(defaultOpen);
  const [all, setAll] = useState(false);
  const items = Array.isArray(children) ? children : [children];
  const shown = all ? items : items.slice(0, limit);
  return (
    <Box sx={{ mb: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} sx={{ width: "100%", justifyContent: "flex-start", gap: 1, px: 1.5, py: 1, bgcolor: SURFACE, fontFamily: "inherit", borderBottom: open ? `1px solid ${LINE}` : 0 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color }} />
        <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: INK_2 }}>{title}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", color: MUTED }}>{count}</Typography>
        <Box sx={{ flex: 1 }} />
        <ExpandMore sx={{ color: MUTED, fontSize: 20, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </ButtonBase>
      <Collapse in={open}>
        <Box>{shown}</Box>
        {items.length > limit && (
          <Button fullWidth onClick={() => setAll((v) => !v)} sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, borderTop: `1px solid ${LINE}`, borderRadius: 0, py: 0.75 }}>
            {all ? "แสดงน้อยลง" : `ดูทั้งหมด (${items.length})`}
          </Button>
        )}
      </Collapse>
    </Box>
  );
}
