/**
 * WorkValueSummary — กล่องสรุปมูลค่า (หน้าการดำเนินงาน) + แผ่นแจกแจงที่มาของยอด
 *
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "ทำไมยอดเยอะขนาดนี้" → "ควรบอกว่ามูลค่ารวม ไม่ใช่มูลค่าครั้งนี้" →
 *    "หรือแจกแจงให้ละเอียดกว่านี้ ปรับการแสดงผลให้ดูง่าย จัดวางให้สวยงามของสีสันต่างๆ")
 *    กล่องสรุป 3 ช่อง: มูลค่าครั้งนี้ (นับแล้ว) · ใส่เท่ามูลค่างานรวม (ต้องตรวจ · ไม่นับ) · ยังไม่ใส่
 *    + แถบความครบ (กี่งานใส่มูลค่าครั้งนี้แล้ว)
 *    แผ่นแจกแจง: แยกตามที่มาของยอด (แถบสัดส่วน) · กรอง ทั้งหมด/ต้องตรวจ/นับแล้ว · รายการงานกดเปิดไปแก้ได้
 *    สี: ตัวเลขสีเข้ม · น้ำเงิน = นับแล้ว/ปุ่ม · ส้ม = ต้องตรวจ · เทา = ยังไม่ใส่
 *
 * ข้อมูลมาจาก valueSummary ของ OperationBoard (นับงานละครั้ง · งานหลายช่วงวันนับครั้งเดียว)
 */
import { useMemo } from "react";
import moment from "moment";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRightRounded, ErrorRounded, CheckCircleRounded, RadioButtonUncheckedRounded } from "@mui/icons-material";
import MobileSheet from "@/shared/ui/MobileSheet";
import { INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";

const WARN = "#b45309";
const GRAY = "#64748b";
const FAINT = "#94a3b8";
const NUM = { fontVariantNumeric: "tabular-nums" };
const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

/** ที่มาของยอด (workValueSource) — ลำดับ = ลำดับในแผ่นแจกแจง */
export const VALUE_SOURCES = [
  { key: "manual", label: "ลงเอง" },
  { key: "contract", label: "มูลค่าสัญญา ÷ จำนวนครั้ง" },
  { key: "quotation", label: "ยอดใบเสนอราคาที่ได้งาน" },
  { key: "ai", label: "AI อ่านจากไฟล์" },
  { key: "job", label: "มูลค่างานรวม (เติมอัตโนมัติ)" },
  { key: "workers", label: "ระบบรวมจากรายคน (ข้อมูลเดิม)" },
  { key: "", label: "ไม่ทราบที่มา (ข้อมูลเดิม)" },
];
const SOURCE_LABEL = Object.fromEntries(VALUE_SOURCES.map((s) => [s.key, s.label]));
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
export function WorkValueSourceSheet({ filter, onFilter, onClose, s, periodText, onOpenJob }) {
  const open = !!filter;
  // มูลค่าครั้งนี้ที่นับ แยกตามที่มา
  const bySource = useMemo(() => {
    const m = new Map(VALUE_SOURCES.map((x) => [x.key, { ...x, count: 0, total: 0 }]));
    s.items.filter((it) => !it.whole).forEach((it) => {
      const r = m.get(sourceKey(it.source));
      r.count += 1; r.total += it.value;
    });
    return [...m.values()].filter((r) => r.count).sort((a, b) => b.total - a.total);
  }, [s.items]);
  const items = s.items.filter((it) => (filter === "whole" ? it.whole : filter === "counted" ? !it.whole : true));
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
        {filter !== "counted" && s.wholeCount > 0 && (
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
            return (
              <ButtonBase key={it.id} component="div" onClick={() => onOpenJob(it.id)}
                sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, width: "100%", pl: 1.25, pr: 1, py: 1.1, textAlign: "left", fontFamily: "inherit",
                  borderTop: i ? `1px solid ${LINE}` : 0, borderLeft: `3px solid ${it.whole ? WARN : "transparent"}`,
                  transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fafc" } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>{it.site}</Typography>
                  <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>
                    {[it.title, it.start ? moment(it.start).add(543, "year").format("D/M/YY") : "", it.sessions > 1 ? `${it.sessions} ช่วงวัน · นับครั้งเดียว` : ""].filter(Boolean).join(" · ")}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.45, flexWrap: "wrap" }}>
                    <Box component="span" sx={{ px: 0.8, py: 0.1, borderRadius: "6px", fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap",
                      color: warn ? WARN : "#475569", bgcolor: warn ? alpha(WARN, 0.1) : "#f1f5f9" }}>
                      {SOURCE_LABEL[sourceKey(it.source)]}
                    </Box>
                    {it.by && <Typography component="span" noWrap sx={{ fontSize: "0.7rem", color: FAINT }}>โดย {it.by}</Typography>}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 900, color: it.whole ? WARN : INK, ...NUM }}>{baht(it.value)}</Typography>
                  {it.whole
                    ? <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: WARN }}>= มูลค่างานรวม · ไม่นับ</Typography>
                    : it.total !== null && <Typography sx={{ fontSize: "0.68rem", color: MUTED, ...NUM }}>มูลค่างานรวม {baht(it.total)}</Typography>}
                </Box>
                <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1", mt: 0.25 }} />
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
    </MobileSheet>
  );
}
