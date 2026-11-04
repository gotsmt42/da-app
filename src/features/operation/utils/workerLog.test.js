import { describe, it, expect } from "vitest";
import { buildWorkerEntries, filterEntries, summarizeEntries } from "./workerLog";

const ev = (o) => ({ status: "ดำเนินการเสร็จสิ้น", company: "A", site: "S1", title: "PM", system: "FA", allDay: true, ...o });

describe("workerLog", () => {
  const events = [
    // งานหลายวัน 2 ช่วง (jobGroupId เดียวกัน) — คนไม่ตรงกันแต่ละช่วง
    ev({ _id: "1", jobGroupId: "g1", start: "2026-10-03", end: "2026-10-05", team: "A", teamMembers: [{ name: "B" }], workValue: 1000 }),
    ev({ _id: "2", jobGroupId: "g1", start: "2026-10-10", end: "2026-10-11", team: "A", teamMembers: [{ name: "C" }], workValue: 1000 }),
    // งานเดี่ยว ยังไม่ใส่มูลค่า
    ev({ _id: "3", start: "2026-11-02", end: "2026-11-03", site: "S2", team: "B", teamMembers: [], status: "ยืนยันแล้ว" }),
    // นัดฝ่ายขาย ไม่นับ
    ev({ _id: "4", start: "2026-11-02", end: "2026-11-03", team: "A", department: "sales" }),
  ];
  const entries = buildWorkerEntries(events);

  it("1 แถว = 1 คน × 1 งาน · นับวันแต่ละช่วง", () => {
    expect(entries).toHaveLength(4); // g1: A,B,C · งาน 3: B
    const a = entries.find((r) => r.name === "A");
    expect(a).toMatchObject({ lead: true, date: "2026-10-03", endDate: "2026-10-10", days: 3, value: 1000, teamSize: 3 });
    const c = entries.find((r) => r.name === "C");
    expect(c).toMatchObject({ lead: false, date: "2026-10-10", days: 1 });
  });

  it("กรองช่วงวัน/คน/มูลค่า", () => {
    expect(filterEntries(entries, { from: "2026-11-01", to: "2026-11-30" })).toHaveLength(1);
    expect(filterEntries(entries, { person: "B" })).toHaveLength(2);
    expect(filterEntries(entries, { valueMode: "missing" })).toHaveLength(1);
    expect(filterEntries(entries, { status: "open" })).toHaveLength(1);
  });

  it("สรุปรายคน/เดือน · มูลค่าจริงนับงานละครั้ง", () => {
    const s = summarizeEntries(entries);
    expect(s.totals.total).toBe(3000);
    expect(s.totals.jobValueTotal).toBe(1000);
    expect(s.totals.missing).toBe(1);
    expect(s.byPerson.find((p) => p.key === "B")).toMatchObject({ visits: 2, total: 1000, missing: 1 });
    expect(s.months).toEqual(["2026-10", "2026-11"]);
    expect(s.pivot.get("A").get("2026-10")).toEqual({ visits: 1, total: 1000 });
  });
});
