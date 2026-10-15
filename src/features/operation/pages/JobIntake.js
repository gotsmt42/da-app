/**
 * JobIntake — เมนู "รับงาน" (9 ต.ค. 2569)
 *
 * ผู้ใช้: "รับงานคือกรอกรับงานไว้ก่อน ค่อยส่งลงตารางจริง ไม่ต้องอะไรมากมาย ทำให้เข้าใจง่ายๆ"
 *        "ทำให้ขั้นตอนต่างๆ เชื่อมโยงกัน และดูง่าย" · "ไม่ควรเอางานเก่ามารวม"
 *
 *   • เห็นเฉพาะงานที่รับผ่านปุ่ม "รับงานใหม่" (intakeAt) — งานเก่า/งานที่ลงปฏิทินตรงๆ ไม่มาปน
 *   • ทุกงานมีแถบขั้นตอนเดียวกัน: รับงาน → ลงตาราง → ช่างทำงาน → ตรวจปิดงาน → เสร็จ
 *     บอกชัดว่าอยู่ขั้นไหน และปุ่มถัดไปคืออะไร (ส่งลงตาราง / ดูงาน)
 *   • "ส่งลงตาราง" = เลือกวัน + หัวหน้าทีม + ผู้รับผิดชอบงาน ในหน้านี้เลย ไม่ต้องไปลากในปฏิทิน
 *
 * ✅ (15 ต.ค. 2569 ผู้ใช้) "1. ได้รับแจ้งงานมาเช่น PO หรือใบเสนอราคา 2. ลงงานใหม่ โดยลงว่าจากแผนกอะไร
 *    3.1 ถ้ามีเข้างาน ส่งลงตาราง ดำเนินงานแบบเดิม 3.2 ถ้าไม่มีเข้างาน เช่นส่งของ ขายของ ไปขั้นส่งใบวางบิล อัปโหลดบิล"
 *   • ฟอร์มรับงานมี: รับงานจาก (แผนก) · เอกสารต้นทาง + เลขที่ + ไฟล์ · รูปแบบงาน (ต้องเข้างาน / ไม่ต้องเข้างาน)
 *   • งานไม่ต้องเข้างาน: รับงาน → ส่งมอบ → วางบิล (อัปโหลดใบวางบิล) → เสร็จ · ไม่ขึ้นปฏิทิน/งานช่าง
 *     แต่ขึ้นหน้าติดตามวางบิลให้ตามรับเงินต่อ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import Swal from "sweetalert2";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import {
  Box, Stack, Typography, Button, ButtonBase, Skeleton, Dialog, DialogContent, DialogActions, IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PostAddOutlined, AddRounded, EditOutlined, ChevronRight, Close, EventAvailableOutlined,
  ApartmentOutlined, CalendarMonthOutlined, GroupsOutlined, PersonOutlineOutlined, NotesOutlined, HourglassTopRounded, ReportProblemOutlined,
  BlockRounded, RestoreRounded, AssignmentIndOutlined, PersonOffOutlined,
  LocalShippingOutlined, ReceiptLongOutlined, TaskAltRounded, UploadFileOutlined, AttachFileRounded, SourceOutlined, Search,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import CustomerService from "@/shared/services/CustomerService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { useAuth } from "@/features/auth/AuthContext";
import { formatThai } from "@/shared/utils/thaiDate";
import { PageHeader, Panel, EmptyState, INK, MUTED, LINE, ACCENT, SURFACE } from "@/shared/ui/PageKit";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { getAddDraftEvent, INTAKE_SOURCE_OPTS } from "@/features/calendar/components/EventForms/AddDraftEvent";
import { isUrgent, openFollowUp } from "@/shared/utils/jobFlow";
import { MiniSteps } from "@/features/attendance/components/CheckInOutPanel";
import { nextStepOf } from "@/shared/ui/JobFlow";
import { can } from "@/shared/utils/roles";
import PersonSelectField from "@/shared/ui/PersonSelectField";

const AMBER = "#d97706";
const GREEN = "#16a34a";
const RED = "#dc2626";

/** ขั้นตอนของงานที่รับไว้ — ใช้ทั้งแถบขั้นตอนและแท็บ */
// ✅ (11 ต.ค. 2569) "ช่างทำงาน" → "เข้างาน" (ขั้นนี้เริ่มเมื่อหัวหน้าทีมกดเข้างาน — คำเดียวกับการ์ดงาน)
const STAGES = ["รับงาน", "ลงตาราง", "เข้างาน", "ตรวจปิดงาน", "เสร็จ"];
/** ✅ (15 ต.ค. 2569) งานไม่ต้องเข้างาน (ส่งของ/ขายของ) */
const STAGES_NV = ["รับงาน", "ส่งมอบ", "วางบิล", "เสร็จ"];

