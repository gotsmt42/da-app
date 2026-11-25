/**
 * ContractDocsPanel — เอกสาร/หลักฐานของสัญญา (หน้าภาพรวมงาน)
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ในหน้าภาพรวมงาน ... ให้มีไฟล์แนบหลักฐานของสัญญานั้นๆ ให้ติดตามได้ง่าย")
 *    แยกตามประเภท: สัญญาฉบับเซ็น · ใบเสนอราคา · ใบสั่งซื้อ (PO) · เอกสารอื่น — แต่ละประเภทแนบ/ดู/ลบได้ในที่เดียว
 *    "สัญญาฉบับเซ็น" คือหลักฐานหลักที่ติดตาม — ยังไม่มี = ป้ายเตือนในตาราง + ตัวกรองสถานะ "ยังไม่แนบสัญญาฉบับเซ็น"
 *
 * ⚠️ ไฟล์ทุกประเภทเก็บใน contractQuotationFiles ชุดเดียว (แยกด้วย docType) — ไฟล์เก่าที่ไม่มี docType = ใบเสนอราคา
 *    ทุกครั้งของสัญญาเก็บชุดเดียวกัน (เซิร์ฟเวอร์ซิงก์ให้) · กล่องมูลค่าสัญญา (ContractValuePanel) แสดงเฉพาะใบเสนอราคา
 * onPatch(fields) = อัปเดตแถวในหน้าทันทีหลังเซิร์ฟเวอร์บันทึกสำเร็จ
 */
import { useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import {
  HistoryEduRounded, RequestQuoteRounded, ShoppingCartRounded, FolderRounded, CheckCircleRounded,
  AttachFileRounded, ChevronRightRounded,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import AttachmentList from "@/shared/ui/AttachmentList";
import Swal from "@/shared/ui/swal";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e6e9ef";
const ACCENT = "#2563eb";
const OK = "#15803d";
const WARN = "#b45309";

export const CONTRACT_DOC_TYPES = [
  { key: "contract", label: "สัญญาฉบับเซ็น", hint: "สัญญาที่ลงนามแล้ว (PDF / รูปถ่าย)", icon: HistoryEduRounded, key_doc: true },
  { key: "quotation", label: "ใบเสนอราคา", hint: "ใบเสนอราคาที่ลูกค้าอนุมัติ", icon: RequestQuoteRounded },
  { key: "po", label: "ใบสั่งซื้อ (PO)", hint: "ใบสั่งซื้อ / ใบสั่งจ้างจากลูกค้า", icon: ShoppingCartRounded },
  { key: "other", label: "เอกสารอื่น", hint: "หนังสือแจ้ง · แบบฟอร์ม · หลักฐานอื่น", icon: FolderRounded },
];
const TYPE_LABEL = Object.fromEntries(CONTRACT_DOC_TYPES.map((t) => [t.key, t.label]));

/** ประเภทของไฟล์ — ไฟล์เก่าที่ยังไม่มี docType = ใบเสนอราคา (แนบจากกล่องมูลค่าสัญญาเดิม) */
export const contractDocTypeOf = (f) => (TYPE_LABEL[f?.docType] ? f.docType : "quotation");

/** สรุปเอกสารของสัญญา — ใช้ทั้งป้ายในตาราง และตัวกรอง "ยังไม่แนบสัญญาฉบับเซ็น" */
export const contractDocSummary = (c) => {
  const files = (c?.contractQuotationFiles || []).filter((f) => f?.fileUrl);
  const byType = { contract: 0, quotation: 0, po: 0, other: 0 };
  files.forEach((f) => { byType[contractDocTypeOf(f)] += 1; });
  return { total: files.length, byType, hasSigned: byType.contract > 0 };
};

const errMsg = (e, fb) => e?.response?.data?.message || e?.message || fb;

/**
 * ป้ายเอกสารสัญญาในตาราง/การ์ด — มีสัญญาฉบับเซ็น = "สัญญา ✓ · N ไฟล์" (เขียว) · ยังไม่มี = "ยังไม่แนบสัญญา" (อำพัน)
 * กดแล้วเปิดกล่องเอกสารของสัญญา
 */
export function ContractDocsChip({ contract: c, onOpen, canEdit = false }) {
  const s = contractDocSummary(c);
  if (!s.total && !canEdit) return null;
  const tone = s.hasSigned ? OK : WARN;
  const label = s.hasSigned
    ? `สัญญา ✓${s.total > 1 ? ` · ${s.total} ไฟล์` : ""}`
    : s.total ? `ยังไม่มีสัญญาฉบับเซ็น · ${s.total} ไฟล์` : "ยังไม่แนบสัญญา";
  return (
    <Box
      component="button" type="button"
      title="เอกสารของสัญญา — สัญญาฉบับเซ็น · ใบเสนอราคา · PO"
      onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
      sx={{
        display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.85, mt: 0.5, maxWidth: "100%",
        border: 0, borderRadius: 99, cursor: "pointer", font: "inherit", whiteSpace: "nowrap", overflow: "hidden",
        fontSize: "0.68rem", fontWeight: 700, color: tone, bgcolor: s.hasSigned ? "#f0fdf4" : "#fffbeb",
        "&:hover": { filter: "brightness(0.97)", textDecoration: "underline" },
      }}
    >
      <AttachFileRounded sx={{ fontSize: 13, transform: "rotate(45deg)", flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
      <ChevronRightRounded sx={{ fontSize: 14, ml: -0.25, opacity: 0.7, flexShrink: 0 }} />
    </Box>
  );
}

export default function ContractDocsPanel({ contract: c, canEdit = false, onPatch }) {
  const gid = c?.key;
  const allFiles = c?.contractQuotationFiles || [];
  // ค่าล่าสุดเสมอ — อัปโหลดหลายไฟล์ต่อกันแล้วต้องต่อท้ายชุดที่เพิ่งอัปเดต ไม่ใช่ชุดตอนเริ่มกด
  const filesRef = useRef(allFiles);
  filesRef.current = allFiles;
  const addedRef = useRef([]);
  const summary = contractDocSummary(c);

  const upload = async (file, docType) => {
    const entry = await EventService.UploadContractQuotationFile(gid, file, docType);
    if (entry) addedRef.current.push(entry);
  };
  const onUploaded = async () => {
    const added = addedRef.current;
    addedRef.current = [];
    if (added.length) onPatch?.({ contractQuotationFiles: [...filesRef.current, ...added] });
  };
  const onDelete = async (f) => {
    try {
      await EventService.DeleteContractQuotationFile(gid, f._id);
      onPatch?.({ contractQuotationFiles: filesRef.current.filter((x) => String(x._id) !== String(f._id)) });
    } catch (e) {
      Swal.fire({ icon: "error", title: "ลบไฟล์ไม่สำเร็จ", text: errMsg(e, "ลองใหม่อีกครั้ง") });
    }
  };

  return (
    <Stack spacing={1.25}>
      {/* สรุปบรรทัดเดียว — ตอบคำถามแรกเสมอ: "มีสัญญาฉบับเซ็นหรือยัง" */}
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 1.25, py: 1, borderRadius: 2.5, bgcolor: summary.hasSigned ? "#f0fdf4" : "#fffbeb" }}>
        <CheckCircleRounded sx={{ fontSize: 20, color: summary.hasSigned ? OK : "#f59e0b" }} />
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: summary.hasSigned ? OK : WARN, flex: 1, minWidth: 0 }}>
          {summary.hasSigned ? "มีสัญญาฉบับเซ็นแล้ว" : "ยังไม่มีสัญญาฉบับเซ็น"}
          <Box component="span" sx={{ fontWeight: 500, color: MUTED }}> · เอกสารทั้งหมด {summary.total} ไฟล์</Box>
        </Typography>
      </Stack>

      {CONTRACT_DOC_TYPES.map((t) => {
        const files = allFiles.filter((f) => contractDocTypeOf(f) === t.key).map((f) => ({ ...f, tag: t.label }));
        const Icon = t.icon;
        const n = files.length;
        if (!canEdit && !n) return null;
        return (
          <Box key={t.key} sx={{ border: `1px solid ${LINE}`, borderRadius: 2.5, bgcolor: "#fff", px: 1.5, pt: 1.25, pb: n || canEdit ? 1 : 1.25 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: n ? "#eff6ff" : "#f1f5f9", color: n ? ACCENT : MUTED }}>
                <Icon sx={{ fontSize: 19 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>{t.label}</Typography>
                <Typography sx={{ fontSize: "0.7rem", color: MUTED }} noWrap>{t.hint}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, flexShrink: 0, color: n ? OK : (t.key_doc ? WARN : "#94a3b8") }}>
                {n ? `✓ ${n} ไฟล์` : "ยังไม่แนบ"}
              </Typography>
            </Stack>
            <AttachmentList
              files={files}
              readOnly={!canEdit}
              actions={canEdit ? [{ key: t.key, label: `แนบ${t.label}` }] : undefined}
              upload={canEdit ? (file, key) => upload(file, key) : undefined}
              onUploaded={onUploaded}
              onDelete={canEdit ? onDelete : undefined}
              emptyText={null}
              thumbSize={36}
              sx={{ mt: n || canEdit ? 0.75 : 0 }}
            />
          </Box>
        );
      })}
      {!canEdit && !summary.total && (
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "center", py: 1 }}>ยังไม่มีเอกสารแนบในสัญญานี้</Typography>
      )}
    </Stack>
  );
}
