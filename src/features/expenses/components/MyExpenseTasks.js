/**
 * MyExpenseTasks — "ใบเบิกของคุณที่ค้างอยู่" บนหัวหน้าใบเคลม / ใบ Advance
 *
 * 🐛 ผู้ใช้แจ้ง: "เจอปัญหาการแจ้งใบเคลมมาเองแปลกๆ โดยที่ไม่มีข้อมูล"
 * สาเหตุ: ป้ายตัวเลขบนเมนู "ใบเคลม" นับ (1) ใบ Advance ของฉันที่รับเงินแล้วยังไม่ได้ส่งใบเคลม และ (2) ใบเคลม
 * ของฉันที่ถูกตีกลับ — แต่หน้าใบเคลมแสดงเฉพาะ "ใบเคลม" ใบ Advance ที่รอเคลียร์จึงไม่เคยโผล่ในหน้านี้เลย
 * กดตามป้ายเข้ามาแล้วไม่เจออะไรให้ทำ
 *
 * ✅ แสดงทุกใบที่ป้ายนับไว้ตรงนี้ พร้อมปุ่มทำต่อได้ทันที (ออกใบเคลม / แก้ไขและส่งใหม่)
 * ⚠️ ผู้ใช้แจ้งว่า "มันไม่ใช่งาน คือการเบิก" และให้ลดการแสดงซ้ำ — หัวกล่องไม่อธิบายซ้ำกับป้ายในแถว
 * ป้ายในแถวบอกแค่สถานะ ส่วนยอดเงิน/กำหนดเคลียร์อยู่บรรทัดเดียวด้านล่าง
 * ⚠️ เงื่อนไขต้องตรงกับ /api/expenses/summary เป๊ะ ไม่งั้นเลขบนป้ายกับจำนวนในกล่องนี้จะไม่เท่ากันอีก:
 *   • awaitingClaimMine   = ใบ Advance ที่ "ฉันเป็นผู้เบิก" สถานะ paid
 *   • claimRejectedMine   = ใบเคลม (รวมสำรองจ่าย) ที่ฉันเป็นผู้เบิกหรือคนออกใบ สถานะ rejected
 *   • advanceRejectedMine = ใบ Advance ที่ฉันเป็นผู้เบิกหรือคนออกใบ สถานะ rejected
 */
import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, Button, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ReceiptLong, Edit, AssignmentLate, ChevronRight } from "@mui/icons-material";

import { thaiDate } from "@/shared/utils/thaiDate";
import ExpenseService from "../services/ExpenseService";
import { KIND_META, slipKind, baht, isOverdueClear, TEXT_SUB, TEXT_MAIN, BORDER_MAIN } from "../expenseMeta";

const isMine = (e, me, { includeCreator }) =>
  String(e?.requester?.userId || "") === me || (includeCreator && String(e?.createdBy?.userId || "") === me);

const daysLate = (due) => Math.max(1, Math.floor((Date.now() - new Date(due).getTime()) / 86_400_000));

/**
 * @param {"claim"|"advance"} view
 * @param {string} userId
 * @param {number} reloadKey  เปลี่ยนเมื่อข้อมูลเปลี่ยน (หลังทำรายการ/สัญญาณเรียลไทม์) — โหลดใหม่แบบเงียบ
 */
