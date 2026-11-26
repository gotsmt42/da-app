/**
 * ContractSummaryWidget — สรุป "ภาพรวมงาน" (สัญญา) บนหน้าแรก
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ทำหน้า dashboard ให้แสดงข้อมูลในส่วนของภาพรวมงานด้วยที่จำเป็น ชัดเจนและดูง่าย")
 *    4 ตัวเลขที่ต้องรู้ทุกวัน (กดแล้วเปิดหน้า/มุมมองนั้นตรงๆ) + รายการ "ต้องระวัง" (เลยกำหนด · ใกล้ถึงกำหนด · ใกล้หมดสัญญา)
 *      ① ต้องเข้าเดือนนี้ (ตามแผนงานทั้งปี) — ลงตารางแล้ว / ยังไม่ลง
 *      ② ต้องนัดรอบถัดไป (เลยกำหนด/ถึงรอบ — ตัวเดียวกับป้ายเตือนในหน้าภาพรวมงาน)
 *      ③ ใกล้หมดอายุ  ④ รอต่อสัญญา (หมดอายุแล้วยังไม่ต่อ)
 *    + แผนที่ส่งลูกค้าแล้วแต่ลงงานไม่ตรง (ถ้ามี)
 *    ตัวเลขทุกตัวคำนวณจากของกลางชุดเดียวกับหน้าภาพรวมงาน/แผนงานทั้งปี — ไม่มีสูตรแยก
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import { ChevronRightRounded as ChevronRight } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { contractStatusInfo, renewalMap } from "@/shared/utils/contractOverdue";
import { buildContractPlan, suggestFirstMonth, monthKeyOf, sentPlanOf, adherenceOf, thaiMonthLabel, isMonthKey } from "@/shared/utils/contractPlan";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE } from "@/shared/ui/PageKit";
import { Loading } from "./DashWidgets";

const MORE_SX = {
  display: "inline-flex", alignItems: "center", height: 28, px: 1.1, borderRadius: 1.5, cursor: "pointer", font: "inherit",
  fontSize: "0.76rem", fontWeight: 700, color: "#2563eb", bgcolor: "transparent", border: "1px dashed #cbd5e1", "&:hover": { bgcolor: "#eff6ff" },
};

const CARD = { bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" };

/** ตัวเลขหลัก 1 ช่อง — หน้าตาเดียวกับการ์ด "ภาพรวมผลงาน" (DesktopOverview) · กดเปิดมุมมองนั้นตรงๆ */
const Tile = ({ to, label, value, unit, sub, color, subColor }) => (
  <Box component={Link} to={to} sx={{
    ...CARD, display: "block", p: 2, textDecoration: "none", minWidth: 0,
    transition: "border-color .15s", "&:hover": { borderColor: alpha(color, 0.45) },
  }}>
    <Stack direction="row" alignItems="center">
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
      <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1" }} />
    </Stack>
    <Typography noWrap sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem" }, fontWeight: 900, color: value ? INK : FAINT, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>
      {value} {unit}
    </Typography>
    <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 600, color: subColor || MUTED, minHeight: 18, lineHeight: 1.45 }}>{sub}</Typography>
  </Box>
);

/**
 * @param contracts สัญญาจริง (groupEventsByContract → isRealContract) ตามสิทธิ์ของผู้ใช้
 * @param overdue   รายการ overdueContracts ของหน้าแรก (มี overdueInfo)
 */
