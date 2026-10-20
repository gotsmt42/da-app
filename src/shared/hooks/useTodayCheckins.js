/**
 * useTodayCheckins — eventId ที่บันทึกเข้างาน "วันนี้" แล้ว (เวลาไทย) · อัปเดตเรียลไทม์เมื่อมีการบันทึกเข้างาน
 * ใช้ตัดสิน "ถึงวันแล้วยังไม่บันทึกเข้างาน" (shared/utils/myJobAttention) — null = ยังโหลดไม่เสร็จ
 */
import { useCallback, useEffect, useState } from "react";
import moment from "moment";
import AttendanceService from "@/shared/services/AttendanceService";
import useRealtime from "@/shared/realtime/useRealtime";

export default function useTodayCheckins() {
  const [ids, setIds] = useState(null);
  const today = moment().utcOffset(7).format("YYYY-MM-DD");
  const load = useCallback(() => AttendanceService.list({ from: today, to: today })
    .then((d) => setIds(new Set((d?.attendance || []).map((r) => String(r.eventId)))))
    .catch(() => setIds((p) => p || new Set())), [today]);
  useEffect(() => { load(); }, [load]);
  useRealtime("attendance", () => { load(); });
  return ids;
}
