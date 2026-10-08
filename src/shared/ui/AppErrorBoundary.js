/**
 * AppErrorBoundary — ตัวรับ error ตอนแสดงผล ไม่ให้ทั้งแอปกลายเป็นจอขาว
 *
 * 🐛 เดิมไม่มี error boundary เลยสักชั้น — error เดียวตอน render (หรือโหลดไฟล์หน้าไม่สำเร็จ) ทำให้
 *    React ถอดทั้งแอปออก เหลือจอขาวเปล่าๆ ไม่มีปุ่มอะไรให้กด (ผู้ใช้: "ต้องคอยรีเฟรชถึงจะมา")
 * ✅ variant="page" ห่อเนื้อหาแต่ละหน้า (เมนู/แถบบนยังอยู่ กดไปหน้าอื่นได้) · resetKey = path → เปลี่ยนหน้าแล้วหายเอง
 *    variant="app"  ห่อทั้งแอปเป็นชั้นสุดท้าย
 * ✅ error จาก "ไฟล์รุ่นเก่าหาย" (หลัง deploy) → รีโหลดให้เองทันที 1 ครั้ง (ดู lazyWithRetry)
 */
import { Component } from "react";
import { isChunkLoadError, reloadForFreshBuild } from "@/shared/utils/lazyWithRetry";

const box = {
  maxWidth: 420, margin: "12vh auto 0", padding: "28px 24px", textAlign: "center",
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,.05)",
  fontFamily: "inherit", color: "#0f172a",
};
const btn = {
  marginTop: 18, padding: "10px 20px", border: 0, borderRadius: 10, background: "#2563eb", color: "#fff",
  fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) reloadForFreshBuild();
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    return (
      <div style={{ padding: "0 16px" }}>
        <div style={box} role="alert">
          <img src="/app-wordmark-dark.png" alt="TidTam" style={{ height: 30, marginBottom: 14 }} />
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            {chunk ? "มีเวอร์ชันใหม่ของระบบ" : "หน้านี้แสดงผลไม่สำเร็จ"}
          </div>
          <div style={{ marginTop: 6, fontSize: 13.5, color: "#64748b", lineHeight: 1.6 }}>
            {chunk
              ? "ระบบเพิ่งอัปเดต หรือสัญญาณเน็ตสะดุดระหว่างโหลด — กด “โหลดใหม่” เพื่อใช้เวอร์ชันล่าสุด"
              : "ข้อมูลของคุณยังอยู่ครบ — กดโหลดใหม่เพื่อลองอีกครั้ง ถ้ายังเป็นอยู่ แจ้งผู้ดูแลระบบพร้อมบอกว่าเปิดหน้าไหน"}
          </div>
          <button type="button" style={btn} onClick={() => window.location.reload()}>โหลดใหม่</button>
          {this.props.variant === "page" && (
            <div>
              <button type="button" onClick={() => { window.location.href = "/dashboard"; }}
                style={{ ...btn, marginTop: 8, background: "transparent", color: "#475569", fontWeight: 700 }}>
                กลับหน้าหลัก
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
