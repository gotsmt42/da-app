import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, Divider, IconButton, InputAdornment,
  MenuItem, Pagination, Skeleton, Stack, TextField, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { AttachFile, Call, Close, DeleteOutline, Email, Search } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { ConfirmDialog, EmptyBox, UI, WebPageHeader, cardSx, useFeedback } from "../components/WebsiteUi";
import WebsiteService, { errorText } from "../services/WebsiteService";
import { LEAD_STATUS, leadStatus, serviceLabel, thaiShort } from "../utils/webContent";

/**
 * คำขอจากเว็บไซต์ (ฟอร์มติดต่อ + ขอใบเสนอราคา)
 *
 * ✅ ลูกค้ากรอกฟอร์มบนเว็บ → เข้าที่นี่ทันที + แจ้งเตือนบนมือถือ + อีเมล (ถ้าตั้ง SMTP)
 * ⚠️ ข้อมูลส่วนบุคคลของลูกค้า (PDPA) — เปิดได้เฉพาะสิทธิ์ viewLeads · ลบได้เฉพาะ manageWebsite
 * ⚠️ ลิงก์ไฟล์แนบเป็นลิงก์ลงนามอายุ 10 นาที — เปิดหน้ารายละเอียดใหม่ถ้าลิงก์หมดอายุ
 * ⚠️ รองรับ ?id= — ลิงก์จากการแจ้งเตือนเปิดคำขอนั้นขึ้นมาทันที
 */
export default function WebsiteLeads() {
  const fb = useFeedback();
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState({ byStatus: {} });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const openId = params.get("id");

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        WebsiteService.leads({ status: status || undefined, q: q.trim() || undefined, page }),
        WebsiteService.leadSummary(),
      ]);
      setData(list);
      setSummary(sum);
    } catch (err) {
      setData({ items: [], total: 0, pages: 1 });
      fb.fail(errorText(err, "โหลดคำขอไม่สำเร็จ"));
    }
  }, [status, q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⚠️ หน่วงการค้นหาไว้ครู่หนึ่ง — ไม่ยิง API ทุกตัวอักษรที่พิมพ์
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const open = (id) => setParams((p) => { const n = new URLSearchParams(p); n.set("id", id); return n; });
  const close = () => setParams((p) => { const n = new URLSearchParams(p); n.delete("id"); return n; });
  const total = Object.values(summary.byStatus || {}).reduce((a, b) => a + b, 0);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
      <WebPageHeader title="คำขอจากเว็บไซต์" subtitle="ข้อความติดต่อและคำขอใบเสนอราคาที่ลูกค้าส่งผ่านเว็บไซต์บริษัท" sitePath="/quotation" />
      {fb.node}

      {/* ตัวกรองสถานะพร้อมจำนวน — เห็นทันทีว่ามีคำขอใหม่ค้างกี่รายการ */}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <Chip label={`ทั้งหมด ${total}`} onClick={() => { setStatus(""); setPage(1); }} variant={status ? "outlined" : "filled"} sx={{ fontWeight: 700 }} />
        {LEAD_STATUS.map((s) => (
          <Chip key={s.value} label={`${s.label} ${summary.byStatus?.[s.value] || 0}`} onClick={() => { setStatus(s.value); setPage(1); }}
            variant={status === s.value ? "filled" : "outlined"}
            sx={{ fontWeight: 700, ...(status === s.value ? { bgcolor: s.color, color: "#fff" } : { color: s.color, borderColor: `${s.color}55` }) }} />
        ))}
      </Stack>
      <TextField value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="ค้นหาชื่อ บริษัท เบอร์โทร อีเมล หรือเลขอ้างอิง" size="small" fullWidth sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }} />

      {data === null ? (
        <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={78} />)}</Stack>
      ) : data.items.length === 0 ? (
        <EmptyBox title={q || status ? "ไม่พบคำขอที่ตรงกับตัวกรอง" : "ยังไม่มีคำขอจากเว็บไซต์"}
          detail={q || status ? "ลองเปลี่ยนคำค้นหรือเลือก “ทั้งหมด”" : "เมื่อลูกค้ากรอกฟอร์มติดต่อหรือขอใบเสนอราคาบนเว็บไซต์ คำขอจะเข้ามาที่นี่ทันที พร้อมแจ้งเตือน"} />
      ) : (
        <>
          <Stack spacing={1}>
            {data.items.map((l) => {
              const st = leadStatus(l.status);
              return (
                <Box key={l._id} component="button" type="button" onClick={() => open(l._id)}
                  sx={{ ...cardSx, p: 1.5, textAlign: "left", cursor: "pointer", font: "inherit", width: "100%", display: "flex", gap: 1.5, alignItems: "flex-start",
                    borderLeft: `4px solid ${st.color}`, "&:hover": { borderColor: "#cbd5e1", borderLeftColor: st.color } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 800 }}>{l.name}</Typography>
                      {l.company && <Typography sx={{ color: UI.sub, fontSize: "0.88rem" }}>· {l.company}</Typography>}
                      <Chip size="small" label={st.label} sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: `${st.color}18`, color: st.color }} />
                      <Chip size="small" label={l.kind === "quotation" ? "ขอใบเสนอราคา" : "ติดต่อ"} variant="outlined" sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }} />
                      {l.files?.length > 0 && <AttachFile sx={{ fontSize: 16, color: UI.sub }} />}
                    </Stack>
                    <Typography sx={{ color: UI.sub, fontSize: "0.82rem", mt: 0.25 }} noWrap>
                      {l.kind === "quotation" ? serviceLabel(l.serviceType) : l.subject} — {l.details}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography sx={{ fontSize: "0.78rem", color: UI.sub }}>{thaiShort(l.createdAt, true)}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: UI.sub, fontFamily: "monospace" }}>{l.ref}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
          {data.pages > 1 && <Stack alignItems="center" sx={{ mt: 2 }}><Pagination count={data.pages} page={page} onChange={(_, p) => setPage(p)} /></Stack>}
        </>
      )}

      {openId && (
        <LeadDetail id={openId} canDelete={can("manageWebsite")} onClose={close}
          onChanged={(msg) => { fb.ok(msg); load(); refreshAppBadges(); }}
          onDeleted={() => { close(); fb.ok("ลบคำขอแล้ว"); load(); refreshAppBadges(); }}
          onError={fb.fail} />
      )}
    </Box>
  );
}

