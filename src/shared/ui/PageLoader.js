/**
 * PageLoader — หน้ากำลังโหลดชุดเดียวกันทั้งแอป
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "แก้ไขหน้าโหลด ให้สมบูรณ์และสวยงาม ทันสมัย รวมถึงหน้า loading อื่นๆ ทั้งหมด"
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "หน้าโหลดทุกหน้าให้มีตัวอักษร TidTam และ load ด้านล่าง · เอาไว้กึ่งกลางหน้าจอ"
 *    ตัวหนังสือ TidTam (ภาพเดียวกับหัวเว็บ) → วงแหวนหมุน → ข้อความ เรียงกลางจอ
 *
 * 🐛 ที่แก้ (5 ต.ค. 2569 ผู้ใช้: "ขึ้นตัวอักษรใหญ่มาก ใช้งานไม่ได้"): เดิมจัดหน้าด้วยไฟล์ .css แยก ซึ่งมีจังหวะที่
 *    หน้าโหลดโผล่ "ก่อน" สไตล์มาถึง → ภาพโลโก้ขนาดจริง 592px ชิดซ้ายบน ✅ ตอนนี้ขนาด/ตำแหน่งทุกอย่างเป็น
 *    inline style (มาพร้อมตัว element เสมอ) ส่วน keyframes ฝังเป็น <style> ในตัว component เอง
 *    ⚠️ ห้ามย้ายขนาดภาพกลับไปไว้ในไฟล์ .css อีก
 *
 * @param {"page"|"fullscreen"|"overlay"|"inline"|"bar"} variant
 *   page = กลางจอ (ค่าเริ่มต้น ใช้กับ Suspense ของแต่ละหน้า — ไม่บังเมนู/หัวเว็บ กดได้ตามปกติ)
 *   fullscreen = ตอนเปิดแอป/ตรวจสิทธิ์ (พื้นทึบทั้งจอ) · overlay = ทับกล่องที่ position:relative
 *   inline = ในกล่องเล็ก · bar = แถบบางบนสุด (โหลดซ้ำ ไม่บังข้อมูล)
 */
export const WORDMARK_SRC = "/app-wordmark-dark.png?v=16";

const KEYFRAMES = `
@keyframes tt-spin { to { transform: rotate(360deg); } }
@keyframes tt-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes tt-slide { from { left: -40%; } to { left: 100%; } }
@media (prefers-reduced-motion: reduce) { .tt-spin { animation-duration: 2.4s !important; } }
`;

const ROOT = {
  page: { position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none" },
  fullscreen: { position: "fixed", inset: 0, zIndex: 2000, background: "#f8fafc" },
  overlay: { position: "absolute", inset: 0, zIndex: 20, background: "rgba(248,250,252,.85)" },
  inline: { width: "100%", minHeight: 160, padding: "24px 16px" },
};

/** ตัวหนังสือ TidTam + วงแหวนหมุนด้านล่าง — ใช้ซ้ำได้ทุกที่ */
export function BrandSpinner({ width = 132 }) {
  const ring = Math.round(Math.max(18, Math.min(30, width / 5.5)));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(ring * 0.75) }} aria-hidden="true">
      <img
        src={WORDMARK_SRC} alt="" draggable="false"
        style={{ display: "block", width, maxWidth: "70vw", height: "auto", userSelect: "none" }}
      />
      <span
        className="tt-spin"
        style={{
          display: "block", width: ring, height: ring, boxSizing: "border-box", borderRadius: "50%",
          border: `${ring > 22 ? 3 : 2.5}px solid #e2e8f0`, borderTopColor: "#2563eb",
          animation: "tt-spin .8s linear infinite",
        }}
      />
    </div>
  );
}

export default function PageLoader({ variant = "page", label = "กำลังโหลด…", sub, small = false }) {
  if (variant === "bar") {
    return (
      <div role="progressbar" aria-label={label} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, overflow: "hidden", zIndex: 20, background: "rgba(37,99,235,.12)", borderRadius: 3 }}>
        <style>{KEYFRAMES}</style>
        <span style={{ position: "absolute", top: 0, bottom: 0, width: "40%", borderRadius: 3, background: "linear-gradient(90deg, transparent, #2563eb, transparent)", animation: "tt-slide 1.1s ease-in-out infinite" }} />
      </div>
    );
  }
  const full = variant === "fullscreen";
  const width = full ? 168 : small ? 84 : variant === "page" ? 140 : 112;
  const box = (
    <div
      role="status" aria-live="polite"
      style={{
        ...(ROOT[variant] || ROOT.page),
        ...(small ? { minHeight: 0, padding: 16 } : null),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: small ? 8 : 14, boxSizing: "border-box", textAlign: "center",
        fontFamily: "'IBM Plex Sans Thai', system-ui, sans-serif",
        // ✅ โผล่หลัง 150ms กันกระพริบตอนโหลดเร็ว (fullscreen ต่อจาก splash ใน index.html ทันที ไม่ต้องหน่วง)
        opacity: full ? 1 : 0, animation: full ? "none" : "tt-fade .25s ease-out .15s forwards",
      }}
    >
      <style>{KEYFRAMES}</style>
      <BrandSpinner width={width} />
      {label && <div style={{ fontSize: small ? 12.5 : 13.5, fontWeight: 600, color: "#64748b", letterSpacing: ".01em" }}>{label}</div>}
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: -8 }}>{sub}</div>}
    </div>
  );
  // page: ตัวหน้าโหลดลอยกลางจอ แต่ต้องกันพื้นที่ความสูงไว้ด้วย ไม่งั้น footer ของหน้าเด้งขึ้นมาอยู่บนสุด
  return variant === "page" ? <div style={{ minHeight: "calc(100dvh - 160px)" }}>{box}</div> : box;
}
