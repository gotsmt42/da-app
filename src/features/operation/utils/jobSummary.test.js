import { describe, it, expect } from "vitest";
import moment from "moment";
import { buildJobs, filterJobs, summarizeJobs } from "./jobSummary";
import { buildDaysPastDueMap } from "@/shared/utils/overdueJobs";

const d = (n) => moment().subtract(n, "days").format("YYYY-MM-DD");
const ev = (o) => ({ company: "A", site: "S", title: "PM", system: "FA", team: "T", allDay: true, status: "ยืนยันแล้ว", approvalStatus: "approved", ...o });

describe("jobSummary — กติกาเดียวกับหน้าการดำเนินงาน", () => {
  const events = [
    ev({ _id: "1", jobGroupId: "g1", start: d(40), end: d(39), status: "ดำเนินการเสร็จสิ้น", workValue: 500 }),
    ev({ _id: "2", jobGroupId: "g1", start: d(30), end: d(29), status: "ดำเนินการเสร็จสิ้น", workValue: 500 }),
    ev({ _id: "3", site: "S2", start: d(20), end: d(19) }), // ค้าง (เกิน 1 สัปดาห์)
    ev({ _id: "4", site: "S3", start: d(20), end: d(19), closeRequested: true }), // รอตรวจปิดงาน ไม่ใช่ค้าง
    ev({ _id: "5", site: "S4", start: d(1), end: d(-1), status: "กำลังดำเนินการ" }),
    ev({ _id: "6", site: "S5", start: d(1), end: d(0), department: "sales" }), // ไม่นับ
  ];
  const jobs = buildJobs(events, buildDaysPastDueMap(events));

  it("งานหลายวัน = 1 งาน · ไม่นับฝ่ายขาย · 1 งานอยู่สถานะเดียว", () => {
    expect(jobs).toHaveLength(4);
    const s = summarizeJobs(jobs);
    expect(s.statusRows.reduce((a, g) => a + g.count, 0)).toBe(s.totals.total);
    expect(s.statusRows.find((g) => g.key === "closed").count).toBe(1);
    expect(s.statusRows.find((g) => g.key === "overdue").count).toBe(1);
    expect(s.statusRows.find((g) => g.key === "pending").count).toBe(1);
    expect(s.statusRows.find((g) => g.key === "working").count).toBe(1);
    expect(s.totals.value).toBe(500);
    expect(s.totals.severe).toBe(1);
  });

  it("กรองช่วงตามวันเริ่มงาน", () => {
    expect(filterJobs(jobs, { from: d(25), to: d(0) })).toHaveLength(3);
  });
});