function Row({ label, children }) {
  if (!children) return null;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0, sm: 2 }} sx={{ py: 0.75 }}>
      <Typography sx={{ color: UI.sub, fontSize: "0.85rem", width: { sm: 130 }, flexShrink: 0 }}>{label}</Typography>
      <Box sx={{ fontSize: "0.92rem", fontWeight: 600, minWidth: 0, wordBreak: "break-word" }}>{children}</Box>
    </Stack>
  );
}

function LeadDetail({ id, canDelete, onClose, onChanged, onDeleted, onError }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [lead, setLead] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    WebsiteService.lead(id).then(setLead).catch((err) => { onError(errorText(err, "เปิดคำขอไม่สำเร็จ")); onClose(); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (body, msg) => {
    setBusy(true);
    try {
      const saved = await WebsiteService.updateLead(id, body);
      setLead((l) => ({ ...saved, files: l.files }));
      setNote("");
      onChanged(msg);
    } catch (err) { onError(errorText(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await WebsiteService.deleteLead(id); onDeleted(); } catch (err) { onError(errorText(err, "ลบไม่สำเร็จ")); setBusy(false); }
  };

  return (
    <Dialog open fullScreen={mobile} maxWidth="sm" fullWidth onClose={onClose} scroll="paper">
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", pr: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {lead ? lead.name : "กำลังโหลด…"}
          {lead && <Typography sx={{ color: UI.sub, fontSize: "0.78rem", fontFamily: "monospace" }}>{lead.ref} · {thaiShort(lead.createdAt, true)}</Typography>}
        </Box>
        <IconButton onClick={onClose} aria-label="ปิด"><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!lead ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack> : (
          <Stack spacing={2}>
            {/* ✅ ปุ่มโทร/อีเมลกดได้ทันทีจากมือถือ — งานแรกของเซลคือโทรกลับให้เร็วที่สุด */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button component="a" href={`tel:${lead.phone}`} variant="contained" startIcon={<Call />}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#059669", "&:hover": { bgcolor: "#047857" } }}>
                โทร {lead.phone}
              </Button>
              {lead.email && (
                <Button component="a" href={`mailto:${lead.email}?subject=${encodeURIComponent(`เรื่อง ${lead.ref}`)}`} variant="outlined" startIcon={<Email />}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>อีเมล</Button>
              )}
            </Stack>

            <Box>
              <Row label="ประเภท">{lead.kind === "quotation" ? "ขอใบเสนอราคา" : "ข้อความติดต่อ"}</Row>
              <Row label="บริษัท">{lead.company}</Row>
              <Row label="อีเมล">{lead.email}</Row>
              <Row label="หัวข้อ">{lead.subject}</Row>
              <Row label="ประเภทงาน">{lead.serviceType && serviceLabel(lead.serviceType)}</Row>
              <Row label="สถานที่หน้างาน">{lead.siteLocation}</Row>
              <Row label="งบประมาณ">{lead.budget}</Row>
              <Row label="วันที่ต้องการ">{lead.preferredDate && thaiShort(lead.preferredDate)}</Row>
            </Box>

            <Box sx={{ bgcolor: UI.soft, border: `1px solid ${UI.border}`, borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ color: UI.sub, fontSize: "0.8rem", mb: 0.5 }}>รายละเอียดจากลูกค้า</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", fontSize: "0.92rem" }}>{lead.details}</Typography>
            </Box>

            {lead.files?.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", mb: 0.75 }}>ไฟล์แนบ ({lead.files.length})</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {lead.files.map((f) => (
                    <Chip key={f.publicId} icon={<AttachFile />} label={f.name} component="a" href={f.url} target="_blank" rel="noopener noreferrer" clickable sx={{ fontWeight: 600 }} />
                  ))}
                </Stack>
                <Typography sx={{ color: UI.sub, fontSize: "0.74rem", mt: 0.5 }}>ลิงก์ดาวน์โหลดใช้ได้ 10 นาที — ปิดแล้วเปิดคำขอนี้ใหม่ถ้าหมดอายุ</Typography>
              </Box>
            )}

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField select size="small" label="สถานะ" value={lead.status} disabled={busy} sx={{ minWidth: 200 }}
                onChange={(e) => update({ status: e.target.value }, `เปลี่ยนสถานะเป็น "${leadStatus(e.target.value).label}"`)}>
                {LEAD_STATUS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
              <TextField size="small" label="ผู้รับผิดชอบ" defaultValue={lead.assignee} disabled={busy} fullWidth
                onBlur={(e) => e.target.value !== lead.assignee && update({ assignee: e.target.value }, "บันทึกผู้รับผิดชอบแล้ว")} />
            </Stack>

            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", mb: 0.75 }}>บันทึกการติดตาม</Typography>
              <Stack spacing={1} sx={{ mb: 1 }}>
                {(lead.notes || []).length === 0 && <Typography sx={{ color: UI.sub, fontSize: "0.85rem" }}>ยังไม่มีบันทึก</Typography>}
                {[...(lead.notes || [])].reverse().map((n, i) => (
                  <Box key={i} sx={{ borderLeft: `3px solid ${UI.border}`, pl: 1.25 }}>
                    <Typography sx={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{n.text}</Typography>
                    <Typography sx={{ color: UI.sub, fontSize: "0.74rem" }}>{n.by || "-"} · {thaiShort(n.at, true)}</Typography>
                  </Box>
                ))}
              </Stack>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextField size="small" fullWidth multiline maxRows={4} placeholder="เช่น โทรคุยแล้ว นัดสำรวจหน้างานวันพฤหัส" value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 2000))} />
                <Button variant="contained" disabled={busy || !note.trim()} onClick={() => update({ note }, "เพิ่มบันทึกแล้ว")}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, flexShrink: 0 }}>บันทึก</Button>
              </Stack>
            </Box>

            {canDelete && (
              <Box sx={{ pt: 1 }}>
                <Button color="error" startIcon={<DeleteOutline />} onClick={() => setConfirmDel(true)} sx={{ textTransform: "none", fontWeight: 700 }}>
                  ลบคำขอนี้ (ตามคำขอของลูกค้า / PDPA)
                </Button>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <ConfirmDialog open={confirmDel} busy={busy} onCancel={() => setConfirmDel(false)} onConfirm={remove}
        title="ลบคำขอนี้ถาวร?" detail="ข้อมูลลูกค้าและไฟล์แนบทั้งหมดจะถูกลบถาวร กู้คืนไม่ได้ — ใช้เมื่อลูกค้าขอให้ลบข้อมูล หรือเป็นสแปม" confirmText="ลบถาวร" />
    </Dialog>
  );
}
