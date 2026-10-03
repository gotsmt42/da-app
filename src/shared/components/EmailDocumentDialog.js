/**
 * EmailDocumentDialog — กล่อง "ส่งเอกสารทางอีเมล" ใช้ร่วมกันทุกชนิดเอกสาร
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "เพิ่มระบบส่งอีเมลของเอกสารต่างๆ ให้สามารถแก้ไขรายละเอียดที่จะส่งได้ด้วย
 *    ให้สมบูรณ์ และจัดวางแบบมืออาชีพ" — ผู้รับ/สำเนา/หัวเรื่อง/ข้อความแก้ได้ทุกช่องก่อนส่ง
 *    มีแม่แบบข้อความ 2 แบบ (ถึงลูกค้า · ภายในบริษัท) พร้อมลายเซ็นผู้ส่ง · แนบ PDF ใบเดียวกับที่พิมพ์
 *    และแสดงประวัติการส่งของเอกสารใบนั้น
 * ✅ กฎออกแบบของผู้ใช้: สีน้อย (เทาเข้มเป็นสีหลัก) · ตัวอักษรชัด · ระยะห่างพอดี · ป้ายชื่อช่องตรงแนวเดียวกัน
 *
 * @param {{ blob: Blob, fileName: string, url?: string }} attachment  ไฟล์ PDF ที่จะแนบ
 * @param {string} docType     ชื่อชนิดเอกสาร เช่น "ใบแจ้งเข้างาน"
 * @param {string} docNo       เลขที่เอกสาร
 * @param {string} refId       id ต้นทาง (ใช้ดึงประวัติการส่ง)
 * @param {string[]} defaultTo อีเมลผู้รับตั้งต้น
 * @param {string} recipientName  ชื่อผู้รับในคำขึ้นต้น ("เรียน ...")
 * @param {string} project     ชื่อโครงการ/เรื่อง ต่อท้ายหัวเรื่อง
 * @param {"customer"|"internal"} audience  แม่แบบข้อความตั้งต้น
 * @param {{company?: string, site?: string}} customerMatch  ไม่มี defaultTo = หาอีเมลลูกค้าจากทะเบียนตามนี้
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography, TextField, Button, IconButton,
  Alert, Chip, Autocomplete, Checkbox, FormControlLabel, CircularProgress, Collapse, useMediaQuery, Tooltip,
} from "@mui/material";
import {
  Close, MailOutline, Send, PictureAsPdf, Visibility, RestartAlt, CheckCircle, History, ExpandMore, ErrorOutline,
} from "@mui/icons-material";

import MailService from "@/shared/services/MailService";
import OrgSettingService from "@/shared/services/OrgSettingService";
import { useAuth } from "@/features/auth/AuthContext";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, DANGER, PRIMARY_BTN_SX, ACCENT, ACCENT_SOFT, ACCENT_DARK, ACCENT_LINE } from "@/shared/ui/PageKit";

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const isEmail = (v) => EMAIL_RE.test(String(v || "").trim());
const COPY_ME_KEY = "mail.copyMe";

const fmtSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtWhen = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** แยกข้อความที่พิมพ์/วางมาเป็นรายการอีเมล (คั่นด้วย , ; เว้นวรรค หรือขึ้นบรรทัด) */
const splitEmails = (text) => String(text || "").split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
const uniq = (arr) => [...new Set(arr)];

function buildSignature({ user, org }) {
  const name = [user?.fname, user?.lname].filter(Boolean).join(" ").trim();
  const position = user?.jobTitle || "";
  return [
    name,
    position,
    org?.nameTh,
    [user?.tel && `โทร ${user.tel}`, user?.email].filter(Boolean).join(" · "),
  ].filter(Boolean).join("\n");
}

