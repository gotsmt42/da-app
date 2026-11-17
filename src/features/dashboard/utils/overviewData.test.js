import { describe, it, expect } from "vitest";
import moment from "moment";
import { buildOverview, overviewRange } from "./overviewData";
import { buildJobs, summarizeJobs, filterJobs } from "@/features/operation/utils/jobSummary";
import { buildDaysPastDueMap } from "@/shared/utils/overdueJobs";

const ev = (o) => ({ company: "C", title: "PM", system: "FA", allDay: true, status: "ดำเนินการเสร็จสิ้น", ...o });

describe("overviewData — ตัวเลขหน้าแรกตรงกับหน้ารายงาน", () => {
  const now = moment("2026-11-17");
  const events = [
    ev({ _id: "1", jobGroupId: "g1", site: "S1", start: "2026-11-02", end: "2026-11-03", team: "A", teamMembers: [{ name: "B" }], workValue: 9000,
      workerValues: [{ name: "A", amount: 5000, at: "2026-11-02" }, { name: "B", amount: 3000, at: "2026-11-02" }] }),
    ev({ _id: "2", site: "S2", start: "2026-11-05", end: "2026-11-06", team: "B", status: "ยืนยันแล้ว" }),
    ev({ _id: "3", site: "S3", start: "2026-10-10", end: "2026-10-11", team: "A", workValue: 1000 }),
  ];
  const [from, to] = overviewRange("month", now);
  const o = buildOverview(events, [], { from, to, today: "2026-11-17", now });

  it("จำนวนงาน/มูลค่า = summarizeJobs ของหน้าสรุปผลการดำเนินงาน", () => {
    const ref = summarizeJobs(filterJobs(buildJobs(events, buildDaysPastDueMap(events)), { from, to }));
    expect(o.summary.totals.total).toBe(ref.totals.total);
    expect(o.summary.totals.value).toBe(ref.totals.value);
    expect(o.summary.totals.total).toBe(2);
    expect(o.summary.totals.value).toBe(9000);
  });

  it("สถานะรวมกัน = จำนวนงาน", () => {
    expect(o.statusRows.reduce((s, r) => s + r.count, 0)).toBe(o.summary.totals.total);
  });

  it("ผลงานรายคน = ยอดที่แต่ละคนลงเอง (ไม่ใช่มูลค่างานของงาน)", () => {
    expect(o.people.find((p) => p.name === "A").total).toBe(5000);
    expect(o.people.find((p) => p.name === "B").total).toBe(3000);
    expect(o.team.total).toBe(8000);
  });

  it("แนวโน้ม 6 เดือน — เดือนล่าสุดคือเดือนนี้", () => {
    expect(o.trend).toHaveLength(6);
    expect(o.trend[5].key).toBe("2026-11");
    expect(o.trend[4]).toMatchObject({ key: "2026-10", total: 1, closed: 1 });
  });

  it("โหมดของฉัน — เฉพาะงานที่ฉันอยู่", () => {
    const mine = buildOverview(events, [], { from, to, today: "2026-11-17", now, me: "B" });
    expect(mine.summary.totals.total).toBe(2);
    expect(mine.people.map((p) => p.name)).toEqual(["B"]);
  });
});
