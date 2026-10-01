import { useMemo, useState } from "react";
import { Avatar, Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ExpandLess, ExpandMore, PersonOff, Groups } from "@mui/icons-material";
import { hasValidAvatar } from "@/shared/utils/user";
import { personColor, personInitial } from "@/shared/utils/personAvatar";

/**
 * แผงสรุป "ผู้รับผิดชอบแต่ละคนมีกี่งาน" บนหน้าภาพรวมงาน
 *
 * ✅ ทำไมต้องมี: ตารางภาพรวมงานยาวหลายหน้าและกว้างหลายคอลัมน์ — จะรู้ว่าใครถืองานกี่ชิ้นต้องไล่นับเอง
 *    แผงนี้ตอบได้ในแวบเดียว และกดชื่อเพื่อกรองตารางเหลือเฉพาะงานของคนนั้น (ตารางสั้นลงทันที)
 * ⚠️ ตัวเลขนับจาก "แท็บ + ตัวกรองอื่นทั้งหมด ยกเว้นตัวกรองผู้รับผิดชอบเอง" — เลือกคนไหนอยู่ก็ยังเห็น
 *    ตัวเลขของทุกคนครบ (ไม่งั้นพอกดคนหนึ่ง คนอื่นจะกลายเป็น 0 หมด) และเลขบนการ์ด = จำนวนแถวที่จะเห็นจริง
 *
 * @param rows     แถว (สัญญา/งาน) หลังกรองทุกอย่างยกเว้นผู้รับผิดชอบ
 * @param unit     "สัญญา" หรือ "งาน" ตามแท็บที่เปิด
 * @param value    ค่าตัวกรองผู้รับผิดชอบปัจจุบัน ("all" | "unassigned" | ชื่อ)
 * @param onChange เปลี่ยนตัวกรอง
 * @param employees รายชื่อพนักงาน (ใช้รูปโปรไฟล์)
 * @param isOverdue (row) => boolean — แถวที่เลยกำหนดรอบ (นับแยกเป็นป้ายสีแดง)
 * @param title / hint  หัวข้อแผง (ค่าเริ่มต้น = งานตามผู้รับผิดชอบ) — หน้ารายงานการเบิกใช้ "ใบเบิกตามผู้เบิก"
 * @param amountOf (row) => number — ถ้าส่งมา ท้ายการ์ดโชว์ยอดเงินรวมของคนนั้นแทน "% ของทั้งหมด"
 * @param formatAmount (number) => string
 */

const ACCENT = "#dc2626";
const AMBER = "#d97706";
const BORDER = "#e2e8f0";
const TEXT_SUB = "#64748b";
const colorOf = personColor;
const initialOf = personInitial;

// จอใหญ่โชว์แถวแรกพอ (กันแผงยาวจนดันตารางลงไป) — ที่เหลือกด "ดูทุกคน"
const COLLAPSED_COUNT = 8;

