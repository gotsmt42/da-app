import { describe, it, expect } from "vitest";
import { buildJobReport, groupJobs, JOB_STAGES } from "./jobReport";

/**
 * ⚠️ จุดที่ต้องกันพลาดที่สุดคือ "1 งานที่เข้าหลายวันไม่ติดกัน = 1 งาน"
 *    ถ้านับเป็นแถว ตัวเลขในรายงานจะไม่ตรงกับการ์ดที่ผู้ใช้เห็นในหน้าการดำเนินงาน
 *    แล้วรายงานจะกลายเป็นตัวเลขที่เชื่อไม่ได้ทันที
 */
const row = (over) => ({
  _id: Math.random().toString(36).slice(2),
  jobGroupId: "",
  company: "ลูกค้า ก",
  site: "ไซต์ 1",
  title: "ติดตั้ง",
  system: "Fire Alarm",
  team: "สันติสุข",
  time: "1",
  status: "กำลังดำเนินการ",
  allDay: true,
  start: "2026-03-02",
  end: "2026-03-03",
  ...over,
});

describe("groupJobs", () => {
  it("งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) นับเป็นงานเดียว", () => {
    const jobs = groupJobs([
      row({ jobGroupId: "g1", start: "2026-03-02", end: "2026-03-03" }),
      row({ jobGroupId: "g1", start: "2026-03-20", end: "2026-03-21" }),
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].rows).toBe(2);
  });

  it("ตัวแทนของงานคือแถวที่วันสิ้นสุดช้าที่สุด (สถานะล่าสุด)", () => {
    const jobs = groupJobs([
      row({ jobGroupId: "g1", start: "2026-03-02", end: "2026-03-03", status: "ยืนยันแล้ว" }),
      row({ jobGroupId: "g1", start: "2026-03-20", end: "2026-03-21", status: "ดำเนินการเสร็จสิ้น" }),
    ]);
    expect(jobs[0].event.status).toBe("ดำเนินการเสร็จสิ้น");
  });

  it("งานคนละลูกค้าไม่ถูกยุบรวมกัน", () => {
    expect(groupJobs([row({ company: "ก" }), row({ company: "ข" })])).toHaveLength(2);
  });
});

describe("buildJobReport", () => {
  it("นับยอดรวมเป็นงาน ไม่ใช่แถว และรายงานจำนวนครั้งเข้างานแยกไว้", () => {
    const r = buildJobReport([
      row({ jobGroupId: "g1" }),
      row({ jobGroupId: "g1", start: "2026-04-01", end: "2026-04-02" }),
      row({ jobGroupId: "g2", company: "ลูกค้า ข" }),
    ]);
    expect(r.total).toBe(2);
    expect(r.visits).toBe(3);
  });

  it("แยกขั้นของงานครบทุกขั้น และคิดสัดส่วนงานที่ปิดแล้ว", () => {
    const r = buildJobReport([
      row({ jobGroupId: "a", status: "ดำเนินการเสร็จสิ้น" }),
      row({ jobGroupId: "b", status: "ดำเนินการเสร็จสิ้น" }),
      row({ jobGroupId: "c", status: "กำลังรอยืนยัน" }),
      row({ jobGroupId: "d", status: "กำลังดำเนินการ" }),
    ]);
    expect(r.pipeline.map((p) => p.key)).toEqual(JOB_STAGES);
    expect(r.done).toBe(2);
    expect(r.unconfirmed).toBe(1);
    expect(r.inProgress).toBe(1);
    expect(r.doneRate).toBe(50);
  });

  it("จัดงานเข้าเดือนของวันเข้างานครั้งสุดท้าย", () => {
    const r = buildJobReport([
      row({ jobGroupId: "g1", start: "2026-03-02", end: "2026-03-03" }),
      row({ jobGroupId: "g1", start: "2026-05-10", end: "2026-05-11" }),
    ]);
    expect(r.byMonth).toHaveLength(1);
    expect(r.byMonth[0].key).toBe("2026-05");
  });

  it("สรุปตามระบบ/ลูกค้า/ทีม เรียงจากมากไปน้อย", () => {
    const r = buildJobReport([
      row({ jobGroupId: "a", system: "CCTV", company: "ก", team: "สมชาย" }),
      row({ jobGroupId: "b", system: "Fire Alarm", company: "ข", team: "สมหญิง" }),
      row({ jobGroupId: "c", system: "Fire Alarm", company: "ข", team: "สมหญิง" }),
    ]);
    expect(r.bySystem[0]).toMatchObject({ key: "Fire Alarm", total: 2 });
    expect(r.byCustomer[0]).toMatchObject({ key: "ข", total: 2 });
    expect(r.byTeam[0]).toMatchObject({ key: "สมหญิง", total: 2 });
  });

  it("ช่องว่างถูกแทนด้วยคำอธิบาย ไม่ปล่อยเป็นค่าว่างให้อ่านไม่ออก", () => {
    const r = buildJobReport([row({ jobGroupId: "a", system: "", company: "", site: "", team: "", responsiblePerson: "" })]);
    expect(r.bySystem[0].key).toBe("ไม่ระบุระบบ");
    expect(r.byCustomer[0].key).toBe("ไม่ระบุโครงการ");
    expect(r.byTeam[0].key).toBe("ยังไม่มอบหมาย");
  });

  it("ค้างงานนับจากแผนที่ส่งเข้ามา ไม่ได้เดาเอง", () => {
    const a = row({ jobGroupId: "a" });
    const b = row({ jobGroupId: "b", company: "ลูกค้า ข" });
    const map = new Map([
      [a._id, { days: 30, groupKey: "a" }],   // เกิน 2 สัปดาห์ = ค้างงาน
      [b._id, { days: 10, groupKey: "b" }],   // เกิน 1 สัปดาห์ = เตือน
    ]);
    const r = buildJobReport([a, b], { daysPastDueMap: map });
    expect(r.overdue).toBe(1);
    expect(r.warning).toBe(1);
  });

  it("ไม่ส่งแผนค้างงานมา ต้องไม่พังและค้างงานเป็นศูนย์", () => {
    const r = buildJobReport([row({ jobGroupId: "a" })]);
    expect(r.overdue).toBe(0);
  });

  it("ไม่มีงานเลย ต้องคืนโครงว่างที่ใช้วาดได้", () => {
    const r = buildJobReport([]);
    expect(r.total).toBe(0);
    expect(r.doneRate).toBe(0);
    expect(r.pipeline).toHaveLength(JOB_STAGES.length);
  });
});

describe("การกรองช่วงวัน", () => {
  it("กรองหลังยุบเป็นงานแล้ว — งานที่คร่อมขอบช่วงยังนับครบทั้งงาน", () => {
    const rows = [
      row({ jobGroupId: "g1", start: "2026-02-25", end: "2026-02-26" }),
      row({ jobGroupId: "g1", start: "2026-03-10", end: "2026-03-11" }),
    ];
    // วันเข้างานครั้งสุดท้ายคือ 10 มี.ค. จึงต้องอยู่ในช่วงเดือนมีนาคม ไม่ใช่กุมภาพันธ์
    expect(buildJobReport(rows, { from: "2026-03-01", to: "2026-03-31" }).total).toBe(1);
    expect(buildJobReport(rows, { from: "2026-02-01", to: "2026-02-28" }).total).toBe(0);
  });
});
