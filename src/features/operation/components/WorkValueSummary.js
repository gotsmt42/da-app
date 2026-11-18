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
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRightRounded, ErrorRounded, CheckCircleRounded, RadioButtonUncheckedRounded, PersonOutlineRounded } from "@mui/icons-material";
import MobileSheet from "@/shared/ui/MobileSheet";
import UserAvatar from "@/shared/ui/UserAvatar";
import { INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";

const WARN = "#b45309";
const GRAY = "#64748b";
const FAINT = "#94a3b8";
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

/** รูปผู้ลง · ไม่ทราบผู้ลง = ไอคอนคนสีเทา */
function ByAvatar({ name, src, size = 22 }) {
  if (!name) {
    return (
      <Box sx={{ width: size, height: size, borderRadius: "50%", bgcolor: "#f1f5f9", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <PersonOutlineRounded sx={{ fontSize: size * 0.68, color: FAINT }} />
      </Box>
    );
  }
  return <UserAvatar name={name} src={src || ""} size={size} sx={{ boxShadow: "0 0 0 1.5px #fff" }} />;
}
const sourceKey = (src) => (SOURCE_LABEL[src] !== undefined ? src : "");

/** ช่องตัวเลข 1 ช่อง */
function Tile({ icon: Icon, tone, label, value, sub, onClick }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} component="div"
      sx={{ display: "block", height: "100%", textAlign: "left", fontFamily: "inherit", px: 1.5, py: 1.15, borderRadius: 2.5, minWidth: 0,
        bgcolor: alpha(tone, 0.045), border: `1px solid ${alpha(tone, 0.16)}`, transition: "border-color .15s ease, background-color .15s ease",
        "&:hover": onClick ? { borderColor: alpha(tone, 0.45), bgcolor: alpha(tone, 0.07) } : {} }}>
      <Stack direction="row" alignItems="center" gap={0.6}>
        <Icon sx={{ fontSize: 15, color: tone }} />
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", fontWeight: 800, color: tone }}>{label}</Typography>
        {onClick && <ChevronRightRounded sx={{ fontSize: 16, color: alpha(tone, 0.6) }} />}
      </Stack>
      <Typography noWrap sx={{ mt: 0.25, fontSize: { xs: "1.12rem", sm: "1.28rem" }, fontWeight: 900, color: INK, lineHeight: 1.25, ...NUM }}>{value}</Typography>
      <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>{sub}</Typography>
    </ButtonBase>
  );
}

/** แถบความครบ: นับแล้ว · ต้องตรวจ · ยังไม่ใส่ (สัดส่วนตามจำนวนงาน) */
function CoverageBar({ s }) {
  const n = s.withValue + s.wholeCount + s.missing;
  if (!n) return null;
  const parts = [[s.withValue, ACCENT], [s.wholeCount, WARN], [s.missing, "#cbd5e1"]].filter(([c]) => c);
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ mt: 1.1, px: 0.25 }}>
      <Box sx={{ flex: 1, display: "flex", gap: "2px", height: 6, borderRadius: 3, overflow: "hidden" }}>
        {parts.map(([c, color]) => <Box key={color} sx={{ flex: c, bgcolor: color }} />)}
      </Box>
      <Typography sx={{ flexShrink: 0, fontSize: "0.72rem", color: MUTED, ...NUM }}>
        ใส่มูลค่าครั้งนี้แล้ว <b style={{ color: INK }}>{s.withValue}/{n}</b> งาน ({Math.round((s.withValue / n) * 100)}%)
      </Typography>
    </Stack>
  );
}

/**
 * กล่องสรุปมูลค่า (แอดมิน/ผู้จัดการ)
 * @param s            valueSummary { total, withValue, wholeTotal, wholeCount, missing, own, ownCount, jobs, items }
 * @param periodText   ช่วงที่กำลังดู เช่น "ทุกเดือน" / "11/2569"
 * @param member       ชื่อผู้ปฏิบัติงานที่กรองอยู่ ("" = ทุกคน)
 * @param onOpenDetail (filter) => void — "all" | "whole" | "counted"
 */
