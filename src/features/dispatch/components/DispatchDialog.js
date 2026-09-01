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
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography,
  Chip, IconButton, Checkbox, Avatar, Alert, CircularProgress,
  TextField, Tooltip, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AttachFile, InsertDriveFile, Person, Bolt, Schedule, LocationOn, Phone,
  Close, GroupAdd, FactCheck,
  OpenInNew,
  NoteAlt,
  EventAvailable,
  Undo,
  Assignment,
  Inventory2,
} from "@mui/icons-material";

import FilePreviewDialog from "@/features/documents/components/FilePreviewDialog";
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

/**
 * การ์ดครอบแต่ละส่วน — ชุดเดียวกับฟอร์มแจ้งงาน (DispatchRequestDialog) ให้สองหน้าจอที่ต่อเนื่องกัน
 * อ่านเป็นระบบเดียว
 * ⚠️ คืน null เมื่อไม่มีเนื้อหา — การ์ดหัวข้อเปล่าๆ แย่กว่าไม่มีการ์ดเลย
 */
/**
 * ✅ ที่แก้ (ผู้ใช้แจ้งว่า "ดูรกตามาก"): เดิมการ์ดแต่ละใบมี "สีประจำส่วน" ของตัวเอง — รายละเอียดงาน
 * ส้ม · หมายเหตุม่วง · เอกสารเขียว · ผู้รับงานฟ้า · หน้างานฟ้าเข้ม · สถานะฟ้า — ทั้งขอบการ์ด พื้น
 * หัวการ์ด และเส้นคั่น ผลคือเปิดกล่องมาเจอ 5-6 สีพร้อมกันเหมือนรุ้ง ทั้งที่สีพวกนั้นไม่ได้แปลว่าอะไรเลย
 * (ไม่ใช่สถานะ ไม่ใช่ความสำคัญ เป็นแค่การตกแต่ง) แล้วไปกลบสีที่มีความหมายจริงคือสถานะของงาน
 *
 * ✅ ตอนนี้ทุกการ์ดเป็นสีเดียวกันหมด: ขาว ขอบเทา หัวข้อดำ — เหลือสีเฉพาะที่ "ไอคอน" ดวงเล็กๆ
 * พอให้แยกส่วนออกจากกันด้วยการกวาดตา โดยไม่กลายเป็นพื้นสีทั้งแถบ
 */