export default function ContractSummaryWidget({ contracts = [], overdue = [], loading = false }) {
  // ✅ (26 พ.ย. 2569 ผู้ใช้: "ให้ดูถึงข้อมูลงานที่มีเยอะๆ ด้วยนะ แบบนี้จะรก") งานเยอะ = โชว์แค่ 8 ชิปแรกต่อกลุ่ม + "ดูทั้งหมด"
  const [expanded, setExpanded] = useState({});
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
    const ending = expiring.map((c) => ({ c, tail: `เหลือ ${status(c)?.daysLeft ?? "-"} วัน`, tip: "ใกล้หมดสัญญา — ควรเสนอราคาต่อสัญญา" }))
      .sort((x, y) => (status(x.c)?.daysLeft ?? 0) - (status(y.c)?.daysLeft ?? 0));
    const booked = thisMonth.filter((r) => r.visits.length > 0).length;
    return { nowKey, live, expiring, awaiting, late, soon, ending, thisMonth: thisMonth.length, booked, planProblems };
  }, [contracts, overdue]);

  const overdueNow = overdue.filter((c) => c.overdueInfo.state === "overdue").length;
  const dueNow = overdue.filter((c) => c.overdueInfo.state === "due_now").length;
  const groups = [
    { key: "late", label: "เลยกำหนดเข้า", list: data.late, dot: "#ef4444" },
    { key: "soon", label: "ใกล้ถึงกำหนด", list: data.soon, dot: "#f59e0b" },
    { key: "ending", label: "ใกล้หมดสัญญา", list: data.ending, dot: "#f59e0b" },
  ].filter((g) => g.list.length);
  const notBooked = data.thisMonth - data.booked;

  // 🔁 (26 พ.ย. 2569 ผู้ใช้: "ตรงนี้ให้ชิดขอบเหมือนตัวอื่นๆ ด้วย ด้านข้าง") จัดแบบเดียวกับ "ภาพรวมผลงาน":
  //    หัวส่วน → การ์ดตัวเลข 4 ใบชิดขอบซ้าย-ขวาเต็มแนว → การ์ด "ต้องระวัง" (ไม่ซ้อนกล่องในกล่อง)
  return (
    <Box sx={{ mb: 2.5, px: { xs: 1.5, sm: 0 } }}>
      <Stack direction="row" alignItems="flex-end" gap={2} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.3rem", fontWeight: 900, color: INK }}>ภาพรวมงานสัญญา</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {loading ? "กำลังโหลด…" : `${data.live.length} สัญญาที่ใช้งาน · สิ่งที่ต้องทำเดือน${thaiMonthLabel(data.nowKey, { full: true }).split(" ")[0]}`}
          </Typography>
        </Box>
        <Box component={Link} to="/contracts" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.8rem", fontWeight: 700, color: "#2563eb", textDecoration: "none", flexShrink: 0, pb: 0.25 }}>
          เปิดภาพรวมงาน<ChevronRight sx={{ fontSize: 17 }} />
        </Box>
      </Stack>
      {loading ? <Box sx={CARD}><Loading rows={3} /></Box> : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5, mb: 1.5 }}>
            <Tile to="/contracts?plan=year&month=now" label="ต้องเข้าเดือนนี้" value={data.thisMonth} unit="งาน" color="#2563eb"
              sub={data.thisMonth ? `ลงแล้ว ${data.booked} · เหลือ ${notBooked}` : "ไม่มีรอบเข้าเดือนนี้"}
              subColor={notBooked ? "#b45309" : undefined} />
            <Tile to="/contracts?view=overdue" label="ต้องนัดรอบถัดไป" value={overdue.length} unit="สัญญา" color="#dc2626"
              sub={overdue.length ? `เลยกำหนด ${overdueNow} · เดือนนี้ ${dueNow}` : "ไม่มีรอบค้าง"} subColor={overdueNow ? "#dc2626" : undefined} />
            <Tile to="/contracts?status=expiring" label="ใกล้หมดอายุ" value={data.expiring.length} unit="สัญญา" color="#d97706"
              sub={data.expiring.length ? "ควรเสนอราคาต่อ" : "ไม่มีสัญญาใกล้หมด"} />
            <Tile to="/contracts?view=expired" label="รอต่อสัญญา" value={data.awaiting.length} unit="สัญญา" color="#7c3aed"
              sub={data.awaiting.length ? "หมดอายุ ยังไม่ต่อ" : "ไม่มีค้างต่อ"} />
          </Box>
          <Box sx={CARD}>
          {data.planProblems > 0 && (
            <Box component={Link} to="/contracts?plan=year" sx={{ display: "block", px: 2, py: 1, bgcolor: "#fef2f2", borderBottom: `1px solid ${LINE}`, textDecoration: "none" }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#b91c1c" }}>
                แผนที่ส่งลูกค้าแล้ว ลงงานไม่ตรง {data.planProblems} สัญญา — กดเพื่อเปิดแผนงานทั้งปี ›
              </Typography>
            </Box>
          )}
          {/* ✅ รายการเตือน — ชิปพื้นขาวสีเดียว สีอยู่ที่จุดหน้าชิป (แดง = เลยกำหนด · ส้ม = ใกล้ถึง/ใกล้หมด) · ป้ายกลุ่มกว้างเท่ากันชิดแนวเดียว */}
          {groups.length ? (
            <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.75 }}>
              <Typography sx={{ mb: 1.25, fontSize: "0.8rem", fontWeight: 800, color: INK }}>ต้องระวัง · กดชื่อเพื่อดูในตาราง</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "104px minmax(0,1fr)" }, columnGap: 1.5, rowGap: { xs: 0.5, sm: 1.25 }, alignItems: "start" }}>
                {groups.map((g) => {
                  const open = Boolean(expanded[g.key]);
                  const shown = open ? g.list : g.list.slice(0, 8);
                  return [
                    <Typography key={`${g.key}-l`} sx={{ pt: { sm: 0.55 }, fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>
                      {g.label} <Box component="span" sx={{ color: INK, fontWeight: 800 }}>{g.list.length}</Box>
                    </Typography>,
                    <Box key={`${g.key}-c`} sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, minWidth: 0, mb: { xs: 1, sm: 0 } }}>
                      {shown.map(({ c, tail, tip }) => (
                        <Box key={`${g.key}-${c.key}`} component={Link} to={`/contracts?find=${encodeURIComponent(c.key)}`}
                          title={[c.contractNo, c.company, tip].filter(Boolean).join(" · ")}
                          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, maxWidth: 260, height: 28, pl: 1, pr: 1.1, borderRadius: 1.5, textDecoration: "none",
                            fontSize: "0.76rem", fontWeight: 600, color: INK_2, bgcolor: "#fff", border: `1px solid ${LINE}`, "&:hover": { borderColor: "#cbd5e1", bgcolor: SURFACE } }}>
                          <Box component="span" sx={{ width: 7, height: 7, borderRadius: 99, bgcolor: g.dot, flexShrink: 0 }} />
                          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.site || c.company || c.contractNo || "สัญญา"}</Box>
                          <Box component="span" sx={{ flexShrink: 0, color: FAINT, fontWeight: 700, whiteSpace: "nowrap" }}>{tail}</Box>
                        </Box>
                      ))}
                      {g.list.length > 8 && (
                        <Box component="button" type="button" onClick={() => setExpanded((e) => ({ ...e, [g.key]: !open }))} sx={MORE_SX}>
                          {open ? "ย่อ" : `+${g.list.length - 8} ดูทั้งหมด`}
                        </Box>
                      )}
                    </Box>,
                  ];
                })}
              </Box>
            </Box>
          ) : (
            <Typography sx={{ px: 2, py: 1.5, fontSize: "0.8rem", fontWeight: 700, color: "#15803d" }}>✓ ไม่มีงานสัญญาที่เลยกำหนด ใกล้ถึงกำหนด หรือใกล้หมดสัญญา</Typography>
          )}
          </Box>
        </>
      )}
    </Box>
  );
}
