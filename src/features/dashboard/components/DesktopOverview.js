/**
 * DesktopOverview — "ภาพรวมผลงาน" หน้าแรกบนจอคอม/จอใหญ่ (แทนกริดเมนู)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "หน้านี้ควรเป็น Dashboard แสดงผลงานต่างๆจริงๆให้สอดคล้อง และดูมืออาชีพ
 *    เอาเฉพาะหน้าจอคอมหรือขนาดใหญ่ · มือถือให้เป็นเมนูแบบเดิม")
 *    จอคอมมีเมนูข้าง + แถบเมนูบนอยู่แล้ว กริดเมนูซ้ำซ้อน — พื้นที่หลักจึงใช้แสดงผลงานจริงแทน
 *
 * ลำดับความสำคัญ (บน → ล่าง):
 *   1) ตัวเลขหลัก 4 ช่อง: งานในช่วง · เสร็จสิ้น · มูลค่างาน · ค้าง/รอตรวจตอนนี้
 *   2) สถานะงานในช่วง (แถบสัดส่วน + รายการ)  |  ผลงานรายคน (มูลค่างานที่ทำ)
 *   3) แนวโน้ม 6 เดือน
 * ทุกตัวเลขมาจาก utils/overviewData.js → โมดูลเดียวกับหน้าสรุปผลการดำเนินงาน/ผลงานรายบุคคล (กดแล้วไปหน้านั้นเห็นเลขเดียวกัน)
 * สี: ตัวเลขสีเข้ม · สีสถานะใช้เฉพาะจุด/แถบเล็ก (ชุดเดียวกับหน้าการดำเนินงาน) · ปุ่ม/ลิงก์สีน้ำเงินระบบ
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { Box, ButtonBase, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AssessmentRounded, EngineeringRounded, InsightsRounded, ChevronRightRounded, CheckCircleRounded, ErrorRounded } from "@mui/icons-material";
import { INK, MUTED, LINE, ACCENT, CARD_SHADOW } from "@/shared/ui/PageKit";
import AttendanceService from "@/shared/services/AttendanceService";
import useElementWidth from "@/shared/hooks/useElementWidth";
import { Segmented, PersonAvatar, baht } from "@/features/operation/components/ReportKit";
import { monthLabel } from "@/features/operation/utils/reportPeriod";
import { buildOverview, overviewRange, OVERVIEW_PERIODS } from "../utils/overviewData";
import { RATE_KPIS } from "@/features/operation/utils/workerKpi";

const FAINT = "#94a3b8";
const OK = "#15803d";
const WARN = "#b45309";
const DANGER = "#dc2626";
const NUM = { fontVariantNumeric: "tabular-nums" };
const CARD = { bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW, overflow: "hidden" };
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/** ตัวเลขหลัก 1 ช่อง — กดไปหน้าที่มาของตัวเลข */
function KpiTile({ label, value, sub, subColor, to, loading }) {
  return (
    <ButtonBase component={Link} to={to}
      sx={{ ...CARD, display: "block", textAlign: "left", p: 2, fontFamily: "inherit", textDecoration: "none", color: "inherit",
        transition: "border-color .15s ease, box-shadow .15s ease", "&:hover": { borderColor: alpha(ACCENT, 0.45), boxShadow: `0 8px 20px -14px ${alpha(ACCENT, 0.6)}` } }}>
      <Stack direction="row" alignItems="center">
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
        <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1" }} />
      </Stack>
      {loading ? <Skeleton width="60%" height={40} /> : (
        <Typography noWrap sx={{ fontSize: "1.75rem", fontWeight: 900, color: INK, lineHeight: 1.25, ...NUM }}>{value}</Typography>
      )}
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: subColor || MUTED, minHeight: 18, lineHeight: 1.45 }}>{loading ? "" : sub}</Typography>
    </ButtonBase>
  );
}

