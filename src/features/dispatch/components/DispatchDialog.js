/**
 * DispatchDialog — รายละเอียดใบมอบหมายงาน 1 ใบ (ของกลาง ใช้ทั้งฝั่งเซล/แอดมิน/ช่าง)
 *
 * ⚠️ **กล่องเดียวใช้ 3 มุมมอง** โดยดูจากสิทธิ์ + ว่าเราอยู่ในรายชื่อผู้รับงานไหม:
 *   • แอดมิน  → เลือก/แก้ผู้รับงานได้ · เห็นทุกอย่าง
 *   • ช่าง    → กดรับทราบ/เริ่มงาน/ปิดงาน "ของตัวเองเท่านั้น" · ติ๊ก checklist · แนบรูปหลังทำ
 *   • ผู้ขอ   → ดูความคืบหน้ารายคน · ยกเลิกใบได้
 * เขียนเป็นกล่องเดียวเพราะเนื้อหา 90% เหมือนกัน ถ้าแยก 3 ไฟล์จะกลายเป็นของที่ต้องแก้พร้อมกันตลอดไป
 *
 * ⚠️ ความคืบหน้าแสดง "แถวละคน" ไม่ยุบรวมเป็นสถานะเดียว — ถ้ายุบก็เท่ากับทิ้งข้อกำหนด
 * "แจ้งงานแยกเป็นแต่ละคน" ไปทั้งหมด
 */
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography,
  IconButton, Checkbox, Alert, CircularProgress,
  TextField, Tooltip, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AttachFile, InsertDriveFile, Bolt, Schedule, LocationOn, Phone,
  Close, GroupAdd, FactCheck,
  OpenInNew,
  NoteAlt,
  EventAvailable,
  Undo,
  Assignment,
  Inventory2,
} from "@mui/icons-material";

import FilePreviewDialog from "@/features/documents/components/FilePreviewDialog";
import { PersonChip, UnassignedChip } from "@/shared/ui/PersonChip";
import { isImageFile } from "@/shared/utils/jobDocTypes";
import { formatThai } from "@/shared/utils/thaiDate";
import { mapSearchUrl, GoogleMapsPin } from "@/shared/ui/SiteMapLink";
import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import DispatchService from "../services/DispatchService";
import AssignDialog from "./AssignDialog";
import ReviewDialog from "./ReviewDialog";
import {
  DISPATCH_STATUS_META, DISPATCH_ACCENT, TEXT_SUB, BORDER_MAIN, SURFACE_SUBTLE, jobStatusColor,
} from "../dispatchMeta";

// 🧹 NEXT_ACTION (รับทราบ → เริ่มงาน → ปิดงาน) ถูกตัดออกตามที่ผู้ใช้สั่ง — เป็นสถานะซ้อนกับ
// สถานะงานจริงของช่าง ทำให้ใบค้างที่ "รอรับทราบ" ทั้งที่งานเสร็จไปแล้วในหน้าการดำเนินงาน

// ✅ รวม company · site แบบไม่โชว์ซ้ำเวลาเท่ากัน (ใบที่ไม่ได้กรอกบริษัท — server เติม company = site
// ให้แทน) เทียบ helper เดียวกับที่ใช้ใน DispatchList.js/OperationBoard
const companySite = (company, site) => {
  if (company && site && company !== site) return `${company} · ${site}`;
  return company || site || "ไม่ระบุโครงการ";
};

