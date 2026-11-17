/**
 * useElementWidth — ความกว้างจริงของกล่อง (ไม่ใช่ความกว้างจอ)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "รองรับการใช้งานให้ครบทุกขนาดหน้าจอ ให้สวยงาม ดูง่าย")
 *    ตาราง/การ์ดที่ต้องเปลี่ยนรูปตามพื้นที่จริง — จอใหญ่แต่เปิดแถบเมนูข้าง หรือแท็บเล็ตแนวนอน
 *    พื้นที่เนื้อหาแคบกว่าที่ breakpoint ของจอบอก · วัดจากกล่องเองจึงถูกทุกกรณี
 *    ใช้: const [ref, width] = useElementWidth(); <Box ref={ref}>…  · ยังไม่วัด = 0
 */
import { useCallback, useEffect, useRef, useState } from "react";

export default function useElementWidth() {
  const [width, setWidth] = useState(0);
  const observer = useRef(null);
  const ref = useCallback((el) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setWidth((prev) => (prev === w ? prev : w));
    });
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, width];
}
