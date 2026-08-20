import Swal from "sweetalert2";

// ✅ User.imageUrl มีค่า default เป็น path สัมพัทธ์ "asset/image/userDefault-2.jpg" (ตั้งไว้ที่ backend
// models/User.js) ซึ่งไม่ใช่ URL จริงที่โหลดได้ (ไม่ใช่ path ที่ frontend serve อยู่) — เดิมเช็คแค่
// Boolean(imageUrl) จึงพยายามโหลดรูปนี้เสมอสำหรับผู้ใช้ที่ยังไม่เคยอัพโหลดรูปโปรไฟล์จริง กลายเป็น
// ไอคอนรูปหักๆ แทนที่จะ fallback ไปเป็นตัวอักษรย่อสวยๆ ที่มีอยู่แล้ว — ต้องเช็คว่าเป็น URL แบบเต็ม
// (รูปที่อัพโหลดจริงผ่าน Cloudinary จะเป็น https:// เสมอ) เท่านั้นถึงจะถือว่า "มีรูปโปรไฟล์จริง"
export const hasValidAvatar = (imageUrl) => Boolean(imageUrl && /^https?:\/\//i.test(imageUrl));

export const swalLogout = () => {
  return new Promise((resolve, reject) => {

    try {
      Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Logout",
        cancelButtonText: "Cancel",
        confirmButtonColor:"#d33"
      }).then((result) => {
        if (result.isConfirmed) {
    
          resolve({ isConfirmed: true });
   
        } else {
          resolve({ isConfirmed: false });
        }
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
};
