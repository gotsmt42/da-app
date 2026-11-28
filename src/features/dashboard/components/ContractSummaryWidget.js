/**
 * ContractSummaryWidget — สรุป "ภาพรวมงาน" (สัญญา) บนหน้าแรก
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ทำหน้า dashboard ให้แสดงข้อมูลในส่วนของภาพรวมงานด้วยที่จำเป็น ชัดเจนและดูง่าย")
 *    4 ตัวเลขที่ต้องรู้ทุกวัน (กดแล้วเปิดหน้า/มุมมองนั้นตรงๆ) + รายการ "ต้องระวัง" (เลยกำหนด · ใกล้ถึงกำหนด · ยังไม่ลงแผนงาน · ใกล้หมดสัญญา)
 *      ① ต้องเข้าเดือนนี้ (ตามแผนงานทั้งปี) — ลงตารางแล้ว / ยังไม่ลง
 *      ② ต้องนัดรอบถัดไป (เลยกำหนด/ถึงรอบ — ตัวเดียวกับป้ายเตือนในหน้าภาพรวมงาน)
 *      ③ ใกล้หมดอายุ  ④ รอต่อสัญญา (หมดอายุแล้วยังไม่ต่อ)
 *    + แผนที่ส่งลูกค้าแล้วแต่ลงงานไม่ตรง (ถ้ามี)
 *    ตัวเลขทุกตัวคำนวณจากของกลางชุดเดียวกับหน้าภาพรวมงาน/แผนงานทั้งปี — ไม่มีสูตรแยก
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { ChevronRightRounded as ChevronRight, NotificationsActiveRounded, CheckCircleRounded } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { contractStatusInfo, renewalMap } from "@/shared/utils/contractOverdue";
import { buildContractPlan, suggestFirstMonth, monthKeyOf, monthDiff, sentPlanOf, adherenceOf, thaiMonthLabel, isMonthKey } from "@/shared/utils/contractPlan";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, CARD_SHADOW } from "@/shared/ui/PageKit";
import useElementWidth from "@/shared/hooks/useElementWidth";
import { Loading } from "./DashWidgets";

const WARN = "#b45309";
const DANGER = "#dc2626";
const NUM = { fontVariantNumeric: "tabular-nums" };
const CARD = { bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW, overflow: "hidden" };
/** สีตัวท้ายแถว — สีเฉพาะที่มีความหมาย (เหลือไม่กี่วัน = แดง) ที่เหลือเทา */
const TAIL_COLOR = { hot: DANGER, quiet: FAINT };
/** โทนของกลุ่มเตือน: จุด · พื้นป้ายจำนวน (อ่อน) · ตัวเลขในป้าย */
const TONE_RED = { dot: "#ef4444", tint: "#fef2f2", ink: "#b91c1c" };
const TONE_AMBER = { dot: "#f59e0b", tint: "#fff7e6", ink: "#b45309" };

/**
 * ตัวเลขหลัก 1 ช่อง — หน้าตาเดียวกับการ์ด "ภาพรวมผลงาน" (DesktopOverview.KpiTile) · กดเปิดมุมมองนั้นตรงๆ
 * 🔁 (28 พ.ย. 2569 ผู้ใช้: "สีสันต่างๆ ให้มองง่าย…ดูรกๆ") hover สีน้ำเงินระบบทุกใบ (เดิมคนละสี/มีม่วง)
 *    บรรทัดล่างเทา — ลงสีเฉพาะคำที่ต้องดู (เหลือ N / เลยกำหนด N) ไม่ทาทั้งบรรทัด
 */
const Tile = ({ to, label, value, unit, sub }) => (
  <ButtonBase component={Link} to={to} sx={{
    ...CARD, display: "block", textAlign: "left", p: 2, fontFamily: "inherit", textDecoration: "none", color: "inherit", minWidth: 0,
    transition: "border-color .15s ease, box-shadow .15s ease", "&:hover": { borderColor: alpha(ACCENT, 0.45), boxShadow: `0 8px 20px -14px ${alpha(ACCENT, 0.6)}` },
  }}>
    <Stack direction="row" alignItems="center">
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
      <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1" }} />
    </Stack>
    <Typography noWrap sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem" }, fontWeight: 900, color: value ? INK : FAINT, lineHeight: 1.25, ...NUM }}>
      {value} <Box component="span" sx={{ fontSize: "0.6em", fontWeight: 800, color: value ? INK_2 : FAINT }}>{unit}</Box>
    </Typography>
    <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED, minHeight: 18, lineHeight: 1.45, ...NUM }}>{sub}</Typography>
  </ButtonBase>
);

