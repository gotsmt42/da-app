import { useEffect, useRef } from "react";

/**
 * ปิดแผ่นตัวกรอง (bottom sheet บนมือถือ) ทันทีที่ผู้ใช้ "เลือก" ค่าใดค่าหนึ่ง — ไม่ต้องกด "ดูผลลัพธ์" อีกที
 * (ผู้ใช้ขอ: "เวลากดเลือกตัวกรองให้ปิด และแสดงข้อมูลได้เลย")
 *
 * ⚠️ ส่งเฉพาะค่าที่ได้จากการ "เลือก" (การ์ด/select) — ห้ามใส่ช่องค้นหา ไม่งั้นพิมพ์ตัวแรกแผ่นก็ปิดแล้ว
 *
 * @param open      แผ่นเปิดอยู่ไหม
 * @param onClose   ปิดแผ่น
 * @param values    อ็อบเจกต์ค่าตัวกรองที่เลือกได้ เช่น { status, person }
 * @param skip      (prev, next) => true เมื่อไม่ควรปิด — เช่นเพิ่งเลือก "กำหนดเอง" ที่ยังต้องกรอกวันที่ต่อ
 */
export default function useCloseOnPick(open, onClose, values, skip) {
  const key = JSON.stringify(values);
  const prev = useRef({ key, values });
  useEffect(() => {
    const before = prev.current;
    prev.current = { key, values };
    if (!open || before.key === key) return;
    if (skip && skip(before.values, values)) return;
    onClose();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
