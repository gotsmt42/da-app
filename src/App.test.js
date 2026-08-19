import { render, screen } from "@testing-library/react";
import Footer from "./layouts/Footer";

/**
 * ⚠️ เดิมไฟล์นี้เป็นเทสต์ตัวอย่างที่ติดมากับ Create React App — มันหาข้อความ "learn react"
 * ซึ่งไม่มีอยู่ในแอปนี้เลย จึง fail มาตลอดตั้งแต่วันแรก (ไม่มีใครรัน npm test เลยไม่มีใครเห็น)
 *
 * เปลี่ยนมาทดสอบ Footer แทน เพราะมันเป็นคอมโพเนนต์เล็กๆ ที่ไม่ต้องพึ่ง Router/AuthContext/backend
 * แต่พิสูจน์ได้ว่า toolchain ใหม่ทำงานครบสาย: vitest + jsdom + แปลง JSX ในไฟล์ .js + อ่านค่า
 * จาก import.meta.env (ตัวที่เพิ่งย้ายมาจาก process.env ตอนเปลี่ยนจาก CRA เป็น Vite)
 */
test("Footer แสดงปีปัจจุบันและชื่อผู้พัฒนา", () => {
  render(<Footer />);
  expect(screen.getByText(/Santisuk/)).toBeInTheDocument();
  expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
});
