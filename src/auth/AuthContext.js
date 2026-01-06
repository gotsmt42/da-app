import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // ✅ ถูกต้อง


const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggedIn, setLoggedIn] = useState(null);
  const [userData, setUserData] = useState(null);

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

        console.log(storedUser);


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
  navigate("/dashboard", { replace: true });
};

const logout = () => {
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
    <AuthContext.Provider value={{ isLoggedIn, userData, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
