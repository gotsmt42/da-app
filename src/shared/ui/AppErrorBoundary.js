/**
 * AppErrorBoundary — ตัวรับ error ตอนแสดงผล ไม่ให้ทั้งแอปกลายเป็นจอขาว
 *
 * 🐛 เดิมไม่มี error boundary เลยสักชั้น — error เดียวตอน render (หรือโหลดไฟล์หน้าไม่สำเร็จ) ทำให้
 *    React ถอดทั้งแอปออก เหลือจอขาวเปล่าๆ ไม่มีปุ่มอะไรให้กด (ผู้ใช้: "ต้องคอยรีเฟรชถึงจะมา")
 * ✅ variant="page" ห่อเนื้อหาแต่ละหน้า (เมนู/แถบบนยังอยู่ กดไปหน้าอื่นได้) · resetKey = path → เปลี่ยนหน้าแล้วหายเอง
 *    variant="app"  ห่อทั้งแอปเป็นชั้นสุดท้าย
 * ✅ error จาก "ไฟล์รุ่นเก่าหาย" (หลัง deploy) → รีโหลดให้เองสูงสุด 2 ครั้ง (ดู lazyWithRetry)
 *
 * 🔁 (10 พ.ย. 2569 ผู้ใช้: "ถ้าเปิดปัญหาอย่างนี้จะแก้ไม่หาย ทำให้ดูสมเหตุกว่านี้ ไม่ทำให้เข้าไม่ได้ตลอด
 *    เพราะเครื่องอื่นเข้าได้ แต่บางเครื่องขึ้นแบบนี้จะยาว")
 *    เดิมขึ้น "มีเวอร์ชันใหม่ของระบบ" ทุกกรณี — แต่ถ้าโหลดใหม่แล้วยังเป็น แปลว่าไม่ใช่เรื่องเวอร์ชัน (เน็ตหลุด/ช้า · แคชในเครื่องค้าง)
 *    ตอนนี้บอกตามสาเหตุจริง: ไม่มีเน็ต (ต่อแล้วโหลดให้เอง) · เน็ตช้า · แคชค้าง (ปุ่ม "ล้างแคชแล้วเปิดใหม่" ไม่ต้องล็อกอินใหม่)
 *    + รายละเอียดข้อผิดพลาด/เวอร์ชันตัวเล็กด้านล่าง ให้แคปส่งผู้ดูแลได้
 */
import { Component } from "react";
import { isChunkLoadError, reloadForFreshBuild, hardReload, deepCleanReload, chunkFailCount } from "@/shared/utils/lazyWithRetry";
import { APP_VERSION_LABEL } from "@/shared/appInfo";

