/**
 * OtJobPicker — ปฏิทินเลือกวัน+งานของรายการ OT
 * ✅ (25 พ.ย. 2569) ย้ายตัวจริงไปเป็นชิ้นกลาง shared/ui/JobCalendarPicker.js (ใช้ทุกหน้าที่ผูกงาน) — ไฟล์นี้ตั้งค่าแบบ OT:
 *    mode "day" (1 รายการ = 1 วัน) · สีหมวด OT · ช่างเห็นเฉพาะงานที่มีชื่อตัวเอง · 1 งานเบิกได้วันละ 1 รายการ
 */
import JobCalendarPicker, { jobDays, dayOfJobText } from "@/shared/ui/JobCalendarPicker";
import { OT_ACCENT, OT_DARK } from "../otMeta";

export { jobDays, dayOfJobText };

export default function OtJobPicker(props) {
  return (
    <JobCalendarPicker mode="day" title="เลือกวันและงานที่ทำ OT" accent={OT_ACCENT} accentDark={OT_DARK} onlyMine="auto"
      subtitle="แตะวันในปฏิทิน → แตะงานที่ทำ OT (ได้หลายงาน) → ตกลง · 1 งานเบิกได้วันละ 1 รายการ" {...props} />
  );
}
