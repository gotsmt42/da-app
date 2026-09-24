/**
 * useAppBadges — ตัวเลข "ของค้างที่ต้องทำ" สำหรับป้ายแจ้งเตือนบนทุกเมนูของแอป
 *
 * ✅ ที่มา (ผู้ใช้ขอ): "สร้างการแจ้งเตือนข้อมูล ให้เหมือนปุ่มใบเสนอราคาให้ครบทุกจุดที่ควรมี" — เดิมมีป้าย
 * ตัวเลขแค่ 3 จุด (ใบเสนอราคาบนเมนูหลัก, ใบเคลม, รออนุมัติการเบิก) แต่ละจุดคำนวณเองคนละที่
 * ตอนนี้รวมมาคิดที่เดียว แล้วเมนูทุกชุด (เมนูหลักหน้าแรก · แถบล่างมือถือ · แถบบน · เมนูมือถือ) อ่านจากตัวนี้
 *
 * ⚠️ **ป้ายต้องหมายถึง "สิ่งที่คนคนนี้ต้องลงมือทำ" เท่านั้น** ไม่ใช่ "จำนวนข้อมูลในหน้านั้น" — ป้ายที่ขึ้นเลข
 * ทั้งที่กดเข้าไปแล้วไม่มีอะไรให้ทำ คือป้ายที่ผู้ใช้จะเลิกสนใจภายในไม่กี่วัน (เหมือนแจ้งเตือนที่เตือนมั่ว)
 * ⚠️ ตัวเลขต้องตรงกับที่หน้าปลายทางแสดงเป๊ะ จึงใช้ "ยูทิลตัวเดียวกับหน้านั้น" คำนวณ ไม่เขียนสูตรใหม่ที่นี่
 *   • countPendingJobs / countDistinctJobs / countOverdueContracts / getFollowUpInfo
 *
 * ⚠️ ดึงข้อมูลครั้งเดียวแล้วแจกทุกคนที่ subscribe (events ก้อนละ ~150 kB) — ห้ามให้แต่ละเมนูยิงเอง
 * Header เองก็ใช้ store นี้แทนการ fetch ของตัวเอง (เดิม poll 30 วิ) จำนวน request จึงเท่าเดิม
 * ⚠️ ดึงไม่สำเร็จ = ไม่มีป้าย (เงียบๆ) ห้ามทำให้เมนูพัง — ป้ายเป็นของประกอบ ไม่ใช่ข้อมูลหลักของหน้าไหน
 */
import { useEffect, useState } from "react";

