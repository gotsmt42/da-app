import {
  Box,
  Button,
  Checkbox,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import { getFileIcon } from "../../../utils/getFileIcon"; // ✅ ปรับ path ตามโปรเจกต์

const DocumentCell = ({
  row,
  type, // "quotation" หรือ "report"
  label, // ชื่อที่แสดง เช่น "อัปโหลดใบเสนอราคา"
  color, // สีหลัก เช่น "warning", "success"
  fileNameField,
  fileUrlField,
  fileTypeField,
  sentField,
  uploadingState,
  isUploadingState,
  uploadingFileSizeState,
  onStatusUpdate,
  onFileUpload,
  setSelectedFile,
  setPreviewUrl,
  setPreviewFileName,
  setPendingDelete,
  setConfirmOpen,
  disableUpload,
}) => {
  const hasFile = Boolean(row[fileUrlField]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Checkbox
        checked={hasFile || Boolean(row[sentField])} // ✅ ติ๊กอัตโนมัติถ้ามีไฟล์ หรือถ้าผู้ใช้เคยติ๊กไว้
        onChange={(e) => {
          const checked = e.target.checked;
          onStatusUpdate(row._id, { [sentField]: checked });
        }}
        disabled={hasFile} // ✅ ถ้ามีไฟล์ → ห้ามแก้ไข
        color={color}
        sx={{
          "&.Mui-disabled": {
            color: (theme) => theme.palette[color].main,
          },
          "&.Mui-disabled .MuiSvgIcon-root": {
            backgroundColor: color === "warning" ? "#fffde7" : "#e8f5e9",
            borderRadius: "4px",
            padding: "2px",
          },
          "& .MuiSvgIcon-root": {
            backgroundColor: hasFile ? "#fffde7" : "#eeeeee",
            borderRadius: "4px",
            padding: "2px",
          },
        }}
      />

      {!disableUpload && (sentField ? row[sentField] : true) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title={label} arrow>
            <IconButton
              component="label"
              size="small"
              color={color}
              disabled={isUploadingState[type]}
            >
              <AttachFileIcon fontSize="small" />
              <input
                type="file"
                hidden
                multiple={false} // ✅ จำกัดให้เลือกได้แค่ไฟล์เดียว
                disabled={isUploadingState[type]} // ✅ ปิด input ขณะอัปโหลด
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && typeof onFileUpload === "function") {
                    setSelectedFile(file);
                    onFileUpload(file, row._id, type);
                  }
                }}
              />
            </IconButton>
          </Tooltip>

          {uploadingState[type] === row._id && (
            <Box
              sx={{
                minWidth: "90px",
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              {uploadingFileSizeState[type] && (
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  Size: {uploadingFileSizeState[type]}
                </Typography>
              )}
              {isUploadingState[type] && (
                <LinearProgress
                  variant="indeterminate"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              )}
            </Box>
          )}
        </Box>
      )}

      {row[fileNameField] && row[fileUrlField] && (
        <Tooltip title={row[fileNameField]} arrow>
          <Button
            size="small"
            onClick={() => {
              setPreviewUrl(row[fileUrlField]);
              setPreviewFileName(row[fileNameField]);
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
              {getFileIcon(row[fileTypeField] || "")}
            </span>
            ดูไฟล์
          </Button>
        </Tooltip>
      )}

      {!disableUpload && row[fileNameField] && row[fileUrlField] && (
        <Tooltip title="ลบไฟล์" arrow>
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setPendingDelete({ id: row._id, type });
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
  );
};

export default DocumentCell;
