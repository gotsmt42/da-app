/**
 * ReportKit — ชิ้นส่วนหน้ารายงานแบบเดียวกับหน้าแรก (สไตล์ Agoda)
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ธีม ux ui ฟอร์มต่างๆให้เข้ากัน แบบ Agoda · แบบที่ทำหน้าแรก หน้าอื่นๆ ให้สมบูรณ์")
 *    • หัวข้อส่วนตัวใหญ่หนา วางบนพื้นหน้าตรงๆ (ไม่มีกรอบครอบหัวข้อ) + คำอธิบายสีเทาบรรทัดเดียว
 *    • เนื้อหาในการ์ดขาว มุมโค้ง ขอบเทาอ่อน ไม่มีเงา
 *    • ตัวสลับแบบแคปซูล (Segmented) — ช่องที่เลือก = พื้นขาว ตัวน้ำเงิน (เหมือน "ในประเทศ/ต่างประเทศ")
 *    • รายการจัดอันดับ (RankRow) — เลขลำดับ · รูป · ชื่อ/รายละเอียด · ค่าด้านขวา
 */
import { createContext, useContext, useState } from "react";
import { Avatar, Box, ButtonBase, Collapse, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRightRounded, TuneRounded, ExpandMoreRounded } from "@mui/icons-material";
import { INK, MUTED, FAINT, LINE, ACCENT } from "@/shared/ui/PageKit";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

export const RADIUS = "16px";
export const R_CARD = { bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: RADIUS, overflow: "hidden" };

export const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

/** หัวข้อส่วน + เนื้อหา */
export function ReportSection({ title, hint, right, children, sx }) {
  return (
    <Box sx={{ mb: { xs: 2.5, sm: 3 }, ...sx }}>
      {/* 🔁 (4 พ.ย. 2569 ผู้ใช้: "แก้ไขให้ไม่เพี้ยนจอมือถือ") มือถือ: หัวข้อเต็มบรรทัด ตัวสลับลงบรรทัดใหม่ (เลื่อนแนวนอนได้)
          เดิมวางคู่กันบรรทัดเดียว ตัวสลับ 4 ช่องดันหัวข้อจนเหลือคำละบรรทัด */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "flex-end" }, gap: { xs: 1, sm: 1.5 }, mb: 1.25, px: { xs: 0.5, sm: 0 } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.18rem", sm: "1.3rem" }, color: INK, lineHeight: 1.3 }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.25 }}>{hint}</Typography>}
        </Box>
        {right && (
          <Box sx={{ minWidth: 0, maxWidth: "100%", overflowX: "auto", flexShrink: 0, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {right}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

/** ตัวสลับแบบแคปซูล */
export function Segmented({ value, onChange, options, sx }) {
  return (
    <Box sx={{ display: "inline-flex", p: 0.5, borderRadius: 99, bgcolor: "#f1f5f9", border: `1px solid ${LINE}`, flexShrink: 0, ...sx }}>
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <ButtonBase key={k} onClick={() => onChange(k)}
            sx={{ flexShrink: 0, px: { xs: 1.5, sm: 2 }, height: 32, borderRadius: 99, fontFamily: "inherit", fontSize: "0.86rem", whiteSpace: "nowrap",
              fontWeight: on ? 800 : 600, color: on ? ACCENT : MUTED, bgcolor: on ? "#fff" : "transparent",
              boxShadow: on ? "0 1px 3px rgba(15,23,42,.12)" : "none", transition: "all .15s" }}>
            {label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export const PersonAvatar = ({ name, avatar, size = 36 }) => (
  <Avatar src={hasValidAvatar(avatar) ? avatar : undefined}
    sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0 }}>
    {personInitial(name)}
  </Avatar>
);

/** แถวจัดอันดับ — rank (ตัวเลข) · leading (รูป/ไอคอน) · title/sub · value/valueSub ด้านขวา */
export function RankRow({ rank, leading, title, sub, value, valueSub, onClick, active, valueTone }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} component="div"
      sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 1.75 }, width: "100%", px: { xs: 1.5, sm: 2 }, py: 1.4, textAlign: "left",
        fontFamily: "inherit", borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 },
        bgcolor: active ? alpha(ACCENT, 0.06) : "#fff", "&:hover": onClick ? { bgcolor: alpha(ACCENT, 0.04) } : {} }}>
      {rank !== undefined && (
        <Typography sx={{ width: 22, flexShrink: 0, textAlign: "center", fontSize: "1.05rem", fontWeight: 800, fontStyle: "italic", color: rank <= 3 ? INK : FAINT }}>{rank}</Typography>
      )}
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.98rem", fontWeight: 800, color: INK }}>{title}</Typography>
        {sub && <Typography noWrap component="div" sx={{ fontSize: "0.8rem", color: MUTED }}>{sub}</Typography>}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontSize: "0.98rem", fontWeight: 800, color: valueTone || INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</Typography>
        {valueSub && <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap" }}>{valueSub}</Typography>}
      </Box>
      {onClick && <ChevronRightRounded sx={{ color: "#cbd5e1", fontSize: 20, flexShrink: 0, display: { xs: "none", sm: "block" } }} />}
    </ButtonBase>
  );
}

/** แถวรวมท้ายรายการ */
export function TotalRow({ label, value, valueSub }) {
  return (
    <Stack direction="row" alignItems="center" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.4, bgcolor: "#f8fafc", borderTop: `1px solid ${LINE}` }}>
      <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.92rem", color: INK }}>{label}</Typography>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        {valueSub && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{valueSub}</Typography>}
      </Box>
    </Stack>
  );
}

