/**
 * docFormKit — ชิ้นส่วนร่วมของกล่องออกเอกสาร (ใบแจ้งเข้างาน · ใบส่งมอบงาน)
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "แก้ไข UI และจัดวางปุ่มต่างๆ ให้ดูง่ายขึ้น เข้าใจง่าย ไม่รก · ให้ค้างอักษรที่พิมพ์
 *    ทิ้งไว้ บางทีเผลอกดออก ให้มีเวลาค้างไว้ · ถ้างานนี้มีการออกใบไปแล้วไม่ให้ออกซ้ำ"
 *   • DocSection      หัวข้อมีลำดับ 1-2-3 การ์ดขาวแบบเดียวกันทุกก้อน (กฎออกแบบ: สีน้อย ระยะพอดี แนวตรง)
 *   • useDocDraft     บันทึกร่างอัตโนมัติลงเครื่อง เก็บไว้ DRAFT_TTL_DAYS วัน เปิดกล่องงานเดิมแล้วกู้คืนให้เอง
 *   • useIssuedDoc    ตรวจว่างานนี้มีใบชนิดนี้ที่ยังใช้อยู่แล้วหรือยัง (server กันซ้ำอีกชั้น — routes/docNumber.js)
 */
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Stack, Typography, Button, IconButton, CircularProgress } from "@mui/material";
import { Close, History, TaskAlt, Visibility, OpenInNew, InfoOutlined } from "@mui/icons-material";

import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, PRIMARY_BTN_SX, ACCENT, ACCENT_SOFT } from "@/shared/ui/PageKit";

export const DRAFT_TTL_DAYS = 7;
const DRAFT_PREFIX = "docDraft:";

const fmtTime = (t) => {
  const d = new Date(t);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("th-TH", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
export const fmtThaiDate = (t) => (t ? new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-");

/** ล้างร่างที่หมดอายุทิ้ง — กันที่เก็บในเครื่องบวมจากงานที่ไม่เคยกลับมาเปิดอีก */
function sweepExpired() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (!k?.startsWith(DRAFT_PREFIX)) continue;
      const v = JSON.parse(localStorage.getItem(k) || "null");
      if (!v?.savedAt || now - v.savedAt > DRAFT_TTL_DAYS * 864e5) localStorage.removeItem(k);
    }
  } catch { /* ที่เก็บในเครื่องใช้ไม่ได้ — ข้ามไป */ }
}

/**
 * บันทึกร่างอัตโนมัติ — เผลอกดปิด/แอปรีโหลด กลับมาเปิดงานเดิมแล้วข้อความที่พิมพ์ไว้ยังอยู่
 *
 * ⚠️ บันทึกเฉพาะเมื่อ "ผู้ใช้แก้เอง" (dirtyRef) — ค่าที่ระบบเติมให้ตอนเปิด (ที่อยู่/เลขที่) ไม่นับ
 *    ไม่งั้นทุกงานที่แค่เปิดดูจะมีร่างค้างและขึ้นป้าย "กู้คืน" ทุกครั้ง
 * ⚠️ effect ของ hook นี้ต้องประกาศ "หลัง" effect ที่ตั้งค่าเริ่มต้นของฟอร์ม — การกู้คืนเป็น updater
 *    ที่ต่อคิวหลังค่าเริ่มต้น จึงทับค่าเริ่มต้นได้ถูกต้อง
 * @param {string[]} omit  คีย์ที่ไม่กู้คืน (เช่น docNumber ที่ระบบออกเลขให้เอง)
 */
export function useDocDraft({ open, draftKey, form, setFormState, dirtyRef, omit = [] }) {
  const [restoredAt, setRestoredAt] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const appliedRef = useRef(false);
  const key = draftKey ? `${DRAFT_PREFIX}${draftKey}` : "";

  useEffect(() => {
    if (!open) { appliedRef.current = false; return; }
    if (appliedRef.current || !key) return;
    appliedRef.current = true;
    dirtyRef.current = false;
    setRestoredAt(null); setSavedAt(null);
    sweepExpired();
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(key) || "null"); } catch { draft = null; }
    if (!draft?.form || !draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_DAYS * 864e5) return;
    const restored = { ...draft.form };
    omit.forEach((k) => delete restored[k]);
    setFormState((f) => (f ? { ...f, ...restored } : f));
    setRestoredAt(draft.savedAt);
    setSavedAt(draft.savedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- กู้คืนครั้งเดียวต่อการเปิดกล่อง
  }, [open, key]);

  useEffect(() => {
    if (!open || !key || !form || !dirtyRef.current) return undefined;
    const t = setTimeout(() => {
      try {
        const now = Date.now();
        localStorage.setItem(key, JSON.stringify({ savedAt: now, form }));
        setSavedAt(now);
      } catch { /* เต็ม/ถูกปิด — ไม่บล็อกการกรอก */ }
    }, 500);
    return () => clearTimeout(t);
  }, [open, key, form, dirtyRef]);

  const clear = () => {
    try { if (key) localStorage.removeItem(key); } catch { /* ข้าม */ }
    dirtyRef.current = false;
    setRestoredAt(null); setSavedAt(null);
  };
  return { restoredAt, savedAt, clear, savedLabel: savedAt ? `บันทึกร่างอัตโนมัติ ${fmtTime(savedAt)}` : "", restoredLabel: restoredAt ? fmtTime(restoredAt) : "" };
}