export default function ResponsibleSummary({
  rows, unit = "งาน", value = "all", onChange, employees = [], isOverdue, isMobile = false,
  title = "งานตามผู้รับผิดชอบ", hint = "กดที่ชื่อเพื่อดูเฉพาะงานของคนนั้น · กดซ้ำเพื่อดูทั้งหมด",
  amountOf, formatAmount = (n) => n.toLocaleString(),
}) {
  const [expanded, setExpanded] = useState(false);

  const avatarOf = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => { if (e?.fname && hasValidAvatar(e.imageUrl) && !m.has(e.fname)) m.set(e.fname, e.imageUrl); });
    return m;
  }, [employees]);

  const { people, unassigned, unassignedOverdue, total, max } = useMemo(() => {
    const map = new Map();
    let un = 0, unOver = 0;
    rows.forEach((r) => {
      const over = isOverdue ? isOverdue(r) : false;
      if (!r.responsiblePerson) { un += 1; if (over) unOver += 1; return; }
      const p = map.get(r.responsiblePerson) || { name: r.responsiblePerson, count: 0, overdue: 0, amount: 0 };
      p.count += 1;
      if (amountOf) p.amount += Number(amountOf(r)) || 0;
      if (over) p.overdue += 1;
      map.set(r.responsiblePerson, p);
    });
    // ✅ มากไปน้อย — คนที่ถืองานเยอะสุดอยู่หน้าสุด (คำถามที่คนเปิดแผงนี้อยากรู้ก่อน) ชื่อเรียงไทยเมื่อเท่ากัน
    const list = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
    return { people: list, unassigned: un, unassignedOverdue: unOver, total: rows.length, max: Math.max(1, ...list.map((p) => p.count), un) };
  }, [rows, isOverdue, amountOf]);

  // ✅ คนที่ถูกเลือกต้องเห็นเสมอแม้อยู่ในส่วนที่พับไว้
  const hiddenSelected = !expanded && value !== "all" && value !== "unassigned"
    && people.findIndex((p) => p.name === value) >= COLLAPSED_COUNT;
  const visiblePeople = isMobile || expanded ? people : people.slice(0, COLLAPSED_COUNT);
  const extra = isMobile ? 0 : Math.max(0, people.length - COLLAPSED_COUNT);
  const toggle = (name) => onChange(value === name ? "all" : name);

  if (total === 0) return null;

  const card = ({ key, name, count, overdue, amount, selected, onClick, avatar, color, muted }) => (
    <ButtonBase
      key={key}
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        display: "flex", alignItems: "stretch", flexDirection: "column", textAlign: "left",
        borderRadius: 2.5, p: 1.25, gap: 1, minWidth: isMobile ? 168 : 0,
        flex: isMobile ? "0 0 auto" : undefined, scrollSnapAlign: "start",
        border: "1px solid", borderStyle: muted ? "dashed" : "solid",
        borderColor: selected ? color : muted ? alpha(AMBER, 0.45) : BORDER,
        bgcolor: selected ? alpha(color, 0.07) : muted ? alpha(AMBER, 0.04) : "background.paper",
        boxShadow: selected ? `0 0 0 1px ${color}` : "none",
        transition: "border-color .15s, background-color .15s, box-shadow .15s, transform .15s",
        "&:hover": { borderColor: color, bgcolor: alpha(color, 0.05) },
        "&:focus-visible": { outline: `2px solid ${color}`, outlineOffset: 2 },
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
        {muted ? (
          <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(AMBER, 0.14), color: AMBER }}>
            <PersonOff sx={{ fontSize: 19 }} />
          </Avatar>
        ) : (
          <Avatar src={avatar} sx={{ width: 34, height: 34, bgcolor: color, fontSize: "0.95rem", fontWeight: 700 }}>
            {initialOf(name)}
          </Avatar>
        )}
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: "0.88rem", color: muted ? AMBER : "text.primary" }}>
          {name}
        </Typography>
        <Box sx={{ textAlign: "right", lineHeight: 1 }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: "1.35rem", color: selected ? color : "text.primary", fontVariantNumeric: "tabular-nums" }}>
            {count}
          </Typography>
          <Typography component="span" sx={{ ml: 0.4, fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 600 }}>{unit}</Typography>
        </Box>
      </Stack>
      {/* แถบสัดส่วนเทียบกับคนที่ถืองานมากที่สุด — เห็นภาระงานต่างกันแค่ไหนโดยไม่ต้องอ่านตัวเลข */}
      <Box sx={{ height: 5, borderRadius: 3, bgcolor: alpha(color, 0.12), overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.max(6, (count / max) * 100)}%`, bgcolor: color, borderRadius: 3 }} />
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 18 }}>
        {amountOf ? (
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: selected ? color : "#334155", fontVariantNumeric: "tabular-nums" }}>
            {formatAmount(amount || 0)}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>
            {Math.round((count / total) * 100)}% ของทั้งหมด
          </Typography>
        )}
        {overdue > 0 && (
          <Tooltip title={`เลยกำหนดรอบเข้างาน ${overdue} ${unit}`}>
            <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: ACCENT, bgcolor: alpha(ACCENT, 0.08), px: 0.75, py: 0.1, borderRadius: 1 }}>
              เลยกำหนด {overdue}
            </Box>
          </Tooltip>
        )}
      </Stack>
    </ButtonBase>
  );

  return (
    <Box sx={{ mb: 2, border: "1px solid", borderColor: BORDER, borderRadius: 3, bgcolor: "#fbfcfe", p: { xs: 1.25, sm: 1.5 } }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
        <Groups sx={{ fontSize: 20, color: ACCENT }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
            {title}
            <Box component="span" sx={{ ml: 0.75, color: TEXT_SUB, fontWeight: 600, fontSize: "0.8rem" }}>
              {people.length} คน · {total} {unit}
            </Box>
          </Typography>
          {!isMobile && (
            <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>
              {hint}
            </Typography>
          )}
        </Box>
        {value !== "all" && (
          <ButtonBase onClick={() => onChange("all")} sx={{ fontSize: "0.78rem", fontWeight: 700, color: ACCENT, px: 1, py: 0.5, borderRadius: 1.5, "&:hover": { bgcolor: alpha(ACCENT, 0.06) } }}>
            ดูทุกคน
          </ButtonBase>
        )}
      </Stack>

      {/* ✅ มือถือ: แถวเดียวปัดซ้าย-ขวา (ไม่ดันตารางลงไปไกล) · จอใหญ่: ตารางการ์ดเต็มความกว้าง */}
      <Box sx={isMobile
        ? { display: "flex", gap: 1, overflowX: "auto", scrollSnapType: "x mandatory", pb: 0.5, mx: -0.25, px: 0.25, "&::-webkit-scrollbar": { height: 4 } }
        : { display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
      >
        {unassigned > 0 && card({
          key: "__unassigned", name: "ยังไม่มอบหมาย", count: unassigned, overdue: unassignedOverdue,
          selected: value === "unassigned", onClick: () => toggle("unassigned"), color: AMBER, muted: true,
        })}
        {visiblePeople.map((p) => card({
          key: p.name, name: p.name, count: p.count, overdue: p.overdue, amount: p.amount,
          selected: value === p.name, onClick: () => toggle(p.name),
          avatar: avatarOf.get(p.name), color: colorOf(p.name),
        }))}
        {hiddenSelected && (() => {
          const p = people.find((x) => x.name === value);
          return card({ key: `sel-${p.name}`, name: p.name, count: p.count, overdue: p.overdue, amount: p.amount, selected: true, onClick: () => toggle(p.name), avatar: avatarOf.get(p.name), color: colorOf(p.name) });
        })()}
      </Box>

      {extra > 0 && (
          <ButtonBase
            onClick={() => setExpanded((v) => !v)}
            sx={{ mt: 1, width: "100%", py: 0.6, borderRadius: 2, fontSize: "0.8rem", fontWeight: 700, color: TEXT_SUB, gap: 0.5, "&:hover": { bgcolor: alpha("#0f172a", 0.04) } }}
          >
            {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
            {expanded ? "ย่อ" : `ดูทุกคน (+${extra} คน)`}
          </ButtonBase>
      )}
    </Box>
  );
}