import EventService from "@/shared/services/EventService";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import DispatchService from "@/features/dispatch/services/DispatchService";
import WebsiteService from "@/features/website/services/WebsiteService";
import { can, isRole, ROLES } from "@/shared/utils/roles";
import { countDistinctJobs, getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { countPendingJobs } from "@/shared/utils/approvalStatus";
import { countOverdueContracts } from "@/shared/utils/contractOverdue";
import { getFollowUpInfo } from "@/shared/utils/quotationTracking";
import { subscribeRealtime } from "@/shared/realtime/realtimeClient";

/**
 * คำอธิบายของแต่ละป้าย — ใช้เป็น aria-label ให้ผู้ใช้ screen reader รู้ว่าเลขนั้นคือเรื่องอะไร
 * (เห็นแต่ตัวเลขลอยๆ ข้างชื่อเมนูแปลว่าอะไรก็ไม่รู้)
 */
export const BADGE_LABEL = {
  pendingApproval: "แผนงานรออนุมัติ",
  closeRequests: "คำขอปิดงานรอตรวจ",
  contracts: "สัญญาที่ถึงกำหนดรอบถัดไป",
  myJobs: "งานที่ต้องทำ",
  quotations: "ใบเสนอราคาที่ต้องติดตาม",
  dispatchQueue: "คำขอลงงานรอตัดสินใจ",
  dispatchMine: "ใบแจ้งงานที่ถูกตีกลับ",
  advance: "ใบ Advance ที่ถูกตีกลับ",
  claim: "ใบ Advance ที่รอเคลียร์",
  expenseInbox: "ใบเบิกที่รอดำเนินการ",
  webLeads: "คำขอใหม่จากเว็บไซต์",
};

/**
 * ความเร่งด่วนของแต่ละป้าย — ใช้เลือกสีให้ตรงกันทุกพื้นผิว (การ์ดหน้าแรก · แถบล่าง · เมนูข้าง)
 *
 * 🐛 เดิมป้ายทุกใบเป็นสีแดงเหมือนกันหมด ไม่ว่าจะเป็น "ใบที่ถูกตีกลับต้องแก้เดี๋ยวนี้" หรือ
 *    "สัญญาที่จะถึงกำหนดรอบหน้า" — กวาดตาแล้วแยกไม่ออกว่าอันไหนต้องรีบ
 *    และยังใช้แดงคนละเฉดกันอยู่ด้วย (#ef4444 ที่หน้าแรก/แถบล่าง กับ #dc2626 ที่เมนูข้าง)
 * ✅ สองระดับพอ ไม่ทำสามระดับ — ป้ายเป็นแค่ตัวเลขเล็กๆ ถ้าต้องแยกสามสีคนจะจำไม่ไหว
 *    • act  (แดง)   = มีของรอเราตัดสินใจ หรือถูกตีกลับมาให้แก้
 *    • soon (อำพัน) = เตือนล่วงหน้า ยังไม่ถึงกำหนด ไม่ต้องทำวันนี้ก็ได้
 * ⚠️ คีย์ที่ไม่ได้ระบุไว้ = "act" โดยปริยาย — เพิ่มป้ายใหม่แล้วลืมใส่ จะได้สีของ "ต้องทำ"
 *    ซึ่งปลอดภัยกว่าการเงียบหายไปเป็นสีเตือนล่วงหน้า
 */
const BADGE_TONE = {
  contracts: "soon",    // สัญญาที่ถึงกำหนดรอบถัดไป — เป็นการวางแผน ไม่ใช่ของค้าง
  quotations: "soon",   // ใบเสนอราคาที่ต้องติดตาม — ยังไม่มีใครรอเราตัดสินใจ
};

/** โทนสีของป้ายตัวเลขหนึ่งใบ — "act" หรือ "soon" */
export const badgeTone = (badgeKey) => BADGE_TONE[badgeKey] || "act";

const POLL_MS = 30_000;

const EMPTY = {
  pendingApproval: 0, closeRequests: 0, contracts: 0, myJobs: 0,
  quotations: 0, dispatchQueue: 0, dispatchMine: 0,
  advance: 0, claim: 0, expenseInbox: 0, webLeads: 0,
};

/** สิ่งที่ผู้ใช้คนนี้มีสิทธิ์เห็น = สิ่งที่ต้องดึง (ไม่ยิง endpoint ที่จะโดน 403 อยู่แล้ว) */
const scopeOf = (userData) => ({
  jobs: Boolean(userData),
  contracts: can(userData, "viewContracts"),
  quotations: can(userData, "viewAllJobs"), // เกณฑ์เดียวกับกล่อง "ใบเสนอราคาที่ต้องติดตาม" หน้า Dashboard
  expense: can(userData, "requestExpense") || can(userData, "viewAllExpenses"),
  dispatchQueue: can(userData, "assignDispatch"),
  dispatchMine: can(userData, "requestDispatch") && isRole(userData, ROLES.SALE),
  // ✅ คำขอจากเว็บไซต์ที่ยังไม่มีใครรับเรื่อง (สถานะ "ใหม่") — ลูกค้ารอสายอยู่ ต้องเห็นทันที
  webLeads: can(userData, "viewLeads"),
});

let lastUser = null;
let store = { userId: "", data: { events: [], drafts: [], expense: null, dispatch: null, leads: null }, at: 0, loading: false };
const subscribers = new Set();
let timer = null;

const emit = () => subscribers.forEach((fn) => fn(store.data));

const ALL_PARTS = ["events", "drafts", "expense", "dispatch", "leads"];
/** ส่วนที่ต้องดึงซ้ำตอนมีสัญญาณเรียลไทม์ — ไม่ดึงงานทั้งก้อน (~150 kB) เพียงเพราะมีคนอนุมัติใบเบิก */
const PARTS_BY_TOPIC = { events: ["events", "drafts"], dispatch: ["dispatch"], expenses: ["expense"], leads: ["leads"] };
let queuedParts = null;

/** @param {string[]} [parts] ดึงเฉพาะส่วนนี้ (ไม่ระบุ = ทั้งหมด) */
const fetchAll = async (userData, parts = ALL_PARTS) => {
  const scope = scopeOf(userData);
  // ⚠️ กำลังดึงอยู่ — จดส่วนที่ขอไว้แล้วดึงต่อหลังรอบนี้จบ (ไม่งั้นสัญญาณที่มาระหว่างนั้นหายเงียบ)
  if (store.loading) {
    queuedParts = new Set([...(queuedParts || []), ...parts]);
    return;
  }
  store.loading = true;
  const want = new Set(parts);
  const [events, drafts, expense, dispatch, leads] = await Promise.all([
    scope.jobs && want.has("events") ? EventService.getEventOp().then((r) => r?.userEvents || []).catch(() => null) : null,
    scope.contracts && want.has("drafts") ? EventService.GetDraftEvents().then((r) => r?.drafts || []).catch(() => null) : null,
    scope.expense && want.has("expense") ? ExpenseService.summary().catch(() => null) : null,
    (scope.dispatchQueue || scope.dispatchMine) && want.has("dispatch") ? DispatchService.summary().catch(() => null) : null,
    scope.webLeads && want.has("leads") ? WebsiteService.leadSummary().catch(() => null) : null,
  ]);
  store.loading = false;
  // ⚠️ ค่าที่ดึงไม่สำเร็จ (null) ต้องคงของเดิมไว้ ไม่ใช่ล้างเป็นว่าง — เน็ตสะดุดทีเดียวป้ายหายทั้งแอป
  store.data = {
    events: events ?? store.data.events,
    drafts: drafts ?? store.data.drafts,
    expense: expense ?? store.data.expense,
    dispatch: dispatch ?? store.data.dispatch,
    leads: leads ?? store.data.leads,
  };
  if (want.size === ALL_PARTS.length) store.at = Date.now();
  emit();
  if (queuedParts) {
    const next = [...queuedParts];
    queuedParts = null;
    fetchAll(userData, next);
  }
};

/**
 * ✅ เรียลไทม์: ฟังสัญญาณครั้งเดียวทั้งแอป (ไม่ใช่ทุกเมนูที่ใช้ hook นี้ฟังเอง) แล้วดึงเฉพาะส่วนที่เปลี่ยน
 * ป้ายตัวเลขบนเมนูทุกจุดจึงขยับทันทีที่มีคนส่ง/อนุมัติ/แก้งาน โดยไม่ต้องรอรอบ 30 วินาที
 */
let realtimeOff = null;
let realtimeTimer = null;
let realtimeParts = new Set();
const flushRealtime = () => {
  if (document.visibilityState === "hidden") return; // แท็บซ่อนอยู่ — เก็บไว้ดึงตอนกลับมา
  const parts = [...realtimeParts];
  realtimeParts = new Set();
  if (parts.length && lastUser && subscribers.size) fetchAll(lastUser, parts);
};
const onBadgeVisibility = () => { if (document.visibilityState === "visible" && realtimeParts.size) flushRealtime(); };
const listenRealtime = () => {
  if (realtimeOff) return;
  const off = subscribeRealtime(Object.keys(PARTS_BY_TOPIC), (evt) => {
    (evt.type === "resync" ? ALL_PARTS : PARTS_BY_TOPIC[evt.topic] || []).forEach((p) => realtimeParts.add(p));
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(flushRealtime, 500);
  });
  document.addEventListener("visibilitychange", onBadgeVisibility);
  realtimeOff = () => {
    off();
    document.removeEventListener("visibilitychange", onBadgeVisibility);
    clearTimeout(realtimeTimer);
    realtimeParts = new Set();
    realtimeOff = null;
  };
};

const start = (userData) => {
  lastUser = userData;
  const uid = String(userData?.userId || "");
  // เปลี่ยนบัญชี = ทิ้งของเก่าทั้งหมด ห้ามให้ป้ายของคนก่อนหน้าค้างอยู่
  if (store.userId !== uid) {
    store = { userId: uid, data: { events: [], drafts: [], expense: null, dispatch: null, leads: null }, at: 0, loading: false };
    emit();
  }
  if (Date.now() - store.at > POLL_MS) fetchAll(userData);
  if (!timer) timer = setInterval(() => fetchAll(userData), POLL_MS);
  listenRealtime();
};

/** เรียกหลังทำรายการที่เปลี่ยนตัวเลข (อนุมัติ/ส่งใบ ฯลฯ) ให้ป้ายอัปเดตทันทีโดยไม่ต้องรอรอบถัดไป */
export const refreshAppBadges = () => {
  store.at = 0;
  if (lastUser && subscribers.size) fetchAll(lastUser);
};

const computeBadges = (userData, data) => {
  if (!userData) return EMPTY;
  const scope = scopeOf(userData);
  const userId = userData.userId;
  const isAdminOrManager = can(userData, "viewAllJobs");
  const events = data.events || [];
  const drafts = data.drafts || [];
  const ex = data.expense || {};
  const byStatus = data.dispatch?.byStatus || {};

  // ใบเสนอราคาที่ถึงกำหนดตาม — กฎเดียวกับกล่องบน Dashboard (จัดกลุ่มงานหลายครั้งเป็นใบเดียวก่อนนับ)
  let quotations = 0;
  if (scope.quotations) {
    const heads = new Map();
    events.forEach((e) => {
      if (e.quotationStatus !== "sent" || !e.quotationSentAt) return;
      const key = getOverdueGroupKey(e);
      if (!heads.has(key)) heads.set(key, e);
    });
    quotations = [...heads.values()].filter((head) => getFollowUpInfo(head)?.needsFollowUp).length;
  }

  return {
    pendingApproval: countPendingJobs(events, drafts, { userId, isAdminOrManager }),
    closeRequests: countDistinctJobs(events, (e) => e.closeRequested === true && e.status !== "ดำเนินการเสร็จสิ้น"),
    contracts: scope.contracts ? countOverdueContracts([...events, ...drafts]) : 0,
    myJobs: isRole(userData, ROLES.TECHNICIAN)
      ? countDistinctJobs(events, (e) => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status) && !e.closeRequested)
      : 0,
    quotations,
    /**
     * คิว "คำขอลงงาน" = คำขอจากฝ่ายขาย (Dispatch ที่ยังไม่ลงแผนงาน) + แผนงานที่ช่างสร้างเองแล้วรออนุมัติ
     * 🐛 ที่แก้ (ผู้ใช้แจ้ง "ทำไมจำนวนแจ้งเตือนไม่ขึ้น"): เดิมนับแค่ฝั่งฝ่ายขาย พอคิวมีแต่งานจากช่าง
     * ป้ายจึงเป็น 0 ทั้งที่หน้านั้นขึ้น "รอตัดสินใจ 1" — ป้ายกับหน้าปลายทางต้องเป็นเลขเดียวกันเสมอ
     * (หน้านั้นคิด waiting + approvalCount ดู JobRequestQueue.js)
     * ⚠️ งานรออนุมัติถูกนับทั้งที่นี่และที่ป้ายของปฏิทินโดยตั้งใจ — เป็นงานชิ้นเดียวที่ทำได้จากทั้งสองหน้า
     */
    dispatchQueue: scope.dispatchQueue
      ? (Number(byStatus.requested) || 0) + countPendingJobs(events, drafts, { userId, isAdminOrManager })
      : 0,
    dispatchMine: scope.dispatchMine ? Number(byStatus.rejected) || 0 : 0,
    // ใบเบิก: ป้ายบน "ใบ Advance"/"ใบเคลม" = ใบของฉันที่ถูกตีกลับ (ต้องแก้แล้วส่งใหม่)
    // ส่วน "ใบเคลม" รวมใบ Advance ที่รับเงินแล้วยังไม่ได้เคลียร์ด้วย — เป็นงานค้างของผู้เบิกเหมือนกัน
    advance: Number(ex.advanceRejectedMine) || 0,
    // 🐛 เดิมใช้ awaitingClaim (ของทุกคนที่มองเห็น) → หัวหน้าเห็นเลขค้างบน "ใบเคลม" ตลอดทั้งที่ไม่ใช่งานตัวเอง
    // ✅ ใช้ใบ Advance "ของฉัน" ที่ต้องเคลียร์เท่านั้น
    claim: (Number(ex.awaitingClaimMine ?? ex.awaitingClaim) || 0) + (Number(ex.claimRejectedMine) || 0),
    /**
     * ✅ นับเฉพาะใบที่ผู้ใช้คนนี้กดทำรายการได้จริง ตามขั้นของตัวเองในสายอนุมัติ 4 ขั้น
     *   inboxPending (ตรวจสอบ) + inboxReviewing (อนุมัติ) + inboxDisburse (อนุมัติเบิกจ่าย)
     * server กรองกฎสิทธิ์/ใบตัวเอง/ผู้ตรวจสอบคนเดิมให้แล้ว — คนที่ไม่มีสิทธิ์ขั้นนั้นได้ 0 เสมอ
     */
    expenseInbox: (Number(ex.inboxPending) || 0)
      + (Number(ex.inboxReviewing) || 0)
      + (Number(ex.inboxDisburse) || 0),
    webLeads: scope.webLeads ? Number(data.leads?.new) || 0 : 0,
  };
};

/**
 * @param {object} userData จาก useAuth() — ไม่มี (ยังไม่ล็อกอิน) = ไม่ดึงอะไรเลย
 * @returns {{ badges: object, events: Array, drafts: Array, ready: boolean }}
 *   events/drafts คืนออกไปด้วยเพื่อให้ Header ใช้ก้อนเดียวกันทำการแจ้งเตือน ไม่ต้องดึงซ้ำ
 */
export default function useAppBadges(userData) {
  const [data, setData] = useState(store.data);

  useEffect(() => {
    if (!userData) return undefined;
    const onChange = (d) => setData(d);
    subscribers.add(onChange);
    start(userData);
    return () => {
      subscribers.delete(onChange);
      if (subscribers.size === 0 && timer) { clearInterval(timer); timer = null; }
      if (subscribers.size === 0) realtimeOff?.();
    };
  }, [userData]);

  return { badges: computeBadges(userData, data), events: data.events, drafts: data.drafts, ready: store.at > 0 };
}