const SOURCE_LABEL = Object.fromEntries(INTAKE_SOURCE_OPTS);
const DOC_LABEL = { po: "PO", quotation: "ใบเสนอราคา", other: "เอกสาร" };
const invoicedOf = (e) => Boolean((e.invoiceFiles || []).length || e.billing?.invoicedAt);
/** ✅ (15 ต.ค. 2569) บันทึกงาน (โน๊ต) */
const STAGES_NOTE = ["บันทึก", "ทำ", "เสร็จ"];
/** ✅ ค้างขั้นเดิมเกิน 2 วัน (ตรงกับตัวแจ้งเตือนฝั่ง server: checkAndNotifyStalledIntake) — คืนจำนวนวัน หรือ 0 */
const STALL_DAYS = 2;
const stalledDays = (e, st) => {
  const since = st.i === 0 ? e.intakeAt : st.nv && st.i === 2 ? (e.deliveredAt || e.scheduledAt) : null;
  if (!since) return 0;
  const d = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
  return d >= STALL_DAYS ? d : 0;
};

/** งานนี้อยู่ขั้นไหน + ข้อความสถานะ (bar = ตำแหน่งในแถบขั้นตอนของงานไม่ต้องเข้างาน) */
const stageOf = (e) => {
  if (e.cancelledAt) return { i: -1, label: "ยกเลิกแล้ว", color: MUTED };
  if (e.intakeNote) {
    return e.noteDoneAt
      ? { i: 4, label: "ทำแล้ว", color: GREEN, note: true, bar: STAGES_NOTE.length }
      : { i: 0, label: "รอทำ", color: AMBER, note: true, bar: 1 };
  }
  if (e.noVisit) {
    if (e.unscheduled) return { i: 0, label: "รอส่งมอบ", color: AMBER, nv: true, bar: 0 };
    if (invoicedOf(e)) return { i: 4, label: "วางบิลแล้ว", color: GREEN, nv: true, bar: STAGES_NV.length };
    return { i: 2, label: "รอวางบิล", color: AMBER, nv: true, bar: 2 };
  }
  if (e.unscheduled) return { i: 0, label: "รอส่งลงตาราง", color: AMBER };
  if (e.status === "ดำเนินการเสร็จสิ้น") return { i: 4, label: "เสร็จสิ้น", color: GREEN };
  if (e.closeRequested) return { i: 3, label: "รอตรวจปิดงาน", color: ACCENT };
  if (openFollowUp(e)) return { i: 2, label: `งานไม่เสร็จ · ${openFollowUp(e).reason}`, color: AMBER };
  if (e.status === "กำลังดำเนินการ") return { i: 2, label: "กำลังดำเนินการ", color: ACCENT };
  return { i: 1, label: "ลงตารางแล้ว", color: ACCENT };
};

const TABS = [
  { key: "waiting", label: "รอดำเนินการ", short: "รอเริ่ม", test: (s) => s.i === 0 },
  { key: "active", label: "กำลังดำเนินการ", short: "กำลังทำ", test: (s) => s.i >= 1 && s.i <= 3 },
  { key: "done", label: "เสร็จแล้ว", short: "เสร็จแล้ว", test: (s) => s.i === 4 },
  // ✅ แท็บ "ยกเลิก" โชว์เฉพาะตอนมีงานที่ยกเลิก (ไม่กินที่บนมือถือโดยไม่จำเป็น)
  { key: "cancelled", label: "ยกเลิก", short: "ยกเลิก", test: (s) => s.i === -1, hideEmpty: true },
];

const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", fontSize: "0.82rem" };
const PRIMARY = { ...BTN, bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } };

/** แถบขั้นตอน 5 ช่อง — ผ่านแล้วสีเขียว · ขั้นปัจจุบันสีของสถานะ · ยังไม่ถึงสีเทา (กว้างเท่ากันทุกจอ ไม่ล้น) */
// ✅ (11 ต.ค. 2569 ผู้ใช้: "สายขั้นตอนควรเป็นสีสัน รูปแบบเดียวกันทั้งหมดที่เกี่ยวข้องกัน") — ใช้แถบขั้นตอนตัวเดียวกับการ์ดงาน
//    (วงเขียว ✓ = ผ่านแล้ว · วงน้ำเงินมีเลข = ขั้นปัจจุบัน · วงขาว = ยังไม่ถึง) แทนแถบสีเดิม
function StageBar({ stage }) {
  return (
    <Box sx={{ mt: 1.25 }}>
      <MiniSteps labels={stage.note ? STAGES_NOTE : stage.nv ? STAGES_NV : STAGES} current={stage.note || stage.nv ? stage.bar : stage.i === 4 ? STAGES.length : stage.i} />
    </Box>
  );
}

/** หัวข้อย่อยในกล่องส่งลงตาราง: เลขลำดับ + ชื่อ + คำอธิบายสั้น */
const Section = ({ n, title, hint, last, children }) => (
  <Box sx={{ pb: last ? 0 : 2, mb: last ? 0 : 2, borderBottom: last ? 0 : `1px dashed ${LINE}` }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT, fontSize: "0.72rem", fontWeight: 900 }}>{n}</Box>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>{title}</Typography>
    </Stack>
    {children}
    {hint && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.6, px: 0.25 }}>{hint}</Typography>}
  </Box>
);

