/**
 * AttendanceList — รายการบันทึกเข้างาน (10 ต.ค. 2569)
 * ใช้ทั้งในการ์ดงาน (ของงานนี้) และหน้า "บันทึกเข้างาน" (showJob = แสดงชื่องานด้วย)
 * 🧹 11 ต.ค. 2569 ตัดเช็คเอาต์ออก + เปลี่ยนคำ "เช็คอิน" → "เข้างาน" ทุกหน้า (ผู้ใช้สั่ง)
 *
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าบันทึกเข้างานปรับจุดวางให้ดูง่ายขึ้น ไม่ซ้ำซ้อน ใช้งานง่าย ทุกขนาดหน้าจอ"
 *     + "การใช้น้ำหนักคำ และสีต่างๆ ให้มืออาชีพ")
 *    • แถวพับ 3 บรรทัด: ชื่อ + เวลา (ขวา) · งาน · บทบาท/ลูกทีม + เฉพาะเรื่องที่ต้องสนใจ (ตำแหน่งผิดปกติ/นอกวันนัด/แก้เวลา)
 *      ตัดแถบตำแหน่งแยก + ป้ายพื้นสี + ข้อความ "บันทึกพิกัดแล้ว" ที่ไม่ต้องสนใจออก
 *    • แถวกาง: เฉพาะข้อมูลที่ยังไม่เห็นในแถวพับ (ทีม · ตำแหน่ง+แผนที่ · หมายเหตุ · รูป) — ไม่ซ้ำเวลา/ชื่อหัวหน้าทีม
 *    • ตัวหนังสือ: หัวข้อ 600 · เนื้อหา 400–500 · สีเทาเป็นหลัก น้ำเงินเฉพาะสิ่งที่กดได้ ส้มเฉพาะเรื่องที่ต้องตรวจ
 */
import { createContext, useContext, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "@/shared/ui/swal";
import { Box, Stack, Typography, Button, ButtonBase, Avatar, Collapse, Dialog, IconButton, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ExpandMoreRounded as ExpandMore, EditCalendarRounded, ChevronRightRounded as ChevronRight, PlaceRounded, LocationOffRounded, OpenInNewRounded, EventBusyRounded, CloseRounded as Close, PhotoCameraRounded, WorkRounded, GroupsRounded, NotesRounded, FactCheckRounded } from "@mui/icons-material";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import AttendanceService from "@/shared/services/AttendanceService";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT } from "@/shared/ui/PageKit";
import {
  fmtDuration, fmtTime, fmtDayTime, locationBadge, resultOf, CORRECTION_STATUS, FIELD_LABEL, ON_SITE_M, fmtDistance,
} from "../attendanceMeta";
import CorrectionDialog from "./CorrectionDialog";
import { PersonChip } from "@/shared/ui/PersonChip";
import { CARD } from "@/shared/ui/modernUi";
import { thumbUrl } from "@/shared/utils/cloudinaryImage";
import AttachmentList from "@/shared/ui/AttachmentList";
import { useFileGallery } from "@/shared/ui/FileGalleryDialog";

const TONE = { ok: "#16a34a", warn: "#d97706", muted: "#94a3b8" };

/**
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "ให้แสดงรูปจริงของ user ด้วย") — หน้าที่มีรายชื่อพนักงาน (รูปโปรไฟล์) ส่ง Map userId → รูป ผ่าน context
 *    ไม่มีรูป / ไม่ได้ส่งมา / โหลดรูปไม่ได้ = ตัวอักษรย่อสีประจำคน (ขนาดเท่าเดิม ไม่ดันแถว)
 */
export const AttendanceAvatarContext = createContext(null);
const UserAvatar = ({ row, size = 28, fontSize = "0.76rem" }) => {
  const avatars = useContext(AttendanceAvatarContext);
  const src = avatars?.get(String(row.userId)) || undefined;
  return (
    <Avatar src={src} alt={row.userName || ""} imgProps={{ loading: "lazy", decoding: "async", referrerPolicy: "no-referrer" }}
      sx={{ width: size, height: size, fontSize, fontWeight: 800, flexShrink: 0, bgcolor: personColor(row.userName) }}>
      {personInitial(row.userName)}
    </Avatar>
  );
};

/** ปุ่มเล็กแบบเส้นขอบ — ในรายละเอียดของแต่ละรายการ */
const SMALL_BTN = {
  textTransform: "none", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, borderRadius: "10px",
  minHeight: 34, px: 1.5, boxShadow: "none",
};

/** แถว "ป้าย : ค่า" ในรายละเอียด — ป้ายคอลัมน์ซ้ายกว้างเท่ากันทุกแถว อ่านไล่ลงมาได้ */
const InfoRow = ({ label, children }) => (children ? (
  <Box sx={{ display: "grid", gridTemplateColumns: "84px 1fr", columnGap: 1.25, py: 0.9, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
    <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 500 }}>{label}</Typography>
    <Box sx={{ fontSize: "0.84rem", color: INK, minWidth: 0, whiteSpace: "pre-line", lineHeight: 1.55, wordBreak: "break-word" }}>{children}</Box>
  </Box>
) : null);

const isImg = (p) => /^image\//.test(p.fileType || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(p.fileName || "");

/**
 * 🔁 (11 พ.ย. 2569 ผู้ใช้: "รูปแบบการแสดงรูปภาพ ไฟล์ ให้ตรงกับที่ใช้ในระบบด้วย")
 *    ไฟล์/รูปในบันทึกเข้างานใช้โมดูลไฟล์กลาง (AttachmentList — แถวไฟล์ภาพย่อ · ป้าย · วันเวลา · แตะ = กล่องดูไฟล์เลื่อนดูได้)
 *    แบบเดียวกับไฟล์แนบในการ์ดงาน / ใบเบิก / ใบเสนอราคา
 */
const toAttach = (list, tag, at) => (list || []).map((p) => ({ ...p, _id: p.fileId, tag, uploadedAt: at }));
const Files = ({ photos, onPreview, tag = "ตอนเข้างาน", at }) => (photos?.length ? (
  <AttachmentList files={toAttach(photos, tag, at)} readOnly emptyText={null} thumbSize={44}
    onOpen={onPreview ? (f, i, list) => onPreview(f.fileUrl, f.fileName, list, i) : undefined} />
) : null);

