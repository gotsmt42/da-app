/**
 * MyJobs.js — v3 ("งานของฉัน" สำหรับช่าง)
 *
 * ✅ เดิมหน้านี้ผูกกับ WorkOrderService/คอลเลกชัน "workorders" ที่ไม่เคยถูกใช้งานจริงในระบบ
 *    (ว่างเปล่าเสมอ) ทำให้หน้านี้ใช้งานไม่ได้เลยตั้งแต่แรก — ระบบงานจริงคือ CalendarEvent
 *    ผ่าน EventService.getEventOp() (scope ตาม role ที่ backend อยู่แล้ว ช่างเห็นแค่งานตัวเอง)
 *    ตัวการ์ดงานใช้ TechnicianJobCard ตัวเดียวกับที่ใช้ในหน้า Operation จริง (เอกสารประจำงาน,
 *    ขอปิดงาน, สรุปงาน, คุยกับแอดมิน, ประวัติกิจกรรม) ครบทุกฟีเจอร์ ไม่ต้องมีหน้ารายละเอียดแยก
 * ✅ v3: งานที่เข้าหลายวันไม่ติดกัน (ผูกด้วย jobGroupId เดียวกัน) รวมเป็นการ์ดเดียวผ่าน
 *    JobGroupCard แทนที่จะแสดงแยกซ้ำกันทุกวัน (เทียบ pattern เดียวกับ JobGroupBlock ในหน้า
 *    Operation ฝั่งแอดมิน)
 */

import { initialViewMode } from "@/shared/ui/ViewToggle";
import FileGalleryDialog from "@/shared/ui/FileGalleryDialog";
import MultiDayGroupHeader, { multiDayCardSx, useGroupAttendance, SessionList } from "@/shared/ui/MultiDayGroup";
import { useEffect, useMemo, useState, useCallback, useRef, cloneElement } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { Link, useSearchParams } from "react-router-dom";
import { History } from "@mui/icons-material";
import { isRespOrHead, isResponsibleOf, ackTracked, isClosedJob } from "@/shared/utils/jobFlow";
import { useAuth } from "@/features/auth/AuthContext";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import TechnicianJobCard from "../components/TechnicianJobPanel";
import { buildDaysPastDueMap, isFlaggedDays, isSevereDays, getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { PAGE_SX, PageHeader, ICON_BTN_SX, INK, INK_2, MUTED, LINE, SURFACE, ACCENT } from "@/shared/ui/PageKit";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import { JobFlowFlags } from "@/shared/ui/JobFlow";
import DateCell from "@/shared/ui/DateCell";
import JobKindTag from "@/shared/ui/JobKindTag";
import useTodayCheckins from "@/shared/hooks/useTodayCheckins";
import { attentionOf, ATTENTION_META, attentionDayText, isTodayJob } from "@/shared/utils/myJobAttention";
import JobDocsCell from "@/shared/ui/JobDocsCell";
import RefDoc from "@/shared/ui/RefDoc";
import { PersonChip } from "@/shared/ui/PersonChip";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton,
  Chip, Skeleton, Dialog, DialogContent,
  Tooltip, Button, Snackbar, Alert, Collapse,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, WorkOutline, HourglassTop, TaskAlt, Warning, ViewAgendaOutlined, TableRowsOutlined,
  Close, Today,
} from "@mui/icons-material";

// 🔁 (21 ต.ค. 2569) กล่องดูไฟล์ตัวกลาง — เลื่อนดูไฟล์อื่นในช่องเดียวกัน (← → · ปัด · แถบรูปย่อ)
const FilePreviewDialog = (props) => <FileGalleryDialog {...props} />;


// ─── มุมมองตาราง (งานของฉัน) ───────────────────────────────────────────────────
// ✅ (19 ต.ค. 2569 ผู้ใช้: "ทำแบบตารางด้วย ให้สมบูรณ์") — กวาดดูหลายงานในจอเดียว · กดแถว = กางการ์ดเต็มใต้แถว
//    (ทำงานต่อได้ครบเหมือนมุมมองการ์ด: รับทราบ · เข้างาน · แนบเอกสาร · ขอปิดงาน)
const STATUS_TONE = { "กำลังรอยืนยัน": "#d97706", "ยืนยันแล้ว": "#2563eb", "กำลังดำเนินการ": "#7c3aed", "ดำเนินการเสร็จสิ้น": "#16a34a" };
/**
 * ปุ่มในแถว = "สิ่งที่ต้องทำต่อ" ของงานนั้น (ผู้ใช้: "เปลี่ยนให้เป็นปุ่มดำเนินการ เช่น บันทึก รับทราบ หรืออื่นๆ ที่เกี่ยวข้อง")
 * กดแล้วกางการ์ดใต้แถว ซึ่งมีปุ่มทำขั้นนั้นจริง (รับทราบ · ยืนยันนัด · เข้างาน · แนบเอกสาร · ขอปิดงาน)
 */
const nextActionOf = (a, uid, fname) => {
  const DOCS = ["reportFiles", "completionFiles"];
  if (isClosedJob(a)) return { label: "ดูงาน", tone: "#64748b" };
  if (a.approvalStatus === "pending") return { label: "รออนุมัติ", tone: "#d97706", wait: true };
  if (a.closeRequested) return { label: "รอตรวจปิดงาน", tone: "#0891b2", wait: true };
  // 🔁 (21 ต.ค. 2569) รับทราบเป็นของทั้งทีม — ตรงกับกล่องขั้นตอนในการ์ด (มีคนในทีมกดแล้ว = รับทราบแล้ว)
  if (ackTracked(a) && !(a.acks || []).length) return { label: "รับทราบงาน", tone: "#2563eb", primary: true };
  if (a.status === "กำลังรอยืนยัน" && isResponsibleOf(a, uid, fname)) return { label: "ยืนยันนัดหมาย", tone: "#2563eb", primary: true };
  if (moment().startOf("day").isBefore(moment(a.start).startOf("day"))) return { label: "ดูรายละเอียด", tone: "#475569" };
  // 🐛 (19 ต.ค. 2569 ผู้ใช้: "มีปุ่มบันทึกเข้างาน แต่กดแล้วไม่ให้บันทึก") — บันทึกเข้างานได้เฉพาะหัวหน้าทีม
  //    ผู้รับผิดชอบที่ไม่ได้เป็นหัวหน้าทีมจึงเห็น "รอหัวหน้าทีมเข้างาน" (ปุ่มรอง) แทนปุ่มที่กดแล้วทำไม่ได้
  if (!a.checkedInAt) {
    const isHead = String(a.resPerson || "") === String(uid || "x") || (Boolean(fname) && a.team === fname);
    if (isHead) return { label: "บันทึกเข้างาน", tone: "#2563eb", primary: true };
    return a.team
      ? { label: "รอหัวหน้าทีมเข้างาน", tone: "#475569", wait: true, hint: `รอ ${a.team} บันทึกเข้างาน` }
      : { label: "เลือกหัวหน้าทีม", tone: "#d97706", hint: "ยังไม่มีหัวหน้าทีมเข้างาน" };
  }
  if (!DOCS.some((k) => (a[k] || []).length)) return { label: "แนบเอกสาร", tone: "#7c3aed", primary: true };
  return { label: "ขอปิดงาน", tone: "#16a34a", primary: true };
};


