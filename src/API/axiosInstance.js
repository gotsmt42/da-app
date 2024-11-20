import axios from "axios";

const apiUrl = process.env.REACT_APP_API_URL;
const apiKey = process.env.REACT_APP_API_KEY;
const apiSecret = process.env.REACT_APP_SECRET;


const API = axios.create({
  
  baseURL: apiUrl, // ใช้ Environment Variable ที่ชื่อ APP_API_URL
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
    "X-Secret": apiSecret,
    "Authorization": `Bearer ${localStorage.getItem('token')}`, 
  },

  
  
});

export default API;
