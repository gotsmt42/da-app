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
import { useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { Box, Stack, Typography, Button, ButtonBase, Avatar, Collapse } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ExpandMore, EditCalendarOutlined, ChevronRight, DescriptionOutlined, PlaceRounded, LocationOffRounded, OpenInNewRounded, EventBusyOutlined } from "@mui/icons-material";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import AttendanceService from "@/shared/services/AttendanceService";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT } from "@/shared/ui/PageKit";
import {
  fmtDuration, fmtTime, fmtDayTime, locationBadge, resultOf, CORRECTION_STATUS, FIELD_LABEL, ON_SITE_M, fmtDistance,
} from "../attendanceMeta";
import CorrectionDialog from "./CorrectionDialog";
import { PersonChip } from "@/shared/ui/PersonChip";
import { CARD } from "@/shared/ui/modernUi";

const TONE = { ok: "#16a34a", warn: "#d97706", muted: "#94a3b8" };

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

/** รูป = ภาพย่อ · เอกสาร (PDF/Word/Excel) = ชิปชื่อไฟล์ */
const Files = ({ photos, onPreview }) => (photos?.length ? (
  <Stack direction="row" gap={0.75} flexWrap="wrap">
    {photos.map((p) => {
      const open = () => (onPreview ? onPreview(p.fileUrl, p.fileName) : window.open(p.fileUrl, "_blank", "noopener"));
      return isImg(p) ? (
        <Box key={p.fileId} component="img" src={p.fileUrl} alt={p.fileName} loading="lazy" onClick={open}
          sx={{ width: 64, height: 64, objectFit: "cover", borderRadius: "10px", border: `1px solid ${LINE}`, cursor: "zoom-in" }} />
      ) : (
        <ButtonBase key={p.fileId} onClick={open}
          sx={{ gap: 0.5, px: 1, height: 32, maxWidth: "100%", borderRadius: "10px", bgcolor: SURFACE, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 500, color: ACCENT }}>
          <DescriptionOutlined sx={{ fontSize: 16 }} />
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{p.fileName}</Box>
        </ButtonBase>
      );
    })}
  </Stack>
) : null);

/**
 * ✅ (15 ต.ค. 2569 ผู้ใช้: "ตำแหน่งพิกัด ทำให้ชัดเจน สวยงามกว่านี้ บางทีผู้ใช้ไม่รู้และดูไม่ออก")
 * กล่องตำแหน่งเต็มความกว้าง: ไอคอนสีตามผล + หัวข้อเป็นภาษาคน (อยู่ที่หน้างาน / ห่างหน้างาน X / …)
 * + คำอธิบายว่าหมายความว่าอะไร + แผนที่เห็นหมุดจริง + ปุ่มเปิดใน Google Maps
 */