/**
 * กล่องส่งลงตาราง — เลือกวันเริ่ม/วันสิ้นสุด หัวหน้าทีม และผู้รับผิดชอบงาน
 *
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ให้เลือกผู้รับผิดชอบงานได้ด้วย ให้สมบูรณ์และสอดคล้อง")
 *   • หัวหน้าทีม = คนที่เข้างานรอบนี้ (team/resPerson) · ผู้รับผิดชอบงาน = คนดูแลทั้งงาน (responsiblePerson)
 *     — แยกกันแบบเดียวกับหัวกล่องแก้ไขงาน (EditEvent) และหน้าภาพรวมงาน
 *   • บันทึกผู้รับผิดชอบผ่าน /events/basic-info ตัวเดียวกับหน้าอื่น → ทุกหน้าเห็นชื่อเดียวกัน
 *   • มอบหมายได้เฉพาะผู้มีสิทธิ์ editContracts (เหมือน EditEvent · server เช็คซ้ำ) — คนอื่นเห็นชื่อแต่เลือกไม่ได้
 */
function ScheduleDialog({ job, employees, canAssignResponsible, onClose, onDone }) {
  const defStart = job.plannedMonth && job.plannedMonth > moment().format("YYYY-MM")
    ? moment(job.plannedMonth, "YYYY-MM").startOf("month").format("YYYY-MM-DD")
    : moment().add(1, "day").format("YYYY-MM-DD");
  const [start, setStart] = useState(defStart);
  const [end, setEnd] = useState(defStart);
  const [team, setTeam] = useState(job.team || "");
  const initialResp = job.responsiblePerson || "";
  const [resp, setResp] = useState(initialResp);
  const [saving, setSaving] = useState(false);
  const people = useMemo(
    () => employees.filter((u) => u.fname).slice().sort((a, b) => a.fname.localeCompare(b.fname, "th")),
    [employees],
  );
  // ✅ (10 ต.ค. 2569 ผู้ใช้: "ผู้รับผิดชอบงานขึ้นก่อน และทำ UI ให้สวยงาม เห็นรูปด้วย") — ช่องเลือกชื่อแบบมีรูป
  //    ตัวเดียวกับหน้าภาพรวมงาน/ใบเบิก (PersonSelectField) · ชื่อเดิมที่ไม่อยู่ในรายชื่อพนักงานแล้วยังต้องเห็นอยู่
  const optionsWith = (v) => [
    ...people.map((u) => ({ id: u.fname, name: [u.fname, u.lname].filter(Boolean).join(" "), avatar: u.imageUrl, note: u.jobTitle || undefined })),
    ...(v && !people.some((u) => u.fname === v) ? [{ id: v, name: v }] : []),
  ];
  const PICK = { width: "100%", height: 48, borderRadius: 2.5 };
  const ok = start && (!end || end >= start);

  const save = async () => {
    if (!ok) return;
    setSaving(true);
    try {
      const emp = employees.find((u) => u.fname === team);
      const last = end || start;
      await EventService.ScheduleDraftEvent(job._id, {
        date: start, start, end: moment(last).add(1, "day").format("YYYY-MM-DD"),
        ...(team ? { team, resPerson: emp?._id || "" } : {}),
      });
      // ผู้รับผิดชอบงาน — หลังลงตารางสำเร็จเท่านั้น (ถ้าส่งลงตารางไม่ผ่าน จะไม่มีอะไรถูกเปลี่ยน)
      let respFailed = false;
      if (canAssignResponsible && resp !== initialResp) {
        const person = people.find((u) => u.fname === resp);
        try {
          await EventService.UpdateBasicInfo([job._id], { responsiblePerson: resp, responsiblePersonId: person?._id ? String(person._id) : "" });
        } catch {
          respFailed = true;
        }
      }
      onDone();
      if (respFailed) {
        Swal.fire({ icon: "warning", title: "ส่งลงตารางแล้ว", text: "แต่บันทึกผู้รับผิดชอบงานไม่สำเร็จ — แก้ได้จากหน้าแก้ไขงาน" });
        return;
      }
      Swal.fire({ icon: "success", title: "ส่งลงตารางแล้ว", text: "งานขึ้นในตารางงานช่างเรียบร้อย", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ส่งลงตารางไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <EventAvailableOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>ส่งลงตาราง</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, pt: "20px !important", pb: 2 }}>
        {/* ✅ ลำดับ: ผู้รับผิดชอบงาน (ดูแลทั้งงาน) → วันเข้างาน → หัวหน้าทีมที่เข้างาน (รอบนี้) */}
        <Section n={1} title="ผู้รับผิดชอบงาน" hint={canAssignResponsible ? "ดูแลงานนี้ทั้งงาน ตั้งแต่ลงตารางจนปิดงาน" : "มอบหมายได้เฉพาะแอดมิน/ผู้จัดการ"}>
          <PersonSelectField
            label="" title="เลือกผู้รับผิดชอบงาน" value={resp} onChange={setResp}
            allValue="" allLabel="ยังไม่ได้มอบหมาย" allIcon={PersonOffOutlined}
            options={optionsWith(resp)} disabled={!canAssignResponsible} sx={PICK}
          />
        </Section>
        <Section n={2} title="วันเข้างาน">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
            <ThaiDatePicker label="วันที่เข้างาน" value={start} onChange={(v) => { setStart(v || ""); if (!end || (v && end < v)) setEnd(v || ""); }} />
            <ThaiDatePicker label="ถึงวันที่" value={end} onChange={(v) => setEnd(v || "")} minDate={start ? moment(start) : undefined} />
          </Box>
        </Section>
        <Section n={3} title="หัวหน้าทีมที่เข้างาน" hint="นำทีมเข้าหน้างานรอบนี้ · ไม่บังคับ มอบหมายทีหลังได้" last>
          <PersonSelectField
            label="" title="เลือกหัวหน้าทีม" value={team} onChange={setTeam}
            allValue="" allLabel="ยังไม่ระบุ" allIcon={PersonOffOutlined}
            options={optionsWith(team)} sx={PICK}
          />
        </Section>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE }}>
          ส่งแล้วงานจะขึ้นในตารางงานช่างทันที · เวลา/ลูกทีมเพิ่มได้ภายหลังจากหน้าตารางงาน
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!ok || saving} onClick={save} sx={{ ...PRIMARY, px: 2.5 }}>
          {saving ? "กำลังส่ง..." : "ส่งลงตาราง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * ✅ (15 ต.ค. 2569) ส่งมอบงานที่ไม่ต้องเข้างาน (ส่งของ/ขายของ) — วันที่ส่งมอบ + แนบใบวางบิลได้เลย (ไม่บังคับ)
 *    แนบใบวางบิลแล้ว = งานเสร็จในหน้านี้ · ยังไม่แนบ = ค้างที่แท็บ "กำลังดำเนินการ" ขั้น "รอวางบิล"
 */
function DeliverDialog({ job, onClose, onDone }) {
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await EventService.DeliverJob(job._id, { date });
      let failed = 0;
      for (const f of files) {
        try { await EventService.Upload(job._id, f, "invoice"); } catch { failed += 1; }
      }
      onDone();
      Swal.fire(failed
        ? { icon: "warning", title: "บันทึกส่งมอบแล้ว", text: `แต่แนบใบวางบิลไม่สำเร็จ ${failed} ไฟล์ — กด “อัปโหลดใบวางบิล” ที่การ์ดงานอีกครั้ง` }
        : { icon: "success", title: files.length ? "ส่งมอบ + วางบิลแล้ว" : "บันทึกส่งมอบแล้ว", text: files.length ? "ตามรับเงินต่อได้ที่หน้าติดตามวางบิล" : "ขั้นถัดไป: อัปโหลดใบวางบิล", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <LocalShippingOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>ส่งมอบแล้ว</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, pt: "20px !important", pb: 2 }}>
        <Section n={1} title="วันที่ส่งมอบ / ส่งของ">
          <ThaiDatePicker label="วันที่ส่งมอบ" value={date} onChange={(v) => setDate(v || "")} />
        </Section>
        <Section n={2} title="ใบวางบิล" hint="ไม่บังคับ — ยังไม่มีบิล กดบันทึกไปก่อน แล้วอัปโหลดทีหลังที่การ์ดงาน" last>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />} sx={{ ...BTN, color: "#334155", borderColor: LINE }}>
            {files.length ? `เลือกแล้ว ${files.length} ไฟล์` : "เลือกไฟล์ใบวางบิล"}
            <input hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles([...(e.target.files || [])])} />
          </Button>
          {files.length > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, overflowWrap: "anywhere" }}>{files.map((f) => f.name).join(", ")}</Typography>
          )}
        </Section>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE }}>
          งานไม่ต้องเข้างานจะไม่ขึ้นในตารางงานช่าง · ตามรับเงินต่อได้ที่หน้าติดตามวางบิล
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!date || saving} onClick={save} sx={{ ...PRIMARY, px: 2.5 }}>
          {saving ? "กำลังบันทึก..." : "บันทึกส่งมอบ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** ลิงก์ไฟล์เล็กๆ (เอกสารรับงาน / ใบวางบิล) — กดเปิดในแท็บใหม่ */
const FileLinks = ({ files }) => (
  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.25, pl: 2.6 }}>
    {files.map((f) => (
      <Box key={f._id || f.fileUrl} component="a" href={f.fileUrl} target="_blank" rel="noreferrer"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, maxWidth: 220, px: 0.9, height: 24, borderRadius: 99, border: `1px solid ${LINE}`, bgcolor: "#fff", color: "#334155", fontSize: "0.72rem", fontWeight: 700, textDecoration: "none", "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
        <AttachFileRounded sx={{ fontSize: 13 }} />
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName || "ไฟล์"}</Box>
      </Box>
    ))}
  </Stack>
);

