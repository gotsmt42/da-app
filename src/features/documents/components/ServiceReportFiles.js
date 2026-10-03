import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import PdfBlobView from "@/shared/components/PdfBlobView";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";

import EventService from "@/shared/services/EventService";
import { resolveOperationGroup } from "@/shared/utils/overdueJobs";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { printFile, shareFile, shareToLine, isMobileDevice } from "@/shared/utils/fileActions";

import {
  Box, Stack, Typography,
  IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, Divider, LinearProgress, Button, Pagination,
  Menu, MenuItem, ListItemIcon, ListItemText, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Download, Visibility, Close, PictureAsPdf, Image, Article,
  InsertDriveFile, AttachFile, FolderOpen, OpenInNew, Refresh,
  MoreVert, Print, Share,
  Description, RequestQuote, ReceiptLong, AssignmentTurnedIn,
} from "@mui/icons-material";
import LineIcon from "@/shared/ui/LineIcon";
import SelectField from "@/shared/ui/SelectField";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { Kpi, KpiRow, FilterBar, Panel, EmptyState, INK, INK_2, MUTED, LINE, SURFACE, ICON_BTN_SX } from "@/shared/ui/PageKit";
import { formatThai } from "@/shared/utils/thaiDate";

const IS_MOBILE = isMobileDevice();

// ✅ ธีมสีแอพ (แดง) — เดิมหน้านี้ใช้สี default ของ MUI (น้ำเงิน) ทั้งกรอบช่องกรอกตอนโฟกัส/สถานะ
// เลือกของตัวกรอง ไม่ตรงกับธีมแดงที่ใช้ทั่วแอป (Login, การ์ดงานกรุ๊ป ฯลฯ)



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
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth fullScreen={window.matchMedia?.("(max-width:600px)").matches}
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
            <PdfBlobView url={pdfBlobUrl} />
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

  // ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "หน้าเอกสารยังไม่เข้าธีม ดูข้อมูลยาก" — แถวไฟล์แบบกระชับ (ไอคอน · ชื่อไฟล์ ·
  //    โครงการ/งาน 1 บรรทัด · ชนิด/สถานะ/วันที่ 1 บรรทัด · ปุ่ม) แทนการ์ดสูงที่มีรายการ "ไอคอน ป้าย : ค่า" 5 บรรทัด
  const renderFileRow = (f, i) => {
    const color = DOC_TYPE_COLOR[f.docType] || "#6b7280";
    const DocIcon = DOC_TYPE_ICON[f.docType] || InsertDriveFile;
    const place = [f.site || f.company, f.system, f.time ? `ครั้งที่ ${formatRoundLabel(f.time, f.visitCount)}` : ""].filter(Boolean).join(" · ") || "ไม่ระบุโครงการ";
    const open = () => { setPreviewUrl(f.fileUrl); setPreviewFileName(f.fileName); };
    return (
      <Stack key={f.fileId} direction="row" alignItems="center" spacing={1.5} onClick={open} role="button"
        sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: i ? `1px solid ${LINE}` : "none", cursor: "pointer", "&:hover": { bgcolor: SURFACE } }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(color, 0.1), color }}>
          <DocIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap title={f.fileName} sx={{ fontWeight: 700, fontSize: "0.88rem", color: INK }}>{f.fileName}</Typography>
          <Typography noWrap sx={{ fontSize: "0.78rem", color: INK_2 }}>{place}</Typography>
          <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>
            <Box component="span" sx={{ color, fontWeight: 700 }}>{f.docTypeLabel}</Box>
            {f.status ? ` · ${f.status}` : ""} · {formatThai(moment(f.uploadedAt).locale("th"), "D MMM YY HH:mm")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
          <Tooltip title="ดูไฟล์">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); open(); }} sx={{ color: INK_2 }}><Visibility sx={{ fontSize: 19 }} /></IconButton>
          </Tooltip>
          <IconButton size="small" aria-label="เพิ่มเติม" onClick={(e) => { e.stopPropagation(); setFileMenu({ el: e.currentTarget, file: f }); }} sx={{ color: MUTED }}>
            <MoreVert sx={{ fontSize: 19 }} />
          </IconButton>
        </Stack>
      </Stack>
    );
  };

  return (
    <Box>
      {/* ── ตัวเลขตามชนิดเอกสาร — กดเพื่อกรอง (แทนแถวปุ่มเลื่อนแนวนอนที่ซ่อนชนิดอื่นไว้) ── */}
      <KpiRow columns={5}>
        {DOC_TYPES.map((d) => (
          <Kpi key={d.value} label={d.label} value={(counts[d.value] || 0).toLocaleString()} sub="ไฟล์"
            active={docTypeFilter === d.value} onClick={() => setDocTypeFilter(d.value)} />
        ))}
      </KpiRow>

      <FilterBar search={search} onSearch={setSearch} placeholder="ค้นหาชื่อไฟล์ / บริษัท / โครงการ / เลขที่เอกสาร">
        <Box sx={{ width: { xs: "100%", sm: 190 } }}>
          <SelectField fullWidth value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">ทีม/ช่าง: ทุกคน</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectField>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={fetchData} sx={{ ...ICON_BTN_SX, flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }}><Refresh sx={{ fontSize: 20 }} /></IconButton>
        </Tooltip>
      </FilterBar>

      {loading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}

      {!loading && filtered.length === 0 ? (
        <EmptyState icon={<FolderOpen />} title="ไม่พบเอกสาร" hint="เอกสารที่ช่าง/แอดมินอัปโหลดในหน้าการดำเนินงานจะแสดงที่นี่อัตโนมัติ" />
      ) : (
        <Stack spacing={1.5}>
          {pagedGroups.map((grp) => (
            <Panel key={grp.teamName}>
              {/* หัวกลุ่ม: ช่าง/ทีม + จำนวนไฟล์ */}
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: { xs: 1.5, sm: 2 }, py: 1, bgcolor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: "0.8rem", fontWeight: 800, bgcolor: personColor(grp.teamName) }}>{personInitial(grp.teamName)}</Avatar>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: "0.88rem", color: INK }}>{grp.teamName}</Typography>
                <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED }}>{grp.files.length} ไฟล์</Typography>
              </Stack>
              {grp.files.map((f, i) => renderFileRow(f, i))}
            </Panel>
          ))}

          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5}>
            <Box sx={{ width: 130 }}>
              <SelectField fullWidth value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} ไฟล์/หน้า</option>)}
              </SelectField>
            </Box>
            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} shape="rounded" />
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
