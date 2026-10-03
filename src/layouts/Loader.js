/**
 * Loader — หน้าโหลดตอนเปิดแอป (Suspense ชั้นนอกสุดใน src/index.js)
 * ✅ เดิมเป็น div ว่าง (โค้ดจำลองโหลด 3 วินาทีที่ถูกคอมเมนต์ทิ้ง) ผู้ใช้เห็นจอขาวเปล่า — ใช้ PageLoader กลางแทน
 */
import PageLoader from "@/shared/ui/PageLoader";

const Loader = () => <PageLoader variant="fullscreen" label="กำลังเปิดระบบ…" />;

export default Loader;
