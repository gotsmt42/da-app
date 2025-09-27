import { useState, useEffect } from "react";
import moment from "moment";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { styled } from "@mui/material/styles";
import Delete from "@mui/icons-material/Delete";
import EventService from "../../../services/EventService";

import StatusSelectCell from "./StatusSelectCell"; // ✅ import component
import StatusTwoSelectCell from "./StatusTwoSelectCell"; // ✅ import component
import StatusThreeSelectCell from "./StatusThreeSelectCell"; // ✅ import component
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  useMediaQuery,
} from "@mui/material";

import Checkbox from "@mui/material/Checkbox";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip"; // อย่าลืม import
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";

import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import {
  CheckCircle,
  Slideshow,
  TableChart,
  TextSnippet,
} from "@mui/icons-material";

const StyledMenu = styled((props) => (
  <Menu
    elevation={0}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    transformOrigin={{ vertical: "top", horizontal: "right" }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color:
      theme.palette.mode === "light"
        ? "rgb(55, 65, 81)"
        : theme.palette.grey[300],
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
    "& .MuiMenu-list": {
      padding: "4px 0",
    },
    "& .MuiMenuItem-root": {
      "& .MuiSvgIcon-root": {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
      },
    },
  },
}));

const DataTableColumns = ({
  setSelectedRow,
  setEditedData,
  setModalOpenEdit,
  handleDeleteRow,
  setSelectedFile,
  onStatusUpdate, // ✅ รับจาก parent
  onDocNoUpdate,
  onFileUpload,
  handleDeleteFile,
  setPreviewUrl,
  setPreviewFileName,

  setConfirmOpen,
  setPendingDelete,

  uploadingFileName,
  uploadingFileSize,
  uploadProgress,
  uploadingId,
  isUploading,
  isUploadSuccess,
  uploadingState,
  isUploadingState,
  uploadingFileSizeState,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [selectedRowMenu, setSelectedRowMenu] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleClick = (event, row) => {
    setSelectedRowMenu(row);
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
    setEditedData(row);
  };

  const handleClose = () => {
    setSelectedRowMenu(null);
    setAnchorEl(null);
    setSelectedFile(null);
  };
  const getFileIcon = (type = "") => {
    if (!type || typeof type !== "string")
      return <AttachFileIcon fontSize="small" sx={{ color: "#888" }} />;

    const lowerType = type.toLowerCase();

    // PDF
    if (lowerType.includes("pdf") || lowerType.endsWith(".pdf"))
      return <PictureAsPdfIcon fontSize="small" sx={{ color: "#d32f2f" }} />;

    // Word
    if (
      lowerType.includes("word") ||
      lowerType.includes("doc") ||
      lowerType.includes("msword") ||
      lowerType.includes("officedocument.wordprocessingml.document") ||
      lowerType.endsWith(".doc") ||
      lowerType.endsWith(".docx")
    )
      return <DescriptionIcon fontSize="small" sx={{ color: "#1976d2" }} />;

    // Excel
    if (
      lowerType.includes("excel") ||
      lowerType.includes("spreadsheet") ||
      lowerType.includes("officedocument.spreadsheetml.sheet") ||
      lowerType.endsWith(".xls") ||
      lowerType.endsWith(".xlsx")
    )
      return <TableChart fontSize="small" sx={{ color: "#2e7d32" }} />;

    // PowerPoint
    if (
      lowerType.includes("powerpoint") ||
      lowerType.includes("presentation") ||
      lowerType.includes("officedocument.presentationml.presentation") ||
      lowerType.endsWith(".ppt") ||
      lowerType.endsWith(".pptx")
    )
      return <Slideshow fontSize="small" sx={{ color: "#e65100" }} />;

    // Text
    if (
      lowerType.includes("text") ||
      lowerType.includes("plain") ||
      lowerType.endsWith(".txt")
    )
      return <TextSnippet fontSize="small" sx={{ color: "#6d4c41" }} />;

    // Image
    if (
      lowerType.includes("image") ||
      lowerType.endsWith(".jpg") ||
      lowerType.endsWith(".jpeg") ||
      lowerType.endsWith(".png") ||
      lowerType.endsWith(".webp")
    )
      return <ImageIcon fontSize="small" sx={{ color: "#388e3c" }} />;

    // Default
    return <AttachFileIcon fontSize="small" sx={{ color: "#888" }} />;
  };

  const isMobile = useMediaQuery("(max-width:600px)");
  const theme = useTheme();
  const columns = [
    {
      name: "วันดำเนินการ",
      width: "130px",

      sortable: true,
      sortFunction: (a, b) => new Date(a.start) - new Date(b.start),

      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.9em", color: "#333" }}>
            <span>
              {moment(row.start).format("DD")} {" - "}{" "}
              {moment(row.end).format("DD/MM/YYYY")}
            </span>     
            
            {/* <span>
              {moment(row.start).format("DD")} {" - "}{" "}
              {moment(row.end).format("DD")}
            </span> */}
            {/* {" - "}
            <span>
              {moment(row.end).subtract(1, "days").format("DD/MM/YYYY")}
            </span> */}
          </div>
        </div>
      ),
    },
    // {
    //   name: "เลขที่เอกสาร",
    //   sortable: true,
    //   width: "115px",
    //   selector: (row) => row.docNo || "-",
    //   cell: (row) => (
    //     <div style={{ fontSize: "0.85em", color: "#333" }}>
    //       {row.docNo || <span style={{ color: "#bbb" }}>ไม่ระบุ</span>}
    //     </div>
    //   ),
    // },

    {
      name: "งาน / โครงการ",

      width: isMobile ? "200px" : "200px", // ✅ ปรับขนาดตามหน้าจอ

      sortable: true,
      sortFunction: (a, b) => new Date(a.start) - new Date(b.start),
      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.8em", color: "#888" }}>
            [{row.title}] - {row.system} - ครั้งที่ {row.time}
          </div>
          <div>{row.site}</div>
        </div>
      ),
    },
    {
      name: "การดำเนินการ",
      sortable: true,
      width: "182px",
      // omit: isMobile, // ซ่อนไปถ้าเป็นมือถือ

      selector: (row) => row.status,
      cell: (row) => (
        <StatusSelectCell row={row} onStatusUpdate={onStatusUpdate} />
      ),
    },

    // Status 2
    {
      name: <div style={{ textAlign: "center", width: "100%" }}>สถานะ</div>,
      sortable: true,
      // omit: isMobile,
      width: "150px",
      selector: (row) => row.status,
      cell: (row) => (
        <StatusTwoSelectCell row={row} onStatusUpdate={onStatusUpdate} />
      ),
    },
    {
      name: "อัพโหลดไฟล์",
      width: "160px",
      sortable: false,
      cell: (row) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* ✅ ปุ่มแนบไฟล์ */}
          <Tooltip title="อัพโหลดไฟล์" arrow>
            <IconButton component="label" size="small" color="info">
              <AttachFileIcon fontSize="small" />
              <input
                type="file"
                hidden
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && typeof onFileUpload === "function") {
                    setSelectedFile(file);
                    onFileUpload(file, row._id, "status");
                  }
                }}
              />
            </IconButton>
          </Tooltip>

          {/* ✅ หลอดโหลด */}
          {uploadingState.status === row._id && (
            <Box
              sx={{
                minWidth: "90px",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              {uploadingFileSizeState.status && (
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  Size: {uploadingFileSizeState.status}
                </Typography>
              )}
              {isUploadingState.status && (
                <LinearProgress
                  variant="indeterminate"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              )}
            </Box>
          )}

          {/* ✅ ปุ่มดูไฟล์ */}
          {row.statusFileName && row.statusFileUrl && (
            <Tooltip title={row.statusFileName} arrow>
              <Button
                size="small"
                onClick={() => {
                  setPreviewUrl(row.statusFileUrl);
                  setPreviewFileName(row.statusFileName);
                }}
                style={{
                  fontSize: "0.75em",
                  color: "#007bff",
                  textTransform: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ minWidth: "20px" }}>
                  {getFileIcon(row.statusFileType || "")}
                </span>
                ดูไฟล์
              </Button>
            </Tooltip>
          )}

          {/* ✅ ปุ่มลบไฟล์ */}
          {row.statusFileName && row.statusFileUrl && (
            <Tooltip title="ลบไฟล์" arrow>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setPendingDelete({ id: row._id, type: "status" });
                    setConfirmOpen(true);
                  }}
                  sx={{
                    padding: "2px",
                    backgroundColor: "transparent",
                    border: "none",
                    "&:hover": {
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      name: "เสนอราคาเพิ่มเติม",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Checkbox
            checked={Boolean(row.documentSentQuotation)} // ✅ ติ๊กไว้ถ้ามีไฟล์หรือสถานะ            disabled={Boolean(row.quotationFileUrl)}
            onChange={(e) => {
              const checked = e.target.checked;
              onStatusUpdate(row._id, { documentSentQuotation: checked });
            }}
            disab
            disabled={Boolean(row.quotationFileUrl)} // ✅ ถ้ามีไฟล์ → ห้ามติ๊กออก
            color="warning"
            sx={{
              "&.Mui-disabled": {
                color: theme.palette.warning.main, // ✅ สีของ check mark เมื่อ disabled
              },
              "&.Mui-disabled .MuiSvgIcon-root": {
                backgroundColor: "#fffde7", // ✅ สีพื้นหลังเมื่อ disabled
                borderRadius: "4px",
                padding: "2px",
              },
              "& .MuiSvgIcon-root": {
                backgroundColor: row.quotationFileUrl ? "#fffde7" : "#eeeeee", // ✅ สีพื้นหลังตามสถานะ
                borderRadius: "4px",
                padding: "2px",
              },
            }}
          />
          {row.documentSentQuotation && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip title="อัปโหลดใบเสนอราคา" arrow>
                <IconButton component="label" size="small" color="warning">
                  <AttachFileIcon fontSize="small" />
                  <input
                    type="file"
                    hidden
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && typeof onFileUpload === "function") {
                        setSelectedFile(file);
                        onFileUpload(file, row._id, "quotation");
                      }
                    }}
                  />
                </IconButton>
              </Tooltip>

              {/* ✅ แสดงหลอดเฉพาะแถวที่กำลังอัปโหลด */}
              {uploadingState.quotation === row._id && (
                <Box
                  sx={{
                    minWidth: "90px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {uploadingFileSizeState.quotation && (
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      Size: {uploadingFileSizeState.quotation}
                    </Typography>
                  )}
                  {isUploadingState.quotation && (
                    <LinearProgress
                      variant="indeterminate"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  )}
                </Box>
              )}
            </Box>
          )}

          {row.quotationFileName && row.quotationFileUrl && (
            <Tooltip title={row.quotationFileName} arrow>
              <Button
                size="small"
                onClick={() => {
                  setPreviewUrl(row.quotationFileUrl);
                  setPreviewFileName(row.quotationFileName);
                }}
                style={{
                  fontSize: "0.75em",
                  color: "#007bff",
                  textTransform: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ minWidth: "20px" }}>
                  {getFileIcon(row.quotationFileType || "")}
                </span>
                ดูไฟล์
              </Button>
            </Tooltip>
          )}

          {row.quotationFileName && row.quotationFileUrl && (
            <Tooltip title="ลบไฟล์" arrow>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  // onClick={() => handleDeleteFile(row._id, "quotation")}

                  onClick={() => {
                    setPendingDelete({ id: row._id, type: "quotation" });
                    setConfirmOpen(true);
                  }}
                  sx={{
                    padding: "2px",
                    backgroundColor: "transparent",
                    border: "none",
                    "&:hover": {
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      name: "รายงาน",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Checkbox
            checked={Boolean(row.documentSentReport)}
            onChange={(e) => {
              const checked = e.target.checked;
              onStatusUpdate(row._id, { documentSentReport: checked });
            }}
            disabled={Boolean(row.reportFileUrl)}
            color="success"
            sx={{
              "&.Mui-disabled": {
                color: "#2e7d32",
              },
              "&.Mui-disabled .MuiSvgIcon-root": {
                backgroundColor: "#e8f5e9",
                borderRadius: "4px",
                padding: "2px",
              },
              "& .MuiSvgIcon-root": {
                backgroundColor: row.reportFileUrl ? "#e8f5e9" : "#eeeeee",
                borderRadius: "4px",
                padding: "2px",
              },
            }}
          />

          {row.documentSentReport && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip title="อัปโหลดรายงาน" arrow>
                <IconButton component="label" size="small" color="success">
                  <AttachFileIcon fontSize="small" />
                  <input
                    type="file"
                    hidden
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && typeof onFileUpload === "function") {
                        setSelectedFile(file);
                        onFileUpload(file, row._id, "report");
                      }
                    }}
                  />
                </IconButton>
              </Tooltip>

              {/* ✅ แสดงหลอดเฉพาะแถวที่กำลังอัปโหลด */}
              {uploadingState.report === row._id && (
                <Box
                  sx={{
                    minWidth: "90px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {uploadingFileSizeState.report && (
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      Size: {uploadingFileSizeState.report}
                    </Typography>
                  )}
                  {isUploadingState.report && (
                    <LinearProgress
                      variant="indeterminate"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  )}
                </Box>
              )}
            </Box>
          )}

          {row.reportFileName && row.reportFileUrl && (
            <Tooltip title={row.reportFileName} arrow>
              <Button
                size="small"
                onClick={() => {
                  setPreviewUrl(row.reportFileUrl);
                  setPreviewFileName(row.reportFileName);
                }}
                style={{
                  fontSize: "0.75em",
                  color: "#007bff",
                  textTransform: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ minWidth: "20px" }}>
                  {getFileIcon(row.reportFileType || "")}
                </span>
                ดูไฟล์
              </Button>
            </Tooltip>
          )}

          {row.reportFileName && row.reportFileUrl && (
            <Tooltip title="ลบไฟล์" arrow>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setPendingDelete({ id: row._id, type: "report" });
                    setConfirmOpen(true);
                  }}
                  sx={{
                    padding: "2px",
                    backgroundColor: "transparent",
                    border: "none",
                    "&:hover": {
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      name: "Action",
      width: "80px",
      cell: (row) => (
        <div>
          <IconButton
            id="demo-customized-button"
            aria-controls={open ? "demo-customized-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            onClick={(event) => handleClick(event, row)}
          >
            <MoreVertIcon />
          </IconButton>

          <StyledMenu
            id="demo-customized-menu"
            MenuListProps={{ "aria-labelledby": "demo-customized-button" }}
            anchorEl={anchorEl}
            open={open && selectedRowMenu === row}
            onClose={handleClose}
          >
            <MenuItem
              onClick={() => {
                setModalOpenEdit(true);
                handleClose();
              }}
            >
              <EditIcon />
              แก้ไข
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleDeleteRow(row._id);
                handleClose();
              }}
            >
              <Delete />
              ลบ
            </MenuItem>
            <MenuItem onClick={handleClose} disableRipple>
              <MoreHorizIcon />
              เพิ่มเติม
            </MenuItem>
          </StyledMenu>
        </div>
      ),
    },
  ];

  return columns;
};

export default DataTableColumns;
