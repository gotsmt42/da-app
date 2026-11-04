/**
 * useTodayCheckins — eventId ที่บันทึกเข้างาน "วันนี้" แล้ว (เวลาไทย) · อัปเดตเรียลไทม์เมื่อมีการบันทึกเข้างาน
 * ใช้ตัดสิน "ถึงวันแล้วยังไม่บันทึกเข้างาน" (shared/utils/myJobAttention) — null = ยังโหลดไม่เสร็จ
 */
import { useCallback, useEffect, useState } from "react";
import moment from "moment";
import AttendanceService from "@/shared/services/AttendanceService";
import useRealtime from "@/shared/realtime/useRealtime";

/**
 * @param userId (4 พ.ย. 2569 — เข้างานแยกรายคน) ส่งมา = นับเฉพาะงานที่ "คนนี้" กดเข้างานวันนี้แล้ว
 *               (แอดมินดูทุกบันทึกได้ — ไม่กรองจะนับงานที่คนอื่นในทีมกดแล้วเป็นของตัวเอง)
 */
export default function useTodayCheckins(userId) {
  const [ids, setIds] = useState(null);
  const today = moment().utcOffset(7).format("YYYY-MM-DD");
  const uid = userId ? String(userId) : "";
  const load = useCallback(() => AttendanceService.list({ from: today, to: today, ...(uid ? { userId: uid } : {}) })
    .then((d) => setIds(new Set((d?.attendance || []).filter((r) => !uid || String(r.userId) === uid).map((r) => String(r.eventId)))))
    .catch(() => setIds((p) => p || new Set())), [today, uid]);
  useEffect(() => { load(); }, [load]);
  useRealtime("attendance", () => { load(); });
  return ids;
}
