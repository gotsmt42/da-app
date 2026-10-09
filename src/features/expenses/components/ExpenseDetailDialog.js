/**
 * ExpenseDetailDialog — รายละเอียดใบเบิก Advance / ใบเคลม + ปุ่มดำเนินการตามขั้น
 *
 * ✅ บอก "ขั้นต่อไป" ให้ชัดเสมอ (แถบสถานะด้านบน + เส้นขั้นตอน) — คนเปิดดูต้องรู้ทันทีว่าใบนี้ค้างที่ใคร
 * ✅ ปุ่มที่โชว์ขึ้นกับสิทธิ์ + สถานะ แบบเดียวกับที่ server บังคับ (ดู routes/expenses.js) — ไม่โชว์ปุ่มที่
 * กดไปก็โดนปฏิเสธ ยกเว้น "อนุมัติใบตัวเอง" ที่โชว์เป็นปุ่มปิดพร้อมเหตุผล ให้หัวหน้ารู้ว่าทำไมกดไม่ได้
 * ⚠️ นี่เป็นแค่การซ่อนปุ่ม — ขอบเขตความปลอดภัยจริงอยู่ที่ server ทุกเส้นทาง
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Chip,
  Alert, CircularProgress, useMediaQuery, TextField, MenuItem, Tooltip, Divider, Skeleton, Collapse,
  Checkbox, FormControlLabel, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Print, Edit, CheckCircle, Undo, Block, Payments, ReceiptLong, AttachFile, OpenInNew,
  DeleteOutline, Link as LinkIcon, History, TaskAlt, WarningAmber, Image as ImageIcon, Description, ExpandMore,
  AccountBalanceWallet, ContentCopy, Check, HistoryEdu, FactCheck, DoneAll, Engineering, CalendarMonth, Build,
} from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL } from "@/shared/utils/fileUpload";
import { thaiDate, thaiDateFull, thaiDateTime } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import SignatureService from "@/shared/services/SignatureService";
import ExpensePrintDialog from "./ExpensePrintDialog";
import AdvancePanel from "./AdvancePanel";
import KindBadge from "./KindBadge";
import StatusBadge from "./StatusBadge";
import { compareItems, COMPARE_KIND_LABEL } from "../utils/expenseCompare";
import {
  KIND_META, slipKind, categoryMeta, baht, fmtMoney, qtyText, differenceMeta, paymentLabel, PAYMENT_METHODS, fileKindLabel, jobText, jobRangeText, jobPartText, isOverdueClear, money, TEXT_SUB, TEXT_MAIN, BORDER_MAIN, personFullName, groupFilesByStage,
  installmentText, bahtText, jobRangesText, itemTitle,
} from "../expenseMeta";
import { bankMeta, formatAccountNo } from "../bankMeta";
import BankLogo from "./BankLogo";

/**
 * บัญชีรับเงินของผู้เบิกที่ระบุไว้ในใบ
 * ✅ มีปุ่มคัดลอกเลขบัญชี — คนโอนเงินจะได้ไม่ต้องพิมพ์ตามจากหน้าจอ (พิมพ์ผิดหลักเดียว = โอนผิดบัญชี)
 * ⚠️ แสดงจากสำเนาในใบ (payTo) เสมอ ไม่ใช่จากทะเบียนปัจจุบัน — ใบที่จ่ายไปแล้วต้องตรงกับที่โอนจริง
 */