export function WorkValueSummaryCard({ s, periodText, member, onOpenDetail }) {
  const period = periodText ? ` · ${periodText}` : "";
  if (member) {
    const notYet = s.jobs - s.ownCount;
    return (
      <Box sx={{ mb: 1.5, px: 2, py: 1.25, borderRadius: 3, bgcolor: "#fff", border: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED }}>ผลงานของ {member} · ยอดที่ลงเอง (ก่อน VAT){period}</Typography>
          <Typography noWrap sx={{ fontSize: "1.35rem", fontWeight: 900, color: INK, lineHeight: 1.25, ...NUM }}>{baht(s.own)}</Typography>
        </Box>
        <Stack direction="row" gap={2} sx={{ fontSize: "0.8rem", color: "#334155", flexWrap: "wrap" }}>
          <span>ลงแล้ว <b>{s.ownCount}</b> งาน</span>
          {notYet > 0 && <span style={{ color: WARN }}>ยังไม่ลง <b>{notYet}</b> งาน</span>}
          {s.ownCount > 0 && <span>เฉลี่ย <b>{baht(s.own / s.ownCount)}</b> / งาน</span>}
        </Stack>
      </Box>
    );
  }
  const jobs = s.withValue + s.wholeCount + s.missing;
  return (
    <Box sx={{ mb: 1.5, p: { xs: 1.25, sm: 1.5 }, borderRadius: 3, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1, px: 0.25 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "baseline" }, columnGap: 0.75 }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>มูลค่าครั้งนี้ของงาน</Typography>
          <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>ก่อน VAT{period} · {jobs} งาน</Typography>
        </Box>
        {s.items.length > 0 && (
          <ButtonBase onClick={() => onOpenDetail("all")} sx={{ flexShrink: 0, px: 1, py: 0.5, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 800, color: ACCENT, "&:hover": { bgcolor: alpha(ACCENT, 0.06) } }}>
            แจกแจงที่มา<ChevronRightRounded sx={{ fontSize: 17 }} />
          </ButtonBase>
        )}
      </Stack>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "1.4fr 1fr 1fr" } }}>
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
          <Tile icon={CheckCircleRounded} tone={ACCENT} label="มูลค่าครั้งนี้ · นับแล้ว" value={baht(s.total)}
            sub={s.withValue ? `${s.withValue} งาน · เฉลี่ย ${baht(s.total / s.withValue)} / งาน` : "ยังไม่มีงานที่นับได้"}
            onClick={s.withValue ? () => onOpenDetail("counted") : undefined} />
        </Box>
        <Tile icon={ErrorRounded} tone={WARN} label="ใส่เท่ามูลค่างานรวม" value={s.wholeCount ? baht(s.wholeTotal) : "—"}
          sub={s.wholeCount ? `${s.wholeCount} งาน · ไม่นับ ต้องตรวจ` : "ไม่มี"} onClick={s.wholeCount ? () => onOpenDetail("whole") : undefined} />
        <Tile icon={RadioButtonUncheckedRounded} tone={GRAY} label="ยังไม่ใส่" value={`${s.missing} งาน`} sub="ยังไม่มีมูลค่าครั้งนี้" />
      </Box>
      <CoverageBar s={s} />
    </Box>
  );
}

/**
 * แผ่นแจกแจงที่มาของยอด
 * @param filter    "all" | "whole" | "counted" (null = ปิด)
 * @param onFilter  เปลี่ยนตัวกรอง
 * @param onOpenJob (eventId) => void
 */
