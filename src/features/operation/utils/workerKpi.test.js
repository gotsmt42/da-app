import { describe, it, expect } from "vitest";
import { buildPersonKpis, gradeOf, sortPeople, formatKpi } from "./workerKpi";

// แถว "คน × งาน" แบบที่ buildWorkerEntries คืน (เฉพาะฟิลด์ที่ KPI ใช้)
const row = (o) => ({ id: Math.random().toString(36), jobKey: o.jobKey || o.id || "j", days: 1, lead: false, value: null, checkIns: [], done: true, status: "ดำเนินการเสร็จสิ้น", date: "2026-11-01", endDate: "2026-11-01", ...o });

describe("workerKpi", () => {
  const today = "2026-11-20";
  const entries = [
    // A: 2 ครั้ง ลงครบ กดเข้างานครบ
    row({ name: "A", jobKey: "j1", value: 5000, days: 2, lead: true, checkIns: ["x"] }),
    row({ name: "A", jobKey: "j2", value: 3000, days: 1, checkIns: ["x"] }),
    // B: งานเดียวกับ A (j1) ลง 3000 · ครั้งที่ 2 ยังไม่ลง ไม่กดเข้างาน ยังไม่ปิด
    row({ name: "B", jobKey: "j1", value: 3000, days: 2, checkIns: ["x"] }),
    row({ name: "B", jobKey: "j3", value: null, days: 1, done: false, status: "กำลังดำเนินการ" }),
    // C: ขอปิดงานแล้ว รอแอดมินตรวจ = ส่งปิดแล้ว (ไม่ใช่ปัญหา)
    row({ name: "C", jobKey: "j5", value: 1000, checkIns: ["x"], done: false, closeRequested: true, status: "กำลังดำเนินการ" }),
    // B: งานในอนาคต — ไม่นับในอัตรา %
    row({ name: "B", jobKey: "j4", date: "2026-11-25", endDate: "2026-11-25", done: false, status: "ยืนยันแล้ว" }),
  ];
  const { people, team } = buildPersonKpis(entries, { today });
  const A = people.find((p) => p.name === "A");
  const B = people.find((p) => p.name === "B");

  it("ยอดแยกรายคน ไม่รวมกัน · สัดส่วนในทีม", () => {
    expect(A.total).toBe(8000);
    expect(B.total).toBe(3000);
    expect(team.total).toBe(12000);
    expect(A.share).toBeCloseTo(8000 / 12000);
  });

  it("เฉลี่ย/ต่อวัน หารเฉพาะครั้งที่ลงมูลค่า", () => {
    expect(A.avgPerVisit).toBe(4000);
    expect(A.perDay).toBeCloseTo(8000 / 3);
    expect(B.avgPerVisit).toBe(3000);   // ไม่หารด้วย 3 ครั้ง
    expect(B.perDay).toBe(1500);        // 3000 ÷ 2 วันของครั้งที่ลงแล้ว
  });

  it("อัตรา % คิดจากงานที่ผ่านไปแล้วเท่านั้น", () => {
    expect(B.past).toBe(2);
    expect(B.upcoming).toBe(1);
    expect(B.fillRate).toBe(0.5);
    expect(B.checkInRate).toBe(0.5);
    expect(B.doneRate).toBe(0.5);
    expect(A.fillRate).toBe(1);
  });

  it("ขอปิดงานแล้ว (รอตรวจ) นับเป็นส่งปิดแล้ว", () => {
    const C = people.find((p) => p.name === "C");
    expect(C.doneRate).toBe(1);
    expect(C.pastPending).toBe(1);
    expect(C.issueCount).toBe(0);
  });

  it("ประเมินได้เมื่อข้อมูลครบ · รายการที่ต้องแก้", () => {
    expect(A.reliable).toBe(true);
    expect(B.reliable).toBe(false);
    expect(B.issueList.map((x) => x.key).sort()).toEqual(["missingValue", "noCheckIn", "notClosed"]);
    expect(B.issueCount).toBe(3);
    expect(team.reliable).toBe(false);
  });

  it("เกรดตามเกณฑ์ · เรียง · ข้อความ", () => {
    expect(gradeOf("fillRate", 0.96)).toBe("good");
    expect(gradeOf("fillRate", 0.85)).toBe("warn");
    expect(gradeOf("fillRate", 0.5)).toBe("bad");
    expect(gradeOf("fillRate", null)).toBe("na");
    expect(sortPeople(people, "issues")[0].name).toBe("B");
    expect(sortPeople(people, "perDay")[0].name).toBe("A");
    expect(formatKpi("fillRate", 0.5)).toBe("50%");
    expect(formatKpi("perDay", null)).toBe("–");
  });

  it("มูลค่างานที่เข้าร่วม — รายคนเต็มจำนวน · ทีมนับงานละครั้ง", () => {
    const { people: ps, team: tm } = buildPersonKpis([
      row({ name: "A", jobKey: "x", jobValue: 9000 }),
      row({ name: "B", jobKey: "x", jobValue: 9000 }),
      row({ name: "A", jobKey: "y", jobValue: 1000 }),
      row({ name: "A", jobKey: "z", jobValue: null }),
    ], { today });
    expect(ps.find((p) => p.name === "A")).toMatchObject({ jobValueSum: 10000, jobsWithValue: 2 });
    expect(ps.find((p) => p.name === "B").jobValueSum).toBe(9000);
    expect(tm.jobValueSum).toBe(10000);
  });
});
