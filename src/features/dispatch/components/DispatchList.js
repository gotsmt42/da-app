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
import useRealtime from "@/shared/realtime/useRealtime";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, IconButton, Tooltip, TextField,
  Alert, useMediaQuery, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import PageLoader from "@/shared/ui/PageLoader";
import { alpha } from "@mui/material/styles";
import {
  Refresh, Search, Bolt, Schedule, Inbox, Description, Place,
  CalendarMonth, HourglassTop, EventAvailable, TaskAlt, Close,
} from "@mui/icons-material";
import { PersonChip, UnassignedChip } from "@/shared/ui/PersonChip";
import { QueueToolbar, SectionHead, AllClear, ActionCard, PeopleField, QueueRow, RowGroup, SoftPill, AMBER, BLUE } from "./QueueKit";


import { useNavigate, useParams, useLocation } from "react-router-dom";
import { formatThai } from "@/shared/utils/thaiDate";
import { DEPARTMENT, DEPARTMENT_LABEL, departmentOf } from "@/shared/utils/roles";
import ViewToggle, { initialViewMode } from "@/shared/ui/ViewToggle";
import SelectField from "@/shared/ui/SelectField";
import DispatchService from "../services/DispatchService";
import DispatchDialog from "./DispatchDialog";
import {
  DISPATCH_STATUS_META, DISPATCH_ACCENT, TEXT_SUB, BORDER_MAIN, SURFACE_SUBTLE,
  DOC_TYPE_META,
  jobStatusColor,
} from "../dispatchMeta";

const FAINT_DOT = "#94a3b8";

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

/** ป้ายสถานะแบบพื้นสีอ่อน + จุด — ชุดเดียวกับหน้าการดำเนินงาน */
const StatusPill = ({ meta }) => (
  <Box component="span" sx={{
    display: "inline-flex", alignItems: "center", gap: 0.6, flexShrink: 0,
    px: 1, py: 0.3, borderRadius: 99, bgcolor: alpha(meta.color, 0.1),
    border: "1px solid", borderColor: alpha(meta.color, 0.25),
  }}>
    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: meta.color }} />
    <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, color: meta.color, whiteSpace: "nowrap", lineHeight: 1.4 }}>
      {meta.label}
    </Typography>
  </Box>
);

const UrgentPill = () => (
  <Box component="span" sx={{
    display: "inline-flex", alignItems: "center", gap: 0.25, flexShrink: 0,
    px: 0.75, py: 0.2, borderRadius: 99, bgcolor: "#fef2f2", border: "1px solid #fecaca",
  }}>
    <Bolt sx={{ fontSize: 13, color: "#dc2626" }} />
    <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#dc2626", lineHeight: 1.4 }}>ด่วน</Typography>
  </Box>
);

/** ผู้รับผิดชอบที่ควรโชว์ — ใบที่อนุมัติแล้วอ่านจากแผนงานจริงก่อน (ตรงกับภาพรวมงาน/การดำเนินงาน) */
const responsibleOf = (d) => d.job?.responsiblePerson || d.assignees?.[0]?.name || "";

/**
 * การ์ดใบแจ้งงาน
 *
 * ✅ ปรับใหม่ (ผู้ใช้: "ดูล้าสมัยมาก"): ลำดับสายตา 4 ชั้น
 *   1. แถบบน — เลขที่ใบ · ด่วน · สถานะ (ป้ายพื้นอ่อน)
 *   2. ชื่อโครงการตัวหนา + ประเภทงาน · ระบบ
 *   3. "คน" — ผู้แจ้ง และผู้รับผิดชอบ เป็นชิปอักษรย่อ (ชุดเดียวกับหน้าการดำเนินงาน)
 *   4. แถบล่างพื้นเทาอ่อน — วันเข้างาน / กำหนดเสร็จ / แจ้งเมื่อ / ไอคอนเอกสาร
 */
