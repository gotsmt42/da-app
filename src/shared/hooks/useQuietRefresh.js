/**
 * useQuietRefresh — รีเฟรชข้อมูลหน้าเบื้องหลังแบบ "ไม่กวนฟอร์มที่เปิดอยู่"
 *
 * ✅ (28 พ.ย. 2569 ผู้ใช้: "ทุกๆ ฟอร์มของ event มันไม่สมูท เวลาเลื่อนขึ้นลง จะแลคๆ หน่วงๆ")
 *    หน้าปฏิทิน/การดำเนินงานโหลดงานใหม่ทุก 30–60 วิ และทุกครั้งที่มีคนอื่นแก้งาน (เรียลไทม์) แล้ววาดทั้งหน้าใหม่
 *    — งานหลายร้อยใบใช้เวลาหลายร้อย ms ระหว่างนั้นฟอร์ม (SweetAlert) ที่เปิดทับอยู่กระตุก
 *    → ระหว่างมีฟอร์มเปิด: จดไว้ก่อน · ปิดฟอร์มแล้วโหลดให้ทันที (เช็คทุก 1.5 วิ) · ไม่มีฟอร์ม = โหลดทันทีเหมือนเดิม
 * @param {Function} fn ฟังก์ชันโหลดข้อมูล (เรียกตัวล่าสุดเสมอ ไม่ต้อง memo)
 * @returns {Function} เรียกแทน fn ตรงๆ
 */
import { useCallback, useEffect, useRef } from "react";
import Swal from "@/shared/ui/swal";

export default function useQuietRefresh(fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const pending = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      if (pending.current && !Swal.isVisible()) {
        pending.current = false;
        fnRef.current?.();
      }
    }, 1500);
    return () => clearInterval(t);
  }, []);
  return useCallback(() => {
    if (Swal.isVisible()) { pending.current = true; return; }
    fnRef.current?.();
  }, []);
}
