import { useState, useEffect, useRef } from "react";
import FileService from "../../services/FileService";
import AuthService from "../../services/authService";
import Swal from "sweetalert2";

import IconButton from "@mui/material/IconButton";

import Add from "@mui/icons-material/Add";

import { SwalDelete } from "../../functions/Swal";

import DataTableComponent from "../DataTable/Main/DataTableComponent";
import DataTableContextActions from "../DataTable/Main/DataTableContextActions";
import DataTableColumns from "../DataTable/Files/DataTableColumns";

import moment from "moment"; // Import moment library for date formatting
import { Link } from "react-router-dom";
import ExpandedFile from "./ExpandedFile";
import API from "../../API/axiosInstance";
import { ThreeDots } from "react-loader-spinner";

const ShowFiles = () => {
  const [user, setUser] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [dateSearch, setDateSearch] = useState(""); // New state for date search
  const [userSearch, setUserSearch] = useState("");
  const [filter, setFilter] = useState([]);

  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // เพิ่มสถานะการแสดง modal
  const [confirmExit, setConfirmExit] = useState(false); // เพิ่มสถานะการยืนยันออกจากเพจ

  //useEffect for get data
  useEffect(() => {
    fetchData();
    getUserData();
  }, []);

  useEffect(() => {
    const result = files.filter((file) => {
      const fileName = file.filename.toLowerCase();
      const updatedDate = moment(file.updatedAt).format("DD/MM/YYYY HH:mm:ss");
  
      if (userSearch !== "") {
        // เพิ่มเงื่อนไขการค้นหาด้วย userSearch
        return (
          (fileName.includes(search.toLowerCase()) ||
          updatedDate.includes(search.toLowerCase())) &&
          file.user.username.toLowerCase().includes(userSearch.toLowerCase())
        );
      }

    


      return (
        fileName.includes(search.toLowerCase()) ||
        updatedDate.includes(search.toLowerCase())
      );
    });
  
    setFilter(result);
  }, [search, userSearch, files]);
  
  useEffect(() => {
    const result = files.filter((file) => {
      const email = file.user.email.toLowerCase();
      const username = file.user.username.toLowerCase();
      const role = file.user.role.toLowerCase();
      return (
        email.includes(userSearch.toLowerCase()) ||
        username.includes(userSearch.toLowerCase()) ||
        role.includes(userSearch.toLowerCase())
      );
    });
    setDateSearch("");
    setSearch("");
    setFilter(result);
  }, [userSearch, files]);

  //useEffect hook for date search
  useEffect(() => {
    const result = files.filter((file) => {
      const updatedDate = moment(file.updatedAt).format("YYYY-MM-DD HH:mm:ss"); // Convert updated date to a localized string
     
      if (userSearch !== "") {
        // เพิ่มเงื่อนไขการค้นหาด้วย userSearch
        return (
          (updatedDate.includes(search.toLowerCase())) &&
          file.user.username.toLowerCase().includes(userSearch.toLowerCase())
        );
      }
      return updatedDate.includes(dateSearch);
    });

    setFilter(result);
  }, [dateSearch, userSearch, files]);

  //ฟังชั่น get ข้อมูล User ที่ login ตาม jwt
  const getUserData = async () => {
    const res = await AuthService.getUserData();
    const getUser = res.user;

    setUser(getUser);
  };

  //ฟังชั่น get ข้อมูล User Data มาแสดงทั้งหมด
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await FileService.getUserFiles();
      const files = res.userFiles;

      setFiles(files);
      setFilter(files);
      setSelectedRows([]);
      setToggleCleared(false);
      setExpandedRows({});
      setSearch("");
      setDateSearch("");
      setRows([]);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching files:", error);
      setLoading(false);
    }
  };

  // ฟังก์ชันลบข้อมูลทั้งหมด
  const handleDelete = async () => {
    try {
      setShowDeleteModal(true); // แสดง modal ลบ
      setConfirmExit(true); // ตั้งค่าให้ยืนยันการออกจากหน้า

      await SwalDelete().then(async (result) => {
        if (result.isConfirmed) {
          setLoading(true); // เริ่มต้นโหลดข้อมูล
          // หากมีข้อมูลที่เลือกอยู่
          if (selectedRows.length > 0) {
            const promises = selectedRows.map(async (row) => {
              try {
                const fileId = row._id;
                await FileService.deleteFile(fileId);
              } catch (error) {
                console.error("Error deleting file:", error);
              }
            });

            // รอให้ทุก promise ดำเนินการเสร็จสิ้น
            await Promise.all(promises);
            // หลังจากลบข้อมูลเสร็จแล้ว ให้โหลดข้อมูลใหม่
            setSelectedRows([]); // เคลียร์รายการที่ถูกเลือก
            setToggleCleared(true); // ตั้งค่าให้เคลียร์รายการที่ถูกเลือก
            setExpandedRows({}); // ล้างข้อมูลการขยายแถว
            setConfirmExit(false); // ปิดการยืนยันการออกจากหน้า
            await fetchData();
            // ปิด Loader เมื่อโหลดข้อมูลเสร็จสิ้น
            setLoading(false);
            // แสดงข้อความแจ้งเตือนลบสำเร็จ
            Swal.fire("Deleted Success!", "", "success");
          }
        }
        // ถ้าผู้ใช้ยกเลิกการยืนยันการลบ ให้ปิด Loader
        else {
          setLoading(false);
        }
      });

      // ปิด modal ลบ เมื่อเสร็จสิ้นการลบ
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting files:", error);
      setLoading(false); // เมื่อเกิดข้อผิดพลาดในการลบ
    }
  };

  // ฟังชั่นลบไฟล์แต่ละแถว
  const handleDeleteRow = async (rowId) => {
    try {
      setShowDeleteModal(true); // แสดง modal ลบ
      setConfirmExit(true); // ตั้งค่าให้ยืนยันการออกจากหน้า

      await SwalDelete().then(async (result) => {
        if (result.isConfirmed) {
          setLoading(true); // เริ่มต้นโหลดข้อมูล
          await FileService.deleteFile(rowId);
          // หลังจากลบไฟล์เสร็จแล้วให้ดึงข้อมูลใหม่
          await fetchData();
          Swal.fire("Deleted Success!", "", "success");
        }
      });

      // เมื่อโหลดข้อมูลเสร็จสิ้น
      setLoading(false);
      setShowDeleteModal(false); // ปิด modal ลบ
      setConfirmExit(false); // ปิดการยืนยันการออกจากหน้า
    } catch (error) {
      console.error("Error deleting file:", error);
      setLoading(false); // เมื่อเกิดข้อผิดพลาดในการลบ
    }
  };

  // Select ข้อมูลในแถวเก็บไว้ใน state
  const handleRowSelected = (state) => {
    setSelectedRows(state.selectedRows);
    // เมื่อมีการเลือกข้อมูล ตั้งค่าการยืนยันออกจากเพจเป็น true
    setConfirmExit(true);
  };

  const handleRowClicked = (row) => {
    const newRowState = { ...expandedRows };
    newRowState[row._id] = !expandedRows[row._id];
    setExpandedRows(newRowState);
  };

  const handleDownload = async () => {
    if (selectedRows.length > 0) {
      try {
        // วนลูปผ่านแต่ละแถวที่เลือก
        for (const row of selectedRows) {
          // เรียกใช้ฟังก์ชัน downloadFile ที่รับพารามิเตอร์เป็นเส้นทางของไฟล์และชื่อไฟล์
          await downloadFile(row.path, row.filename);
        }
      } catch (error) {
        console.error("Error downloading files:", error);
        Swal.fire("Error downloading files", "", "error");
      }
    } else {
      // ถ้าไม่มีแถวที่เลือก
      Swal.fire("No files selected for download", "", "warning");
    }
  };

  // ฟังก์ชัน downloadFile สำหรับดาวน์โหลดไฟล์
  const downloadFile = async (filePath, fileName) => {
    try {
      const downloadUrl = `${API.defaults.baseURL}/${filePath}`;
      const response = await fetch(downloadUrl);
      const blob = await response.blob();

      // สร้าง URL สำหรับ Blob
      const blobUrl = URL.createObjectURL(blob);

      // สร้าง element <a> เพื่อดาวน์โหลดไฟล์
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;

      // เรียกใช้งานฟังก์ชัน click เพื่อเริ่มการดาวน์โหลดไฟล์
      link.click();

      // หลังจากการดาวน์โหลดเสร็จสิ้น ลบ URL สำหรับ Blob ที่สร้างขึ้นไป
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  };

  // Sort ข้อมูลให้เรียงลำดับใหม่
  const sortedData = filter.slice().sort((a, b) => {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const uniqueUser = [
    ...new Set(files.map((userFile) => userFile.user.username)),
  ];

  const dateInputRef = useRef(null);

  return (
    <>
      <DataTableComponent
        title={`${user.username} - Files`}
        columns={DataTableColumns({
          setSelectedRow,
          setSelectedFile,
          handleDeleteRow,
          downloadFile,
        })}
        data={sortedData}
        selectableRows
        fixedHeaderScrollHeight="625px"
        
        paginationPerPage={5}
        expandableRowsComponent={ExpandedFile} // เปิดใช้งาน Expandle
        // expandableRowExpanded={(row) => expandedRows[row._id]}
        onRowClicked={handleRowClicked}
        onSelectedRowsChange={handleRowSelected}
        clearSelectedRows={toggleCleared}
        subHeaderComponent={
          <div className="container">
            <div className="row">
              <div className="col-md-12">
                <div className="row g-0">
                  <div className="col-md m-2">
                    <input
                      className="form-control"
                      type="search"
                      placeholder="Search File"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="col-md m-2">
                    <select
                      id="userSelect"
                      className="form-select"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    >
                      <option value={""}>Search for user upload</option>
                      {uniqueUser.map((username, idx) => {
                        const userFile = files.find(
                          (file) => file.user.username === username
                        ); // ค้นหา userFile ที่มี username ตรงกับ username ที่กำลัง map
                        return (
                          <option key={idx} value={username}>
                            {username}, ({userFile.user.fname}{" "}
                            {userFile.user.lname}), (สถานะ: {userFile.user.role})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="col-md m-2">
                    <input
                      className="form-control"
                      type="date"
                      ref={dateInputRef}
                      onChange={(e) => setDateSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        contextActions={
          <DataTableContextActions
            handleDelete={handleDelete}
            handleDownload={handleDownload}
          />
        }
        actions={[
          <Link to={"/fileupload"} key="file-upload-link">
            <button
              key="file-upload"
              aria-label="File Upload"
              data-toggle="tooltip"
              data-placement="top"
              title="Upload File"
              className="btn btn-primary"

            >
              <Add />
              อัพโหลดไฟล์ใหม่
            </button>
          </Link>,
        ]}
      />
      {/* Loader */}
 
          {loading && (
            <div className="loading-overlay">
              <ThreeDots
                type="ThreeDots"
                color="#007bff"
                height={50}
                width={50}
              />
            </div>
          )}
  
    </>
  );
};

export default ShowFiles;