function MyJobsTable({ groups, allGroups, overdueOf, renderCard, highlightJob, uid, fname }) {
  // 🔁 (19 ต.ค. 2569 ผู้ใช้: "กดแล้วแสดงปุ่มหรือฟอร์มขึ้นมาเลย ไม่ต้องกดขยายลงไป") — กดแถว/ปุ่ม = เปิดกล่องงานนั้นทับหน้าเลย
  //    กล่องอ่านข้อมูลสดจากรายการทั้งหมด (allGroups) — กดรับทราบ/เข้างานแล้วสถานะในกล่องเปลี่ยนตามทันที
  const [openId, setOpenId] = useState("");
  const keyOf = (ss) => String(ss[0].jobGroupId || ss[0]._id);
  const toggle = (id) => setOpenId(id);
  useEffect(() => {
    if (!highlightJob) return;
    const g = groups.find((ss) => ss.some((x) => String(x._id) === highlightJob));
    if (g) setOpenId(keyOf(g));
  }, [highlightJob, groups]);
  const openGroup = openId ? ((allGroups || groups).find((ss) => keyOf(ss) === openId) || null) : null;
  const fullScreen = typeof window !== "undefined" && window.innerWidth < 600;
  const th = { textAlign: "left", fontSize: "0.74rem", fontWeight: 800, color: MUTED, px: 1.25, py: 1.1, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", bgcolor: SURFACE };
  const td = { fontSize: "0.82rem", color: INK_2, px: 1.25, py: 1.25, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const sub = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 };
  // ✅ (19 ต.ค. 2569 ผู้ใช้: "งานของฉัน กับ การดำเนินงาน แสดงผลคล้ายกัน ยกเว้นไม่ต้องมีช่องผู้รับผิดชอบ")
  const COLS = ["วันที่เข้างาน", "งาน", "โครงการ / บริษัท", "ทีมเข้างาน", "ผู้ติดต่อ", "เอกสารอ้างอิง", "เอกสารที่แนบ", "สถานะ", ""];
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflowX: "auto", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      <Box component="table" sx={{ width: "100%", minWidth: 1360, borderCollapse: "collapse" }}>
        <thead><tr>{COLS.map((h, i) => <Box component="th" key={i} sx={th}>{h}</Box>)}</tr></thead>
        <tbody>
          {groups.map((sessions) => {
            const a = sessions[0];
            const id = String(a.jobGroupId || a._id);
            const isOpen = openId === id;
            const od = overdueOf(sessions);
            const tone = STATUS_TONE[a.status] || MUTED;
            const team = [a.team, ...(a.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, k, arr) => arr.indexOf(x) === k);
            return [
              <Box component="tr" key={id} onClick={() => toggle(id)}
                id={sessions.some((x) => String(x._id) === highlightJob) ? `myjob-${highlightJob}` : undefined}
                sx={{ cursor: "pointer", scrollMarginTop: "80px", bgcolor: isOpen ? "#f5f8ff" : "#fff", "&:hover": { bgcolor: isOpen ? "#f5f8ff" : SURFACE },
                  ...(od ? { boxShadow: `inset 3px 0 0 ${od.severe ? "#dc2626" : "#d97706"}` } : {}) }}>
                <Box component="td" sx={{ ...td, width: 84 }}>
                  <DateCell start={a.start} end={a.end} allDay={a.allDay}>
                    {sessions.length > 1 && <Typography sx={{ ...sub, color: ACCENT, fontWeight: 700, mt: 0.4, whiteSpace: "nowrap" }}>+ อีก {sessions.length - 1} ช่วง</Typography>}
                    {od && (
                      <Box component="span" sx={{ mt: 0.5, px: 0.75, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap",
                        bgcolor: alpha(od.severe ? "#dc2626" : "#d97706", 0.1), color: od.severe ? "#dc2626" : "#b45309" }}>
                        {od.severe ? `ค้าง ${od.days} วัน` : `เลยกำหนด ${od.days} วัน`}
                      </Box>
                    )}
                  </DateCell>
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 190, maxWidth: 240 }}>
                  <JobKindTag event={a} />
                  <Typography sx={{ mt: 0.5, fontSize: "0.86rem", fontWeight: 800, color: INK, lineHeight: 1.35 }}>{a.title || "งาน"}{a.system ? ` · ${a.system}` : ""}</Typography>
                  {a.jobNo && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{a.jobNo}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170, maxWidth: 240 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK_2, overflowWrap: "anywhere" }}>{a.site || "—"}</Typography>
                  {a.company && a.company !== a.site && <Typography sx={{ ...sub, overflowWrap: "anywhere" }}>{a.company}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 150, maxWidth: 200 }}>
                  {team.length ? (
                    <Stack spacing={0.5}>
                      {team.slice(0, 3).map((n, k) => <PersonChip key={n} name={n} size={20} badge={k === 0 && team.length > 1 ? "หัวหน้า" : undefined} />)}
                      {team.length > 3 && <Typography sx={sub}>+ อีก {team.length - 3} คน</Typography>}
                    </Stack>
                  ) : <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#d97706" }}>ยังไม่มอบหมาย</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 130, maxWidth: 170 }} onClick={(e) => a.contactTel && e.stopPropagation()}>
                  {a.contactName || a.contactTel ? (
                    <>
                      {a.contactName && <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, overflowWrap: "anywhere" }}>{a.contactName}</Typography>}
                      {a.contactTel && <Box component="a" href={`tel:${a.contactTel}`} sx={{ fontSize: "0.78rem", fontWeight: 700, color: ACCENT, textDecoration: "none" }}>{a.contactTel}</Box>}
                    </>
                  ) : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 140, maxWidth: 180 }}><RefDoc event={a} /></Box>
                <Box component="td" sx={{ ...td, minWidth: 200 }}><JobDocsCell event={a} /></Box>
                <Box component="td" sx={{ ...td, minWidth: 150 }}>
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, height: 28, px: 1.25, borderRadius: 99, whiteSpace: "nowrap",
                    bgcolor: alpha(tone, 0.12), color: tone, border: `1px solid ${alpha(tone, 0.35)}`, fontSize: "0.8rem", fontWeight: 800 }}>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tone }} />{a.status || "—"}
                  </Box>
                  <JobFlowFlags event={a} />
                </Box>
                <Box component="td" sx={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                  {(() => {
                    const act = nextActionOf(a, uid, fname);
                    return (
                      <Button size="small" title={act.hint} onClick={(e) => { e.stopPropagation(); toggle(id); }}
                        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 32, px: 1.5, boxShadow: "none", minWidth: 104, whiteSpace: "nowrap",
                          ...(act.primary
                            ? { bgcolor: act.tone, color: "#fff", "&:hover": { bgcolor: act.tone, filter: "brightness(.92)" } }
                            : { color: act.tone, bgcolor: act.wait ? alpha(act.tone, 0.08) : "#fff", border: `1px solid ${alpha(act.tone, 0.35)}` }) }}>
                        {act.label}
                      </Button>
                    );
                  })()}
                </Box>
              </Box>,
            ];
          })}
        </tbody>
      </Box>
      <Dialog open={Boolean(openGroup)} onClose={() => setOpenId("")} fullWidth maxWidth="md" fullScreen={fullScreen}
        PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: SURFACE } }}>
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25, bgcolor: "#fff", borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "1rem", color: INK }} noWrap>
            {openGroup ? `${openGroup[0].title || "งาน"}${openGroup[0].system ? ` · ${openGroup[0].system}` : ""}` : ""}
          </Typography>
          <IconButton onClick={() => setOpenId("")} aria-label="ปิด"><Close /></IconButton>
        </Stack>
        <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>{openGroup && renderCard(openGroup)}</DialogContent>
      </Dialog>
    </Box>
  );
}

