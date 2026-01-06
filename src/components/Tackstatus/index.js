/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef } from "react";

import EventService from "../../services/EventService";

import Swal from "sweetalert2";

import IconButton from "@mui/material/IconButton";

import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Add from "@mui/icons-material/Add";

import { CSVLink } from "react-csv";

import { SwalDelete } from "../../functions/Swal";

import DataTableComponent from "../DataTable/DataTableComponent";
import DataTableColumns from "../DataTable/TblTackStatus/DataTableColumns";

import Expanded from "./Expanded.js";

import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import moment from "moment";
import "moment/locale/th"; // ✅ โหลดภาษาไทย

import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Select, MenuItem, InputLabel, FormControl, Grid } from "@mui/material";

import { Button } from "reactstrap";

import { useParams, useNavigate } from "react-router-dom";

import { styled } from "@mui/material/styles";
import styleButton from "@mui/material/Button";
import { Close, Download } from "@mui/icons-material";

import AuthService from "../../services/authService";

const Tackstatus = () => {
  moment.locale("th"); // ✅ ตั้งค่า default เป็นภาษาไทย
  const { id } = useParams(); // 👈 ดึง eventId จาก path /operation/:id
  const navigate = useNavigate(); // 👈 ใช้สำหรับเปลี่ยนเส้นทาง

  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const [search, setSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");

  const [filter, setFilter] = useState([]);
  const isSmallScreen = useMediaQuery("(max-width:600px)");

  // ✅ คำนวณ dateSearch จาก 2 dropdown
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM")); // ค่าเริ่มต้นเป็นเดือนนี้
  const [showAll, setShowAll] = useState(false); // สำหรับแสดงทั้งหมด
  const [selectedEvent, setSelectedEvent] = useState(null);

  const dateSearch = !showAll ? selectedDate : ""; // ถ้าเลือกแสดงทั้งหมดให้ dateSearch เป็นว่าง

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, type }

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadingFileSize, setUploadingFileSize] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadSuccess, setIsUploadSuccess] = useState(false);

  const [uploadingState, setUploadingState] = useState({
    quotation: null,
    report: null,
  });
  const [uploadProgressState, setUploadProgressState] = useState({
    quotation: 0,
    report: 0,
  });
  const [uploadingFileSizeState, setUploadingFileSizeState] = useState({
    quotation: "",
    report: "",
  });
  const [isUploadingState, setIsUploadingState] = useState({
    quotation: false,
    report: false,
  });

  const RedButton = styled(styleButton)(({ theme }) => ({
    backgroundColor: "#f44336", // สีแดงสด
    color: "#fff",
    fontWeight: "bold",
    borderRadius: "4px",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "#d32f2f", // สีแดงเข้มตอน hover
    },
  }));

  const GrayButton = styled(styleButton)({
    backgroundColor: "#9e9e9e", // สีเทา
    color: "#fff",
    fontWeight: "bold",
    borderRadius: "4px",
    boxShadow: "none",
    "&:hover": {
      backgroundColor: "#757575",
    },
  });

  const [filterType, setFilterType] = useState("");
  const [filterSystem, setFilterSystem] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  const [employee, setEmployee] = useState([]);

  const [currentUserRole, setCurrentUserRole] = useState("");

  useEffect(() => {
    const payload = JSON.parse(localStorage.getItem("payload"));
    if (payload?.role) {
      setCurrentUserRole(payload.role);
    }
  }, []);

  useEffect(() => {
    fetchEventsFromDB();
    fetchEmployee();
  }, [id]);

  useEffect(() => {
    if (id && selectedEvent) {
      // ✅ ถ้ามี id ให้แสดงเฉพาะ event เดียวนั้น
      setFilter([selectedEvent]);
    } else {
      // ✅ ปกติ: กรองจาก selectedDate + search
      const filtered = events.filter((event) => {
        const createdDate = moment(event.start || event.end).format("YYYY-MM");
        const matchMonth = dateSearch ? createdDate === dateSearch : true;

        const matchType = filterType ? event.title === filterType : true;
        const matchSystem = filterSystem ? event.system === filterSystem : true;
        const matchTeam = filterTeam ? event.team === filterTeam : true;
        const matchStatus = filterStatus
          ? [event.status, event.status_two, event.status_three].includes(
              filterStatus
            )
          : true;

        const keyword = search.toLowerCase();
        const matchSearch = keyword
          ? [
              event.company,
              event.site,
              event.title,
              event.system,
              event.team,
              event.docNo,
              moment(event.start).format("DD/MM/YYYY HH:mm"),
            ]
              .map((v) => (v || "").toLowerCase())
              .some((text) => text.includes(keyword))
          : true;

        const matchQuotation =
          event.documentSentQuotation && event.quotationFileUrl;

        return (
          matchMonth &&
          matchType &&
          matchSystem &&
          matchStatus &&
          matchTeam &&
          matchSearch &&
          matchQuotation // ✅ เงื่อนไขใหม่
        );
      });

      setFilter(filtered);
    }
  }, [
    id,
    selectedEvent,
    search,
    dateSearch,
    events,
    filterType,
    filterSystem,
    filterStatus,
    filterTeam,
  ]);

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const res = await AuthService.getAllUserData();
      // สมมติ API return { users: [...] }
      setEmployee(res.allUser || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching events:", error);
      setLoading(false);
    }
  };

  const fetchEventsFromDB = async () => {
    setLoading(true);
    try {
      const res = await EventService.getEventOp();

      setEvents(res.userEvents);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching events:", error);
      setLoading(false);
    }
  };

  const handleInputUpdate = async (id, updatedData) => {
    try {
      await EventService.UpdateEvent(id, updatedData); // 👈 API update
      fetchEventsFromDB(); // refresh events หลัง update
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRow = async (customerId) => {
    Swal.fire({
      title: "คุณแน่ใจหรือไม่?",
      text: "เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ใช่, ลบเลย!",
      cancelButtonText: "ยกเลิก",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await EventService.DeleteEvent(customerId);

          Swal.fire("ลบสำเร็จ!", "", "success");

          await fetchEventsFromDB();
        } catch (error) {
          console.error("Error deleting customer:", error);
          Swal.fire("เกิดข้อผิดพลาด!", "error");
        }
      }
    });
  };

  const sortedData = filter.slice().sort((a, b) => {
    return new Date(b.start) - new Date(a.start);
  });

  const isMobile = useMediaQuery("(max-width:600px)");

  const customStyles = {
    headCells: {
      style: {
        fontSize: isMobile ? "0.75rem" : "0.9rem",
        padding: isMobile ? "8px" : "12px",
      },
    },
    cells: {
      style: {
        fontSize: isMobile ? "0.75rem" : "0.9rem",
        padding: isMobile ? "8px" : "12px",
        whiteSpace: "nowrap",
      },
    },
  };

  const handleDocNoUpdate = (id, newDocNo) => {
    setEvents((prev) =>
      prev.map((event) =>
        event._id === id ? { ...event, docNo: newDocNo } : event
      )
    );
  };
  const handleDeleteFile = async (eventId, type) => {
    try {
      await EventService.DeleteFile(eventId, type);
      handleStatusUpdate(eventId, {
        [`${type}FileName`]: null,
        [`${type}FileUrl`]: null,
        [`${type}FileType`]: null,
        [`documentSent${capitalize(type)}`]: false,
      });
    } catch (err) {
      console.error("ลบไฟล์ไม่สำเร็จ:", err);
    }
  };

  const handleStatusUpdate = async (id, updates) => {
    try {
      await EventService.UpdateEvent(id, updates);
      setEvents((prev) =>
        prev.map((event) =>
          event._id === id ? { ...event, ...updates } : event
        )
      );
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการอัปเดตสถานะ:", error);
    }
  };

  const capitalize = (str = "") => str.charAt(0).toUpperCase() + str.slice(1);

  const handleFileUpload = async (file, eventId, type) => {
    try {
      setUploadingState((prev) => ({ ...prev, [type]: eventId }));
      setUploadingFileSizeState((prev) => ({
        ...prev,
        [type]: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      }));
      setUploadProgressState((prev) => ({ ...prev, [type]: 0 }));
      setIsUploadingState((prev) => ({ ...prev, [type]: true }));

      const result = await EventService.Upload(eventId, file, type, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgressState((prev) => ({ ...prev, [type]: percent }));
        },
      });

      await handleStatusUpdate(eventId, {
        [`${type}FileName`]: result.fileName,
        [`${type}FileUrl`]: result.fileUrl,
        [`${type}FileType`]: result.fileType,
        [`documentSent${capitalize(type)}`]: true,
      });

      setPreviewUrl(result.fileUrl);
      setPreviewFileName(result.fileName);

      setIsUploadingState((prev) => ({ ...prev, [type]: false }));
      setTimeout(() => {
        setUploadingState((prev) => ({ ...prev, [type]: null }));
        setUploadingFileSizeState((prev) => ({ ...prev, [type]: "" }));
        setUploadProgressState((prev) => ({ ...prev, [type]: 0 }));
      }, 1000);
    } catch (err) {
      console.error("Upload failed:", err);
      setIsUploadingState((prev) => ({ ...prev, [type]: false }));
      setUploadingState((prev) => ({ ...prev, [type]: null }));
      setUploadingFileSizeState((prev) => ({ ...prev, [type]: "" }));
      setUploadProgressState((prev) => ({ ...prev, [type]: 0 }));
    }
  };

  const isImageFile = (fileNameOrType = "") => {
    if (!fileNameOrType || typeof fileNameOrType !== "string") return false;

    const lower = fileNameOrType.toLowerCase();
    return (
      lower.includes("image") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    );
  };

  const getFileType = (fileName = "") => {
    if (!fileName || typeof fileName !== "string") return "unknown";
    const lower = fileName.toLowerCase();

    if (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    ) {
      return "image";
    }
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "excel";

    return "unknown";
  };

  const typeList = ["PM", "Service", "Inspection", "Emergency"];

  const systemList = ["Fire Alarm", "CCTV", "Fire Suppression", "Fire Pump"];

  const activeFilterCount = [
    filterType,
    filterSystem,
    filterStatus,
    search.trim(),
  ].filter((v) => v !== "").length;

  return (
    <>
      <div className="row align-items-end g-3 mt-5">
        <div className="col-12 col-md-6">
          {!id && !selectedEvent && (
            <LocalizationProvider
              dateAdapter={AdapterMoment}
              adapterLocale="th"
            >
              <DatePicker
                views={["year", "month"]} // ✅ แสดงเฉพาะ ปี/เดือน
                openTo="month" // ✅ เปิดที่หน้าจอเลือกเดือนก่อน
                label="📅 เลือกเดือน"
                value={moment(selectedDate)}
                onChange={(newValue) => {
                  setSelectedDate(moment(newValue).format("YYYY-MM"));
                  setShowAll(false);
                }}
                renderInput={(params) => (
                  <TextField {...params} fullWidth size="small" />
                )}
              />
            </LocalizationProvider>
          )}
        </div>

        <div className="col-12 col-md-6">
          {!id && !selectedEvent && (
            <TextField
              label="🔍 ค้นหา เช่น ชื่อโครงการ เลขที่เอกสาร"
              variant="outlined"
              size="small"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: "300px", mt: 1 }}
            />
          )}
        </div>
        <div className="col-12 col-sm mt-5">
          {!id && !selectedEvent && (
            <button
              className="btn btn-light btn-sm"
              onClick={() => {
                if (showAll) {
                  // 👈 ถ้ากำลังแสดงทั้งหมด → กลับมาเป็นเดือนปัจจุบัน
                  setSelectedDate(moment().format("YYYY-MM"));
                  setShowAll(false);
                } else {
                  // 👈 ถ้ากำลังดูเดือน → สลับเป็นแสดงทั้งหมด
                  setShowAll(true);
                }
              }}
            >
              • แสดงข้อมูล:{" "}
              {showAll
                ? "ทั้งหมด"
                : moment(selectedDate).locale("th").format("MMMM YYYY")}
            </button>
          )}
          {selectedEvent && (
            <div className="col-12 col-sm mt-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => navigate("/operation")}
              >
                ❌ แสดงข้อมูล: [{selectedEvent.title}] {selectedEvent.system} -{" "}
                {selectedEvent.site}
              </button>
            </div>
          )}
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          {typeList.map((type) => (
            <button
              key={type}
              className={`btn btn-sm ${
                filterType === type ? "btn-success" : "btn-outline-success"
              }`}
              onClick={() =>
                setFilterType((prev) => (prev === type ? "" : type))
              }
            >
              🔧 {type}
            </button>
          ))}

          {systemList.map((system) => (
            <button
              key={system}
              className={`btn btn-sm ${
                filterSystem === system
                  ? "btn-secondary"
                  : "btn-outline-secondary"
              }`}
              onClick={() =>
                setFilterSystem((prev) => (prev === system ? "" : system))
              }
            >
              🛠️ {system}
            </button>
          ))}

          {activeFilterCount > 0 && (
            <div className="form-text mt-2">
              🔎 ตัวกรอง <strong>{activeFilterCount}</strong> รายการ
            </div>
          )}
        </div>

        <div className="col-12 col-sm mt-3">
          <button
            className="btn btn-light btn-sm"
            onClick={() => {
              setFilterType("");
              setFilterSystem("");
              setFilterStatus("");
            }}
          >
            ❌ ล้างตัวกรองทั้งหมด
          </button>
        </div>

        {/* <div className="form-text mt-3">
          • แสดงข้อมูล:{" "}
          <strong>
            {showAll
              ? "ทั้งหมด"
              : moment(selectedDate).locale("th").format("MMMM YYYY")}
          </strong>
        </div> */}
      </div>
      <div style={{ overflowX: "auto" }}>
        <DataTableComponent
          columns={DataTableColumns({
            setSelectedRow,
            setEditedData,
            setModalOpenEdit,
            setSelectedFile,
            handleDeleteRow,
            onStatusUpdate: handleStatusUpdate,
            onDocNoUpdate: handleDocNoUpdate,
            onFileUpload: handleFileUpload, // ✅ เพิ่มตรงนี้
            handleDeleteFile,
            setPreviewUrl,
            setPreviewFileName,

            setConfirmOpen, // ✅ ส่งเข้า
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
            employee,
            resPerson: employee,
            onInputUpdate: handleInputUpdate, // ✅ ส่ง callback update เข้าไป
            currentUserRole: currentUserRole,
          })}
          data={sortedData}
          highlightOnHover
          dense={isMobile} // ใช้ dense บนมือถือเพื่อลดระยะห่าง
          customStyles={customStyles}
          paginationPerPage={10}
          // expandableRowsComponent={Expanded} // เปิดใช้งาน Expandle
          expandableRowsComponent={(props) => (
            <Expanded {...props} onStatusUpdate={handleDocNoUpdate} />
          )}
          expandableRowExpanded={(row) => expandedRows[row._id]}
        />
      </div>

      <Dialog
        open={Boolean(previewUrl)}
        onClose={() => setPreviewUrl(null)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle sx={{ m: 0, p: 2 }}>
          {previewFileName || "ดูไฟล์"}
          <IconButton
            aria-label="close"
            onClick={() => setPreviewUrl(null)}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {(() => {
            const type = getFileType(previewFileName || previewUrl);

            if (type === "image") {
              return (
                <img
                  src={previewUrl}
                  alt={previewFileName}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "800px",
                    display: "block",
                    margin: "0 auto",
                    borderRadius: "8px",
                  }}
                />
              );
            }

            if (type === "pdf") {
              return (
                <iframe
                  src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
                    previewUrl
                  )}`}
                  width="100%"
                  height="800px"
                  style={{ border: "none" }}
                  title="PDF Preview"
                />
              );
            }

            if (type === "word" || type === "excel") {
              return (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                    previewUrl
                  )}`}
                  width="100%"
                  height="800px"
                  style={{ border: "none" }}
                  title="Office Preview"
                />
              );
            }

            return (
              <div
                style={{ textAlign: "center", padding: "2em", color: "#888" }}
              >
                ไม่สามารถแสดงไฟล์นี้ได้
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>ยืนยันการลบไฟล์</DialogTitle>
        <DialogContent>
          <DialogContentText>
            คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์นี้? การลบจะไม่สามารถย้อนกลับได้
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <GrayButton onClick={() => setConfirmOpen(false)}>ยกเลิก</GrayButton>
          <RedButton
            onClick={() => {
              if (pendingDelete) {
                handleDeleteFile(pendingDelete.id, pendingDelete.type);
              }
              setConfirmOpen(false);
            }}
          >
            ลบไฟล์
          </RedButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Tackstatus;