function buildBody({ audience, recipientName, docType, docNo, project, org, signature }) {
  const company = org?.nameTh || "บริษัทฯ";
  const ref = `${docType}${docNo ? ` เลขที่ ${docNo}` : ""}${project ? ` (${project})` : ""}`;
  if (audience === "internal") {
    return [
      `เรียน ${recipientName || "ผู้เกี่ยวข้อง"}`,
      "",
      `ส่ง${ref} มาเพื่อโปรดพิจารณา รายละเอียดตามไฟล์ PDF ที่แนบมาพร้อมนี้`,
      "",
      "ขอบคุณครับ/ค่ะ",
      "",
      signature,
    ].join("\n");
  }
  return [
    `เรียน ${recipientName || "ลูกค้าผู้เกี่ยวข้อง"}`,
    "",
    `${company} ขอนำส่ง${ref} รายละเอียดตามไฟล์ PDF ที่แนบมาพร้อมอีเมลฉบับนี้`,
    "",
    "หากมีข้อสงสัยหรือต้องการข้อมูลเพิ่มเติม สามารถตอบกลับอีเมลนี้หรือติดต่อตามช่องทางด้านล่างได้ทันที",
    "",
    "ขอแสดงความนับถือ",
    "",
    signature,
  ].join("\n");
}

const buildSubject = ({ docType, docNo, project, org }) =>
  [`${docType}${docNo ? ` เลขที่ ${docNo}` : ""}`, project, org?.nameTh].filter(Boolean).join(" — ");

/** ป้ายชื่อช่องฝั่งซ้าย (ความกว้างเท่ากันทุกแถว ให้ช่องกรอกเริ่มแนวเดียวกัน) */
function FieldRow({ label, children, action, isMobile }) {
  return (
    <Stack direction={isMobile ? "column" : "row"} alignItems={isMobile ? "stretch" : "flex-start"} spacing={isMobile ? 0.5 : 1.5}>
      <Typography sx={{ width: isMobile ? "auto" : 76, flexShrink: 0, pt: isMobile ? 0 : 1.1, fontSize: "0.8rem", fontWeight: 800, color: MUTED }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      {action && !isMobile && <Box sx={{ pt: 0.5, flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

const inputSx = { "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff", fontSize: "0.9rem" } };

/**
 * ⚠️ ข้อความที่พิมพ์ค้างไว้ (ยังไม่กด Enter) ต้องนับเป็นผู้รับด้วย — คนส่วนใหญ่พิมพ์อีเมลแล้วกด "ส่ง" เลย
 *    จึงแจ้งข้อความค้างขึ้นไปให้กล่องแม่ผ่าน onPending (ปุ่มส่งที่ disabled จะไม่ทำให้ช่องนี้ blur)
 */
function EmailChipsInput({ value, onChange, options, placeholder, autoFocus, onPending }) {
  const [input, setInputState] = useState("");
  const setInput = (v) => { setInputState(v); onPending?.(v); };
  const commit = (text) => {
    const add = splitEmails(text);
    if (add.length) onChange(uniq([...value, ...add]));
    setInput("");
  };
  return (
    <Autocomplete
      multiple freeSolo autoHighlight
      options={options}
      filterSelectedOptions
      value={value}
      inputValue={input}
      onInputChange={(_, v, reason) => {
        if (reason === "reset") return;
        // ✅ พิมพ์ , ; หรือเว้นวรรค = จบหนึ่งที่อยู่ (เหมือนโปรแกรมอีเมลทั่วไป) · วางรายการยาวก็แยกให้เอง
        if (/[,;\s]/.test(v)) commit(v); else setInput(v);
      }}
      onChange={(_, v) => {
        onChange(uniq(v.flatMap((x) => (typeof x === "string" ? splitEmails(x) : [x.email]))));
        // ⚠️ ล้างช่องพิมพ์เอง — onInputChange ข้ามเหตุ "reset" ไว้ ข้อความที่กด Enter ไปแล้วจะค้างในช่อง
        setInput("");
      }}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.email)}
      isOptionEqualToValue={(o, v) => (typeof o === "string" ? o : o.email) === (typeof v === "string" ? v : v.email)}
      groupBy={(o) => o.group}
      filterOptions={(opts, s) => {
        const q = s.inputValue.trim().toLowerCase();
        const pool = opts.filter((o) => !value.includes(o.email));
        if (!q) return pool.slice(0, 40);
        return pool.filter((o) => `${o.email} ${o.label}`.toLowerCase().includes(q)).slice(0, 40);
      }}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }} noWrap>{o.label || o.email}</Typography>
              {o.label && <Typography sx={{ fontSize: "0.76rem", color: MUTED }} noWrap>{o.email}</Typography>}
            </Box>
          </li>
        );
      }}
      renderTags={(vals, getTagProps) => vals.map((v, i) => {
        const { key, ...tagProps } = getTagProps({ index: i });
        const ok = isEmail(v);
        return (
          <Chip key={key} {...tagProps} size="small" label={v}
            icon={ok ? undefined : <ErrorOutline sx={{ fontSize: 15 }} />}
            sx={{
              fontWeight: 700, borderRadius: 1.5, height: 26,
              bgcolor: ok ? SURFACE : "#fef2f2", border: `1px solid ${ok ? LINE : "#fecaca"}`, color: ok ? INK_2 : DANGER,
              "& .MuiChip-icon": { color: DANGER },
            }} />
        );
      })}
      renderInput={(params) => (
        <TextField {...params} size="small" autoFocus={autoFocus} placeholder={value.length ? "" : placeholder}
          onBlur={() => { if (input.trim()) commit(input); }}
          sx={inputSx} />
      )}
    />
  );
}

