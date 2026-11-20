/**
 * WorkValueSummary — กล่องสรุปมูลค่า (หน้าการดำเนินงาน) + แผ่นแจกแจงที่มาของยอด
 *
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "ทำไมยอดเยอะขนาดนี้" → "ควรบอกว่ามูลค่ารวม ไม่ใช่มูลค่าครั้งนี้" →
 *    "หรือแจกแจงให้ละเอียดกว่านี้ ปรับการแสดงผลให้ดูง่าย จัดวางให้สวยงามของสีสันต่างๆ")
 *    กล่องสรุป 3 ช่อง: มูลค่าครั้งนี้ (นับแล้ว) · ใส่เท่ามูลค่างานรวม (ต้องตรวจ · ไม่นับ) · ยังไม่ใส่
 *    + แถบความครบ (กี่งานใส่มูลค่าครั้งนี้แล้ว)
 *    แผ่นแจกแจง: แยกตามที่มาของยอด (แถบสัดส่วน) · กรอง ทั้งหมด/ต้องตรวจ/นับแล้ว · รายการงานกดเปิดไปแก้ได้
 *    สี: ตัวเลขสีเข้ม · น้ำเงิน = นับแล้ว/ปุ่ม · ส้ม = ต้องตรวจ · เทา = ยังไม่ใส่
 *    🔁 (18 พ.ย. 2569 ผู้ใช้: "ทำให้ชัดเจนว่ามาจากคนไหนที่ลงมูลค่า ให้มีรูปของยูสเซอร์ ไม่รก สวยงาม")
 *       แต่ละงานมีรูป + ชื่อผู้ลงมูลค่า + วันที่ลง · แถว "ผู้ลงมูลค่า" (รูป + จำนวนงาน) กดกรองดูเฉพาะที่คนนั้นลง
 *       นับเป็นจำนวนงานที่ลงให้ ไม่รวมเป็นยอดเงินของคน (ไม่ใช่ผลงานรายคน)
 *
 * ข้อมูลมาจาก valueSummary ของ OperationBoard (นับงานละครั้ง · งานหลายช่วงวันนับครั้งเดียว)
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { Box, ButtonBase, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ChevronRightRounded, PersonOutlineRounded, PaymentsRounded, ReportProblemRounded, HourglassEmptyRounded, InsightsRounded,
  TaskAltRounded, GroupsRounded, AccountTreeRounded, InfoRounded,
} from "@mui/icons-material";
import MobileSheet from "@/shared/ui/MobileSheet";
import UserAvatar from "@/shared/ui/UserAvatar";
import { INK, INK_2, MUTED, FAINT, LINE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";

// 🔁 (18 พ.ย. 2569 ผู้ใช้: "สีสันมันดูรก เข้มเกินไป ตาลาย" → "เอาให้มองง่ายๆ สวยงาม สบายตา ชวนดู สีสันยังมีแต่มืออาชีพ
//    ให้เข้าธีมระบบ · ดูยากเกินไปในมือถือ")
//    ธีมระบบ: น้ำเงินหลัก (ACCENT) + พื้นฟ้าอ่อน · ตัวเลขสีเข้ม · สีบอกสถานะอยู่ในไอคอนกลม/ป้ายพื้นอ่อน (ไม่ใช้ตัวอักษรสีเข้มทั้งก้อน)
//    น้ำเงิน = นับแล้ว/ลงแล้ว · ส้มอ่อน = ต้องตรวจ/ยังไม่ลง · เขียวอมฟ้า = เฉลี่ย · เทา = ยังไม่ใส่
//    มือถือ: ตัวอักษรใหญ่ขึ้น ช่องไฟมากขึ้น · ยอดหลักเป็นกล่องเด่นเต็มแถว
const WARN = "#d97706";
const WARN_TEXT = "#b45309";
const WARN_SOFT = "#fffbeb";
const WARN_LINE = "#fde68a";
const TEAL = "#0d9488";
const SLATE = "#64748b";
const TRACK = "#e8edf4";
const NUM = { fontVariantNumeric: "tabular-nums" };
const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

/** ที่มาของยอด (workValueSource) — ลำดับ = ลำดับในแผ่นแจกแจง */
/** label = ชื่อเต็ม (แจกแจงตามที่มา) · short = ป้ายสั้นในแถวงาน */
export const VALUE_SOURCES = [
  { key: "manual", label: "ลงเอง", short: "ลงเอง" },
  { key: "contract", label: "มูลค่าสัญญา ÷ จำนวนครั้ง", short: "สัญญา ÷ ครั้ง" },
  { key: "quotation", label: "ยอดใบเสนอราคาที่ได้งาน", short: "ใบเสนอราคา" },
  { key: "ai", label: "AI อ่านจากไฟล์", short: "AI อ่านไฟล์" },
  { key: "job", label: "มูลค่างานรวม (เติมอัตโนมัติ)", short: "จากมูลค่างานรวม" },
  { key: "workers", label: "ระบบรวมจากรายคน (ข้อมูลเดิม)", short: "รวมจากรายคน" },
  { key: "", label: "ไม่ทราบที่มา (ข้อมูลเดิม)", short: "ไม่ทราบที่มา" },
];
const SOURCE_LABEL = Object.fromEntries(VALUE_SOURCES.map((s) => [s.key, s.label]));
const SOURCE_SHORT = Object.fromEntries(VALUE_SOURCES.map((s) => [s.key, s.short]));
const thaiDate = (d) => (d ? moment(d).add(543, "year").format("D/M/YY") : "");

