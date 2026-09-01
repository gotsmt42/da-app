// productService.js
import API from "../api/axiosInstance";

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

  /**
   * ตั้ง/แก้/ลบ "ลิงก์ตำแหน่งบน Google Maps" ของโครงการ (ผูกกับ cCompany + cSite)
   * ⚠️ ส่ง mapUrl เป็นสตริงว่าง = ตั้งใจลบพิกัดทิ้ง (ฝั่ง server แยกจากกรณี "ลิงก์ผิด" แล้ว)
   * ⚠️ ด่านสิทธิ์อยู่ที่ server — แอดมิน/ผู้จัดการ หรือช่างที่มีงานอยู่ที่โครงการนั้นจริงเท่านั้น
   */
  async setSiteMapUrl({ company, site, mapUrl }) {
    const { data } = await API.patch(`/customer/map`, { company, site, mapUrl });
    return data.customer;
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