/** กล่องตัวเลขเล็ก (แถวสถิติใต้ยอดรวม) */
// มือถือ: กล่องสถิติในหัวสรุป (TotalHero) เป็นชิปแถวเดียว เลื่อนซ้าย-ขวาได้
const HeroCompact = createContext(false);

export function Stat({ label, value, tone, onClick, active }) {
  const compact = useContext(HeroCompact);
  if (compact) {
    return (
      <ButtonBase onClick={onClick} disabled={!onClick} component="div"
        sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.6, height: 34, px: 1.25, borderRadius: 99, fontFamily: "inherit",
          border: `1.5px solid ${active ? ACCENT : LINE}`, bgcolor: active ? alpha(ACCENT, 0.08) : "#fff", whiteSpace: "nowrap" }}>
        <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 700, color: active ? ACCENT : MUTED }}>{label}</Typography>
        <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 800, color: active ? ACCENT : tone || INK, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        {active && <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 800, color: ACCENT }}>✓</Typography>}
      </ButtonBase>
    );
  }
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} component="div"
      // 🔁 (12 พ.ย. 2569 ผู้ใช้: "ข้อมูลให้กระชับ") กล่องเตี้ยลง · กล่องที่กดกรองได้มีลูกศรเล็ก · กล่องที่เลือกอยู่ขอบน้ำเงินชัด
      sx={{ display: "block", textAlign: "left", px: 1.25, py: 1, borderRadius: "12px", border: `1.5px solid ${active ? ACCENT : LINE}`,
        bgcolor: active ? alpha(ACCENT, 0.06) : "#fff", fontFamily: "inherit", minWidth: 0, position: "relative" }}>
      <Typography noWrap sx={{ fontSize: "0.76rem", color: active ? ACCENT : MUTED, fontWeight: 700, pr: onClick ? 1.5 : 0 }}>{label}</Typography>
      <Typography noWrap sx={{ fontSize: "1.05rem", fontWeight: 800, color: tone || INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.35 }}>{value}</Typography>
      {onClick && <Box component="span" sx={{ position: "absolute", top: 8, right: 10, fontSize: "0.8rem", color: active ? ACCENT : "#cbd5e1", fontWeight: 800 }}>{active ? "✓" : "›"}</Box>}
    </ButtonBase>
  );
}

