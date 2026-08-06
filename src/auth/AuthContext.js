import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // ✅ ถูกต้อง
import PushService from "../services/PushService";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggedIn, setLoggedIn] = useState(null);
  const [userData, setUserData] = useState(null);
  // ✅ กัน syncSubscription ถูกเรียกซ้ำทุกครั้งที่เปลี่ยนหน้า (effect ด้านล่างผูกกับ location.pathname)
  const pushSyncedRef = useRef(false);

  // ✅ โหลด Token และข้อมูลผู้ใช้จาก Local Storage เมื่อเปิดหน้าเว็บ
  // useEffect(() => {
  //   const storedToken = localStorage.getItem("token");
  //   const storedUser = localStorage.getItem("payload");

  //   if (storedToken && storedUser) {
  //     setLoggedIn(true);
  //     setUserData(JSON.parse(storedUser));
  //   } else {
  //     setLoggedIn(false);
  //     setUserData(null);
  //     if (location.pathname !== "/login") {
  //       navigate("/login", { replace: true });
  //     }
  //   }
  // }, [navigate, location.pathname]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("payload");

    // console.log(storedUser);

    if (storedToken && storedUser) {
      const decoded = jwtDecode(storedToken);
      const now = Date.now() / 1000;

      if (decoded.exp < now) {
        localStorage.removeItem("token");
        localStorage.removeItem("payload");
        setLoggedIn(false);
        setUserData(null);
        navigate("/login", { replace: true });
      } else {
        setLoggedIn(true);
        setUserData(JSON.parse(storedUser));
        // ✅ ตรวจ/ซ่อม push subscription ทุกครั้งที่เปิดแอปมาพร้อม session ที่ยังไม่หมดอายุ — ครอบคลุม
        // กรณีที่เบราว์เซอร์หมุน subscription ระหว่างที่ปิดแอปอยู่ (ผู้ใช้ที่ล็อกอินค้างไว้ไม่ได้ผ่าน
        // login() จึงต้องมีจุดนี้ด้วย) และกรณี record ฝั่ง server หายไป — เป็น no-op ถ้าทุกอย่างปกติดี
        // ⚠️ effect นี้มี location.pathname เป็น dependency (รันใหม่ทุกครั้งที่เปลี่ยนหน้า) — ต้องกันด้วย
        // ref ให้ sync แค่ครั้งเดียวต่อการเปิดแอป ไม่งั้นจะยิง API ซ้ำทุกครั้งที่ผู้ใช้กดเปลี่ยนหน้า
        if (!pushSyncedRef.current) {
          pushSyncedRef.current = true;
          PushService.syncSubscription();
        }
      }
    } else {
      setLoggedIn(false);
      setUserData(null);
      if (location.pathname !== "/login") {
        navigate("/login", { replace: true });
      }
    }
  }, [navigate, location.pathname]);

  // ✅ ดักจับการเปลี่ยนแปลงของ Token ใน Local Storage
  useEffect(() => {
    const handleStorageChange = () => {
      const newToken = localStorage.getItem("token");
      const newUser = localStorage.getItem("payload");

      if (newToken && newUser) {
        setLoggedIn(true);
        setUserData(JSON.parse(newUser));
      } else {
        setLoggedIn(false);
        setUserData(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
const updateUserData = (newData) => {
  localStorage.setItem("payload", JSON.stringify(newData));
  setUserData({ ...newData }); // ✅ clone object เพื่อบังคับ re-render
};


  // ✅ ฟังก์ชัน Login
  // const login = (newToken, payload) => {
  //   localStorage.setItem("token", newToken);
  //   localStorage.setItem("payload", JSON.stringify(payload));

  //   setLoggedIn(true);
  //   setUserData(payload);

  //   navigate("/dashboard", { replace: true });

  //   // ✅ บังคับ Refresh หน้าเพื่อให้ข้อมูลอัปเดต
  //   setTimeout(() => {
  //     window.location.reload();
  //   }, 500);
  // };

  // // ✅ ฟังก์ชัน Logout
  // const logout = () => {
  //   localStorage.removeItem("token");
  //   localStorage.removeItem("payload");

  //   setLoggedIn(false);
  //   setUserData(null);

  //   navigate("/login", { replace: true });

  //   // ✅ บังคับ Refresh หน้าเพื่อให้ข้อมูลอัปเดต
  //   setTimeout(() => {
  //     window.location.reload();
  //   }, 500);
  // };

  const login = (newToken, payload) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("payload", JSON.stringify(payload));
    setLoggedIn(true);
    setUserData(payload);
    // ✅ ผูก push subscription ของ "เครื่องนี้" เข้ากับคนที่เพิ่งล็อกอินทันที — กันเครื่องที่ใช้ร่วมกัน
    // ส่งแจ้งเตือนของคนก่อนหน้ามาให้คนใหม่ (ดูเหตุผลเต็มที่ PushService.syncSubscription)
    // ยิงแบบไม่ await — ไม่ให้การเข้าสู่ระบบต้องรองานเบื้องหลังตัวนี้
    PushService.syncSubscription();
    navigate("/dashboard", { replace: true });
  };

  const logout = () => {
    // 🐛 BUG ที่แก้: เดิมล็อกเอาต์แล้วไม่เคยยกเลิก push subscription เลย — record ใน DB ยังผูก userId
    // ของคนที่เพิ่งออกไปอยู่ ทำให้เครื่องเครื่องนี้ยังเด้งแจ้งเตือนงานของคนเก่าต่อไปเรื่อยๆ แม้ไม่มีใคร
    // ล็อกอินอยู่ หรือมีคนอื่นมาใช้เครื่องต่อ (ข้อมูลงาน/ชื่อลูกค้าหลุดไปให้คนที่ไม่เกี่ยวข้องเห็น)
    // ✅ ยิงแบบ fire-and-forget ได้ ไม่ต้องรอ — PushService.unsubscribe() ยกเลิกฝั่งเบราว์เซอร์เป็น
    // ขั้นแรกเสมอ (หยุดรับ push ทันที) ส่วนการแจ้ง server เป็นแค่เก็บกวาด ถ้ายิงไม่ทัน/ไม่ผ่านเพราะ
    // token ถูกลบไปแล้ว ระบบก็ลบ record ให้เองตอนส่ง push ครั้งถัดไปแล้วได้ 410 กลับมา
    PushService.unsubscribe().catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("payload");
    setLoggedIn(false);
    setUserData(null);
    navigate("/login", { replace: true });
  };

  // ✅ ป้องกัน UI Render ก่อนโหลดค่า Token
  if (isLoggedIn === null) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, userData, login, logout, updateUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
};
