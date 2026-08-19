// 📁 API/axiosInstance.js
import axios from "axios";

// ⚠️ Vite ไม่มี process ในเบราว์เซอร์ ต้องอ่านผ่าน import.meta.env — ชื่อตัวแปรยังเป็น REACT_APP_
// เหมือนเดิม เพราะตั้ง envPrefix: "REACT_APP_" ไว้ที่ vite.config.js (.env และตัวแปรบน Vercel
// จึงไม่ต้องแก้อะไรเลย)
const apiUrl = import.meta.env.REACT_APP_API_URL;
const apiKey = import.meta.env.REACT_APP_API_KEY;
const apiSecret = import.meta.env.REACT_APP_SECRET;

const API = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // ✅ ถูกที่
  // ✅ เดิมไม่มี timeout เลย — request ที่ค้าง/ช้าผิดปกติจะหมุนรอไม่จบ ปุ่ม "กำลังบันทึก..." ค้างตลอด
  // ไม่มี error ให้เห็นจนกว่าผู้ใช้จะรอไม่ไหวแล้วออกจากหน้าไปเอง
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
    "X-Secret": apiSecret,
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