const Section = ({ icon, title, right, accent, children, empty }) =>
  empty ? null : (
    // ⚠️ height: 100% — การ์ดต้องสูงเต็มช่อง grid ที่ได้รับ ไม่งั้นช่องยืดแต่ตัวการ์ดไม่ยืด
    // ขอบล่างของการ์ดในแถวเดียวกันก็จะยังไม่ตรงกัน (ต้นเหตุที่ผู้ใช้เห็นว่า "เยื้อง")
    <Box sx={{ height: "100%", border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
      <Stack
        direction="row" alignItems="center" spacing={1}
        sx={{ px: 1.5, py: 0.9, minHeight: 40 }}
      >
        <Box sx={{ color: accent, display: "flex" }}>{icon}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", flex: 1, minWidth: 0, color: "#0f172a" }}>{title}</Typography>
        {right}
      </Stack>
      <Box sx={{ px: 1.5, pb: 1.5 }}>{children}</Box>
    </Box>
  );

const Row = ({ icon, children }) =>
  children ? (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ color: TEXT_SUB, display: "flex" }}>{icon}</Box>
      <Typography variant="body2" sx={{ minWidth: 0 }} noWrap>{children}</Typography>
    </Stack>
  ) : null;

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

  const load = useCallback(async () => {
    if (!dispatchId) return;
    setLoading(true); setError("");
    try { setD(await DispatchService.get(dispatchId)); }
    catch (err) { setError(err?.response?.data?.message || "โหลดใบมอบหมายไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [dispatchId]);

  useEffect(() => { load(); }, [load]);

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
    <Dialog open onClose={() => !busy && onClose?.()} fullWidth maxWidth="lg" fullScreen={isMobile}>
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
                  bgcolor: alpha(DISPATCH_ACCENT, 0.07),
                  border: "1px solid", borderColor: alpha(DISPATCH_ACCENT, 0.3),
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
                      bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" },
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

            {/* อนุมัติแล้ว — บอกว่าไปอยู่ในตารางงานแล้ว พร้อมทางลัดไปดู */}
            {d.eventId && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>อนุมัติและลงแผนงานแล้ว</Typography>
                <Typography variant="caption">
                  {d.reviewedBy?.name ? `ตรวจสอบโดย ${d.reviewedBy.name} · ` : ""}งานนี้อยู่ในตารางงานของฝ่ายช่างแล้ว
                </Typography>
              </Alert>
            )}

            {/* ✅ ที่แก้ (ผู้ใช้แจ้งว่า "ยังดูเยื้องๆ ไม่สวย"): เดิมเป็น 2 คอลัมน์ที่ต่างคนต่างเรียงการ์ด
                ลงมา (alignItems: start) — พอการ์ดใบแรกซ้าย/ขวาสูงไม่เท่ากัน การ์ดใบที่สองของสองฝั่ง
                ก็เริ่มที่ความสูงต่างกัน กลายเป็นขั้นบันไดเยื้องกันทั้งกล่อง
                ✅ เปลี่ยนเป็น grid แถวเดียวกันทั้งสองฝั่ง (alignItems: stretch) — การ์ดที่อยู่แถว
                เดียวกันสูงเท่ากันเสมอ ขอบล่างตรงกันทุกแถว
                ⚠️ Section จึงต้องสูงเต็มช่องที่ได้รับ (height: 100%) ไม่งั้นจะยืดแค่ช่อง ไม่ใช่ตัวการ์ด */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, alignItems: "stretch" }}>
              {/* ── ซ้าย: รายละเอียดงาน · หน้างาน ─────────────────────────
                  🐛 ที่แก้ (จัดวางไม่สวย): เดิมเป็นกล่องเดียวรวมทุกอย่าง (ที่อยู่/เบอร์/ผู้ขอ/รายละเอียด)
                  — ใบที่ไม่ได้กรอกที่อยู่หรือเบอร์ (เกิดบ่อยมาก) เหลือแค่บรรทัดเดียว แล้วคอลัมน์ซ้าย
                  ว่างโหวงเทียบกับขวา ดูเหมือนหน้าจอโหลดไม่ครบ
                  ✅ แยกเป็นการ์ดตามความหมาย และการ์ดที่ไม่มีเนื้อหาจะไม่ถูกเรนเดอร์เลย */}
                <Section
                  icon={<Assignment sx={{ fontSize: 17 }} />}
                  title="รายละเอียดงาน"
                  accent={DISPATCH_ACCENT}
                  empty={!d.detail && !d.contract?.groupId}
                >
                  {/* ✅ ใบที่ผูกกับสัญญาต้องบอกให้ชัดตั้งแต่บรรทัดแรก — คนอนุมัติตัดสินใจต่างกัน
                      สิ้นเชิงระหว่าง "งานครั้งเดียว" กับ "ครั้งถัดไปของสัญญาที่ลูกค้าจ่ายไปแล้ว"
                      (ครั้งที่จริงถูกกำหนดตอนอนุมัติ ดู POST /:id/approve ฝั่ง server) */}
                  {d.contract?.groupId && (
                    <Typography variant="caption" sx={{ display: "block", mb: 0.75, color: "#0e7490", fontWeight: 700 }}>
                      งานตามสัญญา · เลขที่ {d.contract.no || "—"}
                      {d.contract.visitCount ? " · ทั้งหมด " + d.contract.visitCount + " ครั้ง" : ""}
                    </Typography>
                  )}
                  {/* 🧹 "ระบบ" ถูกย้ายไปรวมกับประเภทงานในบรรทัดใต้หัวกล่องแล้ว ไม่ต้องซ้ำอีกที่นี่ */}
                  {d.detail && (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{d.detail}</Typography>
                  )}
                </Section>


                {/* ── หมายเหตุจากผู้แจ้ง ─────────────────────────────────
                    ✅ แยกกล่องออกมาต่างหาก ไม่รวมกับรายละเอียดงาน — เป็นคนละเรื่องกัน:
                    รายละเอียด = "ต้องทำอะไร" · หมายเหตุ = "ต้องรู้อะไรก่อนไป" (เวลาเข้าออก
                    การแลกบัตร ข้อจำกัดหน้างาน) ซึ่งถ้าพลาดคือไปถึงหน้างานแล้วเข้าไม่ได้ */}
                <Section
                  icon={<NoteAlt sx={{ fontSize: 17 }} />}
                  title="หมายเหตุจากผู้แจ้ง"
                  accent="#8b5cf6"
                  empty={!d.note}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{d.note}</Typography>
                </Section>

                {/* ── สิ่งที่ต้องทำ ─────────────────────────────────────── */}
                {d.checklist?.length > 0 && (
                  <Section
                    icon={<FactCheck sx={{ fontSize: 17 }} />}
                    title="สิ่งที่ต้องทำ"
                    accent="#0ea5e9"
                    right={(
                      <Typography variant="caption" sx={{ color: doneCount === d.checklist.length ? "#059669" : TEXT_SUB, fontWeight: 800 }}>
                        {doneCount}/{d.checklist.length}
                      </Typography>
                    )}
                  >
                    <Stack spacing={0.25}>
                      {d.checklist.map((c) => (
                        <Stack key={c._id} direction="row" alignItems="center" spacing={0.5}>
                          <Checkbox
                            size="small" checked={c.done} disabled={busy || isClosed || (!me && !canAssign)}
                            onChange={(e) => run(() => DispatchService.toggleChecklist(d._id, c._id, e.target.checked))}
                            sx={{ p: 0.4 }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ flex: 1, minWidth: 0, textDecoration: c.done ? "line-through" : "none", color: c.done ? TEXT_SUB : "inherit" }}
                          >
                            {c.item}
                          </Typography>
                          {c.done && c.doneByName && (
                            <Typography variant="caption" sx={{ color: TEXT_SUB, flexShrink: 0 }}>{c.doneByName}</Typography>
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </Section>
                )}

                {/* ── ของที่ต้องเตรียม ──────────────────────────────────── */}
                {d.parts?.length > 0 && (
                  <Section
                    icon={<Inventory2 sx={{ fontSize: 17 }} />}
                    title="ของที่ต้องเตรียมไป"
                    accent={DISPATCH_ACCENT}
                  >
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {d.parts.map((p) => (
                        <Chip
                          key={p._id} size="small" label={`${p.name} × ${p.qty}${p.unit ? ` ${p.unit}` : ""}`}
                          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600, bgcolor: alpha(DISPATCH_ACCENT, 0.1), color: "#b45309" }}
                        />
                      ))}
                    </Stack>
                  </Section>
                )}

                {/* ── ไฟล์แนบ ───────────────────────────────────────────── */}
                <Section
                  icon={<AttachFile sx={{ fontSize: 17 }} />}
                  title={`เอกสารประกอบ${d.attachments?.length ? ` (${d.attachments.length})` : ""}`}
                  accent="#059669"
                  right={(isRequester || canAssign) && !isClosed && (
                    <Button
                      size="small" startIcon={<AttachFile sx={{ fontSize: 15 }} />} disabled={busy}
                      onClick={() => fileRef.current?.click()}
                      sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", py: 0.15, px: 1, minHeight: 0, color: "#047857", bgcolor: alpha("#10b981", 0.12), "&:hover": { bgcolor: alpha("#10b981", 0.22) } }}
                    >
                      แนบไฟล์
                    </Button>
                  )}
                >
                {d.attachments?.length ? (
                  <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
                    {d.attachments.map((f) => (
                      <Box
                        key={f._id || f.fileUrl} onClick={() => setPreview(f)}
                        sx={{
                          flexShrink: 0, width: 66, height: 66, borderRadius: 1.5, overflow: "hidden", cursor: "pointer",
                          border: "1px solid", borderColor: BORDER_MAIN, display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: alpha("#0f172a", 0.03), "&:hover": { borderColor: DISPATCH_ACCENT },
                        }}
                      >
                        {isImageFile(f)
                          ? <Box component="img" src={f.fileUrl} alt={f.fileName} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <InsertDriveFile sx={{ fontSize: 26, color: TEXT_SUB }} />}
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>ไม่มีไฟล์แนบ</Typography>
                )}
                </Section>

                <Section
                  icon={<Person sx={{ fontSize: 17 }} />}
                  title={`ผู้รับงาน${d.assignees?.length ? ` (${d.assignees.length} คน)` : ""}`}
                  accent="#3b82f6"
                  right={
                  /* ⚠️ แก้ผู้รับงานได้เฉพาะใบที่ลงแผนงานแล้ว
                      🐛 เดิมกดได้ตั้งแต่ยังไม่ลงตาราง ทำให้ใบกลายเป็น "มอบหมายแล้ว" ทั้งที่ไม่มีวันเข้างาน
                      = ในสายตาช่างกับลูกค้าไม่ต่างจากยังไม่ได้มอบหมาย และไม่เหลือทางลงตารางอีกเลย
                      ✅ ทางเดียวคือกด "อนุมัติ + ลงตารางงาน" ด้านบน ซึ่งสร้างแผนงานให้พร้อมกัน */
                    canAssign && !isClosed && d.eventId && (
                      <Button
                        size="small" startIcon={<GroupAdd sx={{ fontSize: 15 }} />} onClick={() => setAssignOpen(true)} disabled={busy}
                        sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", py: 0.15, px: 1, minHeight: 0, color: "#1d4ed8", bgcolor: alpha("#3b82f6", 0.12), "&:hover": { bgcolor: alpha("#3b82f6", 0.22) } }}
                      >
                        {d.assignees?.length ? "แก้ผู้รับงาน" : "มอบหมายช่าง"}
                      </Button>
                    )
                  }
                >

                {!d.assignees?.length ? (
                  <Box sx={{ p: 2, borderRadius: 2, border: "1px dashed", borderColor: alpha(DISPATCH_ACCENT, 0.4), bgcolor: alpha(DISPATCH_ACCENT, 0.05), textAlign: "center" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#b45309" }}>ยังไม่ได้มอบหมายให้ใคร</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                      {canAssign
                        ? "กดปุ่ม \"อนุมัติ + ลงตารางงาน\" ด้านบน เพื่อเลือกวันเข้างานและผู้รับผิดชอบ"
                        : "รอแอดมินเลือกช่างและนัดวันให้"}
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={0.75}>
                    {d.assignees.map((a) => {
                      const isMe = String(a.userId) === myId;
                      return (
                        <Stack
                          key={a.userId} direction="row" alignItems="center" spacing={1}
                          sx={{
                            p: 1, borderRadius: 2, border: "1px solid",
                            borderColor: isMe ? alpha(DISPATCH_ACCENT, 0.45) : BORDER_MAIN,
                            bgcolor: isMe ? alpha(DISPATCH_ACCENT, 0.05) : "#fff",
                          }}
                        >
                          <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem", bgcolor: alpha(DISPATCH_ACCENT, 0.18), color: "#b45309", fontWeight: 800 }}>
                            {(a.name || "?").charAt(0)}
                          </Avatar>
                          <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: "0.82rem" }} noWrap>{a.name}</Typography>
                          {isMe && <Chip size="small" label="คุณ" sx={{ height: 17, fontSize: "0.6rem", fontWeight: 800 }} />}
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
                </Section>

                {/* ── หน้างาน ───────────────────────────────────────────────
                    ✅ อยู่คอลัมน์เดียวกับ "ผู้รับงาน" โดยตั้งใจ — ฝั่งนี้ตอบว่า *ใครไป ไปที่ไหน
                    ตอนนี้ถึงไหนแล้ว* ส่วนฝั่งซ้ายตอบว่า *งานอะไร ต้องรู้อะไร มีเอกสารอะไร*
                    ⚠️ และช่วยให้จำนวนการ์ดสองฝั่งใกล้เคียงกัน ไม่เทไปข้างเดียวจนดูเยื้อง */}
                <Section
                  icon={<GoogleMapsPin size={17} />}
                  title="หน้างาน"
                  accent="#0891b2"
                  // ⚠️ ชื่อโครงการถูกยกไปเป็นหัวข้อหลักของกล่องแล้ว การ์ดนี้จึงเหลือแค่ "ข้อมูลไปถึงหน้างาน"
                  // (ที่อยู่/ผู้ติดต่อ/แผนที่/กำหนดเสร็จ) — ถ้าไม่มีสักอย่างต้องไม่เรนเดอร์การ์ดหัวข้อเปล่าๆ ทิ้งไว้
                  // ⚠️ ถ้าผู้ใช้มีสิทธิ์เพิ่มพิกัด ต้องโชว์การ์ดเสมอ ไม่งั้นใบที่ยังไม่มีข้อมูลหน้างานเลย
                  // จะไม่มีที่ให้กดเพิ่มพิกัด (ซึ่งเป็นกรณีที่ต้องใช้ฟีเจอร์นี้มากที่สุด)
                  empty={!canEditMap && !d.customer?.address && !d.customer?.contactName && !d.customer?.contactTel && !d.customer?.mapUrl && !d.dueAt}
                >
                  {/* 🧹 "โครงการ" ถูกยกไปเป็นหัวข้อหลักของกล่องแล้ว ไม่ต้องซ้ำอีกที่นี่ */}
                  <Stack spacing={0.5}>
                    <Row icon={<LocationOn sx={{ fontSize: 15 }} />}>{d.customer?.address}</Row>
                    <Row icon={<Phone sx={{ fontSize: 15 }} />}>
                      {d.customer?.contactName ? `${d.customer.contactName}${d.customer.contactTel ? ` · ${d.customer.contactTel}` : ""}` : d.customer?.contactTel}
                    </Row>
                    {/* ⚠️ ใบใหม่ไม่มี dueAt แล้ว แต่ใบเก่าที่กรอกไว้ยังต้องแสดงได้ */}
                    <Row icon={<Schedule sx={{ fontSize: 15 }} />}>
                      {d.dueAt ? `กำหนดเสร็จ ${formatThai(moment(d.dueAt), "D MMM YYYY")}` : ""}
                    </Row>

                  </Stack>

                  {/* ── ตำแหน่งบนแผนที่ ────────────────────────────────────────
                      ✅ ปุ่มนำทาง — ช่างเปิดใบนี้จากมือถือตอนกำลังจะออกรถ ปุ่มเดียวจบ
                      ⚠️ rel="noopener noreferrer" จำเป็นเสมอกับ target="_blank" ที่ชี้โดเมนภายนอก */}
                  {mapDraft === null ? (
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
                      {d.customer?.mapUrl ? (
                        <Button
                          fullWidth size="small" component="a"
                          href={d.customer.mapUrl}
                          target="_blank" rel="noopener noreferrer"
                          startIcon={<GoogleMapsPin size={17} />}
                          endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                          sx={{
                            textTransform: "none", fontWeight: 700, borderRadius: 2, py: 0.8,
                            color: "#047857", bgcolor: alpha("#10b981", 0.1),
                            border: "1px solid", borderColor: alpha("#10b981", 0.3),
                            "&:hover": { bgcolor: alpha("#10b981", 0.18) },
                          }}
                        >
                          เปิดแผนที่นำทาง
                        </Button>
                      ) : (
                        /* ยังไม่มีพิกัด — ให้ปุ่มค้นหาแทน จะได้ไม่ต้องออกไปเปิดแอปเองแล้วพิมพ์ชื่อซ้ำ */
                        <Button
                          fullWidth size="small" component="a" target="_blank" rel="noopener noreferrer"
                          // ⚠️ ค้นด้วย "ชื่อโครงการ" อย่างเดียวตามที่ผู้ใช้สั่ง (ดู mapSearchUrl)
                          href={mapSearchUrl(d.customer?.site, d.customer?.company)}
                          startIcon={<GoogleMapsPin size={17} />}
                          endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                          sx={{
                            textTransform: "none", fontWeight: 700, borderRadius: 2, py: 0.8,
                            color: TEXT_SUB, border: "1px solid", borderColor: BORDER_MAIN,
                            "&:hover": { bgcolor: SURFACE_SUBTLE },
                          }}
                        >
                          ค้นหาตำแหน่งใน Google Maps
                        </Button>
                      )}
                      {canEditMap && !isClosed && (
                        <Tooltip title={d.customer?.mapUrl ? "แก้ลิงก์แผนที่" : "เพิ่มลิงก์แผนที่"}>
                          <IconButton
                            size="small" onClick={() => setMapDraft(d.customer?.mapUrl || "")}
                            sx={{ border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 2, color: TEXT_SUB, flexShrink: 0 }}
                          >
                            <GoogleMapsPin size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  ) : (
                    /* โหมดวางลิงก์ — ช่องเดียว + ปุ่มบันทึก ไม่ต้องเปิดกล่องซ้อนอีกชั้น */
                    <Box sx={{ mt: 1.25 }}>
                      <TextField
                        size="small" fullWidth autoFocus value={mapDraft}
                        onChange={(e) => setMapDraft(e.target.value)}
                        placeholder="วางลิงก์ที่แชร์จาก Google Maps"
                        helperText="กดค้นหาด้านบน → เจอตำแหน่งแล้วกด แชร์ → คัดลอกลิงก์ → วางที่นี่ · เว้นว่างเพื่อลบลิงก์"
                        FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
                      />
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end" sx={{ mt: 1 }}>
                        <Button
                          size="small" onClick={() => setMapDraft(null)} disabled={busy}
                          sx={{ textTransform: "none", color: TEXT_SUB }}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          size="small" variant="contained" disabled={busy}
                          onClick={async () => {
                            if (await run(() => DispatchService.setMapUrl(d._id, mapDraft.trim()))) setMapDraft(null);
                          }}
                          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none" }}
                        >
                          บันทึกตำแหน่ง
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Section>

                {/* ── สถานะงานจริง ──────────────────────────────────────────
                    🧹 มาแทนขั้นตอน "รับทราบ / เริ่มงาน / ปิดงาน" ของใบที่ถูกตัดออกตามที่ผู้ใช้สั่ง
                    ⚠️ ช่างไม่ต้องกดรับทราบที่นี่อีก — พออนุมัติแล้วงานเข้า "งานของฉัน" ให้ทันที
                    และช่างอัปเดตสถานะที่หน้าการดำเนินงานซึ่งเป็นที่เดียวที่ทำได้จริง (แนบเอกสาร/
                    เช็คอิน/ขอปิดงานอยู่ที่นั่นทั้งหมด) ตรงนี้จึงเป็นกระจกสะท้อนอย่างเดียว */}
                {d.job && (
                  <Section
                    icon={<EventAvailable sx={{ fontSize: 17 }} />}
                    title="สถานะงานในตารางงาน"
                    accent={jobStatusColor(d.job.status)}
                    right={(
                      <Chip
                        size="small" label={d.job.status}
                        sx={{
                          height: 22, fontSize: "0.7rem", fontWeight: 800,
                          bgcolor: jobStatusColor(d.job.status), color: "#fff",
                        }}
                      />
                    )}
                  >
                    {d.job.start && (
                      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1 }}>
                        เข้างาน {formatThai(moment(d.job.start), "D MMM YYYY")}
                        {d.job.responsiblePerson ? ` · ${d.job.responsiblePerson}` : ""}
                      </Typography>
                    )}
                    {canOpenOperation && (
                      <Button
                        fullWidth size="small" onClick={() => navigate(`/operation/${d.eventId}`)}
                        startIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                        sx={{
                          textTransform: "none", fontWeight: 700, borderRadius: 2,
                          color: TEXT_SUB, border: "1px solid", borderColor: BORDER_MAIN,
                          "&:hover": { bgcolor: SURFACE_SUBTLE },
                        }}
                      >
                        เปิดในหน้าการดำเนินงาน
                      </Button>
                    )}
                  </Section>
                )}
            </Box>

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