/** ใบชนิดนี้ที่ยังใช้อยู่ของงานนี้ (null = ยังไม่เคยออก) */
export function useIssuedDoc({ open, eventId, docType }) {
  const [state, setState] = useState({ loading: false, doc: null });
  useEffect(() => {
    if (!open || !eventId) { setState({ loading: false, doc: null }); return undefined; }
    let alive = true;
    setState({ loading: true, doc: null });
    IssuedDocumentService.activeForEvent(eventId, docType)
      .then((doc) => alive && setState({ loading: false, doc }))
      // ⚠️ ตรวจไม่สำเร็จ (server รุ่นเก่า/เน็ตหลุด) = ปล่อยให้ออกได้ — server กันซ้ำอีกชั้นตอนออกเลข
      .catch(() => alive && setState({ loading: false, doc: null }));
    return () => { alive = false; };
  }, [open, eventId, docType]);
  return { ...state, setDoc: (doc) => setState({ loading: false, doc }) };
}

/** หัวกล่อง — ไอคอน + ชื่อ + บรรทัดสถานะ (เลขที่/ร่าง) บรรทัดเดียว ไม่ตัดคำมั่วบนมือถือ */
export function DocDialogHeader({ icon, accent, title, subtitle, savedLabel, onClose, busy }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
      <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: accent, color: "#fff", "& svg": { fontSize: 21 } }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK, lineHeight: 1.3 }}>{title}</Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>
          {subtitle}
          {savedLabel && <Box component="span" sx={{ color: FAINT }}> · {savedLabel}</Box>}
        </Typography>
      </Box>
      <IconButton onClick={onClose} disabled={busy} aria-label="ปิด"><Close /></IconButton>
    </Stack>
  );
}

/** การ์ดหัวข้อมีลำดับ — action อยู่ขวาของหัวข้อเสมอ (ตำแหน่งปุ่มเดาได้ทุกก้อน) */
export function DocSection({ step, title, hint, action, children }) {
  return (
    <Box sx={{ p: { xs: 1.75, sm: 2.25 }, mb: 1.75, bgcolor: "#fff", borderRadius: 2.5, border: `1px solid ${LINE}` }}>
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1.75, minHeight: 30 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: ACCENT_SOFT, color: ACCENT, fontSize: "0.74rem", fontWeight: 900 }}>
          {step}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: INK, lineHeight: 1.3 }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.45 }}>{hint}</Typography>}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

/** หัวข้อย่อยในการ์ด (เช่น "กำหนดการรายวัน") + ตัวนับ + ปุ่มด้านขวา — ชื่อไม่ตัดบรรทัด */
export function SubHeader({ children, count, action }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2.5, mb: 1.25, minHeight: 32 }}>
      <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.86rem", color: INK }}>{children}</Typography>
      {count != null && (
        <Box component="span" sx={{ px: 0.9, py: 0.1, borderRadius: 999, bgcolor: SURFACE, border: `1px solid ${LINE}`, fontSize: "0.72rem", fontWeight: 800, color: INK_2, whiteSpace: "nowrap" }}>{count}</Box>
      )}
      <Box sx={{ flex: 1 }} />
      {action}
    </Stack>
  );
}

export const SMALL_BTN_SX = { textTransform: "none", fontWeight: 700, color: INK_2, borderRadius: 2, px: 1.25, minWidth: 0, whiteSpace: "nowrap" };
export const OUTLINE_BTN_SX = { ...SMALL_BTN_SX, border: `1px solid ${LINE}`, bgcolor: "#fff", "&:hover": { bgcolor: SURFACE } };

/** ป้าย "กู้คืนร่างแล้ว" + ปุ่มเริ่มใหม่จากข้อมูลงาน */
export function DraftBanner({ when, onDiscard }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.75, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderLeft: `4px solid ${ACCENT}` }}>
      <History sx={{ fontSize: 20, color: ACCENT }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK }}>กู้คืนข้อความที่พิมพ์ค้างไว้แล้ว</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>บันทึกล่าสุด {when} · ร่างเก็บไว้ในเครื่องนี้ {DRAFT_TTL_DAYS} วัน</Typography>
      </Box>
      <Button size="small" onClick={onDiscard} sx={{ ...OUTLINE_BTN_SX, flexShrink: 0 }}>เริ่มใหม่</Button>
    </Stack>
  );
}

const ISSUED_STATUS = { issued: "ออกแล้ว", sent: "ส่งให้ลูกค้าแล้ว", acknowledged: "ลูกค้ารับแล้ว" };

