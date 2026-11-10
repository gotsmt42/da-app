/**
 * JobDocChecklist — โมดูลเอกสารประจำงาน "ฝั่งช่าง" ชุดเดียวทั้งแอป
 *
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "หน้าของช่างต้องทำให้เหมือนกับหน้าดำเนินงานด้วยทุกอย่าง ต้องบอกว่ามีเอกสารหรือไม่มี
 *    บางอย่างก็บังคับ ให้เหมือนกัน" · "ทำเป็น Module ให้แก้ไขทีเดียวพร้อมกันได้ จะได้ไม่สับสน และผิดพลาด")
 *    ย้ายออกมาจาก TechnicianJobPanel — แก้ที่ไฟล์นี้ที่เดียว มีผลทุกหน้าที่ช่างจัดการเอกสาร:
 *      • แผงงานช่าง (หน้าดำเนินงาน · งานของฉัน) — TechnicianJobPanel
 *      • เอกสารประจำงานในหน้า Event (ฝั่งช่าง) — EditEventDocs
 *    ชนิดเอกสาร/สี/ไอคอน/บังคับ = shared/utils/jobDocTypes.js (ชุดเดียวกับฝั่งแอดมิน) · แถวไฟล์ = AttachmentList
 */
import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  Box, Typography, Stack, Button, Divider, Menu, MenuItem, ListItemIcon, ListItemText,
} from "@mui/material";
import { DescriptionRounded as Description, CloudUploadRounded as CloudUpload, CheckCircleRounded as CheckCircle, DeleteRounded as Delete, DownloadRounded as Download, RequestQuoteRounded as RequestQuote, ReceiptLongRounded as ReceiptLong, AssignmentTurnedInRounded as AssignmentTurnedIn, PrintRounded as Print, ShareRounded as Share, RemoveCircleOutlineRounded as RemoveCircleOutline, CheckBoxRounded as CheckBox, CheckBoxOutlineBlankRounded as CheckBoxOutlineBlank, RadioButtonUncheckedRounded as RadioButtonUnchecked } from "@mui/icons-material";
import { isDocRequired, isDocComplete } from "@/shared/utils/jobDocTypes";
import { sortQuoteFiles, quoteFileTag, isOldQuoteFile } from "@/shared/utils/quotationTracking";
import { INK, INK_2, MUTED, FAINT, LINE, ACCENT, ACCENT_SOFT, ACCENT_LINE, SUCCESS } from "@/shared/ui/PageKit";
import { printFile, shareFile, isMobileDevice } from "@/shared/utils/fileActions";
import { BTN as MBTN } from "@/shared/ui/modernUi";
import { confirmDelete } from "@/shared/ui/swal";
import AttachmentList from "@/shared/ui/AttachmentList";
import ServiceReportAiBar from "@/features/documents/components/ServiceReportAiBar";
import InvoiceBillingBar from "@/features/finance/components/InvoiceBillingBar";

// ✅ ใช้ตัดสินใจลำดับปุ่มแชร์ในเมนู "⋮" ต่อไฟล์ (ดูเหตุผลใน fileActions.js)
const IS_MOBILE = isMobileDevice();
// เมนูเปิดเร็ว · ไม่ล็อกสกรอลหน้า
const FAST_MENU_PROPS = { transitionDuration: { enter: 120, exit: 80 }, disableScrollLock: true };
const capitalize = (str = "") => str.charAt(0).toUpperCase() + str.slice(1);

