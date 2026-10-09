import { useCallback, useMemo, useRef, useState } from "react";

/**
 * ลำดับ + การซ่อน/แสดงคอลัมน์ของตารางภาพรวมงาน (ลากหัวคอลัมน์สลับที่ได้แบบ Excel)
 *
 * ✅ คีย์ในที่นี้คือ "คอลัมน์ที่ผู้ใช้เห็น" ไม่ใช่ฟิลด์ข้อมูล — บางคีย์กินหลายช่องจริงในตาราง:
 *    doc = docRef (แท็บสัญญา) หรือ docNo (แท็บงานทั่วไป/โปรเจค) · visits = ครั้งที่ 1..N ทั้งชุด (ย้ายไปด้วยกัน)
 * ✅ จำค่าไว้ในเบราว์เซอร์ของแต่ละคน — เป็นความชอบส่วนตัวในการอ่านตาราง ไม่ใช่ข้อมูลของบริษัท
 * ⚠️ ทุกการอ่าน/เขียน localStorage ห่อ try/catch — โหมดส่วนตัว/ปิด storage ต้องยังใช้ตารางได้ตามปกติ
 */

export const OVERVIEW_COLUMNS = [
  // ✅ (8 ต.ค. 2569) รวมเหลือ 6 คอลัมน์ตามที่ผู้ใช้เลือก — ดู MERGED_COLUMNS ใน ContractOverview.js
  // ตัวระบุงาน — ซ่อนไม่ได้ ไม่งั้นแถวในตารางจะไม่มีอะไรบอกเลยว่าเป็นงานไหน
  { key: "customer", label: "โครงการ / เลขที่สัญญา / ผู้ติดต่อ", locked: true },
  { key: "work", label: "งาน (ประเภท / ระบบ)" },
  { key: "responsiblePerson", label: "ผู้รับผิดชอบ" },
  { key: "contract", label: "สัญญา · สถานะ" },
  { key: "jobValue", label: "มูลค่างาน" },
  { key: "commission", label: "ค่าคอมลูกค้า" },
  { key: "visits", label: "ครั้งที่เข้างาน" },
];

const DEFAULT_ORDER = OVERVIEW_COLUMNS.map((c) => c.key);
const KNOWN = new Set(DEFAULT_ORDER);
export const isLockedColumn = (key) => LOCKED.has(key);
const LOCKED = new Set(OVERVIEW_COLUMNS.filter((c) => c.locked).map((c) => c.key));

/** ค่าที่เก็บไว้อาจมาจากเวอร์ชันเก่า — ตัดคีย์ที่ไม่รู้จักทิ้ง และเติมคอลัมน์ใหม่ต่อท้ายตามลำดับตั้งต้น */
const sanitize = (raw) => {
  const order = Array.isArray(raw?.order) ? raw.order.filter((k, i, a) => KNOWN.has(k) && a.indexOf(k) === i) : [];
  DEFAULT_ORDER.forEach((k) => {
    if (order.includes(k)) return;
    // แทรกคอลัมน์ใหม่ไว้หลังคอลัมน์ที่อยู่ก่อนมันในลำดับตั้งต้น (ไม่ใช่ท้ายสุดเสมอ)
    const prev = DEFAULT_ORDER.slice(0, DEFAULT_ORDER.indexOf(k)).reverse().find((p) => order.includes(p));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, k);
  });
  const hidden = Array.isArray(raw?.hidden) ? raw.hidden.filter((k) => KNOWN.has(k) && !LOCKED.has(k)) : [];
  return { order, hidden };
};

const read = (key) => {
  try { return sanitize(JSON.parse(localStorage.getItem(key) || "null")); }
  catch { return sanitize(null); }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ไม่มี storage ก็ใช้ได้ แค่ไม่จำ */ }
};

