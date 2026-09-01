/**
 * DispatchList — รายการใบมอบหมายงาน ใช้ร่วมกัน 3 มุมมอง
 *
 *   mode="board"     แอดมิน/ผู้จัดการ — คิวมอบหมายงานทั้งหมด แยกตามสถานะ
 *   mode="requester" ผู้ขอ (เซล) — เฉพาะใบที่ตัวเองส่ง ติดตามความคืบหน้า
 * 🧹 เคยมี mode="assignee" (แท็บ "งานที่ได้รับมอบหมาย" ของช่าง) — ตัดออกตามที่ผู้ใช้สั่ง
 * ใบที่อนุมัติแล้วถูกสร้างเป็นงานบนปฏิทินจริง ช่างจึงเห็นใน "งานตามตาราง" อยู่แล้ว
 * แท็บนั้นเป็นรายการเดียวกันซ้ำอีกที่ ในรูปแบบที่กดปิดงาน/แนบเอกสารไม่ได้
 *
 * ⚠️ เขียนเป็นตัวเดียวเพราะการ์ดกับตัวกรองเหมือนกันหมด ต่างแค่ "ดึงจาก endpoint ไหน" กับ
 * "ปุ่มอะไรโผล่" — ถ้าแยก 3 ไฟล์จะกลายเป็นของที่ต้องแก้พร้อมกันตลอดไปแล้ววันหนึ่งจะลืมแก้ตัวหนึ่ง
 * (บทเรียนเดียวกับ BillingDialog ที่เคยเกือบถูกก๊อปเป็น 2 ชุด)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, IconButton, Tooltip, TextField, MenuItem,
  CircularProgress, Alert, AvatarGroup, Avatar, useMediaQuery,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Refresh, Search, Bolt, Schedule, Inbox, Description, Place,
  CalendarMonth,
} from "@mui/icons-material";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import { formatThai } from "@/shared/utils/thaiDate";
import { DEPARTMENT, DEPARTMENT_LABEL, departmentOf } from "@/shared/utils/roles";
import ViewToggle, { initialViewMode } from "@/shared/ui/ViewToggle";
import DispatchService from "../services/DispatchService";
import DispatchDialog from "./DispatchDialog";
import {
  DISPATCH_STATUS_META, DISPATCH_ACCENT, TEXT_SUB, BORDER_MAIN, SURFACE_SUBTLE,
  DOC_TYPE_META,
  jobStatusColor,
} from "../dispatchMeta";

const EMPTY_TEXT = {
  board: { title: "ยังไม่มีคำขอมอบหมายงาน", sub: "เมื่อฝ่ายขายส่งงานเข้ามา จะมาโผล่ที่นี่" },
  requester: { title: "ยังไม่ได้แจ้งงานให้ช่าง", sub: "กดปุ่ม \"แจ้งงานใหม่\" ด้านบน เพื่อส่งรายละเอียดงานให้ฝ่ายช่างจัดคิว" },
};

/**
 * ป้ายสถานะที่ควรโชว์
 * ⚠️ อนุมัติแล้ว = อ่านจากแผนงานจริง (d.job.status) ไม่ใช่สถานะของใบเอง — ไม่งั้นใบจะค้างที่
 * "มอบหมายแล้ว" ตลอดไป ทั้งที่ช่างทำเสร็จและปิดงานไปแล้วในหน้าการดำเนินงาน
 */
/**
 * แผนกของ "ผู้แจ้ง" — ไม่ใช่ d.department ซึ่งหมายถึงแผนกที่ *รับ* งานใบนี้
 * 🐛 ที่แก้: เดิมอ่าน d.department ทำให้ใบที่เซลส่งมาขึ้นว่า "ฝ่ายบริการ" ทุกใบ
 *   (ค่าเริ่มต้นของฟิลด์นั้นคือ service เพราะเป็นแผนกปลายทาง)
 */
