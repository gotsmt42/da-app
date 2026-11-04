/**
 * JobQuickView — กดรายการงานในหน้ารายงานแล้ว "เด้งรายละเอียดงานขึ้นมาเลย" ไม่ต้องไปหน้าอื่น
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ให้กดเปิดดูรายละเอียดงานนั้นๆเด้งขึ้นมาเลยง่ายๆ ไม่ต้องไปหน้าอื่น
 *    การจัดวางต่างๆให้สอดคล้องธีม และครบถ้วนสมบูรณ์")
 *    มือถือ = แผ่นเลื่อนขึ้นจากล่าง · จอใหญ่ = กล่องกลางจอ (MobileSheet ตัวเดียวกับทั้งแอป)
 *    ลำดับเดียวกับหน้า event: ผู้ปฏิบัติงาน · ผู้รับผิดชอบ · มูลค่างาน · รายละเอียดงานที่ทำ · ไฟล์แนบ · เอกสาร
 *    ดูอย่างเดียว — ปุ่ม "เปิดหน้าการดำเนินงาน" สำหรับแก้ไข
 *
 * @param eventId   งานที่จะเปิด (null = ปิด)
 * @param employees [{ fname, imageUrl }] — รูปผู้ปฏิบัติงาน
 * @param showValue แสดงมูลค่างาน
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { OpenInNewRounded } from "@mui/icons-material";
import MobileSheet from "@/shared/ui/MobileSheet";
import SitePhotos from "@/shared/ui/SitePhotos";
import JobDocsSummaryCard from "@/shared/ui/JobDocsSummaryCard";
import EventService from "@/shared/services/EventService";
import { INK, MUTED, LINE } from "@/shared/ui/PageKit";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import { thaiDate } from "@/shared/utils/thaiDate";
import moment from "moment";

const STATUS_COLOR = { "กำลังรอยืนยัน": "#d97706", ยืนยันแล้ว: "#2563eb", กำลังดำเนินการ: "#7c3aed", ดำเนินการเสร็จสิ้น: "#059669" };
const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

const Section = ({ title, children, sx }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, p: { xs: 1.5, sm: 2 }, ...sx }}>
    <Typography sx={{ fontWeight: 800, fontSize: "0.98rem", color: INK, mb: 1 }}>{title}</Typography>
    {children}
  </Box>
);
const Field = ({ label, children }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
    <Box sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, wordBreak: "break-word" }}>{children}</Box>
  </Box>
);
const Empty = ({ children = "—" }) => <Typography component="span" sx={{ fontSize: "0.86rem", color: "#94a3b8", fontWeight: 600 }}>{children}</Typography>;

const dateText = (e) => {
  if (!e?.start) return "—";
  const s = moment(e.start);
  const end = e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days") : s;
  const time = e.startTime || e.endTime ? ` · ${e.startTime || "-"}–${e.endTime || "-"} น.` : "";
  return (end.isSame(s, "day") ? thaiDate(s) : `${thaiDate(s)} – ${thaiDate(end)}`) + time;
};

export default function JobQuickView({ eventId, onClose, employees = [], showValue = false }) {
  const navigate = useNavigate();
  const [ev, setEv] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!eventId) return undefined;
    let alive = true;
    setEv(null); setErr("");
    EventService.GetEventById(eventId)
      .then((r) => { if (alive) setEv(r?.event || r || null); })
      .catch(() => { if (alive) setErr("โหลดรายละเอียดงานไม่สำเร็จ — ลองใหม่อีกครั้ง"); });
    return () => { alive = false; };
  }, [eventId]);

  const avatarOf = (n) => employees.find((e) => e.fname === n)?.imageUrl;
  const workers = ev ? [...new Set([ev.team, ...((ev.teamMembers || []).map((m) => m?.name))].filter(Boolean))] : [];
  const tone = STATUS_COLOR[ev?.status] || "#64748b";
  const hasValue = ev && ev.workValue !== null && ev.workValue !== undefined && ev.workValue !== "";

  return (
    <MobileSheet open={Boolean(eventId)} onClose={onClose} maxWidth="lg"
      title={ev ? [ev.title, ev.system].filter(Boolean).join(" · ") || "รายละเอียดงาน" : "รายละเอียดงาน"}
      subtitle={ev ? [ev.site || ev.company, ev.jobNo].filter(Boolean).join(" · ") : ""}
      actions={ev ? (
        <Button size="small" variant="outlined" startIcon={<OpenInNewRounded sx={{ fontSize: 16 }} />}
          onClick={() => { onClose(); navigate(`/operation/${ev._id}`); }}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap", display: { xs: "none", sm: "inline-flex" } }}>
          เปิดหน้าการดำเนินงาน
        </Button>
      ) : null}>
      {!ev ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          {err ? <Typography sx={{ color: "#dc2626", fontSize: "0.88rem" }}>{err}</Typography> : <CircularProgress size={26} />}
        </Stack>
      ) : (
        // 🔁 (4 พ.ย. 2569 ผู้ใช้: "หน้าต่างงานให้เท่าๆกันกับหน้าอื่นๆ มันเล็กเกินไป") กว้างเท่ากล่องแก้ไขงาน · จอใหญ่ 2 คอลัมน์
        <Box sx={{ p: { xs: 1.25, sm: 2.5 }, display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) minmax(0,1fr)" } }}>
        <Stack spacing={1.5}>
          {/* สถานะ + ข้อมูลงาน */}
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, p: { xs: 1.5, sm: 2 } }}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, height: 28, px: 1.25, borderRadius: 99, mb: 1.25,
              bgcolor: alpha(tone, 0.1), color: tone, fontSize: "0.82rem", fontWeight: 800 }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tone }} />{ev.status || "—"}
              {ev.closeRequested && ev.status !== "ดำเนินการเสร็จสิ้น" ? " · ขอปิดงานแล้ว" : ""}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <Field label="วันที่เข้างาน">{dateText(ev)}</Field>
              <Field label="ครั้งที่">{ev.time || <Empty />}</Field>
              <Field label="โครงการ">{ev.site || <Empty />}</Field>
              <Field label="บริษัท">{ev.company || <Empty />}</Field>
              <Field label="ผู้รับผิดชอบงาน">{ev.responsiblePerson || <Empty>ยังไม่มอบหมาย</Empty>}</Field>
              <Field label="ผู้ติดต่อหน้างาน">{[ev.contactName, ev.contactTel].filter(Boolean).join(" · ") || <Empty />}</Field>
            </Box>
          </Box>

          {/* ผู้ปฏิบัติงาน */}
          <Section title={`ผู้ปฏิบัติงาน${workers.length ? ` (${workers.length} คน)` : ""}`}>
            {workers.length ? (
              <Stack spacing={0.75}>
                {workers.map((n, i) => (
                  <Stack key={n} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: "0.74rem", fontWeight: 800,
                      bgcolor: i === 0 ? "#2563eb" : "#eef2ff", color: i === 0 ? "#fff" : "#3730a3" }}>{i + 1}</Box>
                    <Avatar src={hasValidAvatar(avatarOf(n)) ? avatarOf(n) : undefined}
                      sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 800, bgcolor: personColor(n) }}>{personInitial(n)}</Avatar>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: INK, flex: 1, minWidth: 0 }} noWrap>{n}</Typography>
                    {i === 0 && <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#1d4ed8", bgcolor: "#dbeafe", borderRadius: 99, px: 1, py: 0.25 }}>หัวหน้าทีม</Box>}
                  </Stack>
                ))}
              </Stack>
            ) : <Empty>ยังไม่มีผู้ปฏิบัติงาน</Empty>}
          </Section>

          {/* มูลค่างาน */}
          {showValue && (
            <Section title="มูลค่างานครั้งนี้">
              {hasValue
                ? <Typography sx={{ fontSize: "1.4rem", fontWeight: 900, color: INK, fontVariantNumeric: "tabular-nums" }}>{baht(ev.workValue)}</Typography>
                : <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: "#d97706" }}>ยังไม่ใส่มูลค่างาน</Typography>}
            </Section>
          )}

        </Stack>
        <Stack spacing={1.5}>
          {/* 🔁 (4 พ.ย. 2569 ผู้ใช้: "ให้เหลือรายละเอียดงานที่ทำช่องเดียว และดูง่าย") — ช่องเดียว (description) · บันทึกเดิมของช่าง (workNote) ต่อท้าย */}
          <Section title="รายละเอียดงานที่ทำ">
            {ev.description
              ? <Typography sx={{ fontSize: "0.88rem", color: INK, whiteSpace: "pre-line", lineHeight: 1.7 }}>{ev.description}</Typography>
              : !ev.workNote && <Empty>ยังไม่ได้ระบุ</Empty>}
            {ev.workNote && (
              <Typography sx={{ fontSize: "0.84rem", color: MUTED, whiteSpace: "pre-line", lineHeight: 1.6, mt: ev.description ? 1 : 0 }}>
                <b>บันทึกเดิมจากช่าง:</b> {ev.workNote}
              </Typography>
            )}
          </Section>

          {/* ไฟล์แนบ */}
          <SitePhotos event={ev} canEdit={false} sx={{ mt: 0 }} />

          {/* เอกสารประจำงาน */}
          <JobDocsSummaryCard event={ev} sx={{ mt: 0 }} />

          <Button fullWidth variant="outlined" startIcon={<OpenInNewRounded />} onClick={() => { onClose(); navigate(`/operation/${ev._id}`); }}
            sx={{ display: { xs: "flex", sm: "none" }, textTransform: "none", fontWeight: 800, borderRadius: 2.5, py: 1.1, bgcolor: "#fff" }}>
            เปิดหน้าการดำเนินงาน
          </Button>
        </Stack>
        </Box>
      )}
    </MobileSheet>
  );
}
