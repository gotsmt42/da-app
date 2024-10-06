/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef } from "react";
import AuthService from "../../../services/authService";
// import Swal from "sweetalert2";

// import IconButton from "@mui/material/IconButton";

// import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
// import Add from "@mui/icons-material/Add";

// import { CSVLink } from "react-csv";

// import { SwalDelete } from "../../../functions/Swal";

import DataTableComponent from "../../DataTable/Main/DataTableComponent";
import DataTableColumns from "../../DataTable/๊Users/DataTableColumns";

import Expanded from "./Expanded";

const Employee = () => {
  const [users, setUsers] = useState([]);

  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);


    useEffect(() => {
      async function fetchData() {
        try {
          const getAllUser = await AuthService.getAllUserData();
          setUsers(getAllUser.allUser);
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }

      fetchData();
    }, []);

  // Function to format salary as currency
  const formatCurrency = (amount) => {
    // Check if amount is valid and numeric
    if (!amount || isNaN(amount)) {
      return ""; // Return empty string if amount is invalid
    }

    // Use Intl.NumberFormat to format amount as currency
    const formatter = new Intl.NumberFormat("en-TH", {
      style: "currency",
      currency: "THB", // Change currency code as needed
      minimumFractionDigits: 2, // Minimum number of fractional digits
    });

    return formatter.format(amount); // Format amount as currency string
  };
  return (
    <DataTableComponent
      columns={DataTableColumns({
        setSelectedRow,
        setEditedData,
        setModalOpenEdit,
        setSelectedFile,
      })}
      data={users}
      paginationPerPage={5}

      expandableRowsComponent={Expanded} // เปิดใช้งาน Expandle
      expandableRowExpanded={(row) => expandedRows[row._id]}

    />

    
    
  );
};

export default Employee;
