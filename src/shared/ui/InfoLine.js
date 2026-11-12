import { Box, Stack, Typography } from "@mui/material";
import { PaymentsRounded as Payments, ApartmentRounded as Apartment, AssignmentIndRounded as AssignmentInd, GroupsRounded as Groups, CategoryRounded as Category, DescriptionRounded as Description, CalendarMonthRounded as CalendarMonth, SendRounded as Send, NumbersRounded as Numbers, AccessTimeRounded as AccessTime, PersonRounded as Person } from "@mui/icons-material";

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
  ผู้เข้าทำงาน: Groups,
  หัวหน้าทีมเข้างาน: Groups,
  หัวหน้าทีม: Groups,
  ลูกทีม: Groups,
  มูลค่างาน: Payments,
  มูลค่างานรวม: Payments,
  มูลค่าครั้งนี้: Payments,
  "เลข Job": Numbers,
};

/** @param center จัดป้ายกึ่งกลางแนวตั้งกับค่า — ใช้กับแถวที่ค่าเป็นชิปรูปคน (สูงกว่าตัวหนังสือ) ให้ป้ายไม่ลอยสูงกว่า */
/**
 * 🔁 (12 พ.ย. 2569 ผู้ใช้: "หน้างานของฉัน ดำเนินงาน ส่วนหัวการ์ด จัดรูปแบบให้ดูง่ายกว่านี้ ยังดูไม่ลงตัว")
 *    ไอคอนทุกแถวขนาด/สีเดียวกัน (เดิมบางแถวไม่มีไอคอน ป้ายเลยเยื้อง) · ป้ายกว้างคงที่ 100px · ค่าตัวใหญ่ขึ้น
 *    · แถวสูงเท่ากัน (ใช้คู่กับกล่องพื้นเทาอ่อนมีเส้นคั่นในหัวการ์ด — class "tt-info-panel")
 */
const InfoLine = ({ label, children, center = false }) => {
  const Icon = ICON[label];
  return (
    <Stack direction="row" spacing={1} className="tt-info-line" sx={{ alignItems: center ? "center" : "flex-start", minHeight: 34, py: 0.4 }}>
      <Stack
        direction="row" alignItems="center" spacing={0.6}
        sx={{ flexShrink: 0, whiteSpace: "nowrap", color: "#64748b", width: 100, minHeight: 26 }}
      >
        <Box component="span" sx={{ width: 18, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
          {Icon && <Icon sx={{ fontSize: 16, color: "#94a3b8" }} />}
        </Box>
        <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>{label}</Typography>
      </Stack>
      <Typography
        component="div"
        sx={{ flex: 1, minWidth: 0, color: "#0f172a", fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.5, alignSelf: center ? "center" : "flex-start", pt: center ? 0 : "3px" }}
      >
        {children}
      </Typography>
    </Stack>
  );
};

export default InfoLine;