// ─── JobGroupCard ───────────────────────────────────────────────────────
// ✅ งานที่เข้าหลายวันไม่ติดกัน (ผูกกันด้วย jobGroupId เดียวกัน หรือลายเซ็น company/site/title/
// system/team/time เดียวกันสำหรับงานเก่าก่อนมี jobGroupId) เดิมแสดงเป็นการ์ดแยกซ้ำกันทุกวัน —
// รวมเป็นการ์ดเดียว วันล่าสุด (sessions[0]) ถือเอกสารประจำงาน/ขอปิดงานของทั้งกลุ่ม ส่วนวันอื่นซ่อน
// ส่วนนี้ไป กดขยายเพื่อดู/จัดการแต่ละวันแยกกันได้ตามเดิม (เทียบ pattern เดียวกับ JobGroupBlock
// ที่ใช้ในหน้า Operation ฝั่งแอดมิน) — ใช้ getOverdueGroupKey จาก util กลางแทนฟังก์ชันซ้ำของตัวเอง
const JobGroupCard = ({ sessions, ...cardProps }) => {
  // ✅ (10 ต.ค. 2569) มีวันเข้างานเป็น "วันนี้" → กางไว้เลย ให้เห็นปุ่มเช็คอินของวันนี้ทันที
  const [expanded, setExpanded] = useState(() => sessions.some((s) => {
    const last = moment(s.end || s.start).subtract(s.allDay && s.end ? 1 : 0, "days"); // 🐛 (20 ต.ค. 2569) เดิม allDay ไม่ระบุก็ลบ 1 วัน — ไม่ตรงกับทั้งแอป
    return moment().isBetween(moment(s.start), last.isBefore(moment(s.start)) ? moment(s.start) : last, "day", "[]");
  }));
  const isGrouped = sessions.length > 1;
  const anchorId = sessions[0]._id;
  const groupAtt = useGroupAttendance(sessions, isGrouped);

  const renderCard = (event) => (
    <TechnicianJobCard
      key={event._id}
      event={event}
      {...cardProps}
      hideDocuments={isGrouped && event._id !== anchorId}
      noOuterCard={isGrouped}
    />
  );

  if (!isGrouped) return renderCard(sessions[0]);

  const head = sessions[0];
  // ✅ หัวการ์ดงานหลายช่วงวัน — ตัวกลางชุดเดียวกับหน้าการดำเนินงาน (shared/ui/MultiDayGroup)
  return (
    <Box sx={multiDayCardSx(STATUS_DOT[head.status] || "#94a3b8")}>
      <MultiDayGroupHeader sessions={sessions} anchorId={anchorId} expanded={expanded} onToggle={() => setExpanded((p) => !p)} att={groupAtt}
        title={`${head.company && head.site ? `${head.company} · ${head.site}` : (head.company || head.site || "")}${head.title ? ` — ${head.title}` : ""}${head.system ? ` · ${head.system}` : ""}`} />
      {/* 🔁 (20 ต.ค. 2569 ผู้ใช้: "แยกให้ละเอียดและชัดเจน งานไม่ต่อเนื่อง หลายช่วงวัน") — แต่ละช่วงมีกรอบ + "ช่วงที่ k/N · สถานะ"
          ช่วงวันนี้/ถัดไปขึ้นก่อน · ช่วงที่ผ่านมาพับไว้ (ชุดเดียวกับหน้าการดำเนินงาน) */}
      <Collapse in={expanded}>
        <Box sx={{ p: { xs: 1, sm: 1.5 }, bgcolor: "#f8fafc", borderRadius: "0 0 16px 16px" }}>
          <SessionList sessions={sessions} anchorId={anchorId} att={groupAtt} renderCard={renderCard} />
        </Box>
      </Collapse>
    </Box>
  );
};

/** สีสถานะงาน (แถบซ้ายการ์ดกลุ่ม) — ชุดเดียวกับหน้าการดำเนินงาน */
const STATUS_DOT = { กำลังรอยืนยัน: "#f59e0b", ยืนยันแล้ว: "#3b82f6", กำลังดำเนินการ: "#8b5cf6", ดำเนินการเสร็จสิ้น: "#10b981" };

// ─── กลุ่มสถานะแท็บ ───
const GROUPS = [
  // ✅ (24 ต.ค. 2569 ผู้ใช้: "งานของฉันควรมีแถบงานวันนี้ ให้ทำงานง่าย ดูข้อมูลง่าย") — แถบแรก เปิดหน้ามาเจอก่อน
  //    งานทุกงานที่มีวันเข้างานเป็นวันนี้ (รวมวันที่ 2,3… ของงานหลายวัน) ที่ยังไม่ปิดงาน — ซ้อนกับแถบอื่นได้ (เป็นมุมมอง "วันนี้")
  { key: "today", label: "งานวันนี้", short: "วันนี้", icon: <Today sx={{ fontSize: 15 }} />, color: "#0f766e" },
  { key: "active", label: "งานที่ต้องทำ", short: "ต้องทำ", icon: <WorkOutline sx={{ fontSize: 15 }} />, color: "#2563eb" },
  // ✅ เดิมไม่มีทางเห็นงานค้างแยกจากงานทั่วไปเลยในหน้านี้ (ต้องไปเปิดหน้า Operation ต่างหาก) —
  // เพิ่มแท็บนี้โดยตรง ใช้เกณฑ์เดียวกับหน้า Operation เป๊ะๆ (เลยกำหนด 1 สัปดาห์ขึ้นไป, งานหลายวัน
  // ไม่ติดกันนับเป็น 1 งาน คิดจากวันสุดท้าย) ผ่าน util กลาง
  { key: "overdue", label: "ค้างงาน", icon: <Warning sx={{ fontSize: 15 }} />, color: "#dc2626" },
  { key: "pending", label: "รอแอดมินอนุมัติ", short: "รออนุมัติ", icon: <HourglassTop sx={{ fontSize: 15 }} />, color: "#d97706" },
  { key: "closed", label: "เสร็จสิ้น", icon: <TaskAlt sx={{ fontSize: 15 }} />, color: "#059669" },
];

/**
 * ✅ (15 ต.ค. 2569 ผู้ใช้เลือก "ช่างใช้งานของฉันที่เดียว") — แถบสถานะย่อยในหมวด "ต้องทำ" ชุดเดียวกับหน้าการดำเนินงาน
 *    ทั้งหมด · รอยืนยัน · ยืนยันแล้ว · กำลังดำเนินการ (หน้าการดำเนินงานซ่อนจากช่างแล้ว)
 */
const SUBS = [
  { key: "all", label: "ทั้งหมด", color: "#475569" },
  { key: "กำลังรอยืนยัน", label: "รอยืนยัน", color: "#d97706" },
  { key: "ยืนยันแล้ว", label: "ยืนยันแล้ว", color: "#2563eb" },
  { key: "กำลังดำเนินการ", label: "กำลังดำเนินการ", color: "#7c3aed" },
];

/**
 * แถบสรุปงานวันนี้ — วันที่ · จำนวนงาน · ความคืบหน้า (เข้างานแล้ว/ขอปิดงานแล้ว จากทั้งหมด)
 * ตัวเลขชัด สีน้อย: ส้ม = ยังไม่เข้างาน · น้ำเงิน = เข้างานแล้ว · ฟ้าอมเขียว = ขอปิดงานแล้ว
 */
