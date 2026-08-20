import { useState, useEffect } from "react";

const Loader = () => {
  const [, setLoading] = useState(true); // เริ่มต้นโหลดเมื่อโหลดหน้าใหม่ (JSX ที่อ่านค่านี้ถูกคอมเมนต์ไว้)

  // useEffect สำหรับจัดการการโหลดเมื่อโหลดหน้าใหม่
  useEffect(() => {
    // ฟังก์ชันสำหรับจำลองการโหลดข้อมูล
    const simulateLoading = () => {
      // จำลองการโหลดข้อมูลในระยะเวลา 3 วินาที (ใช้ setTimeout)
      setTimeout(() => {
        setLoading(false); // เมื่อโหลดเสร็จสมบูรณ์
      }, 3000); // จำลองเวลาโหลด 3 วินาที
    };

    // เรียกใช้ฟังก์ชันจำลองการโหลดข้อมูล
    simulateLoading();

    // อย่าลืมกำหนด dependency array ว่าง [] เพื่อให้ useEffect ทำงานเพียงครั้งเดียวเมื่อโหลดหน้าใหม่
  }, []); // ใช้ dependency array ว่าง [] เพื่อให้ useEffect ทำงานเพียงครั้งเดียวเมื่อโหลดหน้าใหม่

  return (
    <div>
      {/* แสดง Loader เมื่อ loading เป็น true */}
      {/* {loading && (
        <div className="loading-overlay">
          <ThreeDots type="ThreeDots" color="#007bff" height={50} width={50} />
        </div>
      )} */}
    </div>
  );
};

export default Loader;
