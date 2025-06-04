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
import DataTableColumns from "../DataTable/TblOperation/DataTableColumns";

import Expanded from "./Expanded";

import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import moment from "moment";
import "moment/locale/th"; // ✅ โหลดภาษาไทย

import { Box, TextField, useMediaQuery } from "@mui/material";
import { Select, MenuItem, InputLabel, FormControl, Grid } from "@mui/material";

import { Button } from "reactstrap";

const Operation = () => {
  moment.locale("th"); // ✅ ตั้งค่า default เป็นภาษาไทย

  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);

  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const [search, setSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");

  const [filter, setFilter] = useState([]);
  const isSmallScreen = useMediaQuery("(max-width:600px)");

  const [selectedMonth, setSelectedMonth] = useState(""); // "" = ทั้งหมด
  const [selectedYear, setSelectedYear] = useState(moment().year().toString());

  // ✅ คำนวณ dateSearch จาก 2 dropdown
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM")); // ค่าเริ่มต้นเป็นเดือนนี้
  const [showAll, setShowAll] = useState(false); // สำหรับแสดงทั้งหมด

  const dateSearch = !showAll ? selectedDate : ""; // ถ้าเลือกแสดงทั้งหมดให้ dateSearch เป็นว่าง
  useEffect(() => {
    fetchEventsFromDB();
  }, []);

  const fetchEventsFromDB = async () => {
    setLoading(true);

    try {
      const res = await EventService.getEvents();
      const eventsWithId = res.userEvents.map((event) => ({
        ...event,
        id: event._id,
      }));
      setEvents(eventsWithId);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching events:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const result = events.filter((event) => {
      const createdDate = moment(event.start || event.end).format("YYYY-MM");
      const matchMonth = dateSearch ? createdDate === dateSearch : true;

      const keyword = search.toLowerCase();
      const matchSearch = [
        event.company,
        event.site,
        event.title,
        event.system,
        event.team,
        moment(event.start).format("DD/MM/YYYY HH:mm"),
      ]
        .map((v) => (v || "").toLowerCase())
        .some((text) => text.includes(keyword));

      return matchMonth && matchSearch;
    });

    setFilter(result);
  }, [search, dateSearch, events]);

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

  return (
    <>
      <div className="row align-items-end g-3 mt-5">
        <div className="col-12 col-md-6">
          <LocalizationProvider dateAdapter={AdapterMoment} adapterLocale="th">
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
        </div>

        <div className="col-12 col-md-6">
          <TextField
            label="🔍 ค้นหา เช่น ชื่อโครงการ เลขที่เอกสาร"
            variant="outlined"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: "300px", mt: 1 }}
          />
        </div>
  <div className="col-12 col-sm mt-5">
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

      <DataTableComponent
        columns={DataTableColumns({
          setSelectedRow,
          setEditedData,
          setModalOpenEdit,
          setSelectedFile,
          handleDeleteRow,
        })}
        data={sortedData}
        paginationPerPage={10}
        expandableRowsComponent={Expanded} // เปิดใช้งาน Expandle
        expandableRowExpanded={(row) => expandedRows[row._id]}
        // subHeaderComponent={
        //   <div className="container">
        //     <div className="row align-items-end g-3 flex-wrap">
        //       {/* เดือน */}
        //       <div className="col-12 col-md-6">
        //         <input
        //           className="form-control"
        //           type="month"
        //           value={dateSearch}
        //           onChange={(e) => setDateSearch(e.target.value)}
        //         />
        //       </div>

        //       {/* ค้นหา */}
        //       <div className="col-12 col-md-6">
        //         <input
        //           type="search"
        //           className="form-control"
        //           placeholder="🔍 ค้นหา เช่น ชื่อโครงการ เลขที่เอกสาร"
        //           value={search}
        //           onChange={(e) => setSearch(e.target.value)}
        //         />
        //       </div>
        //     </div>
        //   </div>
        // }
      />
    </>
  );
};

export default Operation;
