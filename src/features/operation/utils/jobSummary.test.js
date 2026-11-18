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

  // ✅ (17 พ.ย. 2569) มูลค่าครั้งนี้ของงาน (1 ค่าต่องาน) · มูลค่างานรวมเทียบ (สัญญานับครั้งเดียว) · ยอดที่ช่างลงไม่ถูกรวม
  it("มูลค่าครั้งนี้ของงาน + มูลค่างานรวมเทียบ · ยอดรายคนไม่ถูกรวม", () => {
    const evs = [
      ev({ _id: "c1", contractGroupId: "K", time: "1", start: d(20), end: d(20), jobValue: 40000, workValue: 10000, team: "A", workerValues: [{ name: "A", amount: 5000 }] }),
      ev({ _id: "c2", contractGroupId: "K", time: "2", start: d(10), end: d(10), jobValue: 40000, workValue: 10000, team: "B", teamMembers: [{ name: "C" }], workerValues: [{ name: "B", amount: 3000 }, { name: "C", amount: 2000 }] }),
    ];
    const sm = summarizeJobs(buildJobs(evs, new Map()));
    expect(sm.totals.value).toBe(20000);     // มูลค่าครั้งนี้ของงาน 2 ครั้ง
    expect(sm.totals.jobTotal).toBe(40000);  // มูลค่างานรวม นับสัญญาละครั้ง
  });

  // ✅ (18 พ.ย. 2569 ผู้ใช้: "งานที่เข้าไม่ต่อเนื่องหลายช่วง ไม่เอามูลค่างานมารวมกัน")
  it("งานหลายช่วงวัน: มูลค่าครั้งนี้นับครั้งเดียว (ทั้งมี jobGroupId และงานเก่าที่ทีมแต่ละช่วงไม่ตรงกัน)", () => {
    const evs = [
      // มี jobGroupId · 3 ช่วง เก็บยอดเดียวกันทุกช่วง
      ev({ _id: "g1", jobGroupId: "G", site: "BKK", start: d(30), end: d(30), workValue: 50000 }),
      ev({ _id: "g2", jobGroupId: "G", site: "BKK", start: d(20), end: d(20), workValue: 50000 }),
      ev({ _id: "g3", jobGroupId: "G", site: "BKK", start: d(10), end: d(10), workValue: 50000 }),
      // งานเก่าไม่มี jobGroupId · 2 ช่วงคนละทีม (การ์ดแยก) · ยอดเท่ากัน = งานเดียวกัน
      ev({ _id: "o1", site: "HQ", time: "1", team: "A", start: d(25), end: d(25), workValue: 8000 }),
      ev({ _id: "o2", site: "HQ", time: "1", team: "B", start: d(24), end: d(24), workValue: 8000 }),
    ];
    const sm = summarizeJobs(buildJobs(evs, new Map()));
    expect(sm.totals.value).toBe(58000);
  });
});

