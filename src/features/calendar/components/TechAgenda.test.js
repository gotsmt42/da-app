import { describe, it, expect } from "vitest";
import moment from "moment";
import { rowOf, mergeGroups, segLabel } from "./TechAgenda";

const y = moment().year();
const ev = (id, start, end, extra = {}) => ({ _id: id, start: `${y}-${start}`, end: end ? `${y}-${end}` : undefined, allDay: true, status: "ยืนยันแล้ว", ...extra });

describe("TechAgenda — งานหลายวัน / ไม่ต่อเนื่อง", () => {
  it("งานวันเดียว และงานต่อเนื่องหลายวัน (end แบบ exclusive ของ allDay)", () => {
    expect(segLabel(rowOf(ev("a", "04-17")).segs)).toBe("17 เม.ย.");
    expect(segLabel(rowOf(ev("b", "04-15", "04-18")).segs)).toBe("15–17 เม.ย.");
    expect(segLabel(rowOf(ev("c", "04-28", "05-03")).segs)).toBe("28 เม.ย. – 2 พ.ค.");
  });

  it("หลาย document ที่ผูก jobGroupId เดียวกัน รวมเป็นงานเดียว เรียงช่วงวันตามจริง", () => {
    const rows = mergeGroups([
      rowOf(ev("x2", "04-20", "04-22", { jobGroupId: "g1" })),
      rowOf(ev("solo", "04-01")),
      rowOf(ev("x1", "04-15", undefined, { jobGroupId: "g1", status: "ดำเนินการเสร็จสิ้น" })),
    ]);
    expect(rows).toHaveLength(2);
    const g = rows.find((r) => r.groupId === "g1");
    expect(segLabel(g.segs)).toBe("15 เม.ย., 20–21 เม.ย.");
    expect(g.start.format("MM-DD")).toBe("04-15");
    expect(g.end.format("MM-DD")).toBe("04-21");
    // สถานะ/งานที่เปิด = ช่วงแรกที่ยังไม่เสร็จ
    expect(g.id).toBe("x2");
    expect(g.st).toBe("ยืนยันแล้ว");
  });
});
