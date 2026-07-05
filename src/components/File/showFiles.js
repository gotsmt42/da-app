import { useState, useEffect, useRef, useMemo } from "react";
import FileService from "../../services/FileService";
import AuthService from "../../services/authService";
import Swal from "sweetalert2";

import moment from "moment";
import { Link } from "react-router-dom";
import ServiceReportFiles from "./ServiceReportFiles";
import API from "../../API/axiosInstance";

import {
  Box,
  Paper,
  Tabs,
  Tab,
  Grid,
  Checkbox,
  Chip,
  IconButton,
  InputBase,
  TextField,
  Avatar,
  Tooltip,
  Skeleton,
  Button,
  Pagination,
  Stack,
  Typography,
  Fade,
} from "@mui/material";

import Add from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import Description from "@mui/icons-material/Description";
import FolderOpen from "@mui/icons-material/FolderOpen";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import ImageIcon from "@mui/icons-material/Image";
import ArticleIcon from "@mui/icons-material/Article";
import ArchiveIcon from "@mui/icons-material/Archive";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";

// ---- Design tokens -------------------------------------------------------
const COLOR = {
  bg: "#F6F5F1",
  surface: "#FFFFFF",
  ink: "#20242B",
  sub: "#6C7278",
  line: "#E7E4DC",
  accent: "#3C6659", // deep teal — document/archive feel
  accentSoft: "#E4ECE8",
  accentDeep: "#2A4A40",
  danger: "#B5453A",
  dangerSoft: "#F5E6E3",
  gold: "#B08B3F",
};

const FONT_DISPLAY = `"IBM Plex Sans Thai", "IBM Plex Sans", "Noto Sans Thai", sans-serif`;
const FONT_UI = `"Noto Sans Thai", "IBM Plex Sans", sans-serif`;
const FONT_MONO = `"IBM Plex Mono", ui-monospace, monospace`;

// ---- File-type visual language ------------------------------------------
const fileVisual = (filename = "") => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext))
    return { icon: PictureAsPdfIcon, color: "#B5453A", label: "PDF" };
  if (["xls", "xlsx", "csv"].includes(ext))
    return { icon: TableChartIcon, color: "#3C7A52", label: ext.toUpperCase() };
  if (["doc", "docx"].includes(ext))
    return { icon: ArticleIcon, color: "#2E5F9E", label: ext.toUpperCase() };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return { icon: ImageIcon, color: "#B08B3F", label: ext.toUpperCase() };
  if (["zip", "rar", "7z"].includes(ext))
    return { icon: ArchiveIcon, color: "#6C7278", label: ext.toUpperCase() };
  return { icon: InsertDriveFileIcon, color: "#6C7278", label: ext.toUpperCase() || "FILE" };
};

const PAGE_SIZE = 8;

