import { describe, it, expect } from "vitest";
import { addMonthsKey, monthDiff, thaiMonthLabel, buildContractPlan, suggestFirstMonth, roundsByMonthOfYear, planIntervalOf, compactOverrides, planYearSpanLabel, sentPlanOf, adherenceOf } from "./contractPlan";

const TODAY = new Date("2026-11-26T10:00:00");

describe("month helpers", () => {
  it("adds months across years and handles negatives", () => {
    expect(addMonthsKey("2026-11", 3)).toBe("2027-02");
    expect(addMonthsKey("2026-01", -1)).toBe("2025-12");
    expect(addMonthsKey("2026-05", 24)).toBe("2028-05");
  });
  it("diffs months", () => {
    expect(monthDiff("2026-11", "2027-02")).toBe(3);
    expect(monthDiff("2027-02", "2026-11")).toBe(-3);
  });
  it("labels in Buddhist era", () => {
    expect(thaiMonthLabel("2026-03")).toBe("มี.ค. 69");
    expect(thaiMonthLabel("2026-03", { full: true })).toBe("มีนาคม 2569");
    expect(thaiMonthLabel("")).toBe("-");
  });
});

describe("buildContractPlan", () => {
  const c = { intervalMonths: 3, contractYears: 2, contractStart: "2026-04-01", contractEnd: "2028-03-31", visits: [] };

  it("spaces every round by the interval through all contract years", () => {
    const plan = buildContractPlan(c, "2026-05", { today: TODAY });
    expect(plan.total).toBe(8);
    expect(plan.rounds.map((r) => r.month)).toEqual(["2026-05", "2026-08", "2026-11", "2027-02", "2027-05", "2027-08", "2027-11", "2028-02"]);
    expect(plan.groups.map((g) => [g.label, g.rounds.length])).toEqual([["2569-70", 4], ["2570-71", 4]]);
    expect(plan.rounds[4].label).toBe("1/4 - 2570-71");
    expect(plan.nextYearFirst).toBe("2028-05");
    expect(plan.issues).toEqual([]);
  });

  it("marks state from real visits and the current month", () => {
    const withVisits = { ...c, visits: [
      { time: 1, start: "2026-05-12", status: "ดำเนินการเสร็จสิ้น" },
      { time: 2, start: "2026-09-03", status: "รอดำเนินการ" },
      { time: 4, unscheduled: true },
    ] };
    const plan = buildContractPlan(withVisits, "2026-05", { today: TODAY });
    expect(plan.rounds.slice(0, 4).map((r) => r.state)).toEqual(["done", "scheduled", "due", "planned"]);
    expect(plan.rounds[1].shift).toBe(1);
    const later = buildContractPlan(c, "2026-05", { today: new Date("2027-01-10") });
    expect(later.rounds[2].state).toBe("overdue");
  });

  it("warns when rounds fall after the contract end", () => {
    const plan = buildContractPlan({ ...c, contractYears: 1, contractEnd: "2027-03-31" }, "2026-08", { today: TODAY });
    expect(plan.rounds.map((r) => r.afterEnd)).toEqual([false, false, false, true]);
    expect(plan.issues[0]).toContain("เลยวันสิ้นสุดสัญญา");
  });

  it("projects the next year when asked", () => {
    const plan = buildContractPlan({ ...c, contractYears: 1 }, "2026-05", { today: TODAY, extraYears: 1 });
    expect(plan.rounds).toHaveLength(8);
    expect(plan.rounds.filter((r) => r.projected).map((r) => r.month)).toEqual(["2027-05", "2027-08", "2027-11", "2028-02"]);
    expect(plan.groups[1].projected).toBe(true);
  });

  it("uses months picked by hand and keeps the rest computed", () => {
    const plan = buildContractPlan({ ...c, contractYears: 1, planMonths: ["", "", "2027-01"] }, "2026-05", { today: TODAY });
    expect(plan.rounds.map((r) => r.month)).toEqual(["2026-05", "2026-08", "2027-01", "2027-02"]);
    expect(plan.rounds.map((r) => r.manual)).toEqual([false, false, true, false]);
    expect(plan.rounds[2].computedMonth).toBe("2026-11");
    // ค่าที่เท่ากับค่าคำนวณ = ไม่นับว่าแก้เอง · ครั้งที่ 1 ใช้ firstMonth เสมอ
    const same = buildContractPlan({ ...c, contractYears: 1 }, "2026-05", { today: TODAY, overrides: ["2020-01", "2026-08"] });
    expect(same.rounds.map((r) => r.manual)).toEqual([false, false, false, false]);
    expect(same.rounds[0].month).toBe("2026-05");
  });

  it("places scheduled rounds in the month they were actually booked", () => {
    const plan = buildContractPlan({ ...c, visits: [{ time: 2, start: "2026-09-03", status: "" }] }, "2026-05", { today: TODAY });
    expect(roundsByMonthOfYear(plan, 2569)[8].map((r) => r.time)).toEqual([2]);
  });

  it("derives the interval from visits per year when it was never set", () => {
    expect(planIntervalOf({ visitCount: 2 })).toEqual({ interval: 6, assumed: true });
    expect(planIntervalOf({ intervalMonths: 4 })).toEqual({ interval: 4, assumed: false });
  });
});

