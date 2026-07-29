// productService.js
import API from "../API/axiosInstance";

const CustomerService = {
  async getCustomers() {
    try {
      const response = await API.get(`/customer`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async AddCustomer(formData) {
    try {
      const response = await API.post(`/customer`, formData);
      return response.data;
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async ReadCustomer(customerId) {
    try {
      const response = await API.get(`/customer/${customerId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async UpdateCustomer(customerId, editedData) {
    try {
      const response = await API.put(`/customer/${customerId}`, editedData);
      return response.data;
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },

  async DeleteCustomer(customerId) {
    try {
      await API.delete(`/customer/${customerId}`);
    } catch (error) {
      console.error("Error fetching user products:", error);
      throw error;
    }
  },


  // เพิ่มฟังก์ชันสำหรับการสร้าง, อัปเดต, และลบสินค้าตามที่ต้องการ
};

export default CustomerService;
