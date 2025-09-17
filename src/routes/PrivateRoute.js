// PrivateRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from '../auth/AuthContext';



// const PrivateRoute = ({ element, ...rest }) => {
  
//   const { isLoggedIn } = useAuth();
//    // ตรวจสอบว่าเส้นทางนั้นเป็นเส้นทาง login หรือไม่


//   return isLoggedIn ? (
//     // ถ้าผู้ใช้ยืนยันตัวตนแล้วให้แสดง element ที่ถูกส่งเข้ามา
//     <AuthProvider {...rest} element={element}  />
//   ) : (
//     // ถ้ายังไม่ได้ยืนยันตัวตนให้ redirect ไปยังหน้า login
//     <Navigate to="/login"  />
//   );
// };

const PrivateRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();

  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
