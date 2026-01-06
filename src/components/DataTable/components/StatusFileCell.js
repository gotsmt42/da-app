import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import { getFileIcon } from "../../../utils/getFileIcon"; // ✅ ปรับ path ตามโปรเจกต์

const StatusFileCell = ({
  type,
  color,
  row,
  onFileUpload,
  setSelectedFile,
  setPreviewUrl,
  setPreviewFileName,
  setPendingDelete,
  setConfirmOpen,
  uploadingState,
  isUploadingState,
  uploadingFileSizeState,
}) => {
  const hasFile = Boolean(row.statusFileName && row.statusFileUrl);

  const isAnyUploading = Object.values(isUploadingState).some(
    (v) => v === true
  );

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {/* ✅ ปุ่มแนบไฟล์ */}
      <Tooltip title="อัพโหลดไฟล์" arrow>
        <IconButton
          component="label"
          size="small"
          color={color}
          disabled={isAnyUploading} // ✅ ปิดทุกปุ่มขณะอัปโหลด
        >
          <AttachFileIcon fontSize="small" />
          <input
            type="file"
            hidden
            multiple={false}
            disabled={isAnyUploading} // ✅ ปิด input ทุกตัว
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
      {hasFile && (
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
      {hasFile && (
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
  );
};

export default StatusFileCell;