export default function DispatchDialog({ dispatchId, onClose, onSaved }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width:900px)");
  const { can } = usePermissions();
  const { userData } = useAuth();
  const myId = String(userData?.userId || userData?._id || "");

  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  // null = ปิด · "approve"/"reject" = เปิดกล่องที่ทำงานนั้นโดยเฉพาะ (ไม่ถามซ้ำอีกรอบ)
  const [reviewMode, setReviewMode] = useState(null);
  const [askCancel, setAskCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // ✅ โหมดแก้ลิงก์แผนที่ในกล่องนี้ (null = ไม่ได้แก้อยู่)
  const [mapDraft, setMapDraft] = useState(null);

  const fileRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!dispatchId) return;
    if (!silent) { setLoading(true); setError(""); }
    try { setD(await DispatchService.get(dispatchId)); }
    catch (err) { if (!silent) setError(err?.response?.data?.message || "โหลดใบมอบหมายไม่สำเร็จ"); }
    finally { if (!silent) setLoading(false); }
  }, [dispatchId]);

  useEffect(() => { load(); }, [load]);

  // ✅ เรียลไทม์: ใบที่เปิดดูอยู่ถูกอัปเดตจากเครื่องอื่น (ช่างติ๊กเช็กลิสต์/เปลี่ยนสถานะ) → เห็นทันที
  // ⚠️ ข้ามตอนกำลังทำรายการอยู่ (busy) — กันข้อมูลเก่าจากรอบดึงมาทับผลของปุ่มที่เพิ่งกด
  useRealtime("dispatch", (evt) => {
    if (busy) return;
    if (evt.type === "resync" || !evt.id || String(evt.id) === String(dispatchId)) load(true);
  }, { enabled: Boolean(dispatchId) });

  const apply = (updated) => { setD(updated); onSaved?.(updated); };
  const run = async (fn) => {
    setBusy(true); setError("");
    try { apply(await fn()); return true; }
    catch (err) { setError(err?.response?.data?.message || err?.message || "ทำรายการไม่สำเร็จ"); return false; }
    finally { setBusy(false); }
  };

  if (!dispatchId) return null;

  const canAssign = can("assignDispatch");
  /**
   * 🐛 ที่แก้ (ผู้ใช้แจ้งว่า "ปุ่มเปิดหน้าดำเนินงานไม่มีจริงในของเซล"): ปุ่มนี้เคยโผล่ให้ทุกคนที่เห็นใบ
   * รวมถึงเซล — แต่หน้า /operation เตะเซลออกไป /event ทันที (ดู features/operation/pages/Operation.js
   * บรรทัด "if (isSale) return <Navigate to='/event' />") เซลจึงกดแล้วเด้งไปหน้าอื่นโดยไม่มีคำอธิบาย
   * ⚠️ ใช้เกณฑ์เดียวกับเมนูด้านซ้าย (canViewOperation ใน Sidebar.js) — ถ้าเข้าหน้านั้นไม่ได้ ก็ไม่ควร
   * มีปุ่มพาไป
   */
  const canOpenOperation = can("editOperation") || can("receiveDispatch");
  const isRequester = String(d?.requestedBy?.userId || "") === myId;
  /**
   * ✅ ที่เพิ่ม (ผู้ใช้ขอ: "แอดโลเคชั่นลงระบบได้ง่ายๆ แก้ได้ทั้งเซล และแอดมิน")
   * เดิมพิกัดใส่ได้เฉพาะตอนกรอกฟอร์มครั้งแรก — ใบที่ส่งไปแล้วแต่ลืมใส่ ไม่มีทางเติมทีหลังเลย
   * ⚠️ ตรงกับสิทธิ์ฝั่ง server (PATCH /api/dispatch/:id/map) เป๊ะ: ผู้แจ้ง หรือ คนจ่ายงาน
   * ⚠️ ต้องประกาศหลัง isRequester — ไม่งั้นอ่านค่าก่อนถูกกำหนด (TDZ)
   */
  const canEditMap = isRequester || canAssign;
  const me = (d?.assignees || []).find((a) => String(a.userId) === myId);
  const meta = d ? DISPATCH_STATUS_META[d.status] : null;
  // ⚠️ "ปิดแล้ว" = ยกเลิกใบ หรือ งานจริงในตารางเสร็จสิ้นแล้ว
  // 🧹 เดิมเทียบ status === "done" ซึ่งเป็นสถานะที่ถูกตัดออกจาก enum แล้ว (ไม่มีวันเป็นจริง)
  const isClosed = d?.status === "cancelled" || d?.job?.status === "ดำเนินการเสร็จสิ้น";
  const doneCount = (d?.checklist || []).filter((c) => c.done).length;

  return (
    <Dialog open onClose={() => !busy && onClose?.()} fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: { md: 3 } } }}>
      {loading || !d ? (
        <DialogContent sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          {error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}
        </DialogContent>
      ) : (
        <>
          {/* ✅ ที่แก้ (ผู้ใช้ขอ: "ปรับแต่งให้มองง่ายดูง่าย สวยงาม มืออาชีพ"): เดิมหัวกล่องเป็น
              DialogTitle มาตรฐานพื้นขาวเรียบๆ ทั้งที่เนื้อในเต็มไปด้วยการ์ดสีสันแล้ว (Section ต่างๆ)
              ทำให้หัวกล่องซึ่งควรเป็นจุดที่เด่นที่สุดกลับดูจืดที่สุดของทั้งกล่อง — เปลี่ยนเป็นแถบไล่สี
              ตามสถานะของใบ (สีเดียวกับป้ายสถานะ) ให้เห็นภาพรวม "งานนี้อยู่ขั้นไหน" ตั้งแต่แวบแรกที่เปิด
              กล่อง เทียบ pattern เดียวกับหัวกล่องของ EditEvent.js/AddSalesAppointment.js ที่ไล่สีตาม
              สถานะ/ประเภทงานอยู่แล้ว — ให้กล่องนี้เข้าชุดกับทั้งแอปในที่สุด */}
          <DialogTitle sx={{ p: 0 }}>
            {/* ✅ หัวกล่องเป็นพื้นขาว — เดิมเป็นแถบไล่สีตามสถานะเต็มความกว้าง ซึ่งบวกกับการ์ดสีรุ้ง
                ข้างในทำให้กล่องเดียวมีสีเกิน 6 สี · ตอนนี้สถานะสื่อด้วยจุดสี + ตัวอักษรเหมือนในลิสต์
                (ภาษาเดียวกันทั้งแอป) และชื่อโครงการถูกยกเป็นหัวข้อหลักแทนประเภทงาน ให้ตรงกับการ์ด */}
            <Box sx={{ position: "relative", p: 2.25, pr: 6.5, borderBottom: "1px solid", borderColor: BORDER_MAIN }}>
              <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.4 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: meta.color }}>{meta.label}</Typography>
                {d.priority === "urgent" && (
                  <>
                    <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: TEXT_SUB }} />
                    <Bolt sx={{ fontSize: 14, color: "#dc2626" }} />
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#dc2626" }}>ด่วน</Typography>
                  </>
                )}
              </Stack>
              <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", lineHeight: 1.35 }}>
                {companySite(d.customer?.company, d.customer?.site)}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.15 }}>
                {[
                  [d.title, d.system].filter(Boolean).join(" · "),
                  d.dispatchNo,
                  d.requestedBy?.name ? `แจ้งโดย ${d.requestedBy.name}` : null,
                  d.requestedAt ? formatThai(moment(d.requestedAt), "D MMM YY") : null,
                ].filter(Boolean).join(" · ")}
              </Typography>
              <IconButton
                onClick={() => !busy && onClose?.()}
                sx={{ position: "absolute", top: 12, right: 12, color: TEXT_SUB }}
              >
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent dividers sx={{ borderTop: "none", bgcolor: SURFACE_SUBTLE }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {d.status === "cancelled" && (
              <Alert severity="warning" sx={{ mb: 2 }}>ใบนี้ถูกยกเลิกแล้ว — {d.cancelReason}</Alert>
            )}

            {/* ✅ ใบที่ถูกตีกลับต้องบอกเหตุผลให้ชัดที่สุด และบอกด้วยว่าต้องทำอะไรต่อ —
                ไม่ใช่แค่ขึ้นป้ายสถานะสีแดงแล้วปล่อยให้ผู้แจ้งเดาเอง */}
            {d.status === "rejected" && (
              <Alert
                severity="error" sx={{ mb: 2 }}
                action={isRequester && (
                  <Button
                    size="small" variant="contained" color="error" disabled={busy}
                    onClick={async () => { await run(() => DispatchService.resubmit(d._id)); }}
                    sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    แก้ไขแล้ว ส่งตรวจใหม่
                  </Button>
                )}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>ไม่อนุมัติ — ต้องแก้ไขก่อน</Typography>
                <Typography variant="body2">{d.rejectedReason}</Typography>
                {d.reviewedBy?.name && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
                    โดย {d.reviewedBy.name}{d.reviewedAt ? ` · ${formatThai(moment(d.reviewedAt), "D MMM YYYY")}` : ""}
                  </Typography>
                )}
              </Alert>
            )}

            {/* ✅ ใบที่ยังไม่ผ่านการตรวจ — ผู้จัดการต้องเห็นปุ่มตัดสินใจทันทีที่เปิดใบ ไม่ต้องเลื่อนหา */}
            {/* ⚠️ เงื่อนไขคือ "ยังไม่มีแผนงาน" ไม่ใช่ "สถานะ requested"
                🐛 ที่แก้: ใบที่ถูกกด "มอบหมายช่าง" ผ่านปุ่มเก่าจะกลายเป็นสถานะ assigned ทันที
                โดยยังไม่มี event — แล้วแถบนี้หายไป ทำให้ไม่เหลือทางลงตารางเลยสักทาง
                (อาการที่ผู้ใช้เจอ: "จะลงตาราง event ยังไง ในเมื่อไม่มีให้เลือก") */}
            {/* ✅ แถบสั่งงานหลัก — ปุ่มเต็มความกว้าง ไม่ใช่ปุ่มเล็กเบียดมุมขวา
                ⚠️ ข้อความปุ่มบอก "ผลลัพธ์" ไม่ใช่ "ชื่อขั้นตอน" — คนกดต้องรู้ว่ากดแล้วเกิดอะไร
                โดยไม่ต้องเปิดเข้าไปดูก่อน ("ตรวจสอบใบนี้" เดิมไม่ได้บอกอะไรเลย)
                ⚠️ คอมเมนต์ต้องอยู่นอก `&& (` — วางในตำแหน่ง expression ไม่ได้ (parse error) */}
            {canAssign && !d.eventId && d.status !== "cancelled" && (
              <Box
                sx={{
                  mb: 2, p: 1.75, borderRadius: 3,
                  bgcolor: "#fff",
                  border: "1px solid", borderColor: BORDER_MAIN, borderLeft: "4px solid #d97706",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
                  <Box
                    sx={{
                      width: 34, height: 34, borderRadius: 2, flexShrink: 0,
                      bgcolor: alpha(DISPATCH_ACCENT, 0.15), color: "#b45309",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <FactCheck sx={{ fontSize: 19 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>
                      รอคุณตัดสินใจ
                      {d.resubmitCount > 0 ? ` · ผู้แจ้งแก้ไขมาแล้ว ${d.resubmitCount} รอบ` : ""}
                    </Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                      งานนี้จะยังไม่เข้าตารางของช่างจนกว่าคุณจะเลือกวันเข้างาน
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    fullWidth variant="contained" disabled={busy}
                    startIcon={<EventAvailable sx={{ fontSize: 18 }} />}
                    onClick={() => setReviewMode("approve")}
                    sx={{
                      textTransform: "none", fontWeight: 800, borderRadius: 2.5, py: 1,
                      boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" },
                    }}
                  >
                    อนุมัติ + ลงตารางงาน
                  </Button>
                  <Button
                    fullWidth variant="outlined" disabled={busy}
                    startIcon={<Undo sx={{ fontSize: 17 }} />}
                    onClick={() => setReviewMode("reject")}
                    sx={{
                      textTransform: "none", fontWeight: 800, borderRadius: 2.5, py: 1,
                      color: "#dc2626", borderColor: alpha("#ef4444", 0.5),
                      "&:hover": { borderColor: "#dc2626", bgcolor: alpha("#ef4444", 0.06) },
                    }}
                  >
                    ตีกลับให้แก้ไข
                  </Button>
                </Stack>
              </Box>
            )}

            {/* ✅ (5 ต.ค. 2569) ผู้ใช้: "ดูยาก ตาลาย" — เดิมเป็นการ์ดกรอบ 6 ใบเรียง 2 คอลัมน์ (กรอบซ้อนกรอบ
                ทุกเรื่อง) และกล่อง "ผู้รับงาน" ขึ้น "ยังไม่ได้มอบหมายให้ใคร" ทั้งที่งานในตารางมีผู้รับผิดชอบแล้ว
                ✅ ใหม่: แถบสรุป 4 ช่อง (วันเข้างาน · ผู้รับผิดชอบ · สถานะงาน · ผู้แจ้ง) + เอกสารอ่านแบบ
                "หัวข้อ : เนื้อหา" ในกล่องเดียว คั่นด้วยเส้นบาง — กวาดตาลงมาทีเดียวจบ */}
            {(() => {
              const responsible = d.job?.responsiblePerson || "";
              const team = (d.assignees || []).map((x) => x.name).filter((n) => n && n !== responsible);
              const jobColor = d.job?.status ? jobStatusColor(d.job.status) : meta.color;
              const Fact = ({ label, children }) => (
                <Box sx={{ minWidth: 0, px: { xs: 1.5, sm: 2 }, py: 1.25, borderLeft: { sm: "1px solid" }, borderTop: { xs: "1px solid", sm: 0 }, borderColor: `${BORDER_MAIN} !important`, "&:first-of-type": { borderLeft: 0, borderTop: 0 } }}>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: TEXT_SUB, mb: 0.4 }}>{label}</Typography>
                  {children}
                </Box>
              );
              return (
                <Box sx={{ mb: 2, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" }, bgcolor: "#fff", border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 3 }}>
                  <Fact label="วันเข้างาน">
                    <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: d.job?.start ? "#0f172a" : "#b45309" }}>
                      {d.job?.start ? formatThai(moment(d.job.start), "ddd D MMM YY") : "ยังไม่ลงวัน"}
                    </Typography>
                  </Fact>
                  <Fact label="ผู้รับผิดชอบ">
                    <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
                      {responsible ? <PersonChip name={responsible} strong size={20} /> : <UnassignedChip />}
                      {team.length > 0 && (
                        <Tooltip title={team.join(", ")}>
                          <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: TEXT_SUB }}>+{team.length} ทีม</Typography>
                        </Tooltip>
                      )}
                      {canAssign && !isClosed && d.eventId && (
                        <Tooltip title={d.assignees?.length ? "แก้ผู้รับงาน" : "มอบหมายช่าง"}>
                          <IconButton size="small" onClick={() => setAssignOpen(true)} disabled={busy} sx={{ color: "#2563eb" }}>
                            <GroupAdd sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Fact>
                  <Fact label="สถานะงาน">
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: jobColor }} />
                      <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: "#0f172a" }}>{d.job?.status || meta.label}</Typography>
                    </Stack>
                  </Fact>
                  <Fact label="ผู้แจ้ง">
                    {d.requestedBy?.name ? <PersonChip name={d.requestedBy.name} size={20} /> : <Typography sx={{ color: TEXT_SUB }}>-</Typography>}
                  </Fact>
                </Box>
              );
            })()}

            {d.eventId && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 2, px: 1.75, py: 1.1, borderRadius: 2.5, bgcolor: alpha("#16a34a", 0.06), border: "1px solid", borderColor: alpha("#16a34a", 0.2) }}>
                <EventAvailable sx={{ color: "#16a34a", fontSize: 20 }} />
                <Typography sx={{ flex: 1, fontSize: "0.84rem", color: "#166534", fontWeight: 600 }}>
                  ลงตารางงานแล้ว{d.reviewedBy?.name ? ` · อนุมัติโดย ${d.reviewedBy.name}` : ""}
                </Typography>
                {canOpenOperation && (
                  <Button size="small" onClick={() => navigate(`/operation/${d.eventId}`)} endIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                    sx={{ textTransform: "none", fontWeight: 700, color: "#166534", flexShrink: 0 }}>
                    เปิดในหน้าการดำเนินงาน
                  </Button>
                )}
              </Stack>
            )}

            {/* ── เนื้อหาใบ: หัวข้อซ้าย · เนื้อหาขวา ในกล่องเดียว ── */}
            {(() => {
              const Line = ({ icon, label, right, children, show = true }) => show ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "170px minmax(0, 1fr)" }, gap: { xs: 0.5, sm: 2 }, px: { xs: 1.5, sm: 2 }, py: 1.5, borderTop: "1px solid", borderColor: BORDER_MAIN, "&:first-of-type": { borderTop: 0 } }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ alignSelf: "start", pt: { sm: 0.15 } }}>
                    <Box sx={{ color: TEXT_SUB, display: "flex", "& svg": { fontSize: 17 } }}>{icon}</Box>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#334155" }}>{label}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Box sx={{ display: { sm: "none" } }}>{right}</Box>
                  </Stack>
                  <Box sx={{ minWidth: 0 }}>
                    {right && <Box sx={{ display: { xs: "none", sm: "flex" }, justifyContent: "flex-end", float: "right", ml: 1 }}>{right}</Box>}
                    {children}
                  </Box>
                </Box>
              ) : null;
              const body = { fontSize: "0.88rem", color: "#0f172a", whiteSpace: "pre-wrap", lineHeight: 1.6 };
              return (
                <Box sx={{ bgcolor: "#fff", border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 3, overflow: "hidden" }}>
                  <Line icon={<Assignment />} label="รายละเอียดงาน" show={Boolean(d.detail || d.contract?.groupId)}>
                    {d.contract?.groupId && (
                      <Typography sx={{ fontSize: "0.78rem", color: "#0e7490", fontWeight: 700, mb: 0.5 }}>
                        งานตามสัญญา · เลขที่ {d.contract.no || "—"}{d.contract.visitCount ? ` · ทั้งหมด ${d.contract.visitCount} ครั้ง` : ""}
                      </Typography>
                    )}
                    {d.detail && <Typography sx={body}>{d.detail}</Typography>}
                  </Line>

                  <Line icon={<NoteAlt />} label="หมายเหตุจากผู้แจ้ง" show={Boolean(d.note)}>
                    <Typography sx={body}>{d.note}</Typography>
                  </Line>

                  <Line icon={<FactCheck />} label="สิ่งที่ต้องทำ" show={d.checklist?.length > 0}
                    right={<Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: doneCount === d.checklist?.length ? "#059669" : TEXT_SUB }}>{doneCount}/{d.checklist?.length}</Typography>}>
                    <Stack spacing={0.25}>
                      {(d.checklist || []).map((c) => (
                        <Stack key={c._id} direction="row" alignItems="center" spacing={0.5}>
                          <Checkbox size="small" checked={c.done} disabled={busy || isClosed || (!me && !canAssign)}
                            onChange={(e) => run(() => DispatchService.toggleChecklist(d._id, c._id, e.target.checked))} sx={{ p: 0.4 }} />
                          <Typography sx={{ ...body, flex: 1, minWidth: 0, textDecoration: c.done ? "line-through" : "none", color: c.done ? TEXT_SUB : "#0f172a" }}>{c.item}</Typography>
                          {c.done && c.doneByName && <Typography variant="caption" sx={{ color: TEXT_SUB, flexShrink: 0 }}>{c.doneByName}</Typography>}
                        </Stack>
                      ))}
                    </Stack>
                  </Line>

                  <Line icon={<Inventory2 />} label="ของที่ต้องเตรียมไป" show={d.parts?.length > 0}>
                    <Typography sx={body}>{(d.parts || []).map((p) => `${p.name} × ${p.qty}${p.unit ? ` ${p.unit}` : ""}`).join(" · ")}</Typography>
                  </Line>

                  <Line icon={<LocationOn />} label="หน้างาน"
                    show={canEditMap || Boolean(d.customer?.address || d.customer?.contactName || d.customer?.contactTel || d.customer?.mapUrl || d.dueAt)}>
                    <Stack spacing={0.4}>
                      {d.customer?.address && <Typography sx={body}>{d.customer.address}</Typography>}
                      {(d.customer?.contactName || d.customer?.contactTel) && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Phone sx={{ fontSize: 15, color: TEXT_SUB }} />
                          <Typography sx={body}>{[d.customer?.contactName, d.customer?.contactTel].filter(Boolean).join(" · ")}</Typography>
                        </Stack>
                      )}
                      {d.dueAt && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Schedule sx={{ fontSize: 15, color: TEXT_SUB }} />
                          <Typography sx={body}>กำหนดเสร็จ {formatThai(moment(d.dueAt), "D MMM YYYY")}</Typography>
                        </Stack>
                      )}
                    </Stack>
                    {mapDraft === null ? (
                      <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                        <Button
                          size="small" component="a" target="_blank" rel="noopener noreferrer"
                          href={d.customer?.mapUrl || mapSearchUrl(d.customer?.site, d.customer?.company)}
                          startIcon={<GoogleMapsPin size={16} />} endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, px: 1.5, color: "#2563eb", border: "1px solid", borderColor: alpha("#2563eb", 0.3), "&:hover": { bgcolor: alpha("#2563eb", 0.06) } }}
                        >
                          {d.customer?.mapUrl ? "เปิดแผนที่นำทาง" : "ค้นหาใน Google Maps"}
                        </Button>
                        {canEditMap && !isClosed && (
                          <Button size="small" onClick={() => setMapDraft(d.customer?.mapUrl || "")}
                            sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>
                            {d.customer?.mapUrl ? "แก้ลิงก์" : "เพิ่มลิงก์แผนที่"}
                          </Button>
                        )}
                      </Stack>
                    ) : (
                      <Box sx={{ mt: 1 }}>
                        <TextField size="small" fullWidth autoFocus value={mapDraft} onChange={(e) => setMapDraft(e.target.value)}
                          placeholder="วางลิงก์ที่แชร์จาก Google Maps"
                          helperText="กดค้นหา → เจอตำแหน่งแล้วกด แชร์ → คัดลอกลิงก์ → วางที่นี่ · เว้นว่างเพื่อลบลิงก์"
                          FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }} />
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end" sx={{ mt: 1 }}>
                          <Button size="small" onClick={() => setMapDraft(null)} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
                          <Button size="small" variant="contained" disabled={busy}
                            onClick={async () => { if (await run(() => DispatchService.setMapUrl(d._id, mapDraft.trim()))) setMapDraft(null); }}
                            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none" }}>
                            บันทึกตำแหน่ง
                          </Button>
                        </Stack>
                      </Box>
                    )}
                  </Line>

                  <Line icon={<AttachFile />} label={`เอกสารประกอบ${d.attachments?.length ? ` (${d.attachments.length})` : ""}`}
                    right={(isRequester || canAssign) && !isClosed && (
                      <Button size="small" startIcon={<AttachFile sx={{ fontSize: 15 }} />} disabled={busy} onClick={() => fileRef.current?.click()}
                        sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem", py: 0.1, color: "#2563eb" }}>
                        แนบไฟล์
                      </Button>
                    )}>
                    {d.attachments?.length ? (
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {d.attachments.map((f) => (
                          <Tooltip key={f._id || f.fileUrl} title={f.fileName || "ไฟล์"}>
                            <Box onClick={() => setPreview(f)} sx={{
                              width: 72, height: 72, borderRadius: 2, overflow: "hidden", cursor: "pointer",
                              border: "1px solid", borderColor: BORDER_MAIN, display: "flex", alignItems: "center", justifyContent: "center",
                              bgcolor: SURFACE_SUBTLE, "&:hover": { borderColor: "#2563eb" },
                            }}>
                              {isImageFile(f)
                                ? <Box component="img" src={f.fileUrl} alt={f.fileName} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <InsertDriveFile sx={{ fontSize: 28, color: TEXT_SUB }} />}
                            </Box>
                          </Tooltip>
                        ))}
                      </Stack>
                    ) : (
                      <Typography sx={{ fontSize: "0.84rem", color: TEXT_SUB }}>ไม่มีไฟล์แนบ</Typography>
                    )}
                  </Line>
                </Box>
              );
            })()}

            <input
              ref={fileRef} hidden type="file" accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) run(() => DispatchService.addFile(d._id, f));
              }}
            />
          </DialogContent>

          <DialogActions sx={{ p: 2, borderTop: "1px solid", borderTopColor: BORDER_MAIN }}>
            {(isRequester || canAssign) && !isClosed && (
              askCancel ? (
                <Stack direction="row" spacing={1} sx={{ flex: 1 }} alignItems="center">
                  <TextField
                    size="small" fullWidth autoFocus placeholder="เหตุผลที่ยกเลิก"
                    value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff" } }}
                  />
                  <Button
                    size="small" variant="contained" color="error" disabled={busy || !cancelReason.trim()}
                    onClick={async () => { if (await run(() => DispatchService.cancel(d._id, cancelReason.trim()))) setAskCancel(false); }}
                    sx={{ textTransform: "none", flexShrink: 0, borderRadius: 2 }}
                  >
                    ยืนยันยกเลิก
                  </Button>
                  <IconButton size="small" onClick={() => setAskCancel(false)}><Close sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
              ) : (
                <Button
                  size="small" onClick={() => setAskCancel(true)} disabled={busy}
                  sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626", "&:hover": { bgcolor: alpha("#ef4444", 0.08) } }}
                >
                  ยกเลิกใบนี้
                </Button>
              )
            )}
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined" onClick={() => onClose?.()} disabled={busy}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: BORDER_MAIN, color: "#334155" }}
            >
              ปิด
            </Button>
          </DialogActions>

          {reviewMode && (
            <ReviewDialog
              dispatch={d}
              mode={reviewMode}
              onClose={() => setReviewMode(null)}
              onReviewed={(updated) => { apply(updated); setReviewMode(null); }}
            />
          )}

          <AssignDialog
            open={assignOpen} dispatch={d}
            onClose={() => setAssignOpen(false)}
            onAssigned={(updated) => { apply(updated); setAssignOpen(false); }}
          />
          <FilePreviewDialog file={preview} caption={preview ? `ไฟล์ของ ${d.dispatchNo || "ใบมอบหมาย"}` : ""} onClose={() => setPreview(null)} />
        </>
      )}
    </Dialog>
  );
}
