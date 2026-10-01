import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * ตัวเลือกมุมมองแบบ "การ์ดตัวเลข" — ใช้ร่วมกันหน้าภาพรวมงาน/การดำเนินงาน (งานสัญญา / เลยกำหนด / หมดอายุ / ทั่วไป / โปรเจค / …)
 *
 * 🐛 ทำไมเปลี่ยนจากแท็บ: แท็บเดิมเป็นปุ่มเทาเล็กๆ บนพื้นเทา กลืนไปกับพื้นหลัง — ผู้ใช้ไม่รู้ว่ากดสลับมุมมองได้
 *    และไม่เห็นว่ามีงานเลยกำหนด/หมดอายุรออยู่กี่ใบ
 * ✅ ตอนนี้แต่ละมุมมองเป็นการ์ดที่มีไอคอนสี ชื่อ และตัวเลขตัวใหญ่ — ดูออกทันทีว่า "กดได้" และเป็นสรุปภาพรวม
 *    ในตัว การ์ดที่เลือกอยู่มีกรอบสี + แถบบน ส่วนกลุ่มที่ต้องจัดการ (เลยกำหนด/หมดอายุ) ตัวเลขเป็นสีแดงเมื่อมีงาน
 * ✅ มือถือ: ตาราง 2 คอลัมน์เห็นครบทุกมุมมองในจอเดียว (ไม่ซ่อนไว้ในเมนู/ไม่ต้องปัด)
 *
 * @param groups   [{ title, items: [{ value, label, shortLabel?, count, unit, icon, color, alert? }] }]
 * @param value    มุมมองที่เลือกอยู่
 * @param onChange (value) => void
 */
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";

function Tile({ item, selected, onClick, isMobile }) {
  const { color } = item;
  const hot = item.alert && item.count > 0;
  if (isMobile) {
    return (
      <ButtonBase
        onClick={onClick} aria-pressed={selected} title={item.label}
        aria-label={`${item.label} ${item.count} ${item.unit}`}
        sx={{
          display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.85, borderRadius: 2, minWidth: 0, justifyContent: "flex-start",
          border: "1px solid", borderColor: selected ? color : BORDER,
          bgcolor: selected ? alpha(color, 0.07) : "#fff",
          boxShadow: selected ? `inset 3px 0 0 ${color}` : "none",
        }}
      >
        <Box sx={{ width: 24, height: 24, borderRadius: 1.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(color, 0.12), color, "& svg": { fontSize: 14 } }}>
          {item.icon}
        </Box>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, textAlign: "left", fontWeight: selected ? 800 : 600, fontSize: "0.78rem", color: "#334155" }}>
          {item.shortLabel || item.label}
        </Typography>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: "0.95rem", fontVariantNumeric: "tabular-nums", color: hot ? "#dc2626" : selected ? color : "#0f172a" }}>
          {item.count.toLocaleString()}
        </Typography>
      </ButtonBase>
    );
  }
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${item.label} ${item.count} ${item.unit}`}
      title={item.label}
      sx={{
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left",
        gap: isMobile ? 0.5 : 0.75, p: isMobile ? 1.1 : 1.4, borderRadius: 2.5, minWidth: 0,
        border: "1px solid", borderColor: selected ? color : BORDER,
        bgcolor: selected ? alpha(color, 0.06) : "#fff",
        boxShadow: selected ? `0 0 0 1px ${color}, 0 4px 14px ${alpha(color, 0.16)}` : "0 1px 2px rgba(15,23,42,.04)",
        transition: "border-color .15s, background-color .15s, box-shadow .15s, transform .15s",
        "&:hover": { borderColor: color, transform: "translateY(-1px)", boxShadow: `0 4px 14px ${alpha(color, 0.14)}` },
        "&:focus-visible": { outline: `2px solid ${color}`, outlineOffset: 2 },
        // แถบสีด้านบนของการ์ดที่เลือก — บอกตำแหน่งปัจจุบันชัดเจนแม้กวาดตาเร็วๆ
        "&::before": selected ? { content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: color } : {},
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        <Box sx={{
          width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: 2, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: alpha(color, 0.12), color, "& svg": { fontSize: isMobile ? 15 : 17 },
        }}>
          {item.icon}
        </Box>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: isMobile ? "0.78rem" : "0.82rem", color: selected ? "text.primary" : "#334155" }}>
          {item.shortLabel || item.label}
        </Typography>
        {hot && (
          <Box component="span" sx={{
            width: 8, height: 8, borderRadius: "50%", bgcolor: "#dc2626", flexShrink: 0,
            animation: "coTilePulse 1.6s ease-in-out infinite",
            "@keyframes coTilePulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
          }} />
        )}
      </Stack>
      <Stack direction="row" alignItems="baseline" gap={0.5}>
        <Typography component="span" sx={{
          fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: "tabular-nums",
          fontSize: isMobile ? "1.25rem" : "1.6rem",
          color: hot ? "#dc2626" : selected ? color : "#0f172a",
        }}>
          {item.count.toLocaleString()}
        </Typography>
        <Typography component="span" sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 600 }}>{item.unit}</Typography>
        {item.sub && (
          <Typography component="span" noWrap sx={{ ml: "auto", fontSize: "0.68rem", fontWeight: 700, color: hot ? "#dc2626" : TEXT_SUB, bgcolor: hot ? alpha("#dc2626", 0.08) : "#f1f5f9", px: 0.75, py: 0.15, borderRadius: 1 }}>
            {item.sub}
          </Typography>
        )}
      </Stack>
    </ButtonBase>
  );
}

export default function ViewTiles({ groups, value, onChange, isMobile = false }) {
  if (isMobile) {
    return (
      <Box sx={{ mb: 2 }}>
        {groups.some((g) => g.title) && (
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: TEXT_SUB, mb: 0.75, px: 0.25 }}>เลือกมุมมอง</Typography>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
          {groups.flatMap((g) => g.items).map((item) => (
            <Tile key={item.value} item={item} selected={item.value === value} onClick={() => onChange(item.value)} isMobile />
          ))}
        </Box>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
      {groups.map((g) => (
        <Box key={g.title} sx={{ flex: `${g.items.length} 1 ${g.items.length * 150}px`, minWidth: 0 }}>
          {g.title && (
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: ".04em", mb: 0.75, px: 0.25 }}>
              {g.title}
            </Typography>
          )}
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: `repeat(${g.items.length}, minmax(0, 1fr))` }}>
            {g.items.map((item) => (
              <Tile key={item.value} item={item} selected={item.value === value} onClick={() => onChange(item.value)} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
