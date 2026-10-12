/**
 * ✅ (12 ต.ค. 2569 ผู้ใช้: "ทำไมในแอพมือถือเปิดข้อมูลนี้ไม่ได้" — ขึ้น "มีเวอร์ชันใหม่ของระบบ โหลดใหม่")
 *
 * ต้นเหตุ: มือถือเปิดแอปค้างไว้ (PWA/แท็บเบื้องหลัง) ตั้งแต่ก่อน deploy — หน้าในแอปโหลดแยกไฟล์ (lazy)
 * ชื่อไฟล์เปลี่ยนทุกครั้งที่ deploy และไฟล์ชื่อเก่าถูกลบไปแล้ว พอกดเข้าหน้าที่ยังไม่เคยเปิด (เช่น "งานใหม่")
 * จึงโหลดไฟล์หน้านั้นไม่ได้ → หน้า "มีเวอร์ชันใหม่" (หน้าที่เคยเปิดแล้วยังอยู่ในแคชของเครื่อง จึงดูเหมือนเสียแค่บางหน้า)
 *
 * ✅ เช็คล่วงหน้าว่ามีรุ่นใหม่ไหม (เทียบไฟล์ entry ใน index.html ล่าสุดกับที่เครื่องกำลังใช้)
 *    ทุก 5 นาที + ทุกครั้งที่กลับมาเปิดแอป → ถ้ามีรุ่นใหม่ จะรีโหลดเงียบๆ ตอน "เปลี่ยนหน้า" ครั้งถัดไป
 *    (ไม่รีโหลดกลางคันระหว่างผู้ใช้กรอกฟอร์มอยู่ในหน้าเดิม)
 * ⚠️ ทำงานเฉพาะ production build — dev ไม่มีไฟล์ /assets/index-*.js
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const CHECK_MS = 5 * 60_000;
const ENTRY_RE = /\/assets\/index-[\w-]+\.js/;

const currentEntry = () => {
  const s = [...document.querySelectorAll("script[type=module][src]")].map((el) => el.getAttribute("src")).find((src) => ENTRY_RE.test(src));
  return s ? s.match(ENTRY_RE)[0] : "";
};

export default function useNewBuildReload() {
  const location = useLocation();
  const stale = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const mine = currentEntry();
    if (!mine) return undefined;
    let busy = false;
    const check = async () => {
      if (busy || stale.current || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store" });
        const latest = (await res.text()).match(ENTRY_RE)?.[0];
        if (latest && latest !== mine) stale.current = true;
      } catch {
        /* เน็ตหลุด — รอบหน้าค่อยเช็คใหม่ */
      } finally {
        busy = false;
      }
    };
    const t = setInterval(check, CHECK_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // เปลี่ยนหน้า + มีรุ่นใหม่ → โหลดหน้าปลายทางใหม่ทั้งหน้า (ได้ไฟล์รุ่นล่าสุด)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (stale.current) window.location.reload();
  }, [location.pathname]);
}