/** บรรทัดข้อมูล: ไอคอน + ข้อความ (ตัดบรรทัดได้ ไม่ล้น) */
const Line = ({ icon: Icon, children, color = "#475569", strong }) => (
  <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
    <Icon sx={{ fontSize: 15, color: "#94a3b8", mt: "2px", flexShrink: 0 }} />
    <Typography sx={{ fontSize: "0.8rem", color, fontWeight: strong ? 700 : 500, lineHeight: 1.45, minWidth: 0, overflowWrap: "anywhere" }}>{children}</Typography>
  </Stack>
);

function JobCard({ job, onSchedule, onDeliver, onUploadInvoice, onNoteDone, onEdit, onCancel, onRestore }) {
  const st = stageOf(job);
  const stall = stalledDays(job, st);
  const intakeDocs = (job.sitePhotoFiles || []).filter((f) => f.source === "intake");
  const invoiceFiles = job.invoiceFiles || [];
  const [uploading, setUploading] = useState(false);
  const fu = openFollowUp(job);
  const team = [job.team, ...(job.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
  const when = job.noVisit && !job.unscheduled
    ? `ส่งมอบ ${formatThai(moment(job.deliveredAt || job.start), "D MMM YYYY")}`
    : job.unscheduled
    ? (job.plannedMonth ? `ตั้งใจเข้างาน ${formatThai(moment(job.plannedMonth, "YYYY-MM"), "MMMM YYYY")}` : "ยังไม่กำหนดเดือน")
    : `เข้างาน ${formatThai(moment(job.start), "D MMM YYYY")}${job.startTime ? ` ${job.startTime}` : ""}`;
  const due = job.dueDate ? formatThai(moment(job.dueDate), "D MMM YYYY") : "";

  const GHOST = { ...BTN, color: "#334155", borderColor: LINE, "&:hover": { borderColor: "#cbd5e1", bgcolor: SURFACE } };
  const actions = st.i === -1 ? (
    <Button variant="outlined" onClick={() => onRestore(job)} startIcon={<RestoreRounded sx={{ fontSize: "17px !important" }} />}
      sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>นำกลับมา</Button>
  ) : st.note ? (
    st.i === 0 ? (
      <>
        <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
          sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
        <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
          sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
        <Button variant="contained" onClick={() => onNoteDone(job)} startIcon={<TaskAltRounded sx={{ fontSize: "17px !important" }} />}
          sx={{ ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } }}>ทำเสร็จแล้ว</Button>
      </>
    ) : (
      <Button variant="outlined" onClick={() => onNoteDone(job, true)} startIcon={<RestoreRounded sx={{ fontSize: "17px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>นำกลับมาทำต่อ</Button>
    )
  ) : st.nv && st.i === 0 ? (
    <>
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onDeliver(job)} startIcon={<LocalShippingOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } }}>ส่งมอบแล้ว</Button>
    </>
  ) : st.nv ? (
    <>
      <Button component={Link} to="/finance?tab=billing" variant="outlined" startIcon={<ReceiptLongOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>ติดตามวางบิล</Button>
      <Button component="label" variant={st.i === 2 ? "contained" : "outlined"} disabled={uploading} startIcon={<UploadFileOutlined sx={{ fontSize: "17px !important" }} />}
        sx={st.i === 2 ? { ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } } : { ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>
        {uploading ? "กำลังอัปโหลด..." : st.i === 2 ? "อัปโหลดใบวางบิล" : "แนบบิลเพิ่ม"}
        <input hidden type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={async (e) => {
          const picked = [...(e.target.files || [])];
          e.target.value = "";
          if (!picked.length) return;
          setUploading(true);
          await onUploadInvoice(job, picked);
          setUploading(false);
        }} />
      </Button>
    </>
  ) : st.i === 0 ? (
    <>
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onSchedule(job)} startIcon={<EventAvailableOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } }}>ส่งลงตาราง</Button>
    </>
  ) : (
    <Button component={Link} to={`/operation/${job._id}`} variant="outlined" endIcon={<ChevronRight />}
      sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { borderColor: ACCENT, bgcolor: alpha(ACCENT, 0.04) } }}>ดูงาน</Button>
  );

  return (
    <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.75, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.25, sm: 2 }} alignItems={{ sm: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* หัว: สถานะ · เลข Job · ป้าย */}
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5, mb: 0.6 }}>
            <Box component="span" sx={{ px: 1, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, color: st.color, bgcolor: alpha(st.color, 0.1) }}>{st.label}</Box>
            {job.jobNo && <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{job.jobNo}</Typography>}
            {isUrgent(job) && st.i < 4 && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: "#fff", bgcolor: RED }}>⚡ ด่วน</Box>
            )}
            {stall > 0 && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: RED, bgcolor: alpha(RED, 0.08) }}>⏰ ค้าง {stall} วัน</Box>
            )}
            {job.intakeNote && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", gap: 0.4, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: "#334155", bgcolor: SURFACE, border: `1px solid ${LINE}` }}>
                <NotesOutlined sx={{ fontSize: 13 }} /> บันทึกงาน
              </Box>
            )}
            {job.noVisit && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", gap: 0.4, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: "#334155", bgcolor: SURFACE, border: `1px solid ${LINE}` }}>
                <LocalShippingOutlined sx={{ fontSize: 13 }} /> ไม่ต้องเข้างาน
              </Box>
            )}
            {job.infoPending && st.i < 4 && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: AMBER, bgcolor: alpha(AMBER, 0.12) }}>รอข้อมูล</Box>
            )}
          </Stack>
          {/* ชื่องาน · โครงการ — ตัดบรรทัดได้ ไม่ตัดทิ้ง */}
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK, lineHeight: 1.35, overflowWrap: "anywhere", whiteSpace: job.intakeNote ? "pre-line" : undefined }}>
            {job.intakeNote ? (job.description || "บันทึกงาน") : <>{job.title || "งาน"}{job.system ? ` · ${job.system}` : ""}</>}
          </Typography>
          <Stack spacing={0.35} sx={{ mt: 0.6 }}>
            {!(job.intakeNote && (!job.site || job.site === "-")) && <Line icon={ApartmentOutlined} strong>{[job.site, job.company && job.company !== job.site ? job.company : ""].filter(Boolean).join(" · ") || "-"}</Line>}
            {(job.intakeSource || job.intakeDocType || job.intakeDocNo) && (
              <Line icon={SourceOutlined}>
                {[job.intakeSource ? `รับงานจาก${SOURCE_LABEL[job.intakeSource] || job.intakeSource}` : "",
                  job.intakeDocType || job.intakeDocNo ? `${DOC_LABEL[job.intakeDocType] || "เอกสาร"}${job.intakeDocNo ? ` ${job.intakeDocNo}` : ""}` : ""].filter(Boolean).join(" · ")}
              </Line>
            )}
            {intakeDocs.length > 0 && <FileLinks files={intakeDocs} />}
            {job.intakeNote
              ? <Line icon={CalendarMonthOutlined}>{job.noteDoneAt ? `ทำเสร็จ ${formatThai(moment(job.noteDoneAt), "D MMM YYYY HH:mm")}${job.noteDoneBy ? ` · ${job.noteDoneBy}` : ""}` : `บันทึกเมื่อ ${formatThai(moment(job.intakeAt), "D MMM YYYY")}`}{due ? ` · ต้องเสร็จภายใน ${due}` : ""}</Line>
              : <Line icon={CalendarMonthOutlined}>{when}{due ? ` · ต้องเสร็จภายใน ${due}` : ""}</Line>}
            {job.noVisit && invoiceFiles.length > 0 && (
              <>
                <Line icon={ReceiptLongOutlined} color={GREEN} strong>ใบวางบิล {invoiceFiles.length} ไฟล์</Line>
                <FileLinks files={invoiceFiles} />
              </>
            )}
            {!job.unscheduled && !job.noVisit && <Line icon={GroupsOutlined}>{team ? `ทีม ${team}` : "ยังไม่มอบหมายทีม"}</Line>}
            {(job.responsiblePerson || (!job.noVisit && !job.intakeNote && !job.unscheduled)) && (
              <Line icon={AssignmentIndOutlined}>{job.responsiblePerson ? `ผู้รับผิดชอบ ${job.responsiblePerson}` : "ยังไม่มอบหมายผู้รับผิดชอบ"}</Line>
            )}
            {(job.contactName || job.contactTel) && (
              <Line icon={PersonOutlineOutlined}>
                {job.contactName || "ผู้ติดต่อ"}
                {job.contactTel && <> · <Box component="a" href={`tel:${job.contactTel}`} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{job.contactTel}</Box></>}
              </Line>
            )}
            {job.description && !job.intakeNote && <Line icon={NotesOutlined}>{job.description}</Line>}
            {job.infoPending && job.infoPendingNote && <Line icon={HourglassTopRounded} color={AMBER}>ขาด: {job.infoPendingNote}</Line>}
            {fu && st.i === 2 && <Line icon={ReportProblemOutlined} color={AMBER} strong>{fu.reason}{fu.note ? ` — ${fu.note}` : ""} · ผู้รับผิดชอบต่อ: {fu.nextOwner}</Line>}
            {st.i === -1 && (
              <Line icon={BlockRounded} color={RED} strong>
                เหตุผล: {job.cancelReason || "-"} · ยกเลิกโดย {job.cancelledBy || "-"} {formatThai(moment(job.cancelledAt), "D MMM YYYY HH:mm")}
              </Line>
            )}
          </Stack>
          {st.i >= 0 && <StageBar stage={st} />}
          {/* ✅ บอกชัดว่าต่อไปต้องทำอะไร (ตัวเดียวกับกล่อง "ขั้นตอนถัดไป" ในหน้าการดำเนินงาน) */}
          {(() => {
            const nx = job.cancelledAt ? null : st.note
              ? (st.i === 0 ? { title: "ทำงานนี้", desc: "เสร็จแล้วกด “ทำเสร็จแล้ว”" } : null)
              : st.nv
              ? (st.i === 0 ? { title: "ส่งมอบ", desc: "ส่งของ/ส่งมอบให้ลูกค้าแล้ว กด “ส่งมอบแล้ว” (แนบใบวางบิลได้เลย)" }
                : st.i === 2 ? { title: "วางบิล", desc: "กด “อัปโหลดใบวางบิล” แนบไฟล์บิล แล้วตามรับเงินที่หน้าติดตามวางบิล" } : null)
              : job.unscheduled
              ? { title: "ส่งลงตาราง", desc: "กด “ส่งลงตาราง” เลือกวันเข้างาน ผู้รับผิดชอบงาน และหัวหน้าทีม" }
              : st.i >= 0 && st.i < 4 ? nextStepOf(job, "admin") : null;
            return nx ? (
              <Typography sx={{ fontSize: "0.78rem", color: "#334155", mt: 0.75 }}>
                {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "คำว่าต่อไปให้ใช้คำใหม่ ดูแล้วงง" → เลือก "ไม่ต้องมีคำนำหน้า") — จุดสี + ข้อความโทนเดียวกับการ์ด */}
                <Box component="span" sx={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: nx.tone || AMBER, mr: 0.75, verticalAlign: "1px" }} />
                <Box component="span" sx={{ fontWeight: 800, color: INK }}>{nx.title}</Box> — {nx.desc}
              </Typography>
            ) : null;
          })()}
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>{actions}</Stack>
      </Stack>
    </Box>
  );
}

