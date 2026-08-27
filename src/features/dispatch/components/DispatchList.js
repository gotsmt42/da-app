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
  Box, Stack, Typography, Chip, IconButton, Tooltip, TextField, MenuItem,
  CircularProgress, Alert, AvatarGroup, Avatar, useMediaQuery,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Refresh, Search, Bolt, Schedule, Inbox, Storefront, Description, Place,
  CalendarMonth,
} from "@mui/icons-material";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import { formatThai } from "@/shared/utils/thaiDate";
import { DEPARTMENT, DEPARTMENT_LABEL, departmentOf } from "@/shared/utils/roles";
import ViewToggle, { initialViewMode } from "@/shared/ui/ViewToggle";
// ✅ ใช้ InfoLine ตัวเดียวกับหน้าการดำเนินงาน (Operation/PendingApprovalsPanel) — ผู้ใช้ขอให้หน้านี้
// "แสดงข้อมูลชัดเจนเหมือนหน้าการดำเนินงาน" การใช้คอมโพเนนต์กลางตัวเดียวกันรับประกันว่าหน้าตาเหมือน
// กันเป๊ะ ไม่ใช่แค่ก๊อปสไตล์ตามแล้วหลุดไม่ตรงกันภายหลัง (ดูคอมเมนต์ในตัวไฟล์ InfoLine.js เอง)
import InfoLine from "@/shared/ui/InfoLine";
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

