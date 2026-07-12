import API from "../API/axiosInstance";
import AuthService from "./authService";

// ✅ JobTypeService/SystemTypeService เรียก endpoint รูปแบบเดียวกันเป๊ะ (แค่คนละ path) —
// ใช้ factory เดียวสร้างทั้งคู่แทนการ copy/paste CustomerService.js ซ้ำสองรอบ
const createLookupService = (path) => ({
  async getAll() {
    try {
      const userData = await AuthService.getUserData();
      if (userData) {
        const response = await API.get(`/${path}`);
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching ${path}:`, error);
      throw error;
    }
  },

  async add(name) {
    try {
      const userData = await AuthService.getUserData();
      if (userData) {
        const response = await API.post(`/${path}`, { name });
        return response.data;
      }
    } catch (error) {
      console.error(`Error adding ${path}:`, error);
      throw error;
    }
  },

  async update(id, name) {
    try {
      const userData = await AuthService.getUserData();
      if (userData) {
        const response = await API.put(`/${path}/${id}`, { name });
        return response.data;
      }
    } catch (error) {
      console.error(`Error updating ${path}:`, error);
      throw error;
    }
  },

  async remove(id) {
    try {
      const userData = await AuthService.getUserData();
      if (userData) {
        const response = await API.delete(`/${path}/${id}`);
        return response.data;
      }
    } catch (error) {
      console.error(`Error deleting ${path}:`, error);
      throw error;
    }
  },
});

export default createLookupService;
