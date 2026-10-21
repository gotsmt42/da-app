/**
 * RefDoc — ช่อง "เอกสารอ้างอิง" (ได้มาตอนรับงาน: ใบเสนอราคา / PO / เอกสารอื่น + ไฟล์ที่แนบตอนรับงาน)
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "เอกสารอ้างอิง และเอกสารที่แนบภายหลัง ต้องแยกให้ชัดเจน")
 *    ตารางการดำเนินงาน / งานของฉัน แยกเป็นคอลัมน์ "เอกสารอ้างอิง" กับ "เอกสารที่แนบ" (รายงาน · ใบเสนอราคา · ใบส่งมอบ · ใบวางบิล)
 */
import { Box, Stack, Typography } from "@mui/material";
import { DescriptionOutlined, RequestQuoteOutlined, VerifiedOutlined, AttachFileRounded } from "@mui/icons-material";

const KIND = {
  po: { label: "ใบสั่งซื้อ (PO)", icon: VerifiedOutlined, color: "#16a34a" },
  quotation: { label: "ใบเสนอราคา", icon: RequestQuoteOutlined, color: "#2563eb" },
  other: { label: "เอกสารอื่น", icon: DescriptionOutlined, color: "#475569" },
};

// 🔁 (21 ต.ค. 2569) ไฟล์ที่แนบมากับใบแจ้งงาน (QT/PO) ก็เป็นเอกสารอ้างอิงตอนรับงานเหมือนกัน
//    งานหลายช่วงวัน: ไฟล์อาจอยู่ที่ช่วงอื่นของกลุ่ม — หน้ารับงานส่ง __groupFiles (ไฟล์ทั้งกลุ่ม) มาให้
export const refFilesOf = (ev) => (ev?.__groupFiles || ev?.sitePhotoFiles || []).filter((f) => f.source === "intake" || f.source === "dispatch");
// 🐛 (21 ต.ค. 2569 ผู้ใช้: "เอกสารอ้างอิงไม่มี ทำไมมีขึ้น งง") ขึ้นเฉพาะเมื่อมีของจริง — มีไฟล์ หรือมีเลขที่เอกสาร
//    (ชนิดเอกสารอย่างเดียว ไม่มีไฟล์/เลขที่ = ไม่มีเอกสารให้ดู → ไม่แสดง)
export const hasRefDoc = (ev) => Boolean(ev?.intakeDocNo || refFilesOf(ev).length);

export default function RefDoc({ event, onOpenFile }) {
  const files = refFilesOf(event);
  if (!hasRefDoc(event)) return <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>;
  const k = KIND[event.intakeDocType] || (files.length ? { label: "ไฟล์แนบตอนรับงาน", icon: AttachFileRounded, color: "#475569" } : KIND.other);
  const Icon = k.icon;
  const open = (e) => {
    e.stopPropagation();
    const f = files[files.length - 1];
    if (!f) return;
    if (onOpenFile) onOpenFile(f.fileUrl, f.fileName);
    else window.open(f.fileUrl, "_blank", "noopener");
  };
  return (
    <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Icon sx={{ fontSize: 16, color: k.color, mt: "2px", flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        {/* 🔁 (21 ต.ค. 2569 ผู้ใช้: "สีกลมกลืนไป") ชื่อเอกสารสีเข้ม · สีอยู่ที่ไอคอน · เปิดไฟล์เป็นลิงก์เทาเล็ก */}
        <Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{k.label}</Typography>
        {event.intakeDocNo && <Typography noWrap title={event.intakeDocNo} sx={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.35 }}>เลขที่ {event.intakeDocNo}</Typography>}
        {files.length > 0 && (
          <Box component="button" type="button" onClick={open} title="เปิดไฟล์"
            sx={{ mt: 0.25, p: 0, border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 0.3,
              fontSize: "0.72rem", fontWeight: 700, color: "#64748b", "&:hover": { color: "#2563eb", textDecoration: "underline" } }}>
            <AttachFileRounded sx={{ fontSize: 13 }} />เปิดไฟล์{files.length > 1 ? ` (${files.length})` : ""}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