/** หาพนักงานจากชื่อผู้ลง (workValueBy = "ชื่อ นามสกุล" หรือชื่อเล่น/ชื่อต้น) */
function findEmployee(employees, name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const full = (e) => [e?.fname, e?.lname].filter(Boolean).join(" ").trim();
  return employees.find((e) => full(e) === n)
    || employees.find((e) => e?.fname && (e.fname === n || n.startsWith(`${e.fname} `)))
    || null;
}

/** รูปผู้ลง · ตัวย่อบนพื้นฟ้าอ่อน (ธีมระบบ) · ไม่ทราบผู้ลง = ไอคอนคนสีเทา */
function ByAvatar({ name, src, size = 24 }) {
  if (!name) {
    return (
      <Box sx={{ width: size, height: size, borderRadius: "50%", bgcolor: "#f1f5f9", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <PersonOutlineRounded sx={{ fontSize: size * 0.66, color: FAINT }} />
      </Box>
    );
  }
  return <UserAvatar name={name} src={src || ""} size={size} sx={{ bgcolor: ACCENT_SOFT, color: ACCENT, fontWeight: 800 }} />;
}
const sourceKey = (src) => (SOURCE_LABEL[src] !== undefined ? src : "");

/** ไอคอนในกรอบมนพื้นอ่อน — สีบอกความหมายของช่อง */
function IconBadge({ icon: Icon, tone, size = 30 }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: "9px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(tone, 0.12), color: tone }}>
      <Icon sx={{ fontSize: size * 0.6 }} />
    </Box>
  );
}

/** ช่องตัวเลข · hero = ยอดหลัก (พื้นฟ้าอ่อน ตัวเลขใหญ่) */
function Tile({ icon, tone = SLATE, label, value, sub, onClick, hero = false, dim = false, valueColor }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} component="div"
      sx={{ display: "block", height: "100%", textAlign: "left", fontFamily: "inherit", p: { xs: 1.4, sm: 1.6 }, borderRadius: "14px", minWidth: 0,
        bgcolor: hero ? ACCENT_SOFT : "#fff", border: `1px solid ${hero ? ACCENT_LINE : LINE}`,
        backgroundImage: hero ? `linear-gradient(135deg, ${alpha(ACCENT, 0.09)} 0%, ${alpha(ACCENT, 0.02)} 70%)` : "none",
        transition: "border-color .15s ease, box-shadow .15s ease, transform .15s ease",
        "&:hover": onClick ? { borderColor: hero ? ACCENT : "#cbd5e1", boxShadow: "0 4px 14px rgba(15,23,42,.06)" } : {} }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconBadge icon={icon} tone={tone} size={hero ? 32 : 28} />
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 700, color: hero ? ACCENT : INK_2, lineHeight: 1.3 }}>{label}</Typography>
        {onClick && <ChevronRightRounded sx={{ fontSize: 18, color: hero ? ACCENT : "#cbd5e1" }} />}
      </Stack>
      <Typography noWrap sx={{ mt: 1, fontSize: hero ? { xs: "1.6rem", sm: "1.75rem" } : { xs: "1.18rem", sm: "1.3rem" }, fontWeight: 800,
        color: valueColor || (dim ? SLATE : INK), lineHeight: 1.15, letterSpacing: "-0.01em", ...NUM }}>{value}</Typography>
      <Typography sx={{ mt: 0.4, fontSize: "0.76rem", color: MUTED, lineHeight: 1.4 }}>{sub}</Typography>
    </ButtonBase>
  );
}

/** แถบความครบ (สัดส่วนตามจำนวนงาน) · parts = [[จำนวน, สี], ...] */
function CoverageBar({ parts, done, n, label }) {
  if (!n) return null;
  const shown = parts.filter(([c]) => c);
  return (
    <Box sx={{ mt: 1.4, px: 0.25 }}>
      <Stack direction="row" alignItems="baseline" sx={{ mb: 0.6 }}>
        <Typography sx={{ flex: 1, fontSize: "0.76rem", color: MUTED }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: INK_2, fontWeight: 700, ...NUM }}>
          {done}/{n} งาน <Box component="span" sx={{ color: ACCENT }}>{Math.round((done / n) * 100)}%</Box>
        </Typography>
      </Stack>
      <Box sx={{ display: "flex", gap: "3px", height: 6, borderRadius: 3, overflow: "hidden", bgcolor: shown.length ? "transparent" : TRACK }}>
        {shown.map(([c, color]) => <Box key={color} sx={{ flex: c, bgcolor: color, borderRadius: 3 }} />)}
      </Box>
    </Box>
  );
}

/** หัวกล่อง: ไอคอน + ชื่อ + รายละเอียด + ปุ่มขวา */
function CardHead({ icon, title, sub, action }) {
  return (
    <Stack direction="row" alignItems="center" gap={1.1} sx={{ mb: 1.4 }}>
      <IconBadge icon={icon} tone={ACCENT} size={34} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.98rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>{title}</Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{sub}</Typography>
      </Box>
      {action}
    </Stack>
  );
}

/** ตารางช่อง: ช่องแรก (ยอดหลัก) เต็มแถวบนมือถือ · จอกว้าง 3 ช่องเรียงกัน */
function TileGrid({ first, children }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "1.5fr 1fr 1fr" } }}>
      <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>{first}</Box>
      {children}
    </Box>
  );
}

/** ปุ่ม "แจกแจงที่มา" มุมขวาของหัวกล่อง */
function DetailButton({ onClick }) {
  return (
    <ButtonBase onClick={onClick}
      sx={{ flexShrink: 0, pl: 1.25, pr: 0.75, py: 0.6, borderRadius: 99, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 800,
        color: ACCENT, bgcolor: ACCENT_SOFT, border: `1px solid ${ACCENT_LINE}`, "&:hover": { bgcolor: alpha(ACCENT, 0.12) } }}>
      แจกแจงที่มา<ChevronRightRounded sx={{ fontSize: 18 }} />
    </ButtonBase>
  );
}