/** คำที่ต้องดูในบรรทัดล่างของ Tile */
const Hl = ({ color, children }) => <Box component="span" sx={{ color, fontWeight: 800 }}>{children}</Box>;

/**
 * กลุ่มเตือน 1 คอลัมน์ — หัว (จุดสี · ชื่อ · จำนวน) + รายการแถวละสัญญา (ชื่อ / เลขสัญญา · สถานะชิดขวา)
 * 🔁 (28 พ.ย. 2569 ผู้ใช้: "การจัดวาง สีสันต่างๆ ให้มองง่าย และสวยงามกว่านี้ ดูรกๆ")
 *    เดิมเป็นชิปกองต่อกัน ความยาวไม่เท่ากัน ตัดชื่อกลางคำ ชื่อซ้ำแยกไม่ออก → เปลี่ยนเป็นรายการแนวตั้งแบบการ์ด "ผลงานรายคน"
 *    สีอยู่ที่จุดหน้าหัวกลุ่มจุดเดียว · แถวสีเทา · เห็น N แถวแรก ที่เหลือกด "ดูอีก" (เลื่อนในคอลัมน์ ไม่ดันหน้ายาว)
 * 🔁 (28 พ.ย. 2569 ผู้ใช้: "หัวข้อต่างๆ ดูกลมกลืนไป สังเกตได้ยาก และไม่เอาแบบเข้มๆ รกๆ")
 *    หัวกลุ่มเป็นแถบพื้นเทาอ่อน (ต่างจากแถวรายการพื้นขาว) · จำนวนเป็นป้ายสีอ่อนของกลุ่ม · ไม่มีพื้นสีเข้ม/ตัวหนาทั้งแถบ
 */
function WatchColumn({ group, limit, open, onToggle, sx }) {
  const rows = open ? group.list : group.list.slice(0, limit);
  const more = group.list.length - limit;
  return (
    <Box sx={{ bgcolor: "#fff", display: "flex", flexDirection: "column", minWidth: 0, ...sx }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.1, bgcolor: SURFACE }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: group.dot, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>{group.label}</Typography>
          <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED }}>{group.hint}</Typography>
        </Box>
        <Box component="span" sx={{ minWidth: 30, height: 24, px: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 99,
          bgcolor: group.tint, color: group.ink, fontSize: "0.82rem", fontWeight: 800, ...NUM }}>
          {group.list.length}
        </Box>
      </Stack>
      <Box sx={{ flex: 1, ...(open ? { maxHeight: 400, overflowY: "auto" } : null) }}>
        {rows.map(({ c, tail, tip, tone }) => {
          const name = c.site || c.company || c.contractNo || "สัญญา";
          const sub = [c.contractNo, c.company && c.company !== name ? c.company : null].filter(Boolean).join(" · ");
          return (
            <ButtonBase key={c.key} component={Link} to={`/contracts?find=${encodeURIComponent(c.key)}`}
              title={[name, c.contractNo, c.company, tip].filter(Boolean).join(" · ")}
              sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%", px: 2, py: 0.85, textAlign: "left", fontFamily: "inherit",
                textDecoration: "none", color: "inherit", borderTop: `1px solid ${LINE}`, transition: "background-color .15s ease", "&:hover": { bgcolor: SURFACE } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK_2 }}>{name}</Typography>
                <Typography noWrap sx={{ fontSize: "0.7rem", color: FAINT }}>{sub || "ไม่มีเลขสัญญา"}</Typography>
              </Box>
              <Typography sx={{ flexShrink: 0, fontSize: "0.74rem", fontWeight: 700, color: TAIL_COLOR[tone] || MUTED, whiteSpace: "nowrap", ...NUM }}>{tail}</Typography>
            </ButtonBase>
          );
        })}
      </Box>
      {more > 0 && (
        <ButtonBase onClick={onToggle} sx={{ justifyContent: "flex-start", gap: 0.25, px: 2, py: 0.9, borderTop: `1px solid ${LINE}`, fontFamily: "inherit",
          fontSize: "0.78rem", fontWeight: 800, color: ACCENT, "&:hover": { bgcolor: ACCENT_SOFT } }}>
          {open ? "ย่อรายการ" : <>ดูอีก {more} สัญญา<ChevronRight sx={{ fontSize: 17 }} /></>}
        </ButtonBase>
      )}
    </Box>
  );
}

/**
 * @param contracts สัญญาจริง (groupEventsByContract → isRealContract) ตามสิทธิ์ของผู้ใช้
 * @param overdue   รายการ overdueContracts ของหน้าแรก (มี overdueInfo)
 */