/**
 * ✅ งานนี้ออกใบนี้ไปแล้ว — แสดงสรุปใบเดิมแทนฟอร์ม (ผู้ใช้: "ถ้างานนี้มีการออกใบไปแล้วไม่ให้ออกซ้ำ"
 *    · "ให้มีลิงก์ไปหน้าเอกสารที่ออกด้วย") — ไม่โชว์ฟอร์มจางๆ ทั้งก้อนที่อ่านยากและแก้ไม่ได้
 */
export function IssuedSummary({ doc, label, onView, viewing, onNavigate }) {
  const rows = [
    ["เลขที่", doc.docNumber],
    ["วันที่ออก", fmtThaiDate(doc.issuedAt)],
    ["ผู้ออก", doc.issuedByName],
    ["โครงการ", doc.site],
    ["เรื่อง", doc.subject],
  ].filter(([, v]) => v);
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#dcfce7", color: "#16a34a" }}>
          <TaskAlt sx={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK, lineHeight: 1.3 }}>งานนี้ออก{label}แล้ว</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 700 }}>{ISSUED_STATUS[doc.status] || "ออกแล้ว"}</Typography>
        </Box>
      </Stack>
      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}>
        {rows.map(([k, v]) => (
          <Stack key={k} direction="row" spacing={1.5} sx={{ py: 0.75 }}>
            <Typography sx={{ width: 76, flexShrink: 0, fontSize: "0.82rem", color: MUTED }}>{k}</Typography>
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.88rem", fontWeight: 700, color: INK, wordBreak: "break-word" }}>{v}</Typography>
          </Stack>
        ))}
      </Box>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mx: { xs: 2, sm: 2.5 }, mb: 2, p: 1.25, borderRadius: 2, bgcolor: SURFACE }}>
        <InfoOutlined sx={{ fontSize: 17, color: MUTED, mt: 0.15 }} />
        <Typography sx={{ fontSize: "0.78rem", color: INK_2, lineHeight: 1.55 }}>
          หนึ่งงานออก{label}ได้ใบเดียว — ถ้าต้องออกใหม่ ให้เปลี่ยนสถานะใบเดิมเป็น "ยกเลิก" ในทะเบียนเอกสารก่อน
        </Typography>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.25 }}>
        <Button variant="contained" onClick={onView} disabled={viewing}
          startIcon={viewing ? <CircularProgress size={15} color="inherit" /> : <Visibility sx={{ fontSize: 18 }} />}
          sx={{ ...PRIMARY_BTN_SX, py: 1, flex: { sm: 1 } }}>
          ดูเอกสาร · พิมพ์ · ส่งอีเมล
        </Button>
        <Button component={RouterLink} to={`/documents?tab=issued&q=${encodeURIComponent(doc.docNumber || "")}`} onClick={onNavigate}
          endIcon={<OpenInNew sx={{ fontSize: 17 }} />}
          sx={{ ...OUTLINE_BTN_SX, py: 1, flex: { sm: 1 }, justifyContent: "center" }}>
          เปิดในทะเบียนเอกสาร
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * ✅ ตัวอย่างช่องลงนามคร่าวๆ (ผู้ใช้สั่ง 3 ต.ค. 2569: "ชื่อ เบอร์โทร ตำแหน่ง และลายเซ็นอิเล็กทรอนิกส์
 *    ให้แสดง preview คร่าวๆ จะได้รู้ว่าเป็นแบบไหน") — จัดวางแบบเดียวกับท้ายเอกสารจริง (กึ่งกลาง)
 */
export function SignerPreview({ name, position, tel, company, signatureImage, closing = "ขอแสดงความนับถือ" }) {
  return (
    <Box sx={{ border: `1px dashed ${LINE}`, borderRadius: 2, bgcolor: SURFACE, p: 1.5 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT, mb: 1 }}>ตัวอย่างช่องลงนามในเอกสาร</Typography>
      <Box sx={{ mx: "auto", maxWidth: 300, px: 2, py: 1.5, bgcolor: "#fff", borderRadius: 1.5, boxShadow: "0 1px 3px rgba(15,23,42,.08)", textAlign: "center", fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
        <Typography sx={{ fontSize: "0.8rem", color: INK_2 }}>{closing}</Typography>
        <Box sx={{ height: 46, display: "flex", alignItems: "flex-end", justifyContent: "center", mt: 0.5 }}>
          {signatureImage
            ? <Box component="img" src={signatureImage} alt="ลายเซ็น" sx={{ maxHeight: 44, maxWidth: 160, objectFit: "contain" }} />
            : <Typography sx={{ fontSize: "0.68rem", color: FAINT, pb: 0.25 }}>(เว้นช่องให้เซ็นด้วยมือ)</Typography>}
        </Box>
        <Box sx={{ borderTop: `1px dotted ${FAINT}`, mx: 3, mb: 0.75 }} />
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: name ? INK : FAINT }}>( {name || "ชื่อผู้ลงนาม"} )</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: position ? INK_2 : FAINT }}>{position || "ตำแหน่ง"}</Typography>
        <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{[company, tel && `โทร. ${tel}`].filter(Boolean).join(" · ")}</Typography>
      </Box>
    </Box>
  );
}