const requesterDept = (d) => {
  const dept = departmentOf(d?.requestedBy?.role) || DEPARTMENT.SERVICE;
  return DEPARTMENT_LABEL[dept] || DEPARTMENT_LABEL[DEPARTMENT.SERVICE];
};

// ✅ รวม company · site แบบไม่โชว์ "—" ซ้ำเวลาช่องใดช่องหนึ่งว่าง — เทียบ helper เดียวกับ companySite
// ใน OperationBoard/index.js (ก๊อปมาแทนที่จะ import ข้ามฟีเจอร์ เพราะเป็นฟังก์ชันบรรทัดเดียวไม่มี
// state ผูกอยู่ ในขณะที่ import ข้ามฟีเจอร์แบบนั้นจะดึงโค้ดก้อนใหญ่ของ Operation มาด้วยโดยไม่จำเป็น)
const companySite = (company, site) => {
  if (company && site && company !== site) return `${company} · ${site}`;
  return company || site || "ไม่ระบุโครงการ";
};

const statusBadge = (d) => {
  if (d.job?.status) return { label: d.job.status, color: jobStatusColor(d.job.status) };
  // ⚠️ fallback เสมอ — สถานะใหม่ที่เพิ่มฝั่ง server แต่ยังไม่ได้เพิ่มในตารางนี้ ต้องไม่ทำให้จอขาว
  const m = DISPATCH_STATUS_META[d.status];
  return m ? { label: m.label, color: m.color } : { label: d.status, color: TEXT_SUB };
};

/**
 * การ์ดใบแจ้งงาน
 *
 * ✅ ที่แก้ (ผู้ใช้แจ้งว่า "ดูรกตามาก"): เดิมการ์ดใบเดียวมี 8 องค์ประกอบและ 4 สีพร้อมกัน —
 * แถบสีซ้าย + ชิปแผนก + ชื่อผู้แจ้ง + ชื่องาน + บรรทัด "🏢 โครงการ" + "💻 ระบบ" (มีอิโมจิและ
 * ป้ายกำกับ) + รายละเอียด + ป้ายสถานะพื้นสี + avatar ลอย + แถบพื้นสีฟ้าท้ายการ์ด
 * ตาไม่รู้จะเกาะตรงไหนเพราะทุกอย่างเด่นเท่ากันหมด
 *
 * ✅ ลำดับสายตาใหม่ เหลือ 3 ชั้นชัดเจน:
 *   1. ชื่อโครงการ (ตัวหนา) — สิ่งที่คนใช้จำงานได้จริง
 *   2. ประเภทงาน · ระบบ (บรรทัดเดียว สีจาง) — เดิมแยก 2 บรรทัดพร้อมป้ายกำกับ+อิโมจิ
 *   3. ข้อมูลประกอบ (วันเข้างาน/ผู้รับงาน) สีจาง ท้ายการ์ด
 * สีเหลือทางเดียวคือ "สถานะ" (จุดเล็ก + ตัวอักษร) — ไม่ใช้พื้นสีทับอีก
 * ⚠️ แถบสีซ้ายยังอยู่ แต่บางลงเหลือ 3px — เป็นตัวช่วยกวาดสายตาทั้งลิสต์ที่ได้ผลจริงโดยไม่กินพื้นที่
 */
