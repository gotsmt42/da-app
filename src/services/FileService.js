// fileService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const FileService = {
  async getUserFiles() {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.get(`/files`, {
          headers: {
            Authorization: `Bearer ${userData.token}`, // ✅ ต้องแนบ token
          },
        });
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
          ...config,
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${userData.token}`, // ✅ แนบ token
          },
        });
        return response;
      }
    } catch (error) {
      console.error("Error uploading files:", error.response?.data || error.message);
      throw error;
    }
  },

  async deleteFile(fileId) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.delete(`/files/${fileId}`, {
          headers: {
            Authorization: `Bearer ${userData.token}`, // ✅ ต้องแนบ token
          },
        });
        console.log("Delete File Success", response.data);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },
};

export default FileService;
