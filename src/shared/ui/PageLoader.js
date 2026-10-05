/**
 * PageLoader — หน้ากำลังโหลดชุดเดียวกันทั้งแอป
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "แก้ไขหน้าโหลด ให้สมบูรณ์และสวยงาม ทันสมัย รวมถึงหน้า loading อื่นๆ ทั้งหมด"
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "แก้ไขหน้าโหลดทุกๆ หน้าให้มีโลโก้ TidTam ให้เหมือนกันทั้งหมด"
 *    + "ให้เป็นตัวหนังสือที่เคยทำแบบเดิม (Tid ดำ Tam แดง) แต่ให้ทุกหน้า · ไม่ใช่โลโก้ไอคอนแอป"
 *    ทุกแบบใช้ตัวหนังสือ TidTam ชุดเดียวกับหัวเว็บ (/app-wordmark-dark.png) + แถบวิ่งใต้ชื่อ + ข้อความ
 *    ⚠️ เป็นเครื่องหมายของ "แอป" เท่านั้น — ไม่ใช่โลโก้บริษัท (ห้ามดึงจากตั้งค่าองค์กร)
 *
 * @param {"page"|"fullscreen"|"overlay"|"inline"|"bar"} variant
 *   page = กลางพื้นที่เนื้อหา (ค่าเริ่มต้น ใช้กับ Suspense ของแต่ละหน้า) · fullscreen = ตอนเปิดแอป/ตรวจสิทธิ์
 *   overlay = ทับกล่องที่ position:relative · inline = ในกล่องเล็ก · bar = แถบบางบนสุด (โหลดซ้ำ ไม่บังข้อมูล)
 */
import "./PageLoader.css";

export const WORDMARK_SRC = "/app-wordmark-dark.png?v=16";

/** ตัวหนังสือ TidTam + แถบวิ่งใต้ชื่อ — ใช้ซ้ำได้ทุกที่ที่ต้องการตัวบอกสถานะโหลดแบบมีแบรนด์ */
export function BrandSpinner({ width = 132 }) {
  return (
    <div className="pl-mark" style={{ "--pl-w": `${width}px` }} aria-hidden="true">
      <img src={WORDMARK_SRC} alt="" className="pl-word" draggable="false" />
      <div className="pl-track"><span /></div>
    </div>
  );
}

export default function PageLoader({ variant = "page", label = "กำลังโหลด…", sub, small = false }) {
  if (variant === "bar") return <div className="pl-bar" role="progressbar" aria-label={label} />;
  const full = variant === "fullscreen";
  const cls = ["pl-root", variant !== "page" && `pl-root--${variant}`, small && "pl-root--sm"].filter(Boolean).join(" ");
  const width = full ? 190 : small ? 84 : variant === "page" ? 132 : 112;
  return (
    <div className={cls} role="status" aria-live="polite">
      <BrandSpinner width={width} />
      {full && <div className="pl-tag">ติดตามทุกงานจนจบ</div>}
      {label && <div className="pl-label">{label}</div>}
      {sub && <div className="pl-sub">{sub}</div>}
    </div>
  );
}
