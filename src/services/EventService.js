// productService.js
import API from "../API/axiosInstance";
import AuthService from "./authService";

const EventService = {
  async getEvents() {
    
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        // const response = await API.get(`/product?search=${searchTerm}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
        const response = await API.get(`/events`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user events:", error);
      throw error;
    }
  },

  async GetEventById(id) {
  try {
    const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
    if (userData) {
      const response = await API.get(`/events/${id}`); // ดึง event ตาม id
      return response.data;
    }
  } catch (error) {
    console.error("Error fetching event by ID:", error);
    throw error;
  }
},



  async LineNotify(description) {
    
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        await API.post(`/events/linenotify`, description); 

      }
    } catch (error) {
      console.error("Error fetching user linenotify:", error);
      throw error;
    }
  },

//   async getUserDeleteProducts() {
    
//     try {
//       const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
//       if (userData) {
//         // const response = await API.get(`/product?search=${searchTerm}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
//         const response = await API.get(`/product`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้
//         // const response = await API.get(`/product?page=${currentPage}&per_page=${perPage}`); // เรียกข้อมูลสินค้าโดยใช้ ID ของผู้ใช้

//         return response.data;
//       }
//     } catch (error) {
//       console.error("Error fetching user products:", error);
//       throw error;
//     }
//   },

  async AddEvent(newEvent) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token

      if (userData) {
        const response = await API.post(`/events`, newEvent); // เพิ่มข้อมูลสินค้า

        return response.data.events;
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
        const response = await API.put(`/events/${id}`, updatedEvent); // เพิ่มข้อมูลสินค้า

        return response.data;
      }
    } catch (error) {
      console.error("Error fetching user event:", error);
      throw error;
    }
  },

  async DeleteEvent(id) {
    try {
      const userData = await AuthService.getUserData(); // ดึงข้อมูลผู้ใช้และ Token
      if (userData) {
        const response = await API.delete(`/events/${id}`); // ลบข้อมูลสินค้า

        console.log("Delete Event Success", response.data);

        // return response.data.userProducts;
      }
    } catch (error) {
      console.error("Error Delete event:", error);
      throw error;
    }
  },




  // เพิ่มฟังก์ชันสำหรับการสร้าง, อัปเดต, และลบสินค้าตามที่ต้องการ
};

export default EventService;