export default function MyExpenseTasks({ view, userId, reloadKey, onOpen, onCreateClaim, onEdit }) {
  const me = String(userId || "");
  const [tasks, setTasks] = useState([]);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!me) return;
    const jobs = view === "claim"
      ? [
        ExpenseService.list({ kind: "advance", status: "paid" })
          .then((rows) => rows.filter((e) => isMine(e, me, { includeCreator: false })).map((e) => ({ type: "clear", e }))),
        ExpenseService.list({ kind: "claim", status: "rejected" })
          .then((rows) => rows.filter((e) => isMine(e, me, { includeCreator: true })).map((e) => ({ type: "fix", e }))),
      ]
      : [
        ExpenseService.list({ kind: "advance", status: "rejected" })
          .then((rows) => rows.filter((e) => isMine(e, me, { includeCreator: true })).map((e) => ({ type: "fix", e }))),
      ];
    Promise.all(jobs.map((p) => p.catch(() => [])))
      .then((groups) => {
        if (!aliveRef.current) return;
        // ✅ เลยกำหนดเคลียร์ขึ้นก่อน แล้วตามกำหนดที่ใกล้ที่สุด — สิ่งที่ด่วนที่สุดต้องอยู่บนสุด
        const list = groups.flat().sort((a, b) => {
          const late = Number(isOverdueClear(b.e)) - Number(isOverdueClear(a.e));
          if (late) return late;
          return new Date(a.e.dueClearAt || a.e.rejectedAt || 0) - new Date(b.e.dueClearAt || b.e.rejectedAt || 0);
        });
        setTasks(list);
      });
  }, [view, me, reloadKey]);

  if (!tasks.length) return null;

  const tone = view === "claim" ? KIND_META.claim : KIND_META.advance;

  return (
    <Box sx={{
      mb: 1.5, borderRadius: 2.5, border: `1px solid ${alpha("#dc2626", 0.28)}`, bgcolor: "#fff",
      boxShadow: `0 1px 0 ${alpha("#dc2626", 0.06)}`, overflow: "hidden",
    }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.1, bgcolor: alpha("#dc2626", 0.05), borderBottom: `1px solid ${alpha("#dc2626", 0.15)}` }}>
        <AssignmentLate sx={{ fontSize: 20, color: "#dc2626" }} />
        {/* ✅ ผู้ใช้แจ้ง: "มันไม่ใช่งาน คือการเบิก" — เรียกตามสิ่งที่มันเป็น และไม่อธิบายซ้ำกับป้ายในแต่ละแถว */}
        <Typography sx={{ fontWeight: 900, fontSize: "0.95rem", color: TEXT_MAIN }}>ใบเบิกของคุณที่ค้างอยู่</Typography>
        <Chip size="small" label={tasks.length} sx={{ height: 20, fontWeight: 900, bgcolor: "#dc2626", color: "#fff" }} />
      </Stack>

      <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER_MAIN}` }} />}>
        {tasks.map(({ type, e }) => {
          const late = type === "clear" && isOverdueClear(e);
          const kindMeta = KIND_META[slipKind(e)];
          return (
            <Stack
              key={`${type}-${e._id}`}
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={{ xs: 1, sm: 1.5 }}
              sx={{ px: { xs: 1.5, sm: 2 }, py: 1.2 }}
            >
              <Box
                role="button" tabIndex={0}
                onClick={() => onOpen?.(e._id)}
                onKeyDown={(ev) => { if (ev.key === "Enter") onOpen?.(e._id); }}
                sx={{ flex: 1, minWidth: 0, cursor: "pointer", "&:hover .mt-doc": { textDecoration: "underline" } }}
              >
                {/* ⚠️ เลขที่ใบ + เรื่อง อยู่บรรทัดเดียวกัน — เดิมแยกสองบรรทัดทำให้กล่องสูงโดยไม่ได้ข้อมูลเพิ่ม */}
                <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Typography className="mt-doc" sx={{ fontWeight: 800, fontSize: "0.9rem", color: kindMeta.dark }}>{e.docNo}</Typography>
                  <Typography sx={{ fontSize: "0.85rem", color: TEXT_MAIN, minWidth: 0 }} noWrap>{e.subject || "-"}</Typography>
                  {/* ป้ายบอก "สถานะ" อย่างเดียว ส่วนรายละเอียดเงิน/กำหนดอยู่บรรทัดล่าง ไม่พูดซ้ำกัน */}
                  <Chip
                    size="small"
                    label={type === "clear" ? (late ? `เลยกำหนด ${daysLate(e.dueClearAt)} วัน` : "รอส่งใบเคลม") : "ถูกตีกลับ"}
                    sx={{
                      height: 20, fontSize: "0.7rem", fontWeight: 800,
                      bgcolor: alpha(late || type === "fix" ? "#dc2626" : "#0369a1", 0.1),
                      color: late || type === "fix" ? "#dc2626" : "#0369a1",
                    }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: late ? "#dc2626" : TEXT_SUB, display: "block" }}>
                  {type === "clear"
                    ? [`รับเงิน ${baht(e.total)}`, e.payment?.at ? thaiDate(e.payment.at) : "", e.dueClearAt ? `เคลียร์ภายใน ${thaiDate(e.dueClearAt)}` : ""].filter(Boolean).join(" · ")
                    : `เหตุผล: ${e.rejectReason || "-"}`}
                </Typography>
              </Box>
              {type === "clear" ? (
                <Button
                  variant="contained" startIcon={<ReceiptLong sx={{ fontSize: 18 }} />}
                  onClick={() => onCreateClaim?.(e)}
                  sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: tone.color, "&:hover": { bgcolor: tone.dark, boxShadow: "none" } }}
                >
                  ออกใบเคลม
                </Button>
              ) : (
                <Button
                  variant="outlined" startIcon={<Edit sx={{ fontSize: 17 }} />} endIcon={<ChevronRight sx={{ fontSize: 17 }} />}
                  onClick={() => onEdit?.(e)}
                  sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#dc2626", borderColor: alpha("#dc2626", 0.5), "&:hover": { borderColor: "#dc2626", bgcolor: alpha("#dc2626", 0.04) } }}
                >
                  แก้ไขและส่งใหม่
                </Button>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
