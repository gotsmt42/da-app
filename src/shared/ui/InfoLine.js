import { Stack, Typography } from "@mui/material";
import {
  Apartment, AssignmentInd, Groups, Category, Description,
  CalendarMonth, Send, Numbers, AccessTime, Person,
} from "@mui/icons-material";

/**
 * InfoLine.js — บรรทัดข้อมูล "ไอคอน + ป้ายกำกับ + ค่า" ของการ์ดงาน
 *
 * ⚠️ แยกออกมาเป็นไฟล์ของตัวเองเพื่อให้ "การ์ดงาน" (OperationBoard) "การ์ดรออนุมัติ"
 * (PendingApprovalsPanel) และ "การ์ดงานของช่าง" (TechnicianJobPanel) ใช้ตัวเดียวกันจริงๆ
 * ข้อมูลชุดเดียวกัน (ระบบ/โครงการ/ครั้งที่/ทีม) จะได้หน้าตาเหมือนกันเป๊ะทุกที่
 *
 * 🐛 ที่แก้: เดิมไอคอนเป็น "อีโมจิ" ที่ส่งเข้ามาทาง prop ทีละจุด (💻 🏢 👷 ...) รวม 34 จุด
 *    · อีโมจิวาดด้วยฟอนต์ของแต่ละระบบปฏิบัติการ หน้าตาจึงไม่เหมือนกันบน Android/iOS/Windows
 *      และดูไม่เข้ากับไอคอนที่เหลือทั้งแอปซึ่งเป็นชุดเส้นเดียวกันหมด
 *    · ส่งทีละจุดแปลว่าป้ายเดียวกันมีโอกาสได้อีโมจิคนละตัวเมื่อมีคนเพิ่มการ์ดใหม่
 * ✅ ไอคอนถูกกำหนดจาก "ชื่อป้าย" ที่นี่ที่เดียว — call site ส่งแค่ label ก็พอ
 * ⚠️ ป้ายที่ยังไม่มีในตาราง จะแสดงเฉพาะตัวหนังสือ (ไม่พัง) — เพิ่มไอคอนได้ที่ ICON ด้านล่าง
 *
 * ✅ ป้ายกำกับจางลง + ล็อกความกว้างคงที่ (ค่าของทุกบรรทัดเรียงตรงกันเป็นคอลัมน์เดียว กวาดตาอ่านลงมาได้)
 * ✅ ค่าจริงเข้มและหนากว่า ให้เป็นสิ่งที่ตาเห็นก่อน — เดิมป้ายกำกับกับค่าเป็นสีเทาเดียวกันทั้งคู่ พอมี
 * หลายบรรทัดเรียงกันจึงกลายเป็นเทาพร่าๆ ก้อนเดียว ตาไม่รู้จะเกาะตรงไหน
 */
const ICON = {
  โครงการ: Apartment,
  ผู้รับผิดชอบ: AssignmentInd,
  ทีม: Groups,
  ระบบ: Category,
  เอกสาร: Description,
  วันที่: CalendarMonth,
  ผู้ส่ง: Send,
  ครั้งที่: Numbers,
  เวลา: AccessTime,
  ผู้ติดต่อ: Person,
};

const InfoLine = ({ label, children }) => {
  const Icon = ICON[label];
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
      <Stack
        direction="row" alignItems="center" spacing={0.4}
        sx={{ flexShrink: 0, whiteSpace: "nowrap", color: "text.disabled", minWidth: 56 }}
      >
        {/* ⚠️ mt เล็กน้อยให้ไอคอนอยู่กึ่งกลางบรรทัดแรกของตัวหนังสือ ไม่ลอยสูงกว่า */}
        {Icon && <Icon sx={{ fontSize: 13, mt: "1px" }} />}
        <Typography variant="caption" component="span">{label}</Typography>
      </Stack>
      <Typography
        variant="caption"
        sx={{ minWidth: 0, color: "text.primary", fontWeight: 500, lineHeight: 1.5 }}
      >
        {children}
      </Typography>
    </Stack>
  );
};

export default InfoLine;
