/**
 * useFormDraft — เก็บข้อมูลที่กรอกค้างในฟอร์ม React (Dialog) ไม่ให้หายเมื่อหลุด/ปิดโดยไม่ตั้งใจ (ดู shared/utils/formDraft.js)
 *
 *   const draft = useFormDraft({ key: "expense:new:advance", enabled: open && !expense, data: { subject, items, ... },
 *     restore: (d) => { setSubject(d.subject); setItems(d.items); ... } });
 *   ...<DraftBanner draft={draft} />   (วางบนสุดของเนื้อหาฟอร์ม)
 *   บันทึกสำเร็จ → draft.clear()
 *
 * ⚠️ data ต้องเป็นค่าที่ JSON ได้ (ไม่มีไฟล์/ฟังก์ชัน) · เริ่มบันทึกเมื่อค่าเปลี่ยนจากตอนเปิดฟอร์มแล้วเท่านั้น
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, Button } from "@mui/material";
import { History } from "@mui/icons-material";
import { saveDraft, loadDraft, clearDraft, draftAgoText, userActedWithin } from "@/shared/utils/formDraft";

const diffKeys = (a = {}, b = {}) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
  .filter((k) => JSON.stringify(a?.[k] ?? "") !== JSON.stringify(b?.[k] ?? ""));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k]]));

/**
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ข้อมูลเดิมมันนับเป็นพึ่งกรอกด้วย — ให้นับเฉพาะที่กรอกใหม่จริงๆ")
 *   • เก็บ { data: เฉพาะช่องที่แก้, base: ค่าเดิมก่อนแก้ } · ไม่มีช่องที่แก้ = ไม่เก็บ/ไม่กู้คืน/ไม่มีแถบ
 *   • ค่าที่เปลี่ยนเองโดยไม่มีการกด/พิมพ์ของผู้ใช้ (เช่น โหลดตัวเลือกเสร็จแล้วเติมให้) → นับเป็นค่าตั้งต้นใหม่ ไม่ใช่ที่กรอก
 */
export default function useFormDraft({ key, enabled, data, restore }) {
  const [restoredAt, setRestoredAt] = useState(null);
  const [restoredCount, setRestoredCount] = useState(0);
  const baseRef = useRef(null);       // ค่าตั้งต้น (object)
  const restoredKeysRef = useRef([]); // ช่องที่กู้คืนมา — ค่าตั้งต้นของช่องเหล่านี้ยึดตามร่าง
  const readyRef = useRef(false);
  const readyAtRef = useRef(0);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const json = enabled ? JSON.stringify(data ?? null) : "";
  const latestRef = useRef(json);
  latestRef.current = json;

  // เปิดฟอร์ม → รอให้ฟอร์มตั้งค่าเริ่มต้นของตัวเองเสร็จก่อน แล้วจำค่าตั้งต้น + เติมเฉพาะช่องที่เคยแก้
  useEffect(() => {
    if (!enabled || !key) { readyRef.current = false; setRestoredAt(null); return undefined; }
    let t2;
    const t1 = setTimeout(() => {
      const now = JSON.parse(latestRef.current || "null") || {};
      baseRef.current = now;
      restoredKeysRef.current = [];
      const d = loadDraft(key);
      const v2 = d?.data?.v === 2 ? d.data : null;
      const keys = v2 ? diffKeys(pick(v2.data, Object.keys(v2.data || {})), pick(now, Object.keys(v2.data || {}))) : [];
      if (v2 && keys.length) {
        try {
          restoreRef.current?.({ ...now, ...pick(v2.data, keys) });
          baseRef.current = { ...now, ...pick(v2.base || {}, keys) };
          restoredKeysRef.current = keys;
          setRestoredAt(d.at); setRestoredCount(keys.length);
        } catch { /* ร่างเสีย — ข้าม */ }
      } else {
        if (d) clearDraft(key);
        setRestoredAt(null);
      }
      t2 = setTimeout(() => { readyRef.current = true; readyAtRef.current = Date.now(); }, 60);
    }, 120);
    return () => { clearTimeout(t1); clearTimeout(t2); readyRef.current = false; };
  }, [enabled, key]);

  // พิมพ์/เลือก → บันทึกเฉพาะช่องที่แก้ (หน่วง 400ms)
  useEffect(() => {
    if (!enabled || !key || !baseRef.current) return undefined;
    const now = JSON.parse(json || "null") || {};
    // ค่าเปลี่ยนโดยไม่มีการกด/พิมพ์ของผู้ใช้ (หรือก่อนฟอร์มพร้อม) → โค้ดเติมให้เอง = ค่าตั้งต้นใหม่
    // ⚠️ นับเฉพาะการกด/พิมพ์หลังฟอร์มพร้อม — การกดปุ่มเปิดฟอร์มไม่นับ
    if (!readyRef.current || !userActedWithin(1500, readyAtRef.current)) {
      baseRef.current = { ...now, ...pick(baseRef.current, restoredKeysRef.current) };
      return undefined;
    }
    const t = setTimeout(() => {
      const changed = diffKeys(now, baseRef.current);
      if (!changed.length) clearDraft(key);
      else saveDraft(key, { v: 2, data: pick(now, changed), base: pick(baseRef.current, changed) });
    }, 400);
    return () => clearTimeout(t);
  }, [json, enabled, key]);

  const clear = useCallback(() => { readyRef.current = false; clearDraft(key); setRestoredAt(null); }, [key]);
  const discard = useCallback(() => {
    clearDraft(key);
    setRestoredAt(null);
    const now = JSON.parse(latestRef.current || "null") || {};
    try { restoreRef.current?.({ ...now, ...pick(baseRef.current || {}, restoredKeysRef.current) }); } catch { /* ข้าม */ }
    restoredKeysRef.current = [];
  }, [key]);

  return { restoredAt, restoredCount, clear, discard };
}

/** แถบบอกว่ากู้คืนข้อมูลที่กรอกค้างไว้ + ปุ่มล้างทิ้ง */
export function DraftBanner({ draft, sx }) {
  if (!draft?.restoredAt) return null;
  return (
    <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", ...sx }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <History sx={{ fontSize: 18, color: "#1d4ed8" }} />
        <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: "#1e3a8a" }}>
          กู้คืนข้อมูลที่กรอกค้างไว้{draft.restoredCount ? ` ${draft.restoredCount} ช่อง` : ""} ({draftAgoText(draft.restoredAt)})
        </Typography>
        <Button size="small" variant="outlined" onClick={draft.discard}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#1d4ed8", borderColor: "#bfdbfe", bgcolor: "#fff", py: 0.2 }}>
          ล้างทิ้ง
        </Button>
      </Stack>
    </Box>
  );
}