/**
 * ✅ (15 ต.ค. 2569 ผู้ใช้: "ตำแหน่งพิกัด ทำให้ชัดเจน สวยงามกว่านี้ บางทีผู้ใช้ไม่รู้และดูไม่ออก")
 * กล่องตำแหน่งเต็มความกว้าง: ไอคอนสีตามผล + หัวข้อเป็นภาษาคน (อยู่ที่หน้างาน / ห่างหน้างาน X / …)
 * + คำอธิบายว่าหมายความว่าอะไร + แผนที่เห็นหมุดจริง + ปุ่มเปิดใน Google Maps
 */
/** สรุปตำแหน่งเป็นภาษาคน — ใช้ทั้งแถวในการ์ดงานและหน้ารายละเอียด */
const locInfo = (stamp) => {
  const ok = stamp.gps === "ok" && Number.isFinite(stamp.lat) && Number.isFinite(stamp.lng);
  // 🔁 (21 ต.ค. 2569 ผู้ใช้: "ใช้คำให้เข้าใจง่าย") ±X ม. → คำอธิบาย
  const acc = stamp.accuracy != null ? ` · คลาดเคลื่อนได้ราว ${Math.round(stamp.accuracy)} ม.` : "";
  let tone; let text; let hint = "";
  if (stamp.gps === "denied") { tone = TONE.warn; text = "ไม่มีตำแหน่ง (ไม่ได้อนุญาต GPS)"; }
  else if (!ok) { tone = TONE.warn; text = "ไม่มีตำแหน่ง (หา GPS ไม่เจอ)"; }
  else if (stamp.distanceM == null) { tone = "#dc2626"; text = `บันทึกตำแหน่งแล้ว (ยังไม่รู้ว่าที่หน้างานหรือไม่)${acc}`; hint = "หน้างานนี้ยังไม่มีพิกัดในทะเบียนลูกค้า จึงเทียบไม่ได้ — ตรวจตำแหน่งที่บันทึกจากแผนที่"; }
  else if (stamp.distanceM <= ON_SITE_M) { tone = TONE.ok; text = `อยู่ที่หน้างาน · ห่าง ${fmtDistance(stamp.distanceM)}${acc}`; }
  else { tone = "#dc2626"; text = `ไม่ได้อยู่ที่หน้างาน · ห่าง ${fmtDistance(stamp.distanceM)}${acc}`; }
  return { ok, tone, text, hint, Icon: ok ? PlaceRounded : LocationOffRounded };
};

