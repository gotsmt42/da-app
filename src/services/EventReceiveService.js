// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const EventReceiveService = {
  async getEvents() {
    
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        // const response = await API.get(`/product?search=${searchTerm}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
        const response = await API.get(`/eventReceive`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user events:", error);
      throw error;
    }
  },


  async AddEvent(newEvent) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.post(`/eventReceive`, newEvent); // เพิ่มข้อมูลสินค้า

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching Event:", error);
      throw error;
    }
  },

  async UpdateEvent(id, updatedEvent) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.put(`/eventReceive/${id}`, updatedEvent); // เพิ่มข้อมูลสินค้า

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user event:", error);
      throw error;
    }
  },

  async DeleteEvent(id) {
    try {
      console.log(`🗑 Attempting to delete event ID: ${id}`);
  
      const userData = await AuthService.getUserData();
      if (!userData) throw new Error("❌ User not authenticated");
  
      const response = await API.delete(`/eventReceive/${id}`);
  
      console.log("✅ Delete Event Success:", response.data);
      return response; // ✅ คืนค่า response เต็มๆ เพื่อให้ `deleteEventFromDB` เช็ก `status`
    } catch (error) {
      console.error("❌ Error deleting event:", error.response?.data || error);
      throw error;
    }
  }
  
  

  // เพิ่มฟังก์ชันสำหรับการสร้าง, อัปเดต, และลบสินค้าตามที่ต้องการ
};

export default EventReceiveService;