export default function EmailDocumentDialog({
  open, onClose, attachment, docType = "เอกสาร", docNo = "", refId = "",
  defaultTo = [], recipientName = "", project = "", audience = "customer", customerMatch,
}) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const [status, setStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [pendingTo, setPendingTo] = useState("");
  const [pendingCc, setPendingCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState(audience);
  const [copyMe, setCopyMe] = useState(() => { try { return localStorage.getItem(COPY_ME_KEY) !== "0"; } catch { return true; } });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);
  const bodyTouched = useRef(false);

  const org = OrgSettingService.current();
  const signature = useMemo(() => buildSignature({ user: userData, org }), [userData, org]);
  const defaultsKey = `${docType}|${docNo}|${project}|${recipientName}|${(defaultTo || []).join(",")}`;

  // ✅ เติมค่าตั้งต้นใหม่ทุกครั้งที่เปิดกล่อง (เอกสารใบใหม่ = ผู้รับ/หัวเรื่องใหม่)
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const toInit = uniq((defaultTo || []).map((e) => String(e || "").trim().toLowerCase()).filter(isEmail));
    setTo(toInit); setCc([]); setShowCc(false); setPendingTo(""); setPendingCc(""); setError(""); setSent(null); setShowHistory(false);
    setTemplate(audience);
    setSubject(buildSubject({ docType, docNo, project, org }));
    setBody(buildBody({ audience, recipientName, docType, docNo, project, org, signature }));
    bodyTouched.current = false;
    MailService.status().then((s) => alive && setStatus(s));
    MailService.contacts().then((c) => alive && setContacts(c)).catch(() => {});
    if (!toInit.length && (customerMatch?.company || customerMatch?.site)) {
      MailService.customers().then((list) => {
        const found = MailService.customerEmailFor(list, customerMatch).filter(isEmail).map((e) => e.toLowerCase());
        if (alive && found.length) setTo((cur) => (cur.length ? cur : found));
      });
    }
    MailService.log({ refId, docNo }).then((h) => alive && setHistory(h));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เติมค่าใหม่เมื่อเปิดหรือเปลี่ยนเอกสารเท่านั้น
  }, [open, defaultsKey]);

  const applyTemplate = (t) => {
    if (bodyTouched.current && !window.confirm("แทนที่ข้อความที่แก้ไว้ด้วยแม่แบบนี้?")) return;
    setTemplate(t);
    setBody(buildBody({ audience: t, recipientName, docType, docNo, project, org, signature }));
    bodyTouched.current = false;
  };

  const myEmail = String(userData?.email || "").trim();
  // ✅ รวมข้อความที่พิมพ์ค้างในช่อง (ยังไม่กด Enter) เป็นผู้รับด้วย
  const allTo = uniq([...to, ...splitEmails(pendingTo)]);
  const allCc = uniq([...cc, ...splitEmails(pendingCc)]).filter((e) => !allTo.includes(e));
  const invalid = [...allTo, ...allCc].filter((e) => !isEmail(e));
  // ป้ายแดงแสดงเฉพาะที่อยู่ที่ยืนยันเป็นป้ายแล้ว — ระหว่างพิมพ์ยังไม่ต้องเตือน
  const invalidShown = [...to, ...cc].filter((e) => !isEmail(e));
  const maxRecipients = status?.maxRecipients || 10;
  const tooMany = allTo.length + allCc.length > maxRecipients;
  const notConfigured = status && status.configured === false;
  const fileSize = attachment?.blob?.size || 0;
  const tooBig = fileSize > (status?.maxMb || 10) * 1024 * 1024;
  const canSend = !sending && !notConfigured && allTo.length > 0 && !invalid.length && !tooMany && !tooBig
    && subject.trim() && body.trim() && attachment?.blob;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true); setError("");
    try {
      try { localStorage.setItem(COPY_ME_KEY, copyMe ? "1" : "0"); } catch { /* ไม่สำคัญ */ }
      await MailService.sendDocument({
        file: attachment.blob, fileName: attachment.fileName, to: allTo, cc: allCc, subject: subject.trim(), body: body.trim(),
        docType, docNo, refId, copyMe,
      });
      setTo(allTo); setCc(allCc); setPendingTo(""); setPendingCc("");
      setSent({ to: allTo, cc: allCc, at: new Date() });
      MailService.log({ refId, docNo }).then(setHistory);
    } catch (err) {
      setError(err?.response?.data?.message || "ส่งอีเมลไม่สำเร็จ — ตรวจการเชื่อมต่อแล้วลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  };

  const openAttachment = () => {
    if (!attachment?.blob) return;
    const url = attachment.url || URL.createObjectURL(attachment.blob);
    window.open(url, "_blank");
    if (!attachment.url) setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const sentCount = history.filter((h) => h.status === "sent").length;

  return (
    <Dialog open={open} onClose={(_, reason) => { if (sending || reason === "backdropClick") return; onClose?.(); }}
      fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 3 }, py: 1.75, borderBottom: `1px solid ${LINE}` }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: ACCENT_SOFT, color: ACCENT }}>
            <MailOutline sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK, lineHeight: 1.3 }}>ส่งเอกสารทางอีเมล</Typography>
            <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED }}>
              {[docType, docNo && `เลขที่ ${docNo}`, project].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={sending} aria-label="ปิด"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      {sent ? (
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 5 }}>
          <Stack alignItems="center" spacing={1.25} sx={{ textAlign: "center", maxWidth: 460, mx: "auto" }}>
            <CheckCircle sx={{ fontSize: 52, color: "#16a34a" }} />
            <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: INK }}>ส่งอีเมลเรียบร้อย</Typography>
            <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>
              ส่ง{docType}{docNo ? ` ${docNo}` : ""} ถึง <b style={{ color: INK_2 }}>{sent.to.join(", ")}</b>
              {sent.cc.length > 0 && <> · สำเนา {sent.cc.join(", ")}</>}
            </Typography>
            {copyMe && myEmail && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>ส่งสำเนาเข้ากล่องอีเมลของคุณ ({myEmail}) แล้ว</Typography>}
          </Stack>
        </DialogContent>
      ) : (
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
          {notConfigured && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อีเมล (SMTP) — แจ้งผู้ดูแลระบบให้ตั้งค่าก่อน ระหว่างนี้ใช้ปุ่ม "ดาวน์โหลด" แล้วแนบส่งเองได้
            </Alert>
          )}
          {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Stack spacing={1.75}>
            {status?.from && (
              <FieldRow label="จาก" isMobile={isMobile}>
                <Typography sx={{ pt: isMobile ? 0 : 1.1, fontSize: "0.88rem", color: INK_2 }}>
                  {[userData?.fname, userData?.lname].filter(Boolean).join(" ") || "คุณ"}
                  <Box component="span" sx={{ color: FAINT }}> · ผ่าน {status.from}{myEmail ? ` · ตอบกลับถึง ${myEmail}` : ""}</Box>
                </Typography>
              </FieldRow>
            )}
            <FieldRow label="ถึง" isMobile={isMobile}
              action={!showCc && <Button size="small" onClick={() => setShowCc(true)} sx={{ textTransform: "none", fontWeight: 700, color: MUTED, minWidth: 0 }}>สำเนา (CC)</Button>}>
              <EmailChipsInput value={to} onChange={setTo} onPending={setPendingTo} options={contacts} placeholder="พิมพ์อีเมล หรือเลือกจากรายชื่อลูกค้า/พนักงาน" autoFocus={!to.length && !isMobile} />
              {isMobile && !showCc && (
                <Button size="small" onClick={() => setShowCc(true)} sx={{ mt: 0.5, textTransform: "none", fontWeight: 700, color: MUTED, px: 0.5 }}>+ สำเนา (CC)</Button>
              )}
            </FieldRow>
            {showCc && (
              <FieldRow label="สำเนา" isMobile={isMobile}>
                <EmailChipsInput value={cc} onChange={setCc} onPending={setPendingCc} options={contacts} placeholder="อีเมลผู้รับสำเนา" />
              </FieldRow>
            )}
            {(invalidShown.length > 0 || tooMany) && (
              <Typography sx={{ fontSize: "0.78rem", color: DANGER, pl: isMobile ? 0 : "88px" }}>
                {invalidShown.length > 0 ? `รูปแบบอีเมลไม่ถูกต้อง: ${invalidShown.join(", ")} — คลิกกากบาทที่ป้ายเพื่อลบ` : `ส่งได้ครั้งละไม่เกิน ${maxRecipients} ที่อยู่ (รวมสำเนา)`}
              </Typography>
            )}
            <FieldRow label="หัวเรื่อง" isMobile={isMobile}>
              <TextField size="small" fullWidth value={subject} onChange={(e) => setSubject(e.target.value)} inputProps={{ maxLength: 250 }} sx={inputSx} />
            </FieldRow>
            <FieldRow label="ข้อความ" isMobile={isMobile}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                <Typography sx={{ fontSize: "0.76rem", color: FAINT, mr: 0.25 }}>แม่แบบ</Typography>
                {[["customer", "ถึงลูกค้า"], ["internal", "ภายในบริษัท"]].map(([k, l]) => (
                  <Chip key={k} size="small" label={l} onClick={() => applyTemplate(k)}
                    sx={{
                      fontWeight: 700, height: 26, borderRadius: 1.5,
                      bgcolor: template === k ? ACCENT_SOFT : "#fff", color: template === k ? ACCENT_DARK : INK_2,
                      border: `1px solid ${template === k ? ACCENT_LINE : LINE}`, "&:hover": { bgcolor: template === k ? ACCENT_SOFT : SURFACE },
                    }} />
                ))}
                <Tooltip title="คืนข้อความตามแม่แบบ">
                  <IconButton size="small" onClick={() => applyTemplate(template)} sx={{ color: MUTED, ml: "auto !important" }}>
                    <RestartAlt sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <TextField fullWidth multiline minRows={isMobile ? 10 : 11} maxRows={22} value={body}
                onChange={(e) => { bodyTouched.current = true; setBody(e.target.value); }}
                inputProps={{ maxLength: 20000 }}
                sx={{ ...inputSx, "& textarea": { lineHeight: 1.7 } }} />
            </FieldRow>
            <FieldRow label="ไฟล์แนบ" isMobile={isMobile}>
              <Stack direction="row" alignItems="center" spacing={1.25}
                sx={{ px: 1.5, py: 1.1, border: `1px solid ${tooBig ? "#fecaca" : LINE}`, borderRadius: 2, bgcolor: SURFACE }}>
                <PictureAsPdf sx={{ color: "#b91c1c", fontSize: 26 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>{attachment?.fileName || "—"}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: tooBig ? DANGER : MUTED }}>
                    PDF · {fmtSize(fileSize)}{tooBig ? ` — ใหญ่เกิน ${status?.maxMb || 10} MB` : ""}
                  </Typography>
                </Box>
                <Button size="small" onClick={openAttachment} startIcon={<Visibility sx={{ fontSize: 17 }} />}
                  sx={{ textTransform: "none", fontWeight: 700, color: INK_2 }}>ดูไฟล์</Button>
              </Stack>
            </FieldRow>
            <Box sx={{ pl: isMobile ? 0 : "88px" }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} disabled={!myEmail} sx={{ color: FAINT, "&.Mui-checked": { color: ACCENT } }} />}
                label={<Typography sx={{ fontSize: "0.84rem", color: INK_2 }}>ส่งสำเนาถึงฉัน{myEmail ? ` (${myEmail})` : " — บัญชีนี้ยังไม่มีอีเมล"}</Typography>}
              />
            </Box>

            {history.length > 0 && (
              <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2 }}>
                <Button fullWidth onClick={() => setShowHistory((v) => !v)} startIcon={<History sx={{ fontSize: 18 }} />}
                  endIcon={<ExpandMore sx={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                  sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 800, color: INK_2, px: 1.5, py: 1, "& .MuiButton-endIcon": { ml: "auto" } }}>
                  ประวัติการส่งเอกสารนี้ · ส่งแล้ว {sentCount} ครั้ง
                </Button>
                <Collapse in={showHistory}>
                  <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />} sx={{ borderTop: `1px solid ${LINE}` }}>
                    {history.map((h) => (
                      <Stack key={h._id} direction="row" spacing={1.25} alignItems="flex-start" sx={{ px: 1.5, py: 1 }}>
                        <Box sx={{ width: 7, height: 7, mt: 0.9, borderRadius: "50%", flexShrink: 0, bgcolor: h.status === "sent" ? "#16a34a" : DANGER }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }} noWrap>
                            {(h.to || []).join(", ")}{h.cc?.length ? ` · สำเนา ${h.cc.join(", ")}` : ""}
                          </Typography>
                          <Typography sx={{ fontSize: "0.74rem", color: h.status === "sent" ? MUTED : DANGER }}>
                            {fmtWhen(h.createdAt)} · โดย {h.senderName || "-"}{h.status === "sent" ? "" : ` · ไม่สำเร็จ: ${h.error || "-"}`}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Collapse>
              </Box>
            )}
          </Stack>
        </DialogContent>
      )}

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        {sent ? (
          <>
            <Button onClick={() => setSent(null)} sx={{ textTransform: "none", fontWeight: 700, color: MUTED, mr: "auto" }}>ส่งอีกครั้ง</Button>
            <Button variant="contained" onClick={onClose} sx={{ ...PRIMARY_BTN_SX, px: 3 }}>เสร็จสิ้น</Button>
          </>
        ) : (
          <>
            <Typography sx={{ mr: "auto", fontSize: "0.76rem", color: FAINT, display: { xs: "none", sm: "block" } }}>
              {allTo.length ? `ผู้รับ ${allTo.length + allCc.length} ที่อยู่` : "ยังไม่ได้ระบุผู้รับ"}
            </Typography>
            <Button onClick={onClose} disabled={sending} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
            <Button variant="contained" onClick={handleSend} disabled={!canSend}
              startIcon={sending ? <CircularProgress size={15} color="inherit" /> : <Send sx={{ fontSize: 17 }} />}
              sx={{ ...PRIMARY_BTN_SX, px: 2.5 }}>
              {sending ? "กำลังส่ง..." : "ส่งอีเมล"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
