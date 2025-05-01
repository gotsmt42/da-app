// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const ProductService = {
  async getUserCustomers() {
    
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

        return response.data.userProducts;
      }
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async ReadProduct(productId) {
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

  async UpdateProduct(productId, editedData) {
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

  async DeleteProduct(productId) {
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

export default ProductService;
