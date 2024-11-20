// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const fetchHolidayService = {
  async getHolidays() {
    
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        // const response = await API.get(`/product?search=${searchTerm}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
        const response = await API.get(`/holidays`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user events:", error);
      throw error;
    }
  },


};

export default fetchHolidayService;