/* ── จอคอม: แถบตัวเลขต่อกันเป็นแผ่นเดียว + วงความครบ ───────────────────────────────
   🔁 (20 พ.ย. 2569 ผู้ใช้: "ตรงนี้ก็ยังดูไม่สวย") จอกว้าง 3 กล่องลอยแยกกันกว้างเกือบ 600px ต่อกล่อง เหลือที่ว่างเยอะ
   แถบความครบเส้นบางยาวเต็มจอมีสีแค่ปลายนิดเดียว ดูแปลก · "ต้องตรวจ" ตัวเลขสีเทาจาง ดูเหมือนปิดใช้งาน
   → แผ่นเดียวคั่นเส้น 4 ช่อง: ยอดหลัก (พื้นฟ้าอ่อน) · ช่องรอง 2 ช่อง · วงความครบ (% กลางวง + คำอธิบายสีครบ)
   มือถือใช้แบบเดิม (ยอดหลักเต็มแถว + 2 ช่อง + แถบ) */
function StripCell({ icon, tone = SLATE, label, value, sub, onClick, hero = false, valueColor }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} component="div"
      sx={{ display: "block", textAlign: "left", fontFamily: "inherit", px: 2, py: 1.75, minWidth: 0, height: "100%",
        background: hero ? `linear-gradient(135deg, ${alpha(ACCENT, 0.1)} 0%, ${alpha(ACCENT, 0.02)} 85%)` : "#fff",
        transition: "background-color .15s ease", "&:hover": onClick ? { bgcolor: hero ? undefined : "#f8fbff", backgroundImage: hero ? `linear-gradient(135deg, ${alpha(ACCENT, 0.14)} 0%, ${alpha(ACCENT, 0.04)} 85%)` : undefined } : {} }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconBadge icon={icon} tone={tone} size={hero ? 32 : 28} />
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: hero ? ACCENT : INK_2 }}>{label}</Typography>
        {onClick && <ChevronRightRounded sx={{ fontSize: 18, color: hero ? ACCENT : "#cbd5e1" }} />}
      </Stack>
      <Typography noWrap sx={{ mt: 1.1, fontSize: hero ? "1.85rem" : "1.4rem", fontWeight: 800, color: valueColor || INK, lineHeight: 1.12, letterSpacing: "-0.01em", ...NUM }}>{value}</Typography>
      <Typography sx={{ mt: 0.45, fontSize: "0.76rem", color: MUTED, lineHeight: 1.4 }}>{sub}</Typography>
    </ButtonBase>
  );
}

/** วงความครบ — parts = [[จำนวน, สี], ...] วนตามเข็มจากด้านบน */
function Ring({ parts, n, size = 74, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = parts[0]?.[0] || 0;
  let off = 0;
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        {parts.filter(([v, color]) => v > 0 && color !== BAR_EMPTY).map(([v, color]) => {
          const len = Math.max((v / n) * c, 2.5); // ส่วนเล็กมากยังเห็นเป็นจุด
          const el = <circle key={color} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} strokeLinecap="round" />;
          off += len;
          return el;
        })}
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: INK, ...NUM }}>{n ? Math.round((done / n) * 100) : 0}%</Typography>
      </Box>
    </Box>
  );
}

function CoverageCell({ parts, done, n, label, legend }) {
  return (
    <Stack direction="row" alignItems="center" gap={1.75} sx={{ px: 2, py: 1.5, minWidth: 0, bgcolor: "#fcfdff" }}>
      <Ring parts={parts} n={n} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK_2 }}>{label}</Typography>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: INK, ...NUM }}>{done.toLocaleString()} <Box component="span" sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED }}>/ {n.toLocaleString()} งาน</Box></Typography>
        <Stack sx={{ mt: 0.5, gap: 0.25 }}>
          {legend.map(([color, text]) => (
            <Stack key={text} direction="row" alignItems="center" gap={0.75}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, ...NUM }}>{text}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function StatStrip({ children }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.25fr", border: `1px solid ${LINE}`, borderRadius: "14px", overflow: "hidden",
      "& > *:not(:first-of-type)": { borderLeft: `1px solid ${LINE}` } }}>
      {children}
    </Box>
  );
}