const ShowFiles = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [files, setFiles] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingRowId, setEditingRowId] = useState(null);
  const [editedName, setEditedName] = useState("");

  const dateInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await FileService.getUserFiles();
      setFiles(res.userFiles || []);
      setSelectedRows([]);
      setSearch("");
      setDateSearch("");
      setPage(1);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Derived filtering (single pass, replaces the old 3 useEffects) ---
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const us = userSearch.toLowerCase();
    return files.filter((file) => {
      const fileName = file.filename?.toLowerCase() || "";
      const updated = moment(file.updatedAt).format("YYYY-MM-DD HH:mm:ss");
      const category = (file.category || "").toLowerCase();
      const username = file.user?.username?.toLowerCase() || "";

      const matchesSearch = s === "" || fileName.includes(s) || updated.includes(s);
      const matchesUser = us === "" || username.includes(us);
      const matchesCategory = categorySearch === "" || category.includes(categorySearch.toLowerCase());
      const matchesDate = dateSearch === "" || updated.includes(dateSearch);

      return matchesSearch && matchesUser && matchesCategory && matchesDate;
    });
  }, [files, search, userSearch, categorySearch, dateSearch]);

  const sortedData = useMemo(
    () => filtered.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [filtered]
  );

  const pageCount = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pagedData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const uniqueUser = [...new Set(files.map((f) => f.user?.username).filter(Boolean))];
  const uniqueCategory = [
    ...new Set(
      files
        .map((f) => f.category)
        .filter((cat) => cat && cat !== "uncategorized" && cat.trim() !== "")
    ),
  ];

  const clearFilters = () => {
    setSearch("");
    setUserSearch("");
    setCategorySearch("");
    setDateSearch("");
    if (dateInputRef.current) dateInputRef.current.value = "";
  };

  const hasActiveFilters = search || userSearch || categorySearch || dateSearch;

  // ---- Selection ----------------------------------------------------------
  const isSelected = (id) => selectedRows.some((r) => r._id === id);

  const toggleSelect = (file) => {
    setSelectedRows((prev) =>
      isSelected(file._id) ? prev.filter((r) => r._id !== file._id) : [...prev, file]
    );
  };

  const toggleSelectAllOnPage = () => {
    const allSelected = pagedData.every((f) => isSelected(f._id));
    if (allSelected) {
      setSelectedRows((prev) => prev.filter((r) => !pagedData.some((f) => f._id === r._id)));
    } else {
      const merged = [...selectedRows];
      pagedData.forEach((f) => {
        if (!isSelected(f._id)) merged.push(f);
      });
      setSelectedRows(merged);
    }
  };

  // ---- Delete ---------------------------------------------------------------
  const swalDelete = () =>
    Swal.fire({
      title: "ยืนยันการลบไฟล์?",
      text: "ไฟล์ที่ถูกลบจะไม่สามารถกู้คืนได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบไฟล์",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: COLOR.danger,
    });

  const handleDelete = async () => {
    if (selectedRows.length === 0) return;
    const result = await swalDelete();
    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      await Promise.all(
        selectedRows.map((row) =>
          FileService.deleteFile(row._id).catch((e) => console.error("Error deleting file:", e))
        )
      );
      setSelectedRows([]);
      await fetchData();
      Swal.fire("ลบไฟล์สำเร็จ", "", "success");
    } catch (error) {
      console.error("Error deleting files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRow = async (rowId) => {
    const result = await swalDelete();
    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      await FileService.deleteFile(rowId);
      await fetchData();
      Swal.fire("ลบไฟล์สำเร็จ", "", "success");
    } catch (error) {
      console.error("Error deleting file:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Download ---------------------------------------------------------------
  const downloadFile = async (fileUrl, fileName) => {
    try {
      const userData = await AuthService.getUserData();
      const downloadUrl = fileUrl.startsWith("http")
        ? fileUrl
        : `${API.defaults.baseURL.replace(/\/api$/, "")}${fileUrl}`;

      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${userData.token}` },
      });
      if (!response.ok) throw new Error("Failed to download file");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      Swal.fire("ดาวน์โหลดไฟล์ไม่สำเร็จ", "", "error");
    }
  };

  const handleDownload = async () => {
    if (selectedRows.length === 0) {
      Swal.fire("ยังไม่ได้เลือกไฟล์", "กรุณาเลือกไฟล์ที่ต้องการดาวน์โหลด", "warning");
      return;
    }
    const result = await Swal.fire({
      title: "ยืนยันการดาวน์โหลด?",
      text: `คุณต้องการดาวน์โหลด ${selectedRows.length} ไฟล์ใช่หรือไม่`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ดาวน์โหลด",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: COLOR.accent,
    });
    if (!result.isConfirmed) return;

    Swal.fire({
      title: "กำลังดาวน์โหลด...",
      html: `
        <div style="width:100%;background:${COLOR.line};border-radius:6px;overflow:hidden;">
          <div id="progress-bar" style="width:0%;height:10px;background:${COLOR.accent};"></div>
        </div>
        <p id="progress-text" style="margin-top:10px;">0 / ${selectedRows.length} ไฟล์</p>
      `,
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        let completed = 0;
        selectedRows.forEach((row, index) => {
          setTimeout(async () => {
            try {
              await downloadFile(row.url, row.filename);
            } catch (e) {
              console.error(e);
            }
            completed++;
            const percent = Math.round((completed / selectedRows.length) * 100);
            const bar = Swal.getHtmlContainer()?.querySelector("#progress-bar");
            const text = Swal.getHtmlContainer()?.querySelector("#progress-text");
            if (bar) bar.style.width = percent + "%";
            if (text) text.textContent = `${completed} / ${selectedRows.length} ไฟล์`;
            if (completed === selectedRows.length) {
              Swal.fire("ดาวน์โหลดเสร็จสิ้น!", "", "success");
            }
          }, index * 500);
        });
      },
    });
  };

  // ---- Inline rename ---------------------------------------------------------------
  const startEdit = (file) => {
    setEditingRowId(file._id);
    setEditedName(file.filename);
  };

  const cancelEdit = () => {
    setEditingRowId(null);
    setEditedName("");
  };

  const handleInlineEdit = async (fileId, newName) => {
    if (!newName.trim()) {
      Swal.fire("ชื่อไฟล์ไม่ถูกต้อง", "กรุณาใส่ชื่อไฟล์", "warning");
      return;
    }
    try {
      await FileService.updateFile(fileId, { filename: newName });
      await fetchData();
    } catch (error) {
      Swal.fire("แก้ไขชื่อไฟล์ไม่สำเร็จ", "", "error");
    } finally {
      cancelEdit();
    }
  };

  const allOnPageSelected = pagedData.length > 0 && pagedData.every((f) => isSelected(f._id));

  return (
    <Box sx={{ fontFamily: FONT_UI, color: COLOR.ink }}>
      {/* Section tabs */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, mb: 2.5, overflow: "hidden", borderColor: COLOR.line }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ style: { backgroundColor: COLOR.accent, height: 3 } }}
          sx={{
            px: 1,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              minHeight: 54,
              fontFamily: FONT_UI,
              color: COLOR.sub,
            },
            "& .Mui-selected": { color: `${COLOR.accentDeep} !important` },
          }}
        >
          <Tab icon={<FolderOpen sx={{ fontSize: 20 }} />} iconPosition="start" label="ไฟล์ทั่วไป" />
          <Tab
            icon={<Description sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="เอกสารประจำงาน (Service Report)"
          />
        </Tabs>
      </Paper>

      {activeTab === 1 ? (
        <ServiceReportFiles />
      ) : (
        <Box>
          {/* Toolbar */}
          <Paper
            variant="outlined"
            sx={{ p: 2, borderRadius: 3, mb: 2.5, borderColor: COLOR.line, bgcolor: COLOR.surface }}
          >
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    bgcolor: COLOR.bg,
                    borderRadius: 2.5,
                    px: 1.5,
                    py: 0.75,
                    border: `1px solid ${COLOR.line}`,
                  }}
                >
                  <SearchIcon sx={{ fontSize: 20, color: COLOR.sub, mr: 1 }} />
                  <InputBase
                    fullWidth
                    placeholder="ค้นหาชื่อไฟล์หรือวันที่แก้ไข..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ fontFamily: FONT_UI, fontSize: 14 }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  SelectProps={{ native: true }}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: COLOR.bg },
                  }}
                >
                  <option value="">อัปโหลดโดย (ทั้งหมด)</option>
                  {uniqueUser.map((username, idx) => {
                    const userFile = files.find((f) => f.user?.username === username);
                    return (
                      <option key={idx} value={username}>
                        {userFile?.user?.fname} {userFile?.user?.lname}
                      </option>
                    );
                  })}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  inputRef={dateInputRef}
                  onChange={(e) => setDateSearch(e.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: COLOR.bg },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3} sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" }, gap: 1 }}>
                {hasActiveFilters && (
                  <Button
                    onClick={clearFilters}
                    size="small"
                    sx={{ color: COLOR.sub, textTransform: "none", fontFamily: FONT_UI }}
                  >
                    ล้างตัวกรอง
                  </Button>
                )}
                <Button
                  component={Link}
                  to="/fileupload"
                  variant="contained"
                  startIcon={<Add />}
                  sx={{
                    bgcolor: COLOR.accent,
                    "&:hover": { bgcolor: COLOR.accentDeep },
                    borderRadius: 2.5,
                    textTransform: "none",
                    fontFamily: FONT_UI,
                    fontWeight: 600,
                    boxShadow: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  อัพโหลดไฟล์
                </Button>
              </Grid>
            </Grid>

            {uniqueCategory.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.75, flexWrap: "wrap", rowGap: 1 }}>
                <Chip
                  label="ทั้งหมด"
                  onClick={() => setCategorySearch("")}
                  size="small"
                  sx={{
                    fontFamily: FONT_UI,
                    fontWeight: 600,
                    bgcolor: categorySearch === "" ? COLOR.accentDeep : COLOR.bg,
                    color: categorySearch === "" ? "#fff" : COLOR.sub,
                  }}
                />
                {uniqueCategory.slice(0, 10).map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    onClick={() => setCategorySearch(cat)}
                    size="small"
                    sx={{
                      fontFamily: FONT_UI,
                      fontWeight: 500,
                      bgcolor: categorySearch === cat ? COLOR.accentSoft : COLOR.bg,
                      color: categorySearch === cat ? COLOR.accentDeep : COLOR.sub,
                      border: categorySearch === cat ? `1px solid ${COLOR.accent}` : "1px solid transparent",
                    }}
                  />
                ))}
              </Stack>
            )}
          </Paper>

          {/* Bulk action bar */}
          <Fade in={selectedRows.length > 0}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                mb: 2,
                borderRadius: 3,
                borderColor: COLOR.accent,
                bgcolor: COLOR.accentSoft,
                display: selectedRows.length > 0 ? "flex" : "none",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography sx={{ fontFamily: FONT_UI, fontWeight: 600, color: COLOR.accentDeep, pl: 1 }}>
                เลือกแล้ว {selectedRows.length} ไฟล์
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  sx={{ textTransform: "none", fontFamily: FONT_UI, color: COLOR.accentDeep, fontWeight: 600 }}
                >
                  ดาวน์โหลด
                </Button>
                <Button
                  size="small"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={handleDelete}
                  sx={{ textTransform: "none", fontFamily: FONT_UI, color: COLOR.danger, fontWeight: 600 }}
                >
                  ลบ
                </Button>
                <Button
                  size="small"
                  onClick={() => setSelectedRows([])}
                  sx={{ textTransform: "none", fontFamily: FONT_UI, color: COLOR.sub }}
                >
                  ยกเลิก
                </Button>
              </Stack>
            </Paper>
          </Fade>

          {/* Select-all-on-page row */}
          {pagedData.length > 0 && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, pl: 0.5 }}>
              <Checkbox
                size="small"
                checked={allOnPageSelected}
                onChange={toggleSelectAllOnPage}
                sx={{ color: COLOR.sub, "&.Mui-checked": { color: COLOR.accent } }}
              />
              <Typography sx={{ fontFamily: FONT_UI, fontSize: 13, color: COLOR.sub }}>
                เลือกทั้งหมดในหน้านี้ · พบ {sortedData.length} ไฟล์
              </Typography>
            </Stack>
          )}

          {/* File grid */}
          {loading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                  <Skeleton variant="rounded" height={150} sx={{ borderRadius: 3 }} />
                </Grid>
              ))}
            </Grid>
          ) : pagedData.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                borderColor: COLOR.line,
                py: 8,
                textAlign: "center",
                bgcolor: COLOR.surface,
              }}
            >
              <InventoryOutlinedIcon sx={{ fontSize: 44, color: COLOR.line, mb: 1 }} />
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: COLOR.ink }}>
                ไม่พบไฟล์ที่ตรงกับตัวกรอง
              </Typography>
              <Typography sx={{ fontFamily: FONT_UI, color: COLOR.sub, fontSize: 14, mt: 0.5 }}>
                ลองปรับคำค้นหาหรือล้างตัวกรองดูอีกครั้ง
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {pagedData.map((file) => {
                const visual = fileVisual(file.filename);
                const VisualIcon = visual.icon;
                const selected = isSelected(file._id);
                const isEditing = editingRowId === file._id;

                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={file._id}>
                    <Paper
                      variant="outlined"
                      className="file-card"
                      sx={{
                        p: 1.75,
                        borderRadius: 3,
                        borderColor: selected ? COLOR.accent : COLOR.line,
                        bgcolor: selected ? COLOR.accentSoft : COLOR.surface,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        transition: "box-shadow .15s ease, transform .15s ease",
                        "&:hover": {
                          boxShadow: "0 6px 18px rgba(32,36,43,0.08)",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Checkbox
                            size="small"
                            checked={selected}
                            onChange={() => toggleSelect(file)}
                            sx={{ p: 0.25, color: COLOR.sub, "&.Mui-checked": { color: COLOR.accent } }}
                          />
                          <Avatar
                            variant="rounded"
                            sx={{
                              bgcolor: `${visual.color}1A`,
                              color: visual.color,
                              width: 38,
                              height: 38,
                              borderRadius: 2,
                            }}
                          >
                            <VisualIcon sx={{ fontSize: 20 }} />
                          </Avatar>
                        </Box>
                        <Stack direction="row" spacing={0.25}>
                          {isEditing ? (
                            <>
                              <Tooltip title="บันทึก">
                                <IconButton size="small" onClick={() => handleInlineEdit(file._id, editedName)}>
                                  <CheckIcon sx={{ fontSize: 18, color: COLOR.accent }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="ยกเลิก">
                                <IconButton size="small" onClick={cancelEdit}>
                                  <CloseIcon sx={{ fontSize: 18, color: COLOR.sub }} />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip title="เปลี่ยนชื่อ">
                                <IconButton size="small" onClick={() => startEdit(file)}>
                                  <EditOutlinedIcon sx={{ fontSize: 17, color: COLOR.sub }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="ดาวน์โหลด">
                                <IconButton size="small" onClick={() => downloadFile(file.url, file.filename)}>
                                  <DownloadIcon sx={{ fontSize: 17, color: COLOR.sub }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="ลบไฟล์">
                                <IconButton size="small" onClick={() => handleDeleteRow(file._id)}>
                                  <DeleteOutlineIcon sx={{ fontSize: 17, color: COLOR.danger }} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </Box>

                      {isEditing ? (
                        <TextField
                          size="small"
                          autoFocus
                          fullWidth
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineEdit(file._id, editedName);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontFamily: FONT_UI } }}
                        />
                      ) : (
                        <Tooltip title={file.filename}>
                          <Typography
                            sx={{
                              fontFamily: FONT_UI,
                              fontWeight: 600,
                              fontSize: 14.5,
                              color: COLOR.ink,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {file.filename}
                          </Typography>
                        </Tooltip>
                      )}

                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                        {file.category && file.category !== "uncategorized" && (
                          <Chip
                            label={file.category}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontFamily: FONT_UI,
                              bgcolor: COLOR.accentSoft,
                              color: COLOR.accentDeep,
                            }}
                          />
                        )}
                        <Chip
                          label={visual.label}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 11,
                            fontFamily: FONT_MONO,
                            bgcolor: `${visual.color}14`,
                            color: visual.color,
                          }}
                        />
                      </Stack>

                      <Box sx={{ mt: "auto", pt: 0.5, borderTop: `1px dashed ${COLOR.line}` }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
                          <Avatar sx={{ width: 20, height: 20, fontSize: 11, bgcolor: COLOR.gold }}>
                            {file.user?.fname?.[0] || "?"}
                          </Avatar>
                          <Typography sx={{ fontFamily: FONT_UI, fontSize: 12, color: COLOR.sub }} noWrap>
                            {file.user?.fname} {file.user?.lname}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                          <CalendarTodayOutlinedIcon sx={{ fontSize: 13, color: COLOR.sub }} />
                          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, color: COLOR.sub }}>
                            {moment(file.updatedAt).format("DD/MM/YYYY HH:mm")}
                          </Typography>
                        </Stack>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_, v) => setPage(v)}
                shape="rounded"
                sx={{
                  "& .MuiPaginationItem-root": { fontFamily: FONT_UI },
                  "& .Mui-selected": { bgcolor: `${COLOR.accent} !important`, color: "#fff" },
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ShowFiles;