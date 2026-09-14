/**
 * useExpenseSummary — ตัวเลขสรุประบบเบิก (รออนุมัติ / รอจ่าย / รอเคลียร์ / รอปิดส่วนต่าง) สำหรับป้ายแจ้งเตือน
 *
 * ✅ ใช้ร่วมกันหลายจุดพร้อมกัน (เมนูหลักหน้า Dashboard + แถบเมนูล่างบนมือถือ) — แคชไว้ระดับโมดูล
 * ยิง API ครั้งเดียวต่อช่วงเวลา ไม่ใช่ทุก component ยิงของตัวเอง และทุกครั้งที่เปลี่ยนหน้า
 * ⚠️ แคชผูกกับ userId — ออกจากระบบแล้วเข้าด้วยบัญชีอื่นในแท็บเดิม ต้องไม่เห็นตัวเลขของคนก่อนหน้า
 * ⚠️ เป็นแค่ตัวช่วยแสดงป้าย ดึงไม่สำเร็จ = คืน null เงียบๆ (ไม่มีป้าย) ห้ามทำให้เมนูใช้งานไม่ได้
 */
import { useEffect, useState } from "react";
import ExpenseService from "../services/ExpenseService";

const TTL_MS = 60_000;
let cache = { userId: "", at: 0, data: null, promise: null };

const load = (userId) => {
  if (cache.userId !== userId) cache = { userId, at: 0, data: null, promise: null };
  if (cache.data && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.data);
  if (!cache.promise) {
    const mine = ExpenseService.summary()
      .then((data) => {
        if (cache.userId === userId) cache = { userId, at: Date.now(), data, promise: null };
        return data;
      })
      .catch(() => {
        if (cache.userId === userId) cache.promise = null;
        return null;
      });
    cache.promise = mine;
  }
  return cache.promise;
};

/**
 * @param {boolean} enabled   false = ผู้ใช้ไม่มีสิทธิ์ระบบเบิก (ไม่ต้องยิง)
 * @param {string}  userId
 * @param {*}       refreshKey เปลี่ยนค่าเมื่อไร (เช่น pathname) จะเช็คว่าแคชหมดอายุหรือยัง
 */
export default function useExpenseSummary(enabled, userId, refreshKey) {
  const [data, setData] = useState(() => (enabled && cache.userId === (userId || "") ? cache.data : null));

  useEffect(() => {
    if (!enabled) { setData(null); return undefined; }
    let alive = true;
    load(userId || "").then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [enabled, userId, refreshKey]);

  return data;
}
