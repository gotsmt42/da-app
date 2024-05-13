// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const TypeProductService = {
  async getUserTypeProducts() {
    
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        // const response = await API.get(`/product?search=${searchTerm}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
        const response = await API.get(`/typeproduct`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user type products:", error);
      throw error;
    }
  },


  async AddTypeProduct(formData) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.post(`/typeproduct`, formData); // เพิ่มข้อมูล

        console.log("Add type product data", response.data);

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user type products:", error);
      throw error;
    }
  },

  async ReadTypeProduct(productId) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.get(`/product/${productId}`); // เพิ่มข้อมูลสินค้า

        // console.log("Read Product data", response.data);

        return response.data.product;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async UpdateTypeProduct(productId, editedData) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.put(`/product/${productId}`, editedData); // เพิ่มข้อมูลสินค้า
        // const response = await API.put(`/product/${productId}`, formData); // เพิ่มข้อมูลสินค้า

        // console.log("Update Product data", response.data);

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async DeleteTypeProduct(productId) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.delete(`/product/${productId}`); // ลบข้อมูลสินค้า

        // console.log("Delete Product Success", response.data);

        // return response.data.userProducts;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },


  // เพิ่มฟังก์ชันสำหรับการสร้าง, อัปเดต, และลบสินค้าตามที่ต้องการ
};

export default TypeProductService;
