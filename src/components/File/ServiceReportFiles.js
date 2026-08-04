import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";

import EventService from "../../services/EventService";
import { resolveOperationGroup } from "../../utils/overdueJobs";
import { getOptimizedImageUrl } from "../../utils/cloudinaryImage";
import { formatRoundLabel } from "../../utils/contractRounds";
import { printFile, shareFile, shareToLine, isMobileDevice } from "../../functions/fileActions";

import {
  Box, Paper, Stack, Chip, Typography, TextField, InputAdornment,
  IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
  DialogContent, Divider, LinearProgress, Button, Pagination, useMediaQuery,
  Menu, MenuItem, ListItemIcon, ListItemText,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Download, Visibility, Close, PictureAsPdf, Image, Article,
  InsertDriveFile, AttachFile, FolderOpen, OpenInNew, Refresh,
  MoreVert, Print, Share, Person,
  Description, RequestQuote, ReceiptLong, AssignmentTurnedIn,
} from "@mui/icons-material";
import LineIcon from "../icons/LineIcon";

const IS_MOBILE = isMobileDevice();

// ✅ ธีมสีแอพ (แดง) — เดิมหน้านี้ใช้สี default ของ MUI (น้ำเงิน) ทั้งกรอบช่องกรอกตอนโฟกัส/สถานะ
// เลือกของตัวกรอง ไม่ตรงกับธีมแดงที่ใช้ทั่วแอป (Login, การ์ดงานกรุ๊ป ฯลฯ)
const ACCENT = "#dc2626";
const redFieldSx = {
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: ACCENT },
  "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
};

// ─── InfoLine (เทียบ pattern เดียวกับหน้า Operation/TechnicianJobPanel) ────────
// ✅ เดิมข้อมูลงาน (บริษัท/ไซต์/ทีม) อัดรวมเป็นบรรทัดเดียว "Avenue · 👤 Santisuk" อ่านยาก แยกเป็น
// รายการ "ไอคอน + ป้ายกำกับ : ค่า" ทีละบรรทัดแทนให้ชัดเจน/ดูง่ายขึ้น — ป้ายกำกับไม่ตัดคำ ส่วนค่าที่
// ยาวขึ้นบรรทัดใหม่ได้อิสระโดยไม่ดึงป้ายกำกับตามไปด้วย
const InfoLine = ({ icon, label, children }) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
      {icon} {label} :
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
      {children}
    </Typography>
  </Stack>
);

// ─── Doc-type color scheme (ตรงกับ FileUploadSection ในหน้า Operation) ─────
const DOC_TYPE_COLOR = {
  report: "#3b82f6",
  quotation: "#ef4444",
  invoice: "#f59e0b",
  completion: "#07941a",
};

const DOC_TYPE_ICON = {
  report: Description,
  quotation: RequestQuote,
  invoice: ReceiptLong,
  completion: AssignmentTurnedIn,
};

const DOC_TYPES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "report", label: "Service Report" },
  { value: "quotation", label: "ใบเสนอราคา" },
  { value: "invoice", label: "ใบวางบิล" },
  { value: "completion", label: "ใบส่งมอบงาน" },
];

// ─── File type helpers (เหมือนหน้า Operation) ──────────────────────────────
const getFileType = (fileName = "") => {
  if (!fileName || typeof fileName !== "string") return "unknown";
  const lower = fileName.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some((e) => lower.endsWith(e))) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "excel";
  return "unknown";
};

const fileTypeIcon = (fileName) => {
  const t = getFileType(fileName);
  if (t === "image") return <Image sx={{ color: "#10b981" }} />;
  if (t === "pdf") return <PictureAsPdf sx={{ color: "#ef4444" }} />;
  if (t === "word") return <Article sx={{ color: "#3b82f6" }} />;
  if (t === "excel") return <InsertDriveFile sx={{ color: "#10b981" }} />;
  return <AttachFile sx={{ color: "#6b7280" }} />;
};