const CARD_SX = { mb: 1.5, p: { xs: 1.5, sm: 1.75 }, borderRadius: "16px", bgcolor: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(15,23,42,.04)" };
const BAR_BLUE = ACCENT;
const BAR_WARN = "#f59e0b";
const BAR_EMPTY = TRACK;

/**
 * กล่องสรุปมูลค่า (แอดมิน/ผู้จัดการ)
 * @param s            valueSummary { total, withValue, wholeTotal, wholeCount, missing, own, ownCount, jobs, items }
 * @param periodText   ช่วงที่กำลังดู เช่น "ทุกเดือน" / "11/2569"
 * @param member       ชื่อผู้ปฏิบัติงานที่กรองอยู่ ("" = ทุกคน)
 * @param onOpenDetail (filter) => void — "all" | "whole" | "counted" · เลือกคน: "p-all" | "p-done" | "p-missing"
 */
export function WorkValueSummaryCard({ s, periodText, member, onOpenDetail }) {
  const period = periodText ? ` · ${periodText}` : "";
  const desk = useMediaQuery("(min-width:900px)");
  // 🐛 (18 พ.ย. 2569 ผู้ใช้: "ค้นหาแล้วแสดงเพี้ยนมากๆ") เลือกผู้ปฏิบัติงานแล้วหัวข้อถูกบีบเหลือคำละบรรทัด
  //    → ใช้โครงเดียวกับกล่องรวม: หัวกล่อง + ช่องตัวเลข + แถบความครบ
  if (member) {
    const notYet = Math.max(0, s.jobs - s.ownCount);
    // ✅ (18 พ.ย. 2569 ผู้ใช้: "ให้กดดูที่มาได้แบบดูทั้งหมดทุกคนด้วย") กดดูได้เหมือนกล่องรวม
    return (
      <Box sx={CARD_SX}>
        <CardHead icon={GroupsRounded} title={`ผลงานของ ${member}`} sub={`ยอดที่ลงเอง · ก่อน VAT${period} · ${s.jobs} งาน`}
          action={<DetailButton onClick={() => onOpenDetail(s.ownCount ? "p-done" : "p-all")} />} />
        {desk ? (
          <StatStrip>
            <StripCell hero icon={PaymentsRounded} tone={ACCENT} label="ผลงานที่ลงเอง" value={baht(s.own)}
              sub={s.ownCount ? `ลงแล้ว ${s.ownCount} งาน` : "ยังไม่ได้ลงผลงาน"} onClick={s.ownCount ? () => onOpenDetail("p-done") : undefined} />
            <StripCell icon={InsightsRounded} tone={TEAL} label="เฉลี่ยต่องาน" value={s.ownCount ? baht(s.own / s.ownCount) : "—"} sub="เฉพาะงานที่ลงแล้ว" />
            <StripCell icon={HourglassEmptyRounded} tone={WARN} label="ยังไม่ลง" value={`${notYet} งาน`} sub="ยังไม่มีผลงานรายคน"
              onClick={notYet ? () => onOpenDetail("p-missing") : undefined} />
            <CoverageCell parts={[[s.ownCount, BAR_BLUE], [notYet, BAR_EMPTY]]} done={s.ownCount} n={s.jobs} label="ลงผลงานแล้ว"
              legend={[[BAR_BLUE, `ลงแล้ว ${s.ownCount} งาน`], ["#cbd5e1", `ยังไม่ลง ${notYet} งาน`]]} />
          </StatStrip>
        ) : (
          <>
            <TileGrid first={
              <Tile hero icon={PaymentsRounded} tone={ACCENT} label="ผลงานที่ลงเอง" value={baht(s.own)}
                sub={s.ownCount ? `ลงแล้ว ${s.ownCount} งาน` : "ยังไม่ได้ลงผลงาน"} onClick={s.ownCount ? () => onOpenDetail("p-done") : undefined} />
            }>
              <Tile icon={InsightsRounded} tone={TEAL} label="เฉลี่ยต่องาน" value={s.ownCount ? baht(s.own / s.ownCount) : "—"} sub="เฉพาะงานที่ลงแล้ว" />
              <Tile icon={HourglassEmptyRounded} tone={WARN} label="ยังไม่ลง" value={`${notYet} งาน`} sub="ยังไม่มีผลงานรายคน"
                onClick={notYet ? () => onOpenDetail("p-missing") : undefined} />
            </TileGrid>
            <CoverageBar parts={[[s.ownCount, BAR_BLUE], [notYet, BAR_EMPTY]]} done={s.ownCount} n={s.jobs} label="ลงผลงานแล้ว" />
          </>
        )}
      </Box>
    );
  }
  const jobs = s.withValue + s.wholeCount + s.missing;
  return (
    <Box sx={CARD_SX}>
      <CardHead icon={PaymentsRounded} title="มูลค่าครั้งนี้ของงาน" sub={`ก่อน VAT${period} · ${jobs} งาน`}
        action={s.items.length > 0 && <DetailButton onClick={() => onOpenDetail("all")} />} />
      {desk ? (
        <StatStrip>
          <StripCell hero icon={TaskAltRounded} tone={ACCENT} label="นับแล้ว" value={baht(s.total)}
            sub={s.withValue ? `${s.withValue} งาน · เฉลี่ย ${baht(s.total / s.withValue)} / งาน` : "ยังไม่มีงานที่นับได้"}
            onClick={s.withValue ? () => onOpenDetail("counted") : undefined} />
          <StripCell icon={ReportProblemRounded} tone={WARN} label="ต้องตรวจ" value={s.wholeCount ? baht(s.wholeTotal) : "—"} valueColor={s.wholeCount ? WARN_TEXT : FAINT}
            sub={s.wholeCount ? `${s.wholeCount} งาน · ใส่เท่ามูลค่างานรวม ไม่นับ` : "ไม่มี"} onClick={s.wholeCount ? () => onOpenDetail("whole") : undefined} />
          <StripCell icon={HourglassEmptyRounded} tone={SLATE} label="ยังไม่ใส่" value={`${s.missing} งาน`} sub="ยังไม่มีมูลค่าครั้งนี้" />
          <CoverageCell parts={[[s.withValue, BAR_BLUE], [s.wholeCount, BAR_WARN], [s.missing, BAR_EMPTY]]} done={s.withValue} n={jobs} label="ใส่มูลค่าครั้งนี้แล้ว"
            legend={[[BAR_BLUE, `นับแล้ว ${s.withValue} งาน`], ...(s.wholeCount ? [[BAR_WARN, `ต้องตรวจ ${s.wholeCount} งาน`]] : []), ["#cbd5e1", `ยังไม่ใส่ ${s.missing} งาน`]]} />
        </StatStrip>
      ) : (
        <>
          <TileGrid first={
            <Tile hero icon={TaskAltRounded} tone={ACCENT} label="นับแล้ว" value={baht(s.total)}
              sub={s.withValue ? `${s.withValue} งาน · เฉลี่ย ${baht(s.total / s.withValue)} / งาน` : "ยังไม่มีงานที่นับได้"}
              onClick={s.withValue ? () => onOpenDetail("counted") : undefined} />
          }>
            <Tile icon={ReportProblemRounded} tone={WARN} label="ต้องตรวจ" value={s.wholeCount ? baht(s.wholeTotal) : "—"} valueColor={s.wholeCount ? WARN_TEXT : FAINT}
              sub={s.wholeCount ? `${s.wholeCount} งาน · ใส่เท่ามูลค่างานรวม ไม่นับ` : "ไม่มี"} onClick={s.wholeCount ? () => onOpenDetail("whole") : undefined} />
            <Tile icon={HourglassEmptyRounded} tone={SLATE} label="ยังไม่ใส่" value={`${s.missing} งาน`} sub="ยังไม่มีมูลค่าครั้งนี้" />
          </TileGrid>
          <CoverageBar parts={[[s.withValue, BAR_BLUE], [s.wholeCount, BAR_WARN], [s.missing, BAR_EMPTY]]} done={s.withValue} n={jobs} label="ใส่มูลค่าครั้งนี้แล้ว" />
        </>
      )}
    </Box>
  );
}

/** ปุ่มสลับมุมมองในแผ่นแจกแจง (เลือกคนอยู่): ผลงานรายคน ↔ มูลค่าครั้งนี้ของงาน */
function ViewSwitch({ value, onChange, member }) {
  const opts = [["person", `ผลงานของ ${member}`], ["job", "มูลค่าครั้งนี้ของงาน"]];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, p: 0.5, mb: 1.5, borderRadius: "12px", bgcolor: "#eef2f7" }}>
      {opts.map(([k, label]) => {
        const on = value === k;
        return (
          <ButtonBase key={k} onClick={() => onChange(k)}
            sx={{ minWidth: 0, px: 1, py: 0.95, borderRadius: "9px", fontFamily: "inherit", color: on ? ACCENT : MUTED, bgcolor: on ? "#fff" : "transparent",
              boxShadow: on ? "0 1px 3px rgba(15,23,42,.10)" : "none", transition: "all .15s ease" }}>
            <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 800 }}>{label}</Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/** ปุ่มกรองแบบเม็ดยา · เลือกอยู่ = น้ำเงินเต็ม (ธีมระบบ) · items = [[key, label, count, warn?]] (warn = โทนส้มอ่อน) */
function FilterChips({ items, value, onChange }) {
  return (
    <Stack direction="row" gap={0.75} sx={{ mb: 1.25, flexWrap: "wrap" }}>
      {items.map(([k, label, count, warn]) => {
        const on = value === k;
        const off = !count && !k.endsWith("all");
        const fill = warn ? WARN : ACCENT;
        return (
          <ButtonBase key={k} onClick={() => onChange(k)} disabled={off}
            sx={{ gap: 0.75, pl: 1.4, pr: 0.6, py: 0.55, borderRadius: 99, fontFamily: "inherit", fontSize: "0.84rem", fontWeight: 700,
              color: on ? "#fff" : warn ? WARN_TEXT : INK_2, bgcolor: on ? fill : warn ? WARN_SOFT : "#fff",
              border: `1px solid ${on ? fill : warn ? WARN_LINE : LINE}`, opacity: off ? 0.45 : 1, transition: "all .15s ease" }}>
            {label}
            <Box component="span" sx={{ minWidth: 22, px: 0.6, py: 0.05, borderRadius: 99, fontSize: "0.74rem", fontWeight: 800, textAlign: "center",
              bgcolor: on ? "rgba(255,255,255,.22)" : warn ? alpha(WARN, 0.12) : "#f1f5f9", color: on ? "#fff" : warn ? WARN_TEXT : MUTED, ...NUM }}>{count}</Box>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}

/** แถวงาน 1 แถวในแผ่นแจกแจง (กดเปิดงาน) */
function JobRow({ first, onClick, children }) {
  return (
    <ButtonBase component="div" onClick={onClick}
      sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", pl: 1.5, pr: 1, py: 1.4, textAlign: "left", fontFamily: "inherit",
        borderTop: first ? 0 : `1px solid ${LINE}`,
        transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fafc" } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <ChevronRightRounded sx={{ fontSize: 20, color: "#cbd5e1", flexShrink: 0 }} />
    </ButtonBase>
  );
}

/** ป้ายสั้นพื้นอ่อน · tone: blue | warn | slate */
function Pill({ tone = "slate", children }) {
  const c = tone === "blue" ? [ACCENT, ACCENT_SOFT] : tone === "warn" ? [WARN_TEXT, WARN_SOFT] : [SLATE, "#f1f5f9"];
  return (
    <Box component="span" sx={{ flexShrink: 0, px: 0.9, py: 0.2, borderRadius: 99, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
      color: c[0], bgcolor: c[1], border: tone === "warn" ? `1px solid ${WARN_LINE}` : "1px solid transparent" }}>
      {children}
    </Box>
  );
}

/** กล่องแจกแจงสัดส่วน (ใครเป็นคนลง / ยอดมาจากไหน) */
function BreakdownBox({ icon, title, sub, children }) {
  return (
    <Box sx={{ mb: 1.5, p: { xs: 1.4, sm: 1.6 }, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${LINE}` }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
        <IconBadge icon={icon} tone={ACCENT} size={28} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{sub}</Typography>
        </Box>
      </Stack>
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}

/** แถวสัดส่วน: ชื่อ · จำนวนงาน · ยอด · % + แถบ */
function ShareRow({ lead, label, count, total, pct, color = BAR_BLUE }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={0.9}>
        {lead}
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.84rem", color: INK_2, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, ...NUM }}>{count} งาน</Typography>
        <Typography sx={{ minWidth: 84, textAlign: "right", fontSize: "0.9rem", fontWeight: 800, color: INK, ...NUM }}>{baht(total)}</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.6 }}>
        <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: TRACK, overflow: "hidden" }}>
          <Box sx={{ width: `${Math.max(pct, 1.5)}%`, height: "100%", bgcolor: color, borderRadius: 3 }} />
        </Box>
        <Typography sx={{ width: 36, textAlign: "right", fontSize: "0.74rem", fontWeight: 700, color: MUTED, ...NUM }}>{Math.round(pct)}%</Typography>
      </Stack>
    </Box>
  );
}

const LIST_SX = { bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: "14px", overflow: "hidden" };

const PERSON_KIND = {
  self: { label: "ลงเอง", short: "ลงเอง", tone: "blue" },
  proxy: { label: "ลงแทนโดย", short: "ลงแทน", tone: "warn" },
  legacy: { label: "ยอดเดิม (ลงเป็นมูลค่าครั้งนี้ของงาน)", short: "ยอดเดิม", tone: "slate" },
};

/**
 * มุมมองผลงานรายคน — งานที่คนนั้นอยู่ในทีม: ลงแล้วเท่าไร ใครเป็นคนลง · งานไหนยังไม่ลง
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "ให้กดดูที่มาได้แบบดูทั้งหมดทุกคนด้วย")
 */
function PersonValueBody({ s, member, filter, onFilter, onOpenJob, employees }) {
  const list = useMemo(() => s.personItems || [], [s.personItems]);
  const doneCount = list.filter((it) => it.value !== null).length;
  const notYet = list.length - doneCount;
  const personOf = (name) => {
    const emp = findEmployee(employees, name);
    return { name: emp ? [emp.fname, emp.lname].filter(Boolean).join(" ") : name, src: emp?.imageUrl || "" };
  };
  // ยอดมาจากใคร: ลงเอง · ลงแทน (แยกตามคนลง) · ยอดเดิม
  const byWho = useMemo(() => {
    const m = new Map();
    list.filter((it) => it.value !== null).forEach((it) => {
      const k = it.kind === "proxy" ? `proxy:${it.by}` : it.kind;
      if (!m.has(k)) m.set(k, { key: k, kind: it.kind, by: it.by, count: 0, total: 0 });
      const r = m.get(k);
      r.count += 1; r.total += it.value;
    });
    const order = { self: 0, proxy: 1, legacy: 2 };
    return [...m.values()].sort((a, b) => order[a.kind] - order[b.kind] || b.total - a.total);
  }, [list]);
  const items = list.filter((it) => (filter === "p-done" ? it.value !== null : filter === "p-missing" ? it.value === null : true));
  const firstName = (n) => String(n || "").split(" ")[0];

  return (
    <>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1.3fr 1fr", mb: 1.5 }}>
        <Tile hero icon={PaymentsRounded} tone={ACCENT} label="ผลงานที่ลงเอง" value={baht(s.own)} sub={`ลงแล้ว ${s.ownCount} งาน`} />
        <Tile icon={HourglassEmptyRounded} tone={WARN} label="ยังไม่ลง" value={`${notYet} งาน`} sub="ยังไม่มีผลงานรายคน" />
      </Box>

      {byWho.length > 0 && (
        <BreakdownBox icon={GroupsRounded} title="ใครเป็นคนลง" sub={`รวม ${baht(s.own)} จาก ${s.ownCount} งาน · ก่อน VAT`}>
          {byWho.map((r) => {
            const p = personOf(r.kind === "proxy" ? r.by : member);
            return (
              <ShareRow key={r.key} lead={<ByAvatar name={p.name} src={p.src} size={24} />}
                label={r.kind === "proxy" ? `${PERSON_KIND.proxy.label} ${firstName(p.name)}` : PERSON_KIND[r.kind].label}
                count={r.count} total={r.total} pct={s.own ? (r.total / s.own) * 100 : 0}
                color={r.kind === "legacy" ? "#94a3b8" : r.kind === "proxy" ? BAR_WARN : BAR_BLUE} />
            );
          })}
        </BreakdownBox>
      )}

      <FilterChips value={filter} onChange={onFilter}
        items={[["p-all", "ทั้งหมด", list.length], ["p-done", "ลงแล้ว", doneCount], ["p-missing", "ยังไม่ลง", notYet, true]]} />

      <Box sx={LIST_SX}>
        {!items.length && <Typography sx={{ p: 2.5, textAlign: "center", fontSize: "0.88rem", color: FAINT }}>ไม่มีรายการ</Typography>}
        {items.map((it, i) => {
          const done = it.value !== null;
          const p = done ? personOf(it.by) : null;
          return (
            <JobRow key={it.id || i} first={!i} onClick={() => onOpenJob(it.id)}>
              {/* บรรทัด 1: โครงการ · ผลงาน */}
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.94rem", fontWeight: 700, color: INK }}>{it.site}</Typography>
                {done
                  ? <Typography sx={{ flexShrink: 0, fontSize: "0.98rem", fontWeight: 800, color: INK, ...NUM }}>{baht(it.value)}</Typography>
                  : <Pill tone="warn">ยังไม่ลง</Pill>}
              </Stack>
              {/* บรรทัด 2: งาน · วันที่ · มูลค่าครั้งนี้ของงาน (ไว้เทียบ) */}
              <Typography noWrap sx={{ mt: 0.3, fontSize: "0.78rem", color: MUTED }}>
                {[it.title, thaiDate(it.start), it.sessions > 1 ? `${it.sessions} ช่วงวัน` : "", it.jobValue !== null ? `ของงาน ${baht(it.jobValue)}` : ""].filter(Boolean).join(" · ")}
              </Typography>
              {/* บรรทัด 3: ผู้ลง (รูป + ชื่อ + วันที่ลง) · VAT · ป้าย */}
              {done && (
                <Stack direction="row" alignItems="center" gap={0.85} sx={{ mt: 0.9 }}>
                  <ByAvatar name={p.name} src={p.src} size={24} />
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 600, color: INK_2 }}>
                    {p.name}
                    <Box component="span" sx={{ fontWeight: 400, color: FAINT }}>
                      {it.at ? ` · ${thaiDate(it.at)}` : ""}{it.vatIncluded ? ` · ${baht(it.amount)} รวม VAT` : ""}
                    </Box>
                  </Typography>
                  <Pill tone={PERSON_KIND[it.kind].tone}>{PERSON_KIND[it.kind].short}</Pill>
                </Stack>
              )}
            </JobRow>
          );
        })}
      </Box>
    </>
  );
}

/** มุมมองมูลค่าครั้งนี้ของงาน (1 ค่าต่องาน) — แยกตามที่มา · ต้องตรวจ · ผู้ลงมูลค่า */
function JobValueBody({ open, s, member, filter, onFilter, onOpenJob, employees }) {
  const [who, setWho] = useState(null); // กรองตามผู้ลง (null = ทุกคน · "" = ไม่ทราบผู้ลง)
  useEffect(() => { if (!open) setWho(null); }, [open]);
  // ผู้ลงมูลค่า → รูป/ชื่อเต็มจากทะเบียนพนักงาน
  const people = useMemo(() => {
    const m = new Map();
    s.items.forEach((it) => {
      const k = String(it.by || "").trim();
      if (!m.has(k)) {
        const emp = findEmployee(employees, k);
        m.set(k, { key: k, name: k, src: emp?.imageUrl || "", count: 0 });
      }
      m.get(k).count += 1;
    });
    return [...m.values()].sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || b.count - a.count);
  }, [s.items, employees]);
  const personOf = (by) => people.find((p) => p.key === String(by || "").trim());
  // มูลค่าครั้งนี้ที่นับ แยกตามที่มา
  const bySource = useMemo(() => {
    const m = new Map(VALUE_SOURCES.map((x) => [x.key, { ...x, count: 0, total: 0 }]));
    s.items.filter((it) => !it.whole).forEach((it) => {
      const r = m.get(sourceKey(it.source));
      r.count += 1; r.total += it.value;
    });
    return [...m.values()].filter((r) => r.count).sort((a, b) => b.total - a.total);
  }, [s.items]);
  const items = s.items
    .filter((it) => (filter === "whole" ? it.whole : filter === "counted" ? !it.whole : true))
    .filter((it) => who === null || String(it.by || "").trim() === who);

  return (
    <>
      {member && (
        <Stack direction="row" gap={0.75} sx={{ mb: 1.25, px: 1.25, py: 1, borderRadius: "12px", bgcolor: ACCENT_SOFT, border: `1px solid ${ACCENT_LINE}` }}>
          <InfoRounded sx={{ fontSize: 17, color: ACCENT, mt: "1px" }} />
          <Typography sx={{ fontSize: "0.78rem", color: INK_2, lineHeight: 1.55 }}>
            มูลค่าครั้งนี้ของงานที่ <b>{member}</b> อยู่ในทีม — 1 ค่าต่องาน เป็นของทั้งงาน ไม่ใช่ผลงานของ {member} คนเดียว
          </Typography>
        </Stack>
      )}
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1.3fr 1fr", mb: 1.5 }}>
        <Tile hero icon={TaskAltRounded} tone={ACCENT} label="นับแล้ว" value={baht(s.total)} sub={`${s.withValue} งาน`} />
        <Tile icon={ReportProblemRounded} tone={WARN} label="ต้องตรวจ" value={s.wholeCount ? baht(s.wholeTotal) : "—"} dim
          sub={s.wholeCount ? `${s.wholeCount} งาน · ไม่นับ` : "ไม่มี"} />
      </Box>

      {bySource.length > 0 && (
        <BreakdownBox icon={AccountTreeRounded} title="ยอดที่นับ มาจากไหน" sub={`รวม ${baht(s.total)} จาก ${s.withValue} งาน`}>
          {bySource.map((r) => (
            <ShareRow key={r.key || "none"} label={r.label} count={r.count} total={r.total}
              pct={s.total ? (r.total / s.total) * 100 : 0} color={r.key === "job" ? BAR_WARN : BAR_BLUE} />
          ))}
        </BreakdownBox>
      )}

      <FilterChips value={filter} onChange={onFilter}
        items={[["all", "ทั้งหมด", s.items.length], ["whole", "ต้องตรวจ", s.wholeCount, true], ["counted", "นับแล้ว", s.withValue]]} />
      {people.length > 1 && (
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25, overflowX: "auto", pb: 0.25, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          <Typography sx={{ flexShrink: 0, fontSize: "0.76rem", fontWeight: 700, color: MUTED, mr: 0.25 }}>ผู้ลง</Typography>
          {people.map((p) => {
            const on = who === p.key;
            return (
              <ButtonBase key={p.key || "none"} onClick={() => setWho(on ? null : p.key)}
                sx={{ flexShrink: 0, gap: 0.7, pl: 0.45, pr: 1.1, py: 0.4, borderRadius: 99, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700,
                  color: on ? ACCENT : INK_2, bgcolor: on ? ACCENT_SOFT : "#fff", border: `1px solid ${on ? ACCENT : LINE}`, transition: "all .15s ease" }}>
                <ByAvatar name={p.name} src={p.src} size={24} />
                <span>{p.name ? p.name.split(" ")[0] : "ไม่ทราบ"}</span>
                <Box component="span" sx={{ fontWeight: 800, color: on ? ACCENT : FAINT, ...NUM }}>{p.count}</Box>
              </ButtonBase>
            );
          })}
        </Stack>
      )}
      {items.some((it) => it.whole) && (
        <Stack direction="row" gap={0.85} sx={{ mb: 1.25, px: 1.25, py: 1, borderRadius: "12px", bgcolor: WARN_SOFT, border: `1px solid ${WARN_LINE}` }}>
          <ReportProblemRounded sx={{ fontSize: 17, color: WARN, mt: "1px" }} />
          <Typography sx={{ fontSize: "0.78rem", color: "#78350f", lineHeight: 1.6 }}>
            <b>ต้องตรวจ</b> = ใส่มูลค่าครั้งนี้เท่ากับมูลค่างานรวมทั้งงาน จึงไม่นับ — กดงานเพื่อแก้เป็นยอดของครั้งนี้
            · ถ้างานนั้นเข้าครั้งเดียวจริง ยอดถูกต้องแล้ว
          </Typography>
        </Stack>
      )}

      <Box sx={LIST_SX}>
        {!items.length && <Typography sx={{ p: 2.5, textAlign: "center", fontSize: "0.88rem", color: FAINT }}>ไม่มีรายการ</Typography>}
        {items.map((it, i) => {
          const p = personOf(it.by);
          return (
            <JobRow key={it.id} first={!i} onClick={() => onOpenJob(it.id)}>
              {/* บรรทัด 1: โครงการ · ยอด */}
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.94rem", fontWeight: 700, color: INK }}>{it.site}</Typography>
                <Typography sx={{ flexShrink: 0, fontSize: "0.98rem", fontWeight: 800, color: it.whole ? SLATE : INK, ...NUM }}>{baht(it.value)}</Typography>
              </Stack>
              {/* บรรทัด 2: งาน · วันที่ · เทียบมูลค่างานรวม */}
              <Typography noWrap sx={{ mt: 0.3, fontSize: "0.78rem", color: MUTED }}>
                {[it.title, thaiDate(it.start), it.sessions > 1 ? `${it.sessions} ช่วงวัน · นับครั้งเดียว` : "", !it.whole && it.total !== null ? `งานรวม ${baht(it.total)}` : ""].filter(Boolean).join(" · ")}
              </Typography>
              {/* บรรทัด 3: ผู้ลง (รูป + ชื่อ + วันที่ลง) · ที่มาของยอด */}
              <Stack direction="row" alignItems="center" gap={0.85} sx={{ mt: 0.9 }}>
                <ByAvatar name={p?.name} src={p?.src} size={24} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 600, color: p?.name ? INK_2 : FAINT }}>
                  {p?.name || "ไม่ทราบผู้ลง"}
                  {it.at && <Box component="span" sx={{ fontWeight: 400, color: FAINT }}> · {thaiDate(it.at)}</Box>}
                </Typography>
                {it.whole
                  ? <Pill tone="warn">ต้องตรวจ · ไม่นับ</Pill>
                  : <Pill tone={it.source === "job" ? "warn" : it.source === "manual" ? "blue" : "slate"}>{SOURCE_SHORT[sourceKey(it.source)]}</Pill>}
              </Stack>
            </JobRow>
          );
        })}
      </Box>
    </>
  );
}

/**
 * แผ่นแจกแจงที่มาของยอด
 * @param filter    "all" | "whole" | "counted" = มูลค่าครั้งนี้ของงาน · "p-all" | "p-done" | "p-missing" = ผลงานรายคน (null = ปิด)
 * @param onFilter  เปลี่ยนตัวกรอง
 * @param member    ชื่อผู้ปฏิบัติงานที่กรองอยู่ ("" = ทุกคน) — มีชื่อ = สลับดูผลงานรายคน/มูลค่าครั้งนี้ของงานได้
 * @param onOpenJob (eventId) => void
 */
export function WorkValueSourceSheet({ filter, onFilter, onClose, s, periodText, onOpenJob, employees = [], member = "" }) {
  const open = !!filter;
  const view = member && String(filter || "").startsWith("p-") ? "person" : "job";
  const period = periodText ? ` · ${periodText}` : "";
  return (
    <MobileSheet open={open} onClose={onClose} maxWidth="md"
      title={view === "person" ? `แจกแจงผลงานของ ${member}` : "แจกแจงมูลค่าครั้งนี้"}
      subtitle={view === "person" ? `งานไหนลงแล้ว เท่าไร ใครลง${period} · กดงานเพื่อเปิด` : `งานไหน เท่าไร มาจากไหน${period} · กดงานเพื่อเปิดไปแก้`}>
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {member && <ViewSwitch member={member} value={view} onChange={(v) => onFilter(v === "person" ? "p-all" : "all")} />}
        {view === "person"
          ? <PersonValueBody s={s} member={member} filter={filter} onFilter={onFilter} onOpenJob={onOpenJob} employees={employees} />
          : <JobValueBody open={open} s={s} member={member} filter={filter} onFilter={onFilter} onOpenJob={onOpenJob} employees={employees} />}
      </Box>
    </MobileSheet>
  );
}
