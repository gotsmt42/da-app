// authService.js
import API from '../API/axiosInstance';

const AuthService = {
  async getAllUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await API.get('/auth/alluser');
        
        return response.data;
      } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
      }
    }
  },

  async getUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await API.get('/auth/user');
        
        return response.data;
      } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
      }
    }
  },

  async UpdateUser(userId, editedData) {
    const token = localStorage.getItem("token");
  
    try {
      if (token) {
        const response = await API.put(`/auth/user/${userId}`, editedData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
  
        console.log("Update User data", response.data);
        return response.data.user;
      }
    } catch (error) {
      console.error("Error updating user data:", error);
      throw error;
    }
  }
  
};

export default AuthService;
