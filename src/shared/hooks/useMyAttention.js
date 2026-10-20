/**
 * useMyAttention — งานที่ "ฉัน" ต้องลงมือตอนนี้ แยก 3 หมวด (ตรรกะกลาง shared/utils/myJobAttention)
 * @returns {{ checkin: Event[], ack: Event[], confirm: Event[], total: number, ready: boolean }}
 *   งานหลายช่วงวัน (jobGroupId) นับรับทราบ/ยืนยันนัดเป็นงานเดียว · บันทึกเข้างานนับรายวันของงานนั้น
 */
import { useMemo } from "react";
import useTodayCheckins from "@/shared/hooks/useTodayCheckins";
import { attentionOf } from "@/shared/utils/myJobAttention";

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
    return { ...out, total: out.checkin.length + out.ack.length + out.confirm.length, ready: todayCheckedIds !== null };
  }, [events, userData?.userId, userData?.fname, todayCheckedIds]);
}