const LocationCard = ({ stamp }) => {
  // 🔁 (15 ต.ค. 2569 ผู้ใช้: "ยังดูรกๆ ตาลาย") — บรรทัดเดียว: ไอคอนสี + สรุปภาษาคน · แผนที่ซ่อนไว้ กด "ดูแผนที่" ค่อยโชว์
  const [mapOpen, setMapOpen] = useState(false);
  if (!stamp) return null;
  const { ok, tone, text, hint, Icon } = locInfo(stamp);
  return (
    <InfoRow label="ตำแหน่ง">
      <Stack direction="row" gap={0.6} alignItems="flex-start">
        <Icon sx={{ fontSize: 17, color: tone, mt: "2px", flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Box component="span" sx={{ color: tone, fontWeight: 600 }}>{text}</Box>
          {hint && <Box sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>{hint}</Box>}
          {ok && (
            <Stack direction="row" gap={1.5} sx={{ mt: 0.4 }}>
              <ButtonBase onClick={() => setMapOpen((v) => !v)} sx={{ fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700, color: ACCENT }}>
                {mapOpen ? "ซ่อนแผนที่" : "ดูแผนที่"}
              </ButtonBase>
              <ButtonBase component="a" href={`https://www.google.com/maps/search/?api=1&query=${stamp.lat},${stamp.lng}`} target="_blank" rel="noopener noreferrer"
                sx={{ gap: 0.3, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700, color: ACCENT }}>
                เปิด Google Maps <OpenInNewRounded sx={{ fontSize: 14 }} />
              </ButtonBase>
            </Stack>
          )}
        </Box>
      </Stack>
      {ok && mapOpen && (
        <Box component="iframe" title="แผนที่ตำแหน่งที่บันทึก" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${stamp.lat},${stamp.lng}&z=16&output=embed`}
          sx={{ display: "block", width: "100%", height: 170, border: `1px solid ${LINE}`, borderRadius: "10px", mt: 0.75 }} />
      )}
    </InfoRow>
  );
};

/**
 * 🔁 (11 พ.ย. 2569) บทบาทของผู้บันทึก — ทุกคนบันทึกเข้างานของตัวเอง (ไม่มีการ "กดแทน")
 *    เดิมลูกทีมขึ้น "กดแทนหัวหน้าทีม X" ทำให้เข้าใจผิดว่าหัวหน้าทีมไม่ได้มา
 */
const roleOf = (row) => {
  const head = row.team?.head || "";
  const name = String(row.userName || "");
  if (head && name.startsWith(head)) return "หัวหน้าทีม";
  if ((row.team?.members || []).some((n) => n && name.startsWith(n))) return head ? `ลูกทีม · หัวหน้าทีม ${head}` : "ลูกทีม";
  return head ? `ผู้ปฏิบัติงาน · หัวหน้าทีม ${head}` : "ผู้ปฏิบัติงาน";
};

/** ป้ายสถานะเล็ก: ไอคอน + ข้อความ บนพื้นสีอ่อนของโทนนั้น */
const Tag = ({ tone, icon, children }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.85, borderRadius: 99,
    fontSize: "0.7rem", fontWeight: 700, color: tone, bgcolor: alpha(tone, 0.09), whiteSpace: "nowrap", "& svg": { fontSize: 13 } }}>
    {icon}{children}
  </Box>
);
/** ตำแหน่งแบบสั้นสำหรับป้าย */
const shortLoc = (stamp, b) => {
  if (!stamp || stamp.gps === "denied") return "ไม่อนุญาตตำแหน่ง";
  if (stamp.gps !== "ok") return "ไม่มีพิกัด";
  if (stamp.distanceM == null) return "บันทึกพิกัดแล้ว";
  return b.tone === "ok" ? `อยู่หน้างาน ${fmtDistance(stamp.distanceM)}` : `ห่างหน้างาน ${fmtDistance(stamp.distanceM)}`;
};


/** อนุมัติ/ไม่อนุมัติคำขอแก้เวลา — ใช้ทั้งแถวและหน้ารายละเอียด */
function useDecide(row, onChanged, embedded) {
  const [busy, setBusy] = useState(false);
  const decide = async (c, approve) => {
    let note = "";
    // ⚠️ ในฟอร์ม SweetAlert (embedded) ห้ามเรียก Swal ซ้อน — ใช้กล่องถามของเบราว์เซอร์แทน
    if (!approve && embedded) {
      const v = window.prompt("เหตุผลที่ไม่อนุมัติคำขอแก้เวลา");
      if (!v?.trim()) return;
      note = v.trim();
    } else if (!approve) {
      const r = await Swal.fire({
        title: "ไม่อนุมัติคำขอแก้เวลา", input: "text", inputLabel: "เหตุผล", inputPlaceholder: "แจ้งให้ช่างทราบ",
        showCancelButton: true, confirmButtonText: "ไม่อนุมัติ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#dc2626",
        inputValidator: (v) => (!v?.trim() ? "กรุณาระบุเหตุผล" : undefined),
      });
      if (!r.isConfirmed) return;
      note = r.value.trim();
    }
    setBusy(true);
    try {
      const data = await AttendanceService.decideCorrection(row._id, c._id, { decision: approve ? "approve" : "reject", note });
      onChanged?.(data.attendance);
    } catch (e) {
      const msg = e?.response?.data?.message || "ลองใหม่อีกครั้ง";
      if (embedded) window.alert(`บันทึกไม่สำเร็จ — ${msg}`);
      else Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: msg });
    } finally {
      setBusy(false);
    }
  };
  return { busy, decide };
}

/** ประวัติการแก้เวลา + ปุ่มอนุมัติ (หัวหน้า) */
const CorrectionHistory = ({ history, isApprover, busy, decide, large = false }) => (
  <Stack spacing={1.25}>
    {history.map((c) => {
      const st = CORRECTION_STATUS[c.status] || CORRECTION_STATUS.pending;
      return (
        <Box key={c._id}>
          <Typography sx={{ fontSize: large ? "0.92rem" : "0.84rem", fontWeight: 600, color: INK }}>
            {FIELD_LABEL[c.field]} {fmtTime(c.fromAt)} → {fmtTime(c.toAt)}
            <Box component="span" sx={{ ml: 0.75, fontSize: large ? "0.8rem" : "0.74rem", fontWeight: 600, color: st.color }}>{st.label}</Box>
          </Typography>
          <Typography sx={{ fontSize: large ? "0.82rem" : "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.5 }}>
            เหตุผล: {c.reason} · ขอโดย {c.requestedBy} {fmtDayTime(c.requestedAt)}
            {c.decidedBy ? ` · ${c.status === "approved" ? "อนุมัติ" : "ตัดสิน"}โดย ${c.decidedBy}` : ""}
            {c.decisionNote ? ` (${c.decisionNote})` : ""}
          </Typography>
          {c.status === "pending" && isApprover && (
            <Stack direction="row" gap={1} sx={{ mt: 1 }}>
              <Button variant="contained" disableElevation disabled={busy} onClick={() => decide(c, true)}
                sx={{ ...SMALL_BTN, flex: 1, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>อนุมัติ</Button>
              <Button variant="outlined" disabled={busy} onClick={() => decide(c, false)}
                sx={{ ...SMALL_BTN, flex: 1, color: "#dc2626", borderColor: "#fca5a5", "&:hover": { borderColor: "#dc2626", bgcolor: "#fef2f2" } }}>ไม่อนุมัติ</Button>
            </Stack>
          )}
        </Box>
      );
    })}
  </Stack>
);

function Row({ row, me, isApprover, showJob, onPreview, onChanged, embedded, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [fixOpen, setFixOpen] = useState(false);
  const { busy, decide } = useDecide(row, onChanged, embedded);
  const legacyOut = Boolean(row.checkOut?.at); // รายการเก่าที่เคยเช็คเอาต์ไว้ (ก่อนตัดระบบ)

  const mine = String(row.userId) === String(me);
  const result = resultOf(row.checkOut?.result);
  const pending = (row.corrections || []).filter((c) => c.status === "pending");
  const history = (row.corrections || []).slice().reverse();
  const fixed = history.some((c) => c.status === "approved");
  const inLoc = locationBadge(row.checkIn);
  // หัวหน้าทีมเป็นคนกดเข้างานเอง? (ชื่อหัวหน้าทีมเก็บเป็นชื่อต้น · ชื่อผู้กดเป็นชื่อเต็ม)
  const isHeadRow = Boolean(row.team?.head) && String(row.userName || "").startsWith(row.team.head);
  const teamMembers = (row.team?.members || []).filter(Boolean);

  const role = roleOf(row);
  // สีตามผลตำแหน่ง — ใช้ทั้งแถบซ้ายการ์ดและป้ายตำแหน่ง
  const locTone = inLoc?.tone === "ok" ? TONE.ok : inLoc?.tone === "warn" ? TONE.warn : "#dc2626"; // (15 ต.ค. 2569 ผู้ใช้) บันทึกพิกัดแล้วแต่ยืนยันหน้างานไม่ได้ = แดง
  const crew = teamMembers.length ? `ลูกทีม ${teamMembers.length} คน` : "ไม่มีลูกทีม";

  return (
    <Box sx={{ ...CARD, borderRadius: "14px", overflow: "hidden" }}>
      {/* 🔁 (15 ต.ค. 2569 ผู้ใช้: "รกไป ตาลาย" → "เรียบไป ให้มีสีสันด้วย") — สีสื่อความหมาย ไม่ตกแต่งเปล่าๆ:
          แถบสีซ้ายการ์ด + ป้ายตำแหน่ง = ผลตำแหน่ง (เขียว อยู่หน้างาน · ส้ม ผิดปกติ · ฟ้า มีพิกัด) · เวลาในกล่องฟ้า · รูปย่อสีประจำตัวคน */}
      <ButtonBase onClick={() => setOpen((p) => !p)} aria-expanded={open}
        sx={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 1.25, textAlign: "left", fontFamily: "inherit", px: 1.5, py: 1.25,
          boxShadow: `inset 4px 0 0 ${locTone}` }}>
        <Box sx={{ flexShrink: 0, px: 0.9, py: 0.4, borderRadius: "9px", bgcolor: alpha(ACCENT, 0.08), color: ACCENT,
          fontSize: "0.95rem", fontWeight: 800, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}>
          {fmtTime(row.checkIn?.at)}
          {/* ✅ (11 พ.ย. 2569) บอกวันที่ใต้เวลา — คนเดียวกันหลายวันในงานเดียวกันจะได้แยกออก */}
          {row.checkIn?.at && (
            <Box component="span" sx={{ display: "block", fontSize: "0.66rem", fontWeight: 600, color: MUTED, textAlign: "center", lineHeight: 1.3 }}>
              {new Date(row.checkIn.at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" })}
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* ✅ (15 ต.ค. 2569 ผู้ใช้: "เลื่อนชื่อผู้บันทึกมาไว้บนสุด และชัดเจน") — ชื่อผู้บันทึก (ตัวหนา + รูปย่อ) → บทบาท → งาน */}
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
            <UserAvatar row={row} size={26} fontSize="0.74rem" />
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>{row.userName || "-"}</Typography>
              <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3 }}>
                {[isHeadRow ? "หัวหน้าทีม" : role, teamMembers.length ? crew : ""].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </Stack>
          {/* ✅ (15 ต.ค. 2569 ผู้ใช้: "ให้แสดงรายละเอียดงานด้วย · ยังเหยงไม่สวย") — กล่องงานพื้นเทาอ่อน:
              ประเภท · ระบบ (หนา) / โครงการ · บริษัท / เลข Job / รายละเอียด 2 บรรทัด — ข้อมูลจาก server (row.job) */}
          {showJob && (
            <Box sx={{ mt: 0.85, px: 1.1, py: 0.85, borderRadius: "10px", bgcolor: SURFACE, border: `1px solid ${LINE}` }}>
              <Stack direction="row" alignItems="flex-start" gap={1}>
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 700, color: INK, lineHeight: 1.4 }}>
                  {row.job ? [row.job.title, row.job.system].filter(Boolean).join(" · ") || "งาน" : (row.jobLabel || "งาน").split(" · ")[0]}
                </Typography>
                {row.jobNo && <Typography sx={{ flexShrink: 0, fontSize: "0.7rem", fontWeight: 700, color: FAINT, lineHeight: 1.6, whiteSpace: "nowrap" }}>{row.jobNo}</Typography>}
              </Stack>
              <Typography noWrap sx={{ fontSize: "0.76rem", color: INK_2, mt: 0.15 }}>
                {row.job ? [row.job.site, row.job.company && row.job.company !== row.job.site ? row.job.company : ""].filter(Boolean).join(" · ") || "-" : (row.jobLabel || "").split(" · ").slice(1).join(" · ")}
              </Typography>
              {row.job?.description && (
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.35, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
                  {row.job.description}
                </Typography>
              )}
            </Box>
          )}
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.65 }}>
            <VerdictTag row={row} />
            {inLoc && <Tag tone={locTone} icon={row.checkIn?.gps === "ok" ? <PlaceRounded /> : <LocationOffRounded />}>{shortLoc(row.checkIn, inLoc)}</Tag>}
            {row.offSchedule && <Tag tone="#ea580c" icon={<EventBusyRounded />}>นอกวันนัด</Tag>}
            {pending.length > 0 && <Tag tone={TONE.warn} icon={<EditCalendarRounded />}>ขอแก้เวลา · รออนุมัติ</Tag>}
            {fixed && <Tag tone={MUTED} icon={<EditCalendarRounded />}>แก้เวลาแล้ว</Tag>}
          </Stack>
        </Box>
        <ExpandMore sx={{ fontSize: 20, color: FAINT, flexShrink: 0, mt: 0.2, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
      </ButtonBase>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Box sx={{ borderTop: `1px solid ${LINE}`, pt: 0.25 }}>
            {(teamMembers.length > 0 || !isHeadRow) && (
              <InfoRow label="ทีม">
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {row.team?.head && <PersonChip name={row.team.head} badge="หัวหน้าทีม" title="หัวหน้าทีมเข้างาน" />}
                  {teamMembers.map((n) => <PersonChip key={n} name={n} title={`ลูกทีม: ${n}`} />)}
                </Stack>
              </InfoRow>
            )}
            <LocationCard stamp={row.checkIn} />
            <InfoRow label="หมายเหตุ">{row.checkIn?.note}</InfoRow>
            <InfoRow label="รูปหน้างาน">{row.checkIn?.photos?.length ? <Files photos={row.checkIn.photos} onPreview={onPreview} at={row.checkIn?.at} /> : null}</InfoRow>
            {/* ข้อมูลเช็คเอาต์ของรายการเก่า (ก่อนตัดระบบ 11 ต.ค. 2569) — แสดงเฉพาะที่มี */}
            {legacyOut && <InfoRow label="ออก (เดิม)">{`${fmtTime(row.checkOut.at)} · ${fmtDuration(row.durationMin)}${result ? ` · ${result.label}` : ""}`}</InfoRow>}
            <InfoRow label="สรุปผลงาน">{row.checkOut?.summary}</InfoRow>
            <InfoRow label="ปัญหาที่พบ">{row.checkOut?.issues}</InfoRow>
            <InfoRow label="อะไหล่">{row.checkOut?.partsNeeded}</InfoRow>
            <InfoRow label="ไฟล์แนบ">{row.checkOut?.photos?.length ? <Files photos={row.checkOut.photos} onPreview={onPreview} tag="ตอนออกงาน" at={row.checkOut?.at} /> : null}</InfoRow>
            <InfoRow label="Service Report">{row.checkOut?.reports?.length ? <Files photos={row.checkOut.reports} onPreview={onPreview} tag="Service Report" at={row.checkOut?.at} /> : null}</InfoRow>
          </Box>

          {history.length > 0 && (
            <Box sx={{ mt: 1, p: 1.25, borderRadius: "12px", bgcolor: SURFACE }}>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED, mb: 0.75 }}>ประวัติการแก้เวลา</Typography>
              <CorrectionHistory history={history} isApprover={isApprover} busy={busy} decide={decide} />
            </Box>
          )}

          {(showJob || mine || isApprover) && (
            <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
              {(mine || isApprover) && (
                <Button variant="outlined" startIcon={<EditCalendarRounded sx={{ fontSize: "18px !important" }} />} onClick={() => setFixOpen(true)}
                  sx={{ ...SMALL_BTN, color: INK_2, borderColor: LINE }}>
                  {isApprover ? "แก้เวลา" : "ขอแก้เวลา"}
                </Button>
              )}
              {showJob && (
                <Button component={Link} to={`/operation/${row.eventId}`} variant="outlined" endIcon={<ChevronRight />}
                  sx={{ ...SMALL_BTN, color: ACCENT, borderColor: "#bfdbfe" }}>เปิดงาน</Button>
              )}
            </Stack>
          )}
        </Box>
      </Collapse>
      <CorrectionDialog open={fixOpen} row={row} isApprover={isApprover} onClose={() => setFixOpen(false)}
        onDone={(r) => { setFixOpen(false); onChanged?.(r); }} />
    </Box>
  );
}

/**
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "การ์ดหน้าจอคอมยังดูเล็กไป ให้ขยาย ทำให้ชัดเจน · จัดวางรูปแบบใหม่ให้สวยงาม")
 *    หน้ารายละเอียดบันทึกเข้างาน (กล่องจากตาราง) — หัวใหญ่: ชื่อ + เวลา + วันที่ · จอกว้าง 2 คอลัมน์:
 *    ซ้าย = งาน · ทีม · ตำแหน่ง (แผนที่เปิดไว้เลย) · หมายเหตุ  |  ขวา = รูปหน้างานภาพใหญ่ · ประวัติแก้เวลา
 */
/**
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "การเช็คเงื่อนไข การแสดงผลความถูกต้องการบันทึก ตำแหน่ง หรืออะไรที่เกี่ยวข้องให้ชัดเจน")
 *    ตรวจบันทึกเข้างานทีละข้อ: เวลา · GPS · ระยะจากหน้างาน · ความแม่นยำ · วันนัด · รูปหน้างาน · ผู้บันทึก
 *    ok = ผ่าน · warn = ควรตรวจ · bad = ไม่ผ่าน
 */
export function attendanceChecks(row) {
  const st = row.checkIn || {};
  const gpsOk = st.gps === "ok" && Number.isFinite(st.lat) && Number.isFinite(st.lng);
  const pending = (row.corrections || []).some((c) => c.status === "pending");
  const fixed = (row.corrections || []).some((c) => c.status === "approved");
  const photos = (st.photos || []).length;
  const out = [];
  out.push({ key: "time", label: "เวลา", level: pending ? "warn" : "ok",
    text: pending ? "มีคำขอแก้เวลา รออนุมัติ" : fixed ? "บันทึกจากเซิร์ฟเวอร์ · แก้เวลาแล้ว (อนุมัติ)" : "บันทึกจากเซิร์ฟเวอร์ (แก้จากเครื่องไม่ได้)" });
  out.push({ key: "gps", label: "พิกัด GPS", level: gpsOk ? "ok" : "bad",
    text: gpsOk ? "มีพิกัดจริงจากเครื่อง" : st.gps === "denied" ? "ไม่ได้อนุญาตตำแหน่ง" : "หาตำแหน่งไม่ได้" });
  if (gpsOk) {
    if (st.distanceM == null) out.push({ key: "dist", label: "ระยะจากหน้างาน", level: "warn", text: "เทียบไม่ได้ — หน้างานยังไม่มีพิกัดในทะเบียนลูกค้า" });
    else out.push({ key: "dist", label: "ระยะจากหน้างาน", level: st.distanceM <= ON_SITE_M ? "ok" : "bad",
      text: st.distanceM <= ON_SITE_M ? `อยู่ที่หน้างาน (ห่าง ${fmtDistance(st.distanceM)} · เกณฑ์ไม่เกิน ${ON_SITE_M} ม.)` : `ห่างหน้างาน ${fmtDistance(st.distanceM)} (เกินเกณฑ์ ${ON_SITE_M} ม.)` });
    if (st.accuracy != null) {
      const a = Math.round(st.accuracy);
      out.push({ key: "acc", label: "ความแม่นยำ GPS", level: a <= 50 ? "ok" : a <= 150 ? "warn" : "bad",
        text: `คลาดเคลื่อนได้ราว ${a} ม.${a <= 50 ? " (แม่นยำดี)" : a <= 150 ? " (พอใช้)" : " (ไม่แม่น)"}` });
    }
  }
  out.push({ key: "day", label: "วันที่", level: row.offSchedule ? "warn" : "ok", text: row.offSchedule ? "นอกวันที่ลงตารางไว้" : "ตรงวันที่ลงตาราง" });
  out.push({ key: "photo", label: "รูปหน้างาน", level: photos ? "ok" : "bad", text: photos ? `${photos} รูป` : "ไม่มีรูป" });
  const isHead = Boolean(row.team?.head) && String(row.userName || "").startsWith(row.team.head);
  const isMember = (row.team?.members || []).some((n) => n && String(row.userName || "").startsWith(n));
  out.push({ key: "who", label: "ผู้บันทึก", level: isHead || isMember || !row.team?.head ? "ok" : "warn",
    text: isHead ? "หัวหน้าทีมของงานนี้" : isMember ? "ลูกทีมของงานนี้" : row.team?.head ? `ไม่พบชื่อในทีมตอนบันทึก (หัวหน้าทีม ${row.team.head})` : "ผู้ปฏิบัติงานของงานนี้" });
  return out;
}
const LEVEL = {
  ok: { color: "#16a34a", bg: "#f0fdf4", icon: "✓" },
  warn: { color: "#d97706", bg: "#fffbeb", icon: "!" },
  bad: { color: "#dc2626", bg: "#fef2f2", icon: "✕" },
};
export const checkVerdict = (checks) => {
  const bad = checks.filter((c) => c.level === "bad").length;
  const warn = checks.filter((c) => c.level === "warn").length;
  if (bad) return { level: "bad", text: `ไม่ผ่าน ${bad} ข้อ${warn ? ` · ควรตรวจ ${warn}` : ""}` };
  if (warn) return { level: "warn", text: `ควรตรวจ ${warn} ข้อ` };
  return { level: "ok", text: "ถูกต้องครบทุกข้อ" };
};
/** ป้ายผลตรวจรวมของบันทึก (แสดงในแถว) — ถูกต้อง / ควรตรวจ / ไม่ผ่าน */
const VerdictTag = ({ row }) => {
  const v = checkVerdict(attendanceChecks(row));
  const L = LEVEL[v.level];
  return (
    <Box component="span" title="ผลตรวจความถูกต้อง — เปิดรายละเอียดเพื่อดูทีละข้อ" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.85, borderRadius: 99,
      fontSize: "0.7rem", fontWeight: 800, color: L.color, bgcolor: L.bg, border: `1px solid ${alpha(L.color, 0.28)}`, whiteSpace: "nowrap" }}>
      {L.icon} {v.level === "ok" ? "ถูกต้อง" : v.text}
    </Box>
  );
};
const CheckList = ({ checks }) => (
  <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
    {checks.map((c) => {
      const L = LEVEL[c.level];
      return (
        <Stack key={c.key} direction="row" alignItems="flex-start" gap={1} sx={{ py: 0.8 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, mt: "1px", display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: L.bg, color: L.color, fontSize: "0.72rem", fontWeight: 900, border: `1px solid ${alpha(L.color, 0.35)}` }}>{L.icon}</Box>
          <Typography sx={{ width: 104, flexShrink: 0, fontSize: "0.82rem", color: MUTED, lineHeight: 1.5 }}>{c.label}</Typography>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: c.level === "ok" ? 500 : 700, color: c.level === "ok" ? INK : L.color, lineHeight: 1.5 }}>{c.text}</Typography>
        </Stack>
      );
    })}
  </Stack>
);

const Section = ({ title, icon, children, right }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: "14px", p: { xs: 1.5, md: 1.75 } }}>
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
      {icon && <Box sx={{ width: 26, height: 26, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(ACCENT, 0.08), color: ACCENT, "& svg": { fontSize: 16 } }}>{icon}</Box>}
      <Typography sx={{ flex: 1, fontSize: "0.86rem", fontWeight: 800, color: INK }}>{title}</Typography>
      {right}
    </Stack>
    {children}
  </Box>
);

function AttendanceDetail({ row, me, isApprover, onPreview, onChanged }) {
  const [fixOpen, setFixOpen] = useState(false);
  const { busy, decide } = useDecide(row, onChanged, false);
  const mine = String(row.userId) === String(me);
  const pending = (row.corrections || []).filter((c) => c.status === "pending");
  const history = (row.corrections || []).slice().reverse();
  const fixed = history.some((c) => c.status === "approved");
  const teamMembers = (row.team?.members || []).filter(Boolean);
  const role = roleOf(row);
  const loc = row.checkIn ? locInfo(row.checkIn) : null;
  const photos = row.checkIn?.photos || [];
  const imgs = photos.filter(isImg);
  const docs = photos.filter((p) => !isImg(p));
  const gal = useFileGallery();
  const galleryList = photos.map((p) => ({ ...p, _id: p.fileId }));
  const openFile = (p) => {
    const i = photos.findIndex((x) => x.fileId === p.fileId);
    if (onPreview) onPreview(p.fileUrl, p.fileName, galleryList, i);
    else gal.open(p.fileUrl, p.fileName, galleryList, i);
  };
  const checks = attendanceChecks(row);
  const verdict = checkVerdict(checks);
  const V = LEVEL[verdict.level];
  const at = row.checkIn?.at ? new Date(row.checkIn.at) : null;
  const dateText = at ? at.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <Box>
      {/* หัว: ผู้บันทึก · บทบาท · เวลาใหญ่ */}
      <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: "14px", p: { xs: 1.5, md: 2 }, boxShadow: `inset 5px 0 0 ${loc?.tone || LINE}` }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <UserAvatar row={row} size={48} fontSize="1.1rem" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: "1.05rem", md: "1.2rem" }, fontWeight: 800, color: INK, lineHeight: 1.3 }}>{row.userName || "-"}</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.4 }}>
              {[role, teamMembers.length ? `ลูกทีม ${teamMembers.length} คน` : ""].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontSize: { xs: "1.5rem", md: "1.8rem" }, fontWeight: 800, color: ACCENT, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{fmtTime(row.checkIn?.at)}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>{dateText}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 24, px: 1, borderRadius: 99, fontSize: "0.76rem", fontWeight: 800, color: V.color, bgcolor: V.bg, border: `1px solid ${alpha(V.color, 0.3)}` }}>
            {V.icon} {verdict.text}
          </Box>
          {loc && <Tag tone={loc.tone} icon={row.checkIn?.gps === "ok" ? <PlaceRounded /> : <LocationOffRounded />}>{shortLoc(row.checkIn, locationBadge(row.checkIn) || {})}</Tag>}
          {row.offSchedule && <Tag tone="#ea580c" icon={<EventBusyRounded />}>นอกวันนัด</Tag>}
          {pending.length > 0 && <Tag tone={TONE.warn} icon={<EditCalendarRounded />}>ขอแก้เวลา · รออนุมัติ</Tag>}
          {fixed && <Tag tone={MUTED} icon={<EditCalendarRounded />}>แก้เวลาแล้ว</Tag>}
        </Stack>
      </Box>

      <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.15fr) minmax(0,0.85fr)" }, gap: 1.25, alignItems: "start" }}>
        <Stack gap={1.25}>
          <Section title="งาน" icon={<WorkRounded />} right={row.jobNo ? <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: FAINT }}>{row.jobNo}</Typography> : null}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, lineHeight: 1.4 }}>
              {row.job ? [row.job.title, row.job.system].filter(Boolean).join(" · ") || "งาน" : (row.jobLabel || "งาน").split(" · ")[0]}
            </Typography>
            <Typography sx={{ fontSize: "0.86rem", color: INK_2, mt: 0.25 }}>
              {row.job ? [row.job.site, row.job.company && row.job.company !== row.job.site ? row.job.company : ""].filter(Boolean).join(" · ") || "-" : (row.jobLabel || "").split(" · ").slice(1).join(" · ")}
            </Typography>
            {row.job?.description && (
              <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.75, lineHeight: 1.55, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{row.job.description}</Typography>
            )}
          </Section>

          {(row.team?.head || teamMembers.length > 0) && (
            <Section title="ทีม" icon={<GroupsRounded />}>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {row.team?.head && <PersonChip name={row.team.head} badge="หัวหน้าทีม" title="หัวหน้าทีมเข้างาน" />}
                {teamMembers.map((n) => <PersonChip key={n} name={n} title={`ลูกทีม: ${n}`} />)}
              </Stack>
            </Section>
          )}

          {loc && (
            <Section title="ตำแหน่งที่บันทึก" icon={<PlaceRounded />}
              right={loc.ok ? (
                <ButtonBase component="a" href={`https://www.google.com/maps/search/?api=1&query=${row.checkIn.lat},${row.checkIn.lng}`} target="_blank" rel="noopener noreferrer"
                  sx={{ gap: 0.3, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700, color: ACCENT }}>
                  เปิด Google Maps <OpenInNewRounded sx={{ fontSize: 14 }} />
                </ButtonBase>
              ) : null}>
              <Stack direction="row" gap={0.75} alignItems="flex-start">
                <loc.Icon sx={{ fontSize: 19, color: loc.tone, mt: "1px", flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: loc.tone, lineHeight: 1.45 }}>{loc.text}</Typography>
                  {loc.hint && <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5, mt: 0.25 }}>{loc.hint}</Typography>}
                </Box>
              </Stack>
              {loc.ok && (
                <Box component="iframe" title="แผนที่ตำแหน่งที่บันทึก" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${row.checkIn.lat},${row.checkIn.lng}&z=16&output=embed`}
                  sx={{ display: "block", width: "100%", height: { xs: 180, md: 230 }, border: `1px solid ${LINE}`, borderRadius: "12px", mt: 1.25 }} />
              )}
            </Section>
          )}

          {row.checkIn?.note && (
            <Section title="หมายเหตุ" icon={<NotesRounded />}>
              <Typography sx={{ fontSize: "0.9rem", color: INK, lineHeight: 1.6, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{row.checkIn.note}</Typography>
            </Section>
          )}
        </Stack>

        <Stack gap={1.25}>
          <Section title="ตรวจความถูกต้อง" icon={<FactCheckRounded />}
            right={<Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: V.color }}>{verdict.text}</Typography>}>
            <CheckList checks={checks} />
          </Section>
          <Section title={`รูปหน้างาน${photos.length ? ` (${photos.length})` : ""}`} icon={<PhotoCameraRounded />}>
            {imgs.length ? (
              <Box sx={{ display: "grid", gridTemplateColumns: imgs.length === 1 ? "1fr" : "1fr 1fr", gap: 1 }}>
                {imgs.map((p) => (
                  <Box key={p.fileId} component="img" src={thumbUrl(p.fileUrl, 640)} alt={p.fileName} loading="lazy" decoding="async" onClick={() => openFile(p)}
                    sx={{ width: "100%", aspectRatio: imgs.length === 1 ? "4 / 3" : "1 / 1", objectFit: "cover", borderRadius: "12px", border: `1px solid ${LINE}`, cursor: "zoom-in", bgcolor: SURFACE, "&:hover": { borderColor: ACCENT } }} />
                ))}
              </Box>
            ) : !docs.length && <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>ไม่มีรูป</Typography>}
            {docs.length > 0 && <Box sx={{ mt: imgs.length ? 1 : 0 }}><Files photos={docs} onPreview={onPreview} at={row.checkIn?.at} /></Box>}
            {imgs.length > 0 && (
              <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: MUTED }}>ถ่ายตอนเข้างาน {fmtDayTime(row.checkIn?.at)} · แตะรูปเพื่อดูเต็มจอ เลื่อนดูรูปอื่นได้</Typography>
            )}
          </Section>

          {history.length > 0 && (
            <Section title="ประวัติการแก้เวลา" icon={<EditCalendarRounded />}>
              <CorrectionHistory history={history} isApprover={isApprover} busy={busy} decide={decide} large />
            </Section>
          )}
        </Stack>
      </Box>

      {(mine || isApprover) || row.eventId ? (
        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
          {(mine || isApprover) && (
            <Button variant="outlined" startIcon={<EditCalendarRounded />} onClick={() => setFixOpen(true)}
              sx={{ ...SMALL_BTN, minHeight: 40, px: 2, fontSize: "0.86rem", color: INK_2, borderColor: LINE, bgcolor: "#fff" }}>
              {isApprover ? "แก้เวลา" : "ขอแก้เวลา"}
            </Button>
          )}
          {row.eventId && (
            <Button component={Link} to={`/operation/${row.eventId}`} variant="contained" disableElevation endIcon={<ChevronRight />}
              sx={{ ...SMALL_BTN, minHeight: 40, px: 2.25, fontSize: "0.86rem", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
              เปิดงาน
            </Button>
          )}
        </Stack>
      ) : null}
      <CorrectionDialog open={fixOpen} row={row} isApprover={isApprover} onClose={() => setFixOpen(false)}
        onDone={(r) => { setFixOpen(false); onChanged?.(r); }} />
      {gal.dialog}
    </Box>
  );
}

/** กล่องรายละเอียดการเข้างาน — เปิดจากตาราง หรือจากลิงก์แจ้งเตือน (/attendance?open=<id>) */
export function AttendanceDetailDialog({ row, onClose, me, isApprover, onPreview, onChanged }) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  return (
    <Dialog open={Boolean(row)} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: SURFACE } }}>
      <Stack direction="row" alignItems="center" sx={{ px: { xs: 2, md: 2.5 }, py: 1.25, bgcolor: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "1.1rem", color: INK }}>รายละเอียดการเข้างาน</Typography>
        <IconButton onClick={onClose} aria-label="ปิด"><Close /></IconButton>
      </Stack>
      <Box sx={{ p: { xs: 1.25, md: 2 }, overflowY: "auto" }}>
        {row && <AttendanceDetail key={row._id} row={row} me={me} isApprover={isApprover} onPreview={onPreview} onChanged={onChanged} />}
      </Box>
    </Dialog>
  );
}

/**
 * @param rows        รายการ Attendance
 * @param me          userId ผู้ใช้ปัจจุบัน
 * @param isApprover  อนุมัติ/แก้เวลาได้ (approveJobs)
 * @param showJob     แสดงชื่องาน (หน้ารวม) — จอกว้างเรียง 2 คอลัมน์
 */
export default function AttendanceList({ rows = [], me, isApprover, showJob = false, onPreview, onChanged, empty, embedded = false }) {
  if (!rows.length) return empty || null;
  return (
    // 🔁 (19 ต.ค. 2569 ผู้ใช้: "หน้าประวัติเข้างานดูขาดๆ ไม่สวย") — เดิม 2 คอลัมน์ วันที่มีรายการคี่เหลือช่องโหว่ครึ่งแถว
    //    → คอลัมน์เดียวเต็มความกว้างทุกจอ (ตารางสำหรับดูหลายรายการพร้อมกันอยู่ใน AttendanceTable)
    <Box sx={{ display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: "1fr" }}>
      {rows.map((r) => (
        <Row key={r._id} row={r} me={me} isApprover={isApprover} showJob={showJob} onPreview={onPreview} onChanged={onChanged} embedded={embedded} />
      ))}
    </Box>
  );
}

/**
 * มุมมองตาราง (หน้า "ประวัติเข้างาน") — ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้มีแสดงแบบตารางด้วย")
 * หนึ่งแถว = หนึ่งครั้งที่เข้างาน · กดแถว = เปิดรายละเอียดเต็ม (ตำแหน่ง/แผนที่ · รูป · ทีม · แก้เวลา) ทับหน้า
 */
export function AttendanceTable({ rows = [], me, isApprover, onPreview, onChanged }) {
  const [openId, setOpenId] = useState("");
  const gal = useFileGallery();
  const openRow = rows.find((r) => r._id === openId) || null;
  const th = { textAlign: "left", fontSize: "0.74rem", fontWeight: 800, color: MUTED, px: 1.25, py: 1.1, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", bgcolor: SURFACE };
  const td = { fontSize: "0.82rem", color: INK_2, px: 1.25, py: 1.15, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const sub = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 };
  const COLS = ["วันที่ · เวลา", "ผู้บันทึก", "ทีม", "งาน", "โครงการ / บริษัท", "ตำแหน่ง", "หมายเหตุ", "รูป", ""];
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflowX: "auto", boxShadow: "none" }}>
      <Box component="table" sx={{ width: "100%", minWidth: 1240, borderCollapse: "collapse" }}>
        <thead><tr>{COLS.map((h, i) => <Box component="th" key={i} sx={th}>{h}</Box>)}</tr></thead>
        <tbody>
          {rows.map((row) => {
            const inLoc = locationBadge(row.checkIn);
            const locTone = inLoc?.tone === "ok" ? TONE.ok : inLoc?.tone === "warn" ? TONE.warn : "#dc2626";
            const members = (row.team?.members || []).filter(Boolean);
            const pending = (row.corrections || []).some((c) => c.status === "pending");
            const fixed = (row.corrections || []).some((c) => c.status === "approved");
            const photos = row.checkIn?.photos || [];
            const job = row.job || {};
            return (
              <Box component="tr" key={row._id} onClick={() => setOpenId(row._id)}
                sx={{ cursor: "pointer", "&:hover": { bgcolor: SURFACE }, "&:last-child td": { borderBottom: 0 }, boxShadow: `inset 3px 0 0 ${locTone}` }}>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums", lineHeight: 1.3 }}>{fmtTime(row.checkIn?.at)}</Typography>
                  <Typography sx={sub}>{fmtDayTime(row.checkIn?.at).split(" ").slice(0, -1).join(" ") || ""}</Typography>
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <UserAvatar row={row} size={28} fontSize="0.76rem" />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK }}>{row.userName || "-"}</Typography>
                      <Typography noWrap sx={sub}>{roleOf(row)}</Typography>
                    </Box>
                  </Stack>
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 120, maxWidth: 170 }}>
                  {members.length ? (
                    <>
                      {members.slice(0, 2).map((n) => <Typography key={n} noWrap sx={{ fontSize: "0.78rem" }}>{n}</Typography>)}
                      {members.length > 2 && <Typography sx={sub}>+ อีก {members.length - 2} คน</Typography>}
                    </>
                  ) : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170, maxWidth: 230 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.35 }}>
                    {row.job ? [job.title, job.system].filter(Boolean).join(" · ") || "งาน" : (row.jobLabel || "งาน").split(" · ")[0]}
                  </Typography>
                  {row.jobNo && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT }}>{row.jobNo}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 160, maxWidth: 220 }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, overflowWrap: "anywhere" }}>
                    {row.job ? job.site || "—" : (row.jobLabel || "").split(" · ").slice(1).join(" · ") || "—"}
                  </Typography>
                  {job.company && job.company !== job.site && <Typography sx={{ ...sub, overflowWrap: "anywhere" }}>{job.company}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 150 }}>
                  <Box sx={{ mb: 0.5 }}><VerdictTag row={row} /></Box>
                  {inLoc && <Tag tone={locTone} icon={row.checkIn?.gps === "ok" ? <PlaceRounded /> : <LocationOffRounded />}>{shortLoc(row.checkIn, inLoc)}</Tag>}
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                    {row.offSchedule && <Tag tone="#ea580c" icon={<EventBusyRounded />}>นอกวันนัด</Tag>}
                    {pending && <Tag tone={TONE.warn} icon={<EditCalendarRounded />}>ขอแก้เวลา</Tag>}
                    {fixed && <Tag tone={MUTED} icon={<EditCalendarRounded />}>แก้เวลาแล้ว</Tag>}
                  </Stack>
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 140, maxWidth: 220 }}>
                  {row.checkIn?.note
                    ? <Typography sx={{ fontSize: "0.78rem", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{row.checkIn.note}</Typography>
                    : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }} onClick={(e) => photos.length && e.stopPropagation()}>
                  {photos.length ? (
                    <ButtonBase onClick={() => {
                      const list = photos.map((x) => ({ ...x, _id: x.fileId }));
                      if (onPreview) onPreview(photos[0].fileUrl, photos[0].fileName, list, 0);
                      else gal.open(photos[0].fileUrl, photos[0].fileName, list, 0);
                    }}
                      sx={{ gap: 0.5, px: 0.9, height: 28, borderRadius: 2, border: `1px solid ${LINE}`, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 700, color: INK_2, "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                      <PhotoCameraRounded sx={{ fontSize: 16 }} />{photos.length}
                    </ButtonBase>
                  ) : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, textAlign: "right", verticalAlign: "middle" }}>
                  <ChevronRight sx={{ fontSize: 20, color: "#cbd5e1" }} />
                </Box>
              </Box>
            );
          })}
        </tbody>
      </Box>
      <AttendanceDetailDialog row={openRow} onClose={() => setOpenId("")} me={me} isApprover={isApprover} onPreview={onPreview} onChanged={onChanged} />
      {gal.dialog}
    </Box>
  );
}
