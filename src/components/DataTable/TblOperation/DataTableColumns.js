import { useState, useEffect } from "react";
import moment from "moment";

import ResPersonCell from "../components/ResPersonCell"; // ✅ import component

import StatusSelectCell from "./StatusSelectCell"; // ✅ import component
import StatusTwoSelectCell from "./StatusTwoSelectCell"; // ✅ import component
import { useMediaQuery } from "@mui/material";


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

  setConfirmOpen,
  setPendingDelete,

  uploadingState,
  isUploadingState,
  uploadingFileSizeState,

  resPerson,
  currentUserRole,

  onInputUpdate, // ✅ รับจาก parent
}) => {
  const [, setIsSmallScreen] = useState(false);

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




  const isMobile = useMediaQuery("(max-width:600px)");
  const columns = [

        {
      name: "ผู้รับผิดชอบงาน",
      width: "180px",
      cell: (row) => (
        <ResPersonCell
          row={row}
          employee={resPerson}
          onInputUpdate={onInputUpdate}
          currentUserRole={currentUserRole}
        />
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
      name: "วันดำเนินการ",
      width: "165px",

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
    //   name: "URL เอกสาร",
    //   width: "250px",
    //   cell: (row) => <DocNoCell row={row} onDocNoUpdate={onDocNoUpdate} />,
    // }




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
    //    {
    //   name: "กรอกข้อมูล",
    //   width: "220px",
    //   sortable: false,
    //   cell: (row) => (
    //     <input
    //       type="text"
    //       placeholder="กรอกข้อมูลที่ต้องการ..."
    //       value={row.inputValue || ""}
    //       onChange={(e) => onInputUpdate(row.id, e.target.value)}
    //       style={{
    //         width: "100%",
    //         padding: "6px",
    //         border: "1px solid #ccc",
    //         borderRadius: "4px",
    //       }}
    //     />
    //   ),
    // }

    {
      name: "เสนอราคาเพิ่มเติม",
      width: "210px",
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
      width: "210px",
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
    // {
    //   name: "Action",
    //   width: "80px",
    //   cell: (row) => (
    //     <div>
    //       <IconButton
    //         id="demo-customized-button"
    //         aria-controls={open ? "demo-customized-menu" : undefined}
    //         aria-haspopup="true"
    //         aria-expanded={open ? "true" : undefined}
    //         onClick={(event) => handleClick(event, row)}
    //       >
    //         <MoreVertIcon />
    //       </IconButton>

    //       <StyledMenu
    //         id="demo-customized-menu"
    //         MenuListProps={{ "aria-labelledby": "demo-customized-button" }}
    //         anchorEl={anchorEl}
    //         open={open && selectedRowMenu === row}
    //         onClose={handleClose}
    //       >
    //         <MenuItem
    //           onClick={() => {
    //             setModalOpenEdit(true);
    //             handleClose();
    //           }}
    //         >
    //           <EditIcon />
    //           แก้ไข
    //         </MenuItem>
    //         <MenuItem
    //           onClick={() => {
    //             handleDeleteRow(row._id);
    //             handleClose();
    //           }}
    //         >
    //           <Delete />
    //           ลบ
    //         </MenuItem>
    //         <MenuItem onClick={handleClose} disableRipple>
    //           <MoreHorizIcon />
    //           เพิ่มเติม
    //         </MenuItem>
    //       </StyledMenu>
    //     </div>
    //   ),
    // },
  ];

  return columns;
};

export default DataTableColumns;
