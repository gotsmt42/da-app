import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [previousPath, setPreviousPath] = useState(""); // เริ่มต้น previousPath เป็นค่าว่าง

  useEffect(() => {
    const storedToken = localStorage.getItem("token");

    console.log(storedToken);
    if (storedToken) {
      setLoggedIn(true);
      
      if (location.pathname === "/") {
        navigate("/dashboard");
      } else if (location.pathname === "/login") {
        if (previousPath) {
          navigate(previousPath);
        } else {
          navigate("/dashboard"); // หากไม่มีเส้นทางก่อนหน้านี้ ให้เข้าไปยัง /dashboard
        }
      } else {
        setPreviousPath(location.pathname);
        navigate({ state: { from: location } });
      }
    } else {
      setLoggedIn(false);


      // console.log("Redirecting to ", location.pathname);
    }
  }, [navigate, isLoggedIn, location.pathname, previousPath]);

  const login = (newToken, payload) => {
    localStorage.setItem("payload", JSON.stringify(payload));
    localStorage.setItem("token", newToken);
    setLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem("payload");
    localStorage.removeItem("token");
    setLoggedIn(false);
    navigate("/login");
  };

  // console.log("Login: " + isLoggedIn);
  // console.log("PathName: " + previousPath);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