const box = {
  maxWidth: 420, margin: "12vh auto 0", padding: "28px 22px 20px", textAlign: "center",
  background: "#fff", border: "1px solid #e6e9ef", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,.05)",
  fontFamily: "inherit", color: "#0f172a",
};
const btn = {
  width: "100%", height: 46, border: 0, borderRadius: 12, background: "#2563eb", color: "#fff",
  fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
};
const ghost = { ...btn, background: "#fff", color: "#334155", border: "1px solid #e2e8f0", fontWeight: 700 };

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, online: typeof navigator === "undefined" ? true : navigator.onLine !== false, busy: false };
    this.onOnline = () => {
      this.setState({ online: true });
      // เน็ตกลับมาแล้ว → โหลดให้เองทันที (ไม่ต้องรอผู้ใช้กด)
      if (this.state.error && isChunkLoadError(this.state.error)) hardReload();
    };
    this.onOffline = () => this.setState({ online: false });
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
  }

  componentWillUnmount() {
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
  }

  componentDidCatch(error, info) {
    // ออฟไลน์อยู่ = รีโหลดไปก็ไม่ได้ · รอเหตุการณ์ online แทน
    if (isChunkLoadError(error) && navigator.onLine !== false && reloadForFreshBuild()) this.setState({ busy: true });
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, busy: false });
  }

  render() {
    const { error, online, busy } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    const msg = String(error?.message || error || "").slice(0, 180);
    const timeout = /timeout/i.test(msg);
    const tried = (chunkFailCount() || 0) >= 2; // รีโหลดเองครบแล้วยังไม่หาย

    let title; let desc; let primary; let secondary;
    if (busy) {
      title = "กำลังโหลดเวอร์ชันล่าสุด…";
      desc = "รอสักครู่ ระบบกำลังเปิดหน้าใหม่ให้";
    } else if (chunk && !online) {
      title = "ไม่มีการเชื่อมต่ออินเทอร์เน็ต";
      desc = "เชื่อมต่อ Wi-Fi หรือเน็ตมือถือ แล้วระบบจะโหลดหน้านี้ให้เองอัตโนมัติ";
      primary = ["ลองอีกครั้ง", () => hardReload()];
    } else if (chunk && timeout) {
      title = "เน็ตช้า โหลดหน้าไม่ทัน";
      desc = "สัญญาณอินเทอร์เน็ตช้าหรือหลุดระหว่างโหลด — ลองอีกครั้ง หรือย้ายไปจุดที่สัญญาณดีขึ้น";
      primary = ["ลองอีกครั้ง", () => hardReload()];
      secondary = ["ล้างแคชแล้วเปิดใหม่", () => deepCleanReload()];
    } else if (chunk && tried) {
      title = "เปิดหน้านี้บนเครื่องนี้ไม่สำเร็จ";
      desc = "ระบบลองโหลดใหม่ให้แล้วยังไม่ได้ มักเกิดจากข้อมูลเก่าค้างในเครื่อง — กด “ล้างแคชแล้วเปิดใหม่” (ไม่ต้องล็อกอินใหม่)";
      primary = ["ล้างแคชแล้วเปิดใหม่", () => deepCleanReload()];
      secondary = ["ลองอีกครั้ง", () => hardReload()];
    } else if (chunk) {
      title = "มีเวอร์ชันใหม่ของระบบ";
      desc = "ระบบเพิ่งอัปเดต — กด “โหลดใหม่” เพื่อใช้เวอร์ชันล่าสุด";
      primary = ["โหลดใหม่", () => hardReload()];
      secondary = ["ล้างแคชแล้วเปิดใหม่", () => deepCleanReload()];
    } else {
      title = "หน้านี้แสดงผลไม่สำเร็จ";
      desc = "ข้อมูลของคุณยังอยู่ครบ — กดโหลดใหม่เพื่อลองอีกครั้ง ถ้ายังเป็นอยู่ แคปหน้าจอนี้ส่งผู้ดูแลระบบ";
      primary = ["โหลดใหม่", () => window.location.reload()];
    }
    const showHome = !busy && window.location.pathname !== "/dashboard";

    return (
      <div style={{ padding: "0 16px" }}>
        <div style={box} role="alert">
          <img src="/app-wordmark-dark.png" alt="TidTam" style={{ height: 30, marginBottom: 14 }} />
          <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
          <div style={{ marginTop: 6, fontSize: 13.5, color: "#64748b", lineHeight: 1.6 }}>{desc}</div>
          {busy && <div style={{ margin: "16px auto 0", width: 26, height: 26, border: "3px solid #dbeafe", borderTopColor: "#2563eb", borderRadius: "50%", animation: "tt-eb-spin .8s linear infinite" }} />}
          <style>{"@keyframes tt-eb-spin{to{transform:rotate(360deg)}}"}</style>
          {!busy && (
            <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
              {primary && <button type="button" style={btn} onClick={primary[1]}>{primary[0]}</button>}
              {secondary && <button type="button" style={ghost} onClick={secondary[1]}>{secondary[0]}</button>}
              {showHome && (
                <button type="button" onClick={() => { window.location.href = "/dashboard"; }}
                  style={{ ...ghost, border: 0, height: 38, color: "#64748b" }}>
                  กลับหน้าหลัก
                </button>
              )}
            </div>
          )}
          {!busy && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 11, color: "#94a3b8", lineHeight: 1.5, wordBreak: "break-word" }}>
              v{APP_VERSION_LABEL || "-"}{msg ? ` · ${msg}` : ""}
            </div>
          )}
        </div>
      </div>
    );
  }
}
