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

import moment from "moment"; // Import moment library for date formatting

const Operation = () => {
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
  const [dateSearch, setDateSearch] = useState(""); // New state for date search

  const [filter, setFilter] = useState([]);

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
      const eventName = event.title.toLowerCase();
      const updatedDate = moment(event.start).format("DD/MM/YYYY HH:mm"); // Convert updated date to a localized string

      // Check if the product name or the updated date matches the search term
      return (
        eventName.includes(search.toLowerCase()) ||
        updatedDate.includes(search.toLowerCase())
      );
    });

    setFilter(result);
  }, [search, events]);

  //useEffect hook for date search
  useEffect(() => {
    const result = events.filter((event) => {
      const createdDate = moment(event.createdAt).format("YYYY-MM-DD HH:mm"); // Convert updated date to a localized string
      return createdDate.includes(dateSearch);
    });

    setFilter(result);
  }, [dateSearch, events]);

  const sortedData = filter.slice().sort((a, b) => {
    return new Date(b.start) - new Date(a.start);
  });


  return (
    <DataTableComponent
      title={`การดำเนินงาน`}
      columns={DataTableColumns({
        setSelectedRow,
        setEditedData,
        setModalOpenEdit,
        setSelectedFile,
      })}
      data={sortedData}
      paginationPerPage={5}
      expandableRowsComponent={Expanded} // เปิดใช้งาน Expandle
      expandableRowExpanded={(row) => expandedRows[row._id]}
      subHeaderComponent={
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <div className="row g-0">
                <div className="col-md m-2">
                  <input
                    className="form-control"
                    type="search"
                    placeholder="Search here"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="col-md m-2">
                  <input
                    style={{ cursor: "pointer" }}
                    className="form-control"
                    type="date"
                    value={dateSearch}
                    onChange={(e) => setDateSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
};

export default Operation;