const DispatchCard = ({ d, onOpen, myId }) => {
  const meta = statusBadge(d);
  const overdue = d.dueAt && moment(d.dueAt).isBefore(moment(), "day")
    && d.status !== "cancelled" && d.job?.status !== "ดำเนินการเสร็จสิ้น";
  const checkDone = (d.checklist || []).filter((c) => c.done).length;

  return (
    <Box
      onClick={() => onOpen(d)}
      sx={{
        position: "relative", overflow: "hidden",
        pl: 2.25, pr: 1.75, py: 1.75, borderRadius: 3, cursor: "pointer", bgcolor: "#fff",
        border: "1px solid", borderColor: d.priority === "urgent" ? alpha("#ef4444", 0.35) : BORDER_MAIN,
        boxShadow: "0 1px 2px rgba(15, 23, 42, .05)",
        transition: "transform .15s, box-shadow .15s, border-color .15s",
        "&:hover": {
          borderColor: DISPATCH_ACCENT,
          boxShadow: `0 10px 24px -10px ${alpha(DISPATCH_ACCENT, 0.45)}`,
          transform: "translateY(-2px)",
        },
      }}
    >
      {/* ✅ แถบสีซ้าย = สถานะจริงของงาน — กวาดตาดูทั้งลิสต์รู้ทันทีว่าใบไหนอยู่ขั้นไหน
          ไม่ต้องอ่านป้ายข้อความทีละใบ (เทียบ pattern เดียวกับแถบประเภทงานบนปฏิทิน) */}
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: meta.color }} />

      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 0.6 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* ✅ ป้าย "มาจากแผนกไหน + ใครส่ง" อยู่บรรทัดบนสุด ก่อนชื่องานด้วยซ้ำ —
              คนจัดคิวเปิดหน้านี้มาเพื่อไล่ตัดสินใจทีละใบ คำถามแรกคือ "ใครขอ" เพราะมันบอกว่า
              ต้องคุยกับใครถ้าข้อมูลไม่พอ เดิมชื่อคนขอถูกซ่อนอยู่ในกล่องรายละเอียดที่ต้องกดเปิดก่อน */}
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
            <Chip
              size="small"
              icon={<Storefront sx={{ fontSize: 11 }} />}
              label={requesterDept(d)}
              sx={{
                height: 18, fontSize: "0.62rem", fontWeight: 800,
                bgcolor: alpha("#8b5cf6", 0.12), color: "#7c3aed",
                "& .MuiChip-icon": { color: "inherit", ml: 0.4 },
                "& .MuiChip-label": { px: 0.6 },
              }}
            />
            <Typography variant="caption" sx={{ color: TEXT_SUB, minWidth: 0, fontWeight: 600 }} noWrap>
              {d.requestedBy?.name || "ไม่ทราบผู้ขอ"}
            </Typography>
          </Stack>
          {/* ✅ ที่แก้ (ผู้ใช้ขอ: "แสดงข้อมูลให้ชัดเจน เหมือนกับหน้าการดำเนินงาน เช่น แสดงชื่อโครงการ
              ประเภท ระบบ ... ไม่วางจุดมั่วๆ"): ชื่องาน (d.title) คือ "ประเภทงาน" อยู่แล้วในตัว
              (ตรงกับที่ฟอร์มแจ้งงานเรียกช่องนี้ว่า "ประเภทงาน") จึงคงไว้เป็นหัวข้อหลักไม่มี label กำกับ
              เหมือนที่หน้าการดำเนินงานทำกับ event.title — ส่วนบรรทัด company·site เดิมที่โชว์ลอยๆ
              ไม่มีป้ายกำกับ ถูกแทนด้วย InfoLine (ไอคอน+ป้าย+ค่า) ตัวเดียวกับหน้าการดำเนินงานเป๊ะ
              พร้อมเพิ่ม "ระบบ" ที่หายไปทั้งหมดจากการ์ดเดิม (มีอยู่ในข้อมูลจริงแต่ไม่เคยถูกแสดงที่ไหนเลย) */}
          <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", lineHeight: 1.35, color: "#0f172a" }} noWrap>
            {d.title}
          </Typography>
          <Stack spacing={0.3} sx={{ mt: 0.4 }}>
            <InfoLine icon="🏢" label="โครงการ">{companySite(d.customer?.company, d.customer?.site)}</InfoLine>
            {d.system && <InfoLine icon="💻" label="ระบบ">{d.system}</InfoLine>}
          </Stack>
        </Box>
        {/* ✅ ป้ายสถานะแบบมีจุดนำหน้า — อ่านง่ายกว่าตัวหนังสือสีล้วน โดยเฉพาะสถานะที่สีใกล้เคียงกัน */}
        <Stack
          direction="row" alignItems="center" spacing={0.5} flexShrink={0}
          sx={{
            height: 22, pl: 0.9, pr: 1, borderRadius: 999,
            bgcolor: alpha(meta.color, 0.12),
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: meta.color, whiteSpace: "nowrap" }}>
            {meta.label}
          </Typography>
        </Stack>
      </Stack>

      {/* ✅ รายละเอียดย่อ 2 บรรทัด — พอให้ตัดสินใจได้ว่าต้องเปิดอ่านเต็มไหม
          เดิมการ์ดมีแต่ชื่องานกับชื่อลูกค้า ต้องเปิดทีละใบถึงจะรู้ว่างานคืออะไรจริงๆ */}
      {(d.detail || d.note) && (
        <Typography
          variant="body2"
          sx={{
            color: TEXT_SUB, fontSize: "0.78rem", mb: 0.85, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {d.detail || d.note}
        </Typography>
      )}

      <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
        {/* เอกสารการค้าที่แนบมา — เป็นสัญญาณว่างานนี้ปิดการขายจริงแล้ว ต้องเห็นตั้งแต่ในการ์ด */}
        {(d.attachments || []).some((f) => DOC_TYPE_META[f.docType]?.commercial) && (
          <Tooltip title="มีใบเสนอราคา / ใบ PO แนบมาด้วย">
            <Chip
              size="small" icon={<Description sx={{ fontSize: 12 }} />} label="มีเอกสาร"
              sx={{ height: 20, fontSize: "0.64rem", fontWeight: 700, bgcolor: alpha("#059669", 0.12), color: "#047857", "& .MuiChip-icon": { color: "inherit", ml: 0.5 } }}
            />
          </Tooltip>
        )}
        {d.customer?.mapUrl && (
          <Tooltip title="มีลิงก์แผนที่นำทาง">
            <Chip
              size="small" icon={<Place sx={{ fontSize: 12 }} />} label="มีพิกัด"
              sx={{ height: 20, fontSize: "0.64rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.12), color: "#0e7490", "& .MuiChip-icon": { color: "inherit", ml: 0.5 } }}
            />
          </Tooltip>
        )}
        {d.priority === "urgent" && (
          <Chip size="small" icon={<Bolt sx={{ fontSize: 12 }} />} label="ด่วน" sx={{ height: 20, fontSize: "0.64rem", fontWeight: 800, bgcolor: alpha("#ef4444", 0.12), color: "#dc2626", "& .MuiChip-icon": { color: "inherit", ml: 0.5 } }} />
        )}
        {d.dueAt && (
          <Tooltip title={overdue ? "เลยกำหนดเสร็จแล้ว" : "กำหนดเสร็จ"}>
            <Chip
              size="small" icon={<Schedule sx={{ fontSize: 12 }} />}
              label={formatThai(moment(d.dueAt), "D MMM")}
              sx={{ height: 20, fontSize: "0.64rem", fontWeight: 700, bgcolor: alpha(overdue ? "#ef4444" : "#64748b", 0.1), color: overdue ? "#dc2626" : TEXT_SUB, "& .MuiChip-icon": { color: "inherit", ml: 0.5 } }}
            />
          </Tooltip>
        )}
        {d.checklist?.length > 0 && (
          <Typography variant="caption" sx={{ color: checkDone === d.checklist.length ? "#059669" : TEXT_SUB, fontWeight: 700 }}>
            ✓ {checkDone}/{d.checklist.length}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {/* ⚠️ โชว์ผู้รับงานเป็นรายคน ไม่ยุบเป็นตัวเลขเดียว — ต้องเห็นว่าใครถูกมอบหมายบ้าง
            🧹 เดิมสีกับ tooltip อ้าง "สถานะรายคน" (รอรับทราบ/รับทราบแล้ว/...) ซึ่งถูกตัดออกแล้ว
            ความคืบหน้าจริงอ่านจากสถานะงานในตารางงาน (ป้ายมุมขวาบนของการ์ด) ที่เดียว */}
        {d.assignees?.length > 0 && (
          <Tooltip title={d.assignees.map((a) => a.name).join(", ")}>
            <AvatarGroup max={4} sx={{ "& .MuiAvatar-root": { width: 24, height: 24, fontSize: "0.64rem", fontWeight: 800, border: "1.5px solid #fff" } }}>
              {d.assignees.map((a) => (
                <Avatar
                  key={a.userId}
                  sx={{
                    bgcolor: alpha(DISPATCH_ACCENT, 0.2), color: "#b45309",
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

      {/* ── ผลลัพธ์ที่ผู้แจ้งอยากรู้จริง: "ช่างจะไปวันไหน ใครไป" ───────────────
          🧹 มาแทนหลอดความคืบหน้า "เสร็จแล้ว 0 จาก N คน" ที่ถูกตัดออกตามที่ผู้ใช้แจ้งว่าดูไม่เข้าใจ
          — หลอดนั้นนับจากสถานะรายคน (รับทราบ/เริ่ม/เสร็จ) ซึ่งถูกยกเลิกไปแล้ว จึงค้างที่ 0 ตลอด
          และสื่อผิดว่างานไม่คืบหน้าทั้งที่ช่างอาจทำเสร็จไปแล้ว
          ✅ ยกเป็นแถบพื้นสีอ่อนแทนเส้นประ — เด่นขึ้นเป็นคำตอบสุดท้ายของการ์ด ไม่ใช่ท้ายบรรทัดจางๆ */}
      {d.job?.start && (
        <Stack
          direction="row" alignItems="center" spacing={0.75}
          sx={{
            mt: 1.1, px: 1, py: 0.6, borderRadius: 1.75,
            bgcolor: alpha(jobStatusColor(d.job.status), 0.07),
          }}
        >
          <CalendarMonth sx={{ fontSize: 14, color: jobStatusColor(d.job.status), flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600, minWidth: 0 }} noWrap>
            เข้างาน {formatThai(moment(d.job.start), "D MMM")}
            {d.job.responsiblePerson ? ` · ${d.job.responsiblePerson}` : ""}
          </Typography>
        </Stack>
      )}

      {/* ใบที่ถูกตีกลับ — เหตุผลต้องอยู่บนการ์ด ไม่ต้องเปิดเข้าไปอ่าน */}
      {d.status === "rejected" && d.rejectedReason && (
        <Typography
          variant="caption"
          sx={{
            display: "block", mt: 1.1, px: 1, py: 0.6, borderRadius: 1.75,
            bgcolor: alpha("#ef4444", 0.07), color: "#dc2626", fontWeight: 600,
          }}
        >
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
        <TableRow sx={{ bgcolor: alpha(DISPATCH_ACCENT, 0.06) }}>
          {["งาน", "ลูกค้า / หน้างาน", "จากแผนก", "ผู้ขอ", "สถานะ", "ผู้รับงาน", "แจ้งเมื่อ"].map((h) => (
            <TableCell
              key={h}
              sx={{
                fontWeight: 800, fontSize: "0.72rem", color: "#334155", textTransform: "uppercase",
                letterSpacing: ".04em", whiteSpace: "nowrap", py: 1.4,
                borderBottom: "2px solid", borderBottomColor: alpha(DISPATCH_ACCENT, 0.25),
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
                cursor: "pointer", "&:last-child td": { border: 0 },
                bgcolor: i % 2 === 1 ? alpha(SURFACE_SUBTLE, 0.6) : "transparent",
                "& td": { borderColor: BORDER_MAIN, py: 1.35 },
                transition: "background-color .12s",
                "&:hover": { bgcolor: alpha(DISPATCH_ACCENT, 0.07) },
              }}
            >
              <TableCell sx={{ maxWidth: 260, borderLeft: "4px solid", borderLeftColor: m.color }}>
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
                <Stack direction="row" spacing={0.4} sx={{ mt: 0.35 }}>
                  {(d.attachments || []).some((f) => DOC_TYPE_META[f.docType]?.commercial) && (
                    <Chip size="small" icon={<Description sx={{ fontSize: 10 }} />} label="เอกสาร" sx={{ height: 16, fontSize: "0.58rem", fontWeight: 700, bgcolor: alpha("#059669", 0.12), color: "#047857", "& .MuiChip-icon": { color: "inherit", ml: 0.3 }, "& .MuiChip-label": { px: 0.5 } }} />
                  )}
                  {d.customer?.mapUrl && (
                    <Chip size="small" icon={<Place sx={{ fontSize: 10 }} />} label="พิกัด" sx={{ height: 16, fontSize: "0.58rem", fontWeight: 700, bgcolor: alpha("#0891b2", 0.12), color: "#0e7490", "& .MuiChip-icon": { color: "inherit", ml: 0.3 }, "& .MuiChip-label": { px: 0.5 } }} />
                  )}
                </Stack>
              </TableCell>
              <TableCell sx={{ maxWidth: 220 }}>
                <Typography variant="body2" sx={{ fontSize: "0.78rem", fontWeight: 600 }} noWrap>{d.customer?.company}</Typography>
                {/* ⚠️ ถ้า company/site เป็นค่าเดียวกัน (ใบที่ไม่ได้กรอกบริษัท — server ใส่ค่า site
                    ลงไปแทนให้เพื่อไม่ให้ช่องว่าง) ไม่ต้องโชว์ซ้ำสองบรรทัดเหมือนกันเป๊ะ */}
                {d.customer?.site && d.customer.site !== d.customer?.company && (
                  <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>{d.customer.site}</Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  size="small" label={requesterDept(d)}
                  sx={{ height: 20, fontSize: "0.64rem", fontWeight: 700, bgcolor: alpha("#8b5cf6", 0.12), color: "#7c3aed" }}
                />
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box
                    sx={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      bgcolor: alpha("#8b5cf6", 0.16), color: "#6d28d9", fontSize: "0.62rem", fontWeight: 800,
                    }}
                  >
                    {(d.requestedBy?.name || "?").charAt(0)}
                  </Box>
                  <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: "#334155" }}>{d.requestedBy?.name || "-"}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Stack
                  direction="row" alignItems="center" spacing={0.6}
                  sx={{ height: 22, pl: 0.9, pr: 1, borderRadius: 999, bgcolor: alpha(m.color, 0.12), width: "fit-content" }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: m.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: m.color, whiteSpace: "nowrap" }}>{m.label}</Typography>
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

      {/* ✅ แถบเครื่องมือยกเป็นแผงลอยขอบมนพื้นอ่อน แทนที่จะปล่อยลอยบนพื้นหลังหน้าเปล่าๆ —
          ให้ความรู้สึกเป็น "ชุดควบคุมเดียวกัน" ทันสมัยขึ้น ไม่ใช่ input แยกชิ้นวางเรียงกัน */}
      <Stack
        direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap
        sx={{
          mb: 2, p: 1, borderRadius: 3,
          bgcolor: SURFACE_SUBTLE, border: "1px solid", borderColor: BORDER_MAIN,
        }}
      >
        <TextField
          size="small" placeholder="ค้นหางาน / ลูกค้า / เลขที่ใบ" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: TEXT_SUB, mr: 0.75 }} /> }}
          sx={{
            minWidth: 220, flex: "1 1 220px", maxWidth: 360,
            "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff" },
          }}
        />
        {/* 🧹 คิวคำขอไม่มีตัวกรองสถานะแล้ว — เหลือ 2 สถานะที่แสดงเป็น 2 คอลัมน์อยู่แล้วทั้งคู่
            ตัวกรองที่ทุกตัวเลือกให้ผลเหมือนเดิมคือปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้น */}
        {mode !== "board" && (
          <TextField
            select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff" } }}
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
            sx={{ bgcolor: "#fff", border: "1px solid", borderColor: BORDER_MAIN, "&:hover": { bgcolor: alpha(DISPATCH_ACCENT, 0.08), borderColor: DISPATCH_ACCENT } }}
          >
            <Refresh sx={{ fontSize: 19 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {filtered.length === 0 ? (
        <Box
          sx={{
            py: 7, textAlign: "center", borderRadius: 3,
            border: "1.5px dashed", borderColor: BORDER_MAIN, bgcolor: SURFACE_SUBTLE,
          }}
        >
          <Box
            sx={{
              width: 56, height: 56, borderRadius: "50%", mx: "auto", mb: 1.5,
              bgcolor: alpha(DISPATCH_ACCENT, 0.1), color: DISPATCH_ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Inbox sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontWeight: 800 }}>{search ? "ไม่พบรายการที่ค้นหา" : empty.title}</Typography>
          {!search && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{empty.sub}</Typography>}
        </Box>
      ) : viewMode === "table" ? (
        <DispatchTable rows={filtered} onOpen={(x) => setOpenId(x._id)} />
      ) : grouped ? (
        <Box sx={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: `repeat(${grouped.length}, minmax(240px, 1fr))`, gap: 2, alignItems: "start" }}>
          {grouped.map(([status, list]) => {
            const m = DISPATCH_STATUS_META[status];
            return (
              <Box key={status} sx={{ mb: isDesktop ? 0 : 2, borderRadius: 3, border: "1px solid", borderColor: BORDER_MAIN, bgcolor: SURFACE_SUBTLE, overflow: "hidden" }}>
                <Stack
                  direction="row" alignItems="center" spacing={0.9}
                  sx={{ px: 1.5, py: 1.15, bgcolor: alpha(m.color, 0.08), borderBottom: "1px solid", borderColor: alpha(m.color, 0.2) }}
                >
                  <Box sx={{ width: 4, height: 18, borderRadius: 3, bgcolor: m.color, flexShrink: 0 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", flex: 1, color: "#0f172a" }}>{m.label}</Typography>
                  <Chip size="small" label={list.length} sx={{ height: 21, minWidth: 28, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha(m.color, 0.18), color: m.color }} />
                </Stack>
                <Stack spacing={1.25} sx={{ p: 1.25 }}>
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
