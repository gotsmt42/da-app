// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const FileService = {
  async getUserFiles() {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.get(`/files`); // เรียกข้อมูลไฟล์ของผู้ใช้
        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user files:", error);
      throw error;
    }
  },

  async uploadFiles(formData, config) {
    try {
      const userData = await AuthService.getUserData();
      if (userData) {
        const response = await API.post(`/files`, formData, {
          ...config, // ใช้ spread operator เพื่อนำ config ทั้งหมดเข้าไปในการเรียก API.post

          headers: {
            "Content-Type": "multipart/form-data",
          },
        }); // อัปโหลดไฟล์
        return response.data;
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      throw error;
    }
  },

  async deleteFile(fileId) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.delete(`/files/${fileId}`); // ลบไฟล์
        console.log("Delete File Success", response.data);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },
};

export default FileService;