// ⚠️ ไฟล์เก็บบน Cloudinary (คนละโดเมน) จึงดึงมาเป็น blob แล้วสั่งดาวน์โหลดเอง
// เพื่อบังคับชื่อไฟล์ที่ถูกต้องจากฐานข้อมูลเสมอ (เหมือนหน้า Operation)
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

// ─── Preview Dialog (เหมือนหน้า Operation) ─────────────────────────────────
const FilePreviewDialog = ({ previewUrl, previewFileName, onClose }) => {
  const type = getFileType(previewFileName || previewUrl || "");
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    if (type !== "pdf" || !previewUrl) {
      setPdfBlobUrl(null);
      setPdfError(false);
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    setPdfLoading(true);
    setPdfError(false);
    fetch(previewUrl)
      .then((res) => { if (!res.ok) throw new Error("โหลดไฟล์ไม่สำเร็จ"); return res.blob(); })
      .then((blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setPdfBlobUrl(objectUrl); })
      .catch(() => { if (!cancelled) setPdfError(true); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [type, previewUrl]);

  return (
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        {fileTypeIcon(previewFileName)}
        <Typography fontWeight={700} noWrap flex={1}>{previewFileName || "ดูไฟล์"}</Typography>
        <Stack direction="row" gap={0.5}>
          {previewUrl && (
            <Tooltip title="ดาวน์โหลด">
              <IconButton onClick={() => downloadFile(previewUrl, previewFileName)}><Download /></IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {type === "image" && (
          <img src={getOptimizedImageUrl(previewUrl)} alt={previewFileName} style={{ maxWidth: "100%", maxHeight: 780, display: "block", margin: "0 auto", padding: 16 }} />
        )}
        {type === "pdf" && (
          pdfLoading ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <LinearProgress sx={{ mx: 6, mb: 2, borderRadius: 1 }} />
              <Typography variant="body2">กำลังโหลดไฟล์...</Typography>
            </Box>
          ) : pdfError ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <PictureAsPdf sx={{ fontSize: 48, opacity: 0.3 }} />
              <Typography>ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้</Typography>
              <Button size="small" variant="outlined" sx={{ mt: 1.5, borderRadius: 2 }}
                onClick={() => downloadFile(previewUrl, previewFileName)}>
                ดาวน์โหลดแทน
              </Button>
            </Box>
          ) : pdfBlobUrl ? (
            <iframe src={pdfBlobUrl} width="100%" height="780px" style={{ border: "none" }} title="PDF" />
          ) : null
        )}
        {(type === "word" || type === "excel") && (
          <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} width="100%" height="780px" style={{ border: "none" }} title="Office" />
        )}
        {type === "unknown" && (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <FolderOpen sx={{ fontSize: 48 }} />
            <Typography>ไม่สามารถแสดงไฟล์นี้ได้</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Main: ServiceReportFiles ──────────────────────────────────────────────
// รวมไฟล์เอกสารประจำงาน (Service Report / ใบเสนอราคา / ใบวางบิล / ใบส่งมอบงาน)
// ที่ช่าง/แอดมินอัพโหลดผ่านหน้า Operation มาแสดงเป็นตาราง/รายการเดียว
const ServiceReportFiles = () => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  // ✅ ค้นหา/กรองเฉพาะไฟล์ของช่างคนใดคนหนึ่งได้ — เดิมมีแค่ช่องค้นหารวม (ต้องพิมพ์ชื่อทีมเองแบบ
  // เจาะจง) เพิ่ม dropdown แยกให้เลือกจากรายชื่อทีมที่มีไฟล์จริงในระบบ ไม่ต้องพิมพ์เอง/พิมพ์ผิด
  const [teamFilter, setTeamFilter] = useState("all");
  // ✅ แบ่งหน้าตามกลุ่ม "ช่างแต่ละคน" (หน่วยระดับบนสุดของการจัดกลุ่มตอนนี้) แทนแบ่งตามจำนวนไฟล์ดิบ
  // กันไม่ให้ไฟล์ของช่างคนเดียวกันถูกตัดคาบเกี่ยวคนละหน้า
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState(null);
  const [fileMenu, setFileMenu] = useState(null); // { el, file }
  const closeFileMenu = () => setFileMenu(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await EventService.GetServiceReportFiles();
      setFiles(res?.files || []);
    } catch (err) {
      console.error("Error fetching service report files:", err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ รายชื่อทีม/ช่างทั้งหมดที่มีไฟล์จริงในระบบ (ไม่ซ้ำ เรียงตามตัวอักษร) ใช้ทำ dropdown กรอง
  const teamOptions = useMemo(
    () => [...new Set(files.map((f) => f.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [files]
  );

  // ✅ กรองด้วยคำค้นหา/ทีมก่อน (ไม่รวมประเภทเอกสาร) แยกไว้ต่างหาก เพื่อให้ตัวเลขในชิป
  // ประเภทเอกสารแต่ละใบนับตามคำค้นหา/ทีมที่เลือกอยู่ด้วย ไม่ใช่นับจากไฟล์ทั้งหมดเฉยๆ
  const searchAndTeamFiltered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return files.filter((f) => {
      if (teamFilter !== "all" && f.team !== teamFilter) return false;
      if (!kw) return true;
      return [f.fileName, f.company, f.site, f.docNo, f.title, f.system, f.team]
        .some((v) => (v || "").toLowerCase().includes(kw));
    });
  }, [files, search, teamFilter]);

  const counts = useMemo(() => {
    const c = { all: searchAndTeamFiltered.length };
    searchAndTeamFiltered.forEach((f) => { c[f.docType] = (c[f.docType] || 0) + 1; });
    return c;
  }, [searchAndTeamFiltered]);

  const filtered = useMemo(() => {
    if (docTypeFilter === "all") return searchAndTeamFiltered;
    return searchAndTeamFiltered.filter((f) => f.docType === docTypeFilter);
  }, [searchAndTeamFiltered, docTypeFilter]);

  // ✅ กลับไปหน้า 1 ทุกครั้งที่ตัวกรอง/คำค้นหาเปลี่ยน กันเคสอยู่หน้า 3 แล้วกรองจนเหลือไม่กี่รายการ
  useEffect(() => { setPage(1); }, [search, docTypeFilter, teamFilter]);

  // ✅ แบ่งหน้าตามจำนวนไฟล์จริง (5 รายการ/หน้า) ก่อน แล้วค่อยจัดกลุ่มแยกช่าง/ประเภทเอกสาร
  // "เฉพาะไฟล์ในหน้านั้น" — เดิมแบ่งหน้าตามจำนวนช่าง (กลุ่มบนสุด) แต่ถ้ามีช่างแค่ 2-3 คน แต่ละคน
  // มีไฟล์เยอะ หน้าเดียวก็จุครบทุกคนอยู่ดี ดูเหมือนไม่ได้แบ่งหน้าเลย
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedFiles = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  // ✅ จัดกลุ่มแสดงผล (เฉพาะไฟล์ในหน้าปัจจุบัน) แยกตามช่าง/ทีมก่อน แล้วในแต่ละคนแยกย่อยตามประเภท
  // เอกสารอีกที (เทียบ pattern เดียวกับหัวข้อกลุ่มเดือนในแท็บ "ไทม์ไลน์" หน้า Operation)
  const pagedGroups = useMemo(() => {
    const UNASSIGNED = "ไม่ระบุทีม/ช่าง";
    const teamMap = new Map();
    pagedFiles.forEach((f) => {
      const teamName = f.team || UNASSIGNED;
      if (!teamMap.has(teamName)) teamMap.set(teamName, []);
      teamMap.get(teamName).push(f);
    });
    const docOrder = DOC_TYPES.filter((d) => d.value !== "all").map((d) => d.value);
    return [...teamMap.entries()]
      .sort(([a], [b]) => {
        if (a === UNASSIGNED) return 1;
        if (b === UNASSIGNED) return -1;
        return a.localeCompare(b, "th");
      })
      .map(([teamName, teamFiles]) => ({
        teamName,
        files: teamFiles,
        byType: docOrder
          .map((type) => ({ type, files: teamFiles.filter((f) => f.docType === type) }))
          .filter((g) => g.files.length > 0),
      }));
  }, [pagedFiles]);

  const renderFileRow = (f) => {
    const color = DOC_TYPE_COLOR[f.docType] || "#6b7280";
    return (
      <Paper
        key={f.fileId}
        variant="outlined"
        sx={{
          p: 1.75, borderRadius: 2.5, transition: "border-color .15s",
          "&:hover": { borderColor: color },
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(color, 0.1),
          }}>
            {fileTypeIcon(f.fileName)}
          </Box>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" gap={0.6} alignItems="center" flexWrap="wrap" mb={0.3}>
              <Chip
                label={f.docTypeLabel}
                size="small"
                sx={{
                  height: 20, fontSize: "0.68rem", fontWeight: 700,
                  bgcolor: alpha(color, 0.12), color,
                }}
              />
              {f.status && (
                <Chip label={f.status} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.68rem" }} />
              )}
            </Stack>
            <Typography fontWeight={700} fontSize="0.875rem" noWrap title={f.fileName}>
              {f.fileName}
            </Typography>
            <Stack spacing={0.3} sx={{ my: 0.4 }}>
              {f.system && <InfoLine icon="💻" label="ระบบ">{f.system}</InfoLine>}
              <InfoLine icon="🏢" label="โครงการ">
                {f.company && f.site ? `${f.company} · ${f.site}` : (f.company || f.site || "ไม่ระบุบริษัท/ไซต์")}
              </InfoLine>
              {f.time && <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(f.time, f.visitCount)}</InfoLine>}
              {f.docNo && <InfoLine icon="📄" label="เอกสาร">{f.docNo}</InfoLine>}
              {(() => {
                const teamNames = [f.team, ...(f.teamMembers || []).map((m) => m?.name)]
                  .filter(Boolean)
                  .filter((name, idx, arr) => arr.indexOf(name) === idx);
                return teamNames.length > 0 && (
                  <InfoLine icon="👷" label="ทีม">{teamNames.join(", ")}</InfoLine>
                );
              })()}
            </Stack>
            <Typography variant="caption" color="text.disabled">
              อัพโหลดเมื่อ {moment(f.uploadedAt).locale("th").format("DD MMM YYYY HH:mm")}
            </Typography>
          </Box>
          {/* ✅ เดิมมีปุ่มแยกเรียงเต็มแถว (ดูไฟล์/ดาวน์โหลด/ไปที่งาน) ดูรกตาเวลามีไฟล์เยอะ
              เหลือแค่ "ดูไฟล์" (บ่อยสุด) ไว้ตรงๆ ส่วนที่เหลือ + แชร์/พิมพ์ (เหมือนหน้า
              Operation) รวมเป็นเมนู "⋮" เดียว */}
          <Stack direction="row" gap={0.25} flexShrink={0}>
            <Tooltip title="ดูไฟล์">
              <IconButton onClick={() => { setPreviewUrl(f.fileUrl); setPreviewFileName(f.fileName); }}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="เพิ่มเติม">
              <IconButton onClick={(e) => setFileMenu({ el: e.currentTarget, file: f })}>
                <MoreVert fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Box>
      {/* ✅ จัดใหม่เป็น 2 แถวเสมอ (เดิมพยายามยัดทุกอย่างแถวเดียว/ครึ่งๆ กลางๆ พอจอแคบชิป
          ตัวกรอง 5 ใบตัดขึ้นบรรทัดใหม่แบบสะเปะสะปะ + ปุ่มรีเฟรชลอยเดี่ยวๆ ดูไม่เป็นระบบ) —
          แถวบน: ค้นหา + ทีม/ช่าง (จอกว้างอยู่แถวเดียวกัน, จอแคบซ้อนกันคนละบรรทัด)
          แถวล่าง: ชิปตัวกรองประเภทเอกสาร เลื่อนดูแนวนอนบรรทัดเดียวเสมอ (ไม่ตัดขึ้นบรรทัดใหม่
          อีกต่อไป) คู่กับปุ่มรีเฟรชติดขอบขวาเสมอ ไม่ลอยเดี่ยวๆ อีก */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} gap={1.5} alignItems={{ md: "center" }}>
            <TextField
              size="small"
              placeholder="ค้นหาชื่อไฟล์ / บริษัท / โครงการ / เลขที่เอกสาร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Search sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment>
                ),
              }}
              sx={{ flex: 1, minWidth: { md: 240 }, ...redFieldSx }}
            />
            {/* ✅ กรองเฉพาะไฟล์ของช่าง/ทีมใดทีมหนึ่งได้ — ดึงรายชื่อจากไฟล์จริงในระบบ ไม่ต้องพิมพ์เอง */}
            <TextField
              select size="small" label="ทีม/ช่าง" value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              SelectProps={{ native: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Person sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment>
                ),
              }}
              sx={{
                width: { xs: "100%", md: 170 }, flexShrink: 0,
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
                ...redFieldSx,
              }}
            >
              <option value="all">ทุกคน</option>
              {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </TextField>
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            {/* ✅ สถานะ "เลือกอยู่" ของชิปตัวกรอง เดิมใช้สี default ของ MUI (น้ำเงิน) เปลี่ยนเป็น
                สีธีมแอพ (แดง) ให้ตรงกับหน้าอื่นๆ (StatusGroupCard/FilterChip ในหน้า Operation) */}
            <Box sx={{ flex: 1, minWidth: 0, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { height: 4 } }}>
              <ToggleButtonGroup
                size="small" exclusive value={docTypeFilter}
                onChange={(_, v) => v && setDocTypeFilter(v)}
                sx={{ flexWrap: "nowrap", width: "max-content" }}
              >
                {DOC_TYPES.map((d) => (
                  <ToggleButton key={d.value} value={d.value} sx={{
                    textTransform: "none", fontSize: "0.75rem", px: 1.25, py: 0.5, whiteSpace: "nowrap",
                    "&.Mui-selected": {
                      color: ACCENT, bgcolor: alpha(ACCENT, 0.12), borderColor: alpha(ACCENT, 0.4),
                      "&:hover": { bgcolor: alpha(ACCENT, 0.18) },
                    },
                  }}>
                    {d.label} ({counts[d.value] || 0})
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Tooltip title="รีเฟรช">
              <IconButton size="small" onClick={fetchData} sx={{ flexShrink: 0, border: "1px solid", borderColor: "divider" }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {loading && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1, "& .MuiLinearProgress-bar": { bgcolor: ACCENT } }} />
      )}

      {!loading && filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <FolderOpen sx={{ fontSize: 56, opacity: 0.25, mb: 1 }} />
          <Typography fontWeight={600}>ไม่พบเอกสาร</Typography>
          <Typography variant="body2" color="text.disabled">
            เอกสารที่ช่าง/แอดมินอัพโหลดในหน้าดำเนินงานจะแสดงที่นี่โดยอัตโนมัติ
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {pagedGroups.map((grp) => (
            <Box key={grp.teamName}>
              <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 1.5 }}>
                <Box sx={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  bgcolor: alpha(ACCENT, 0.12), color: ACCENT,
                }}>
                  <Person fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {grp.teamName}
                </Typography>
                <Chip label={grp.files.length} size="small" sx={{
                  height: 22, fontSize: "0.72rem", fontWeight: 700,
                  bgcolor: alpha(ACCENT, 0.12), color: ACCENT,
                }} />
              </Stack>
              <Stack spacing={2} sx={{ pl: { xs: 0, sm: 1.5 }, borderLeft: { xs: "none", sm: "2px solid" }, borderColor: "divider" }}>
                {grp.byType.map((sub) => {
                  const docColor = DOC_TYPE_COLOR[sub.type] || "#6b7280";
                  const DocIcon = DOC_TYPE_ICON[sub.type] || InsertDriveFile;
                  const docLabel = DOC_TYPES.find((d) => d.value === sub.type)?.label || sub.type;
                  return (
                    <Box key={sub.type}>
                      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                        <Box sx={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: alpha(docColor, 0.12), color: docColor,
                        }}>
                          <DocIcon sx={{ fontSize: 13 }} />
                        </Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">{docLabel}</Typography>
                        <Chip label={sub.files.length} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.62rem" }} />
                      </Stack>
                      <Stack spacing={1.25}>
                        {sub.files.map((f) => renderFileRow(f))}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}

          {/* ✅ แบ่งหน้าละ 5 กลุ่มช่างเป็นค่าเริ่มต้น (เทียบ pattern เดียวกับแท็บรายการหน้า Operation) */}
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between"
            gap={1.5} sx={{ mt: 1 }}>
            <TextField
              select size="small" label="ต่อหน้า" value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              sx={{ width: 110, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              SelectProps={{ native: true }}
            >
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} ราย</option>)}
            </TextField>
            <Pagination
              count={totalPages} page={page}
              onChange={(_, v) => setPage(v)}
              color="primary" shape="rounded" size={isMobile ? "large" : "medium"}
              showFirstButton showLastButton
              sx={isMobile ? { "& .MuiPaginationItem-root": { minWidth: 40, height: 40, fontSize: "1rem" } } : undefined}
            />
          </Stack>
        </Stack>
      )}

      {/* เมนู "⋮" ต่อไฟล์ — ดาวน์โหลด/พิมพ์/แชร์/ไปที่หน้าดำเนินงาน (เทียบ pattern เดียวกับหน้า Operation) */}
      <Menu anchorEl={fileMenu?.el} open={Boolean(fileMenu)} onClose={closeFileMenu}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}>
        <MenuItem onClick={() => { downloadFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText>ดาวน์โหลด</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { printFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
          <ListItemIcon><Print fontSize="small" /></ListItemIcon>
          <ListItemText>พิมพ์</ListItemText>
        </MenuItem>
        {IS_MOBILE ? (
          <>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์ (รูป/PDF)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { shareToLine(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><LineIcon size={20} /></ListItemIcon>
              <ListItemText>แชร์ลิงก์ไปยัง LINE</ListItemText>
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={() => { shareToLine(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><LineIcon size={20} /></ListItemIcon>
              <ListItemText>แชร์ไปยัง LINE</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์</ListItemText>
            </MenuItem>
          </>
        )}
        <Divider />
        {fileMenu && (
          <MenuItem
            component={Link}
            onClick={closeFileMenu}
            to={`/operation/${fileMenu.file.eventId}${resolveOperationGroup({ status: fileMenu.file.status }) ? `?group=${resolveOperationGroup({ status: fileMenu.file.status })}` : ""}`}
            sx={{ gap: 1.5, minHeight: 44 }}
          >
            <ListItemIcon><OpenInNew fontSize="small" /></ListItemIcon>
            <ListItemText>ไปที่หน้าดำเนินงาน</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <FilePreviewDialog
        previewUrl={previewUrl}
        previewFileName={previewFileName}
        onClose={() => { setPreviewUrl(null); setPreviewFileName(null); }}
      />
    </Box>
  );
};

export default ServiceReportFiles;