const DispatchCard = ({ d, onOpen, myId }) => {
  const meta = statusBadge(d);
  const overdue = d.dueAt && moment(d.dueAt).isBefore(moment(), "day")
    && d.status !== "cancelled" && d.job?.status !== "ดำเนินการเสร็จสิ้น";
  // ประเภทงาน · ระบบ — รวมเป็นบรรทัดเดียว ไม่ต้องมีป้ายกำกับ (บริบทชัดอยู่แล้ว)
  const typeLine = [d.title, d.system].filter(Boolean).join(" · ");

  return (
    <Box
      onClick={() => onOpen(d)}
      sx={{
        position: "relative", overflow: "hidden",
        pl: 2, pr: 1.75, py: 1.6, borderRadius: 2.5, cursor: "pointer", bgcolor: "#fff",
        border: "1px solid", borderColor: BORDER_MAIN,
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": {
          borderColor: alpha(meta.color, 0.5),
          boxShadow: "0 4px 12px -6px rgba(15, 23, 42, .18)",
        },
      }}
    >
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, bgcolor: meta.color }} />

      {/* ── บรรทัดบน: ชื่อโครงการ + สถานะ ───────────────────────────── */}
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.4, color: "#0f172a" }} noWrap>
            {companySite(d.customer?.company, d.customer?.site)}
          </Typography>
          {typeLine && (
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.15 }} noWrap>
              {typeLine}
            </Typography>
          )}
        </Box>
        {/* สถานะ = จุด + ตัวอักษร ไม่มีพื้นสี — อ่านออกเท่าเดิมแต่เบากว่ามาก */}
        <Stack direction="row" alignItems="center" spacing={0.6} flexShrink={0} sx={{ mt: 0.2 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: meta.color, whiteSpace: "nowrap" }}>
            {meta.label}
          </Typography>
        </Stack>
      </Stack>

      {/* ── รายละเอียดย่อ — บรรทัดเดียวพอให้ตัดสินใจว่าจะเปิดอ่านไหม ──── */}
      {(d.detail || d.note) && (
        <Typography
          variant="body2"
          sx={{
            color: TEXT_SUB, fontSize: "0.78rem", mt: 0.6, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {d.detail || d.note}
        </Typography>
      )}

      {/* ── ท้ายการ์ด: ข้อมูลประกอบทั้งหมดรวมบรรทัดเดียว สีจาง ────────── */}
      <Stack
        direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap
        sx={{ mt: 1, pt: 1, borderTop: "1px solid", borderColor: alpha(BORDER_MAIN, 0.9) }}
      >
        {d.priority === "urgent" && (
          <Stack direction="row" alignItems="center" spacing={0.3}>
            <Bolt sx={{ fontSize: 13, color: "#dc2626" }} />
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#dc2626" }}>ด่วน</Typography>
          </Stack>
        )}
        {d.job?.start ? (
          <Stack direction="row" alignItems="center" spacing={0.4} sx={{ minWidth: 0 }}>
            <CalendarMonth sx={{ fontSize: 13, color: TEXT_SUB, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }} noWrap>
              {formatThai(moment(d.job.start), "D MMM")}
              {d.job.responsiblePerson ? ` · ${d.job.responsiblePerson}` : ""}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: TEXT_SUB, fontStyle: "italic" }}>
            ยังไม่ได้ลงวันเข้างาน
          </Typography>
        )}
        {d.dueAt && (
          <Stack direction="row" alignItems="center" spacing={0.3}>
            <Schedule sx={{ fontSize: 13, color: overdue ? "#dc2626" : TEXT_SUB }} />
            <Typography variant="caption" sx={{ color: overdue ? "#dc2626" : TEXT_SUB, fontWeight: overdue ? 700 : 500 }}>
              {formatThai(moment(d.dueAt), "D MMM")}
            </Typography>
          </Stack>
        )}
        <Box sx={{ flex: 1 }} />
        {/* ไอคอนบอกว่ามีเอกสาร/พิกัด — ไม่ต้องเป็นชิปมีพื้นสีอีกต่อไป */}
        {(d.attachments || []).some((x) => DOC_TYPE_META[x.docType]?.commercial) && (
          <Tooltip title="มีใบเสนอราคา / ใบ PO แนบมาด้วย">
            <Description sx={{ fontSize: 14, color: TEXT_SUB }} />
          </Tooltip>
        )}
        {d.customer?.mapUrl && (
          <Tooltip title="มีลิงก์แผนที่นำทาง">
            <Place sx={{ fontSize: 14, color: TEXT_SUB }} />
          </Tooltip>
        )}
        {d.assignees?.length > 0 && (
          <Tooltip title={d.assignees.map((a) => a.name).join(", ")}>
            <AvatarGroup
              max={3}
              sx={{ "& .MuiAvatar-root": { width: 20, height: 20, fontSize: "0.58rem", fontWeight: 700, border: "1.5px solid #fff" } }}
            >
              {d.assignees.map((a) => (
                <Avatar
                  key={a.userId}
                  sx={{
                    bgcolor: alpha("#64748b", 0.16), color: "#475569",
                    outline: String(a.userId) === myId ? `2px solid ${DISPATCH_ACCENT}` : "none",
                  }}
                >
                  {(a.name || "?").charAt(0)}
                </Avatar>
              ))}
            </AvatarGroup>
          </Tooltip>
        )}
      </Stack>

      {/* ใบที่ถูกตีกลับ — เหตุผลต้องอยู่บนการ์ด ไม่ต้องเปิดเข้าไปอ่าน */}
      {d.status === "rejected" && d.rejectedReason && (
        <Typography variant="caption" sx={{ display: "block", mt: 0.85, color: "#dc2626", fontWeight: 600 }}>
          ต้องแก้ไข: {d.rejectedReason}
        </Typography>
      )}
    </Box>
  );
};

