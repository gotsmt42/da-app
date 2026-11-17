import { describe, it, expect } from "vitest";
import { buildAllJobs, jobsByProject, jobsByCustomer, rankProjects, duplicateProjectKeys, projectKey, statusBreakdown } from "./customerJobs";

const ev = (o) => ({ title: "PM", system: "FA", allDay: true, status: "ดำเนินการเสร็จสิ้น", ...o });

describe("customerJobs — นับงานกติกาเดียวกับหน้าการดำเนินงาน", () => {
  const events = [
    // งานเดียวเข้า 3 วัน (jobGroupId เดียวกัน) = 1 งาน
    ev({ _id: "1", jobGroupId: "g", site: "Amazon", start: "2026-11-01", end: "2026-11-02" }),
    ev({ _id: "2", jobGroupId: "g", site: "Amazon", start: "2026-11-05", end: "2026-11-06" }),
    ev({ _id: "3", jobGroupId: "g", site: " Amazon ", start: "2026-11-08", end: "2026-11-09" }),
    ev({ _id: "4", site: "Amazon", start: "2026-10-01", end: "2026-10-02", title: "Service", status: "ยืนยันแล้ว" }),
    // นัดฝ่ายขาย ไม่นับ
    ev({ _id: "5", site: "Amazon", start: "2026-10-03", department: "sales" }),
    ev({ _id: "6", company: "Zire", site: "Zire HQ", start: "2026-10-03", end: "2026-10-04" }),
  ];
  const jobs = buildAllJobs(events);

  it("หลายวัน = 1 งาน · ไม่นับนัดฝ่ายขาย", () => {
    expect(jobsByProject(jobs).get(projectKey("", "Amazon"))).toHaveLength(2);
    expect(jobsByCustomer(jobs).get("zire")).toHaveLength(1);
  });

  it("อันดับโครงการ", () => {
    const r = rankProjects(jobs);
    expect(r[0]).toMatchObject({ site: "Amazon", count: 2, closed: 1 });
    expect(r[1].name).toBe("Zire · Zire HQ");
  });

  it("สถานะรวม = จำนวนงาน", () => {
    expect(statusBreakdown(jobs).reduce((s, g) => s + g.count, 0)).toBe(jobs.length);
  });

  it("ทะเบียนชื่อซ้ำ", () => {
    const d = duplicateProjectKeys([{ cSite: "Amazon" }, { cSite: "amazon " }, { cSite: "Zire" }]);
    expect(d.has(projectKey("", "Amazon"))).toBe(true);
    expect(d.size).toBe(1);
  });
});
