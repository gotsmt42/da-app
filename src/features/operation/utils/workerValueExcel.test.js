import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkerValueReport, personValueSource, addWorkerValueSheets, SUMMARY_SHEET, DETAIL_SHEET } from "./workerValueExcel";

const ev = (id, extra = {}) => ({
  _id: id, jobGroupId: id, start: "2026-11-10T01:00:00Z", site: `โครงการ ${id}`, title: "PM", system: "FA",
  team: "สมชาย", teamMembers: [{ name: "วิชัย" }], status: "ดำเนินการเสร็จสิ้น", ...extra,
});

describe("buildWorkerValueReport", () => {
  const jobs = [
    { sessions: [ev("A", { workValue: 20000, workerValues: [{ name: "สมชาย", amount: 8000, by: "สมชาย", at: "2026-11-11" }, { name: "วิชัย", amount: 5000, by: "แอดมิน" }] })] },
    { sessions: [ev("B", { start: "2026-11-05T01:00:00Z", workerValues: [{ name: "สมชาย", amount: 10700, vatIncluded: true, by: "สมชาย ใจดี" }] })] },
    // ยอดเดิม: ช่างในทีม (วิชัย) ลงมูลค่าครั้งนี้ของงานก่อนแยกช่อง → เป็นผลงานของวิชัย
    { sessions: [ev("C", { start: "2026-11-12T01:00:00Z", workValue: 3000, workValueBy: "วิชัย", workValueAt: "2026-11-01" })] },
  ];

  it("แยกยอดรายคน ไม่รวมกันระหว่างคน · รวมเฉพาะของคนเดียวกันข้ามงาน", () => {
    const rep = buildWorkerValueReport(jobs);
    const som = rep.find((p) => p.name === "สมชาย");
    const wic = rep.find((p) => p.name === "วิชัย");
    expect(som.total).toBeCloseTo(8000 + 10000); // 10,700 รวม VAT → ก่อน VAT 10,000
    expect(som).toMatchObject({ jobs: 3, lead: 3, valued: 2, missing: 1, self: 2, proxy: 0, legacy: 0 });
    expect(wic.total).toBe(5000 + 3000);
    expect(wic).toMatchObject({ jobs: 3, lead: 0, valued: 2, missing: 1, self: 0, proxy: 1, legacy: 1 });
    expect(rep[0].name).toBe("สมชาย"); // เรียงผลงานมาก → น้อย
  });

  it("รายการงานเรียงตามวันที่ · มีที่มา/VAT/เทียบมูลค่าของงาน", () => {
    const som = buildWorkerValueReport(jobs).find((p) => p.name === "สมชาย");
    expect(som.entries.map((e) => e.site)).toEqual(["โครงการ B", "โครงการ A", "โครงการ C"]);
    expect(som.entries[0]).toMatchObject({ amount: 10700, vatIncluded: true, net: 10000, source: "ลงเอง", role: "หัวหน้าทีม" });
    expect(som.entries[1]).toMatchObject({ net: 8000, jobValue: 20000 });
    expect(som.entries[2]).toMatchObject({ net: null, source: "", jobValue: 3000 });
  });

  it("only = เฉพาะคนที่กรอง", () => {
    const rep = buildWorkerValueReport(jobs, { only: "วิชัย" });
    expect(rep.map((p) => p.name)).toEqual(["วิชัย"]);
  });

  it("personValueSource", () => {
    expect(personValueSource(null, "a")).toBe("");
    expect(personValueSource({ legacy: true }, "a")).toMatch(/ยอดเดิม/);
    expect(personValueSource({ by: "แอดมิน" }, "วิชัย")).toBe("ลงแทนโดย แอดมิน");
    expect(personValueSource({ by: "วิชัย สมใจ" }, "วิชัย")).toBe("ลงเอง");
  });

  it("เขียนชีตสรุป + แยกงาน (ลิงก์ชื่อ · บรรทัดรวมเป็นสูตร SUM)", async () => {
    const wb = new ExcelJS.Workbook();
    addWorkerValueSheets(wb, jobs, { groupLabel: "กลุ่ม: ทั้งหมด", filterSummary: "-", exportedAt: "18/11/2569" });
    const ws = wb.getWorksheet(SUMMARY_SHEET);
    const wd = wb.getWorksheet(DETAIL_SHEET);
    expect(ws && wd).toBeTruthy();
    const first = ws.getRow(6);
    expect(first.getCell(2).value.text).toBe("สมชาย");
    expect(first.getCell(2).value.hyperlink).toMatch(/^#'ผลงานรายช่าง \(แยกงาน\)'!A\d+$/);
    expect(first.getCell(8).value).toBeCloseTo(18000);
    // ไม่มีแถวรวมทุกคน
    const texts = [];
    ws.eachRow((row) => row.eachCell((c) => texts.push(String(c.value?.text ?? c.value ?? ""))));
    expect(texts.some((t) => /รวมทุกคน|รวมทั้งหมด/.test(t))).toBe(false);
    const sums = [];
    wd.eachRow((row) => row.eachCell((c) => { if (c.value?.formula) sums.push(c.value); }));
    expect(sums).toHaveLength(2);
    expect(sums[0].formula).toMatch(/^SUM\(K\d+:K\d+\)$/);
    await wb.xlsx.writeBuffer();
  });
});
