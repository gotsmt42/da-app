/**
 * AdvancePanel — รายละเอียดใบ Advance ที่ใบเคลมอ้างถึง แสดง "ข้างๆ" ใบเคลม
 *
 * ✅ ผู้ใช้ขอ: "ในใบเคลมต้องมีรายละเอียดของ Advance นั้นๆ แสดงข้างๆด้วย เพื่อให้ตรวจสอบ และดูง่าย"
 * ใช้ทั้งในฟอร์มออกใบเคลม (ผู้เบิกกรอกเทียบ) และหน้ารายละเอียดใบเคลม (ผู้อนุมัติตรวจเทียบ)
 * ✅ พื้นสีเขียวอมฟ้าของ Advance ตลอดทั้งแผง — วางข้างใบเคลม (ม่วง) แล้วแยกออกทันทีว่าฝั่งไหนคือใบไหน
 */
import { Box, Stack, Typography, Chip, Button, Divider, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { OpenInNew, AddCircleOutline, AttachFile } from "@mui/icons-material";

import { thaiDate } from "@/shared/utils/thaiDate";
import KindBadge from "./KindBadge";
import {
  KIND_META, statusMeta, baht, fmtMoney, qtyText, paymentLabel, jobText, categoryMeta, TEXT_SUB, TEXT_MAIN, personFullName,
} from "../expenseMeta";

const M = KIND_META.advance;

const Row = ({ label, children }) => (
  <Stack direction="row" spacing={1} sx={{ py: 0.3 }}>
    <Typography sx={{ width: 78, flexShrink: 0, fontSize: "0.76rem", color: TEXT_SUB, fontWeight: 600 }}>{label}</Typography>
    <Typography component="div" sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: TEXT_MAIN, fontWeight: 600, wordBreak: "break-word" }}>{children || "-"}</Typography>
  </Stack>
);

/**
 * @param {object}   advance      ใบ Advance (ต้องมี items)
 * @param {Set}      [usedIndexes] index ของรายการที่ใบเคลมอ้างถึงแล้ว — แถวที่ไม่อยู่ในชุดจะขึ้นว่า "ยังไม่ได้ใส่"
 * @param {Function} [onRestore]  กดใส่รายการที่ถูกลบกลับเข้าใบเคลม (ใช้ในฟอร์ม)
 * @param {Function} [onOpen]     เปิดใบ Advance เต็ม
 */
export default function AdvancePanel({ advance, usedIndexes, onRestore, onOpen, sx }) {
  if (!advance) return null;
  const st = statusMeta(advance.status, "advance");
  const pay = advance.payment || {};
  const files = advance.attachments || [];

  return (
    <Box sx={{
      borderRadius: 2.5, bgcolor: M.soft, border: `1px solid ${alpha(M.color, 0.35)}`,
      borderTop: `4px solid ${M.color}`, p: 1.5, ...sx,
    }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
        <KindBadge kind="advance" />
        <Typography sx={{ fontWeight: 900, fontSize: "0.9rem", color: M.dark, flex: 1, minWidth: 0 }} noWrap>{advance.docNo}</Typography>
        {onOpen && (
          <Tooltip title="เปิดใบ Advance">
            <Button size="small" onClick={onOpen} sx={{ minWidth: 0, px: 0.75, color: M.dark }}><OpenInNew sx={{ fontSize: 17 }} /></Button>
          </Tooltip>
        )}
      </Stack>
      {advance.status && (
        <Chip size="small" label={st.label} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 800, bgcolor: alpha(st.color, 0.12), color: st.color, mb: 0.75 }} />
      )}
      <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", lineHeight: 1.35, mb: 0.75 }}>{advance.subject}</Typography>

      <Row label="วันที่">{thaiDate(advance.docDate)}</Row>
      <Row label="ผู้เบิก">{personFullName(advance.requester)}{advance.requester?.position ? ` · ${advance.requester.position}` : ""}</Row>
      {advance.to && <Row label="ถึง">{advance.to}</Row>}
      <Row label="งาน">{advance.job?.title ? jobText(advance.job) : "ไม่ผูกงาน"}</Row>
      {pay.at && <Row label="รับเงิน">{thaiDate(pay.at)} · {paymentLabel(pay.method)}{pay.ref ? ` · ${pay.ref}` : ""}</Row>}
      {advance.dueClearAt && <Row label="กำหนดเคลียร์">{thaiDate(advance.dueClearAt)}</Row>}
      {advance.approvedBy?.name && <Row label="อนุมัติโดย">{personFullName(advance.approvedBy)}</Row>}

      <Divider sx={{ my: 1, borderColor: alpha(M.color, 0.25) }} />
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: M.dark, mb: 0.5 }}>รายการที่ตั้งเบิก ({advance.items?.length || 0})</Typography>
      <Stack spacing={0.6}>
        {(advance.items || []).map((it, i) => {
          const used = !usedIndexes || usedIndexes.has(i);
          const cat = categoryMeta(it.category);
          return (
            <Stack key={it._id || i} direction="row" spacing={0.75} alignItems="flex-start"
              sx={{ opacity: used ? 1 : 0.75, p: 0.6, borderRadius: 1.5, bgcolor: used ? "rgba(255,255,255,0.7)" : "transparent", border: used ? "none" : `1px dashed ${alpha(M.color, 0.45)}` }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: cat.color, mt: 0.8, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, lineHeight: 1.3 }}>{it.description}{it.person?.name ? ` · ${it.person.name}` : ""}</Typography>
                <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>{qtyText(it)}{it.detail ? ` · ${it.detail}` : ""}</Typography>
                {!used && (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography sx={{ fontSize: "0.68rem", color: "#b45309", fontWeight: 700 }}>ยังไม่ได้ใส่ในใบเคลม</Typography>
                    {onRestore && (
                      <Button size="small" onClick={() => onRestore(i)} startIcon={<AddCircleOutline sx={{ fontSize: "14px !important" }} />}
                        sx={{ minWidth: 0, p: 0, px: 0.5, fontSize: "0.68rem", textTransform: "none", fontWeight: 800, color: M.dark }}>
                        ใส่กลับ
                      </Button>
                    )}
                  </Stack>
                )}
              </Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, whiteSpace: "nowrap" }}>{fmtMoney(it.amount)}</Typography>
            </Stack>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${alpha(M.color, 0.25)}` }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: M.dark }}>ยอดเบิก Advance</Typography>
        <Typography sx={{ fontSize: "1.1rem", fontWeight: 900, color: M.dark }}>{baht(advance.total)}</Typography>
      </Stack>
      {advance.note && <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: TEXT_SUB }}>หมายเหตุ: {advance.note}</Typography>}
      {files.length > 0 && (
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mt: 0.75 }}>
          {files.map((f) => (
            <Chip key={f._id} size="small" icon={<AttachFile sx={{ fontSize: "13px !important" }} />} label={f.fileName}
              component="a" href={f.fileUrl} target="_blank" rel="noreferrer" clickable
              sx={{ maxWidth: "100%", height: 22, fontSize: "0.68rem", bgcolor: "#fff" }} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