const LocationCard = ({ stamp }) => {
  // 🔁 (15 ต.ค. 2569 ผู้ใช้: "ยังดูรกๆ ตาลาย") — บรรทัดเดียว: ไอคอนสี + สรุปภาษาคน · แผนที่ซ่อนไว้ กด "ดูแผนที่" ค่อยโชว์
  const [mapOpen, setMapOpen] = useState(false);
  if (!stamp) return null;
  const ok = stamp.gps === "ok" && Number.isFinite(stamp.lat) && Number.isFinite(stamp.lng);
  const acc = stamp.accuracy != null ? ` · แม่นยำ ±${stamp.accuracy} ม.` : "";
  let tone; let text; let hint = "";
  if (stamp.gps === "denied") { tone = TONE.warn; text = "ไม่มีตำแหน่ง (ไม่ได้อนุญาต GPS)"; }
  else if (!ok) { tone = TONE.warn; text = "ไม่มีตำแหน่ง (หา GPS ไม่เจอ)"; }
  else if (stamp.distanceM == null) { tone = "#dc2626"; text = `บันทึกตำแหน่งแล้ว${acc}`; hint = "เทียบระยะกับหน้างานไม่ได้ — โครงการยังไม่มีลิงก์แผนที่ในทะเบียนลูกค้า"; }
  else if (stamp.distanceM <= ON_SITE_M) { tone = TONE.ok; text = `อยู่ที่หน้างาน · ห่าง ${fmtDistance(stamp.distanceM)}${acc}`; }
  else { tone = TONE.warn; text = `อยู่นอกหน้างาน · ห่าง ${fmtDistance(stamp.distanceM)}${acc}`; }
  const Icon = ok ? PlaceRounded : LocationOffRounded;
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


function Row({ row, me, isApprover, showJob, onPreview, onChanged, embedded }) {
  const [open, setOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const role = isHeadRow ? "หัวหน้าทีม" : row.team?.head ? `กดแทนหัวหน้าทีม ${row.team.head}` : "ผู้กดเข้างาน";
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
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.4, overflowWrap: "anywhere" }}>
            {showJob ? (row.jobLabel || "งาน") : row.userName}
            {showJob && row.jobNo && <Box component="span" sx={{ ml: 0.75, fontSize: "0.72rem", fontWeight: 600, color: FAINT, whiteSpace: "nowrap" }}>{row.jobNo}</Box>}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.6} sx={{ mt: 0.35, minWidth: 0 }}>
            <Avatar sx={{ width: 20, height: 20, fontSize: "0.62rem", fontWeight: 700, bgcolor: personColor(row.userName) }}>{personInitial(row.userName)}</Avatar>
            <Typography noWrap sx={{ fontSize: "0.78rem", color: INK_2, minWidth: 0 }}>
              {[showJob ? row.userName : "", isHeadRow ? "หัวหน้าทีม" : role, teamMembers.length ? crew : ""].filter(Boolean).join(" · ")}
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.65 }}>
            {inLoc && <Tag tone={locTone} icon={row.checkIn?.gps === "ok" ? <PlaceRounded /> : <LocationOffRounded />}>{shortLoc(row.checkIn, inLoc)}</Tag>}
            {row.offSchedule && <Tag tone="#ea580c" icon={<EventBusyOutlined />}>นอกวันนัด</Tag>}
            {pending.length > 0 && <Tag tone={TONE.warn} icon={<EditCalendarOutlined />}>ขอแก้เวลา · รออนุมัติ</Tag>}
            {fixed && <Tag tone={MUTED} icon={<EditCalendarOutlined />}>แก้เวลาแล้ว</Tag>}
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
            <InfoRow label="รูปหน้างาน">{row.checkIn?.photos?.length ? <Files photos={row.checkIn.photos} onPreview={onPreview} /> : null}</InfoRow>
            {/* ข้อมูลเช็คเอาต์ของรายการเก่า (ก่อนตัดระบบ 11 ต.ค. 2569) — แสดงเฉพาะที่มี */}
            {legacyOut && <InfoRow label="ออก (เดิม)">{`${fmtTime(row.checkOut.at)} · ${fmtDuration(row.durationMin)}${result ? ` · ${result.label}` : ""}`}</InfoRow>}
            <InfoRow label="สรุปผลงาน">{row.checkOut?.summary}</InfoRow>
            <InfoRow label="ปัญหาที่พบ">{row.checkOut?.issues}</InfoRow>
            <InfoRow label="อะไหล่">{row.checkOut?.partsNeeded}</InfoRow>
            <InfoRow label="ไฟล์แนบ">{row.checkOut?.photos?.length ? <Files photos={row.checkOut.photos} onPreview={onPreview} /> : null}</InfoRow>
            <InfoRow label="Service Report">{row.checkOut?.reports?.length ? <Files photos={row.checkOut.reports} onPreview={onPreview} /> : null}</InfoRow>
          </Box>

          {history.length > 0 && (
            <Box sx={{ mt: 1, p: 1.25, borderRadius: "12px", bgcolor: SURFACE }}>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED, mb: 0.75 }}>ประวัติการแก้เวลา</Typography>
              <Stack spacing={1.25}>
                {history.map((c) => {
                  const st = CORRECTION_STATUS[c.status] || CORRECTION_STATUS.pending;
                  return (
                    <Box key={c._id}>
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>
                        {FIELD_LABEL[c.field]} {fmtTime(c.fromAt)} → {fmtTime(c.toAt)}
                        <Box component="span" sx={{ ml: 0.75, fontSize: "0.74rem", fontWeight: 600, color: st.color }}>{st.label}</Box>
                      </Typography>
                      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.5 }}>
                        เหตุผล: {c.reason} · ขอโดย {c.requestedBy} {fmtDayTime(c.requestedAt)}
                        {c.decidedBy ? ` · ${c.status === "approved" ? "อนุมัติ" : "ตัดสิน"}โดย ${c.decidedBy}` : ""}
                        {c.decisionNote ? ` (${c.decisionNote})` : ""}
                      </Typography>
                      {c.status === "pending" && isApprover && (
                        <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                          <Button variant="contained" disableElevation disabled={busy} onClick={() => decide(c, true)}
                            sx={{ ...SMALL_BTN, flex: 1, bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" } }}>อนุมัติ</Button>
                          <Button variant="outlined" disabled={busy} onClick={() => decide(c, false)}
                            sx={{ ...SMALL_BTN, flex: 1, color: "#dc2626", borderColor: "#fca5a5", "&:hover": { borderColor: "#dc2626", bgcolor: "#fef2f2" } }}>ไม่อนุมัติ</Button>
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {(showJob || mine || isApprover) && (
            <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
              {(mine || isApprover) && (
                <Button variant="outlined" startIcon={<EditCalendarOutlined sx={{ fontSize: "18px !important" }} />} onClick={() => setFixOpen(true)}
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
 * @param rows        รายการ Attendance
 * @param me          userId ผู้ใช้ปัจจุบัน
 * @param isApprover  อนุมัติ/แก้เวลาได้ (approveJobs)
 * @param showJob     แสดงชื่องาน (หน้ารวม) — จอกว้างเรียง 2 คอลัมน์
 */
export default function AttendanceList({ rows = [], me, isApprover, showJob = false, onPreview, onChanged, empty, embedded = false }) {
  if (!rows.length) return empty || null;
  return (
    <Box sx={{ display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: showJob ? { xs: "1fr", lg: "1fr 1fr" } : "1fr" }}>
      {rows.map((r) => (
        <Row key={r._id} row={r} me={me} isApprover={isApprover} showJob={showJob} onPreview={onPreview} onChanged={onChanged} embedded={embedded} />
      ))}
    </Box>
  );
}
