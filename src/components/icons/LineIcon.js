// ป้ายไอคอน LINE แบบเรียบ (สีแบรนด์จริงของ LINE) ใช้แทนไอคอนในเมนู "แชร์ไปยัง LINE"
// โดยไม่ต้องพึ่งไฟล์ svg/โลโก้แยกต่างหาก
const LineIcon = ({ size = 20 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      backgroundColor: "#06C755",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.5,
      fontWeight: 800,
      fontFamily: "Arial, sans-serif",
      flexShrink: 0,
    }}
  >
    L
  </div>
);

export default LineIcon;