export default function JobIntake() {
  const { userData } = useAuth() || {};
  const [jobs, setJobs] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [rawDrafts, setRawDrafts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("waiting");
  const [scheduling, setScheduling] = useState(null);
  const [delivering, setDelivering] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const [dr, ev] = await Promise.all([
        EventService.GetDraftEvents({ includeCancelled: true }).catch(() => null),
        EventService.getEventOp().catch(() => null),
      ]);
      const drafts = Array.isArray(dr?.drafts) ? dr.drafts : [];
      const events = ev?.userEvents || [];
      setRawDrafts(drafts.filter((d) => !d.cancelledAt));
      setRawEvents(events);
      // ✅ เฉพาะงานที่รับผ่านเมนูนี้ — งานหลายวันรวมเป็นงานเดียว (ใช้วันแรก)
      const seen = new Set();
      const list = [...drafts, ...events.slice().sort((a, b) => new Date(a.start) - new Date(b.start))]
        .filter((e) => e.intakeAt)
        .filter((e) => { const k = e.jobGroupId || e._id; if (seen.has(k)) return false; seen.add(k); return true; });
      setJobs(list);
    } catch {
      setJobs((p) => p || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { AuthService.getAllUserData().then((r) => setEmployees(r?.allUser || [])).catch(() => {}); }, []);
  useRealtime("events", () => { load(); });

  const openForm = (existingDraft) => getAddDraftEvent({
    intake: true,
    defaultMonth: moment().format("YYYY-MM"),
    existingDraft,
    events: rawEvents,
    drafts: rawDrafts,
    userData,
    onSaved: async () => { await load(); refreshAppBadges(); setTab("waiting"); },
    CustomerService, AuthService, JobTypeService, SystemTypeService, EventService, Swal, TomSelect, moment,
  });

  // ✅ ยกเลิกงานที่รับไว้แต่ไม่ได้ทำ — บังคับเหตุผล · เก็บไว้ในแท็บ "ยกเลิก" นำกลับมาได้
  const cancelJob = async (job) => {
    const r = await Swal.fire({
      title: "ยกเลิกงานนี้?",
      html: `<div style="font-size:14px;color:#475569">${[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</div>`,
      input: "textarea",
      inputLabel: "เหตุผลที่ยกเลิก",
      inputPlaceholder: "เช่น ลูกค้ายกเลิก / ได้ช่างที่อื่นแล้ว / รับงานซ้ำ",
      inputValidator: (v) => (!String(v || "").trim() ? "กรุณาระบุเหตุผล" : undefined),
      showCancelButton: true,
      confirmButtonText: "ยกเลิกงาน",
      cancelButtonText: "ไม่ยกเลิก",
      confirmButtonColor: RED,
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    try {
      await EventService.CancelIntake(job._id, { reason: r.value });
      await load(); refreshAppBadges();
      Swal.fire({ icon: "success", title: "ยกเลิกงานแล้ว", text: "ดูย้อนหลังได้ที่แท็บ “ยกเลิก”", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ยกเลิกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };
  // ✅ (15 ต.ค. 2569) บันทึกงาน → ทำเสร็จแล้ว / นำกลับมาทำต่อ
  const noteDone = async (job, undo = false) => {
    try {
      await EventService.NoteDone(job._id, undo ? { undo: true } : {});
      await load(); refreshAppBadges();
      if (undo) setTab("waiting");
      Swal.fire({ icon: "success", title: undo ? "นำกลับมาทำต่อแล้ว" : "ทำเสร็จแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };
  // ✅ (15 ต.ค. 2569) อัปโหลดใบวางบิลของงานไม่ต้องเข้างาน
  const uploadInvoice = async (job, files) => {
    let failed = 0;
    for (const f of files) {
      try { await EventService.Upload(job._id, f, "invoice"); } catch { failed += 1; }
    }
    await load(); refreshAppBadges();
    Swal.fire(failed
      ? { icon: "warning", title: "อัปโหลดไม่ครบ", text: `ไม่สำเร็จ ${failed} จาก ${files.length} ไฟล์ — ลองใหม่อีกครั้ง` }
      : { icon: "success", title: "แนบใบวางบิลแล้ว", text: "ตามรับเงินต่อได้ที่หน้าติดตามวางบิล", timer: 1600, showConfirmButton: false });
  };
  const restoreJob = async (job) => {
    try {
      await EventService.CancelIntake(job._id, { restore: true });
      await load(); refreshAppBadges(); setTab("waiting");
      Swal.fire({ icon: "success", title: "นำงานกลับมาแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };

  const withStage = useMemo(() => (jobs || []).map((j) => ({ j, s: stageOf(j) })), [jobs]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, withStage.filter((x) => t.test(x.s)).length])), [withStage]);
  const list = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    // ✅ ค้นหา: ชื่องาน · โครงการ · บริษัท · เลข Job · เลขเอกสาร · ผู้รับผิดชอบ
    const kw = q.trim().toLowerCase();
    const hit = (j) => !kw || [j.title, j.system, j.site, j.company, j.jobNo, j.intakeDocNo, j.responsiblePerson, j.description]
      .some((v) => String(v || "").toLowerCase().includes(kw));
    return withStage.filter((x) => t.test(x.s) && hit(x.j)).map((x) => x.j)
      // ✅ (11 ต.ค. 2569 ผู้ใช้: "งานใหม่ที่ลงตารางควรมาที่บนสุดด้วย") — ล่าสุดขึ้นก่อนทุกแท็บ
      //    กำลังทำ = เรียงตามเวลาส่งลงตาราง (scheduledAt) · รอลงตาราง = งานด่วนก่อน แล้วรับเข้าล่าสุด · เสร็จแล้ว = ปิดล่าสุด
      .sort((a, b) => (tab === "done"
        ? new Date(b.closeApprovedAt || b.updatedAt || 0) - new Date(a.closeApprovedAt || a.updatedAt || 0)
        : tab === "active"
          ? new Date(b.scheduledAt || b.createdAt || b.intakeAt || 0) - new Date(a.scheduledAt || a.createdAt || a.intakeAt || 0)
          : (isUrgent(b) - isUrgent(a)) || new Date(b.intakeAt || 0) - new Date(a.intakeAt || 0)));
  }, [withStage, tab, q]);

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1000, mx: "auto" }}>
      <PageHeader icon={<PostAddOutlined />} title="งานใหม่"
        subtitle="รับงาน → ส่งลงตาราง หรือ ส่งมอบ + วางบิล"
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} disabled={!jobs} sx={{ ...PRIMARY, height: 40, px: { xs: 1.25, sm: 2 } }}>รับงานใหม่</Button>} />

      {/* แท็บตามขั้นตอน */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5 }}>
        {TABS.filter((t) => !t.hideEmpty || counts[t.key] > 0 || tab === t.key).map((t) => {
          const on = tab === t.key;
          return (
            <ButtonBase key={t.key} onClick={() => setTab(t.key)} sx={{
              // ✅ มือถือ: ตัวเลขบน ชื่อล่าง — 4 แท็บไม่ล้นจอ (ผู้ใช้แจ้งแท็บแรกตกขอบ)
              flex: { xs: 1, sm: "0 0 auto" }, minWidth: 0, height: { xs: 54, sm: 40 }, px: { xs: 0.5, sm: 1.75 }, borderRadius: 2.5,
              flexDirection: { xs: "column-reverse", sm: "row" }, fontSize: { xs: "0.74rem", sm: "0.84rem" }, fontWeight: 800, gap: { xs: 0.2, sm: 0.6 }, whiteSpace: "nowrap", overflow: "hidden",
              border: `1.5px solid ${on ? ACCENT : LINE}`, bgcolor: on ? alpha(ACCENT, 0.07) : "#fff", color: on ? ACCENT : "#334155",
            }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t.label}</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{t.short}</Box>
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.72rem", bgcolor: on ? ACCENT : SURFACE, color: on ? "#fff" : MUTED }}>{counts[t.key] || 0}</Box>
            </ButtonBase>
          );
        })}
      </Stack>

      {(jobs || []).length > 5 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, height: 40, px: 1.5, mb: 1.5, borderRadius: 2.5, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          <Search sx={{ fontSize: 18, color: "#94a3b8" }} />
          <Box component="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่องาน / โครงการ / เลข Job / เลขเอกสาร"
            sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, fontSize: "0.86rem", fontFamily: "inherit", bgcolor: "transparent", color: INK }} />
          {q && <IconButton size="small" onClick={() => setQ("")}><Close sx={{ fontSize: 16 }} /></IconButton>}
        </Box>
      )}

      {!jobs ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : list.length ? (
        <Panel>{list.map((j) => <JobCard key={j._id} job={j} onSchedule={setScheduling} onDeliver={setDelivering} onUploadInvoice={uploadInvoice} onNoteDone={noteDone} onEdit={openForm} onCancel={cancelJob} onRestore={restoreJob} />)}</Panel>
      ) : (
        <EmptyState icon={<PostAddOutlined />}
          title={q ? "ไม่พบงานที่ค้นหา" : tab === "waiting" ? "ไม่มีงานรอดำเนินการ" : tab === "active" ? "ไม่มีงานที่กำลังดำเนินการ" : tab === "cancelled" ? "ไม่มีงานที่ยกเลิก" : "ยังไม่มีงานที่เสร็จ"}
          hint={tab === "waiting" ? "ได้งานมาแล้ว กด “รับงานใหม่” เพื่อกรอกเก็บไว้ก่อน" : undefined}
          action={tab === "waiting" ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} sx={{ ...PRIMARY, mt: 1 }}>รับงานใหม่</Button> : null} />
      )}

      {delivering && (
        <DeliverDialog job={delivering} onClose={() => setDelivering(null)}
          onDone={async () => { setDelivering(null); await load(); refreshAppBadges(); }} />
      )}

      {scheduling && (
        <ScheduleDialog job={scheduling} employees={employees} canAssignResponsible={can(userData, "editContracts")} onClose={() => setScheduling(null)}
          onDone={async () => { setScheduling(null); await load(); refreshAppBadges(); }} />
      )}
    </Box>
  );
}