export default function ContractSummaryWidget({ contracts = [], overdue = [], loading = false }) {
  // ✅ (26 พ.ย. 2569 ผู้ใช้: "ให้ดูถึงข้อมูลงานที่มีเยอะๆ ด้วยนะ แบบนี้จะรก") งานเยอะ = โชว์ 5 แถวแรกต่อกลุ่ม (มือถือ 3) + "ดูอีก N"
  const [expanded, setExpanded] = useState({});
  const [boxRef, width] = useElementWidth();
  const data = useMemo(() => {
    const nowKey = monthKeyOf(new Date());
    const renewalOf = renewalMap(contracts);
    const prevOf = new Map();
    renewalOf.forEach((next, key) => { const prev = contracts.find((x) => x.key === key); if (prev) prevOf.set(next.key, prev); });
    const status = (c) => contractStatusInfo(c);
    const live = contracts.filter((c) => status(c)?.state !== "expired");
    const expiring = live.filter((c) => status(c)?.state === "expiring" && !renewalOf.has(c.key));
    const awaiting = contracts.filter((c) => status(c)?.state === "expired" && !renewalOf.has(c.key));
    /**
     * 🔁 (26 พ.ย. 2569 ผู้ใช้: "ลงตารางแล้วไม่ต้องเอามาแสดง ให้เอาแค่งานที่ใกล้หมดสัญญา หรือเลยกำหนดเข้า หรือใกล้ถึงกำหนด เพื่อเตือนไม่ให้ผิดพลาด")
     *    รายการเตือน 3 กลุ่ม (สัญญาละ 1 ครั้ง ไม่ซ้ำ):
     *      เลยกำหนดเข้า   = ป้ายเตือนรอบเข้างานของระบบ (เลยกำหนด) + แผนที่บันทึกไว้ที่เลยเดือนแล้วยังไม่ลงตาราง
     *      ใกล้ถึงกำหนด   = ถึงรอบเดือนนี้/เดือนหน้า + แผนที่บันทึกไว้ของเดือนนี้ที่ยังไม่ลงตาราง
     *      ใกล้หมดสัญญา   = เหลือไม่ถึงเกณฑ์วันเตือน และยังไม่ต่อสัญญา
     *    ⚠️ แผนที่ยังเป็น "ค่าประมาณ" (ไม่ได้บันทึกเดือนครั้งที่ 1) ไม่นับ — กันเตือนผิดจากเดือนที่ระบบเดา
     */
    const late = [];
    const soon = [];
    const seen = new Set();
    overdue.forEach((c) => {
      const i = c.overdueInfo;
      (i.state === "overdue" ? late : soon).push({ c, tail: i.shortLabel || i.dueMonthLabel, tip: `${i.roundLabel} · ต้องเข้า ${i.dueMonthLabel}` });
      seen.add(c.key);
    });
    const thisMonth = [];
    let planProblems = 0;
    live.forEach((c) => {
      const plan = buildContractPlan(c, suggestFirstMonth(c, { prev: prevOf.get(c.key) || null }).month);
      plan.rounds.forEach((r) => { if ((r.actualMonth || r.month) === nowKey) thisMonth.push(r); });
      if (adherenceOf(plan, sentPlanOf(c)).counts.problem > 0) planProblems += 1;
      if (!isMonthKey(c.planFirstMonth) || seen.has(c.key)) return;
      const r = plan.rounds.find((x) => x.state === "overdue") || plan.rounds.find((x) => x.state === "due");
      if (!r) return;
      (r.state === "overdue" ? late : soon).push({ c, tail: `${r.inYear}/${plan.per} · ${thaiMonthLabel(r.month)}`, tip: `ครั้งที่ ${r.label} ตามแผน ยังไม่ลงตาราง` });
      seen.add(c.key);
    });
    /**
     * ✅ (27 พ.ย. 2569 ผู้ใช้: "เพิ่มสัญญาที่ยังไม่ลงแผนงานด้วยให้สมบูรณ์") สัญญาที่ยังไม่มีครั้งไหนลงตารางเลย
     *    ป้ายเตือนรอบเข้างานของระบบนับจากครั้งล่าสุดที่เข้า — สัญญาที่ยังไม่เคยลงสักครั้งจึงไม่เคยถูกเตือน (หลุดได้)
     *    ท้ายแถว = เดือนเริ่มสัญญา (ยังไม่ถึงวันเริ่ม = สีจาง) · เรียงจากวันเริ่มเก่าสุด
     */
    const unplanned = live
      .filter((c) => !seen.has(c.key) && !(c.visits || []).some((v) => !v.unscheduled && v.start))
      .map((c) => {
        const startKey = monthKeyOf(c.contractStart);
        const started = !startKey || monthDiff(startKey, nowKey) >= 0;
        return {
          c, startKey,
          // หัวคอลัมน์บอก "ยังไม่ลงแผนงาน" แล้ว — ท้ายแถวบอกเดือนเริ่มสัญญาแทนคำซ้ำทุกแถว (ยังไม่ถึงวันเริ่ม = สีจาง)
          tone: started ? undefined : "quiet",
          tail: startKey ? `เริ่ม ${thaiMonthLabel(startKey)}` : "ไม่ระบุวันเริ่ม",
          tip: "สัญญานี้ยังไม่มีครั้งไหนลงตารางเลย",
        };
      })
      .sort((x, y) => String(x.startKey || "").localeCompare(String(y.startKey || "")));
    const ending = expiring.map((c) => {
      const left = status(c)?.daysLeft;
      return { c, tail: `เหลือ ${left ?? "-"} วัน`, tone: left != null && left <= 7 ? "hot" : undefined, tip: "ใกล้หมดสัญญา — ควรเสนอราคาต่อสัญญา" };
    })
      .sort((x, y) => (status(x.c)?.daysLeft ?? 0) - (status(y.c)?.daysLeft ?? 0));
    const booked = thisMonth.filter((r) => r.visits.length > 0).length;
    return { nowKey, live, expiring, awaiting, late, soon, unplanned, ending, thisMonth: thisMonth.length, booked, planProblems };
  }, [contracts, overdue]);

  const overdueNow = overdue.filter((c) => c.overdueInfo.state === "overdue").length;
  const dueNow = overdue.filter((c) => c.overdueInfo.state === "due_now").length;
  // สีจุดหัวกลุ่ม: แดง = เลยกำหนด (อันตรายจริง) · ส้ม = ต้องจัดการเร็วๆ นี้ — ไม่มีสีอื่น
  const groups = [
    { key: "late", label: "เลยกำหนดเข้า", hint: "ต้องนัดเข้าโดยเร็ว", list: data.late, ...TONE_RED },
    { key: "soon", label: "ใกล้ถึงกำหนด", hint: "ถึงรอบเดือนนี้ / เดือนหน้า", list: data.soon, ...TONE_AMBER },
    { key: "unplanned", label: "ยังไม่ลงแผนงาน", hint: "ยังไม่มีครั้งไหนลงตาราง", list: data.unplanned, ...TONE_AMBER },
    { key: "ending", label: "ใกล้หมดสัญญา", hint: "ควรเสนอราคาต่อสัญญา", list: data.ending, ...TONE_AMBER },
  ].filter((g) => g.list.length);
  const notBooked = data.thisMonth - data.booked;

  // คอลัมน์ตามความกว้างจริงของการ์ด (จอคอม 4 · แท็บเล็ต 2 · มือถือ 1) — 4 กลุ่มแต่พอแค่ 3 ใช้ 2×2 ให้สมดุล
  const fit = Math.max(1, Math.floor((width || 0) / 250));
  const cols = !width ? Math.min(groups.length, 2) || 1 : fit >= groups.length ? groups.length : Math.min(fit, 2);
  const limit = cols === 1 ? 3 : 5;
  const rest = groups.length % cols;

  // 🔁 (26 พ.ย. 2569 ผู้ใช้: "ตรงนี้ให้ชิดขอบเหมือนตัวอื่นๆ ด้วย ด้านข้าง") จัดแบบเดียวกับ "ภาพรวมผลงาน":
  //    หัวส่วน → การ์ดตัวเลข 4 ใบชิดขอบซ้าย-ขวาเต็มแนว → การ์ด "ต้องระวัง" (หัวการ์ดแบบเดียวกับ สถานะงาน/ผลงานรายคน)
  return (
    <Box sx={{ mb: 2.5, px: { xs: 1.5, sm: 0 } }}>
      <Stack direction="row" alignItems="flex-end" gap={2} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.3rem", fontWeight: 900, color: INK }}>ภาพรวมงานสัญญา</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {loading ? "กำลังโหลด…" : `${data.live.length} สัญญาที่ใช้งาน · สิ่งที่ต้องทำเดือน${thaiMonthLabel(data.nowKey, { full: true }).split(" ")[0]}`}
          </Typography>
        </Box>
        <ButtonBase component={Link} to="/contracts" sx={{ gap: 0.25, px: 1, py: 0.5, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 800, color: ACCENT,
          textDecoration: "none", flexShrink: 0, "&:hover": { bgcolor: alpha(ACCENT, 0.06) } }}>
          เปิดภาพรวมงาน<ChevronRight sx={{ fontSize: 17 }} />
        </ButtonBase>
      </Stack>
      {loading ? <Box sx={CARD}><Loading rows={3} /></Box> : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5, mb: 1.5 }}>
            <Tile to="/contracts?plan=year&month=now" label="ต้องเข้าเดือนนี้" value={data.thisMonth} unit="งาน"
              sub={data.thisMonth ? <>ลงแล้ว {data.booked} · {notBooked ? <Hl color={WARN}>เหลือ {notBooked}</Hl> : "ครบแล้ว"}</> : "ไม่มีรอบเข้าเดือนนี้"} />
            <Tile to="/contracts?view=overdue" label="ต้องนัดรอบถัดไป" value={overdue.length} unit="สัญญา"
              sub={overdue.length ? <>{overdueNow ? <Hl color={DANGER}>เลยกำหนด {overdueNow}</Hl> : "เลยกำหนด 0"} · เดือนนี้ {dueNow}</> : "ไม่มีรอบค้าง"} />
            <Tile to="/contracts?status=expiring" label="ใกล้หมดอายุ" value={data.expiring.length} unit="สัญญา"
              sub={data.expiring.length ? "ควรเสนอราคาต่อ" : "ไม่มีสัญญาใกล้หมด"} />
            <Tile to="/contracts?view=expired" label="รอต่อสัญญา" value={data.awaiting.length} unit="สัญญา"
              sub={data.awaiting.length ? "หมดอายุ ยังไม่ต่อ" : "ไม่มีค้างต่อ"} />
          </Box>
          <Box ref={boxRef} sx={CARD}>
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.08), color: ACCENT, flexShrink: 0 }}>
                <NotificationsActiveRounded sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 800, color: INK }}>ต้องระวัง</Typography>
                <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>
                  <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>สัญญาที่ต้องจัดการก่อนพลาด · </Box>กดชื่อเพื่อดูในตารางภาพรวมงาน
                </Typography>
              </Box>
              <ButtonBase component={Link} to="/contracts?plan=year" sx={{ gap: 0.25, px: 1, py: 0.5, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 800, color: ACCENT,
                textDecoration: "none", flexShrink: 0, "&:hover": { bgcolor: alpha(ACCENT, 0.06) } }}>
                แผนงานทั้งปี<ChevronRight sx={{ fontSize: 17 }} />
              </ButtonBase>
            </Stack>
            {groups.length ? (
              // เส้นคั่นคอลัมน์/แถว = ช่องว่าง 1px บนพื้นสีเส้น (ไม่ซ้อนกล่องในกล่อง) · แถวสุดท้ายที่ไม่เต็มยืดเต็มแนว
              <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: "1px", bgcolor: LINE }}>
                {groups.map((g, i) => (
                  <WatchColumn key={g.key} group={g} limit={limit} open={Boolean(expanded[g.key])}
                    onToggle={() => setExpanded((e) => ({ ...e, [g.key]: !e[g.key] }))}
                    sx={rest && i === groups.length - 1 ? { gridColumn: `span ${cols - rest + 1}` } : null} />
                ))}
              </Box>
            ) : (
              <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 2 }}>
                <CheckCircleRounded sx={{ fontSize: 22, color: "#16a34a" }} />
                <Box>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK_2 }}>ไม่มีสัญญาที่ต้องระวัง</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>ไม่มีงานเลยกำหนด ใกล้ถึงกำหนด ยังไม่ลงแผนงาน หรือใกล้หมดสัญญา</Typography>
                </Box>
              </Stack>
            )}
            {data.planProblems > 0 && (
              <ButtonBase component={Link} to="/contracts?plan=year" sx={{ display: "flex", justifyContent: "flex-start", gap: 1, width: "100%", px: 2, py: 0.9, borderTop: `1px solid ${LINE}`,
                bgcolor: SURFACE, fontFamily: "inherit", textDecoration: "none", textAlign: "left", "&:hover": { bgcolor: "#f1f5f9" } }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: DANGER, flexShrink: 0 }} />
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.76rem", fontWeight: 700, color: INK_2 }}>
                  แผนที่ส่งลูกค้าแล้ว ลงงานไม่ตรง <Hl color={DANGER}>{data.planProblems} สัญญา</Hl>
                </Typography>
                <Typography sx={{ display: "inline-flex", alignItems: "center", fontSize: "0.76rem", fontWeight: 800, color: ACCENT, whiteSpace: "nowrap" }}>
                  ดูแผนงานทั้งปี<ChevronRight sx={{ fontSize: 17 }} />
                </Typography>
              </ButtonBase>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
