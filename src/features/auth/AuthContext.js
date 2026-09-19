import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // ✅ ถูกต้อง
import PushService from "@/shared/services/PushService";
import AuthService from "@/shared/services/authService";
import { startRealtime, stopRealtime } from "@/shared/realtime/realtimeClient";
import useRealtime from "@/shared/realtime/useRealtime";
import PermissionService from "@/shared/services/PermissionService";

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

  /**
   * ดึงข้อมูลผู้ใช้ของตัวเองจาก server มาทับของที่แคชไว้
   * ✅ ทำให้ "แก้สิทธิ์แล้วมีผลทันที" โดยไม่ต้องออกจากระบบ (ผู้ใช้สั่ง) — เมนู/ป้ายสิทธิ์วาดใหม่ตาม role ล่าสุด
   * ⚠️ ล้มเหลวต้องเงียบ: เน็ตหลุดชั่วคราวไม่ควรทำให้ผู้ใช้หลุดจากระบบ
   */
  const refreshUserData = useCallback(async () => {
    if (!localStorage.getItem("token")) return null;
    try {
      const res = await AuthService.getUserData();
      const fresh = res?.user;
      if (!fresh?._id) return null;
      const merged = {
        ...JSON.parse(localStorage.getItem("payload") || "{}"),
        userId: String(fresh._id),
        fname: fresh.fname,
        lname: fresh.lname,
        email: fresh.email,
        tel: fresh.tel,
        rank: fresh.rank || fresh.role,         // Rank — ตำแหน่งในองค์กร (ชื่อฟิลด์จริงในฐานข้อมูล)
        role: fresh.role,                       // ⚠️ payload ส่ง role = Rank เหมือนเดิม เพื่อหน้าเก่าที่เปิดค้างไม่พัง
        // ✅ Role — ตำแหน่งในระบบ (Super Admin/Admin/Member) ต้องติดมาด้วย ไม่งั้นเมนูตั้งค่าระบบหาย
        systemRole: fresh.systemRole || "",
        // ✅ ตำแหน่งเฉพาะบุคคล — พิมพ์ใต้ชื่อในเอกสารที่ออกจากเครื่องนี้ (ข้อมูลเก่าอยู่ที่ rank)
        jobTitle: fresh.jobTitle || fresh.rank || "",
        imageUrl: fresh.imageUrl,
      };
      localStorage.setItem("payload", JSON.stringify(merged));
      setUserData((cur) => (JSON.stringify(cur) === JSON.stringify(merged) ? cur : merged));
      return merged;
    } catch {
      return null;
    }
  }, []);

  /**
   * ✅ จังหวะที่รีเฟรช: เปิดแอป · กลับมาที่แท็บ · ทุก 60 วินาที
   * ⚠️ ห้ามถี่กว่านี้ — เป็นการยิง API ของผู้ใช้ทุกคนตลอดเวลาโดยที่ข้อมูลแทบไม่เปลี่ยน
   */
  /**
   * ✅ ตารางสิทธิ์ที่ผู้ดูแลปรับเอง (ใครเห็นเมนูอะไร) — โหลดตอนล็อกอิน แล้วนับเวอร์ชันไว้
   * ⚠️ ต้องนับเวอร์ชันใน state และส่งผ่าน context — ตารางสิทธิ์เก็บในตัวแปรระดับโมดูล (roles.js)
   * ซึ่งเปลี่ยนค่าแล้ว React ไม่รู้ ต้องมีอะไรสักอย่างสั่งให้เมนูวาดใหม่
   */
  const [permVersion, setPermVersion] = useState(0);
  const reloadPermissions = useCallback(async () => {
    await PermissionService.loadEffective();
    setPermVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    reloadPermissions();
  }, [isLoggedIn, reloadPermissions]);

  // ✅ ผู้ดูแลปรับสิทธิ์จากเครื่องไหนก็ตาม → เมนูของทุกคนที่เปิดอยู่เปลี่ยนตามทันที
  useRealtime("settings", () => { reloadPermissions(); }, { enabled: Boolean(isLoggedIn) });

  /** ✅ ช่องสัญญาณเรียลไทม์ — เปิดตลอดเวลาที่ล็อกอินอยู่ ใช้ร่วมกันทุกหน้า (ดู shared/realtime) */
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    startRealtime();
    return () => stopRealtime();
  }, [isLoggedIn]);

  // ✅ ข้อมูลผู้ใช้เปลี่ยน (เช่น ถูกเปลี่ยนสิทธิ์) → เมนู/สิทธิ์บนหน้าจออัปเดตทันที ไม่ต้องรอรอบ 60 วินาที
  useRealtime("users", () => { refreshUserData(); }, { enabled: Boolean(isLoggedIn) });

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    refreshUserData();
    const onFocus = () => refreshUserData();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(refreshUserData, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [isLoggedIn, refreshUserData]);


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
      value={{ isLoggedIn, userData, login, logout, updateUserData, refreshUserData, permVersion }}
    >
      {children}
    </AuthContext.Provider>
  );
};
