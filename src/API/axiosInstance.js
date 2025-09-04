// 📁 API/axiosInstance.js
import axios from "axios";

const apiUrl = process.env.REACT_APP_API_URL;
const apiKey = process.env.REACT_APP_API_KEY;
const apiSecret = process.env.REACT_APP_SECRET;

const API = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // ✅ ถูกที่
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
    "X-Secret": apiSecret,
  },
});

// ✅ Interceptor สำหรับแนบ token ทุก request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default API;