/** หัวการ์ด: ไอคอน · ชื่อ · คำอธิบาย · ลิงก์ */
function CardHead({ icon: Icon, title, hint, to, toLabel }) {
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
      <Box sx={{ width: 32, height: 32, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.08), color: ACCENT, flexShrink: 0 }}>
        <Icon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 800, color: INK }}>{title}</Typography>
        {hint && <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{hint}</Typography>}
      </Box>
      {to && (
        <ButtonBase component={Link} to={to} sx={{ gap: 0.25, px: 1, py: 0.5, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 800, color: ACCENT,
          textDecoration: "none", "&:hover": { bgcolor: alpha(ACCENT, 0.06) } }}>
          {toLabel}<ChevronRightRounded sx={{ fontSize: 17 }} />
        </ButtonBase>
      )}
    </Stack>
  );
}

/** สถานะงานในช่วง — แถบสัดส่วนเส้นเดียว + รายการ 6 สถานะ (ชื่อ/สีเดียวกับหน้าการดำเนินงาน) */
function StatusCard({ rows, total, loading }) {
  return (
    <Box sx={CARD}>
      <CardHead icon={AssessmentRounded} title="สถานะงาน" hint="1 งานอยู่สถานะเดียว · รวมทุกสถานะ = จำนวนงาน" to="/jobs/report" toLabel="สรุปผลการดำเนินงาน" />
      <Box sx={{ px: 2, pt: 1.75, pb: 1 }}>
        <Box sx={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", bgcolor: "#eef2f7" }}>
          {!loading && total > 0 && rows.filter((r) => r.count).map((r) => (
            <Box key={r.key} title={`${r.label} ${r.count}`} sx={{ width: `${(r.count / total) * 100}%`, bgcolor: r.color, transition: "width .4s ease" }} />
          ))}
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 3, px: 2, pb: 1.5 }}>
        {rows.map((r) => (
          <Stack key={r.key} direction="row" alignItems="center" gap={1} sx={{ py: 0.9, borderBottom: `1px solid ${LINE}` }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: r.color, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 700, color: "#334155" }}>{r.label}</Typography>
              <Typography noWrap sx={{ fontSize: "0.7rem", color: FAINT }}>{r.hint}</Typography>
            </Box>
            {loading ? <Skeleton width={36} /> : (
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 900, color: r.count ? INK : FAINT, ...NUM }}>{r.count}</Typography>
                <Typography sx={{ fontSize: "0.68rem", color: MUTED, ...NUM }}>{pct(r.count, total)}%</Typography>
              </Box>
            )}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

/** ผลงานรายคน — 6 อันดับแรกตามมูลค่างานที่ทำ (ทีม) หรือสรุปของฉัน (ช่าง) */
function PeopleCard({ people, team, avatarOf, personal, loading, period }) {
  const linkOf = (name) => `/jobs/workers?person=${encodeURIComponent(name)}&period=${period}`;
  const top = people.slice(0, 6);
  const me = personal ? people[0] : null;
  return (
    <Box sx={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <CardHead icon={EngineeringRounded} title={personal ? "ผลงานของฉัน" : "ผลงานรายคน"}
        hint={personal ? "มูลค่างานที่ฉันทำ (ก่อน VAT)" : "มูลค่างานที่แต่ละคนทำ (ก่อน VAT) · กดชื่อเพื่อดูรายละเอียด"} to={`/jobs/workers?period=${period}`} toLabel="ผลงานรายบุคคล" />
      {loading ? (
        <Stack spacing={1} sx={{ p: 2 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}</Stack>
      ) : !people.length ? (
        <Typography sx={{ p: 3, textAlign: "center", fontSize: "0.86rem", color: FAINT }}>ยังไม่มีการเข้างานในช่วงนี้</Typography>
      ) : personal && me ? (
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED }}>มูลค่างานที่ฉันทำ</Typography>
          <Typography sx={{ fontSize: "1.7rem", fontWeight: 900, color: INK, ...NUM }}>{baht(me.total)}</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{me.visits} ครั้ง · {me.days} วัน · บันทึกมูลค่าแล้ว {me.valued}/{me.visits} ครั้ง</Typography>
          <Box sx={{ mt: 1.5, borderRadius: 2, border: `1px solid ${LINE}` }}>
            {/* ความครบของข้อมูล — ชุดเดียวกับหน้าผลงานรายบุคคล (RATE_KPIS) */}
            {RATE_KPIS.map((d, i) => {
              const n = me[d.num] || 0;
              const base = me[d.base] || 0;
              const ok = base > 0 && n === base;
              return (
                <Stack key={d.key} direction="row" alignItems="center" gap={1} title={d.desc} sx={{ px: 1.25, py: 0.8, borderTop: i ? `1px solid ${LINE}` : 0 }}>
                  {ok ? <CheckCircleRounded sx={{ fontSize: 17, color: OK }} /> : <ErrorRounded sx={{ fontSize: 17, color: base ? WARN : "#e2e8f0" }} />}
                  <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>{d.label}</Typography>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: base ? INK : FAINT, ...NUM }}>{base ? `${n} / ${base}` : "–"}</Typography>
                </Stack>
              );
            })}
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ flex: 1 }}>
            {/* 🔁 (17 พ.ย. 2569 ผู้ใช้: "แถบนี้ต้องกดดูได้ไหม") กดแถว = เปิดผลงานของคนนั้น (ช่วงเดียวกัน) */}
            {top.map((p, i) => (
              <ButtonBase key={p.name} component={Link} to={linkOf(p.name)} title={`ดูผลงานของ ${p.name}`}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%", px: 2, py: 1.1, textAlign: "left", fontFamily: "inherit", textDecoration: "none", color: "inherit",
                  borderTop: i ? `1px solid ${LINE}` : 0, transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fafc" } }}>
                <Typography sx={{ width: 16, fontSize: "0.8rem", fontWeight: 700, color: FAINT, textAlign: "center" }}>{i + 1}</Typography>
                <PersonAvatar name={p.name} avatar={avatarOf(p.name)} size={30} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="baseline" gap={1}>
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
                    {p.valued
                      ? <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: INK, ...NUM }}>{baht(p.total)}</Typography>
                      : <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: FAINT }}>ยังไม่ลง</Typography>}
                  </Stack>
                  {/* 🔁 (17 พ.ย. 2569) ไม่มีแถบสัดส่วนของทีม — ยอดของแต่ละคนเป็นผลงานของคนนั้น ไม่นำมารวมกัน */}
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.3 }}>
                    <Typography sx={{ flex: 1, fontSize: "0.7rem", color: MUTED }}>{p.visits} ครั้ง · {p.days} วัน · ลงแล้ว {p.valued}/{p.visits}</Typography>
                    {p.past > 0 && (p.issueCount
                      ? <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, color: WARN, whiteSpace: "nowrap" }}>ต้องแก้ {p.issueCount}</Typography>
                      : <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, color: OK, whiteSpace: "nowrap" }}>✓ ครบ</Typography>)}
                  </Stack>
                </Box>
                <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1" }} />
              </ButtonBase>
            ))}
          </Box>
          <Typography sx={{ px: 2, py: 1, fontSize: "0.74rem", color: MUTED, bgcolor: "#f8fafc", borderTop: `1px solid ${LINE}` }}>
            {people.length} คน{people.length > top.length ? ` (แสดง ${top.length} อันดับแรก)` : ""} · ยอดของแต่ละคน = มูลค่าครั้งนี้ที่คนนั้นลงเอง ไม่รวมกัน
          </Typography>
          {team.issueCount > 0 && (
            <Typography sx={{ px: 2, py: 0.75, fontSize: "0.72rem", color: WARN, borderTop: `1px solid ${LINE}` }}>
              ข้อมูลยังไม่ครบ {team.issueCount} รายการ — ยอดบางคนอาจต่ำกว่าจริง
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

/** แนวโน้ม 6 เดือน — คอลัมน์: งานทั้งหมด (อ่อน) · เสร็จสิ้น (เข้ม) · มูลค่าใต้คอลัมน์ */
function TrendCard({ trend, showValue, loading }) {
  const max = Math.max(1, ...trend.map((t) => t.total));
  const thisMonth = moment().format("YYYY-MM");
  return (
    <Box sx={CARD}>
      <CardHead icon={InsightsRounded} title="แนวโน้ม 6 เดือน" hint="จำนวนงานตามเดือนที่เริ่มงาน · ส่วนเข้ม = เสร็จสิ้นแล้ว" to="/jobs/report" toLabel="ดูรายเดือน" />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 1.5, px: 2, pt: 2, pb: 1.5 }}>
        {trend.map((t) => (
          <Box key={t.key} sx={{ textAlign: "center", minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, color: t.total ? INK : FAINT, ...NUM }}>{loading ? "" : t.total}</Typography>
            <Box sx={{ height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", mt: 0.5 }}>
              <Box sx={{ width: "56%", maxWidth: 48, height: `${loading ? 0 : Math.max(t.total ? 6 : 0, (t.total / max) * 100)}%`, borderRadius: "8px 8px 3px 3px",
                bgcolor: alpha(ACCENT, 0.16), position: "relative", overflow: "hidden", transition: "height .45s ease" }}>
                <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${t.total ? (t.closed / t.total) * 100 : 0}%`, bgcolor: alpha(ACCENT, 0.75), transition: "height .45s ease" }} />
              </Box>
            </Box>
            <Typography noWrap sx={{ mt: 0.75, fontSize: "0.76rem", fontWeight: t.key === thisMonth ? 900 : 700, color: t.key === thisMonth ? ACCENT : "#334155" }}>{monthLabel(t.key)}</Typography>
            <Typography noWrap sx={{ fontSize: "0.68rem", color: MUTED, ...NUM }}>
              {loading ? "" : showValue ? (t.value ? baht(t.value) : "–") : `เสร็จ ${t.closed}`}
            </Typography>
          </Box>
        ))}
      </Box>
      <Stack direction="row" gap={2} sx={{ px: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: alpha(ACCENT, 0.16) }} /><Typography sx={{ fontSize: "0.72rem", color: MUTED }}>งานทั้งหมด</Typography></Stack>
        <Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: alpha(ACCENT, 0.75) }} /><Typography sx={{ fontSize: "0.72rem", color: MUTED }}>เสร็จสิ้นแล้ว</Typography></Stack>
        {showValue && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>ตัวเลขใต้เดือน = มูลค่าครั้งนี้ของงาน (ก่อน VAT)</Typography>}
      </Stack>
    </Box>
  );
}

/**
 * @param events     งานจาก getEventOp (ตามสิทธิ์)
 * @param users      พนักงาน (รูปโปรไฟล์)
 * @param loading    กำลังโหลดงาน
 * @param teamView   ดูทั้งทีม (แอดมิน/ผู้จัดการ) · false = ของฉัน
 * @param showValue  เห็นมูลค่างานของงาน (สิทธิ์เดียวกับหน้าสรุปผลการดำเนินงาน)
 * @param myName     fname ของผู้ใช้ (โหมดของฉัน)
 */
export default function DesktopOverview({ events, users = [], loading, teamView, showValue, myName }) {
  const [period, setPeriod] = useState("month");
  const [from, to] = overviewRange(period);
  const [attendance, setAttendance] = useState([]);
  useEffect(() => {
    let alive = true;
    AttendanceService.list({ from: moment(from).subtract(7, "days").format("YYYY-MM-DD"), to: moment(to).add(60, "days").format("YYYY-MM-DD"), includeClosed: 1 })
      .then((r) => { if (alive) setAttendance(r?.attendance || []); })
      .catch(() => { if (alive) setAttendance([]); });
    return () => { alive = false; };
  }, [from, to]);

  const data = useMemo(() => buildOverview(events, attendance, { from, to, me: teamView ? "" : myName }), [events, attendance, from, to, teamView, myName]);
  const avatarOf = useMemo(() => {
    const m = new Map(users.map((u) => [u.fname, u.imageUrl]));
    return (n) => m.get(n);
  }, [users]);

  const t = data.summary.totals;
  const periodText = OVERVIEW_PERIODS.find(([k]) => k === period)?.[1] || "";
  const myTotal = data.people[0]?.total || 0;
  // 🔁 (17 พ.ย. 2569 ผู้ใช้: "รองรับทุกขนาดหน้าจอ") จำนวนช่องตามพื้นที่จริง (เปิดเมนูข้าง/จอ 13 นิ้ว ช่องแคบลง)
  const [boxRef, width] = useElementWidth();
  const tileCols = !width || width >= 880 ? 4 : 2;
  const twoCol = width >= 1100;

  return (
    <Box ref={boxRef} sx={{ mb: 2.5, "@keyframes ovIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } }, animation: "ovIn .3s ease-out" }}>
      {/* หัวส่วน */}
      <Stack direction="row" alignItems="flex-end" gap={2} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.3rem", fontWeight: 900, color: INK }}>{teamView ? "ภาพรวมผลงาน" : "ผลงานของฉัน"}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {periodText} · {moment(from).add(543, "year").format("D/M/YY")} – {moment(to).add(543, "year").format("D/M/YY")} · ตัวเลขเดียวกับหน้ารายงาน
          </Typography>
        </Box>
        <Segmented value={period} onChange={setPeriod} options={OVERVIEW_PERIODS} />
      </Stack>

      {/* 1) ตัวเลขหลัก */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: `repeat(${tileCols}, minmax(0, 1fr))`, mb: 1.5 }}>
        <KpiTile loading={loading} to="/jobs/report" label={`งาน${periodText}`} value={`${t.total} งาน`}
          sub={`เข้างาน ${t.visits} ช่วง · ยังไม่ปิด ${t.open} งาน`} />
        <KpiTile loading={loading} to="/jobs/report" label="เสร็จสิ้นแล้ว" value={`${t.closeRate}%`}
          sub={`${t.closed} จาก ${t.total} งาน`} subColor={t.total && t.closeRate >= 80 ? OK : undefined} />
        {showValue ? (
          <KpiTile loading={loading} to="/jobs/report" label="มูลค่าครั้งนี้ของงาน" value={baht(t.value)}
            sub={`ก่อน VAT${t.jobTotal ? ` · มูลค่างานรวม ${baht(t.jobTotal)}` : ""}${t.missing ? ` · ยังไม่ใส่ ${t.missing} งาน` : ""}`} subColor={t.missing ? WARN : undefined} />
        ) : (
          <KpiTile loading={loading} to="/jobs/workers" label="มูลค่างานที่ฉันทำ" value={baht(myTotal)}
            sub={data.team.issueCount ? `ข้อมูลยังไม่ครบ ${data.team.issueCount} รายการ` : "ข้อมูลครบ"} subColor={data.team.issueCount ? WARN : OK} />
        )}
        <KpiTile loading={loading} to={teamView ? "/operation?group=overdue" : "/technician/jobs"} label="ค้างงาน (ตอนนี้)" value={`${data.now.overdue} งาน`}
          sub={[data.now.severe ? `เกิน 2 สัปดาห์ ${data.now.severe}` : "", `รอตรวจปิดงาน ${data.now.pending}`].filter(Boolean).join(" · ")}
          subColor={data.now.severe ? DANGER : undefined} />
      </Box>

      {/* 2) สถานะงาน | ผลงานรายคน */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: twoCol ? "minmax(0, 1.25fr) minmax(0, 1fr)" : "1fr", mb: 1.5 }}>
        <StatusCard rows={data.statusRows} total={t.total} loading={loading} />
        <PeopleCard people={data.people} team={data.team} avatarOf={avatarOf} personal={!teamView} loading={loading} period={period} />
      </Box>

      {/* 3) แนวโน้ม */}
      <TrendCard trend={data.trend} showValue={showValue} loading={loading} />
    </Box>
  );
}