// 🐛 ปรับตามที่ผู้ใช้แจ้ง (ช่างงงว่าแต่ละช่องคือเอกสารอะไร ต้องทำอะไรกับมัน): เดิมมีแค่ชื่อเอกสารลอยๆ
// ("ใบเสนอราคา") กับคำถามกลางๆ ที่ใช้ข้อความเดียวกันหมดทุกชนิด ("งานนี้มีเอกสารนี้หรือไม่?") ซึ่งไม่ได้
// บอกเลยว่าเป็นใบเสนอราคาของอะไร ใครออก ออกให้ใคร และตอบ "มี/ไม่มี" แล้วจะเกิดอะไรขึ้นต่อ
// ✅ เพิ่มคำอธิบายสั้นๆ ใต้ชื่อ + คำถาม/ตัวเลือกเฉพาะของเอกสารแต่ละชนิด ให้อ่านแล้วตัดสินใจได้ทันที
// โดยไม่ต้องเดาหรือไปถามแอดมิน
export const DOCUMENT_TYPES = [
  {
    type: "report", label: "Service Report", color: "#2563eb", alwaysRequired: true,
    icon: <Description sx={{ fontSize: 18 }} />,
    desc: "ใบรายงานผลการเข้าปฏิบัติงานครั้งนี้ — ทุกงานต้องแนบก่อนขอปิดงาน",
  },
  {
    // 🔁 (26 ต.ค. 2569 ผู้ใช้) "ใบเสนอราคาเพิ่มเติม" — ไม่ใช่ใบเสนอราคาของงานนี้เอง กันสับสน
    type: "quotation", label: "ใบเสนอราคาเพิ่มเติม", color: "#d97706", alwaysRequired: false,
    icon: <RequestQuote sx={{ fontSize: 18 }} />,
    desc: "ใบเสนอราคาที่ต้องเสนอลูกค้าเพิ่มจากงานนี้ เช่น อะไหล่ที่ต้องเปลี่ยน หรืองานซ่อมเพิ่มเติมที่พบหน้างาน",
    question: "งานนี้ต้องเสนอราคางานเพิ่มเติมให้ลูกค้าไหม?",
    yesLabel: "ต้องเสนอราคา",
    noLabel: "ไม่ต้องเสนอ",
    noneText: "งานนี้ไม่ต้องเสนอราคาเพิ่ม",
    uploadHint: "แนบไฟล์ใบเสนอราคาที่ทำให้ลูกค้า — แอดมินจะนำไปติดตามผลกับลูกค้าต่อในหน้า “ติดตามใบเสนอราคา”",
  },
  {
    type: "invoice", label: "เอกสารการเงิน", color: "#0891b2", alwaysRequired: false,
    icon: <ReceiptLong sx={{ fontSize: 18 }} />,
    desc: "ใบวางบิล / ใบกำกับภาษี / ใบเสร็จ — แนบแล้วบันทึกการวางบิลและการรับเงินได้ในช่องนี้",
    question: "งานนี้ต้องวางบิลลูกค้าไหม?",
    yesLabel: "ต้องวางบิล",
    noLabel: "ไม่ต้องวางบิล",
    noneText: "งานนี้ไม่ต้องวางบิล",
    uploadHint: "แนบใบวางบิล / ใบกำกับภาษี / ใบเสร็จ — แล้วกดบันทึกการวางบิลเพื่อติดตามรับเงิน",
  },
  {
    type: "completion", label: "ใบส่งมอบงาน", color: "#059669", alwaysRequired: false,
    icon: <AssignmentTurnedIn sx={{ fontSize: 18 }} />,
    desc: "ใบส่งมอบงานที่ลูกค้าเซ็นรับงานเรียบร้อยแล้ว",
    question: "งานนี้มีใบส่งมอบงานที่ลูกค้าเซ็นรับไหม?",
    yesLabel: "มี ลูกค้าเซ็นแล้ว",
    noLabel: "ไม่มี",
    noneText: "งานนี้ไม่มีใบส่งมอบงาน",
    uploadHint: "แนบไฟล์/รูปถ่ายใบส่งมอบงานที่ลูกค้าเซ็นแล้ว",
  },
];


// ─── Helper ───────────────────────────────────────────────────────────
// ไฟล์เก็บบน Cloudinary (คนละโดเมน) และบาง URL เก่าอาจไม่มีนามสกุลติดมาด้วย
// จึงดึงไฟล์มาเป็น blob แล้วสั่งดาวน์โหลดเอง เพื่อบังคับชื่อไฟล์ + นามสกุลที่ถูกต้องเสมอ
const downloadFile = async (url, fileName) => {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error("Download error:", err);
    window.open(url, "_blank");
  }
};



