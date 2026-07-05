import React from "react";
import { Link } from "react-router-dom";
import { Box, Stack, Typography, IconButton, Tooltip } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";

import FileUploadComponent from "../../components/File/FileUpload";

const FileUpload = () => {
  return (
    <div className="container-sm mt-4 mb-5">
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Tooltip title="กลับไปหน้าไฟล์">
          <IconButton component={Link} to="/files" size="small">
            <ArrowBack fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            อัพโหลดไฟล์ใหม่
          </Typography>
          <Typography variant="caption" color="text.secondary">
            สำหรับไฟล์ทั่วไป — เอกสารประจำงาน (Service Report ฯลฯ) แนบได้ที่หน้าดำเนินงานของแต่ละงาน
          </Typography>
        </Box>
      </Stack>
      <FileUploadComponent />
    </div>
  );
};

export default FileUpload;
