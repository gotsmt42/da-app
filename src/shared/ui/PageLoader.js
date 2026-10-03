/**
 * PageLoader — หน้ากำลังโหลดชุดเดียวกันทั้งแอป
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "แก้ไขหน้าโหลด ให้สมบูรณ์และสวยงาม ทันสมัย รวมถึงหน้า loading อื่นๆ ทั้งหมด"
 *    เดิมแต่ละที่ต่างกัน: ข้อความ "Loading..." ภาษาอังกฤษเปล่าๆ · จุดสามจุดสีฟ้าลอยมุมจอ · ข้อความเทาอย่างเดียว
 *
 * @param {"page"|"fullscreen"|"overlay"|"inline"|"bar"} variant
 *   page = กลางพื้นที่เนื้อหา (ค่าเริ่มต้น ใช้กับ Suspense ของแต่ละหน้า) · fullscreen = ตอนเปิดแอป/ตรวจสิทธิ์
 *   overlay = ทับกล่องที่ position:relative · inline = ในกล่องเล็ก · bar = แถบบางบนสุด (โหลดซ้ำ ไม่บังข้อมูล)
 */
import "./PageLoader.css";

export default function PageLoader({ variant = "page", label = "กำลังโหลด…", sub, small = false }) {
  if (variant === "bar") return <div className="pl-bar" role="progressbar" aria-label={label} />;
  const cls = ["pl-root", variant !== "page" && `pl-root--${variant}`, small && "pl-root--sm"].filter(Boolean).join(" ");
  return (
    <div className={cls} role="status" aria-live="polite">
      {variant === "fullscreen" && <div className="pl-brand">Tid<b>Tam</b></div>}
      <div className="pl-ring" aria-hidden="true" />
      {label && <div className="pl-label">{label}</div>}
      {sub && <div className="pl-sub">{sub}</div>}
    </div>
  );
}
