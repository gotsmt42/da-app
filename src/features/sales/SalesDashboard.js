/**
 * SalesDashboard — หน้าแรกของฝ่ายขาย
 *
 * 🧹 เขียนใหม่ทั้งหน้า ไม่ได้ใช้โครงของช่างแล้ว
 * ⚠️ ปัญหาของแบบเดิม: เอาหน้าแรกของช่างมาตัดส่วนที่ไม่เกี่ยวออกทีละชิ้น เหลือแบนเนอร์ 1 อัน +
 * ตัวเลข 4 ใบที่เป็น 0 เกือบหมด + กล่องว่าง + ทางลัด 2 อัน = พื้นที่ตายเกินครึ่งจอ และหน้าตา
 * เหมือนของช่างทุกประการเพราะใช้สไตล์ชุดเดียวกัน
 *
 * ✅ แบบใหม่ตอบ 3 คำถามที่เซลเปิดแอปมาถามจริงๆ ตามลำดับ:
 *   1. วันนี้/สัปดาห์นี้ต้องไปไหนบ้าง      → ไทม์ไลน์นัดหมาย (ซ้าย, พื้นที่ใหญ่สุด)
 *   2. งานที่ส่งให้ช่างไปถึงไหนแล้ว        → แถบสถานะใบแจ้งงาน (ขวา)
 *   3. จะเพิ่มนัด/แจ้งงานใหม่ต้องกดตรงไหน  → ปุ่มหลัก 2 ปุ่มบนหัว
 *
 * ⚠️ โทนม่วง/ชมพูทั้งหน้า แยกจากแดงของสายบริการ — ชุดเดียวกับหัวปฏิทิน แถบแท็บ และเมนู
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Button, Chip, Skeleton, Avatar, Tooltip, LinearProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, Engineering, EventAvailable, TrendingUp, ArrowForward, Place, AccessTime,
} from "@mui/icons-material";

import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import DispatchService from "@/features/dispatch/services/DispatchService";
import { formatThai } from "@/shared/utils/thaiDate";
import {
  SALES_TYPE_META, salesEventColors, salesStatusMeta,
} from "@/features/calendar/salesAppointmentTypes";
import { DISPATCH_STATUS_META, jobStatusColor } from "@/features/dispatch/dispatchMeta";

const ACCENT = "#8b5cf6";
const ACCENT_DEEP = "#5b21b6";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
};

/** ตัวเลขหนึ่งตัวพร้อมบริบท — ไม่ใช้การ์ดเปล่าที่มีแต่เลข 0 เรียงกัน */
const Metric = ({ icon, label, value, sub, color, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      flex: "1 1 150px", minWidth: 0, p: 1.75, borderRadius: 3,
      bgcolor: "#fff", border: "1px solid", borderColor: alpha(color, 0.25),
      cursor: onClick ? "pointer" : "default",
      transition: "transform .15s, box-shadow .15s",
      "&:hover": onClick ? { transform: "translateY(-2px)", boxShadow: `0 6px 18px -8px ${alpha(color, 0.5)}` } : {},
    }}
  >
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
      <Box
        sx={{
          width: 30, height: 30, borderRadius: 2, flexShrink: 0,
          bgcolor: alpha(color, 0.12), color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {icon}
      </Box>
      <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Stack>
    <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", lineHeight: 1.1, color }}>{value}</Typography>
    {sub && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{sub}</Typography>}
  </Box>
);

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [events, setEvents] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [ev, dp] = await Promise.all([
      EventService.getEventOp().catch(() => ({ userEvents: [] })),
      DispatchService.list().catch(() => []),
    ]);
    setEvents(ev?.userEvents || []);
    setDispatches(Array.isArray(dp) ? dp : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * นัดหมายข้างหน้า 14 วัน จัดกลุ่มตามวัน
   * ⚠️ เทียบด้วย startOf("day") ไม่ใช่ isAfter(now) — นัดของ "วันนี้" ที่เวลาผ่านไปแล้วต้องยังอยู่
   * ในรายการ (เซลอาจยังไม่ได้ไป หรือไปแล้วแต่ยังต้องดูว่านัดถัดไปคืออะไร)
   */
  const upcoming = useMemo(() => {
    const today = moment().startOf("day");
    const rows = events
      .filter((e) => moment(e.start || e.date).isSameOrAfter(today, "day"))
      .filter((e) => moment(e.start || e.date).diff(today, "days") <= 14)
      .sort((a, b) => new Date(a.start || a.date) - new Date(b.start || b.date));
    const byDay = new Map();
    rows.forEach((e) => {
      const key = moment(e.start || e.date).format("YYYY-MM-DD");
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(e);
    });
    return [...byDay.entries()].slice(0, 6);
  }, [events]);

  const todayCount = useMemo(
    () => events.filter((e) => moment(e.start || e.date).isSame(moment(), "day")).length,
    [events]
  );
  const weekCount = useMemo(
    () => events.filter((e) => moment(e.start || e.date).isBetween(moment().startOf("day"), moment().add(7, "days"), "day", "[]")).length,
    [events]
  );

  // ⚠️ นับจาก "สถานะงานจริง" ที่ผูกไว้ (d.job) ไม่ใช่สถานะของใบ — ดูเหตุผลที่ dispatchMeta.js
  const dispatchStats = useMemo(() => {
    const waiting = dispatches.filter((d) => d.status === "requested").length;
    const rejected = dispatches.filter((d) => d.status === "rejected").length;
    const working = dispatches.filter((d) => d.job && d.job.status !== "ดำเนินการเสร็จสิ้น").length;
    const done = dispatches.filter((d) => d.job?.status === "ดำเนินการเสร็จสิ้น").length;
    return { waiting, rejected, working, done };
  }, [dispatches]);

  const activeDispatches = useMemo(
    () => dispatches
      .filter((d) => d.status !== "cancelled" && d.job?.status !== "ดำเนินการเสร็จสิ้น")
      .slice(0, 5),
    [dispatches]
  );

  if (loading) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1400, mx: "auto" }}>
        <Skeleton variant="rounded" height={130} sx={{ borderRadius: 4, mb: 2 }} />
        <Skeleton variant="rounded" height={90} sx={{ borderRadius: 3, mb: 2 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1400, mx: "auto" }}>
      {/* ── หัวหน้าเพจ: ทักทาย + ปุ่มหลัก 2 ปุ่ม ─────────────────────────
          ✅ รวมคำทักทาย ชื่อ บทบาท และปุ่มที่ใช้บ่อยที่สุดไว้ในบล็อกเดียว — เดิมแยกเป็นแถบทักทาย
          กับแบนเนอร์ลิงก์คนละก้อน กินความสูงสองเท่าโดยให้ข้อมูลเท่าเดิม */}
      <Box
        sx={{
          position: "relative", overflow: "hidden",
          borderRadius: 4, p: { xs: 2, sm: 2.75 }, mb: 2.5,
          background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%)`,
          color: "#fff",
        }}
      >
        {/* วงกลมจางๆ ให้พื้นหลังไม่แบน — ตกแต่งล้วน ไม่บังเนื้อหา */}
        <Box sx={{ position: "absolute", right: -40, top: -60, width: 200, height: 200, borderRadius: "50%", bgcolor: alpha("#fff", 0.08) }} />
        <Box sx={{ position: "absolute", right: 60, bottom: -80, width: 140, height: 140, borderRadius: "50%", bgcolor: alpha("#fff", 0.06) }} />

        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2} sx={{ position: "relative" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {greeting()} · {formatThai(moment(), "D MMMM YYYY")}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.35rem", sm: "1.6rem" }, lineHeight: 1.2 }}>
              {userData?.fname || "ฝ่ายขาย"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
              {todayCount > 0
                ? `วันนี้มี ${todayCount} นัด · สัปดาห์นี้ ${weekCount} นัด`
                : weekCount > 0
                  ? `วันนี้ไม่มีนัด · สัปดาห์นี้อีก ${weekCount} นัด`
                  : "ยังไม่มีนัดหมายในสัปดาห์นี้"}
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>
            <Button
              variant="contained" startIcon={<Add sx={{ fontSize: 18 }} />}
              onClick={() => navigate("/event")}
              sx={{
                textTransform: "none", fontWeight: 800, borderRadius: 2.5, px: 2.5,
                bgcolor: "#fff", color: ACCENT_DEEP,
                "&:hover": { bgcolor: alpha("#fff", 0.9) },
              }}
            >
              เพิ่มนัดหมาย
            </Button>
            <Button
              variant="outlined" startIcon={<Engineering sx={{ fontSize: 18 }} />}
              onClick={() => navigate("/sales")}
              sx={{
                textTransform: "none", fontWeight: 800, borderRadius: 2.5, px: 2.5,
                color: "#fff", borderColor: alpha("#fff", 0.6),
                "&:hover": { borderColor: "#fff", bgcolor: alpha("#fff", 0.12) },
              }}
            >
              แจ้งงานให้ช่าง
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* ── ตัวเลขที่ต้องรู้ ───────────────────────────────────────────── */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: "wrap", gap: 1.5 }}>
        <Metric
          icon={<EventAvailable sx={{ fontSize: 17 }} />} color={ACCENT}
          label="นัดหมายสัปดาห์นี้" value={weekCount}
          sub={todayCount > 0 ? `วันนี้ ${todayCount} นัด` : "วันนี้ไม่มีนัด"}
          onClick={() => navigate("/event")}
        />
        <Metric
          icon={<Engineering sx={{ fontSize: 17 }} />} color="#f59e0b"
          label="รอช่างรับงาน" value={dispatchStats.waiting}
          sub={dispatchStats.waiting > 0 ? "รอแอดมินตรวจสอบ" : "ไม่มีใบค้าง"}
          onClick={() => navigate("/sales")}
        />
        <Metric
          icon={<TrendingUp sx={{ fontSize: 17 }} />} color="#0ea5e9"
          label="ช่างกำลังทำ" value={dispatchStats.working}
          sub={dispatchStats.rejected > 0 ? `⚠️ ถูกตีกลับ ${dispatchStats.rejected} ใบ` : "ติดตามได้ที่หน้าแจ้งงาน"}
          onClick={() => navigate("/sales")}
        />
        <Metric
          icon={<EventAvailable sx={{ fontSize: 17 }} />} color="#10b981"
          label="ช่างทำเสร็จแล้ว" value={dispatchStats.done}
          sub="พร้อมแจ้งลูกค้า"
          onClick={() => navigate("/sales")}
        />
      </Stack>

      {/* ── 2 คอลัมน์: ไทม์ไลน์นัด (ใหญ่) + สถานะงานที่ส่งให้ช่าง ────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,7fr) minmax(0,5fr)" }, gap: 2.5, alignItems: "start" }}>
        {/* ซ้าย — ไทม์ไลน์ */}
        <Box>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>นัดหมายข้างหน้า</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB, flex: 1 }}>14 วันข้างหน้า</Typography>
            <Button
              size="small" endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
              onClick={() => navigate("/event")}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT }}
            >
              เปิดปฏิทิน
            </Button>
          </Stack>

          {upcoming.length === 0 ? (
            <Box sx={{ p: 4, borderRadius: 3, border: "1px dashed", borderColor: BORDER, textAlign: "center", bgcolor: "#fff" }}>
              <EventAvailable sx={{ fontSize: 38, color: alpha(ACCENT, 0.3), mb: 1 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.25 }}>ยังไม่มีนัดหมายใน 14 วันข้างหน้า</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1.5 }}>
                กด "เพิ่มนัดหมาย" ด้านบน หรือกดวันที่บนปฏิทินเพื่อลงนัดใหม่
              </Typography>
              <Button
                variant="contained" size="small" startIcon={<Add sx={{ fontSize: 16 }} />}
                onClick={() => navigate("/event")}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DEEP } }}
              >
                เพิ่มนัดหมาย
              </Button>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {upcoming.map(([day, list]) => {
                const d = moment(day);
                const isToday = d.isSame(moment(), "day");
                const isTomorrow = d.isSame(moment().add(1, "day"), "day");
                return (
                  <Box key={day}>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.6 }}>
                      <Chip
                        size="small"
                        label={isToday ? "วันนี้" : isTomorrow ? "พรุ่งนี้" : formatThai(d, "ddd D MMM")}
                        sx={{
                          height: 20, fontSize: "0.66rem", fontWeight: 800,
                          bgcolor: isToday ? ACCENT : alpha(ACCENT, 0.1),
                          color: isToday ? "#fff" : ACCENT,
                        }}
                      />
                      <Box sx={{ flex: 1, height: "1px", bgcolor: BORDER }} />
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>{list.length} นัด</Typography>
                    </Stack>

                    <Stack spacing={0.75}>
                      {list.map((e) => {
                        const meta = SALES_TYPE_META[e.title] || null;
                        const color = meta?.color || salesEventColors(e.title).backgroundColor;
                        // ⚠️ นัดเก่าที่สร้างก่อนมีชุดสถานะฝ่ายขาย จะถือสถานะของช่างติดมา —
                        // salesStatusMeta แปลงให้เอง ไม่ต้องไปแก้ข้อมูลเดิมในฐานข้อมูล
                        const st = salesStatusMeta(e.status);
                        return (
                          <Stack
                            key={e._id} direction="row" spacing={1.25} alignItems="center"
                            onClick={() => navigate("/event")}
                            sx={{
                              p: 1.25, borderRadius: 2.5, cursor: "pointer", bgcolor: "#fff",
                              border: "1px solid", borderColor: BORDER,
                              borderLeft: "4px solid", borderLeftColor: color,
                              transition: "border-color .15s, box-shadow .15s",
                              "&:hover": { borderColor: color, boxShadow: `0 3px 12px -6px ${alpha(color, 0.6)}` },
                            }}
                          >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.15 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color }} noWrap>
                                  {meta?.icon ? `${meta.icon} ` : ""}{e.title}
                                </Typography>
                                {/* ✅ สถานะนัด — เซลต้องรู้ได้ทันทีว่านัดไหนไปมาแล้ว/เลื่อน/ยกเลิก
                                    ไม่ใช่เห็นแต่ว่ามีนัดอยู่กี่อันเฉยๆ */}
                                <Chip
                                  size="small" label={`${st.icon} ${st.key}`}
                                  sx={{
                                    flexShrink: 0, height: 18, fontSize: "0.62rem", fontWeight: 800,
                                    bgcolor: alpha(st.color, 0.12), color: st.color,
                                    "& .MuiChip-label": { px: 0.7 },
                                  }}
                                />
                              </Stack>
                              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                                <Place sx={{ fontSize: 11, verticalAlign: "-1px" }} />{" "}
                                {[e.company, e.site].filter(Boolean).join(" · ") || "ไม่ระบุสถานที่"}
                              </Typography>
                            </Box>
                            <Chip
                              size="small" icon={<AccessTime sx={{ fontSize: 12 }} />}
                              label={e.startTime ? `${e.startTime}${e.endTime ? `-${e.endTime}` : ""}` : "ทั้งวัน"}
                              sx={{
                                flexShrink: 0, height: 21, fontSize: "0.66rem", fontWeight: 700,
                                bgcolor: alpha(color, 0.1), color,
                                "& .MuiChip-icon": { color: "inherit", ml: 0.5 },
                              }}
                            />
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* ขวา — งานที่ส่งให้ช่าง */}
        <Box>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>งานที่ส่งให้ช่าง</Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small" endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
              onClick={() => navigate("/sales")}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT }}
            >
              ดูทั้งหมด
            </Button>
          </Stack>

          {activeDispatches.length === 0 ? (
            <Box sx={{ p: 3, borderRadius: 3, border: "1px dashed", borderColor: BORDER, textAlign: "center", bgcolor: "#fff" }}>
              <Engineering sx={{ fontSize: 34, color: alpha("#f59e0b", 0.35), mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 0.25 }}>ยังไม่มีงานที่ส่งให้ช่าง</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                ปิดการขายได้แล้วกด "แจ้งงานให้ช่าง" ด้านบน
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {activeDispatches.map((d) => {
                // ใบที่อนุมัติแล้วใช้สถานะงานจริง · ยังไม่อนุมัติใช้สถานะของใบ
                const label = d.job?.status || DISPATCH_STATUS_META[d.status]?.label || d.status;
                const color = d.job?.status ? jobStatusColor(d.job.status) : (DISPATCH_STATUS_META[d.status]?.color || TEXT_SUB);
                const isRejected = d.status === "rejected";
                // ความคืบหน้าคร่าวๆ ให้เห็นด้วยตา ไม่ต้องอ่านป้าย
                const pct = isRejected ? 0
                  : d.status === "requested" ? 15
                    : d.job?.status === "ดำเนินการเสร็จสิ้น" ? 100
                      : d.job?.status === "กำลังดำเนินการ" ? 65
                        : 40;
                return (
                  <Box
                    key={d._id}
                    onClick={() => navigate("/sales")}
                    sx={{
                      p: 1.25, borderRadius: 2.5, cursor: "pointer", bgcolor: "#fff",
                      border: "1px solid", borderColor: isRejected ? alpha("#ef4444", 0.45) : BORDER,
                      "&:hover": { borderColor: color },
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 0.6 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.83rem" }} noWrap>{d.title}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>
                          {d.customer?.company}
                        </Typography>
                      </Box>
                      <Chip
                        size="small" label={isRejected ? "ถูกตีกลับ" : label}
                        sx={{
                          flexShrink: 0, height: 20, fontSize: "0.64rem", fontWeight: 800,
                          bgcolor: alpha(isRejected ? "#ef4444" : color, 0.12),
                          color: isRejected ? "#dc2626" : color,
                        }}
                      />
                    </Stack>
                    {isRejected ? (
                      <Typography variant="caption" sx={{ color: "#dc2626" }}>
                        {d.rejectedReason || "ต้องแก้ไขแล้วส่งใหม่"}
                      </Typography>
                    ) : (
                      <>
                        <LinearProgress
                          variant="determinate" value={pct}
                          sx={{
                            height: 5, borderRadius: 3, bgcolor: alpha("#0f172a", 0.06),
                            "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                        {d.job?.responsiblePerson && (
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                            <Tooltip title="ช่างที่รับผิดชอบ">
                              <Avatar sx={{ width: 17, height: 17, fontSize: "0.58rem", fontWeight: 800, bgcolor: alpha(color, 0.18), color }}>
                                {d.job.responsiblePerson.charAt(0)}
                              </Avatar>
                            </Tooltip>
                            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>
                              {d.job.responsiblePerson}
                              {d.job.start ? ` · ${formatThai(moment(d.job.start), "D MMM")}` : ""}
                            </Typography>
                          </Stack>
                        )}
                      </>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
