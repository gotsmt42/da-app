/**
 * useMyAttention — งานที่ "ฉัน" ต้องลงมือตอนนี้ แยก 3 หมวด (ตรรกะกลาง shared/utils/myJobAttention)
 * @returns {{ checkin: Event[], ack: Event[], confirm: Event[], total: number, ready: boolean }}
 *   งานหลายช่วงวัน (jobGroupId) นับรับทราบ/ยืนยันนัดเป็นงานเดียว · บันทึกเข้างานนับรายวันของงานนั้น
 */
import { useMemo } from "react";
import useTodayCheckins from "@/shared/hooks/useTodayCheckins";
import { attentionOf } from "@/shared/utils/myJobAttention";
import { isRespOrHead } from "@/shared/utils/jobFlow";
import { buildDaysPastDueMap, isFlaggedDays, getOverdueGroupKey } from "@/shared/utils/overdueJobs";

export default function useMyAttention(events, userData) {
  const todayCheckedIds = useTodayCheckins();
  return useMemo(() => {
    const out = { checkin: [], ack: [], confirm: [] };
    const seen = new Set();
    (events || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start)).forEach((e) => {
      const k = attentionOf(e, { userId: userData?.userId, fname: userData?.fname, todayCheckedIds });
      if (!k) return;
      const key = `${k}:${k === "checkin" ? e._id : e.jobGroupId || e._id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out[k].push(e);
    });
    // งานค้าง (เกณฑ์เดียวกับแท็บ "ค้างงาน" — เลยวันสุดท้ายเกิน 7 วัน) ของงานที่ฉันเป็นผู้รับผิดชอบ/หัวหน้าทีม · 1 งานต่อกลุ่ม
    const mine = (events || []).filter((e) => isRespOrHead(e, userData?.userId, userData?.fname) && !e.unscheduled);
    const due = buildDaysPastDueMap(mine);
    const seenG = new Set();
    out.overdue = mine
      .filter((e) => { const d = due.get(e._id); if (!d || !isFlaggedDays(d.days)) return false; const k = getOverdueGroupKey(e); if (seenG.has(k)) return false; seenG.add(k); return true; })
      .map((e) => ({ ...e, __overdueDays: due.get(e._id).days }))
      .sort((a, b) => b.__overdueDays - a.__overdueDays);
    return { ...out, total: out.checkin.length + out.ack.length + out.confirm.length + out.overdue.length, ready: todayCheckedIds !== null };
  }, [events, userData?.userId, userData?.fname, todayCheckedIds]);
}
