import { useState, useEffect } from "react";
import moment from "moment";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
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

import AttachFileIcon from "@mui/icons-material/AttachFile";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip"; // อย่าลืม import

import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";

import { getFileIcon } from "../../../utils/getFileIcon";

import StyledMenu from "../components/StyledMenu";

import DocumentCell from "../components/DocumentCell";

import StatusFileCell from "../components/StatusFileCell";

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

  const isMobile = useMediaQuery("(max-width:600px)");
  const columns = [
    {
      name: "วันดำเนินการ",
      width: "150px",

      sortable: true,
      sortFunction: (a, b) => new Date(a.start) - new Date(b.start),

      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.9em", color: "#333" }}>
            <span>
              {moment(row.start).isSame(
                moment(row.end).clone().subtract(1, "day"),
                "day"
              ) ? (
                <>
                  {moment(row.start).format("DD")}{" "}
                  <span style={{ color: "#888" }}>
                    {moment(row.start).format("MMMM YYYY")}
                  </span>
                </>
              ) : (
                <>
                  {moment(row.start).format("DD")} –{" "}
                  {moment(row.end).clone().subtract(1, "day").format("DD")}{" "}
                  <span style={{ color: "#888" }}>
                    {moment(row.start).format("MMMM YYYY")}
                  </span>
                </>
              )}
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
      width: "220px",
      sortable: false,
      cell: (row) => (
        <StatusFileCell
          row={row}
          onFileUpload={onFileUpload}
          setSelectedFile={setSelectedFile}
          setPreviewUrl={setPreviewUrl}
          setPreviewFileName={setPreviewFileName}
          setPendingDelete={setPendingDelete}
          setConfirmOpen={setConfirmOpen}
          uploadingState={uploadingState}
          isUploadingState={isUploadingState}
          uploadingFileSizeState={uploadingFileSizeState}
        />
      ),
    },
    {
      name: "เสนอราคาเพิ่มเติม",
      width: "220px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="quotation"
          label="อัปโหลดใบเสนอราคา"
          color="warning"
          fileNameField="quotationFileName"
          fileUrlField="quotationFileUrl"
          fileTypeField="quotationFileType"
          sentField="documentSentQuotation"
          {...{
            onStatusUpdate,
            onFileUpload,
            setSelectedFile,
            setPreviewUrl,
            setPreviewFileName,
            setPendingDelete,
            setConfirmOpen,
            uploadingState,
            isUploadingState,
            uploadingFileSizeState,
          }}
        />
      ),
    },
    {
      name: "รายงาน",
      width: "220px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="report"
          label="อัปโหลดรายงาน"
          color="success"
          fileNameField="reportFileName"
          fileUrlField="reportFileUrl"
          fileTypeField="reportFileType"
          sentField="documentSentReport"
          {...{
            onStatusUpdate,
            onFileUpload,
            setSelectedFile,
            setPreviewUrl,
            setPreviewFileName,
            setPendingDelete,
            setConfirmOpen,
            uploadingState,
            isUploadingState,
            uploadingFileSizeState,
          }}
        />
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
