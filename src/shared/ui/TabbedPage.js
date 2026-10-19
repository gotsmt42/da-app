/**
 * TabbedPage — โครงหน้าแบบ "หน้าเดียวหลายแท็บ" ที่ใช้ร่วมกันทุกหน้าที่ถูกยุบรวม
 *
 * ✅ ทำไมต้องมี: เดิมข้อมูลประเภทเดียวกันถูกแยกเป็นคนละหน้าในเมนู (ลูกค้าอยู่ 2 ที่ / พนักงานอยู่ 2 ที่ /
 * เอกสารกระจาย 2 หน้า / สายเงินแยก 2 หมวด) ทำให้เมนูยาวและต้องจำว่าเรื่องเดียวกันอยู่ตรงไหนบ้าง
 * — ยุบให้เหลือหน้าเดียวต่อ 1 เรื่อง แล้วแยกมุมมองด้วยแท็บแทน
 *
 * ⚠️ ตั้งใจไม่มีหัวข้อหน้าของตัวเอง มีแค่แถบแท็บ — หน้าที่เอามารวมกันทุกหน้ามีหัวข้อ+ไอคอนของตัวเอง
 * อยู่แล้ว ถ้าใส่หัวข้ออีกชั้นจะกลายเป็นหัวข้อซ้อนหัวข้อทุกหน้า
 *
 * ⚠️ สถานะแท็บเก็บใน URL (?tab=) ไม่ใช่ใน state — จำเป็นเพราะ:
 *   • URL เดิมทั้งหมดถูก redirect มาที่หน้ารวมพร้อมระบุแท็บ (ลิงก์เก่า/บุ๊กมาร์กเก่าต้องไม่พัง)
 *   • ปุ่ม back ของเบราว์เซอร์ต้องย้อนแท็บได้ตามที่คนใช้คาดหวัง
 *   • ส่งลิงก์หากันโดยเจาะจงแท็บได้
 *
 * ⚠️ เรนเดอร์เฉพาะแท็บที่เปิดอยู่ (ไม่ mount ทุกแท็บพร้อมกัน) — หน้าที่เอามารวมกันแต่ละหน้ายิง API
 * ของตัวเองตอน mount ถ้า mount ไว้ทั้งหมดจะยิงคำขอที่ผู้ใช้ยังไม่ได้เปิดดูทุกครั้งที่เข้าหน้า
 * และบางหน้ายัง redirect ตัวเองถ้า role ไม่ผ่าน (เช่น TeamWorkload) ซึ่งจะลาก "ทั้งแอป" ออกไป
 * /dashboard ทันทีแม้ผู้ใช้ไม่ได้เปิดแท็บนั้นด้วยซ้ำ — จึงต้องกรองแท็บตามสิทธิ์ตั้งแต่ต้นทางด้วย
 */
import { Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Skeleton } from "@mui/material";
import { TabStrip } from "@/shared/ui/SectionTabs";
import { PAGE_SX } from "@/shared/ui/PageKit";

/**
 * @param {Array} tabs [{ key, label, icon, render: () => node }] — กรองตามสิทธิ์มาก่อนแล้ว
 */
const TabbedPage = ({ tabs }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs = useMemo(() => (tabs || []).filter(Boolean), [tabs]);
  const requested = searchParams.get("tab");
  // ⚠️ ถ้า ?tab= ชี้ไปแท็บที่ไม่มี/ไม่มีสิทธิ์เห็น ให้ตกกลับมาแท็บแรกเสมอ ไม่ใช่จอว่าง —
  // เกิดได้จริงเวลาช่างกดลิงก์ที่แอดมินส่งให้ หรือลิงก์เก่าที่ชี้แท็บที่ถูกเปลี่ยนชื่อไปแล้ว
  const activeKey = visibleTabs.some((t) => t.key === requested)
    ? requested
    : visibleTabs[0]?.key;
  const activeTab = visibleTabs.find((t) => t.key === activeKey);

  const handleChange = (_, key) => {
    // ⚠️ replace:true — การสลับแท็บไม่ควรทิ้งประวัติไว้ทุกครั้ง ไม่งั้นกด back หลังสลับไปมา 5 รอบ
    // ต้องกดย้อน 5 ครั้งกว่าจะออกจากหน้านี้ได้
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      {/* ✅ ซ่อนแถบแท็บถ้าเหลือแท็บเดียว — เกิดได้จริงตามสิทธิ์ผู้ใช้ (เช่น manager เห็นแค่ "ภาพรวม"
          ไม่เห็น "ทะเบียน" ซึ่งเป็นของ admin) แท็บเดี่ยวๆ ที่กดไปก็ไม่มีอะไรเปลี่ยน มีแต่ทำให้งง */}
      {/* ✅ (19 ต.ค. 2569) แถบแท็บกล่องขาวชุดเดียวกับกลุ่มงาน (TabStrip) อยู่ในกรอบกว้างเดียวกับเนื้อหา (PAGE_SX)
          mb ติดลบ = หักระยะบนของหน้าด้านใน (PAGE_SX.py) ออก ให้ระยะแท็บ→หัวเพจเท่ากับหน้าอื่นทุกหน้า (12px) */}
      {visibleTabs.length > 1 && (
        <Box sx={{ ...PAGE_SX, pb: 0, mb: { xs: -1.25, sm: -2.5 } }}>
          <TabStrip items={visibleTabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon, on: t.key === activeKey, onClick: () => handleChange(null, t.key) }))} />
        </Box>
      )}

      {/* ⚠️ key={activeKey} — บังคับให้ React ถอดของเดิมออกแล้วสร้างใหม่ตอนสลับแท็บ ไม่ใช่ reuse
          โครงเดิม หน้าที่เอามารวมกันแต่ละหน้ามี state/effect ของตัวเองที่ไม่ได้ออกแบบมาให้สลับกันกลางคัน */}
      <Suspense key={activeKey} fallback={<Skeleton variant="rounded" height={320} sx={{ borderRadius: 3, m: 2 }} />}>
        {activeTab?.render()}
      </Suspense>
    </>
  );
};

export default TabbedPage;