// ─── DocumentFileList ─────────────────────────────────────────────────
// รายการไฟล์ที่แนบ (แนบได้หลายไฟล์) + ปุ่มเพิ่มไฟล์อีก (ใช้ร่วมกันทั้ง required เสมอ และ "มี")
// embedded = อยู่บนฟอร์ม Swal (หน้า Event) — ห้ามเปิด Swal ซ้อน (จะปิดฟอร์มทิ้ง) → ยืนยันลบด้วย window.confirm · เมนูอยู่ชั้นบนแผ่นเอกสาร
const DocumentFileList = ({ type, files, isUploading, uploadProgress, onFileUpload, onDeleteFile, onPreview, isLocked, embedded = false }) => {
  const fileRef = useRef();
  const isQuote = type === "quotation";
  const fileList = useMemo(() => (isQuote ? sortQuoteFiles(files) : files || []), [isQuote, files]);
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ต่อใน แผงงานของช่างและหน้างานของฉัน" — โมดูลไฟล์ชุดเดียวทั้งแอป)
  //    รายการไฟล์ = AttachmentList (ภาพย่อ/ป้ายชนิดไฟล์ · ผู้แนบ · เวลา · ⋮ เมนูเดิม · แถวกำลังอัปโหลด %) · เปิดดูส่งลำดับไปด้วย (ไฟล์ชื่อซ้ำก็เลื่อนได้)
  const listFiles = useMemo(() => fileList.map((f) => ({ ...f, tag: isQuote ? quoteFileTag(f, fileList) : null })), [fileList, isQuote]);

  // ✅ เมนู "⋮" ต่อไฟล์ — เดิมโชว์ปุ่มดู/ดาวน์โหลด/ลบ เรียงเป็นไอคอนแยกทุกแถว ดูรกเวลามีหลายไฟล์
  // รวมเป็นเมนูเดียว เหลือแค่ปุ่มดูไฟล์ (บ่อยสุด) + ปุ่ม "⋮" ที่มีดาวน์โหลด/พิมพ์/แชร์ LINE/ลบ
  const [fileMenu, setFileMenu] = useState(null); // { el, file }
  const closeFileMenu = () => setFileMenu(null);
  // ✅ perf: stable reference ให้ FileRow ที่ memo ไว้เทียบ props ได้จริง
  const handleOpenFileMenu = useCallback((el, file) => setFileMenu({ el, file }), []);

  const handleFileChange = (e) => {
    if (e.target.files?.length) onFileUpload(e.target.files, type);
  };

  // ✅ perf: จำกัดความสูง+เลื่อนดูแทนตอนมีไฟล์เยอะ (เดิมไม่มี ลิสต์ยาวๆ ดันความสูงทั้งหน้า/Dialog
  // ไปเรื่อยๆ) เทียบ pattern เดียวกับ FileUploadSection ในหน้า Operation
  return (
    <Box>
      {(fileList.length > 0 || isUploading) && (
        <AttachmentList files={listFiles} readOnly emptyText={null}
          onOpen={(f, i, list) => onPreview?.(f.fileUrl, f.fileName, list, i)}
          onRowMenu={(el, f) => handleOpenFileMenu(el, fileList.find((x) => (x._id && x._id === f._id) || x.fileUrl === f.fileUrl) || f)}
          uploading={isUploading ? { progress: uploadProgress || 0 } : null}
          sx={{ mb: 1, maxHeight: 320, overflowY: "auto", px: 0.25 }} />
      )}

      {/* เมนู "⋮" ต่อไฟล์ — ดาวน์โหลด/พิมพ์/แชร์ LINE/แชร์อื่น/ลบ รวมไว้ที่เดียว */}
      <Menu {...FAST_MENU_PROPS} anchorEl={fileMenu?.el} open={Boolean(fileMenu)} onClose={closeFileMenu} sx={embedded ? { zIndex: 20030 } : undefined}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}>
        <MenuItem onClick={() => { downloadFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText>ดาวน์โหลด</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { printFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
          <ListItemIcon><Print fontSize="small" /></ListItemIcon>
          <ListItemText>พิมพ์</ListItemText>
        </MenuItem>
        {/* ✅ LINE เดสก์ท็อปไม่ลงทะเบียนเป็น Share Target ของ OS จึงไม่มีทางโผล่ในแผง Share ของ
            Windows/Mac ได้เลย (ที่ shareFile() เรียกผ่าน navigator.share) — สลับให้ปุ่มที่
            การันตีว่าเข้าถึง LINE ได้จริงขึ้นก่อนตามชนิดอุปกรณ์ */}
        {IS_MOBILE ? (
          <>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์ (รูป/PDF)</ListItemText>
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์</ListItemText>
            </MenuItem>
          </>
        )}
        {!isLocked && !isOldQuoteFile(fileMenu?.file) && [
          <Divider key="file-menu-divider" />,
          <MenuItem key="file-menu-delete" onClick={async () => { const f = fileMenu.file; closeFileMenu(); if (await (embedded ? Promise.resolve(window.confirm(`ลบไฟล์ "${f.fileName}"?`)) : confirmDelete({ name: f.fileName }))) onDeleteFile(type, f._id); }} sx={{ gap: 1.5, minHeight: 44, color: "error.main" }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>ลบไฟล์</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {isLocked || isUploading ? null : (
        <>
          <input ref={fileRef} type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} />
          {/* ✅ ปุ่มแนบไฟล์แบบกล่องเส้นประ — บอกชนิดไฟล์ที่รับได้ในตัว ไม่ต้องเดา */}
          <Box component="button" type="button" onClick={() => fileRef.current?.click()}
            sx={{
              width: "100%", display: "flex", alignItems: "center", gap: 1, minHeight: 40,
              px: 1.5, borderRadius: 2, cursor: "pointer", font: "inherit", textAlign: "left",
              border: `1px dashed ${ACCENT_LINE}`, bgcolor: "#fff", color: ACCENT,
              transition: "background-color .15s, border-color .15s, color .15s",
              "&:hover": { bgcolor: ACCENT_SOFT, borderColor: ACCENT },
            }}>
            <CloudUpload sx={{ fontSize: 19, color: "inherit" }} />
            <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: 700, color: "inherit" }}>
              {fileList.length > 0 ? "เพิ่มไฟล์" : "แนบไฟล์"}
            </Typography>
            <Typography component="span" noWrap sx={{ fontSize: "0.7rem", color: FAINT, ml: "auto", minWidth: 0 }}>
              PDF · รูป · Word · Excel
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── DocumentChecklistItem ────────────────────────────────────────────
// alwaysRequired (Service Report): แตะทั้งแถวเพื่อติ๊ก + แนบไฟล์
// ไม่ใช่ alwaysRequired (ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน): ต้องเลือก "มี/ไม่มี" ก่อน (ปุ่มใหญ่ กดง่ายบนมือถือ)
// ถ้า "มี" ต้องแนบไฟล์ให้ครบถึงจะถือว่าเสร็จ, ถ้า "ไม่มี" ถือว่าเสร็จทันที
const DocumentChecklistItem = ({
  type, label, color, icon, event, alwaysRequired,
  // ✅ ข้อความเฉพาะของเอกสารแต่ละชนิด (ดู DOCUMENT_TYPES) — มี fallback กลางๆ ไว้เผื่อชนิดใหม่ที่ยัง
  // ไม่ได้เขียนข้อความเฉพาะให้ จะได้ไม่ขึ้นช่องว่างเปล่า
  desc, question, yesLabel, noLabel, noneText, uploadHint,
  onToggleCheck, onSetApplicable, onFileUpload, onDeleteFile, onPreview,
  isUploading, uploadProgress, isLocked, embedded = false,
}) => {
  const files      = event[`${type}Files`] || [];
  const hasFiles   = files.length > 0;
  const applicable = event[`${type}Applicable`];
  const complete   = isDocComplete(event, type);
  const checked    = Boolean(event[`documentSent${capitalize(type)}`]);
  // ✅ "บังคับตามประเภทงาน" — งาน PM ต้องมีใบวางบิล/ใบส่งมอบงานเสมอ (ดู isDocRequired)
  // ต่างจาก alwaysRequired ของ Service Report ตรงที่ไม่ต้องติ๊กยืนยัน แค่แนบไฟล์ก็พอ จึงต้องแยกเป็น
  // โหมดที่ 3: ไม่มีปุ่ม "มี/ไม่มี" ให้เลือก (เพราะไม่มีทางเลือก) แต่ก็ไม่มีเช็คบ็อกซ์ให้ติ๊กเหมือน report
  const requiredByJobType = !alwaysRequired && isDocRequired(event, type);

  // ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าเอกสารงานของช่างยังดูรกๆ ปรับปรุง")
  //    เดิม: ไอคอนสีคนละสีทุกชนิด · ป้าย "บังคับ/ถ้ามี" · ป้ายสถานะพื้นสี · คำอธิบายยาว 2-3 บรรทัด · คำใบ้ซ้ำใต้ปุ่ม
  //    ✅ ตอนนี้: วงกลมสถานะทางซ้าย (✓ เขียว = เสร็จ · ⊖ เทา = ไม่มี · ○ = ยังไม่ทำ) + ชื่อ + ข้อความสถานะสั้นทางขวา
  //       คำอธิบายบรรทัดเดียวเฉพาะช่องที่ยังไม่เสร็จ · เนื้อหา (แนบไฟล์/ตอบคำถาม) เยื้องตรงกับชื่อ · ไม่มีคำใบ้ซ้ำ
  const notApplicable = complete && applicable === false && !alwaysRequired && !requiredByJobType;
  const required = alwaysRequired || requiredByJobType;
  const state = notApplicable ? { text: "ไม่มี", fg: MUTED }
    : complete ? { text: `แนบแล้ว ${files.length} ไฟล์`, fg: "#15803d" }
    : alwaysRequired && hasFiles ? { text: "รอยืนยัน", fg: "#b45309" }
    : required || applicable === true ? { text: "ต้องแนบไฟล์", fg: "#b45309" }
    : { text: "รอตอบ", fg: MUTED };
  const statusIcon = notApplicable ? <RemoveCircleOutline sx={{ fontSize: 22, color: FAINT }} />
    : complete ? <CheckCircle sx={{ fontSize: 22, color: SUCCESS }} />
    : <RadioButtonUnchecked sx={{ fontSize: 22, color: "#cbd5e1" }} />;
  const sub = requiredByJobType && !complete ? "งาน PM ต้องแนบทุกครั้ง" : !complete ? desc : "";
  const fileList = (
    <>
      <DocumentFileList
        type={type} files={files}
        isUploading={isUploading} uploadProgress={uploadProgress}
        onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={onPreview}
        isLocked={isLocked} embedded={embedded}
      />
      {/* ✅ (25 ต.ค. 2569) Service Report: ให้ AI อ่านใบแล้วสรุป → ตรวจ/แก้ → ออก PDF สรุปรายงานบริการ (ใช้ Swal — ไม่แสดงบนฟอร์มหน้า Event) */}
      {type === "report" && hasFiles && !embedded && <ServiceReportAiBar event={event} sx={{ mt: 0.5 }} />}
      {/* ✅ (4 พ.ย. 2569) ใบวางบิล: แนบแล้วบันทึกการวางบิล (เลขที่/ยอด) ต่อได้ทันที — เชื่อมหน้า "วางบิล / รับเงิน" */}
      {type === "invoice" && hasFiles && <InvoiceBillingBar event={event} filesCount={files.length} zIndex={embedded ? 20030 : undefined} sx={{ mt: 0.5 }} />}
    </>
  );
  const linkBtn = (text, onClick) => (
    <Button size="small" onClick={onClick}
      sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700, minWidth: "auto", px: 0.75, py: 0.25, color: ACCENT, flexShrink: 0 }}>
      {text}
    </Button>
  );

  return (
    <Box sx={{ borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${LINE}`, px: 1.5, py: 1.35 }}>
      {/* ── หัว: วงกลมสถานะ · ชื่อ (* = บังคับ) · ข้อความสถานะ ── */}
      <Stack direction="row" alignItems="center" gap={1.1}>
        {statusIcon}
        <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: "0.92rem", color: notApplicable ? MUTED : INK, lineHeight: 1.3 }}>
          {label}{required && <Box component="span" sx={{ color: "#dc2626", ml: 0.25 }}>*</Box>}
        </Typography>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: state.fg, whiteSpace: "nowrap" }}>{state.text}</Typography>
      </Stack>

      {/* 🔁 (6 พ.ย. 2569) มือถือ: ไฟล์/ปุ่มเต็มความกว้างการ์ด (เดิมเยื้อง 34px ทำให้กล่องวางบิลแคบ ข้อความตกบรรทัด) · จอคอมเยื้องตรงชื่อเหมือนเดิม */}
      <Box sx={{ pl: { xs: 0, sm: "34px" } }}>
        {sub && (
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45, mt: 0.25, pl: { xs: "34px", sm: 0 },
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{sub}</Typography>
        )}

        {alwaysRequired ? (
          <Box sx={{ mt: 1 }}>
            {fileList}
            {/* การยืนยัน — ช่องติ๊กบรรทัดเดียว (ไม่ทำเป็นกล่อง ไม่ให้ดูเหมือนปุ่ม) */}
            <Stack direction="row" alignItems="center" gap={0.75} role="checkbox" aria-checked={checked}
              onClick={!isLocked ? () => onToggleCheck(type, !checked) : undefined}
              sx={{ mt: 0.75, py: 0.4, cursor: isLocked ? "default" : "pointer", opacity: isLocked ? 0.7 : 1, width: "fit-content" }}>
              {checked ? <CheckBox sx={{ fontSize: 21, color: ACCENT }} /> : <CheckBoxOutlineBlank sx={{ fontSize: 21, color: FAINT }} />}
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK_2 }}>ยืนยันว่า Service Report ครบถ้วนแล้ว</Typography>
            </Stack>
            {checked && !hasFiles && (
              <Typography sx={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 600 }}>ยังไม่มีไฟล์ — แนบไฟล์ก่อนจึงจะนับว่าครบ</Typography>
            )}
          </Box>
        ) : requiredByJobType ? (
          <Box sx={{ mt: 1 }}>{fileList}</Box>
        ) : applicable === null || applicable === undefined ? (
          <Box sx={{ mt: 0.85 }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK_2, mb: 0.75 }}>
              {question || "งานนี้มีเอกสารนี้หรือไม่?"}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
              {[["yes", yesLabel || "มี"], ["no", noLabel || "ไม่มี"]].map(([v, text]) => (
                <Button key={v} variant="outlined" disabled={isLocked} onClick={() => onSetApplicable(type, v === "yes")}
                  sx={{ ...MBTN.outline(v === "yes" ? ACCENT : "#64748b"), minHeight: 36, fontSize: "0.8rem" }}>
                  {text}
                </Button>
              ))}
            </Box>
          </Box>
        ) : applicable === false ? (
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 0.25, pl: { xs: "34px", sm: 0 } }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{noneText || "ไม่มีเอกสารนี้สำหรับงานนี้"}</Typography>
            {!isLocked && linkBtn("เปลี่ยน", () => onSetApplicable(type, true))}
          </Stack>
        ) : (
          <Box sx={{ mt: 1 }}>
            {fileList}
            {!hasFiles && !isLocked && (
              <Box sx={{ mt: 0.5, ml: -0.75 }}>{linkBtn(noLabel ? `เปลี่ยนเป็น “${noLabel}”` : "เปลี่ยนเป็นไม่มี", () => onSetApplicable(type, false))}</Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * JobDocChecklist — รายการเอกสารประจำงาน 4 ชนิด "ฝั่งช่าง" ชุดเดียวทั้งแอป
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "หน้าของช่างต้องทำให้เหมือนกับหน้าดำเนินงานด้วยทุกอย่าง ต้องบอกว่ามีเอกสารหรือไม่มี
 *    บางอย่างก็บังคับ ให้เหมือนกัน ไม่ให้แตกต่าง") — ใช้ทั้งแผงงานช่าง (หน้าดำเนินงาน/งานของฉัน) และเอกสารในหน้า Event
 *    Service Report = บังคับ (แนบ + ติ๊กยืนยัน) · ใบเสนอราคา/เอกสารการเงิน/ใบส่งมอบงาน = ตอบ "มี/ไม่มี" (งาน PM บังคับบางชนิด)
 * @param onInputUpdate (id, patch) => Promise — บันทึกสถานะเอกสาร + activityLog
 * @param onFileUpload  (files, eventId, type) · onDeleteFile (eventId, type, fileId) · uploadOf (type) => { busy, progress }
 */
export function JobDocChecklist({ event, userName, isLocked, onInputUpdate, onFileUpload, onDeleteFile, onPreview, uploadOf, embedded = false }) {
  const who = userName || (() => { try { const p = JSON.parse(localStorage.getItem("payload") || "{}"); return p?.name || p?.username || "ช่าง"; } catch { return "ช่าง"; } })();
  const logOf = (detail, action) => ({ action, detail, userName: who, timestamp: new Date().toISOString() });
  // ติ๊ก/ยกเลิกติ๊ก — เฉพาะ Service Report
  const toggle = async (type, checked) => {
    const label = DOCUMENT_TYPES.find((d) => d.type === type)?.label || type;
    await onInputUpdate(event._id, {
      [`documentSent${capitalize(type)}`]: checked,
      activityLog: [...(event.activityLog || []), logOf(`${label} ${checked ? "✓ ติ๊กแล้ว" : "ยกเลิกติ๊ก"}`, "document_checked")],
    });
  };
  // เลือก "มี/ไม่มี" — ไม่มี = จัดการแล้วทันที · มี = ยังไม่เสร็จจนกว่าจะแนบไฟล์
  const setApplicable = async (type, applicable) => {
    const label = DOCUMENT_TYPES.find((d) => d.type === type)?.label || type;
    await onInputUpdate(event._id, {
      [`${type}Applicable`]: applicable,
      [`documentSent${capitalize(type)}`]: applicable === false,
      activityLog: [...(event.activityLog || []), logOf(`${label}: ${applicable ? "มีเอกสารนี้" : "ไม่มีเอกสารนี้"}`, "document_applicable_set")],
    });
  };
  return (
    <Stack spacing={1}>
      {DOCUMENT_TYPES.map((doc) => {
        const u = uploadOf?.(doc.type) || {};
        return (
          <DocumentChecklistItem
            key={doc.type}
            type={doc.type} label={doc.label} color={doc.color} icon={doc.icon} event={event}
            alwaysRequired={doc.alwaysRequired} desc={doc.desc} question={doc.question}
            yesLabel={doc.yesLabel} noLabel={doc.noLabel} noneText={doc.noneText} uploadHint={doc.uploadHint}
            onToggleCheck={toggle} onSetApplicable={setApplicable}
            onFileUpload={(files, type) => onFileUpload(files, event._id, type)}
            onDeleteFile={(type, fileId) => onDeleteFile(event._id, type, fileId)}
            onPreview={onPreview}
            isUploading={Boolean(u.busy)} uploadProgress={u.progress || 0}
            isLocked={isLocked} embedded={embedded}
          />
        );
      })}
    </Stack>
  );
}

/** ความคืบหน้าเอกสารฝั่งช่าง — { done, total } */
export const jobDocProgress = (event) => ({ done: DOCUMENT_TYPES.filter((d) => isDocComplete(event, d.type)).length, total: DOCUMENT_TYPES.length });

