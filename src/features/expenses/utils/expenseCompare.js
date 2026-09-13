/**
 * expenseCompare.js — จับคู่ "รายการตั้งเบิก (Advance)" กับ "รายการใช้จริง (ใบเคลม)" ทีละบรรทัด
 *
 * ✅ ผู้ใช้ขอ: "ในใบเคลมต้องมีรายละเอียดของ Advance นั้นๆ แสดงข้างๆ เพื่อให้ตรวจสอบและดูง่าย"
 * ใช้ตัวเดียวกันทั้ง ฟอร์มออกใบเคลม / หน้ารายละเอียด / PDF — สามที่ต้องจับคู่เหมือนกันเป๊ะ
 *
 * กติกาการจับคู่:
 *   1. ใบเคลมที่คัดลอกมาจาก Advance มี advanceItemIndex ชี้แถวต้นทางไว้ → จับคู่ด้วยตัวนี้ก่อน
 *   2. แถวตั้งเบิกที่ไม่มีใครอ้างถึง = "ไม่ได้ใช้" → ยังต้องโชว์ (ยอดจริง 0) ไม่งั้นผู้ตรวจไม่เห็นว่าหายไป
 *   3. แถวใช้จริงที่ไม่ได้อ้างแถวไหน = "รายการเพิ่ม" (ตั้งเบิก 0)
 * ⚠️ ห้ามจับคู่ด้วยชื่อรายการ — ชื่อซ้ำกันได้บ่อย (ค่าน้ำมัน 2 เที่ยว) จะจับผิดแถวแล้วส่วนต่างรายบรรทัดผิดหมด
 */
import { money } from "../expenseMeta";

/**
 * @param {Array} claimItems
 * @param {Array} advanceItems
 * @returns {{ rows: Array, plannedTotal: number, actualTotal: number }}
 *   row = { key, kind: "matched"|"unused"|"added", category, description, detail, receiptNo,
 *           planned, actual, plannedAmount, actualAmount, diff }
 */
export function compareItems(claimItems = [], advanceItems = []) {
  const used = new Set();
  const rows = [];

  (claimItems || []).forEach((it, i) => {
    const idx = Number.isInteger(it?.advanceItemIndex) ? it.advanceItemIndex : null;
    const planned = idx !== null && advanceItems?.[idx] && !used.has(idx) ? advanceItems[idx] : null;
    if (planned) used.add(idx);
    const plannedAmount = money(planned?.amount || 0);
    const actualAmount = money(it?.amount || 0);
    rows.push({
      key: `c${i}`,
      kind: planned ? "matched" : "added",
      category: it?.category || planned?.category || "other",
      description: it?.description || planned?.description || "",
      detail: it?.detail || "",
      receiptNo: it?.receiptNo || "",
      planned,
      actual: it,
      plannedAmount,
      actualAmount,
      diff: money(actualAmount - plannedAmount),
      order: planned ? idx : 10_000 + i,
    });
  });

  (advanceItems || []).forEach((it, idx) => {
    if (used.has(idx)) return;
    const plannedAmount = money(it?.amount || 0);
    rows.push({
      key: `a${idx}`,
      kind: "unused",
      category: it?.category || "other",
      description: it?.description || "",
      detail: it?.detail || "",
      receiptNo: "",
      planned: it,
      actual: null,
      plannedAmount,
      actualAmount: 0,
      diff: money(-plannedAmount),
      order: idx + 0.5,
    });
  });

  // เรียงตามลำดับในใบ Advance ก่อน (อ่านเทียบกับใบต้นทางได้ตรงบรรทัด) แล้วตามด้วยรายการที่เพิ่มมา
  rows.sort((a, b) => a.order - b.order);
  rows.forEach((r) => { delete r.order; });

  return {
    rows,
    plannedTotal: money(rows.reduce((s, r) => s + r.plannedAmount, 0)),
    actualTotal: money(rows.reduce((s, r) => s + r.actualAmount, 0)),
  };
}

export const COMPARE_KIND_LABEL = {
  matched: "",
  unused: "ไม่ได้ใช้",
  added: "รายการเพิ่ม",
};
