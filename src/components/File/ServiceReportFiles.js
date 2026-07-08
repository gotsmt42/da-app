import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";

import EventService from "../../services/EventService";

import {
  Box, Paper, Stack, Chip, Typography, TextField, InputAdornment,
  IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
  DialogContent, Divider, LinearProgress, Button, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Download, Visibility, Close, PictureAsPdf, Image, Article,
  InsertDriveFile, AttachFile, FolderOpen, OpenInNew, Refresh,
} from "@mui/icons-material";

// ─── Doc-type color scheme (ตรงกับ FileUploadSection ในหน้า Operation) ─────
const DOC_TYPE_COLOR = {
  report: "#3b82f6",
  quotation: "#ef4444",
  invoice: "#f59e0b",
  completion: "#07941a",
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
          <img src={previewUrl} alt={previewFileName} style={{ maxWidth: "100%", maxHeight: 780, display: "block", margin: "0 auto", padding: 16 }} />
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
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState(null);

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

  const counts = useMemo(() => {
    const c = { all: files.length };
    files.forEach((f) => { c[f.docType] = (c[f.docType] || 0) + 1; });
    return c;
  }, [files]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return files.filter((f) => {
      if (docTypeFilter !== "all" && f.docType !== docTypeFilter) return false;
      if (!kw) return true;
      return [f.fileName, f.company, f.site, f.docNo, f.title, f.system, f.team]
        .some((v) => (v || "").toLowerCase().includes(kw));
    });
  }, [files, search, docTypeFilter]);

  return (
    <Box>
      {/* แถบค้นหา/กรอง */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={1.5} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            placeholder="ค้นหาชื่อไฟล์ / บริษัท / โครงการ / เลขที่เอกสาร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 240 }}
          />
          <Stack direction="row" alignItems="center" gap={1}>
            <ToggleButtonGroup
              size="small" exclusive value={docTypeFilter}
              onChange={(_, v) => v && setDocTypeFilter(v)}
              sx={{ flexWrap: "wrap" }}
            >
              {DOC_TYPES.map((d) => (
                <ToggleButton key={d.value} value={d.value} sx={{ textTransform: "none", fontSize: "0.75rem", px: 1.25, py: 0.5 }}>
                  {d.label} ({counts[d.value] || 0})
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Tooltip title="รีเฟรช">
              <IconButton size="small" onClick={fetchData}><Refresh fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Alert severity="info" variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
        เอกสารเหล่านี้มาจากไฟล์ที่ช่าง/แอดมินแนบไว้ในแต่ละงานที่หน้า{" "}
        <Button component={Link} to="/operation" size="small" sx={{ textTransform: "none", fontWeight: 700, p: 0, minWidth: "auto", verticalAlign: "baseline" }}>
          ดำเนินงาน
        </Button>
        {" "}— หากต้องการเพิ่ม/แก้ไขเอกสาร ให้ไปแนบไฟล์ที่งานนั้นโดยตรง
      </Alert>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {!loading && filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <FolderOpen sx={{ fontSize: 56, opacity: 0.25, mb: 1 }} />
          <Typography fontWeight={600}>ไม่พบเอกสาร</Typography>
          <Typography variant="body2" color="text.disabled">
            เอกสารที่ช่าง/แอดมินอัพโหลดในหน้าดำเนินงานจะแสดงที่นี่โดยอัตโนมัติ
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((f) => {
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
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {f.company && f.site ? `${f.company} · ${f.site}` : (f.company || f.site || "ไม่ระบุบริษัท/ไซต์")}
                      {f.docNo ? ` · 📄 ${f.docNo}` : ""}
                      {f.team ? ` · 👷 ${f.team}` : ""}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      อัพโหลดเมื่อ {moment(f.uploadedAt).locale("th").format("DD MMM YYYY HH:mm")}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.25} flexShrink={0}>
                    <Tooltip title="ดูไฟล์">
                      <IconButton onClick={() => { setPreviewUrl(f.fileUrl); setPreviewFileName(f.fileName); }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ดาวน์โหลด">
                      <IconButton onClick={() => downloadFile(f.fileUrl, f.fileName)}>
                        <Download fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ไปที่หน้าดำเนินงาน">
                      <IconButton component={Link} to={`/operation/${f.eventId}`}>
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <FilePreviewDialog
        previewUrl={previewUrl}
        previewFileName={previewFileName}
        onClose={() => { setPreviewUrl(null); setPreviewFileName(null); }}
      />
    </Box>
  );
};

export default ServiceReportFiles;