/**
 * มุมมองตาราง — รูปแบบมาตรฐานของหน้าจัดการงานบนเว็บ
 * ⚠️ ห่อด้วย overflowX: auto เสมอ — ตารางกว้างกว่าจอแคบแน่นอน ถ้าไม่ห่อ ทั้งหน้าจะเลื่อนแนวนอน
 * ตามไปด้วย (ซึ่งทำให้เมนู/หัวข้อเลื่อนหายไปข้างๆ ด้วย)
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "ตารางด้วย ให้สวยงาม"): เดิมแถวเตี้ยแน่นแบบตารางแอดมินทั่วไป หัวตารางจาง
 * แทบไม่ต่างจากพื้นหลัง และไม่มีจุดเกาะสายตาเลยว่าแต่ละแถวอยู่ "สถานะไหน" ต้องกวาดตาไปอ่านคอลัมน์
 * สถานะทีละแถว ทั้งที่มุมมองการ์ดข้างๆ กันมีแถบสีซ้ายบอกอยู่แล้ว — เพิ่มแถบสีสถานะซ้ายแถวเสมอ
 * (ไม่ใช่แค่ตอนด่วน) + แถวสูงขึ้นหายใจได้ + สลับสีพื้นแถวคู่/คี่บางๆ + หัวตารางเข้มขึ้นมีเส้นล่างสีเด่น
 * + ผู้ขอมีวงกลมอักษรย่อ ให้ตารางเข้าชุดกับมุมมองการ์ดที่ปรับไปแล้ว ไม่ใช่คนละภาษาออกแบบ */