describe("suggestFirstMonth", () => {
  const base = { intervalMonths: 3, contractYears: 1, contractStart: "2026-04-01", contractEnd: "2027-03-31", visits: [] };
  it("prefers the saved month", () => {
    expect(suggestFirstMonth({ ...base, planFirstMonth: "2026-06" }).source).toBe("saved");
  });
  it("works back from the earliest scheduled round", () => {
    const s = suggestFirstMonth({ ...base, visits: [{ time: 2, start: "2026-08-20" }] });
    expect(s).toMatchObject({ month: "2026-05", source: "visits" });
  });
  it("continues from the previous contract's plan on renewal", () => {
    const prev = { ...base, contractStart: "2025-04-01", contractEnd: "2026-03-31", planFirstMonth: "2025-05" };
    const s = suggestFirstMonth(base, { prev });
    expect(s).toMatchObject({ month: "2026-05", source: "renewal" });
  });
  it("falls back to the contract start month", () => {
    expect(suggestFirstMonth(base)).toMatchObject({ month: "2026-04", source: "start" });
  });
});

describe("roundsByMonthOfYear", () => {
  it("buckets rounds into the 12 months of a Buddhist year", () => {
    const plan = buildContractPlan({ intervalMonths: 3, contractYears: 2, contractStart: "2026-04-01", visits: [] }, "2026-05", { today: TODAY });
    const cells = roundsByMonthOfYear(plan, 2570);
    expect(cells.map((x) => x.length)).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  });
});

describe("plan helpers", () => {
  it("compacts overrides", () => {
    expect(compactOverrides(["", "2026-08", "", "bad", ""])).toEqual(["", "2026-08"]);
    expect(compactOverrides(undefined)).toEqual([]);
  });
  it("labels the Buddhist-year span of the months", () => {
    expect(planYearSpanLabel(["2026-10", "2027-07"])).toBe("2569-70");
    expect(planYearSpanLabel(["2026-02", "2026-08"])).toBe("2569");
    expect(planYearSpanLabel([])).toBe("");
  });
});

describe("sent plan tracking", () => {
  const c = {
    intervalMonths: 3, contractYears: 1, contractStart: "2026-04-01",
    visits: [
      { time: 1, start: "2026-05-12", status: "ดำเนินการเสร็จสิ้น" },
      { time: 2, start: "2026-09-03", status: "รอดำเนินการ" },
    ],
    planSentDocs: [
      { docNumber: "000040/2569", issuedAt: "2026-04-10", rows: [{ time: 1, month: "2026-05" }, { time: 2, month: "2026-08" }, { time: 3, month: "2026-10" }] },
      { docNumber: "000048/2569", issuedAt: "2026-06-01", rows: [{ time: 3, month: "2026-11" }, { time: 4, month: "2027-02" }] },
    ],
  };
  it("merges sent documents, the latest wins per round", () => {
    const s = sentPlanOf(c);
    expect(s.byTime.get(3).month).toBe("2026-11");
    expect(s.byTime.get(1).doc.docNumber).toBe("000040/2569");
    expect(s.last.docNumber).toBe("000048/2569");
  });
  it("compares real bookings with the months told to the customer", () => {
    const plan = buildContractPlan(c, "2026-05", { today: TODAY });
    const a = adherenceOf(plan, sentPlanOf(c), TODAY);
    expect([1, 2, 3, 4].map((t) => a.rows.get(t).status)).toEqual(["ontime", "shifted", "due", "upcoming"]);
    expect(a.rows.get(2).diff).toBe(1);
    expect(a.counts).toMatchObject({ total: 4, ontime: 1, shifted: 1, due: 1, upcoming: 1, problem: 1 });
    const later = adherenceOf(plan, sentPlanOf(c), new Date("2026-12-05"));
    expect(later.rows.get(3).status).toBe("missed");
  });
  it("is empty when nothing was sent", () => {
    const plan = buildContractPlan({ ...c, planSentDocs: [] }, "2026-05", { today: TODAY });
    expect(adherenceOf(plan, sentPlanOf({}), TODAY).counts.total).toBe(0);
  });
});