function TodaySummary({ s }) {
  const done = s.checked + s.requested;
  const pct = s.total ? Math.round((done / s.total) * 100) : 0;
  const now = moment().utcOffset(7);
  const items = [
    { n: s.waiting, t: "ยังไม่เข้างาน", c: "#d97706" },
    { n: s.checked, t: "เข้างานแล้ว", c: "#2563eb" },
    { n: s.requested, t: "ขอปิดงานแล้ว", c: "#0891b2" },
  ];
  return (
    <Box sx={{ mb: 1.25, p: { xs: 1.25, md: 1.5 }, borderRadius: 3, bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
      <Stack direction="row" alignItems="baseline" gap={1} sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 900, fontSize: { xs: "0.95rem", md: "1.02rem" }, color: "#0f172a" }}>
          วัน{now.format("dddd")}ที่ {now.format("D MMMM")} {now.year() + 543}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
          เข้างานแล้ว <Box component="span" sx={{ fontWeight: 900, color: "#0f172a" }}>{done}/{s.total}</Box>
        </Typography>
      </Stack>
      <Box sx={{ height: 6, borderRadius: 99, bgcolor: "#eef2f6", overflow: "hidden", mb: 1 }}>
        <Box sx={{ width: `${pct}%`, height: "100%", borderRadius: 99, bgcolor: "#2563eb", transition: "width .4s ease" }} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
        {items.map((x) => (
          <Box key={x.t} sx={{ px: 1, py: 0.6, borderRadius: 2, bgcolor: "#f8fafc", minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", lineHeight: 1.2, color: x.n ? x.c : "#94a3b8" }}>{x.n}</Typography>
            <Typography noWrap sx={{ fontSize: "0.7rem", color: "#64748b" }}>{x.t}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** งานที่นับเป็น "งานวันนี้" (ยังไม่ปิด/ไม่ถูกยกเลิก/ไม่ถูกปฏิเสธ) */
const isTodayOpen = (e) => isTodayJob(e) && e.status !== "ดำเนินการเสร็จสิ้น" && !e.cancelledAt
  && e.approvalStatus !== "rejected" && e.department !== "sales";

const matchesGroup = (event, group, daysPastDueMap, todayKeys) => {
  // งานหลายวัน: มีวันไหนของงานเป็นวันนี้ → เอาทั้งงาน (การ์ดเดียวเห็นครบทุกวัน)
  if (group === "today") return Boolean(todayKeys?.has(getOverdueGroupKey(event))) && event.status !== "ดำเนินการเสร็จสิ้น";
  if (group === "pending") return event.closeRequested === true && event.status !== "ดำเนินการเสร็จสิ้น";
  if (group === "closed") return event.status === "ดำเนินการเสร็จสิ้น";
  const isOverdue = isFlaggedDays(daysPastDueMap.get(event._id)?.days);
  if (group === "overdue") return isOverdue;
  // active: งานที่ยืนยันแล้ว/กำลังดำเนินการ, ยังไม่ได้ขอปิด, และยังไม่เข้าเกณฑ์ค้างงาน
  // (ค้างงานแยกไปแท็บ "ค้างงาน" โดยเฉพาะแล้ว ไม่ต้องซ้ำสองที่)
  // 🐛 (11 ต.ค. 2569 ผู้ใช้: "ทำไมงานที่ได้รับมอบหมายไม่เข้ามางานของฉัน") — เดิมไม่รวม "กำลังรอยืนยัน"
  //    งานที่เพิ่งมอบหมาย (ต้องกดรับทราบ → ยืนยันนัดหมาย ที่นี่) จึงไม่เคยโผล่ในแท็บ "ต้องทำ" เลย
  return ["กำลังรอยืนยัน", "ยืนยันแล้ว", "กำลังดำเนินการ"].includes(event.status)
    && !["pending", "rejected"].includes(event.approvalStatus) && !event.closeRequested && !isOverdue;
};

export default function MyJobs() {
  const { userData } = useAuth() || {};
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setLastRefreshed] = useState(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("today");
  const [sub, setSub] = useState("all");
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");
  // ✅ perf: reference คงที่ — จำเป็นให้แถวไฟล์ที่ memo ไว้ (เทียบ props ด้วย reference) bail out
  // re-render ได้จริง ไม่งั้น prop นี้เปลี่ยนทุกครั้งที่ MyJobs re-render ทำให้ memo ไม่มีผลอะไรเลย
  const [previewList, setPreviewList] = useState(null);
  const handlePreviewFile = useCallback((url, name, list) => { setPreviewUrl(url); setPreviewFileName(name); setPreviewList(Array.isArray(list) ? list : null); }, []);

  const [uploadingState, setUploadingState] = useState({ quotation: null, report: null, invoice: null, completion: null });
  const [uploadProgressState, setUploadProgressState] = useState({ quotation: 0, report: 0, invoice: 0, completion: 0 });
  const [isUploadingState, setIsUploadingState] = useState({ quotation: false, report: false, invoice: false, completion: false });

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ⚠️ detail = ขอ activityLog มาด้วย — การ์ดงานของช่าง (TechnicianJobPanel) แสดงประวัติ
      //    และหน้านี้บันทึกต่อท้ายด้วย ถ้าไม่ขอ ประวัติเดิมจะถูกเขียนทับหาย
      const res = await EventService.getEventOp({ detail: true });
      // ✅ (11 ต.ค. 2569 ผู้ใช้: "งานที่ได้รับมอบหมายไม่เข้ามางานของฉัน แต่ไปเข้าการดำเนินงาน — แอดมิน กับ ผู้รับผิดชอบงาน")
      //    แอดมิน/ผู้จัดการได้งานทั้งระบบจาก API — หน้านี้คัดเหลือเฉพาะงานที่ "ฉัน" ถูกมอบหมาย
      //    (ผู้รับผิดชอบ · หัวหน้าทีม · ลูกทีม) ให้ทุกตำแหน่งเห็นงานของตัวเองที่นี่ที่เดียว
      const uid = String(userData?.userId || "");
      // ✅ (11 ต.ค. 2569) เฉพาะงานที่ฉันเป็น "ผู้รับผิดชอบ" หรือ "หัวหน้าทีม" (ลูกทีมไม่นับ)
      setEvents((res?.userEvents || []).filter((e) => isRespOrHead(e, uid, userData?.fname)));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      if (!silent) setSnackbar({ open: true, msg: "โหลดรายการงานไม่สำเร็จ", severity: "error" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userData?.userId, userData?.fname]);

  useEffect(() => {
    let active = true;
    AuthService.getAllUserData()
      .then((res) => { if (active) setEmployees(res?.allUser || []); })
      .catch((err) => console.error("โหลดรายชื่อสำหรับมอบหมายหัวหน้าทีมไม่สำเร็จ", err));
    return () => { active = false; };
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ✅ เรียลไทม์: แอดมินอนุมัติ/ตีกลับปิดงาน หรือมอบหมายงานใหม่ → เห็นทันที
  useRealtime("events", () => { fetchJobs(true); });

  // ✅ รีเฟรชอัตโนมัติทุก 15 วินาที เพื่อให้เห็นผลอนุมัติ/ไม่อนุมัติปิดงานจากแอดมินแบบ realtime
  useEffect(() => {
    const interval = setInterval(() => fetchJobs(true), 60000); // (11 ต.ค. 2569) 15→60 วิ — เรียลไทม์ด้านบนรับหน้าที่หลักแล้ว ลดโหลดเซิร์ฟเวอร์
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // ✅ (20 ต.ค. 2569 ผู้ใช้: "งานของฉันให้มีงานวันนี้แยกตามเดิม และเด้งงานที่ยังไม่รับทราบ/บันทึกเข้างานขึ้นก่อน กันลืม")
  const todayCheckedIds = useTodayCheckins();
  /** งานกลุ่มนี้ต้องทำอะไรด่วน (checkin/ack/confirm) — ดูทุกวันของงาน */
  const attentionOfGroup = useCallback((sessions) => {
    let best = null;
    sessions.forEach((e) => {
      const k = attentionOf(e, { userId: userData?.userId, fname: userData?.fname, todayCheckedIds });
      if (k && (!best || ATTENTION_META[k].rank < ATTENTION_META[best.k].rank)) best = { k, e };
    });
    return best;
  }, [userData?.userId, userData?.fname, todayCheckedIds]);
  /** ลำดับ: บันทึกเข้างาน 0 · รับทราบ 1 · ยืนยันนัด 2 · งานวันนี้ 3 · อื่นๆ 4 */
  const rankOfGroup = useCallback((sessions) => {
    const a = attentionOfGroup(sessions);
    if (a) return ATTENTION_META[a.k].rank;
    return sessions.some(isTodayJob) ? 3 : 4;
  }, [attentionOfGroup]);

  // ✅ ต้องคำนวณจาก events ทั้งหมด (ไม่ผ่านตัวกรองอื่นมาก่อน) เพื่อให้ทุกกลุ่มงานครบทุกแถวเสมอ
  // เทียบ pattern เดียวกับหน้า Operation
  const daysPastDueMap = useMemo(() => buildDaysPastDueMap(events), [events]);

  // ✅ เดิมนับทุกแถว event ดิบ — งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) ตอนนี้อัปเดตทั้ง
  // กลุ่มพร้อมกันแล้ว (ขอปิดงาน/อนุมัติ/ไม่อนุมัติ ดู handleRequestClose, handleStatusUpdate) ทำให้
  // ตัวเลขบนแท็บเพี้ยนสูงกว่าจำนวนงานจริง (1 งานเข้า 3 วัน ขึ้นเป็น "3 งาน") — จัดกลุ่มด้วย
  // getOverdueGroupKey ก่อนนับ นับแค่ 1 ครั้งต่อกลุ่ม (ทุกวันในกลุ่มเดียวกันควรมีสถานะตรงกันอยู่แล้ว
  // จากการ propagate ทั้งกลุ่มทุกครั้งที่อัปเดต จึงใช้แถวไหนของกลุ่มมาตัดสินก็ได้ผลลัพธ์เดียวกัน)
  const todayKeys = useMemo(() => new Set(events.filter(isTodayOpen).map(getOverdueGroupKey)), [events]);
  const groupCounts = useMemo(() => {
    const counts = { today: todayKeys.size, active: 0, overdue: 0, pending: 0, closed: 0 };
    const seen = new Set();
    events.forEach((e) => {
      const key = getOverdueGroupKey(e);
      if (seen.has(key)) return;
      seen.add(key);
      if (matchesGroup(e, "active", daysPastDueMap)) counts.active += 1;
      else if (matchesGroup(e, "overdue", daysPastDueMap)) counts.overdue += 1;
      else if (matchesGroup(e, "pending", daysPastDueMap)) counts.pending += 1;
      else if (matchesGroup(e, "closed", daysPastDueMap)) counts.closed += 1;
    });
    return counts;
  }, [events, daysPastDueMap, todayKeys]);

  /** สรุปงานวันนี้ (แถบบนสุดของแท็บ "วันนี้") — เข้างานแล้ว · ยังไม่เข้างาน · ขอปิดงานแล้ว */
  const todaySummary = useMemo(() => {
    const byKey = new Map();
    events.forEach((e) => {
      const k = getOverdueGroupKey(e);
      if (!todayKeys.has(k)) return;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(e);
    });
    let checked = 0; let requested = 0; let waiting = 0;
    byKey.forEach((ss) => {
      if (ss.some((e) => e.closeRequested)) requested += 1;
      else if (todayCheckedIds && ss.some((e) => todayCheckedIds.has(String(e._id)))) checked += 1;
      else waiting += 1;
    });
    return { total: byKey.size, checked, requested, waiting };
  }, [events, todayKeys, todayCheckedIds]);

  const subCounts = useMemo(() => {
    const c = { all: 0, "กำลังรอยืนยัน": 0, "ยืนยันแล้ว": 0, "กำลังดำเนินการ": 0 };
    const seen = new Set();
    events.forEach((e) => {
      const key = getOverdueGroupKey(e);
      if (seen.has(key) || !matchesGroup(e, "active", daysPastDueMap)) return;
      seen.add(key);
      c.all += 1;
      if (c[e.status] !== undefined) c[e.status] += 1;
    });
    return c;
  }, [events, daysPastDueMap]);

  // ✅ เปิดหน้ามาครั้งแรก ถ้าไม่มีงานที่ต้องทำแต่มีงานค้าง → พาไปหมวดค้างงานเลย (ไม่ต้องเจอหน้าว่างก่อน)
  const autoPickedRef = useRef(false);
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "งานที่ได้รับมอบหมายคือเด้งไปในงานของฉัน") — แจ้งเตือนมอบหมายงานลิงก์มาที่
  //    /technician/jobs?job=<id> → เลือกหมวดที่งานนั้นอยู่ แล้วเลื่อนไปที่การ์ด + กรอบไฮไลต์ชั่วคราว
  const [searchParams] = useSearchParams();
  const focusJobId = searchParams.get("job") || "";
  const [highlightJob, setHighlightJob] = useState("");
  const [view, setView] = useState(() => initialViewMode("tt-myjobs-view"));
  const changeView = (v) => { setView(v); try { localStorage.setItem("tt-myjobs-view", v); } catch { /* ignore */ } };
  useEffect(() => {
    if (autoPickedRef.current || loading || !events.length) return;
    autoPickedRef.current = true;
    const target = focusJobId && events.find((e) => String(e._id) === focusJobId);
    if (target) {
      const g = GROUPS.find((x) => matchesGroup(target, x.key, daysPastDueMap, todayKeys));
      if (g) setGroup(g.key);
      setHighlightJob(focusJobId);
      return;
    }
    // เปิดหน้ามา: มีงานวันนี้ → แท็บวันนี้ · ไม่มี → งานที่ต้องทำ (ว่างแต่มีงานค้าง → ค้างงาน)
    if (groupCounts.today > 0) return;
    setGroup(groupCounts.active === 0 && groupCounts.overdue > 0 ? "overdue" : "active");
  }, [loading, events, groupCounts, focusJobId, daysPastDueMap, todayKeys]);
  useEffect(() => {
    if (!highlightJob) return undefined;
    const t1 = setTimeout(() => document.getElementById(`myjob-${highlightJob}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    const t2 = setTimeout(() => setHighlightJob(""), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [highlightJob]);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = events.filter((e) => {
      if (!matchesGroup(e, group, daysPastDueMap, todayKeys)) return false;
      if (group === "active" && sub !== "all" && e.status !== sub) return false;
      if (!keyword) return true;
      return [e.company, e.site, e.title, e.system, e.docNo]
        .some((v) => (v || "").toLowerCase().includes(keyword));
    });
    return list.sort((a, b) =>
      group === "closed"
        ? moment(b.start).valueOf() - moment(a.start).valueOf()
        : moment(a.start).valueOf() - moment(b.start).valueOf()
    );
  }, [events, group, search, daysPastDueMap, sub, todayKeys]);

  // ✅ รวมงานที่เข้าหลายวันไม่ติดกัน (jobGroupId/ลายเซ็นเดียวกัน) เป็นการ์ดเดียว แทนที่จะแยกโชว์
  // ซ้ำกันทุกวัน — ลำดับกลุ่มยึดตามลำดับที่ปรากฏครั้งแรกใน filteredJobs (เรียงตามวันที่อยู่แล้ว)
  const jobGroups = useMemo(() => {
    const map = new Map();
    filteredJobs.forEach((ev) => {
      const key = getOverdueGroupKey(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    const list = [...map.values()].map((sessions) =>
      sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start))
    );
    if (group === "closed") return list;
    // เรียงตามความด่วน (ต้องทำก่อน → งานวันนี้ → งานถัดไป) · ในกลุ่มเดียวกันคงลำดับวันที่เดิม
    return list.map((ss, i) => ({ ss, i, r: rankOfGroup(ss) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.ss);
  }, [filteredJobs, group, rankOfGroup]);

  // ✅ (19 ต.ค. 2569 ผู้ใช้: "พร้อมทั้งทำระบบแบ่งหน้าด้วย") การ์ด 10 / ตาราง 20 ต่อหน้า
  //    เปลี่ยนหมวด/ค้นหา/มุมมอง = กลับหน้า 1 · กดลิงก์มาเจาะจงงาน = ไปหน้าที่มีงานนั้นเอง
  const pg = usePaged(jobGroups, view === "table" ? 20 : 10);
  const { setPage } = pg;
  useEffect(() => { setPage(1); }, [group, sub, search, view, setPage]);
  useEffect(() => {
    if (!highlightJob) return;
    const idx = jobGroups.findIndex((ss) => ss.some((x) => String(x._id) === highlightJob));
    if (idx >= 0) setPage(Math.floor(idx / (view === "table" ? 20 : 10)) + 1);
  }, [highlightJob, jobGroups, view, setPage]);
  const goPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };


  // ✅ (9 ต.ค. 2569) ขั้นตอนทำงาน — รับงาน/งานไม่เสร็จ ส่งงานทั้งกลุ่มกลับมา เอามาแทนในหน้าจอเลย
  const handlePatched = useCallback((docs) => {
    if (!docs?.length) return;
    const byId = new Map(docs.map((d) => [d._id, d]));
    setEvents((prev) => prev.map((e) => (byId.has(e._id) ? { ...e, ...byId.get(e._id), activityLog: e.activityLog } : e)));
  }, []);

  const handleInputUpdate = useCallback(async (id, data) => {
    try {
      await EventService.UpdateEvent(id, data);
      setEvents((prev) => prev.map((e) => (e._id !== id ? e : { ...e, ...data, activityLog: data.activityLog ?? e.activityLog })));
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "บันทึกไม่สำเร็จ", severity: "error" });
    }
  }, []);

  // ✅ งานที่เข้าหลายวัน (ผูกด้วย jobGroupId เดียวกัน) ถือเป็นงานเดียวกัน — action บางอย่าง (เช่น
  // "ขอปิดงาน") ต้องอัปเดตทุกวันในกลุ่มพร้อมกัน ไม่งั้นวันที่กดขอไปจะแยกไปอยู่คนละแท็บกับวันที่เหลือ
  // ในกลุ่มเดียวกัน (เทียบ pattern เดียวกับ getGroupEventIds/handleStatusUpdate ในหน้า Operation)
  const getGroupEventIds = useCallback((id) => {
    const target = events.find((e) => e._id === id);
    if (!target?.jobGroupId) return [id];
    return events.filter((e) => e.jobGroupId === target.jobGroupId).map((e) => e._id);
  }, [events]);

  const handleStatusUpdate = useCallback(async (id, updates) => {
    try {
      const ids = getGroupEventIds(id);
      await Promise.all(ids.map((gid) => EventService.UpdateEvent(gid, updates)));
      setEvents((prev) => prev.map((e) => (ids.includes(e._id) ? { ...e, ...updates } : e)));
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "บันทึกไม่สำเร็จ", severity: "error" });
    }
  }, [getGroupEventIds]);

  const handleDeleteFile = useCallback(async (eventId, type, fileId) => {
    try {
      await EventService.DeleteFile(eventId, type, fileId);
      setSnackbar({ open: true, msg: "ลบไฟล์เรียบร้อย", severity: "success" });
      await fetchJobs(true);
    } catch {
      setSnackbar({ open: true, msg: "ลบไฟล์ไม่สำเร็จ", severity: "error" });
    }
  }, [fetchJobs]);

  const handleFileUpload = useCallback(async (fileOrFiles, eventId, type) => {
    const files = Array.from(fileOrFiles?.length !== undefined ? fileOrFiles : [fileOrFiles]);
    if (files.length === 0) return;

    setUploadingState((p) => ({ ...p, [type]: eventId }));
    setIsUploadingState((p) => ({ ...p, [type]: true }));

    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgressState((p) => ({ ...p, [type]: 0 }));
        await EventService.Upload(eventId, files[i], type, {
          // ✅ เดิมหลอดโหลดขึ้น 100% ทันทีที่ส่งไฟล์ครบ (upload transfer เสร็จ) แต่เซิร์ฟเวอร์อาจยัง
          // ประมวลผลต่ออยู่ ทำให้หลอดโหลดเต็ม 100 ทั้งที่ยังไม่เสร็จจริง — จำกัดไว้ที่ 99% ระหว่างส่ง
          // ไฟล์ แล้วค่อยขึ้น 100% ตอน await resolve จริงๆ (เซิร์ฟเวอร์ตอบกลับมาแล้ว)
          onUploadProgress: (pe) => {
            const pct = Math.round((pe.loaded * 100) / pe.total);
            setUploadProgressState((p) => ({ ...p, [type]: Math.min(pct, 99) }));
          },
        });
        setUploadProgressState((p) => ({ ...p, [type]: 100 }));
        successCount++;
      }
      setSnackbar({ open: true, msg: `อัปโหลด ${successCount} ไฟล์เรียบร้อย`, severity: "success" });
    } catch (err) {
      // ✅ บอกเหตุผลจริง (ไฟล์ใหญ่เกิน · ชนิดไม่รองรับ · งานปิดแล้ว) — เดิมขึ้นแค่ "อัปโหลดไม่สำเร็จ"
      const d = err?.response?.data;
      const why = (typeof d === "string" ? d : d?.message || d?.error) || err?.message || "";
      setSnackbar({
        open: true,
        msg: (successCount > 0 ? `อัปโหลดสำเร็จ ${successCount}/${files.length} ไฟล์ (มีไฟล์ที่ล้มเหลว)` : "อัปโหลดไม่สำเร็จ") + (why ? ` — ${why}` : ""),
        severity: "error",
      });
    } finally {
      await fetchJobs(true);
      setIsUploadingState((p) => ({ ...p, [type]: false }));
      setTimeout(() => {
        setUploadingState((p) => ({ ...p, [type]: null }));
        setUploadProgressState((p) => ({ ...p, [type]: 0 }));
      }, 800);
    }
  }, [fetchJobs]);

  // การ์ดของงาน 1 กลุ่ม — ใช้ทั้งมุมมองการ์ดและตอนกางแถวในตาราง (ทำงานได้ครบเหมือนกัน)
  const renderGroup = (sessions) => {
            // ✅ ในแท็บ "ค้างงาน" ให้เห็นความรุนแรงต่างกันชัดๆ ก่อนเปิดการ์ด (เทียบ pattern เดียวกับ
            // หน้า Operation) — เลย 1 สัปดาห์ = แจ้งเตือนสีเหลือง, เลย 2 สัปดาห์ = ค้างงานเต็มตัวสีแดง
            // ✅ เช็คซ้ำด้วย isFlaggedDays อีกชั้น (เทียบ pattern เดียวกับหน้า Operation) กันป้าย
            // "เลยกำหนด" ติดลบไร้ความหมายหลุดมาแสดง ถ้าวันที่คำนวณได้ดันไม่เข้าเกณฑ์ค้างจริง
            // ✅ แสดงทุกหมวด ไม่ใช่เฉพาะแท็บค้างงาน
            const daysPastDueRaw = group === "closed" ? null : daysPastDueMap.get(sessions[0]._id)?.days ?? null;
            const daysPastDue = isFlaggedDays(daysPastDueRaw) ? daysPastDueRaw : null;
            const severeOverdue = isSevereDays(daysPastDue);
            const att = group === "closed" ? null : attentionOfGroup(sessions);
            const attMeta = att ? ATTENTION_META[att.k] : null;
            return (
              <Box key={sessions[0].jobGroupId || sessions[0]._id}
                id={sessions.some((x) => String(x._id) === highlightJob) ? `myjob-${highlightJob}` : undefined}
                sx={sessions.some((x) => String(x._id) === highlightJob) ? { borderRadius: "18px", outline: "3px solid #2563eb", outlineOffset: 2, scrollMarginTop: "80px" } : undefined}>
                {/* ✅ (20 ต.ค. 2569) ป้ายกันลืมเหนือการ์ด: ยังไม่บันทึกเข้างานวันนี้ / ยังไม่รับทราบ / ยังไม่ยืนยันนัด */}
                {attMeta && (
                  <Stack direction="row" alignItems="center" gap={0.75}
                    sx={{ mb: -1.5, pb: 2, pt: 0.75, px: 1.75, borderRadius: "16px 16px 0 0",
                      bgcolor: alpha(attMeta.color, 0.08), border: `1px solid ${alpha(attMeta.color, 0.3)}`, borderBottom: 0 }}>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: attMeta.color, boxShadow: `0 0 0 3px ${alpha(attMeta.color, 0.18)}`, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: attMeta.color }}>{attMeta.short}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.74rem", color: attMeta.color, opacity: 0.85, minWidth: 0 }}>· {attentionDayText(att.e)}{daysPastDue !== null ? ` · เลยกำหนด ${daysPastDue} วัน` : ""}</Typography>
                  </Stack>
                )}
                {!attMeta && daysPastDue !== null && (
                  <Stack direction="row" alignItems="center" gap={0.75}
                    sx={{
                      mb: -1.5, pb: 2, pt: 0.75, px: 1.75, borderRadius: "16px 16px 0 0",
                      bgcolor: severeOverdue ? "#fef2f2" : "#fffbeb", border: `1px solid ${severeOverdue ? "#fecaca" : "#fde68a"}`, borderBottom: 0,
                    }}>
                    <Warning sx={{ fontSize: 16, color: severeOverdue ? "#dc2626" : "#d97706" }} />
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: severeOverdue ? "#b91c1c" : "#92400e" }}>
                      {severeOverdue ? `ค้างงาน ${daysPastDue} วัน` : `เลยกำหนด ${daysPastDue} วัน`}
                    </Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: severeOverdue ? "#b91c1c" : "#92400e", opacity: 0.8 }}>· ส่งงาน/ขอปิดงานด้วย</Typography>
                  </Stack>
                )}
                <JobGroupCard
                  sessions={sessions}
                  userData={userData}
                  employees={employees}
                  onPatched={handlePatched}
                  onInputUpdate={handleInputUpdate}
                  onStatusUpdate={handleStatusUpdate}
                  onFileUpload={handleFileUpload}
                  onDeleteFile={handleDeleteFile}
                  onPreview={handlePreviewFile}
                  uploadingState={uploadingState}
                  isUploadingState={isUploadingState}
                  uploadProgressState={uploadProgressState}
                />
              </Box>
            );
  };

  return (
    // 🔁 (19 ต.ค. 2569 ผู้ใช้: "หน้าคอมแก้ไขขนาดของหน้านี้ ให้สอดคล้องกับจุดอื่นๆ มันดูเล็กไป")
    //    เดิมกว้าง 860px — ใช้ความกว้าง/หัวเพจมาตรฐานเดียวกับทุกหน้า (PageKit) · มือถือเหมือนเดิม
    <Box sx={{ ...PAGE_SX, pb: 4 }}>
      <PageHeader
        icon={<WorkOutline />}
        title="งานของฉัน"
        subtitle={loading ? "กำลังโหลดงาน…" : [
          groupCounts.today > 0 ? `วันนี้ ${groupCounts.today} งาน` : "วันนี้ไม่มีงานเข้า",
          groupCounts.active > 0 ? `ต้องทำทั้งหมด ${groupCounts.active}` : "",
          groupCounts.overdue > 0 ? `ค้าง ${groupCounts.overdue}` : "",
        ].filter(Boolean).join(" · ")}
        actions={(
          <>
            <Stack direction="row" sx={{ display: { xs: "none", md: "flex" }, p: 0.4, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
              {[["card", ViewAgendaOutlined, "การ์ด"], ["table", TableRowsOutlined, "ตาราง"]].map(([k, Ico, label]) => (
                <Box key={k} component="button" type="button" onClick={() => changeView(k)} aria-label={`มุมมอง${label}`}
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 30, px: 1.1, border: 0, borderRadius: 2, cursor: "pointer", font: "inherit", fontSize: "0.78rem", fontWeight: 800,
                    color: view === k ? "#fff" : "#475569", bgcolor: view === k ? "#2563eb" : "transparent" }}>
                  <Ico sx={{ fontSize: 17 }} />{label}
                </Box>
              ))}
            </Stack>
            <Tooltip title="ประวัติเข้างาน"><IconButton component={Link} to="/attendance" aria-label="ประวัติเข้างาน" sx={ICON_BTN_SX}><History sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            <Tooltip title="รีเฟรช"><IconButton onClick={() => fetchJobs()} sx={ICON_BTN_SX}><Refresh sx={{ fontSize: 18 }} /></IconButton></Tooltip>
          </>
        )}
      />

      {/* 🔁 (20 ต.ค. 2569 ผู้ใช้: "แถบด้านบนยังรก กินพื้นที่ ไม่สวย ปรับให้กะทัดรัด แต่ยังดูง่าย")
          • ลิงก์ "ประวัติเข้างาน" ย้ายเป็นปุ่มไอคอนบนหัวหน้า (ไม่กินแถว)
          • หมวด 4 ช่อง = แถบแบ่งช่องแถวเดียวในกรอบเทา (ชื่อ + จำนวน สูง 36) ชุดเดียวกับหน้างานเข้า — ค้างงานตัวเลขแดง */}
      <Stack direction="row" sx={{ mb: 1, p: 0.4, gap: 0.4, borderRadius: 2.5, bgcolor: "#eef2f6", overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {GROUPS.map((g) => {
          const on = group === g.key;
          const n = groupCounts[g.key];
          const hot = g.key === "overdue" && n > 0;
          return (
            <Box key={g.key} component="button" type="button" onClick={() => setGroup(g.key)} title={g.label}
              sx={{
                flex: { xs: "1 0 auto", sm: "1 1 0" }, minWidth: 0, px: { xs: 0.9, sm: 0.5 }, height: { xs: 34, md: 38 }, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.5,
                font: "inherit", cursor: "pointer", border: 0, borderRadius: 2, whiteSpace: "nowrap", overflow: "hidden",
                fontSize: { xs: "0.76rem", md: "0.86rem" }, fontWeight: 800,
                bgcolor: on ? "#fff" : "transparent", color: on ? "#0f172a" : "#64748b",
                boxShadow: on ? "0 1px 3px rgba(15,23,42,.14)" : "none", transition: "background-color .15s",
              }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline-flex" }, color: g.color, "& svg": { fontSize: 15 } }}>{g.icon}</Box>
              {g.short || g.label}
              <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.68rem", fontWeight: 900,
                bgcolor: hot ? "#dc2626" : on ? g.color : "rgba(100,116,139,.14)", color: hot || on ? "#fff" : "#64748b" }}>{n}</Box>
            </Box>
          );
        })}
      </Stack>

      {group === "today" && !loading && todaySummary.total > 0 && <TodaySummary s={todaySummary} />}

      {group === "active" && subCounts.all > 0 && (
        <Stack direction="row" gap={0.5} sx={{ mb: 1, overflowX: "auto", pb: 0.25, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {SUBS.map((x) => {
            const on = sub === x.key;
            const n = subCounts[x.key] || 0;
            return (
              <Box key={x.key} component="button" type="button" onClick={() => setSub(x.key)}
                sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.5, height: { xs: 28, md: 32 }, px: 1.1, borderRadius: 99, font: "inherit", cursor: "pointer",
                  fontSize: { xs: "0.74rem", md: "0.78rem" }, fontWeight: on ? 800 : 600, color: on ? x.color : "#475569",
                  bgcolor: on ? alpha(x.color, 0.1) : "#fff", border: `1.5px solid ${on ? alpha(x.color, 0.6) : "#e2e8f0"}` }}>
                {x.key !== "all" && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: x.color }} />}
                {x.label}
                <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.68rem", fontWeight: 800,
                  bgcolor: on ? x.color : "#f1f5f9", color: on ? "#fff" : "#64748b" }}>{n}</Box>
              </Box>
            );
          })}
        </Stack>
      )}

      <TextField
        fullWidth size="small" placeholder="ค้นหาโครงการ / ไซต์ / ประเภทงาน / เลขเอกสาร"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff", height: { xs: 38, md: 40 }, fontSize: "0.88rem" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      {/* ── รายการงาน ── */}
      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 4 }} />
          ))}
        </Stack>
      ) : filteredJobs.length === 0 ? (
        /* ✅ กล่อง "ไม่มีงาน" เดิมมีแค่ไอคอนจางๆ กับข้อความบรรทัดเดียว แล้วเหลือพื้นที่ว่างทั้งหน้า —
           ช่างที่เปิดมาเจอหน้านี้จะไม่รู้ว่า "ไม่มีงานจริงๆ" หรือ "งานไปอยู่แท็บอื่น" (เช่นอยู่แท็บ
           งานที่ต้องทำ 0 งาน ทั้งที่มีงานค้าง 1 งานรออยู่ในอีกแท็บ) ✅ บอกให้ชัดว่าหมวดอื่นมีงานอยู่กี่งาน
           พร้อมปุ่มกดข้ามไปได้เลย และถ้าไม่เหลืองานที่ไหนจริงๆ ค่อยบอกว่าเคลียร์หมดแล้ว */
        (() => {
          const activeGroup = GROUPS.find((g) => g.key === group);
          // หมวดอื่นที่ยังมีงานค้างอยู่ (ไม่นับ "เสร็จสิ้น" — ไม่ใช่งานที่ต้องลงมือทำแล้ว)
          const otherWithJobs = GROUPS.filter(
            (g) => g.key !== group && g.key !== "closed" && groupCounts[g.key] > 0
          );
          return (
            <Box sx={{
              textAlign: "center", py: 5, px: 2, borderRadius: 3,
              border: "1px dashed #e2e8f0", bgcolor: "#fff",
            }}>
              {activeGroup?.icon && (
                <Box sx={{ opacity: 0.3, mb: 1, color: "text.disabled" }}>
                  {cloneElement(activeGroup.icon, { sx: { fontSize: 40 } })}
                </Box>
              )}
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                {search
                  ? "ไม่พบงานที่ตรงกับคำค้นหา"
                  : group === "today" ? "วันนี้ไม่มีงานเข้า" : `ยังไม่มีงานในหมวด "${activeGroup?.label}"`}
              </Typography>

              {search ? (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                  ลองพิมพ์ชื่อโครงการ ไซต์ หรือเลขเอกสารให้สั้นลง
                </Typography>
              ) : otherWithJobs.length > 0 ? (
                <>
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5, mb: 1.25 }}>
                    แต่ยังมีงานรออยู่ในหมวดอื่น — กดเพื่อดูได้เลย
                  </Typography>
                  <Stack direction="row" gap={0.75} justifyContent="center" flexWrap="wrap">
                    {otherWithJobs.map((g) => (
                      <Chip
                        key={g.key}
                        icon={cloneElement(g.icon, { sx: { fontSize: 15 } })}
                        label={`${g.label} (${groupCounts[g.key]})`}
                        onClick={() => setGroup(g.key)}
                        sx={{
                          fontWeight: 700, fontSize: "0.72rem", cursor: "pointer",
                          bgcolor: alpha(g.color, 0.12), color: g.color,
                          "& .MuiChip-icon": { color: g.color },
                          "&:hover": { bgcolor: alpha(g.color, 0.22) },
                        }}
                      />
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                  เคลียร์งานครบแล้ว 🎉 งานใหม่ที่ถูกมอบหมายจะมาแสดงที่นี่
                </Typography>
              )}
            </Box>
          );
        })()
      ) : (
        view === "table" ? (
          <>
            <MyJobsTable groups={pg.rows} allGroups={jobGroups} highlightJob={highlightJob} renderCard={renderGroup} uid={String(userData?.userId || "")} fname={userData?.fname}
              overdueOf={(ss) => {
                const raw = group === "closed" ? null : daysPastDueMap.get(ss[0]._id)?.days ?? null;
                return isFlaggedDays(raw) ? { days: raw, severe: isSevereDays(raw) } : null;
              }} />
            <PageBar {...pg} setPage={goPage} unit="งาน" />
          </>
        ) : (
          <>
            {/* ✅ (20 ต.ค. 2569) แบ่งหัวข้อ: ต้องทำก่อน · งานวันนี้ · งานถัดไป (หมวดเสร็จสิ้นไม่แบ่ง) */}
            <Stack spacing={2}>{pg.rows.map((sessions, i) => {
              if (group === "closed") return renderGroup(sessions);
              const sec = (ss) => { const r = rankOfGroup(ss); return r <= 2 ? "urgent" : r === 3 ? "today" : "later"; };
              const cur = sec(sessions);
              const prev = i > 0 ? sec(pg.rows[i - 1]) : null;
              const SEC = { urgent: { t: "ต้องทำก่อน · กันลืม", c: "#dc2626" }, today: { t: "งานวันนี้", c: "#2563eb" }, later: { t: "งานถัดไป", c: "#64748b" } };
              const n = pg.rows.filter((ss) => sec(ss) === cur).length;
              return (
                <Box key={sessions[0].jobGroupId || sessions[0]._id}>
                  {cur !== prev && (
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25, mt: i ? 0.5 : 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: SEC[cur].c }} />
                      <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: "#0f172a" }}>{SEC[cur].t}</Typography>
                      <Box component="span" sx={{ px: 0.8, borderRadius: 99, bgcolor: alpha(SEC[cur].c, 0.1), color: SEC[cur].c, fontSize: "0.74rem", fontWeight: 900 }}>{n}</Box>
                      <Box sx={{ flex: 1, height: 1, bgcolor: "#e2e8f0" }} />
                    </Stack>
                  )}
                  {renderGroup(sessions)}
                </Box>
              );
            })}</Stack>
            <PageBar {...pg} setPage={goPage} unit="งาน" />
          </>
        )
      )}

      <FilePreviewDialog
        previewUrl={previewUrl}
        previewFileName={previewFileName}
        gallery={previewList} onNavigate={(f) => { setPreviewUrl(f.fileUrl); setPreviewFileName(f.fileName || ""); }}
        onClose={() => { setPreviewUrl(null); setPreviewFileName(""); setPreviewList(null); }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
