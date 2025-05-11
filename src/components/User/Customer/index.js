import React, { useEffect, useState } from "react";
import CustomerService from "../../../services/CustomerService";
import DataTableComponent from "../../DataTable/Main/DataTableComponent";
import DataTableColumns from "../../DataTable/Customer/DataTableColumns";
import Expanded from "./Expanded";
import {
  Modal,
  TextField,
  Button,
  Snackbar,
  Alert,
  Box,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import API from "../../../API/axiosInstance";
import Swal from "sweetalert2";
import { useMediaQuery } from "@mui/material";

const Customer = () => {
  const isSmallScreen = useMediaQuery("(max-width:600px)");

  const [searchTerm, setSearchTerm] = useState("");

  const [customers, setCustomers] = useState([]);
  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [newCustomerData, setNewCustomerData] = useState({
    cCompany: "",
    cSite: "",
    cEmail: "",
    cName: "",
    address: "",
    tel: "",
    tax: "",
  });
  const [alert, setAlert] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const modalStyle = {
    padding: isSmallScreen ? 2 : 3,
    background: "white",
    margin: "5% auto",
    width: isSmallScreen ? "95%" : "500px",
    maxWidth: "500px",
    borderRadius: 2,
    overflowY: "auto",
    maxHeight: "90vh",
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await CustomerService.getCustomers();
      setCustomers(res.userCustomers);
    } catch (error) {
      console.error("Error fetching customer data:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "tel") {
      const onlyNumbers = value.replace(/[^0-9]/g, "");
      setNewCustomerData({ ...newCustomerData, [name]: onlyNumbers });
    } else {
      setNewCustomerData({ ...newCustomerData, [name]: value });
    }
  };

  const validateForm = () => {
    const { cCompany, cSite, cEmail } = newCustomerData;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const telRegex = /^[0-9]{10}$/;

    if (!cCompany || !cSite) {
      setAlert({
        open: true,
        message: "กรุณากรอกข้อมูลให้ครบถ้วน!",
        severity: "error",
      });
      return false;
    }
    if (!emailRegex.test(cEmail)) {
      setAlert({
        open: true,
        message: "กรุณากรอกอีเมลให้ถูกต้อง!",
        severity: "error",
      });
      return false;
    }
    // if (!telRegex.test(tel)) {
    //   setAlert({ open: true, message: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก!", severity: "error" });
    //   return false;
    // }
    return true;
  };

  const handleAddCustomer = async () => {
    if (!validateForm()) return;
    try {
      const res = await CustomerService.AddCustomer(newCustomerData);
      setCustomers([...customers, res.data]);
      setModalOpenInsert(false);
      setNewCustomerData({
        cCompany: "",
        cSite: "",
        cEmail: "",
        cName: "",
        address: "",
        tel: "",
        tax: "",
      });
      Swal.fire({
        title: "สำเร็จ!",
        text: "เพิ่มลูกค้าเรียบร้อย",
        icon: "success",
      });

      await fetchCustomers();
    } catch (error) {
      console.error("Error adding customer:", error);
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: "ไม่สามารถเพิ่มลูกค้าได้",
        icon: "error",
      });
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
          await CustomerService.DeleteCustomer(customerId);

          Swal.fire("ลบสำเร็จ!", "", "success");

          await fetchCustomers();
        } catch (error) {
          console.error("Error deleting customer:", error);
          Swal.fire("เกิดข้อผิดพลาด!", "error");
        }
      }
    });
  };

  const filteredCustomers = customers.filter((customer) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      customer.cCompany?.toLowerCase().includes(lowerSearch) ||
      customer.cSite?.toLowerCase().includes(lowerSearch) ||
      customer.cEmail?.toLowerCase().includes(lowerSearch)
    );
  });

  return (
    <>
    <Box
        className="mt-5"
        sx={{ display: "flex", flexDirection: "column", gap: 1 }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", marginBottom: "30px" }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<AddIcon />}
            onClick={() => setModalOpenInsert(true)}
            sx={{
              fontSize: isSmallScreen ? "0.85rem" : "1rem",
              padding: isSmallScreen ? "6px 10px" : "8px 16px",
            }}
          >
            เพิ่มข้อมูลลูกค้าใหม่
          </Button>
        </Box>
        <TextField
          label="🔍🏢 ค้นหาลูกค้า"
          variant="outlined"
          size="small"
          fullWidth={isSmallScreen}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: isSmallScreen ? "100%" : "300px" }}
        />
      
      </Box>
      <DataTableComponent
        columns={DataTableColumns({
          setSelectedRow,
          setEditedData,
          setModalOpenEdit,
          setSelectedFile,
          handleDeleteRow,
        })}
        data={filteredCustomers} // ✅ ใช้ข้อมูลที่กรองแล้ว
        paginationPerPage={5}
        expandableRowsComponent={Expanded}
      />

      <Modal open={modalOpenInsert} onClose={() => setModalOpenInsert(false)}>
        <Box sx={modalStyle}>
          <h2 style={{ textAlign: "center" }}>เพิ่มลูกค้าใหม่</h2>
          <TextField
            label="บริษัทหรือนิติบุคล"
            name="cCompany"
            fullWidth
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            label="โครงการ"
            name="cSite"
            fullWidth
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            label="อีเมล"
            name="cEmail"
            fullWidth
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            label="ชื่อผู้ติดต่อ"
            name="cName"
            fullWidth
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            label="ที่อยู่"
            name="address"
            fullWidth
            margin="normal"
            onChange={handleChange}
          />
          <TextField
            label="เบอร์โทรศัพท์"
            name="tel"
            fullWidth
            margin="normal"
            onChange={handleChange}
            inputProps={{ maxLength: 10 }}
          />
          <TextField
            label="เลขประจำตัวผู้เสียภาษี"
            name="tax"
            fullWidth
            margin="normal"
            onChange={handleChange}
            inputProps={{ maxLength: 13 }}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleAddCustomer}
            sx={{ marginTop: 2 }}
          >
            บันทึก
          </Button>
        </Box>
      </Modal>

      <Snackbar
        open={alert.open}
        autoHideDuration={3000}
        onClose={() => setAlert({ ...alert, open: false })}
      >
        <Alert
          severity={alert.severity}
          onClose={() => setAlert({ ...alert, open: false })}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Customer;
