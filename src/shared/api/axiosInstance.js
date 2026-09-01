// 📁 shared/api/axiosInstance.js
import axios from "axios";

// ⚠️ Vite ไม่มี process ในเบราว์เซอร์ ต้องอ่านผ่าน import.meta.env — ชื่อตัวแปรยังเป็น REACT_APP_
// เหมือนเดิม เพราะตั้ง envPrefix: "REACT_APP_" ไว้ที่ vite.config.js (.env และตัวแปรบน Vercel
// จึงไม่ต้องแก้อะไรเลย)
const apiUrl = import.meta.env.REACT_APP_API_URL;

// 🔒 ที่แก้ (ช่องโหว่ร้ายแรง): เดิมแนบ header X-API-Key / X-Secret ไปกับทุก request โดยอ่านจาก
// REACT_APP_API_KEY / REACT_APP_SECRET
//   1) ฝั่ง server **ไม่เคยตรวจ header สองตัวนี้เลย** (ค้นทั้ง repo ไม่มีจุดไหนอ่าน) จึงไม่ได้ให้
//      ความปลอดภัยอะไรเลยแม้แต่น้อย — เป็นแค่ security theater
//   2) ที่ร้ายกว่านั้น: REACT_APP_SECRET ถูกตั้งเป็นค่าเดียวกับ APP_SECRET ซึ่งเป็น **กุญแจเซ็น JWT
//      ของทั้งระบบ** — ตัวแปร REACT_APP_* ทุกตัวถูกฝังลงไฟล์ JS ตอน build และเปิดอ่านได้จาก
//      เบราว์เซอร์ของทุกคน เท่ากับประกาศกุญแจเซ็น token ต่อสาธารณะ ใครก็ปลอม token เป็น admin ได้
// ⚠️ ห้ามเอาความลับฝั่ง server มาใส่ตัวแปร REACT_APP_* อีกเด็ดขาด — ทุกตัวคือข้อมูลสาธารณะ

const API = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // ✅ ถูกที่
  // ✅ เดิมไม่มี timeout เลย — request ที่ค้าง/ช้าผิดปกติจะหมุนรอไม่จบ ปุ่ม "กำลังบันทึก..." ค้างตลอด
  // ไม่มี error ให้เห็นจนกว่าผู้ใช้จะรอไม่ไหวแล้วออกจากหน้าไปเอง
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Interceptor สำหรับแนบ token ทุก request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Interceptor สำหรับจัดการ token หมดอายุหรือไม่ถูกต้อง
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.message;

    if (msg === "Token expired" || msg === "Invalid token") {
      localStorage.removeItem("token");
      localStorage.removeItem("payload");

      // ✅ แจ้งผู้ใช้ก่อน redirect (ถ้าต้องการ)
      alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");

      // ✅ Redirect ไปหน้า login
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);


export default API;
