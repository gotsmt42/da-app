/**
 * ReportKit — ชิ้นส่วนหน้ารายงานแบบเดียวกับหน้าแรก (สไตล์ Agoda)
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ธีม ux ui ฟอร์มต่างๆให้เข้ากัน แบบ Agoda · แบบที่ทำหน้าแรก หน้าอื่นๆ ให้สมบูรณ์")
 *    • หัวข้อส่วนตัวใหญ่หนา วางบนพื้นหน้าตรงๆ (ไม่มีกรอบครอบหัวข้อ) + คำอธิบายสีเทาบรรทัดเดียว
 *    • เนื้อหาในการ์ดขาว มุมโค้ง ขอบเทาอ่อน ไม่มีเงา
 *    • ตัวสลับแบบแคปซูล (Segmented) — ช่องที่เลือก = พื้นขาว ตัวน้ำเงิน (เหมือน "ในประเทศ/ต่างประเทศ")
 *    • รายการจัดอันดับ (RankRow) — เลขลำดับ · รูป · ชื่อ/รายละเอียด · ค่าด้านขวา
 */
import { Avatar, Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRightRounded } from "@mui/icons-material";
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
export function Stat({ label, value, tone, onClick, active }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} component="div"
      sx={{ display: "block", textAlign: "left", p: 1.5, borderRadius: "12px", border: `1px solid ${active ? alpha(ACCENT, 0.5) : LINE}`,
        bgcolor: active ? alpha(ACCENT, 0.05) : "#fff", fontFamily: "inherit", minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 700 }}>{label}</Typography>
      <Typography noWrap sx={{ fontSize: "1.15rem", fontWeight: 800, color: tone || INK, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </ButtonBase>
  );
}

/** ยอดรวมใหญ่บนสุด + แถวสถิติ */
export function TotalHero({ label, value, sub, note, stats }) {
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
