// authService.js
import API from '../api/axiosInstance';

/** คำขอ /auth/user ที่กำลังวิ่ง/เพิ่งได้ผล — ใช้ร่วมกันทุกคอมโพเนนต์ */
const userCache = { promise: null, token: null, at: 0 };

const AuthService = {
  async getAllUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await API.get('/auth/alluser');
        
        return response.data;
      } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
      }
    }
  },

  /**
   * ✅ (25 ต.ค. 2569 ผู้ใช้: "ลดการหน่วง แลค กระตุก") เดิมเปิดหน้าเดียวยิง /auth/user 5–7 ครั้งพร้อมกัน
   *    (AuthContext · หัวเว็บ · เมนูข้าง · FileService …) — รวมคำขอที่ยิงพร้อมกันเป็นครั้งเดียว + จำผลไว้ 2 วินาที
   *    ⚠️ แก้ข้อมูลผู้ใช้แล้ว (UpdateUser) ล้างที่จำไว้ทันที — ไม่เห็นข้อมูลเก่า
   */
  async getUserData() {
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const now = Date.now();
    if (userCache.promise && userCache.token === token && now - userCache.at < 2000) return userCache.promise;
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const promise = API.get('/auth/user').then((r) => r.data);
    Object.assign(userCache, { promise, token, at: now });
    try {
      return await promise;
    } catch (error) {
      if (userCache.promise === promise) userCache.promise = null; // ล้มเหลว = ไม่จำ ให้ครั้งถัดไปลองใหม่
      console.error('Error fetching user data:', error);
      throw error;
    }
  },

  async UpdateUser(userId, editedData) {
    const token = localStorage.getItem("token");
    userCache.promise = null;
  
    try {
      if (token) {
        const response = await API.put(`/auth/user/${userId}`, editedData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
  
        console.log("Update User data", response.data);
        return response.data.user;
      }
    } catch (error) {
      console.error("Error updating user data:", error);
      throw error;
    }
  }
  
};

export default AuthService;
