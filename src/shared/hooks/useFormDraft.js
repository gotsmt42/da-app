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
import { saveDraft, loadDraft, clearDraft, draftAgoText } from "@/shared/utils/formDraft";

export default function useFormDraft({ key, enabled, data, restore }) {
  const [restoredAt, setRestoredAt] = useState(null);
  const initialRef = useRef(null);
  const readyRef = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const json = enabled ? JSON.stringify(data ?? null) : "";

  const latestRef = useRef(json);
  latestRef.current = json;

  // เปิดฟอร์ม → รอให้ฟอร์มตั้งค่าเริ่มต้นของตัวเองเสร็จก่อน (effect รีเซ็ตตอนเปิด) แล้วจำค่าตั้งต้น + เติมร่างที่ค้างไว้
  useEffect(() => {
    if (!enabled || !key) { readyRef.current = false; setRestoredAt(null); return undefined; }
    let t2;
    const t1 = setTimeout(() => {
      initialRef.current = latestRef.current;
      const d = loadDraft(key);
      if (d?.data) {
        try { restoreRef.current?.(d.data); setRestoredAt(d.at); } catch { /* ร่างเสีย — ข้าม */ }
      } else setRestoredAt(null);
      t2 = setTimeout(() => { readyRef.current = true; }, 30);
    }, 80);
    return () => { clearTimeout(t1); clearTimeout(t2); readyRef.current = false; };
  }, [enabled, key]);

  // พิมพ์/เลือก → บันทึก (หน่วง 400ms)
  useEffect(() => {
    if (!enabled || !key || !readyRef.current) return undefined;
    if (json === initialRef.current && !restoredAt) return undefined;
    const t = setTimeout(() => saveDraft(key, JSON.parse(json)), 400);
    return () => clearTimeout(t);
  }, [json, enabled, key, restoredAt]);

  const clear = useCallback(() => { readyRef.current = false; clearDraft(key); setRestoredAt(null); }, [key]);
  const discard = useCallback(() => {
    clearDraft(key);
    setRestoredAt(null);
    if (initialRef.current) { try { restoreRef.current?.(JSON.parse(initialRef.current)); } catch { /* ข้าม */ } }
  }, [key]);

  return { restoredAt, clear, discard };
}

/** แถบบอกว่ากู้คืนข้อมูลที่กรอกค้างไว้ + ปุ่มล้างทิ้ง */
export function DraftBanner({ draft, sx }) {
  if (!draft?.restoredAt) return null;
  return (
    <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", ...sx }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <History sx={{ fontSize: 18, color: "#1d4ed8" }} />
        <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: "#1e3a8a" }}>
          กู้คืนข้อมูลที่กรอกค้างไว้ ({draftAgoText(draft.restoredAt)})
        </Typography>
        <Button size="small" variant="outlined" onClick={draft.discard}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#1d4ed8", borderColor: "#bfdbfe", bgcolor: "#fff", py: 0.2 }}>
          ล้างทิ้ง
        </Button>
      </Stack>
    </Box>
  );
}
