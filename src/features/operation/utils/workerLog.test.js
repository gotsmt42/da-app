import { describe, it, expect } from "vitest";
import { buildWorkerEntries, filterEntries, summarizeEntries, jobCompleteness } from "./workerLog";

const ev = (o) => ({ status: "ดำเนินการเสร็จสิ้น", company: "A", site: "S1", title: "PM", system: "FA", allDay: true, ...o });

// มูลค่ารายคนของงาน g1 — ทุกคนลง 1000 เท่ากัน
const G1_VALUES = ["A", "B", "C"].map((name) => ({ name, amount: 1000, at: "2026-10-03" }));

describe("workerLog", () => {
  const events = [
    // งานหลายวัน 2 ช่วง (jobGroupId เดียวกัน) — คนไม่ตรงกันแต่ละช่วง
    ev({ _id: "1", jobGroupId: "g1", start: "2026-10-03", end: "2026-10-05", team: "A", teamMembers: [{ name: "B" }], workValue: 1000, workerValues: G1_VALUES }),
    ev({ _id: "2", jobGroupId: "g1", start: "2026-10-10", end: "2026-10-11", team: "A", teamMembers: [{ name: "C" }], workValue: 1000, workerValues: G1_VALUES }),
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

  // ✅ (17 พ.ย. 2569) มูลค่ารายคน — คน 1 ลง 5000 · คน 2 ลง 3000 → แยกกัน ไม่ทับ ไม่รวม
  it("มูลค่ารายคน: แต่ละคนได้ยอดที่ตัวเองลง · มูลค่างานของงานแยกไว้", () => {
    const wv = [{ name: "A", amount: 5000, at: "2026-11-01" }, { name: "B", amount: 3000, at: "2026-11-01" }];
    const rows = [
      ev({ _id: "p1", jobGroupId: "p", start: "2026-11-05", end: "2026-11-05", team: "A", teamMembers: [{ name: "B" }, { name: "C" }], workValue: 9000, workerValues: wv }),
      ev({ _id: "p2", jobGroupId: "p", start: "2026-11-06", end: "2026-11-06", team: "A", teamMembers: [{ name: "B" }, { name: "C" }], workValue: 9000, workerValues: wv }),
    ];
    const es = buildWorkerEntries(rows);
    expect(es.find((r) => r.name === "A").value).toBe(5000);
    expect(es.find((r) => r.name === "B").value).toBe(3000);
    expect(es.find((r) => r.name === "C").value).toBeNull();
    const s = summarizeEntries(es);
    expect(s.totals.total).toBe(8000);          // ผลรวมรายคน (ไม่ใช่ 9000 × 3 แบบเดิม)
    expect(s.totals.jobValueTotal).toBe(9000);  // มูลค่างานของงาน นับครั้งเดียว
    expect(s.totals.missing).toBe(1);
  });

  it("ข้อมูลเดิม (ยังไม่มีรายคน): ยอดเดิมนับให้คนที่ลงเท่านั้น · รวม VAT แปลงเป็นก่อน VAT", () => {
    const es = buildWorkerEntries([
      ev({ _id: "L1", start: "2026-11-07", end: "2026-11-07", site: "S9", team: "A", teamMembers: [{ name: "B" }], workValue: 1070, workValueVatIncluded: true, workValueBy: "B Lastname" }),
    ]);
    expect(es.find((r) => r.name === "B").value).toBe(1000);
    expect(es.find((r) => r.name === "A").value).toBeNull();
  });

  it("ผูกการกดเข้างานรายคน (checkIns) — เทียบ userId หรือชื่อคำแรก", () => {
    const att = [
      { eventId: "1", userId: "u-a", userName: "A Lastname", checkIn: { at: "2026-10-03T02:00:00Z" } },
      { eventId: "2", userId: "u-c", userName: "C", checkIn: { at: "2026-10-10T02:00:00Z" } },
    ];
    const withAtt = buildWorkerEntries(events, att);
    expect(withAtt.find((r) => r.name === "A").checkIns).toHaveLength(1);
    expect(withAtt.find((r) => r.name === "B" && r.date === "2026-10-03").checkIns).toHaveLength(0);
    expect(withAtt.find((r) => r.name === "C").checkIns).toHaveLength(1);
    const s2 = summarizeEntries(withAtt);
    expect(s2.totals.checked).toBe(2);
  });
});

// ✅ (17 พ.ย. 2569) ความครบของงาน — Service Report · เอกสารงาน PM · สรุปงาน
describe("jobCompleteness", () => {
  it("ไม่มีฟิลด์ (server เก่า) = ไม่รู้ ไม่นับ", () => {
    expect(jobCompleteness([{ title: "PM" }])).toEqual({ hasReport: null, docsOk: null, hasSummary: null });
  });
  it("PM ต้องมีเอกสารการเงิน + ใบส่งมอบ · งานอื่นไม่นับเอกสาร PM", () => {
    const pm = jobCompleteness([{ title: "PM", reportFiles: [{ fileUrl: "a" }], documentSentReport: true, invoiceFiles: [{ fileUrl: "b" }], completionFiles: [], description: "ล้างหัวฉีด" }]);
    expect(pm).toEqual({ hasReport: true, docsOk: false, hasSummary: true });
    const sv = jobCompleteness([{ title: "Service", reportFiles: [], description: "" }]);
    expect(sv).toEqual({ hasReport: false, docsOk: null, hasSummary: false });
  });
});