/** ยอดรวมใหญ่บนสุด + แถวสถิติ */
export function TotalHero({ label, value, sub, note, stats }) {
  /**
   * 🔁 (12 พ.ย. 2569 ผู้ใช้: "ส่วนหัวมันยาวเกินไป กว่าจะเลื่อนมาเจอข้อมูล")
   *    มือถือ: ป้าย + ยอดรวมอยู่บรรทัดเดียวกัน · กล่องสถิติเป็นชิปแถวเดียวเลื่อนข้างได้ (กดกรองได้เหมือนเดิม)
   *    — จากเต็มจอเหลือราว 1 ใน 4 รายการขึ้นมาให้เห็นทันที · จอคอมเหมือนเดิม
   */
  const mobile = useMediaQuery("(max-width:600px)");
  if (mobile) {
    return (
      <Box sx={{ ...R_CARD, p: 1.5, mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: ACCENT, lineHeight: 1.35 }}>{label}</Typography>
            {sub && <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.4 }}>{sub}</Typography>}
          </Box>
          <Typography sx={{ flexShrink: 0, fontSize: "1.45rem", fontWeight: 900, color: INK, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        </Stack>
        {stats && (
          <HeroCompact.Provider value>
            <Box sx={{ display: "flex", gap: 0.75, mt: 1.25, mx: -1.5, px: 1.5, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {stats}
            </Box>
          </HeroCompact.Provider>
        )}
        {note && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1.1, pt: 1, borderTop: `1px dashed ${LINE}` }}>{note}</Typography>}
      </Box>
    );
  }
  return (
    <Box sx={{ ...R_CARD, p: { xs: 2, sm: 2.5 }, mb: { xs: 2.5, sm: 3 } }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: ACCENT }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: "2rem", sm: "2.4rem" }, fontWeight: 900, color: INK, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>{sub}</Typography>}
      {stats && (
        <Box sx={{ display: "grid", gap: 1, mt: 2, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: `repeat(${Math.min(stats.length, 6)}, minmax(0,1fr))` } }}>
          {stats}
        </Box>
      )}
      {note && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.5, pt: 1.25, borderTop: `1px dashed ${LINE}` }}>{note}</Typography>}
    </Box>
  );
}

/** แถบกรอง (การ์ดขาว) */
export function FilterCard({ children, footer }) {
  /**
   * 🔁 (12 พ.ย. 2569 ผู้ใช้: "การค้นหาต่างๆ ให้ทำไปไว้เป็นตัวกรอง แบบนี้ดูข้อมูลยาก")
   *    มือถือ: ช่องเลือก/ค้นหาทั้งหมดพับไว้ใต้ปุ่ม "ตัวกรอง" — เห็นแค่สรุปตัวกรองบรรทัดเดียว ข้อมูลรายงานขึ้นมาเร็ว
   *    จอคอม: แสดงเต็มเหมือนเดิม
   */
  const mobile = useMediaQuery("(max-width:600px)");
  const [open, setOpen] = useState(false);
  if (mobile) {
    return (
      <Box sx={{ ...R_CARD, mb: 2, overflow: "visible" }}>
        <ButtonBase onClick={() => setOpen((v) => !v)} aria-expanded={open}
          sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25, textAlign: "left", fontFamily: "inherit", borderRadius: "inherit" }}>
          <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: alpha(ACCENT, 0.08), color: ACCENT, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <TuneRounded sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>ตัวกรอง</Typography>
            {footer && <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED }}>{footer}</Typography>}
          </Box>
          <ExpandMoreRounded sx={{ color: MUTED, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
        </ButtonBase>
        <Collapse in={open}>
          <Stack spacing={1.25} sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>{children}</Stack>
        </Collapse>
      </Box>
    );
  }
  return (
    <Box sx={{ ...R_CARD, p: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 }, overflow: "visible" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} useFlexGap flexWrap="wrap">
        {children}
      </Stack>
      {footer && <Typography sx={{ mt: 1.25, fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>{footer}</Typography>}
    </Box>
  );
}

/** แถบแนวนอนในรายการช่วงเวลา */
export function BarRow({ label, value, sub, pct, color = ACCENT }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.2, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
      <Typography sx={{ width: { xs: 74, sm: 110 }, flexShrink: 0, fontSize: "0.9rem", fontWeight: 800, color: INK }}>{label}</Typography>
      <Box sx={{ flex: 1, minWidth: 0, height: 10, borderRadius: 5, bgcolor: "#f1f5f9", overflow: "hidden" }}>
        <Box sx={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", bgcolor: color, borderRadius: 5 }} />
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0, minWidth: { xs: 96, sm: 150 } }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{sub}</Typography>}
      </Box>
    </Stack>
  );
}