const PayToBox = ({ payTo, dense = false }) => {
  const [copied, setCopied] = useState(false);
  if (!payTo?.accountNo) return null;
  const bank = bankMeta(payTo.bankCode);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payTo.accountNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // เบราว์เซอร์บางตัวไม่ให้คัดลอกถ้าไม่ใช่ https — ผู้ใช้ยังอ่านเลขจากหน้าจอได้อยู่
    }
  };
  return (
    // พื้น/ขอบใช้สีธนาคารแบบอ่อน — ให้ตรงกับกล่องบัญชีในใบ PDF และมองแวบเดียวก็รู้ว่าธนาคารไหน
    <Stack direction="row" spacing={1.25} alignItems="center"
      sx={{ p: dense ? 1 : 1.25, border: `1px solid ${alpha(bank.color, 0.35)}`, borderRadius: 2, bgcolor: alpha(bank.color, 0.06) }}>
      <BankLogo code={payTo.bankCode} size={dense ? 32 : 38} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: dense ? "0.95rem" : "1.05rem", fontWeight: 800, color: TEXT_MAIN, letterSpacing: 0.4 }}>
          {formatAccountNo(payTo.accountNo)}
        </Typography>
        <Typography variant="caption" sx={{ color: bank.color, fontWeight: 800, display: "block", lineHeight: 1.3 }}>
          {bank.name}
        </Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>ชื่อบัญชี {payTo.accountName}</Typography>
      </Box>
      <Tooltip title={copied ? "คัดลอกแล้ว" : "คัดลอกเลขบัญชี"} describeChild>
        <IconButton size="small" onClick={copy}>
          {copied ? <Check sx={{ fontSize: 17, color: "#059669" }} /> : <ContentCopy sx={{ fontSize: 16, color: TEXT_SUB }} />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

/**
 * การ์ดยอดเงินหัวกล่องทำรายการ (จ่ายเงิน / จ่ายคืน / รับเงินคืน)
 *
 * ✅ ผู้ใช้ขอให้ "ชัดเจน อ่านง่าย สวยงาม" — เดิมเป็นข้อความบรรทัดเดียวสีเทาจางๆ ปนกับคำอธิบาย
 * ทำให้คนกดต้องอ่านทั้งประโยคถึงจะรู้ว่าเงินไปทางไหนและเท่าไร
 * ⚠️ ต้องบอก "ทิศทางเงิน" เสมอ (บริษัท→พนักงาน หรือ พนักงาน→บริษัท) เพราะสองอย่างนี้ปุ่มหน้าตาเหมือนกัน
 * แต่ผลลัพธ์ตรงกันข้าม — เป็นจุดที่ผู้ใช้เคยสับสนจริง
 */
const MoneyCallout = ({ tone, direction, amount, who, note, icon }) => (
  <Box sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${alpha(tone, 0.35)}`, bgcolor: alpha(tone, 0.07) }}>
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center", bgcolor: alpha(tone, 0.16), color: tone,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: tone, lineHeight: 1.3 }}>{direction}</Typography>
        <Typography sx={{ fontSize: "1.45rem", fontWeight: 900, color: TEXT_MAIN, lineHeight: 1.25 }}>{amount}</Typography>
        {who && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.35 }}>{who}</Typography>}
      </Box>
    </Stack>
    {note && (
      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, lineHeight: 1.45 }}>{note}</Typography>
    )}
  </Box>
);

/**
 * ช่องข้อมูล 1 ช่อง
 * ✅ ผู้ใช้: "ตัวหนังสือดูกลมกลืนกันหมด อ่านยาก" — เดิมป้ายกับค่าหนา/สีใกล้กัน (600 · เทา vs 600 · ดำ)
 *    ตอนนี้ป้ายเล็ก บาง สีจาง · ค่าใหญ่กว่า ตัวหนา สีเข้ม → สายตาแยกออกทันทีว่าอะไรคือหัวข้อ อะไรคือข้อมูล
 */
const InfoCell = ({ label, children, span }) => (
  <Box sx={{ minWidth: 0, gridColumn: span ? "1 / -1" : "auto" }}>
    <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, display: "block", lineHeight: 1.4, mb: 0.25, letterSpacing: ".01em" }}>{label}</Typography>
    <Box sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.45, wordBreak: "break-word" }}>{children || "-"}</Box>
  </Box>
);

/** ผู้เบิก — แถวเด่น: วงกลมอักษรย่อสีประจำคน + ชื่อตัวหนา + ตำแหน่ง (ผู้ใช้ขอ "เน้นดูชื่อผู้เบิก") */
const RequesterRow = ({ label, name, position, extra }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
    <Avatar sx={{ width: 40, height: 40, bgcolor: personColor(name), fontWeight: 800, fontSize: "1rem" }}>{personInitial(name)}</Avatar>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, lineHeight: 1.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }} noWrap>{name || "-"}</Typography>
      {(position || extra) && (
        <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, fontWeight: 500 }} noWrap>{[position, extra].filter(Boolean).join(" · ")}</Typography>
      )}
    </Box>
  </Box>
);

/**
 * แถวข้อมูล "ป้ายซ้าย · ค่าขวา" ในกล่องเส้นคั่น — ✅ ผู้ใช้: "ตัวหนังสือกลมกลืนกันหมด"
 * เดิมเป็นกริดป้ายบน-ค่าล่างทุกช่อง หน้าตาเหมือนกันหมดจนแยกไม่ออก · แบบตาราง 2 ฝั่งอ่านไล่ลงได้ทันที
 */
const KV = ({ label, children, color }) => (
  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, px: 1.5, py: 1.1, "& + &": { borderTop: `1px solid ${BORDER_MAIN}` } }}>
    <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB, fontWeight: 500, flexShrink: 0, minWidth: 92 }}>{label}</Typography>
    <Box sx={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: "0.92rem", fontWeight: 700, color: color || "#0f172a", wordBreak: "break-word" }}>{children || "-"}</Box>
  </Box>
);

/** หัวข้อย่อยในการ์ด — ไอคอนสี + ตัวหนาเล็ก แบ่งกลุ่มข้อมูลให้เห็นเป็นก้อนๆ */
const SubTitle = ({ icon, children, color }) => (
  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.85 }}>
    <Box sx={{ display: "inline-flex", color: color || TEXT_SUB, "& svg": { fontSize: 17 } }}>{icon}</Box>
    <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#334155", letterSpacing: ".02em" }}>{children}</Typography>
  </Stack>
);

/** สายอนุมัติ — เส้นเวลา: วงกลมเช็คเขียว + เส้นเชื่อม · ชื่อขั้น (จาง) · ชื่อคน (หนา) · วันที่ (ชิปเทา ชิดขวา) */
const ApprovalRow = ({ label, name, date, detail, last }) => (
  <Box sx={{ display: "flex", gap: 1.25 }}>
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check sx={{ fontSize: 15 }} />
      </Box>
      {!last && <Box sx={{ flex: 1, width: 2, bgcolor: "#bbf7d0", my: 0.25, minHeight: 14 }} />}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1, pb: last ? 0 : 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{label}</Typography>
        {date && (
          <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", bgcolor: "#f1f5f9", px: 0.85, py: 0.2, borderRadius: 1, whiteSpace: "nowrap" }}>{date}</Box>
        )}
      </Stack>
      <Typography sx={{ fontSize: "0.94rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{name || "-"}</Typography>
      {detail && <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, lineHeight: 1.4, mt: 0.15 }}>{detail}</Typography>}
    </Box>
  </Box>
);

const Card = ({ title, icon, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.5 }}>
    {title && (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        {icon}
        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
    )}
    {children}
  </Box>
);

/**
 * ✅ ป้ายสถานะท้ายกล่อง (ข้างปุ่มพิมพ์) — บอกตลอดว่าใบนี้ "ถึงขั้นไหนแล้ว" แม้เลื่อนดูรายละเอียดลงไปจนไม่เห็นเส้นขั้นตอนด้านบน
 *    (ผู้ใช้ขอ: ใบ ADV/CLM ฯลฯ ให้มีสถานะที่ footer พร้อมอนิเมชั่น ดูง่าย มืออาชีพ)
 * - แถบความคืบหน้าค่อยๆ เติมขึ้นตอนเปิด · ระหว่างดำเนินการมีแสงวิ่งผ่านเบาๆ และจุดกะพริบที่ขั้นปัจจุบัน
 * - ครบแล้ว = เขียว ✓ · ตีกลับ = แดง · ยกเลิก = เทา (ไม่มีอนิเมชั่น — จบแล้ว ไม่ต้องดึงสายตา)
 * ⚠️ เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของเครื่อง (prefers-reduced-motion)
 */
const FooterProgress = ({ steps, status, color }) => {
  const total = steps.length || 1;
  const done = steps.filter((x) => x.done).length;
  const current = steps.find((x) => !x.done);
  const rejected = status === "rejected";
  const cancelled = status === "cancelled";
  const complete = !rejected && !cancelled && done >= total;
  const tone = cancelled ? "#94a3b8" : rejected ? "#dc2626" : complete ? "#059669" : color;
  const text = cancelled ? "ยกเลิกแล้ว"
    : rejected ? "ถูกตีกลับ · รอแก้ไข"
      : complete ? "เสร็จสมบูรณ์"
        : `รอ: ${current?.sub || current?.label || ""}`;
  const moving = !complete && !rejected && !cancelled;
  // ✅ วางข้างปุ่ม "พิมพ์ / แชร์" — จุดตามจำนวนขั้น (ผ่านแล้ว = จุดทึบ · ขั้นที่รอ = จุดกะพริบ · ยังไม่ถึง = จุดเทา)
  //    🧹 เลิกใช้แถบหลอด (ผู้ใช้: ไม่สวย) — จุดขั้นอ่านง่ายกว่าว่าเหลืออีกกี่ขั้น และไม่กินที่
  const currentIndex = moving ? steps.findIndex((x) => !x.done) : -1;
  return (
    <Box title={text} sx={{ display: "inline-flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      {!cancelled && (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {steps.map((st, i) => {
            const isCurrent = i === currentIndex;
            const filled = st.done || (complete);
            return (
              <Box key={i} sx={{
                // ✅ ขั้นที่กำลังรอ = วงโหลดหมุน (ผู้ใช้ขอ "วงๆโหลด แบบแอพมืออาชีพ") · ขั้นอื่นเป็นจุดนิ่ง
                width: isCurrent ? 12 : 7, height: isCurrent ? 12 : 7, borderRadius: "50%", boxSizing: "border-box",
                bgcolor: isCurrent ? "transparent" : rejected && st.danger ? tone : filled ? tone : "#e2e8f0",
                border: isCurrent ? `2px solid ${alpha(tone, 0.2)}` : "none",
                borderTopColor: isCurrent ? tone : undefined,
                transition: "background-color .3s",
                animation: isCurrent ? "efpSpin .8s linear infinite" : `efpIn .35s ease-out ${i * 0.08}s both`,
                "@keyframes efpIn": { from: { transform: "scale(0)", opacity: 0 }, to: { transform: "scale(1)", opacity: 1 } },
                "@keyframes efpSpin": { to: { transform: "rotate(360deg)" } },
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }} />
            );
          })}
        </Box>
      )}
      <Typography noWrap sx={{ minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: complete || rejected || cancelled ? tone : "text.primary" }}>
        {complete ? "✓ " : ""}{text}
      </Typography>
    </Box>
  );
};

/** เส้นขั้นตอน — ขั้นที่ผ่านแล้วมีวันที่กำกับ */
const Steps = ({ steps, color }) => (
  <Stack direction="row" sx={{ mt: 1.5 }}>
    {steps.map((s, i) => {
      const done = Boolean(s.done);
      const current = !done && (i === 0 || steps[i - 1].done);
      const c = s.danger ? "#dc2626" : done ? color : current ? alpha(color, 0.9) : "#cbd5e1";
      return (
        <Box key={s.label} sx={{ flex: 1, minWidth: 0, position: "relative", textAlign: "center" }}>
          {i > 0 && (
            <Box sx={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2, bgcolor: done || current ? alpha(color, 0.5) : "#e2e8f0", zIndex: 0 }} />
          )}
          <Box sx={{
            width: 24, height: 24, mx: "auto", borderRadius: "50%", position: "relative", zIndex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
            bgcolor: done ? c : "#fff", color: done ? "#fff" : c, border: `2px solid ${c}`,
            boxShadow: current ? `0 0 0 4px ${alpha(color, 0.15)}` : "none",
          }}>
            {/* ⚠️ "เคลียร์" เป็นงานติดตามหลังเงินออก ไม่ใช่ขั้นอนุมัติ — ไม่ให้เลขขั้น ไม่งั้นจะนับเป็น 4 ส่วน */}
            {done ? <TaskAlt sx={{ fontSize: 15 }} /> : s.followUp ? "•" : i + 1}
          </Box>
          <Typography sx={{ fontSize: { xs: "0.68rem", sm: "0.76rem" }, fontWeight: current || done ? 800 : 600, color: done || current ? TEXT_MAIN : TEXT_SUB, mt: 0.5, lineHeight: 1.2 }}>
            {s.label}
          </Typography>
          <Typography sx={{ fontSize: "0.66rem", color: TEXT_SUB, lineHeight: 1.2 }}>{s.date ? thaiDate(s.date) : " "}</Typography>
          {/* ✅ ส่วนที่รวมสองมือ (ตรวจสอบ/อนุมัติ) บอกว่าตอนนี้อยู่มือไหน */}
          {s.sub && (
            <Typography sx={{ fontSize: "0.63rem", fontWeight: 700, color: alpha(color, 0.95), lineHeight: 1.2 }}>{s.sub}</Typography>
          )}
        </Box>
      );
    })}
  </Stack>
);

/**
 * ตารางเทียบรายบรรทัด ตั้งเบิก (Advance) ↔ ใช้จริง (Claim)
 * ✅ ผู้ใช้ขอให้ "ตรวจสอบและดูง่าย" — คอลัมน์ตั้งเบิกพื้นเขียวอมฟ้า คอลัมน์ใช้จริงพื้นม่วง ตรงกับสีประจำใบ
 * แถวที่ตั้งเบิกไว้แต่ไม่ได้ใช้ยังโชว์ (ขีดจาง) ผู้ตรวจจะได้เห็นว่ามีรายการหายไป ไม่ใช่เห็นแค่ยอดรวมที่ลดลง
 */
const CompareTable = ({ items, advanceItems, wide }) => {
  const A = KIND_META.advance;
  const C = KIND_META.claim;
  const { rows, plannedTotal, actualTotal } = compareItems(items || [], advanceItems || []);
  const diffTotal = money(actualTotal - plannedTotal);
  const diffColor = (d) => (d === 0 ? TEXT_SUB : d > 0 ? "#1d4ed8" : "#d97706");
  const diffText = (d) => (d === 0 ? "—" : `${d > 0 ? "+" : "−"}${fmtMoney(Math.abs(d))}`);
  if (!rows.length) return null;

  if (!wide) {
    return (
      <Stack spacing={1}>
        {rows.map((r, i) => {
          const cat = categoryMeta(r.category);
          const faded = r.kind === "unused";
          return (
            <Box key={r.key} sx={{ p: 1, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, opacity: faded ? 0.8 : 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="baseline">
                <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, fontWeight: 700 }}>{i + 1}.</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: "0.86rem", flex: 1, minWidth: 0, textDecoration: faded ? "line-through" : "none" }}>{r.description}{r.person?.name ? <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · {r.person.name}</Box> : null}</Typography>
                {COMPARE_KIND_LABEL[r.kind] && <Chip size="small" label={COMPARE_KIND_LABEL[r.kind]} sx={{ height: 18, fontSize: "0.62rem", fontWeight: 800 }} />}
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", ml: 2 }}>
                <Box component="span" sx={{ color: cat.color, fontWeight: 700 }}>{cat.label}</Box>
                {r.actual ? ` · ${qtyText(r.actual)}` : ""}{r.receiptNo ? ` · ใบเสร็จ ${r.receiptNo}` : ""}
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 0.5, mt: 0.75 }}>
                <Box sx={{ px: 0.75, py: 0.4, borderRadius: 1.5, bgcolor: A.soft }}>
                  <Typography sx={{ fontSize: "0.62rem", color: A.dark, fontWeight: 800 }}>ตั้งเบิก</Typography>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: A.dark }}>{r.planned ? fmtMoney(r.plannedAmount) : "-"}</Typography>
                </Box>
                <Box sx={{ px: 0.75, py: 0.4, borderRadius: 1.5, bgcolor: C.soft }}>
                  <Typography sx={{ fontSize: "0.62rem", color: C.dark, fontWeight: 800 }}>ใช้จริง</Typography>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: C.dark }}>{fmtMoney(r.actualAmount)}</Typography>
                </Box>
                <Box sx={{ px: 0.75, py: 0.4, textAlign: "right" }}>
                  <Typography sx={{ fontSize: "0.62rem", color: TEXT_SUB, fontWeight: 800 }}>ต่าง</Typography>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: diffColor(r.diff) }}>{diffText(r.diff)}</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 0.5, p: 1, borderRadius: 2, bgcolor: "#f1f5f9" }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, color: A.dark }}>{fmtMoney(plannedTotal)}</Typography>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, color: C.dark }}>{fmtMoney(actualTotal)}</Typography>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, textAlign: "right", color: diffColor(diffTotal) }}>{diffText(diffTotal)}</Typography>
        </Box>
      </Stack>
    );
  }

  const grid = "32px minmax(0, 1fr) 118px 118px 96px";
  const cell = { px: 1, py: 0.85, fontSize: "0.84rem" };
  const head = { ...cell, fontSize: "0.74rem", fontWeight: 800, color: TEXT_SUB };
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: grid, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER_MAIN}` }}>
        <Typography sx={head}>#</Typography>
        <Typography sx={head}>รายการ</Typography>
        <Typography sx={{ ...head, textAlign: "right", bgcolor: A.soft, color: A.dark }}>ตั้งเบิก (Advance)</Typography>
        <Typography sx={{ ...head, textAlign: "right", bgcolor: C.soft, color: C.dark }}>ใช้จริง (Claim)</Typography>
        <Typography sx={{ ...head, textAlign: "right" }}>ส่วนต่าง</Typography>
      </Box>
      {rows.map((r, i) => {
        const cat = categoryMeta(r.category);
        const faded = r.kind === "unused";
        return (
          <Box key={r.key} sx={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${BORDER_MAIN}`, alignItems: "stretch" }}>
            <Typography sx={{ ...cell, color: TEXT_SUB, fontWeight: 700 }}>{i + 1}</Typography>
            <Box sx={{ ...cell, minWidth: 0, opacity: faded ? 0.75 : 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography sx={{ fontWeight: 700, fontSize: "0.86rem", textDecoration: faded ? "line-through" : "none" }}>{r.description}{r.person?.name ? <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · {r.person.name}</Box> : null}</Typography>
                {COMPARE_KIND_LABEL[r.kind] && <Chip size="small" label={COMPARE_KIND_LABEL[r.kind]} sx={{ height: 18, fontSize: "0.62rem", fontWeight: 800 }} />}
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                <Box component="span" sx={{ color: cat.color, fontWeight: 700 }}>{cat.label}</Box>
                {r.actual ? ` · ${qtyText(r.actual)}` : r.planned ? ` · ตั้งไว้ ${qtyText(r.planned)}` : ""}
                {r.receiptNo ? ` · ใบเสร็จ ${r.receiptNo}` : ""}{r.detail ? ` · ${r.detail}` : ""}
              </Typography>
            </Box>
            <Typography sx={{ ...cell, textAlign: "right", bgcolor: A.soft, color: A.dark, fontWeight: 800 }}>{r.planned ? fmtMoney(r.plannedAmount) : "-"}</Typography>
            <Typography sx={{ ...cell, textAlign: "right", bgcolor: C.soft, color: C.dark, fontWeight: 800 }}>{fmtMoney(r.actualAmount)}</Typography>
            <Typography sx={{ ...cell, textAlign: "right", color: diffColor(r.diff), fontWeight: 800 }}>{diffText(r.diff)}</Typography>
          </Box>
        );
      })}
      <Box sx={{ display: "grid", gridTemplateColumns: grid, bgcolor: "#f1f5f9" }}>
        <Box />
        <Typography sx={{ ...cell, fontWeight: 900 }}>รวม</Typography>
        <Typography sx={{ ...cell, textAlign: "right", fontWeight: 900, color: A.dark, bgcolor: alpha(A.color, 0.12) }}>{fmtMoney(plannedTotal)}</Typography>
        <Typography sx={{ ...cell, textAlign: "right", fontWeight: 900, color: C.dark, bgcolor: alpha(C.color, 0.12) }}>{fmtMoney(actualTotal)}</Typography>
        <Typography sx={{ ...cell, textAlign: "right", fontWeight: 900, color: diffColor(diffTotal) }}>{diffText(diffTotal)}</Typography>
      </Box>
    </Box>
  );
};

const today = () => moment().format("YYYY-MM-DD");

/** การกระทำที่ลงลายเซ็นอิเล็กทรอนิกส์ได้ และช่องลงนามของแต่ละการกระทำใน PDF */
const SIGN_ACTIONS = ["review", "reviewApprove", "approve", "pay", "settle"];
/**
 * ⚠️ เอกสารมีช่องลงนาม 3 ช่อง — "ตรวจสอบ" กับ "อนุมัติ" ใช้ช่องรวมช่องเดียวกัน (ผู้ใช้สั่ง)
 * ช่องรวมพิมพ์ชื่อ/ลายเซ็นของผู้อนุมัติ แล้วกำกับบรรทัดเล็กว่าใครเป็นผู้ตรวจสอบ (ดู expensePdf.js)
 */
const SIGN_BOX_LABEL = {
  review: "ผู้ตรวจสอบ/อนุมัติ",
  reviewApprove: "ผู้ตรวจสอบ/อนุมัติ",
  approve: "ผู้ตรวจสอบ/อนุมัติ",
  pay: "ผู้อนุมัติเบิกจ่าย",
  settle: "ผู้อนุมัติเบิกจ่าย",
};

/**
 * ใครรับผิดชอบขั้นไหน — ใช้ในข้อความ "รอใคร" (ตรงกับ CAPABILITIES ใน shared/utils/roles.js)
 * ⚠️ ถ้าเปลี่ยนสิทธิ์ของขั้นไหน ต้องแก้ข้อความที่นี่ด้วย
 */
const STEP_OWNER = {
  review: "แอดมินช่าง/ผู้จัดการแผนกช่าง",
  approve: "ผู้จัดการแผนกช่าง",
  disburse: "ผู้จัดการแผนกช่าง/กรรมการผู้จัดการ",
};

/**
 * กล่องยืนยันการดำเนินการ (ตรวจสอบ / อนุมัติ / อนุมัติเบิกจ่าย / ตีกลับ / ยกเลิก)
 * ⚠️ อยู่ module scope — ประกาศในตัว component หลักจะทำให้ช่องกรอกหลุดโฟกัสทุกตัวอักษร
 */
const ActionDialog = ({ action, expense, busy, error, onCancel, onSubmit }) => {
  const [form, setForm] = useState({});
  /** ลายเซ็นของผู้อนุมัติเอง — ✅ ติ๊กเลือกได้ว่าจะลงลายเซ็นในใบที่กำลังอนุมัติไหม (ผู้ใช้ขอ) */
  const [mySignature, setMySignature] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!SIGN_ACTIONS.includes(action)) return;
    SignatureService.me().then(setMySignature).catch(() => {});
  }, [action]);
  useEffect(() => {
    if (!action) return;
    setForm({
      useSignature: true,
      reason: "", note: "", paidAt: today(), method: "transfer", ref: "",
      dueClearAt: action === "pay" ? (expense?.dueClearAt ? moment(expense.dueClearAt).format("YYYY-MM-DD") : moment().add(7, "days").format("YYYY-MM-DD")) : "",
      files: [],
    });
  }, [action, expense?._id, expense?.dueClearAt]);
  if (!action) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const slip = slipKind(expense);
  const reimburse = slip === "reimburse";
  /** ใบค่าจ้างผู้รับเหมา — เงินออกไปหาผู้รับเหมา (ยอดสุทธิหลังหัก) ไม่มี Advance ให้เคลียร์ */
  const ctr = slip === "contractor";
  const diff = differenceMeta(expense?.difference, slip);
  const zeroDiff = expense?.kind === "claim" && !reimburse && money(expense?.difference) === 0;
  /** หลังขั้นอนุมัติ เงินจะไหลไปทางไหน — ใช้บอกผู้อนุมัติว่าขั้นถัดไป (อนุมัติเบิกจ่าย) คืออะไร */
  const disburseWhat = expense?.kind === "advance"
    ? `จ่ายเงิน Advance ${baht(expense?.total)}`
    : reimburse ? `จ่ายคืนค่าสำรองจ่าย ${baht(expense?.total)}`
      : ctr ? `จ่ายค่าจ้างสุทธิ ${baht(expense?.difference)} ให้ ${expense?.contractor?.name || "ผู้รับเหมา"}` : `${diff.short} ${baht(diff.amount)}`;
  const cfg = {
    /**
     * ✅ ส่วนที่ 2 (มือแรก) — ตรวจสอบ โดยแอดมินช่าง แล้วส่งต่อให้ผู้จัดการแผนกช่างอนุมัติ
     * ⚠️ "ตรวจสอบ" ไม่ใช่ "อนุมัติ" — ต้องพูดให้ชัดว่ายังต้องรออีกขั้น ไม่งั้นคนกดเข้าใจว่าจบแล้ว
     */
    review: {
      title: "ตรวจสอบใบเบิก · ขั้นที่ 2 จาก 3", color: "#b45309", button: "ยืนยันผลตรวจสอบ",
      body: `ยืนยันว่ารายการและหลักฐานของยอด ${baht(expense?.total)} ถูกต้อง — ระบบจะส่งต่อให้${STEP_OWNER.approve}พิจารณาอนุมัติ`,
    },
    /**
     * ✅ ผู้จัดการกดตรวจสอบและอนุมัติเองได้ในปุ่มเดียว (ผู้ใช้สั่งไว้ก่อนหน้า)
     * ⚠️ ระบบยังบันทึกแยกเป็น 2 ขั้น (ชื่อ/เวลา/ลายเซ็นลงทั้งช่องผู้ตรวจสอบและผู้อนุมัติ) ไม่ใช่การข้ามขั้น
     */
    reviewApprove: {
      title: "ตรวจสอบและอนุมัติ · ขั้นที่ 2 จาก 3", color: "#059669", button: "ยืนยันทั้งสองมือ",
      body: zeroDiff
        ? `คุณจะลงนามทั้งช่อง "ผู้ตรวจสอบ" และ "ผู้อนุมัติ" — ${ctr ? "ยอดสุทธิเป็น 0 (หักมัดจำครบ)" : "ใช้จริงพอดีกับยอด Advance"} ใบจะปิดจบทันที`
        : `คุณจะลงนามทั้งช่อง "ผู้ตรวจสอบ" และ "ผู้อนุมัติ" ของใบนี้ด้วยตัวเอง — จากนั้นส่งต่อให้${STEP_OWNER.disburse}อนุมัติเบิกจ่าย (${disburseWhat})`,
    },
    approve: {
      title: "อนุมัติใบเบิก · ขั้นที่ 2 จาก 3", color: "#059669", button: "ยืนยันอนุมัติ",
      body: zeroDiff
        ? (ctr ? "ยอดสุทธิเป็น 0 (หักมัดจำ/เบิกล่วงหน้าครบ) ไม่มีเงินต้องจ่าย — อนุมัติแล้วปิดใบทันที" : "ใช้จริงพอดีกับยอด Advance ไม่มีเงินต้องเบิกจ่าย — อนุมัติแล้วใบ Advance จะเคลียร์ทันที")
        : `อนุมัติแล้วระบบจะส่งต่อให้${STEP_OWNER.disburse}อนุมัติเบิกจ่าย (${disburseWhat})`,
    },
    reject: {
      title: "ตีกลับให้แก้ไข", color: "#dc2626", button: "ตีกลับ",
      body: expense?.status === "pending"
        ? "ผู้เบิกจะได้รับแจ้งพร้อมเหตุผล และแก้ไขส่งใหม่ในใบเดิมได้"
        : "ผู้เบิกและผู้ที่ตรวจสอบ/อนุมัติไปแล้วจะได้รับแจ้งพร้อมเหตุผล — ผลตรวจสอบ อนุมัติ และลายเซ็นเดิมจะถูกล้าง เมื่อแก้ไขแล้วใบจะเริ่มที่ขั้นตรวจสอบใหม่",
    },
    cancel: {
      title: "ยกเลิกใบนี้", color: "#64748b", button: "ยืนยันยกเลิก",
      // ⚠️ ใบสำรองจ่ายไม่มี Advance ให้คืนสถานะ — ข้อความของใบเคลมใช้กับมันไม่ได้
      body: expense?.kind === "claim" && !reimburse && !ctr
        ? "ใบ Advance ที่อ้างถึงจะกลับไปรอเคลียร์ และออกใบเคลมใหม่ได้"
        : "ยกเลิกแล้วย้อนกลับไม่ได้ (เลขที่เอกสารจะไม่ถูกนำกลับมาใช้)",
    },
    /**
     * ✅ ส่วนที่ 3 — อนุมัติเบิกจ่าย (ผู้จัดการแผนกช่าง / กรรมการผู้จัดการ) · ลงนามช่อง "ผู้อนุมัติเบิกจ่าย"
     * ⚠️ ข้อความใต้หัวข้อบอกแค่ "ผลที่จะเกิด" — ตัวยอดและทิศทางเงินอยู่ในการ์ด MoneyCallout ด้านล่าง
     */
    pay: {
      title: "อนุมัติเบิกจ่าย · จ่ายเงิน Advance", color: KIND_META.advance.color, button: "อนุมัติเบิกจ่าย",
      body: "ขั้นที่ 3 จาก 3 — ลงนามผู้อนุมัติเบิกจ่ายและบันทึกการจ่ายเงิน ใบจะเปลี่ยนเป็น “จ่ายให้พนักงานแล้ว · รอเคลียร์”",
    },
    settle: ctr
      ? {
        title: "อนุมัติเบิกจ่าย · จ่ายค่าจ้างผู้รับเหมา", color: KIND_META.contractor.color, button: "อนุมัติเบิกจ่าย",
        body: "ขั้นที่ 3 จาก 3 — ลงนามผู้อนุมัติเบิกจ่ายและบันทึกการจ่ายเงินให้ผู้รับเหมา (อย่าลืมออกหนังสือรับรองการหักภาษี ณ ที่จ่ายถ้ามีการหัก)",
      }
      : reimburse
      ? {
        title: "อนุมัติเบิกจ่าย · จ่ายคืนค่าสำรองจ่าย", color: KIND_META.reimburse.color, button: "อนุมัติเบิกจ่าย",
        body: "ขั้นที่ 3 จาก 3 — ลงนามผู้อนุมัติเบิกจ่ายและบันทึกการจ่ายคืน ใบนี้จะเสร็จสิ้น",
      }
      : money(expense?.difference) > 0
        ? {
          title: "อนุมัติเบิกจ่าย · จ่ายส่วนต่างเพิ่ม", color: KIND_META.claim.color, button: "อนุมัติเบิกจ่าย",
          body: "ขั้นที่ 3 จาก 3 — ลงนามผู้อนุมัติเบิกจ่ายและบันทึกการจ่ายเงิน ใบ Advance ที่อ้างถึงจะเคลียร์เรียบร้อย",
        }
        : {
          title: "ยืนยันรับเงินคืนจากพนักงาน", color: "#c2410c", button: "ยืนยันรับเงินคืน",
          body: "ขั้นที่ 3 จาก 3 — ลงนามช่องผู้อนุมัติเบิกจ่ายเพื่อยืนยันว่าได้รับเงินคืนครบแล้ว ใบ Advance ที่อ้างถึงจะเคลียร์เรียบร้อย",
        },
  }[action];
  const needReason = action === "reject";
  const payLike = action === "pay" || action === "settle";
  /** ใบเคลมที่ผู้เบิกต้องคืนเงินบริษัท — ทิศทางเงินตรงข้ามกับการโอนเข้าบัญชีผู้เบิก */
  const returningToCompany = expense?.kind === "claim" && !reimburse && !ctr && money(expense?.difference) < 0;

  return (
    <Dialog open onClose={() => !busy && onCancel()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{cfg.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>{cfg.body}</Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <Stack spacing={1.5}>
          {payLike && (
            <>
              {/* ✅ ยอดและทิศทางเงินเป็นสิ่งแรกที่เห็น — กันกดผิดใบ/ผิดทิศทาง */}
              <MoneyCallout
                tone={returningToCompany ? "#c2410c" : cfg.color}
                icon={returningToCompany ? <Undo /> : <Payments />}
                direction={returningToCompany
                  ? "พนักงานคืนเงินให้บริษัท"
                  : action === "pay" ? "บริษัทจ่ายเงินล่วงหน้าให้พนักงาน"
                    : ctr ? "บริษัทจ่ายค่าจ้างสุทธิให้ผู้รับเหมา"
                    : reimburse ? "บริษัทจ่ายคืนพนักงาน" : "บริษัทจ่ายเพิ่มให้พนักงาน"}
                amount={baht(action === "pay" || reimburse ? expense?.total : diff.amount)}
                who={ctr
                  ? `${expense?.contractor?.name || "ผู้รับเหมา"}${installmentText(expense?.installment) ? ` · ${installmentText(expense.installment)}` : ""}${expense?.docNo ? ` · ${expense.docNo}` : ""}`
                  : `${personFullName(expense?.requester) || "ผู้เบิก"}${expense?.docNo ? ` · ${expense.docNo}` : ""}`}
                note={ctr && expense?.deductions?.wht
                  ? `หัก ณ ที่จ่าย ${expense.deductions.whtRate}% = ${baht(expense.deductions.wht)} ไว้แล้ว — นำส่งสรรพากรและออก 50 ทวิ ให้ผู้รับเหมา`
                  : undefined}
                {...(returningToCompany ? { note: "รับเงินสด/เงินโอนจากพนักงานให้เรียบร้อยก่อน แล้วค่อยบันทึกที่นี่" } : {})}
              />
              {/* ✅ คนกดจ่ายเงินเห็นบัญชีปลายทางตรงนี้เลย ไม่ต้องปิดกล่องไปหาในหน้ารายละเอียด */}
              {/* ⚠️ กล่องบัญชีขึ้นเฉพาะตอนบริษัทเป็นฝ่ายโอนให้ผู้เบิก — ตอน "รับเงินคืน" ไม่ต้องมี */}
              {payLike && expense?.payTo?.accountNo && !returningToCompany && (
                <Box>
                  <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", mb: 0.5 }}>
                    {action === "pay" ? "โอนเงิน Advance เข้าบัญชีของผู้เบิก" : ctr ? "โอนเข้าบัญชีของผู้รับเหมา" : "โอนเข้าบัญชีของผู้เบิก"}
                  </Typography>
                  <PayToBox payTo={expense.payTo} dense />
                </Box>
              )}
              {/* ป้ายช่องเปลี่ยนตามทิศทางเงิน — "วันที่รับเงินคืน" กับ "วันที่จ่ายเงิน" คนละความหมาย */}
              <ThaiDatePicker
                label={returningToCompany ? "วันที่รับเงินคืน" : action === "pay" ? "วันที่จ่ายเงิน" : "วันที่จ่ายเงิน"}
                value={form.paidAt}
                onChange={(v) => setForm((f) => ({ ...f, paidAt: v || today() }))}
              />
              <TextField select size="small" label={returningToCompany ? "รับคืนเป็น" : "จ่ายเป็น"} value={form.method || "transfer"} onChange={set("method")}>
                {PAYMENT_METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
              <TextField size="small" label="เลขอ้างอิง (ไม่บังคับ)"
                placeholder={returningToCompany ? "เช่น เลขที่ใบเสร็จรับเงิน / เลขที่รายการโอนเข้า" : "เช่น ธนาคาร / เลขที่รายการ"}
                value={form.ref || ""} onChange={set("ref")} />
              {action === "pay" && (
                <ThaiDatePicker label="กำหนดเคลียร์" value={form.dueClearAt} onChange={(v) => setForm((f) => ({ ...f, dueClearAt: v || "" }))}
                  helperText="ระบบจะเตือนผู้เบิกทุกวันเมื่อเลยกำหนดแล้วยังไม่ส่งใบเคลม" />
              )}
              <input ref={fileRef} type="file" hidden accept={ACCEPT_ALL} multiple onChange={(e) => { const fl = Array.from(e.target.files || []); setForm((f) => ({ ...f, files: [...(f.files || []), ...fl].slice(0, 5) })); e.target.value = ""; }} />
              <Box>
                <Button size="small" startIcon={<AttachFile />} onClick={() => fileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>
                  {returningToCompany ? "แนบหลักฐานการรับเงินคืน" : "แนบสลิป / หลักฐานการโอน"}
                </Button>
                {(form.files || []).map((f, i) => (
                  <Chip key={`${f.name}-${i}`} size="small" label={f.name} onDelete={() => setForm((x) => ({ ...x, files: x.files.filter((_, j) => j !== i) }))} sx={{ m: 0.25, maxWidth: "100%" }} />
                ))}
              </Box>
            </>
          )}
          {(needReason || action === "cancel") && (
            <TextField
              size="small" label={needReason ? "เหตุผลที่ตีกลับ *" : "เหตุผล (ไม่บังคับ)"} value={form.reason || ""} onChange={set("reason")}
              multiline minRows={2} autoFocus inputProps={{ maxLength: 500 }}
              placeholder={needReason ? "เช่น ใบเสร็จค่าน้ำมันไม่ชัด กรุณาแนบใหม่" : ""}
            />
          )}
          {SIGN_ACTIONS.includes(action) && (
            <TextField size="small" label="หมายเหตุ (ไม่บังคับ)" value={form.note || ""} onChange={set("note")} inputProps={{ maxLength: 500 }} />
          )}
          {/* ✅ ลงลายเซ็นอิเล็กทรอนิกส์ในช่องของขั้นนี้ของใบ PDF หรือไม่ (ผู้ตรวจสอบ/ผู้อนุมัติ/ผู้อนุมัติเบิกจ่าย) */}
          {SIGN_ACTIONS.includes(action) && mySignature && (
            <Box sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2 }}>
              <FormControlLabel
                sx={{ mr: 0 }}
                control={(
                  <Checkbox size="small" checked={form.useSignature !== false}
                    onChange={(e) => setForm((f) => ({ ...f, useSignature: e.target.checked }))}
                    sx={{ "&.Mui-checked": { color: cfg.color } }} />
                )}
                label={(
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <HistoryEdu sx={{ fontSize: 17, color: cfg.color }} />
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>
                      ลงลายเซ็นอิเล็กทรอนิกส์ของฉัน (ช่อง{SIGN_BOX_LABEL[action]})
                    </Typography>
                  </Stack>
                )}
              />
              <Box component="img" src={mySignature.image} alt=""
                sx={{ display: "block", ml: 3.75, height: 32, maxWidth: 150, objectFit: "contain", opacity: form.useSignature !== false ? 1 : 0.28 }} />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
        <Button
          variant="contained" disabled={busy || (needReason && !String(form.reason || "").trim())}
          onClick={() => onSubmit(form)}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: cfg.color, "&:hover": { bgcolor: cfg.color, filter: "brightness(0.92)", boxShadow: "none" } }}
        >
          {cfg.button}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function ExpenseDetailDialog({ open, expenseId, reloadKey = 0, notice = null, onLoaded, onClose, onChanged, onEdit, onCreateClaim, onOpenOther }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const [panelOpen, setPanelOpen] = useState(false);
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  // ✅ ข้อความผลการทำรายการอยู่ "ในกล่อง" ไม่ใช่ Snackbar — บนมือถือ Snackbar ลอยทับแถบปุ่มล่างของกล่อง
  // (พิมพ์/แชร์/อนุมัติ) จนกดไม่ได้หลายวินาทีหลังส่งใบ
  const [toast, setToast] = useState("");
  const [toastSeverity, setToastSeverity] = useState("success");
  const [printOpen, setPrintOpen] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!expenseId) return;
    setLoading(true); setLoadError("");
    try {
      const doc = await ExpenseService.get(expenseId);
      setExpense(doc);
      // ✅ บอกหน้าแม่ว่าใบนี้เป็นชนิดไหน — หน้า /expenses/<id> (มาจากลิงก์แจ้งเตือน) จะได้รู้ว่าต้องโชว์
      // พื้นหลังเป็นหน้าใบ Advance หรือใบเคลม และตอนปิดกล่องควรพากลับไปหน้าไหน
      onLoaded?.(doc);
    } catch (err) {
      setLoadError(errorText(err, "เปิดใบนี้ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoaded เป็น callback ของหน้าแม่ ไม่ควรทำให้ผูกใหม่ทุกครั้ง
  }, [expenseId]);

  useEffect(() => {
    if (!open) return;
    setExpense(null); setAction("");
    setToast(notice?.text || "");
    setToastSeverity(notice?.severity || "success");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ข้อความแจ้งผลอ่านเฉพาะตอนเปิดใบ
  }, [open, load]);

  // ✅ บันทึกการแก้ไขจากฟอร์มขณะกล่องนี้เปิดอยู่ (id เดิม) — ข้อความผลต้องขึ้นด้วย
  useEffect(() => {
    if (open && notice?.text) { setToastSeverity(notice.severity || "success"); setToast(notice.text); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ทำงานเฉพาะตอนมีข้อความใหม่
  }, [notice]);

  // ✅ โหลดใหม่เมื่อข้อมูลเปลี่ยนจากที่อื่น (แก้ไขใบจากฟอร์ม / ดำเนินการสำเร็จ) — id เดิม effect ด้านบนจึงไม่ทำงาน
  // ⚠️ ไม่ล้างข้อมูลเดิมก่อนโหลด ไม่งั้นหน้าจอกระพริบเป็นโครงร่างทุกครั้งที่กดปุ่ม
  useEffect(() => {
    if (open && reloadKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งใจให้ทำงานเฉพาะตอน reloadKey เปลี่ยน
  }, [reloadKey]);

  const me = String(userData?.userId || "");
  const e = expense;
  const kind = e?.kind || "advance";
  /**
   * ⚠️ "ชนิดที่ใช้แสดงผล" ไม่เท่ากับ kind — ใบสำรองจ่ายมี kind = "claim" แต่ไม่มี Advance ให้เทียบเลย
   * ทุกส่วนที่เกี่ยวกับการเทียบยอด/ใบอ้างอิง ต้องเช็ค isClearClaim ไม่ใช่ isClaimKind
   */
  const slip = slipKind(e);
  const isReimburse = slip === "reimburse";
  const isCtr = slip === "contractor";
  const meta = KIND_META[slip];
  const isOwner = e && (e.requester?.userId === me || e.createdBy?.userId === me);
  /**
   * ✅ สายอนุมัติ 3 ส่วน: ส่งขอเบิก → ตรวจสอบ (reviewExpense) + อนุมัติ (approveExpense) = ส่วนที่ 2
   *   → อนุมัติเบิกจ่าย (disburseExpense) — server บังคับซ้ำทุกด่าน หน้าจอแค่ซ่อน/ปิดปุ่ม
   */
  const canReview = can("reviewExpense");
  const canApprove = can("approveExpense");
  const canDisburse = can("disburseExpense");
  /** ผู้ตรวจสอบใบนี้จะมาอนุมัติเองได้เฉพาะผู้จัดการ (approveOwnReview) — server บังคับซ้ำ */
  const reviewedByMe = e && String(e.reviewedBy?.userId || "") === String(me || "");
  const canApproveOwnReview = can("approveOwnReview");
  /** กดจบทั้งขั้นตรวจสอบและอนุมัติเองได้ไหม (ผู้จัดการ) — ใช้ตัดสินทั้งปุ่มรวมและปุ่มอนุมัติหลังตรวจเอง */
  const canChainBothSteps = canReview && canApprove && canApproveOwnReview;
  /** ผู้ดำเนินการใบเบิกขั้นใดขั้นหนึ่ง */
  const canActOnDoc = canReview || canApprove || canDisburse;
  /** ทำขั้นที่ใบนี้กำลังรออยู่ได้ไหม (ใช้กับปุ่มตีกลับ — ตีกลับได้เฉพาะขั้นของตัวเอง) */
  const canActOnCurrentStep = e && (
    (e.status === "pending" && canReview) || (e.status === "reviewed" && canApprove) || (e.status === "approved" && canDisburse)
  );
  const viewAll = can("viewAllExpenses");
  // ⚠️ ใช้ approveOwnExpense ไม่ใช่ manageAll — ผู้จัดการตั้งค่าระบบได้ทุกอย่างแต่ยังอนุมัติใบตัวเองไม่ได้
  const selfBlocked = e && e.requester?.userId === me && !can("approveOwnExpense");
  const editable = e && ["pending", "rejected"].includes(e.status);
  const canEdit = editable && (isOwner || viewAll);
  // ⚠️ กติกาเดียวกับ server (POST /:id/cancel): ยกเลิกได้ตามขั้นที่ตัวเองรับผิดชอบ
  const canCancel = e && ((isOwner && editable)
    || (editable && canActOnDoc)
    || (e.status === "reviewed" && (canReview || canApprove))
    || (e.status === "approved" && (canApprove || canDisburse)));
  const canAddFiles = e && e.status !== "cancelled" && (isOwner || canActOnDoc);
  const canRemoveFile = e && (canActOnDoc ? e.status !== "cancelled" : canEdit);
  const overdue = isOverdueClear(e);
  /**
   * ทิศทางของเงินในใบนี้ — ใช้ตัดสินว่าจะโชว์ "บัญชีรับเงิน" หรือ "ยอดที่ต้องคืนบริษัท"
   * ⚠️ ใบเคลมที่ใช้จริงน้อยกว่ายอด Advance = ผู้เบิกต้องคืนเงิน ไม่ใช่รอรับโอน (ผู้ใช้แจ้งว่าสับสน)
   */
  const moneyToRequester = e && (kind === "advance" || isReimburse || money(e.difference) > 0);
  const mustReturn = e && kind === "claim" && !isReimburse && !isCtr && money(e.difference) < 0;

  const applyResult = (updated, message) => {
    setAction("");
    setActionError("");
    setToastSeverity("success");
    setToast(message);
    if (updated) setExpense((cur) => ({ ...cur, ...updated }));
    onChanged?.(updated);
  };

  const runAction = async (form) => {
    setBusy(true); setActionError("");
    try {
      let updated;
      const files = (form.files || []).map((file) => ({ file, kind: "transfer_slip" }));
      if (action === "review") updated = await ExpenseService.review(e._id, form.note, form.useSignature !== false);
      if (action === "reviewApprove") {
        // ⚠️ ยิงสองครั้งตามลำดับจริง — ระบบจะได้บันทึกครบทั้งสองขั้น (ไม่ใช่ endpoint ลัดที่ข้ามขั้น)
        // ถ้าขั้นแรกผ่านแต่ขั้นสองพลาด ใบจะค้างที่ "ตรวจสอบแล้ว" ซึ่งกดอนุมัติซ้ำต่อได้ตามปกติ
        await ExpenseService.review(e._id, form.note, form.useSignature !== false);
        updated = await ExpenseService.approve(e._id, form.note, form.useSignature !== false);
      }
      if (action === "approve") updated = await ExpenseService.approve(e._id, form.note, form.useSignature !== false);
      if (action === "reject") updated = await ExpenseService.reject(e._id, form.reason);
      if (action === "cancel") updated = await ExpenseService.cancel(e._id, form.reason);
      const useSignature = form.useSignature !== false;
      if (action === "pay") updated = (await ExpenseService.pay(e._id, { paidAt: form.paidAt, method: form.method, ref: form.ref, note: form.note, dueClearAt: form.dueClearAt, useSignature }, files)).expense;
      if (action === "settle") updated = (await ExpenseService.settle(e._id, { paidAt: form.paidAt, method: form.method, ref: form.ref, note: form.note, useSignature }, files)).expense;
      // ✅ บอกให้ชัดว่าใบไปอยู่ขั้นไหนต่อ — คนกดต้องรู้ว่างานของตัวเองจบแล้วและใครรับช่วงต่อ
      const closedNow = updated?.status === "settled";
      const msg = {
        review: `ตรวจสอบแล้ว — ส่งต่อให้${STEP_OWNER.approve}อนุมัติ`,
        reviewApprove: closedNow ? "ตรวจสอบและอนุมัติแล้ว — ใบเคลียร์เรียบร้อย" : `ตรวจสอบและอนุมัติแล้ว — ส่งต่อให้${STEP_OWNER.disburse}อนุมัติเบิกจ่าย`,
        approve: closedNow ? "อนุมัติแล้ว — ใบเคลียร์เรียบร้อย (ไม่มีส่วนต่าง)" : `อนุมัติแล้ว — ส่งต่อให้${STEP_OWNER.disburse}อนุมัติเบิกจ่าย`,
        reject: "ตีกลับให้แก้ไขแล้ว",
        cancel: "ยกเลิกแล้ว",
        pay: "อนุมัติเบิกจ่ายและบันทึกการจ่ายเงินแล้ว",
        settle: mustReturn ? "ยืนยันรับเงินคืนแล้ว — เคลียร์เรียบร้อย" : "อนุมัติเบิกจ่ายแล้ว — ปิดรายการเรียบร้อย",
      }[action];
      applyResult(updated, msg);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (list) => {
    const files = Array.from(list || []).map((file) => ({
      file, kind: isCtr ? (file.type.startsWith("image/") ? "photo" : "invoice") : kind === "claim" ? "receipt" : file.type.startsWith("image/") ? "photo" : "other",
    }));
    if (!files.length) return;
    setBusy(true);
    try {
      const { expense: updated, rejected } = await ExpenseService.addFiles(e._id, files);
      applyResult(updated, rejected.length ? `แนบได้บางไฟล์ — ${rejected.map((r) => r.message).join(", ")}` : "แนบไฟล์แล้ว");
    } catch (err) {
      setToastSeverity("error"); setToast(errorText(err, "แนบไฟล์ไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (file) => {
    if (!window.confirm(`ลบไฟล์ "${file.fileName}" ?`)) return;
    setBusy(true);
    try {
      applyResult(await ExpenseService.removeFile(e._id, file._id), "ลบไฟล์แล้ว");
    } catch (err) {
      setToastSeverity("error"); setToast(errorText(err, "ลบไฟล์ไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  // ── ขั้นต่อไป ────────────────────────────────────────────────────────
  const nextStep = useMemo(() => {
    if (!e) return null;
    const diff = differenceMeta(e.difference, slip);
    /**
     * ✅ 3 ส่วน: ส่งขอเบิก → ตรวจสอบ/อนุมัติ → อนุมัติเบิกจ่าย
     * ⚠️ ส่วนที่ 2 ยังเป็นสองมือ (แอดมินตรวจสอบ → ผู้จัดการอนุมัติ) ข้อความจึงต้องบอกให้ชัดว่าอยู่มือไหนแล้ว
     */
    if (e.status === "pending") {
      return {
        severity: "warning",
        text: canReview && !selfBlocked
          ? "ขั้นที่ 2 จาก 3 · รอคุณตรวจสอบ แล้วส่งต่อให้ผู้จัดการแผนกช่างอนุมัติ"
          : `ขั้นที่ 2 จาก 3 · รอตรวจสอบโดย${STEP_OWNER.review}`,
      };
    }
    if (e.status === "reviewed") {
      const who = e.reviewedBy?.name ? `ตรวจสอบโดย ${personFullName(e.reviewedBy)}` : "ตรวจสอบแล้ว";
      return {
        severity: "warning",
        text: canApprove && !selfBlocked && (!reviewedByMe || canApproveOwnReview)
          ? `ขั้นที่ 2 จาก 3 · ${who} — รอคุณอนุมัติ`
          : `ขั้นที่ 2 จาก 3 · ${who} — รอ${STEP_OWNER.approve}อนุมัติ`,
      };
    }
    if (e.status === "approved") {
      const who = e.approvedBy?.name ? `อนุมัติโดย ${personFullName(e.approvedBy)}` : "อนุมัติแล้ว";
      const what = kind === "advance"
        ? `จ่ายเงิน Advance ${baht(e.total)}`
        : isReimburse ? `จ่ายคืน ${baht(e.total)}`
          : isCtr ? `จ่ายค่าจ้างสุทธิ ${baht(e.difference)}` : `${differenceMeta(e.difference, slip).short} ${baht(differenceMeta(e.difference, slip).amount)}`;
      return {
        severity: "info",
        text: canDisburse && !selfBlocked
          ? `ขั้นที่ 3 จาก 3 · ${who} — รอคุณอนุมัติเบิกจ่าย (${what})`
          : `ขั้นที่ 3 จาก 3 · ${who} — รอ${STEP_OWNER.disburse}อนุมัติเบิกจ่าย (${what})`,
      };
    }
    if (e.status === "rejected") return { severity: "error", text: `ถูกตีกลับโดย ${personFullName(e.rejectedBy) || "-"}: ${e.rejectReason || "-"}` };
    if (e.status === "cancelled") return { severity: "info", text: `ยกเลิกโดย ${personFullName(e.cancelledBy) || "-"} ${e.cancelledAt ? `เมื่อ ${thaiDate(e.cancelledAt)}` : ""}${e.cancelReason ? ` · ${e.cancelReason}` : ""}` };
    if (kind === "advance") {
      if (e.status === "paid") {
        return overdue
          ? { severity: "error", text: `เลยกำหนดเคลียร์ (${thaiDate(e.dueClearAt)}) — กรุณาส่งใบเคลม` }
          : { severity: "info", text: `รับเงินแล้ว — ส่งใบเคลมพร้อมใบเสร็จ${e.dueClearAt ? ` ภายใน ${thaiDateFull(e.dueClearAt)}` : ""}` };
      }
      if (e.status === "clearing") return { severity: "info", text: `ส่งใบเคลม ${e.claimDocNo || ""} แล้ว — รอใบเคลมผ่านครบทุกขั้น` };
      if (e.status === "cleared") return { severity: "success", text: `เคลียร์เรียบร้อยด้วยใบเคลม ${e.claimDocNo || ""}` };
    } else if (isReimburse) {
      if (e.status === "settled") return { severity: "success", text: `จ่ายคืนเรียบร้อย ${baht(e.total)}` };
    } else if (isCtr) {
      if (e.status === "settled") {
        return { severity: "success", text: money(e.difference) ? `จ่ายค่าจ้างผู้รับเหมาเรียบร้อย · สุทธิ ${baht(e.difference)}` : "ปิดใบแล้ว — หักมัดจำครบ ไม่มียอดต้องจ่าย" };
      }
    } else {
      if (e.status === "settled") return { severity: "success", text: diff.amount ? `ปิดส่วนต่างเรียบร้อย (${diff.short} ${baht(diff.amount)})` : "เคลียร์เรียบร้อย ไม่มีส่วนต่าง" };
    }
    return null;
  }, [e, kind, slip, isReimburse, isCtr, overdue, canReview, canApprove, canDisburse, selfBlocked, reviewedByMe, canApproveOwnReview]);

  const steps = useMemo(() => {
    if (!e) return [];
    /**
     * ✅ 3 ส่วนตามที่ผู้ใช้สั่ง: ส่งขอเบิก → ตรวจสอบ/อนุมัติ → อนุมัติเบิกจ่าย
     * ⚠️ ส่วนที่ 2 รวมสองมือไว้ในจุดเดียว — ยังไม่ครบจนกว่าผู้จัดการจะอนุมัติ ระหว่างนั้นบอกใต้จุดว่า
     * "ตรวจสอบแล้ว · รออนุมัติ" ไม่งั้นคนดูจะเข้าใจว่าจบส่วนนี้แล้วตั้งแต่แอดมินกดตรวจสอบ
     */
    const rejected = e.status === "rejected";
    const approvedDone = Boolean(e.approvedAt) && !["pending", "reviewed", "rejected"].includes(e.status);
    const reviewedOnly = Boolean(e.reviewedAt) && !approvedDone && !rejected;
    const head = [
      { label: kind === "advance" || isCtr ? "ส่งขอเบิก" : isReimburse ? "ส่งขอเบิกคืน" : "ส่งเคลม", done: true, date: e.submittedAt || e.createdAt },
      {
        label: "ตรวจสอบ/อนุมัติ",
        done: approvedDone,
        date: approvedDone ? e.approvedAt : (reviewedOnly ? e.reviewedAt : null),
        sub: reviewedOnly ? "ตรวจสอบแล้ว · รออนุมัติ" : "",
        danger: rejected,
      },
    ];
    if (kind === "advance") {
      return [
        ...head,
        { label: "อนุมัติเบิกจ่าย", done: ["paid", "clearing", "cleared"].includes(e.status), date: e.payment?.at },
        // ขั้นติดตามหลังเงินออก (ไม่ใช่ขั้นอนุมัติ) — ผู้เบิกต้องส่งใบเคลม
        { label: "เคลียร์", done: e.status === "cleared", danger: overdue, followUp: true },
      ];
    }
    const d = money(e.difference);
    return [
      ...head,
      {
        label: isCtr ? (d === 0 ? "ปิดใบ (ไม่มียอดจ่าย)" : "อนุมัติเบิกจ่าย")
          : !isReimburse && d === 0 ? "ปิดใบ (ไม่มีส่วนต่าง)" : !isReimburse && d < 0 ? "ยืนยันรับเงินคืน" : "อนุมัติเบิกจ่าย",
        done: e.status === "settled",
        date: e.status === "settled" ? e.payment?.at : null,
      },
    ];
  }, [e, kind, isReimburse, isCtr, overdue]);

  const isClaimKind = kind === "claim";
  const isClearClaim = isClaimKind && !isReimburse && !isCtr;
  // ✅ ผู้ใช้ขอให้ใบเคลมมีรายละเอียดของ Advance "ข้างๆ" — จอกว้างวางเป็นคอลัมน์ขวา ติดอยู่กับที่ขณะเลื่อน
  const sidePanel = isClearClaim && e?.advanceDoc;

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose?.()} fullWidth maxWidth={isClearClaim ? "lg" : "md"} fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
        <DialogTitle sx={{ p: 0 }}>
          {/* ✅ หัวกล่องเป็นสีประจำชนิดใบ — Advance เขียวอมฟ้า / Claim ม่วง พร้อมป้าย ADVANCE/CLAIM */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{
            px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${alpha(meta.color, 0.25)}`,
            borderTop: `5px solid ${meta.color}`, bgcolor: meta.soft,
          }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: meta.color, color: "#fff",
            }}>
              {isCtr ? <Engineering sx={{ fontSize: 21 }} /> : isReimburse ? <AccountBalanceWallet sx={{ fontSize: 21 }} /> : isClaimKind ? <ReceiptLong sx={{ fontSize: 21 }} /> : <Payments sx={{ fontSize: 21 }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <KindBadge kind={slip} />
                <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3, color: meta.dark }} noWrap>
                  {e?.docNo || meta.label}
                </Typography>
              </Stack>
              {e && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.4 }}>
                  <StatusBadge status={e.status} kind={slip} />
                  {overdue && <Chip size="small" icon={<WarningAmber sx={{ fontSize: "14px !important" }} />} label="เลยกำหนดเคลียร์" sx={{ height: 20, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha("#dc2626", 0.1), color: "#dc2626" }} />}
                </Stack>
              )}
            </Box>
            <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "14px !important" }}>
          {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>{loadError}</Alert>}
          {!e && loading && (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={90} />
              <Skeleton variant="rounded" height={160} />
              <Skeleton variant="rounded" height={120} />
            </Stack>
          )}
          {e && (
            <Box sx={{
              display: "grid", gap: 2, alignItems: "start",
              gridTemplateColumns: { xs: "1fr", md: sidePanel ? "minmax(0, 1fr) 330px" : "1fr" },
            }}>
            <Box sx={{ minWidth: 0 }}>
              {toast && <Alert severity={toastSeverity} onClose={() => setToast("")} sx={{ mb: 1.5, borderRadius: 2 }}>{toast}</Alert>}

              <Card>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.35 }}>{e.subject}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                      {thaiDateFull(e.docDate)} · {personFullName(e.requester)}{e.requester?.position ? ` (${e.requester.position})` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { sm: "right" } }}>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{isCtr ? "ยอดจ่ายสุทธิ" : isReimburse ? "ยอดขอเบิกคืน" : kind === "claim" ? "ใช้จ่ายจริง" : "ยอดขอเบิก"}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.45rem", color: meta.color, lineHeight: 1.1 }}>{baht(isCtr ? e.difference : e.total)}</Typography>
                    {isCtr && <Typography variant="caption" sx={{ color: TEXT_SUB }}>ค่าจ้าง {baht(e.total)}</Typography>}
                  </Box>
                </Stack>
                {nextStep && <Alert severity={nextStep.severity} sx={{ mt: 1.5, borderRadius: 2, py: 0.25, "& .MuiAlert-message": { fontSize: "0.84rem", fontWeight: 600 } }}>{nextStep.text}</Alert>}
                {e.status !== "cancelled" && <Steps steps={steps} color={meta.color} />}
              </Card>

              {/* ✅ ใบค่าจ้างผู้รับเหมา: ผู้รับเงิน · งวดงาน · ยอดหัก · ยอดสะสมตามสัญญา — ข้อมูลที่ผู้ตรวจ/ผู้จ่ายเงินต้องใช้ */}
              {isCtr && (() => {
                const d = e.deductions || {};
                const hist = e.contractorHistory || [];
                const prev = money(hist.reduce((s, h) => s + (Number(h.total) || 0), 0));
                const cum = money(prev + (Number(e.total) || 0));
                const cv = money(e.contractValue);
                const left = money(cv - cum);
                const C = KIND_META.contractor;
                return (
                  <Card title="ผู้รับเหมาและงวดงาน" icon={<Engineering sx={{ fontSize: 18, color: C.color }} />}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mb: 1.5 }}>
                      <InfoCell label={e.contractor?.isCompany ? "ผู้รับเหมา (นิติบุคคล)" : "ผู้รับเหมา (บุคคลธรรมดา)"} span>
                        <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>{e.contractor?.name || "-"}</Typography>
                      </InfoCell>
                      <InfoCell label="เลขประจำตัวผู้เสียภาษี">{e.contractor?.taxId}</InfoCell>
                      <InfoCell label="เบอร์โทร">{e.contractor?.phone}</InfoCell>
                      <InfoCell label="งวดงาน">{installmentText(e.installment) || "ไม่ระบุงวด"}</InfoCell>
                      {jobRangesText(e) && <InfoCell label={`ช่วงงานที่เบิกในงวดนี้ (${e.jobRanges.length} ช่วง)`} span>{jobRangesText(e)}</InfoCell>}
                      {e.contractor?.address && <InfoCell label="ที่อยู่" span>{e.contractor.address}</InfoCell>}
                    </Box>
                    <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: C.soft, border: `1px solid ${alpha(C.color, 0.25)}` }}>
                      {[
                        ["ค่าจ้างงวดนี้ (ก่อน VAT)", e.total, false],
                        ...(d.vat ? [[`บวก VAT ${d.vatRate}%`, d.vat, false]] : []),
                        ...(d.wht ? [[`หัก ณ ที่จ่าย ${d.whtRate}% (${e.contractor?.isCompany ? "ภ.ง.ด.53" : "ภ.ง.ด.3"})`, d.wht, true]] : []),
                        ...(d.deposit ? [["หักเงินมัดจำ / เบิกล่วงหน้า", d.deposit, true]] : []),
                      ].map(([label, v, minus]) => (
                        <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.3 }}>
                          <Typography sx={{ fontSize: "0.86rem", color: minus ? "#b45309" : TEXT_SUB, fontWeight: 600 }}>{label}</Typography>
                          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: minus ? "#b45309" : TEXT_MAIN }}>{minus ? "− " : ""}{fmtMoney(v)}</Typography>
                        </Stack>
                      ))}
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ borderTop: `1px solid ${alpha(C.color, 0.3)}`, mt: 0.5, pt: 0.75 }}>
                        <Typography sx={{ fontWeight: 900, color: C.dark }}>ยอดจ่ายสุทธิ</Typography>
                        <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: C.dark }}>{fmtMoney(e.difference)}</Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", textAlign: "right" }}>( {bahtText(e.difference)} )</Typography>
                    </Box>
                    {(hist.length > 0 || cv > 0) && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, mb: 0.75 }}>ยอดเบิกสะสมของผู้รับเหมารายนี้ในงานนี้</Typography>
                        {hist.map((h) => {
                          return (
                            <Stack key={h._id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.3 }}>
                              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, minWidth: 64 }}>{installmentText(h.installment) || "ไม่ระบุงวด"}</Typography>
                              <Button size="small" onClick={() => onOpenOther?.(h._id)} sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 700, fontSize: "0.8rem" }}>{h.docNo}</Button>
                              <StatusBadge status={h.status} kind="contractor" />
                              <Box sx={{ flex: 1 }} />
                              <Typography sx={{ fontSize: "0.82rem", fontWeight: 800 }}>{fmtMoney(h.total)}</Typography>
                            </Stack>
                          );
                        })}
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1, mt: 1 }}>
                          <InfoCell label="รวมสะสม (รวมงวดนี้)">{baht(cum)}</InfoCell>
                          {cv > 0 && <InfoCell label="มูลค่าตามสัญญา">{baht(cv)}</InfoCell>}
                          {cv > 0 && (
                            <InfoCell label="คงเหลือตามสัญญา">
                              <Box component="span" sx={{ color: left < 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>{left < 0 ? `เกินสัญญา ${baht(-left)}` : baht(left)}</Box>
                            </InfoCell>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Card>
                );
              })()}

              {/* ✅ ใบสำรองจ่ายไม่มีใบ Advance ให้เทียบ — ข้ามการ์ดเทียบยอดไปใช้ตารางรายการธรรมดาแทน
                  (การ์ดเทียบที่มีช่อง "ยอดเบิก Advance" เป็น 0 ตลอดคือข้อมูลที่ทำให้เข้าใจผิด ไม่ใช่ข้อมูลที่ขาด) */}
              {isClearClaim && (
                <Card title={isDesktop ? "เทียบรายการ: ตั้งเบิก (Advance) กับ ใช้จริง (Claim)" : "เทียบกับใบ Advance"} icon={<LinkIcon sx={{ fontSize: 18, color: meta.color }} />}
                  action={e.advanceId && (
                    <Button size="small" onClick={() => onOpenOther?.(e.advanceId)} endIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                      sx={{ textTransform: "none", fontWeight: 800, color: KIND_META.advance.dark, whiteSpace: "nowrap" }}>
                      {e.advance?.docNo}
                    </Button>
                  )}>
                  {(() => {
                    const d = differenceMeta(e.difference, slip);
                    return (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1, mb: 1.5 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: KIND_META.advance.soft, border: `1px solid ${alpha(KIND_META.advance.color, 0.3)}` }}>
                          <Typography variant="caption" sx={{ color: KIND_META.advance.dark, fontWeight: 800 }}>ยอดเบิก Advance</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: KIND_META.advance.dark }}>{baht(e.advance?.total)}</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: KIND_META.claim.soft, border: `1px solid ${alpha(KIND_META.claim.color, 0.3)}` }}>
                          <Typography variant="caption" sx={{ color: KIND_META.claim.dark, fontWeight: 800 }}>ใช้จ่ายจริง</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: KIND_META.claim.dark }}>{baht(e.total)}</Typography>
                        </Box>
                        <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, p: 1, borderRadius: 2, bgcolor: alpha(d.color, 0.08), border: `1px solid ${alpha(d.color, 0.3)}` }}>
                          <Typography variant="caption" sx={{ color: d.color, fontWeight: 800 }}>{d.label}</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: d.color }}>{d.amount ? baht(d.amount) : "—"}</Typography>
                        </Box>
                      </Box>
                    );
                  })()}
                  <CompareTable items={e.items} advanceItems={e.advanceDoc?.items} wide={isDesktop} />
                  {!e.items?.length && e.note && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>ไม่มีรายการใช้จริง — ดูหมายเหตุ</Typography>}
                </Card>
              )}

              {/* จอแคบ: รายละเอียดใบ Advance พับไว้ใต้ตารางเทียบ */}
              {sidePanel && !isDesktop && (
                <Box sx={{ mb: 1.5 }}>
                  <Button fullWidth onClick={() => setPanelOpen((v) => !v)}
                    endIcon={<ExpandMore sx={{ transform: panelOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                    sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 800, color: KIND_META.advance.dark, bgcolor: KIND_META.advance.soft, border: `1px solid ${alpha(KIND_META.advance.color, 0.35)}`, borderRadius: 2.5, px: 1.5 }}>
                    {panelOpen ? "ซ่อนรายละเอียดใบ Advance" : `ดูรายละเอียดใบ Advance ${e.advance?.docNo || ""}`}
                  </Button>
                  <Collapse in={panelOpen} unmountOnExit>
                    <AdvancePanel advance={e.advanceDoc} onOpen={() => onOpenOther?.(e.advanceId)} sx={{ mt: 1 }} />
                  </Collapse>
                </Box>
              )}

              <Card title="ข้อมูลเอกสาร" icon={<Description sx={{ fontSize: 18, color: meta.color }} />}>
                {/* ✅ ผู้ใช้: "ตัวหนังสือกลมกลืนกันหมด อ่านยาก ไม่สวย" — แบ่งเป็นก้อนชัดๆ แทนกริดช่องหน้าตาเดียวกันทั้งหมด:
                    ผู้เบิก (แถวเด่น) · ข้อมูลใบ (ตารางป้ายซ้าย-ค่าขวา) · งานที่ผูก · สายอนุมัติ (เส้นเวลา) · บัญชีรับเงิน */}
                <Stack spacing={2}>
                  <RequesterRow
                    label={isCtr ? "พนักงานผู้เบิก (กรอกแทน)" : "ผู้เบิกเงิน"}
                    name={personFullName(e.requester)}
                    position={e.requester?.position}
                    extra={e.createdBy?.userId && e.createdBy.userId !== e.requester?.userId ? `ออกใบแทนโดย ${e.createdBy.name}` : ""}
                  />

                  <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden" }}>
                    <KV label="เลขที่">{e.docNo}</KV>
                    <KV label="วันที่">{thaiDate(e.docDate)}</KV>
                    <KV label="ถึง">{e.to}</KV>
                    {isReimburse && <KV label="ที่มาของเงิน">สำรองจ่ายเอง (ไม่มีใบ Advance)</KV>}
                    {kind === "advance" && e.dueClearAt && <KV label="กำหนดเคลียร์" color={overdue ? "#dc2626" : undefined}>{thaiDate(e.dueClearAt)}{overdue ? " · เลยกำหนด" : ""}</KV>}
                    {kind === "advance" && e.claimId && (
                      <KV label="ใบเคลม">
                        <Button size="small" endIcon={<OpenInNew sx={{ fontSize: "14px !important" }} />} onClick={() => onOpenOther?.(e.claimId)}
                          sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 800, fontSize: "0.92rem" }}>
                          {e.claimDocNo}
                        </Button>
                      </KV>
                    )}
                  </Box>

                  {/* ✅ งานที่เข้าหลายช่วง: บอกช่วงวันที่เต็ม + เป็นช่วงที่เท่าไร — ใบของคนละช่วงจะได้ไม่สับสนกัน */}
                  {/* ✅ งานที่ผูก — การ์ดขาวขอบเทาชุดเดียวกับตารางข้อมูลด้านบน (ผู้ใช้: "ไม่เข้าธีม" — เดิมกล่องพื้นสี + อีโมจิ)
                      ชื่องานตัวหนา · ครั้งที่/ช่วงวันที่เป็นป้ายเทา · วันที่มีไอคอนปฏิทินแบบเดียวกับทั้งแอป */}
                  <Box>
                    <SubTitle icon={<Build />} color={meta.color}>งานที่ผูก</SubTitle>
                    {e.eventId || e.job?.title ? (() => {
                      const jt = jobText(e.job) || "";
                      // ✅ ครั้งที่อยู่ท้ายข้อความเสมอ — รวมปีสัญญา "ครั้งที่ 1/4 - 2569-70" / "(ปีที่ 2)" ไว้ในป้ายเดียว
                      const round = (jt.match(/ครั้งที่\s*\d+(?:\s*\/\s*\d+)?(?:\s*-\s*\d{4}(?:-\d{2})?|\s*\(ปีที่ \d+\))?/) || [])[0] || "";
                      const title = round ? jt.replace(round, "").replace(/\s{2,}/g, " ").trim() : jt;
                      const tags = [round, jobPartText(e.job)].filter(Boolean);
                      const when = jobRangesText(e) || jobRangeText(e.job) || (e.job?.start ? thaiDate(e.job.start) : "");
                      return (
                        <Box sx={{ p: 1.25, px: 1.5, borderRadius: 2, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}>
                          {/* 🧹 ตัดไอคอนประแจในการ์ดออก (ผู้ใช้ขอ) — หัวข้อด้านบนมีไอคอนอยู่แล้ว */}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.45 }}>{title || "-"}</Typography>
                            {(tags.length > 0 || when) && (
                              <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" spacing={0.75} sx={{ mt: 0.6 }}>
                                {tags.map((t) => (
                                  <Box key={t} component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", bgcolor: "#f1f5f9", px: 0.85, py: 0.2, borderRadius: 1, whiteSpace: "nowrap" }}>{t}</Box>
                                ))}
                                {when && (
                                  <Stack direction="row" alignItems="center" spacing={0.4} sx={{ color: TEXT_SUB }}>
                                    <CalendarMonth sx={{ fontSize: 15 }} />
                                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 600 }}>{when}</Typography>
                                  </Stack>
                                )}
                              </Stack>
                            )}
                          </Box>
                        </Box>
                      );
                    })() : <Typography sx={{ fontSize: "0.86rem", color: TEXT_SUB, px: 1.25, py: 1, borderRadius: 2, bgcolor: "#f8fafc", border: `1px dashed ${BORDER_MAIN}` }}>ไม่ผูกงาน</Typography>}
                  </Box>

                  {(() => {
                    const showReview = e.reviewedAt && e.status !== "rejected";
                    const showApprove = e.approvedAt && !["pending", "reviewed", "rejected"].includes(e.status);
                    const showPay = e.payment?.at && ((kind === "advance" && ["paid", "clearing", "cleared"].includes(e.status)) || (kind === "claim" && e.status === "settled" && money(e.difference) !== 0));
                    const steps = [
                      showReview && { key: "r", label: "ผู้ตรวจสอบ", name: personFullName(e.reviewedBy), date: thaiDate(e.reviewedAt) },
                      showApprove && { key: "a", label: "ผู้อนุมัติ", name: personFullName(e.approvedBy), date: thaiDate(e.approvedAt) },
                      showPay && {
                        key: "p",
                        label: mustReturn ? "ผู้อนุมัติเบิกจ่าย (ยืนยันรับเงินคืน)" : "ผู้อนุมัติเบิกจ่าย",
                        name: personFullName(e.payment.by) || "-",
                        date: thaiDate(e.payment.at),
                        detail: `${kind === "advance" ? "การจ่ายเงิน" : isCtr ? "การจ่ายค่าจ้าง" : isReimburse ? "การจ่ายคืน" : mustReturn ? "การรับเงินคืน" : "การจ่ายส่วนต่าง"} · ${[paymentLabel(e.payment.method), e.payment.ref, e.payment.note].filter(Boolean).join(" · ")}`,
                      },
                    ].filter(Boolean);
                    if (!steps.length) return null;
                    return (
                      <Box>
                        <SubTitle icon={<FactCheck />} color={meta.color}>สายอนุมัติ</SubTitle>
                        <Box sx={{ pl: 0.25 }}>
                          {steps.map(({ key, ...st }, i) => <ApprovalRow key={key} {...st} last={i === steps.length - 1} />)}
                        </Box>
                      </Box>
                    );
                  })()}

                  {/* ✅ บัญชีรับเงินของผู้เบิก — โชว์เฉพาะใบที่บริษัทต้องโอนเงินให้ผู้เบิก
                      ⚠️ ใบที่ผู้เบิกต้องคืนเงินบริษัท ไม่โชว์บัญชี (คนละทิศทางเงิน) แต่โชว์ยอดที่ต้องคืนแทน */}
                  {moneyToRequester && (
                    <Box>
                      <SubTitle icon={<AccountBalanceWallet />} color={meta.color}>{isCtr ? "บัญชีรับเงินของผู้รับเหมา" : "บัญชีรับเงินของผู้เบิก"}</SubTitle>
                      {e.payTo?.accountNo
                        ? <PayToBox payTo={e.payTo} />
                        : <Typography sx={{ fontSize: "0.86rem", color: TEXT_SUB, px: 1.25, py: 1, borderRadius: 2, bgcolor: "#f8fafc", border: `1px dashed ${BORDER_MAIN}` }}>{isCtr ? "จ่ายเป็นเงินสด / เช็ค" : "ไม่ระบุบัญชี — รับเป็นเงินสด"}</Typography>}
                    </Box>
                  )}
                  {mustReturn && (
                    <Box>
                      <SubTitle icon={<Undo />} color="#c2410c">ยอดที่ผู้เบิกต้องคืนบริษัท</SubTitle>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.25, borderRadius: 2, border: "1px solid #fdba74", bgcolor: "#fff7ed" }}>
                        <Undo sx={{ fontSize: 20, color: "#c2410c" }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: "1.05rem", fontWeight: 900, color: "#9a3412", lineHeight: 1.2 }}>
                            {baht(Math.abs(money(e.difference)))}
                          </Typography>
                          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                            {e.status === "settled" ? "รับคืนเรียบร้อยแล้ว" : "ผู้เบิกนำส่งคืนบริษัท แล้วผู้อนุมัติเบิกจ่ายกด “ยืนยันรับเงินคืน” ในระบบ"}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                  {e.note && (
                    <Box>
                      <SubTitle icon={<HistoryEdu />} color={meta.color}>หมายเหตุ</SubTitle>
                      <Typography sx={{ fontSize: "0.88rem", color: "#334155", px: 1.25, py: 1, borderRadius: 2, bgcolor: "#f8fafc", whiteSpace: "pre-wrap" }}>{e.note}</Typography>
                    </Box>
                  )}
                </Stack>
              </Card>

              {!isClearClaim && (
                <Card title={`${isCtr ? "รายการค่าจ้าง" : "รายการ"} (${e.items?.length || 0})`} action={<Typography sx={{ fontWeight: 800, color: meta.color }}>{baht(e.total)}</Typography>}>
                  {!e.items?.length && <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีรายการค่าใช้จ่าย{e.note ? " — ดูหมายเหตุ" : ""}</Typography>}
                  <Stack divider={<Divider flexItem />} spacing={1}>
                    {(e.items || []).map((it, i) => {
                      const cat = categoryMeta(it.category);
                      return (
                        <Stack key={it._id || i} direction="row" spacing={1.25} alignItems="flex-start">
                          <Typography sx={{ width: 20, color: TEXT_SUB, fontWeight: 700, fontSize: "0.82rem", pt: 0.2 }}>{i + 1}</Typography>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{itemTitle(it)}{it.person?.name ? <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · {it.person.name}</Box> : null}</Typography>
                            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                              <Chip size="small" label={cat.label} sx={{ height: 18, fontSize: "0.66rem", fontWeight: 700, bgcolor: alpha(cat.color, 0.1), color: cat.color }} />
                              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{qtyText(it)}</Typography>
                              {it.receiptNo && <Typography variant="caption" sx={{ color: TEXT_SUB }}>· ใบเสร็จ {it.receiptNo}</Typography>}
                            </Stack>
                            {it.detail && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{it.detail}</Typography>}
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.92rem" }}>{fmtMoney(it.amount)}</Typography>
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Card>
              )}

              <Card title={`หลักฐาน / ไฟล์แนบ (${e.attachments?.length || 0})`} icon={<AttachFile sx={{ fontSize: 18, color: TEXT_SUB }} />}
                action={canAddFiles && (
                  <Button size="small" startIcon={<AttachFile />} disabled={busy} onClick={() => fileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>แนบเพิ่ม</Button>
                )}>
                <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(ev) => { uploadFiles(ev.target.files); ev.target.value = ""; }} />
                {!e.attachments?.length ? (
                  <Typography variant="body2" sx={{ color: TEXT_SUB }}>{kind === "claim" ? "ยังไม่มีใบเสร็จแนบ" : "ไม่มีไฟล์แนบ"}</Typography>
                ) : (
                  /* ✅ แยกเป็นกลุ่มตาม "ขั้นตอนที่แนบ" (ผู้ใช้ขอ) — ไฟล์ในใบเดียวมาจากคนละช่วงของกระบวนการ
                     เช่น ใบเสร็จตอนออกใบ กับสลิปโอนตอนจ่ายเงิน ถ้ากองรวมกันจะแยกไม่ออกว่าอันไหนของขั้นไหน */
                  <Stack spacing={1.5}>
                    {groupFilesByStage(e.attachments, slip).map((group) => (
                      <Box key={group.value || "other"}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: group.color }} />
                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: group.color }}>{group.label}</Typography>
                          <Chip size="small" label={`${group.files.length} ไฟล์`}
                            sx={{ height: 18, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(group.color, 0.12), color: group.color }} />
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                          {group.files.map((f) => {
                            const isImg = String(f.fileType || "").startsWith("image/");
                            return (
                              <Stack key={f._id} direction="row" spacing={1} alignItems="center"
                                sx={{ p: 0.75, border: `1px solid ${BORDER_MAIN}`, borderLeft: `3px solid ${alpha(group.color, 0.55)}`, borderRadius: 2, minWidth: 0 }}>
                                <Box component="a" href={f.fileUrl} target="_blank" rel="noreferrer" sx={{
                                  width: 44, height: 44, borderRadius: 1.5, flexShrink: 0, overflow: "hidden", bgcolor: "#f1f5f9",
                                  display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_SUB,
                                }}>
                                  {isImg ? <Box component="img" src={f.fileUrl} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                                    : String(f.fileType).includes("pdf") ? <Description /> : <ImageIcon />}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography component="a" href={f.fileUrl} target="_blank" rel="noreferrer" sx={{ fontSize: "0.82rem", fontWeight: 700, color: TEXT_MAIN, textDecoration: "none", display: "block" }} noWrap>{f.fileName}</Typography>
                                  <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{fileKindLabel(f.kind)} · {f.uploadedBy} · {thaiDate(f.uploadedAt)}</Typography>
                                </Box>
                                {canRemoveFile && (
                                  <Tooltip title="ลบไฟล์"><IconButton size="small" disabled={busy} onClick={() => removeFile(f)}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
                                )}
                              </Stack>
                            );
                          })}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Card>

              <Card title="ประวัติ" icon={<History sx={{ fontSize: 18, color: TEXT_SUB }} />}>
                <Stack spacing={1}>
                  {[...(e.activityLog || [])].reverse().map((a, i) => (
                    <Stack key={a._id || i} direction="row" spacing={1.25}>
                      <Box sx={{ width: 8, height: 8, mt: 0.8, borderRadius: "50%", flexShrink: 0, bgcolor: i === 0 ? meta.color : "#cbd5e1" }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600 }}>{a.detail}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB }}>{a.userName} · {thaiDateTime(a.timestamp)}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            </Box>
            {sidePanel && isDesktop && (
              <Box sx={{ position: "sticky", top: 0, minWidth: 0 }}>
                <AdvancePanel advance={e.advanceDoc} onOpen={() => onOpenOther?.(e.advanceId)} />
              </Box>
            )}
            </Box>
          )}
        </DialogContent>

        {e && (
          <DialogActions sx={{
            px: { xs: 1, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: { xs: 0.5, sm: 0.75 }, flexWrap: "wrap", justifyContent: "flex-end",
            // ✅ จอมือถือ: ปุ่มกระชับขึ้น (ระยะ/ตัวอักษร/ไอคอน) ให้ปุ่มคำสั่งอยู่แถวเดียวกันได้
            "& > :not(style) ~ :not(style)": { ml: 0 },
            "& .MuiButton-root": { minWidth: 0, px: { xs: 1, sm: 2 }, py: 0.75, justifyContent: "center", fontSize: { xs: "0.8rem", sm: "0.875rem" }, whiteSpace: "nowrap" },
            "& .MuiButton-startIcon": { mr: { xs: 0.4, sm: 1 } },
            // ✅ แถว 2 เต็มความกว้าง (ผู้ใช้: ไม่อยากให้มีช่องว่าง) — ปุ่มไอคอนคงขนาด ปุ่มข้อความยืดเท่าๆ กัน
            "& > .MuiButton-root, & > span": { flex: "1 1 auto", display: "flex" },
            "& > span > .MuiButton-root": { width: "100%" },
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flexBasis: "100%" }}>
              <Button onClick={() => setPrintOpen(true)} startIcon={<Print sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 700, flexShrink: 0 }}>
                พิมพ์ / แชร์
              </Button>
              <FooterProgress steps={steps} status={e.status} color={meta.color} />
            </Box>
            {canCancel && (
              <Tooltip title="ยกเลิกใบนี้">
                <IconButton onClick={() => setAction("cancel")} aria-label="ยกเลิกใบนี้" sx={{ color: TEXT_SUB, border: `1px solid ${BORDER_MAIN}`, width: 36, height: 36 }}>
                  <Block sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            {canEdit && (
              e.status === "rejected" ? (
                <Button onClick={() => onEdit?.(e)} startIcon={<Edit sx={{ fontSize: 17 }} />} sx={{ textTransform: "none", fontWeight: 700 }}>
                  แก้ไข / ส่งใหม่
                </Button>
              ) : (
                <Tooltip title="แก้ไขใบนี้">
                  <IconButton onClick={() => onEdit?.(e)} aria-label="แก้ไขใบนี้" color="primary" sx={{ border: `1px solid ${BORDER_MAIN}`, width: 36, height: 36 }}>
                    <Edit sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )
            )}
            {/* ✅ ตีกลับได้เฉพาะขั้นที่ตัวเองรับผิดชอบ (ตรวจสอบ / อนุมัติ / อนุมัติเบิกจ่าย) — server บังคับซ้ำ */}
            {canActOnCurrentStep && (
              <Button onClick={() => setAction("reject")} disabled={selfBlocked} startIcon={<Undo sx={{ fontSize: 17 }} />} variant="outlined" sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626", borderColor: "#fecaca", borderRadius: 2, "&:hover": { borderColor: "#dc2626", bgcolor: "#fef2f2" } }}>
                ตีกลับ
              </Button>
            )}
            {/* ส่วนที่ 2 มือแรก — ตรวจสอบ (แอดมินช่าง · ผู้จัดการกดแยกมือก็ได้) */}
            {canReview && e.status === "pending" && (
              <Tooltip title={selfBlocked ? "ตรวจสอบใบของตัวเองไม่ได้ — ให้หัวหน้าท่านอื่นเป็นผู้ตรวจสอบ" : ""} describeChild>
                <span>
                  <Button variant={canChainBothSteps ? "outlined" : "contained"} disabled={selfBlocked} onClick={() => setAction("review")} startIcon={<FactCheck sx={{ fontSize: 18 }} />}
                    sx={canChainBothSteps
                      ? { textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#b45309", borderColor: "#fcd34d" }
                      : { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#b45309", "&:hover": { bgcolor: "#92400e", boxShadow: "none" } }}>
                    ตรวจสอบ
                  </Button>
                </span>
              </Tooltip>
            )}
            {/* ✅ ผู้จัดการ: จบทั้งสองขั้นด้วยปุ่มเดียว (ผู้ใช้สั่ง) — ยังบันทึกแยกเป็น 2 ขั้นเหมือนเดิม */}
            {canChainBothSteps && e.status === "pending" && (
              <Tooltip title={selfBlocked ? "ใบของตัวเองต้องให้หัวหน้าท่านอื่นพิจารณา" : "ตรวจสอบและอนุมัติในขั้นตอนเดียว"} describeChild>
                <span>
                  <Button variant="contained" disabled={selfBlocked} onClick={() => setAction("reviewApprove")} startIcon={<DoneAll sx={{ fontSize: 18 }} />}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>
                    อนุมัติ
                  </Button>
                </span>
              </Tooltip>
            )}
            {/* ส่วนที่ 2 มือสอง — อนุมัติ (ผู้จัดการแผนกช่าง) */}
            {canApprove && e.status === "reviewed" && (
              <Tooltip
                title={selfBlocked
                  ? "อนุมัติใบของตัวเองไม่ได้ — ให้หัวหน้าท่านอื่นเป็นผู้อนุมัติ"
                  : reviewedByMe && !canApproveOwnReview ? "คุณเป็นผู้ตรวจสอบใบนี้แล้ว — ผู้อนุมัติต้องเป็นคนละคน" : ""}
                describeChild
              >
                <span>
                  <Button variant="contained" disabled={selfBlocked || (reviewedByMe && !canApproveOwnReview)} onClick={() => setAction("approve")} startIcon={<CheckCircle sx={{ fontSize: 18 }} />}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>
                    อนุมัติ
                  </Button>
                </span>
              </Tooltip>
            )}
            {/* ส่วนที่ 3 — อนุมัติเบิกจ่าย (ผู้จัดการแผนกช่าง / กรรมการผู้จัดการ) */}
            {canDisburse && e.status === "approved" && (
              <Tooltip title={selfBlocked ? "อนุมัติเบิกจ่ายใบของตัวเองไม่ได้" : ""} describeChild>
                <span>
                  <Button variant="contained" disabled={selfBlocked} onClick={() => setAction(kind === "advance" ? "pay" : "settle")}
                    startIcon={kind === "advance" ? <Payments sx={{ fontSize: 18 }} /> : <TaskAlt sx={{ fontSize: 18 }} />}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: mustReturn ? "#c2410c" : meta.color, "&:hover": { bgcolor: mustReturn ? "#9a3412" : meta.dark, boxShadow: "none" } }}>
                    {mustReturn ? "ยืนยันรับเงินคืน" : "อนุมัติเบิกจ่าย"}
                  </Button>
                </span>
              </Tooltip>
            )}
            {kind === "advance" && e.status === "paid" && (isOwner || viewAll) && (
              <Button variant="contained" onClick={() => onCreateClaim?.(e)} startIcon={<ReceiptLong sx={{ fontSize: 18 }} />}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: KIND_META.claim.color, "&:hover": { bgcolor: KIND_META.claim.dark, boxShadow: "none" } }}>
                ออกใบเคลม
              </Button>
            )}
          </DialogActions>
        )}
      </Dialog>

      <ActionDialog action={action} expense={e} busy={busy} error={actionError} onCancel={() => { setAction(""); setActionError(""); }} onSubmit={runAction} />
      <ExpensePrintDialog open={printOpen} expense={e} onClose={() => setPrintOpen(false)} />
    </>
  );
}