const DispatchCard = ({ d, onOpen, myId }) => {
  const meta = statusBadge(d);
  const overdue = d.dueAt && moment(d.dueAt).isBefore(moment(), "day")
    && d.status !== "cancelled" && d.job?.status !== "ดำเนินการเสร็จสิ้น";
  const typeLine = [d.title, d.system].filter(Boolean).join(" · ");
  const responsible = responsibleOf(d);
  const team = (d.assignees || []).map((a) => a.name).filter((n) => n && n !== responsible);
  const hasDocs = (d.attachments || []).some((x) => DOC_TYPE_META[x.docType]?.commercial);
  const mine = (d.assignees || []).some((a) => String(a.userId) === myId);

  return (
    <Box
      onClick={() => onOpen(d)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(d); } }}
      sx={{
        position: "relative", overflow: "hidden", cursor: "pointer", bgcolor: "#fff",
        borderRadius: 3, border: "1px solid", borderColor: mine ? alpha(DISPATCH_ACCENT, 0.45) : BORDER_MAIN,
        boxShadow: "0 1px 2px rgba(15, 23, 42, .05)",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        "&:hover": { borderColor: alpha(meta.color, 0.55), boxShadow: `0 8px 22px -12px ${alpha(meta.color, 0.55)}`, transform: "translateY(-1px)" },
        "&:focus-visible": { outline: `2px solid ${meta.color}`, outlineOffset: 2 },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
      }}
    >
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: meta.color }} />

      <Box sx={{ pl: 2, pr: 1.75, pt: 1.4, pb: 1.25 }}>
        {/* ── แถบบน: เลขที่ใบ · ด่วน · สถานะ ── */}
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: TEXT_SUB, fontVariantNumeric: "tabular-nums", letterSpacing: ".02em" }} noWrap>
            {d.dispatchNo || "ใบแจ้งงาน"}
          </Typography>
          {d.priority === "urgent" && <UrgentPill />}
          <Box sx={{ flex: 1 }} />
          <StatusPill meta={meta} />
        </Stack>

        {/* ── ชื่อโครงการ + ประเภทงาน ── */}
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.35, color: "#0f172a" }} noWrap>
          {companySite(d.customer?.company, d.customer?.site)}
        </Typography>
        {typeLine && (
          <Typography sx={{ color: "#475569", fontSize: "0.78rem", fontWeight: 600, mt: 0.2 }} noWrap>
            {typeLine}
          </Typography>
        )}
        {(d.detail || d.note) && (
          <Typography sx={{
            color: TEXT_SUB, fontSize: "0.76rem", mt: 0.6, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {d.detail || d.note}
          </Typography>
        )}

        {/* ── คน: ผู้แจ้ง → ผู้รับผิดชอบ ── */}
        <Box sx={{ mt: 1.1, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1, rowGap: 0.6, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: TEXT_SUB }}>ผู้แจ้ง</Typography>
          <Box sx={{ minWidth: 0, display: "flex" }}>
            {d.requestedBy?.name
              ? <PersonChip name={d.requestedBy.name} badge={requesterDept(d)} size={20} />
              : <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>-</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: TEXT_SUB }}>ผู้รับผิดชอบ</Typography>
          <Box sx={{ minWidth: 0, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {responsible ? <PersonChip name={responsible} strong size={20} /> : <UnassignedChip />}
            {team.length > 0 && (
              <Tooltip title={team.join(", ")}>
                <Typography component="span" sx={{ alignSelf: "center", fontSize: "0.7rem", fontWeight: 700, color: TEXT_SUB }}>
                  +{team.length} ทีม
                </Typography>
              </Tooltip>
            )}
          </Box>
        </Box>

        {d.status === "rejected" && d.rejectedReason && (
          <Typography sx={{ mt: 1, fontSize: "0.74rem", color: "#b91c1c", fontWeight: 600, bgcolor: "#fef2f2", borderRadius: 1.5, px: 1, py: 0.5 }}>
            ต้องแก้ไข: {d.rejectedReason}
          </Typography>
        )}
      </Box>

      {/* ── แถบล่าง: วันเข้างาน · กำหนดเสร็จ · แจ้งเมื่อ ── */}
      <Stack
        direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap
        sx={{ pl: 2, pr: 1.75, py: 0.85, bgcolor: SURFACE_SUBTLE, borderTop: "1px solid", borderColor: BORDER_MAIN }}
      >
        {d.job?.start ? (
          <Tooltip title="วันเข้างาน">
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <CalendarMonth sx={{ fontSize: 14, color: "#2563eb" }} />
              <Typography sx={{ fontSize: "0.72rem", color: "#1e3a8a", fontWeight: 700 }} noWrap>
                {formatThai(moment(d.job.start), "D MMM YY")}
              </Typography>
            </Stack>
          </Tooltip>
        ) : (
          <Stack direction="row" alignItems="center" spacing={0.4}>
            <CalendarMonth sx={{ fontSize: 14, color: "#d97706" }} />
            <Typography sx={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 700 }} noWrap>ยังไม่ลงวัน</Typography>
          </Stack>
        )}
        {d.dueAt && (
          <Tooltip title={overdue ? "เลยกำหนดเสร็จแล้ว" : "กำหนดเสร็จ"}>
            <Stack direction="row" alignItems="center" spacing={0.4}>
              <Schedule sx={{ fontSize: 14, color: overdue ? "#dc2626" : TEXT_SUB }} />
              <Typography sx={{ fontSize: "0.72rem", color: overdue ? "#dc2626" : "#475569", fontWeight: 700 }} noWrap>
                {formatThai(moment(d.dueAt), "D MMM")}
              </Typography>
            </Stack>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {hasDocs && (
          <Tooltip title="มีใบเสนอราคา / ใบ PO แนบมาด้วย"><Description sx={{ fontSize: 15, color: TEXT_SUB }} /></Tooltip>
        )}
        {d.customer?.mapUrl && (
          <Tooltip title="มีลิงก์แผนที่นำทาง"><Place sx={{ fontSize: 15, color: TEXT_SUB }} /></Tooltip>
        )}
        {d.requestedAt && (
          <Tooltip title={`แจ้งเมื่อ ${formatThai(moment(d.requestedAt), "D MMM YY HH:mm")}`}>
            <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 600 }} noWrap>
              {moment(d.requestedAt).fromNow()}
            </Typography>
          </Tooltip>
        )}
      </Stack>
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
          {["งาน", "ลูกค้า / หน้างาน", "ผู้แจ้ง", "สถานะ", "ผู้รับผิดชอบ", "วันเข้างาน", "แจ้งเมื่อ"].map((h) => (
            <TableCell
              key={h}
              sx={{
                fontWeight: 800, fontSize: "0.74rem", color: "#334155",
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
              <TableCell sx={{ maxWidth: 260, borderLeft: "4px solid", borderLeftColor: m.color }}>
                {d.dispatchNo && (
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: TEXT_SUB, fontVariantNumeric: "tabular-nums" }} noWrap>{d.dispatchNo}</Typography>
                )}
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
              <TableCell sx={{ maxWidth: 200 }}>
                {d.requestedBy?.name ? <PersonChip name={d.requestedBy.name} size={20} /> : "-"}
                <Typography sx={{ display: "block", fontSize: "0.68rem", color: TEXT_SUB, mt: 0.3, pl: 0.5 }} noWrap>{requesterDept(d)}</Typography>
              </TableCell>
              <TableCell><StatusPill meta={m} /></TableCell>
              <TableCell sx={{ maxWidth: 200 }}>
                {responsibleOf(d) ? <PersonChip name={responsibleOf(d)} strong size={20} /> : <UnassignedChip />}
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {d.job?.start
                  ? <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#1e3a8a" }}>{formatThai(moment(d.job.start), "D MMM YY")}</Typography>
                  : <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#b45309" }}>ยังไม่ลงวัน</Typography>}
              </TableCell>
              <TableCell sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 600, whiteSpace: "nowrap" }}>
                {formatThai(moment(d.requestedAt), "D MMM")}
                <Typography sx={{ display: "block", fontSize: "0.68rem", color: TEXT_SUB }}>{moment(d.requestedAt).fromNow()}</Typography>
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

/**
 * ข้อความในคอลัมน์ที่ยังไม่มีใบ
 * ✅ ที่แก้ (ผู้ใช้แจ้งว่า "ดูโล้นๆ เวลาไม่มีงาน"): เดิมเป็นคำว่า "ไม่มีรายการ" ลอยอยู่กลางอากาศ
 * ไม่มีอะไรยึด พอคอลัมน์ข้างๆ มีการ์ด กระดานเลยดูเอียงข้างเหมือนโหลดไม่ครบ
 * ⚠️ เขียนข้อความแยกตามคอลัมน์ — "ไม่มีรายการ" เหมือนกันทั้งสองฝั่งไม่ได้บอกอะไรเลย
 * ส่วนคอลัมน์ "รอลงแผนงาน" ที่ว่างคือ *ข่าวดี* (เคลียร์หมดแล้ว) ควรสื่อแบบนั้น ไม่ใช่เหมือนข้อมูลหาย
 */
const COLUMN_EMPTY_TEXT = {
  requested: "เคลียร์หมดแล้ว — ไม่มีคำขอรอตัดสินใจ",
  assigned: "ยังไม่มีใบที่ลงแผนงาน",
};

/** หัวคอลัมน์ — ไอคอน + คำอธิบายสั้นว่าต้องทำอะไรกับใบในคอลัมน์นี้ */
const COLUMN_META = {
  requested: { icon: <HourglassTop />, hint: "ตรวจรายละเอียด แล้วเลือกวัน + ช่าง" },
  assigned: { icon: <EventAvailable />, hint: "ลงตารางงานแล้ว รอช่างเข้างาน" },
};

export default function DispatchList({ mode = "board", myId = "" }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [quick, setQuick] = useState("all");
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

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(""); }
    try {
      const params = statusFilter === "all" ? { include: "all" } : {};
      setRows(await DispatchService.list(params));
    } catch (err) {
      if (!silent) setError(err?.response?.data?.message || "โหลดใบมอบหมายไม่สำเร็จ");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ✅ เรียลไทม์: ใบมอบหมายถูกส่ง/รับ/อัปเดตความคืบหน้าจากเครื่องอื่น → รายการอัปเดตทันที
  useRealtime("dispatch", () => { load(true); });

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

  // ── ตัวกรองด่วนของคิว (ผู้ใช้: "ข้อมูลดูยาก จัดการยาก") — นับจากรายการที่ผ่านคำค้นแล้ว ──
  const today = moment().startOf("day");
  const QUICK = {
    all: () => true,
    urgent: (d) => d.priority === "urgent",
    unassigned: (d) => !responsibleOf(d),
    soon: (d) => d.job?.start && moment(d.job.start).isBetween(today, today.clone().add(7, "days"), "day", "[]"),
  };
  const quickList = filtered.filter(QUICK[quick] || QUICK.all);
  const waitingRows = quickList.filter((d) => d.status === "requested")
    .sort((a, b) => (b.priority === "urgent") - (a.priority === "urgent") || new Date(a.requestedAt) - new Date(b.requestedAt));
  const assignedRows = quickList.filter((d) => d.status === "assigned");
  const upcoming = assignedRows.filter((d) => !d.job?.start || !moment(d.job.start).isBefore(today, "day"))
    .sort((a, b) => new Date(a.job?.start || 0) - new Date(b.job?.start || 0));
  const past = assignedRows.filter((d) => d.job?.start && moment(d.job.start).isBefore(today, "day"))
    .sort((a, b) => new Date(b.job.start) - new Date(a.job.start));

  if (loading && !rows.length) {
    return <PageLoader variant="inline" label="กำลังโหลดรายการ…" />;
  }

  if (mode === "board") {
    const open = (x) => setOpenId(x._id);
    const assignedRow = (d) => {
      const m = statusBadge(d);
      const resp = responsibleOf(d);
      return (
        <QueueRow
          key={d._id} onOpen={() => open(d)} edge={m.color}
          date={d.job?.start} dateTone={d.job?.start ? "blue" : "amber"}
          title={companySite(d.customer?.company, d.customer?.site)}
          sub={[d.dispatchNo, [d.title, d.system].filter(Boolean).join(" · ")].filter(Boolean).join("  ·  ")}
          right={<>
            {resp ? <PersonChip name={resp} strong size={20} /> : <UnassignedChip />}
            <SoftPill color={m.color}>{m.label}</SoftPill>
          </>}
        />
      );
    };
    return (
      <Box>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        <QueueToolbar
          search={search} onSearch={setSearch} placeholder="ค้นหางาน / ลูกค้า / เลขที่ใบ"
          filter={quick} onFilter={setQuick}
          filters={[
            { key: "all", label: "ทั้งหมด", count: filtered.length },
            { key: "urgent", label: "ด่วน", count: filtered.filter(QUICK.urgent).length, color: "#dc2626" },
            { key: "unassigned", label: "ยังไม่มีผู้รับผิดชอบ", count: filtered.filter(QUICK.unassigned).length, color: AMBER },
            { key: "soon", label: "เข้างานใน 7 วัน", count: filtered.filter(QUICK.soon).length, color: BLUE },
          ]}
          view={viewMode} onView={setViewMode} onRefresh={() => load()} loading={loading}
        />

        {viewMode === "table" ? (
          quickList.length ? <DispatchTable rows={quickList} onOpen={open} /> : <AllClear text={search ? "ไม่พบรายการที่ค้นหา" : "ไม่มีรายการในตัวกรองนี้"} />
        ) : (
          <>
            <SectionHead color={AMBER} title="รอลงแผนงาน" count={waitingRows.length} hint="ตรวจรายละเอียด แล้วเลือกวันเข้างาน + ช่าง" />
            {waitingRows.length === 0 ? (
              <AllClear text="เคลียร์หมดแล้ว — ไม่มีคำขอรอลงแผนงาน" />
            ) : (
              <Stack spacing={1.25} sx={{ mb: 3 }}>
                {waitingRows.map((d) => {
                  const resp = responsibleOf(d);
                  return (
                    <ActionCard
                      key={d._id} urgent={d.priority === "urgent"} onOpen={() => open(d)}
                      date={d.job?.start} dateTone="amber"
                      top={<>
                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: TEXT_SUB, fontVariantNumeric: "tabular-nums" }}>{d.dispatchNo || "ใบแจ้งงาน"}</Typography>
                        {d.priority === "urgent" && <UrgentPill />}
                        {(d.attachments || []).some((x) => DOC_TYPE_META[x.docType]?.commercial) && <SoftPill color="#059669" icon={<Description />}>มี QT/PO</SoftPill>}
                        {d.customer?.mapUrl && <SoftPill color={BLUE} icon={<Place />}>มีแผนที่</SoftPill>}
                      </>}
                      title={companySite(d.customer?.company, d.customer?.site)}
                      sub={[d.title, d.system].filter(Boolean).join(" · ")}
                      detail={d.detail || d.note}
                      people={<>
                        <PeopleField label="ผู้แจ้ง">{d.requestedBy?.name ? <PersonChip name={d.requestedBy.name} badge={requesterDept(d)} size={20} /> : "-"}</PeopleField>
                        <PeopleField label="ผู้รับผิดชอบ">{resp ? <PersonChip name={resp} strong size={20} /> : <UnassignedChip />}</PeopleField>
                        {d.requestedAt && <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>แจ้ง {moment(d.requestedAt).fromNow()}</Typography>}
                      </>}
                      actions={
                        <Button variant="contained" startIcon={<EventAvailable />} onClick={() => open(d)}
                          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: BLUE, py: 1, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
                          ตรวจและลงแผนงาน
                        </Button>
                      }
                    />
                  );
                })}
              </Stack>
            )}

            <SectionHead color={BLUE} title="ลงแผนงานแล้ว" count={assignedRows.length} hint="ลงตารางงานแล้ว — งานที่กำลังทำ/ปิดงานดูต่อที่หน้าการดำเนินงาน" />
            {assignedRows.length === 0 ? (
              <Typography sx={{ px: 0.5, fontSize: "0.82rem", color: TEXT_SUB }}>ยังไม่มีใบที่ลงแผนงาน</Typography>
            ) : (
              <>
                {upcoming.length > 0 && <RowGroup title="กำลังจะเข้างาน" count={upcoming.length} color={BLUE}>{upcoming.map(assignedRow)}</RowGroup>}
                {past.length > 0 && <RowGroup title="เข้างานไปแล้ว" count={past.length} color={FAINT_DOT} defaultOpen={upcoming.length === 0}>{past.map(assignedRow)}</RowGroup>}
              </>
            )}
          </>
        )}

        <DispatchDialog
          dispatchId={openId}
          onClose={() => { setOpenId(null); if (routeId) navigate(basePath, { replace: true }); }}
          onSaved={patch}
        />
      </Box>
    );
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
      {/* ✅ แถบเครื่องมือแถวเดียว (กล่องขาวชุดเดียวกับหน้าภาพรวมงาน/การดำเนินงาน) — มือถือ: ค้นหาเต็มแถว */}
      <Box
        sx={{
          mb: 2, p: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: { xs: "wrap", sm: "nowrap" },
          bgcolor: "#fff", border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 3,
          boxShadow: "0 1px 2px rgba(15, 23, 42, .04)",
        }}
      >
        <TextField
          size="small" placeholder="ค้นหางาน / ลูกค้า / เลขที่ใบ" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ fontSize: 19, color: TEXT_SUB, mr: 0.75 }} />,
            endAdornment: search ? (
              <IconButton size="small" aria-label="ล้างคำค้น" onClick={() => setSearch("")} sx={{ p: 0.25 }}>
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            ) : null,
          }}
          sx={{
            flex: { xs: "1 1 100%", sm: "1 1 auto" }, maxWidth: { sm: 420 },
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5, bgcolor: SURFACE_SUBTLE, height: 40, fontSize: "0.86rem",
              "& fieldset": { borderColor: "transparent" },
              "&:hover fieldset": { borderColor: BORDER_MAIN },
              "&.Mui-focused": { bgcolor: "#fff" },
            },
          }}
        />
        {mode !== "board" && (
          <SelectField
            size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <option value="open">ที่ยังไม่เสร็จ</option>
            <option value="all">ทั้งหมด</option>
          </SelectField>
        )}
        <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.78rem", fontWeight: 700, color: TEXT_SUB, whiteSpace: "nowrap", ml: 0.5 }}>
          {filtered.length.toLocaleString()} ใบ
        </Typography>
        <Box sx={{ flex: 1 }} />
        <ViewToggle value={viewMode} onChange={setViewMode} />
        <Tooltip title="โหลดข้อมูลใหม่">
          <IconButton
            size="small" onClick={() => load()} aria-label="โหลดข้อมูลใหม่"
            sx={{ color: TEXT_SUB, border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 2, width: 36, height: 36, "&:hover": { bgcolor: SURFACE_SUBTLE } }}
          >
            <Refresh sx={{ fontSize: 19, ...(loading ? { animation: "dlSpin 1s linear infinite", "@keyframes dlSpin": { to: { transform: "rotate(360deg)" } } } : {}) }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ✅ หน้าว่างแบบเรียบ — เดิมมีทั้งเส้นประ พื้นเทา และวงกลมสีส้ม สำหรับ "ไม่มีอะไรเลย" */}
      {filtered.length === 0 ? (
        <Box sx={{ py: 6, px: 2, textAlign: "center", bgcolor: "#fff", border: "1px dashed", borderColor: BORDER_MAIN, borderRadius: 3 }}>
          <Inbox sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
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
              <Box
                key={status}
                // ✅ คอลัมน์พื้นขาวขอบเทา (เดิมพื้น/ขอบสีตามสถานะ) — สีสถานะเหลือแค่จุดหน้าหัวข้อ
                sx={{
                  mb: isDesktop ? 0 : 2, p: 1.25, borderRadius: 3,
                  bgcolor: "#fff", border: "1px solid", borderColor: BORDER_MAIN, boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.25, mb: 1.25 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: m.color, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a", lineHeight: 1.3 }}>{m.label}</Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }} noWrap>{COLUMN_META[status]?.hint}</Typography>
                  </Box>
                  <Box sx={{
                    minWidth: 30, height: 26, px: 1, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: list.length ? "#eff6ff" : "#f1f5f9", color: list.length ? "#1d4ed8" : TEXT_SUB,
                    fontWeight: 800, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums",
                  }}>
                    {list.length}
                  </Box>
                </Stack>
                <Stack spacing={1.25}>
                  {list.map((d) => <DispatchCard key={d._id} d={d} onOpen={(x) => setOpenId(x._id)} myId={myId} />)}
                  {list.length === 0 && (
                    <Stack
                      alignItems="center" justifyContent="center" spacing={0.75}
                      sx={{ minHeight: 110, px: 2, borderRadius: 2.5, textAlign: "center", border: "1px dashed", borderColor: BORDER_MAIN, bgcolor: SURFACE_SUBTLE }}
                    >
                      {status === "requested"
                        ? <TaskAlt sx={{ fontSize: 26, color: "#94a3b8" }} />
                        : <Inbox sx={{ fontSize: 26, color: alpha(TEXT_SUB, 0.5) }} />}
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: TEXT_SUB }}>
                        {COLUMN_EMPTY_TEXT[status] || "ไม่มีรายการ"}
                      </Typography>
                    </Stack>
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