export function WorkValueSourceSheet({ filter, onFilter, onClose, s, periodText, onOpenJob, employees = [] }) {
  const open = !!filter;
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
  const FILTERS = [["all", "ทั้งหมด", s.items.length], ["whole", "ต้องตรวจ", s.wholeCount], ["counted", "นับแล้ว", s.withValue]];

  return (
    <MobileSheet open={open} onClose={onClose} maxWidth="md" title="แจกแจงมูลค่าครั้งนี้"
      subtitle={`งานไหน เท่าไร มาจากไหน${periodText ? ` · ${periodText}` : ""} · กดงานเพื่อเปิดไปแก้`}>
      <Box sx={{ p: { xs: 1.25, sm: 2 } }}>
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 1fr", mb: 1.25 }}>
          <Tile icon={CheckCircleRounded} tone={ACCENT} label="มูลค่าครั้งนี้ · นับแล้ว" value={baht(s.total)} sub={`${s.withValue} งาน`} />
          <Tile icon={ErrorRounded} tone={WARN} label="ใส่เท่ามูลค่างานรวม" value={s.wholeCount ? baht(s.wholeTotal) : "—"} sub={s.wholeCount ? `${s.wholeCount} งาน · ไม่นับ` : "ไม่มี"} />
        </Box>

        {bySource.length > 0 && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>ยอดที่นับ มาจากไหน</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 1 }}>รวม {baht(s.total)} จาก {s.withValue} งาน</Typography>
            <Stack spacing={1}>
              {bySource.map((r) => {
                const pct = s.total ? (r.total / s.total) * 100 : 0;
                const auto = r.key === "job";
                return (
                  <Box key={r.key || "none"}>
                    <Stack direction="row" alignItems="baseline" gap={1}>
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.79rem", color: auto ? WARN : "#334155", fontWeight: 700 }}>{r.label}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...NUM }}>{r.count} งาน</Typography>
                      <Typography sx={{ minWidth: 96, textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: INK, ...NUM }}>{baht(r.total)}</Typography>
                      <Typography sx={{ width: 38, textAlign: "right", fontSize: "0.72rem", color: MUTED, ...NUM }}>{Math.round(pct)}%</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.45, height: 6, borderRadius: 3, bgcolor: "#eef2f7", overflow: "hidden" }}>
                      <Box sx={{ width: `${Math.max(pct, 1.5)}%`, height: "100%", bgcolor: auto ? alpha(WARN, 0.55) : alpha(ACCENT, 0.55), borderRadius: 3 }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        <Stack direction="row" gap={0.75} sx={{ mb: 1, flexWrap: "wrap" }}>
          {FILTERS.map(([k, label, count]) => {
            const on = filter === k;
            const tone = k === "whole" ? WARN : INK;
            return (
              <ButtonBase key={k} onClick={() => onFilter(k)} disabled={!count && k !== "all"}
                sx={{ gap: 0.6, px: 1.4, py: 0.55, borderRadius: 99, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 800,
                  color: on ? "#fff" : k === "whole" ? WARN : "#475569", bgcolor: on ? tone : k === "whole" ? alpha(WARN, 0.08) : "#f1f5f9",
                  opacity: !count && k !== "all" ? 0.45 : 1 }}>
                {label}<Box component="span" sx={{ fontWeight: 900, ...NUM }}>{count}</Box>
              </ButtonBase>
            );
          })}
        </Stack>
        {people.length > 1 && (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1, overflowX: "auto", pb: 0.25, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            <Typography sx={{ flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, color: MUTED, mr: 0.25 }}>ผู้ลงมูลค่า</Typography>
            {people.map((p) => {
              const on = who === p.key;
              return (
                <ButtonBase key={p.key || "none"} onClick={() => setWho(on ? null : p.key)}
                  sx={{ flexShrink: 0, gap: 0.6, pl: 0.4, pr: 1, py: 0.35, borderRadius: 99, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 700,
                    color: on ? ACCENT : "#334155", bgcolor: on ? alpha(ACCENT, 0.08) : "#fff", border: `1px solid ${on ? alpha(ACCENT, 0.5) : LINE}`,
                    transition: "all .15s ease" }}>
                  <ByAvatar name={p.name} src={p.src} size={22} />
                  <span>{p.name ? p.name.split(" ")[0] : "ไม่ทราบ"}</span>
                  <Box component="span" sx={{ fontWeight: 900, color: on ? ACCENT : MUTED, ...NUM }}>{p.count}</Box>
                </ButtonBase>
              );
            })}
          </Stack>
        )}
        {items.some((it) => it.whole) && (
          <Box sx={{ mb: 1, px: 1.25, py: 0.9, borderRadius: 2, bgcolor: alpha(WARN, 0.06), border: `1px solid ${alpha(WARN, 0.18)}` }}>
            <Typography sx={{ fontSize: "0.75rem", color: WARN, lineHeight: 1.55 }}>
              <b>ต้องตรวจ</b> = มูลค่าครั้งนี้ที่ใส่ไว้เท่ากับมูลค่างานรวมทั้งงาน (มักถูกเติมจากมูลค่างานรวม) จึงไม่นับเป็นมูลค่าครั้งนี้
              — กดงานเพื่อแก้เป็นยอดของครั้งนี้ หรือล้างค่า · ถ้างานนั้นเข้าครั้งเดียวจริง ยอดถูกต้องแล้ว ไม่ต้องแก้
            </Typography>
          </Box>
        )}

        <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, overflow: "hidden" }}>
          {!items.length && <Typography sx={{ p: 2, textAlign: "center", fontSize: "0.84rem", color: FAINT }}>ไม่มีรายการ</Typography>}
          {items.map((it, i) => {
            const warn = it.whole || it.source === "job";
            const p = personOf(it.by);
            return (
              <ButtonBase key={it.id} component="div" onClick={() => onOpenJob(it.id)}
                sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", pl: 1.25, pr: 0.75, py: 1.15, textAlign: "left", fontFamily: "inherit",
                  borderTop: i ? `1px solid ${LINE}` : 0, borderLeft: `3px solid ${it.whole ? WARN : "transparent"}`,
                  transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fafc" } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* บรรทัด 1: โครงการ · ยอด */}
                  <Stack direction="row" alignItems="baseline" gap={1}>
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.88rem", fontWeight: 800, color: INK }}>{it.site}</Typography>
                    <Typography sx={{ flexShrink: 0, fontSize: "0.92rem", fontWeight: 900, color: it.whole ? WARN : INK, ...NUM }}>{baht(it.value)}</Typography>
                  </Stack>
                  {/* บรรทัด 2: งาน · วันที่ · เทียบมูลค่างานรวม */}
                  <Stack direction="row" alignItems="baseline" gap={1}>
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", color: MUTED }}>
                      {[it.title, thaiDate(it.start), it.sessions > 1 ? `${it.sessions} ช่วงวัน · นับครั้งเดียว` : ""].filter(Boolean).join(" · ")}
                    </Typography>
                    {it.whole
                      ? <Typography noWrap sx={{ flexShrink: 0, fontSize: "0.68rem", fontWeight: 800, color: WARN }}>= มูลค่างานรวม · ไม่นับ</Typography>
                      : it.total !== null && <Typography noWrap sx={{ flexShrink: 0, fontSize: "0.68rem", color: MUTED, ...NUM }}>มูลค่างานรวม {baht(it.total)}</Typography>}
                  </Stack>
                  {/* บรรทัด 3: ผู้ลง (รูป + ชื่อ + วันที่ลง) · ที่มาของยอด */}
                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.75 }}>
                    <ByAvatar name={p?.name} src={p?.src} size={22} />
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.75rem", fontWeight: 700, color: p?.name ? "#334155" : FAINT }}>
                      {p?.name || "ไม่ทราบผู้ลง"}
                      {it.at && <Box component="span" sx={{ fontWeight: 400, color: FAINT }}> · ลง {thaiDate(it.at)}</Box>}
                    </Typography>
                    <Box component="span" sx={{ flexShrink: 0, px: 0.8, py: 0.15, borderRadius: "6px", fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap",
                      color: warn ? WARN : "#475569", bgcolor: warn ? alpha(WARN, 0.1) : "#f1f5f9" }}>
                      {SOURCE_SHORT[sourceKey(it.source)]}
                    </Box>
                  </Stack>
                </Box>
                <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1", flexShrink: 0 }} />
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
    </MobileSheet>
  );
}
