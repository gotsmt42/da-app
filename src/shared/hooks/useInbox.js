/**
 * useInbox — กล่องแจ้งเตือนของผู้ใช้ (ทุกเรื่องที่ระบบเด้ง push: งาน · ใบเบิก · OT · ใบขอซื้อ · คำขอจากเว็บ)
 *
 * ✅ ที่เดียวกันทุกเครื่อง (เก็บที่ server) — อ่านบนมือถือแล้ว กระดิ่งบนคอมเคลียร์ตามทันที (realtime "inbox")
 * ✅ ตัวเลขบนไอคอนแอป (แบบ LINE) ตั้งตามจำนวนที่ยังไม่อ่านทุกครั้งที่ข้อมูลเปลี่ยน
 * ⚠️ store เดียวทั้งแอป (โมดูลระดับไฟล์) — กระดิ่งบนหัวเว็บกับตัวจัดการคลิกแจ้งเตือนใช้ข้อมูลชุดเดียวกัน ไม่โหลดซ้ำ
 */
import { useEffect, useSyncExternalStore } from "react";
import PushService from "@/shared/services/PushService";
import useRealtime from "@/shared/realtime/useRealtime";

let state = { items: [], unread: 0, hasMore: false, loaded: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const set = (patch) => {
  state = { ...state, ...patch };
  PushService.setAppBadge(state.unread);
  emit();
};

let inflight = null;
export const refreshInbox = () => {
  if (!localStorage.getItem("token")) return Promise.resolve();
  if (!inflight) {
    inflight = PushService.inbox({ limit: 40 })
      .then((r) => set({ items: r.items || [], unread: r.unread || 0, hasMore: Boolean(r.hasMore), loaded: true }))
      .catch(() => {})
      .finally(() => { inflight = null; });
  }
  return inflight;
};

export const loadMoreInbox = async () => {
  const last = state.items[state.items.length - 1];
  if (!last) return;
  const r = await PushService.inbox({ limit: 40, before: last.createdAt });
  set({ items: [...state.items, ...(r.items || [])], hasMore: Boolean(r.hasMore), unread: r.unread ?? state.unread });
};

/** ทำเครื่องหมายอ่านแล้ว — อัปเดตหน้าจอก่อนแล้วค่อยบอก server (กดแล้วจางทันที ไม่ต้องรอเน็ต) */
export const markInboxRead = async (ids) => {
  const list = [].concat(ids || []).filter(Boolean).map(String);
  if (!list.length) return;
  const now = new Date().toISOString();
  const hit = state.items.filter((n) => list.includes(String(n._id)) && !n.readAt).length;
  set({ items: state.items.map((n) => (list.includes(String(n._id)) && !n.readAt ? { ...n, readAt: now } : n)), unread: Math.max(0, state.unread - hit) });
  try { const r = await PushService.markRead(list); set({ unread: r.unread ?? state.unread }); } catch { /* realtime/โหลดรอบหน้าจะแก้ให้ */ }
};

export const markAllInboxRead = async () => {
  const now = new Date().toISOString();
  set({ items: state.items.map((n) => (n.readAt ? n : { ...n, readAt: now })), unread: 0 });
  try { await PushService.markAllRead(); } catch { /* เงียบไว้ */ }
};

export const clearReadInbox = async () => {
  set({ items: state.items.filter((n) => !n.readAt) });
  try { await PushService.clearRead(); } catch { /* เงียบไว้ */ }
};

/** ล็อกเอาต์ — ล้างรายการ + ตัวเลขบนไอคอนแอป (คนถัดไปที่ใช้เครื่องนี้ต้องไม่เห็นของคนก่อน) */
export const resetInbox = () => set({ items: [], unread: 0, hasMore: false, loaded: false });

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => state;

export default function useInbox({ enabled = true } = {}) {
  const s = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    if (!enabled) return undefined;
    refreshInbox();
    const onVisible = () => { if (document.visibilityState === "visible") refreshInbox(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);
  useRealtime("inbox", () => refreshInbox(), { enabled, debounceMs: 250 });
  return s;
}
