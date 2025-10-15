import { useState, useEffect } from "react";
import moment from "moment";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import Delete from "@mui/icons-material/Delete";

import { useMediaQuery } from "@mui/material";

import { useTheme } from "@mui/material/styles";

import StyledMenu from "../components/StyledMenu";

import DocumentCell from "../components/DocumentCell";

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
  disableUpload,
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
    {
      name: "เลขที่เอกสาร",
      sortable: true,
      width: "115px",
      selector: (row) => row.docNo || "-",
      cell: (row) => (
        <div style={{ fontSize: "0.85em", color: "#333" }}>
          {row.docNo || <span style={{ color: "#bbb" }}>ไม่ระบุ</span>}
        </div>
      ),
    },

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
      name: "เสนอราคาเพิ่มเติม",
      width: "150px",
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
          disableUpload={true} // ✅ ปิด input และปุ่มอัปโหลด
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
      name: "อนุมัติแล้ว",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="trackStatusConfirm"
          label="อัปโหลดหลักฐานการติตามลูกค้า"
          color="info"
          fileNameField="trackStatusConfirmFileName"
          fileUrlField="trackStatusConfirmFileUrl"
          fileTypeField="trackStatusConfirmFileType"
          sentField="trackStatusConfirm"
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
      name: "ติดตามครั้งที่ 1",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="trackStatus1"
          label="อัปโหลดหลักฐานการติตามลูกค้า"
          color="info"
          fileNameField="trackStatus1FileName"
          fileUrlField="trackStatus1FileUrl"
          fileTypeField="trackStatus1FileType"
          sentField="trackStatus1"
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
      name: "ติดตามครั้งที่ 2",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="trackStatus2"
          label="อัปโหลดหลักฐานการติตามลูกค้า"
          color="info"
          fileNameField="trackStatus2FileName"
          fileUrlField="trackStatus2FileUrl"
          fileTypeField="trackStatus2FileType"
          sentField="trackStatus2"
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
      name: "ติดตามครั้งที่ 3",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="trackStatus3"
          label="อัปโหลดหลักฐานการติตามลูกค้า"
          color="info"
          fileNameField="trackStatus3FileName"
          fileUrlField="trackStatus3FileUrl"
          fileTypeField="trackStatus3FileType"
          sentField="trackStatus3"
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
      name: "ติดตามครั้งที่ 4 ",
      width: "200px",
      sortable: false,
      cell: (row) => (
        <DocumentCell
          row={row}
          type="trackStatus4"
          label="อัปโหลดหลักฐานการติตามลูกค้า"
          color="info"
          fileNameField="trackStatus4FileName"
          fileUrlField="trackStatus4FileUrl"
          fileTypeField="trackStatus4FileType"
          sentField="trackStatus4"
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