export default function useColumnLayout(storageKey) {
  const [layout, setLayout] = useState(() => read(storageKey));

  const update = useCallback((fn) => {
    setLayout((prev) => {
      const next = sanitize(fn(prev));
      write(storageKey, next);
      return next;
    });
  }, [storageKey]);

  /** ย้าย from ไปไว้ด้านซ้าย/ขวาของ target */
  const moveColumn = useCallback((from, target, side = "left") => {
    if (!from || !target || from === target) return;
    update((prev) => {
      const order = prev.order.filter((k) => k !== from);
      const at = order.indexOf(target);
      if (at < 0) return prev;
      order.splice(side === "right" ? at + 1 : at, 0, from);
      return { ...prev, order };
    });
  }, [update]);

  /** เลื่อนไปซ้าย (-1) / ขวา (+1) ทีละช่อง — ใช้กับปุ่มลูกศรในเมนู (มือถือลากหัวตารางไม่ได้) */
  const moveBy = useCallback((key, delta) => {
    update((prev) => {
      const order = [...prev.order];
      const i = order.indexOf(key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= order.length) return prev;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...prev, order };
    });
  }, [update]);

  const toggleHidden = useCallback((key) => {
    if (LOCKED.has(key)) return;
    update((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(key) ? prev.hidden.filter((k) => k !== key) : [...prev.hidden, key],
    }));
  }, [update]);

  /** ย้ายไปซ้ายสุด ("start") / ขวาสุด ("end") — เมนูคลิกขวาที่หัวคอลัมน์ */
  const moveToEdge = useCallback((key, edge) => {
    update((prev) => {
      const order = prev.order.filter((k) => k !== key);
      if (edge === "start") order.unshift(key); else order.push(key);
      return { ...prev, order };
    });
  }, [update]);

  const showAll = useCallback(() => update((prev) => ({ ...prev, hidden: [] })), [update]);

  const reset = useCallback(() => update(() => ({ order: DEFAULT_ORDER, hidden: [] })), [update]);

  const isCustomized = useMemo(
    () => layout.hidden.length > 0 || layout.order.some((k, i) => k !== DEFAULT_ORDER[i]),
    [layout],
  );

  // ── ลากหัวคอลัมน์ (HTML5 drag & drop) ─────────────────────────────────────
  // ⚠️ เก็บคีย์ที่กำลังลากไว้ใน ref ด้วย — onDragOver ยิงถี่มาก อ่านจาก state จะได้ค่าเก่าในบางจังหวะ
  const [drag, setDrag] = useState({ key: null, overKey: null, side: null });
  const dragKeyRef = useRef(null);

  const propsFor = useCallback((key) => ({
    draggable: true,
    onDragStart: (e) => {
      dragKeyRef.current = key;
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key); } catch { /* */ }
      setDrag({ key, overKey: null, side: null });
    },
    onDragOver: (e) => {
      const from = dragKeyRef.current;
      if (!from) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "move"; } catch { /* */ }
      const rect = e.currentTarget.getBoundingClientRect();
      const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
      setDrag((d) => (d.overKey === key && d.side === side ? d : { ...d, overKey: key, side }));
    },
    onDragLeave: (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setDrag((d) => (d.overKey === key ? { ...d, overKey: null, side: null } : d));
    },
    onDrop: (e) => {
      e.preventDefault();
      const from = dragKeyRef.current;
      const rect = e.currentTarget.getBoundingClientRect();
      const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
      dragKeyRef.current = null;
      setDrag({ key: null, overKey: null, side: null });
      moveColumn(from, key, side);
    },
    onDragEnd: () => {
      dragKeyRef.current = null;
      setDrag({ key: null, overKey: null, side: null });
    },
  }), [moveColumn]);

  const dnd = useMemo(() => ({ ...drag, propsFor }), [drag, propsFor]);

  return { order: layout.order, hidden: layout.hidden, moveColumn, moveBy, moveToEdge, toggleHidden, showAll, reset, isCustomized, dnd };
}
