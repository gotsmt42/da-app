// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const CustomerService = {
  async getCustomers() {
    
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        // const response = await API.get(`/product?search=${searchTerm}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
        const response = await API.get(`/customer`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },


  async AddCustomer(formData) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.post(`/customer`, formData); // เพิ่มข้อมูลสินค้า

        // console.log("Add Product data", response.data);

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async ReadCustomer(customerId) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.get(`/customer/${customerId}`); // เพิ่มข้อมูลสินค้า

        // console.log("Read Product data", response.data);

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async UpdateCustomer(customerId, editedData) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.put(`/customer/${customerId}`, editedData); // เพิ่มข้อมูลสินค้า
        // const response = await API.put(`/product/${productId}`, formData); // เพิ่มข้อมูลสินค้า

        // console.log("Update Product data", response.data);

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async DeleteCustomer(customerId) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.delete(`/customer/${customerId}`); // ลบข้อมูลสินค้า

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

export default CustomerService;