const DispatchTable = ({ rows, onOpen }) => (
  <TableContainer
    component={Paper} variant="outlined"
    sx={{ borderRadius: 3, overflowX: "auto", borderColor: BORDER_MAIN, boxShadow: "0 1px 2px rgba(15, 23, 42, .05)" }}
  >
    <Table size="small" sx={{ minWidth: 820 }}>
      <TableHead>
        {/* ✅ หัวตารางเป็นเทาเรียบ — เดิมพื้นส้มอ่อน + เส้นใต้ส้มหนา 2px ดึงสายตาไปจากข้อมูลจริง */}
        <TableRow sx={{ bgcolor: SURFACE_SUBTLE }}>
          {["งาน", "ลูกค้า / หน้างาน", "จากแผนก", "ผู้ขอ", "สถานะ", "ผู้รับงาน", "แจ้งเมื่อ"].map((h) => (
            <TableCell
              key={h}
              sx={{
                fontWeight: 800, fontSize: "0.72rem", color: "#334155", textTransform: "uppercase",
                letterSpacing: ".04em", whiteSpace: "nowrap", py: 1.25,
                borderBottom: "1px solid", borderBottomColor: BORDER_MAIN,
              }}
            >
              {h}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((d, i) => {
          const m = statusBadge(d);
          return (
            <TableRow
              key={d._id} hover onClick={() => onOpen(d)}
              sx={{
                // ✅ ตัดการสลับสีพื้นแถวคู่/คี่ออก — มีเส้นคั่นแถวอยู่แล้ว การมีทั้งสองอย่างทำให้ลายตา
                cursor: "pointer", "&:last-child td": { border: 0 },
                "& td": { borderColor: BORDER_MAIN, py: 1.3 },
                transition: "background-color .12s",
                "&:hover": { bgcolor: SURFACE_SUBTLE },
              }}
            >
              <TableCell sx={{ maxWidth: 260, borderLeft: "3px solid", borderLeftColor: m.color }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {d.priority === "urgent" && <Bolt sx={{ fontSize: 14, color: "#dc2626", flexShrink: 0 }} />}
                  <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", minWidth: 0, color: "#0f172a" }} noWrap>{d.title}</Typography>
                </Stack>
                {/* ✅ ระบบ — เทียบ pattern "ประเภทงาน · ระบบ" ของตาราง OperationBoard เป๊ะ (บรรทัดรอง
                    สีจางใต้ชื่อประเภทงาน) เดิมคอลัมน์นี้ไม่มีข้อมูล "ระบบ" เลยทั้งที่มีอยู่ในฐานข้อมูล */}
                {d.system && (
                  <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.1 }} noWrap>
                    {d.system}
                  </Typography>
                )}
                {/* ✅ เดิมเป็นชิปพื้นสีเขียว/ฟ้า 2 ใบ — เหลือไอคอนเทาเล็กๆ อ่านได้เท่าเดิมแต่ไม่แย่งสายตา */}
                {((d.attachments || []).some((x) => DOC_TYPE_META[x.docType]?.commercial) || d.customer?.mapUrl) && (
                  <Stack direction="row" spacing={0.6} sx={{ mt: 0.3 }}>
                    {(d.attachments || []).some((x) => DOC_TYPE_META[x.docType]?.commercial) && (
                      <Tooltip title="มีใบเสนอราคา / ใบ PO"><Description sx={{ fontSize: 13, color: TEXT_SUB }} /></Tooltip>
                    )}
                    {d.customer?.mapUrl && (
                      <Tooltip title="มีลิงก์แผนที่"><Place sx={{ fontSize: 13, color: TEXT_SUB }} /></Tooltip>
                    )}
                  </Stack>
                )}
              </TableCell>
              <TableCell sx={{ maxWidth: 220 }}>
                <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>{d.customer?.company}</Typography>
                {/* ⚠️ ถ้า company/site เป็นค่าเดียวกัน (ใบที่ไม่ได้กรอกบริษัท — server ใส่ค่า site
                    ลงไปแทนให้เพื่อไม่ให้ช่องว่าง) ไม่ต้องโชว์ซ้ำสองบรรทัดเหมือนกันเป๊ะ */}
                {d.customer?.site && d.customer.site !== d.customer?.company && (
                  <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>{d.customer.site}</Typography>
                )}
              </TableCell>
              {/* ✅ เดิมเป็นชิปม่วง + วงกลมอักษรย่อสีม่วง = สีม่วง 2 จุดต่อแถว ทั้งที่เป็นข้อมูลรอง
                  เหลือตัวหนังสือเรียบๆ อ่านง่ายกว่าและไม่แข่งกับสีสถานะซึ่งเป็นข้อมูลที่ต้องอ่านจริง */}
              <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.74rem", color: TEXT_SUB }}>
                {requesterDept(d)}
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.76rem", color: "#334155" }}>
                {d.requestedBy?.name || "-"}
              </TableCell>
              <TableCell>
                {/* จุด + ตัวอักษร ไม่มีพื้นสี — แบบเดียวกับการ์ด */}
                <Stack direction="row" alignItems="center" spacing={0.6}>
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: m.color, whiteSpace: "nowrap" }}>{m.label}</Typography>
                </Stack>
              </TableCell>
              <TableCell sx={{ fontSize: "0.76rem", color: TEXT_SUB, maxWidth: 160 }}>
                {/* ⚠️ ถ้าไม่มี assignees ให้ใช้ผู้รับผิดชอบจากแผนงานจริง — ตอนอนุมัติเลือกผู้รับผิดชอบได้
                    โดยไม่ต้องระบุ assignee ผู้แจ้งจึงอาจเห็น "ยังไม่มอบหมาย" ทั้งที่ช่างกำลังทำอยู่ */}
                <Typography
                  variant="caption" noWrap sx={{ display: "block", fontWeight: 600 }}
                  fontStyle={d.assignees?.length || d.job?.responsiblePerson ? "normal" : "italic"}
                >
                  {d.assignees?.length
                    ? d.assignees.map((a) => a.name).join(", ")
                    : d.job?.responsiblePerson || "— ยังไม่มอบหมาย"}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 600, whiteSpace: "nowrap" }}>
                {formatThai(moment(d.requestedAt), "D MMM")}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

/** คิวคำขอมีแค่ 2 สถานะนี้ — ที่เหลือเป็นหน้าที่ของ "หน้าการดำเนินงาน" */
const QUEUE_STATUSES = ["requested", "assigned"];

export default function DispatchList({ mode = "board", myId = "" }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  // ✅ เปิดใบตาม /dispatch/<id> หรือ /sales/<id> ที่มาจากแจ้งเตือน
  // ⚠️ อ่านจาก useParams ไม่ใช่ prop — คอมโพเนนต์นี้ถูกใช้ทั้งสองหน้า และทั้งคู่มี :id? เหมือนกัน
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // หน้าไหนอยู่ — /dispatch (คิวของหัวหน้า) หรือ /sales (ใบที่ตัวเองแจ้ง)
  const basePath = location.pathname.startsWith("/sales") ? "/sales" : "/dispatch";
  const [openId, setOpenId] = useState(routeId || null);
  const [viewMode, setViewMode] = useState(() => initialViewMode("dispatchList.viewMode"));

  // ⚠️ จำมุมมองที่เลือกไว้ข้ามการเปิดหน้า — แต่ละคนถนัดคนละแบบและมักใช้แบบเดิมตลอด
  useEffect(() => {
    try { localStorage.setItem("dispatchList.viewMode", viewMode); } catch { /* storage ปิดอยู่ */ }
  }, [viewMode]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = statusFilter === "all" ? { include: "all" } : {};
      setRows(await DispatchService.list(params));
    } catch (err) {
      setError(err?.response?.data?.message || "โหลดใบมอบหมายไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ⚠️ deps มี routeId — กดแจ้งเตือนใบอื่นตอนที่เปิดหน้านี้ค้างอยู่ จะเปลี่ยนแค่ param
  // โดยไม่ remount ถ้าไม่ฟังตรงนี้ กล่องจะไม่เปลี่ยนไปใบใหม่
  useEffect(() => { if (routeId) setOpenId(routeId); }, [routeId]);

  const patch = useCallback((updated) => {
    setRows((prev) => prev.map((r) => (String(r._id) === String(updated._id) ? updated : r)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((d) => {
      // ⚠️ คิวคำขอตัดเหลือ 2 สถานะตั้งแต่ชั้นนี้ ไม่ใช่ตอนจัดกลุ่ม — ไม่งั้นมุมมองตาราง (ซึ่งอ่านจาก
      // filtered ตรงๆ) จะโชว์งานที่กำลังทำ/เสร็จแล้วด้วย กลายเป็นสลับมุมมองแล้วเห็นคนละชุด
      if (mode === "board" && !QUEUE_STATUSES.includes(d.status)) return false;
      // ⚠️ "ยังไม่เสร็จ" ตัดสินจากสถานะงานจริง ไม่ใช่สถานะใบ (ใบไม่มีสถานะ done แล้ว)
      if (statusFilter === "open" && (d.status === "cancelled" || d.job?.status === "ดำเนินการเสร็จสิ้น")) return false;
      if (["requested", "assigned", "rejected"].includes(statusFilter) && d.status !== statusFilter) return false;
      if (!q) return true;
      return [d.title, d.dispatchNo, d.customer?.company, d.customer?.site]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, mode]);

  /**
   * คิว "คำขอลงงาน" มีแค่ 2 สถานะ: รอมอบหมาย → มอบหมายแล้ว
   *
   * 🧹 เดิมมี "กำลังทำ" กับ "เสร็จแล้ว" ต่อท้ายด้วย — ตัดออกตามที่ผู้ใช้สั่ง เพราะงานที่มอบหมาย
   * ไปแล้วมี "หน้าการดำเนินงาน" เป็นเจ้าของเรื่องอยู่แล้ว (ที่นั่นมีตัวกรอง/สถานะ/ไฟล์แนบครบกว่า)
   * การโชว์ซ้ำที่นี่ทำให้คิวยาวขึ้นด้วยของที่ไม่ต้องตัดสินใจอะไรแล้ว และมี 2 ที่ที่ต้องดูแลตลอดไป
   */
  const grouped = useMemo(() => {
    if (mode !== "board") return null;
    const map = { requested: [], assigned: [] };
    filtered.forEach((d) => { if (map[d.status]) map[d.status].push(d); });
    return QUEUE_STATUSES.map((st) => [st, map[st]]);
  }, [filtered, mode]);

  if (loading && !rows.length) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }

  const empty = EMPTY_TEXT[mode];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {/* ✅ ที่แก้ (รกตา): เดิมแถบเครื่องมือถูกครอบด้วยกล่องพื้นเทา+ขอบอีกชั้น กลายเป็น "กล่องซ้อน
          กล่อง" (กล่องเครื่องมือ → ช่องค้นหาที่มีขอบของตัวเอง) และซ้อนกับแถบแท็บ/แถบคำอธิบาย
          ด้านบนรวมเป็น 3 ชั้นก่อนถึงเนื้อหาจริง — ปล่อยให้ลอยบนพื้นหน้าเลย เหลือชั้นเดียว */}
      {/* ⚠️ จอมือถือ: ช่องค้นหากินเต็มแถวบนสุด แล้วตัวกรอง/สลับมุมมอง/รีเฟรช อยู่แถวเดียวกันด้านล่าง
          — เดิมทุกชิ้นแย่งพื้นที่แถวเดียวกันแล้วตกบรรทัดทีละชิ้น กลายเป็น 3 แถวเรียงเหลื่อมกัน */}
      <Box
        sx={{
          mb: 2, display: "flex", gap: 1, alignItems: "center",
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <TextField
          size="small" placeholder="ค้นหางาน / ลูกค้า / เลขที่ใบ" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: TEXT_SUB, mr: 0.75 }} /> }}
          sx={{
            width: { xs: "100%", sm: "auto" },
            minWidth: { sm: 220 }, flex: { sm: "1 1 220px" }, maxWidth: { sm: 360 },
            "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff" },
          }}
        />
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, flex: { sm: 1 } }}>
        {/* 🧹 คิวคำขอไม่มีตัวกรองสถานะแล้ว — เหลือ 2 สถานะที่แสดงเป็น 2 คอลัมน์อยู่แล้วทั้งคู่
            ตัวกรองที่ทุกตัวเลือกให้ผลเหมือนเดิมคือปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้น */}
          {mode !== "board" && (
            <TextField
              select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 150, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff" } }}
            >
              <MenuItem value="open">ที่ยังไม่เสร็จ</MenuItem>
              <MenuItem value="all">ทั้งหมด</MenuItem>
            </TextField>
          )}
          <Box sx={{ flex: 1 }} />
          <ViewToggle value={viewMode} onChange={setViewMode} accent={DISPATCH_ACCENT} />
          <Tooltip title="โหลดข้อมูลใหม่">
            <IconButton
              size="small" onClick={load}
              sx={{ color: TEXT_SUB, "&:hover": { bgcolor: SURFACE_SUBTLE } }}
            >
              <Refresh sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ✅ หน้าว่างแบบเรียบ — เดิมมีทั้งเส้นประ พื้นเทา และวงกลมสีส้ม สำหรับ "ไม่มีอะไรเลย" */}
      {filtered.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Inbox sx={{ fontSize: 36, color: alpha(TEXT_SUB, 0.5), mb: 1 }} />
          <Typography sx={{ fontWeight: 700, color: "#334155" }}>
            {search ? "ไม่พบรายการที่ค้นหา" : empty.title}
          </Typography>
          {!search && (
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.5 }}>{empty.sub}</Typography>
          )}
        </Box>
      ) : viewMode === "table" ? (
        <DispatchTable rows={filtered} onOpen={(x) => setOpenId(x._id)} />
      ) : grouped ? (
        <Box sx={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: `repeat(${grouped.length}, minmax(240px, 1fr))`, gap: 2, alignItems: "start" }}>
          {grouped.map(([status, list]) => {
            const m = DISPATCH_STATUS_META[status];
            // ✅ ที่แก้ (รกตา): เดิมคอลัมน์เป็นกล่องพื้นเทามีขอบ + หัวคอลัมน์พื้นสีอีกชั้น + ชิปตัวเลข
            // พื้นสีอีกใบ = สีเดียวกัน 3 ระดับซ้อนกันเหนือการ์ดที่มีแถบสีของตัวเองอยู่แล้ว
            // เหลือเป็นหัวข้อตัวหนังสือ + จำนวน วางบนพื้นหน้าเปล่าๆ ให้การ์ดเป็นพระเอกแทน
            return (
              <Box key={status} sx={{ mb: isDesktop ? 0 : 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 0.25, mb: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: m.color, flexShrink: 0 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a" }}>{m.label}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.78rem", color: TEXT_SUB }}>{list.length}</Typography>
                </Stack>
                <Stack spacing={1.25}>
                  {list.map((d) => <DispatchCard key={d._id} d={d} onOpen={(x) => setOpenId(x._id)} myId={myId} />)}
                  {list.length === 0 && (
                    <Typography variant="caption" sx={{ color: TEXT_SUB, textAlign: "center", py: 2 }}>ไม่มีรายการ</Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            // ⚠️ auto-fill + minmax แทนจำนวนคอลัมน์ตายตัว — การ์ดกว้างพอเสมอไม่ว่าจอกว้างแค่ไหน
            // และไม่เหลือการ์ดใบเดียวลอยอยู่ซ้ายมือบนจอกว้าง
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: 1.75,
          }}
        >
          {filtered.map((d) => <DispatchCard key={d._id} d={d} onOpen={(x) => setOpenId(x._id)} myId={myId} />)}
        </Box>
      )}

      <DispatchDialog
        dispatchId={openId}
        onClose={() => {
          setOpenId(null);
          // ⚠️ ต้องล้าง :id ออกจาก URL ด้วย ไม่งั้นปิดกล่องแล้วกดรีเฟรช/กดย้อนกลับ มันจะเด้งเปิดซ้ำ
          if (routeId) navigate(basePath, { replace: true });
        }}
        onSaved={patch}
      />
    </Box>
  );
}
