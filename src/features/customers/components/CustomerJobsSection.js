/**
 * CustomerJobsSection — "งานของลูกค้า" ในกล่องรายละเอียด (ภาพรวมลูกค้า + ทะเบียนลูกค้า ใช้ตัวเดียวกัน)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ให้ดูมีอะไรให้ชัดเจน ละเอียดกว่านี้ · ข้อมูลสอดคล้อง")
 *    • สรุปสถานะ 6 กลุ่ม (ชื่อ/สีเดียวกับหน้าการดำเนินงาน) — รวมทุกกลุ่ม = จำนวนงาน
 *    • รายการงานแยกรายปี (ล่าสุดก่อน): วันที่ · ประเภท/ระบบ/ครั้งที่/เลขที่งาน · ผู้รับผิดชอบ/ทีม · สถานะ · มูลค่า (ถ้ามีสิทธิ์)
 *    • กดงาน = เปิดรายละเอียดงานทับขึ้นมา (JobQuickView) ไม่ต้องออกจากหน้า
 *    ข้อมูลงานมาจาก utils/customerJobs (กติกาเดียวกับหน้าการดำเนินงาน: 1 งาน = 1 กลุ่มงาน · ไม่นับนัดฝ่ายขาย)
 */
import { useMemo, useState } from "react";
import moment from "moment";
import { Box, ButtonBase, Collapse, Stack, Typography } from "@mui/material";
import { ChevronRightRounded, WorkHistoryRounded } from "@mui/icons-material";
import { INK, MUTED, LINE } from "@/shared/ui/PageKit";
import { formatThai } from "@/shared/utils/thaiDate";
import JobQuickView from "@/shared/ui/JobQuickView";
import { GROUP_BY_KEY } from "@/features/operation/utils/jobSummary";
import { statusBreakdown } from "../utils/customerJobs";

const FAINT = "#94a3b8";
const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

/**
 * @param jobs       งานของลูกค้า (จาก customerJobs.jobsByProject / jobsByCustomer)
 * @param showValue  แสดงมูลค่างานของงาน (ก่อน VAT)
 * @param employees  พนักงาน (รูปในหน้ารายละเอียดงาน)
 */
export default function CustomerJobsSection({ jobs = [], showValue = false, employees = [] }) {
  const [openYears, setOpenYears] = useState({});
  const [quickId, setQuickId] = useState(null);
  const breakdown = useMemo(() => statusBreakdown(jobs).filter((g) => g.count), [jobs]);
  const years = useMemo(() => {
    const by = new Map();
    jobs.slice().sort((a, b) => b.start.localeCompare(a.start)).forEach((j) => {
      const y = String(Number(j.start.slice(0, 4)) + 543);
      if (!by.has(y)) by.set(y, []);
      by.get(y).push(j);
    });
    return [...by.entries()];
  }, [jobs]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
        <WorkHistoryRounded sx={{ fontSize: 17, color: MUTED }} />
        <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.86rem", color: INK }}>งานในระบบ ({jobs.length})</Typography>
        {jobs.length > 0 && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>งานที่เข้าหลายวันนับเป็น 1 งาน · ไม่รวมนัดฝ่ายขาย</Typography>}
      </Stack>

      {!jobs.length ? (
        <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, p: 1.5 }}>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่มีงานของลูกค้ารายนี้ในระบบ</Typography>
        </Box>
      ) : (
        <>
          {/* สรุปสถานะ */}
          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(breakdown.length, 3)}, minmax(0, 1fr))`, gap: 0.75, mb: 1 }}>
            {breakdown.map((g) => (
              <Stack key={g.key} direction="row" alignItems="center" gap={0.75} sx={{ px: 1.1, py: 0.8, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: g.color, flexShrink: 0 }} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>{g.label}</Typography>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: INK, fontVariantNumeric: "tabular-nums" }}>{g.count}</Typography>
              </Stack>
            ))}
          </Box>

          {/* รายการงานรายปี */}
          <Stack spacing={1}>
            {years.map(([year, list], idx) => {
              const open = openYears[year] ?? idx === 0;
              // มูลค่าครั้งนี้ของงาน (1 ค่าต่องาน) รวมทั้งปี · ยอดที่ช่างแต่ละคนลงไม่นำมารวม
              const value = list.reduce((t, j) => t + (j.value || 0), 0);
              return (
                <Box key={year} sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, overflow: "hidden" }}>
                  <ButtonBase onClick={() => setOpenYears((p) => ({ ...p, [year]: !open }))}
                    sx={{ display: "flex", width: "100%", gap: 1, px: 1.5, py: 1, fontFamily: "inherit", textAlign: "left", "&:hover": { bgcolor: "#f8fafc" } }}>
                    <ChevronRightRounded sx={{ fontSize: 18, color: MUTED, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }} />
                    <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.84rem", color: INK }}>ปี {year}</Typography>
                    <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                      {list.length} งาน · เสร็จ {list.filter((j) => j.group === "closed").length}{showValue && value ? ` · มูลค่าครั้งนี้ ${baht(value)}` : ""}
                    </Typography>
                  </ButtonBase>
                  <Collapse in={open} unmountOnExit>
                    {list.map((j) => {
                      const g = GROUP_BY_KEY[j.group];
                      const multi = j.end && j.end !== j.start;
                      return (
                        <ButtonBase key={j.key} component="div" onClick={() => setQuickId(j.eventId)}
                          sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%", px: 1.5, py: 1, textAlign: "left", fontFamily: "inherit",
                            borderTop: `1px solid ${LINE}`, transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fafc" } }}>
                          <Box sx={{ width: 62, flexShrink: 0 }}>
                            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{formatThai(moment(j.start), "D MMM")}</Typography>
                            <Typography sx={{ fontSize: "0.66rem", color: MUTED }}>{j.visits > 1 ? `${j.visits} ช่วง` : multi ? `ถึง ${formatThai(moment(j.end), "D MMM")}` : "1 วัน"}</Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK }}>
                              {[j.title || "ไม่ระบุประเภท", j.system, j.time ? `ครั้งที่ ${j.time}` : ""].filter(Boolean).join(" · ")}
                            </Typography>
                            <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>
                              {[j.site, j.jobNo, j.responsible ? `ผู้รับผิดชอบ ${j.responsible}` : "", j.workers?.length ? `ทีม ${j.workers.join(", ")}` : ""].filter(Boolean).join(" · ")}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                            <Stack direction="row" alignItems="center" gap={0.5} justifyContent="flex-end">
                              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: g?.color || FAINT }} />
                              <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#334155", whiteSpace: "nowrap" }}>{g?.label || "—"}</Typography>
                            </Stack>
                            {/* 🔁 (17 พ.ย. 2569) มูลค่าครั้งนี้ของงาน (1 ค่า) + มูลค่างานรวมเทียบ */}
                            {showValue && (
                              <Typography sx={{ fontSize: "0.72rem", color: j.value === null ? FAINT : INK, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                {j.value === null ? "ยังไม่ใส่มูลค่า" : baht(j.value)}
                              </Typography>
                            )}
                            {showValue && j.jobTotal !== null && j.jobTotal !== undefined && (
                              <Typography noWrap sx={{ fontSize: "0.66rem", color: FAINT }}>จากมูลค่างานรวม {baht(j.jobTotal)}</Typography>
                            )}
                          </Box>
                          <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1" }} />
                        </ButtonBase>
                      );
                    })}
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        </>
      )}
      <JobQuickView eventId={quickId} onClose={() => setQuickId(null)} employees={employees} showValue={showValue} zIndex={1400} />
    </Box>
  );
}
