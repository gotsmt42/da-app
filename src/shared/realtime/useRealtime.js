/**
 * useRealtime — ให้ component ดึงข้อมูลใหม่เองทันทีที่ข้อมูลหมวดนั้นเปลี่ยน (ไม่ต้องกดรีเฟรช)
 *
 *   useRealtime(["expenses"], () => load({ silent: true }));
 *
 * ✅ สิ่งที่ hook จัดการให้:
 *   • รวบสัญญาณที่มาติดๆ กัน (เช่น "ตรวจสอบและอนุมัติ" ยิงสองคำสั่ง) ให้ดึงข้อมูลแค่ครั้งเดียว
 *   • แท็บที่ถูกซ่อนอยู่ไม่ดึงทันที — จำไว้แล้วดึงครั้งเดียวตอนกลับมาเปิดแท็บ (ไม่เปลืองเน็ต/แบตเตอรี่)
 *   • สัญญาณ "resync" (หลุดไปนานแล้วต่อกลับได้) → ดึงใหม่เสมอ
 *
 * ⚠️ onChange ควรดึงข้อมูลแบบ "เงียบ" (ไม่ขึ้นโครงโหลด/ไม่ล้างรายการเดิม) ไม่งั้นหน้าจะกระพริบทุกครั้ง
 * ที่คนอื่นกดอะไรสักอย่าง
 * ⚠️ อย่าใช้กับฟอร์มที่ผู้ใช้กำลังกรอก — ดึงข้อมูลมาทับจะทำให้สิ่งที่พิมพ์ค้างไว้หาย
 *
 * @param {string|string[]} topics  "expenses" | "events" | "dispatch" | "customers" | "users" | "products"
 *                                  | "files" | "documents" | "lookups"
 * @param {(evt: object) => void} onChange
 * @param {{ enabled?: boolean, debounceMs?: number, ignoreOwnTab?: boolean }} [opts]
 *   ignoreOwnTab: ข้ามสัญญาณที่แท็บนี้เป็นคนกดเอง — ใช้เมื่อหน้านั้นอัปเดตตัวเองหลังกดอยู่แล้ว
 */
import { useEffect, useRef } from "react";
import { CLIENT_ID, subscribeRealtime } from "./realtimeClient";

export default function useRealtime(topics, onChange, { enabled = true, debounceMs = 350, ignoreOwnTab = false } = {}) {
  const fnRef = useRef(onChange);
  useEffect(() => {
    fnRef.current = onChange;
  });

  const key = [].concat(topics || []).filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!enabled || !key) return undefined;
    let timer = null;
    let pending = null;
    let deferred = null;

    const fire = (evt) => {
      if (document.visibilityState === "hidden") {
        deferred = evt;
        return;
      }
      try {
        fnRef.current?.(evt);
      } catch (err) {
        console.error("useRealtime handler error:", err);
      }
    };

    const unsubscribe = subscribeRealtime(key.split(","), (evt) => {
      if (ignoreOwnTab && evt.type === "change" && evt.origin && evt.origin === CLIENT_ID) return;
      pending = evt;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const e = pending;
        pending = null;
        fire(e);
      }, debounceMs);
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible" || !deferred) return;
      const e = deferred;
      deferred = null;
      fire(e);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, enabled, debounceMs, ignoreOwnTab]);
}
