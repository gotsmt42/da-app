import React, { useEffect, useState } from "react";
import AuthService from "../../../services/authService";
import DataTableComponent from "../../DataTable/Main/DataTableComponent";
import DataTableColumns from "../../DataTable/Users/DataTableColumns";
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
import LockIcon from "@mui/icons-material/Lock";
import PhoneIcon from "@mui/icons-material/Phone";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add"; // ✅ เพิ่มไอคอนปุ่ม
import API from "../../../API/axiosInstance";
import Swal from "sweetalert2";

import { useMediaQuery } from "@mui/material"; // ✅ ใช้สำหรับ Responsive

import { useAuth } from "../../../auth/AuthContext";

const Employee = () => {
  const { userData, updateUserData } = useAuth();
  const isSmallScreen = useMediaQuery("(max-width:600px)"); // ✅ เช็คว่าหน้าจอเล็กหรือไม่

  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [alert, setAlert] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const [modalOpenPasswordConfirm, setModalOpenPasswordConfirm] =
    useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState(""); // รหัสผ่านของ Admin

  // ✅ สไตล์สำหรับ Modal (Responsive)
  const modalStyle = {
    padding: isSmallScreen ? 2 : 3, // ✅ ลด padding บนอุปกรณ์เล็ก
    background: "white",
    margin: isSmallScreen ? "5% auto" : "5% auto", // ✅ ปรับ margin ให้พอดี
    width: isSmallScreen ? "95%" : "500px", // ✅ ลดขนาด Modal บนอุปกรณ์เล็ก
    maxWidth: "500px",
    borderRadius: 2,
    overflowY: "auto", // ✅ ป้องกันการล้นของ Modal
    maxHeight: "90vh", // ✅ ป้องกัน Modal ล้นจอ
  };

  const [newUserData, setNewUserData] = useState({
    fname: "",
    lname: "",
    tel: "",
    email: "",
    username: "",
    password: "",
    role: "",
    rank: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const getAllUser = await AuthService.getAllUserData();
      setUsers(getAllUser.allUser);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "tel") {
      // ✅ อนุญาตให้กรอกเฉพาะตัวเลขเท่านั้น
      const onlyNumbers = value.replace(/[^0-9]/g, "");
      setNewUserData({ ...newUserData, [name]: onlyNumbers });
    } else {
      setNewUserData({ ...newUserData, [name]: value });
    }
  };

  const validateForm = () => {
    const { fname, lname, tel, email, username, password, role } = newUserData;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const telRegex = /^[0-9]{10}$/; // ✅ ต้องเป็นตัวเลข 10 หลักเท่านั้น

    if (!fname || !lname || !tel || !email || !username || !password || !role) {
      setAlert({
        open: true,
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง!",
        severity: "error",
      });
      return false;
    }
    if (!emailRegex.test(email)) {
      setAlert({
        open: true,
        message: "กรุณากรอกอีเมลให้ถูกต้อง!",
        severity: "error",
      });
      return false;
    }
    if (!telRegex.test(tel)) {
      setAlert({
        open: true,
        message: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก!",
        severity: "error",
      });
      return false;
    }
    if (password.length < 6) {
      setAlert({
        open: true,
        message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!",
        severity: "error",
      });
      return false;
    }
    if (!["admin", "tecnicain", "editor"].includes(role)) {
      setAlert({
        open: true,
        message: "กรุณาเลือกสิทธิ์ของผู้ใช้!",
        severity: "error",
      });
      return false;
    }
    return true;
  };

  const validateEditForm = () => {
    const { fname, lname, tel, email, username, role } = editedData;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const telRegex = /^[0-9]{10}$/; // ✅ ต้องเป็นตัวเลข 10 หลักเท่านั้น

    if (!fname || !lname || !tel || !email || !username || !role) {
      setAlert({
        open: true,
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง!",
        severity: "error",
      });
      return false;
    }
    if (!emailRegex.test(email)) {
      setAlert({
        open: true,
        message: "กรุณากรอกอีเมลให้ถูกต้อง!",
        severity: "error",
      });
      return false;
    }
    if (!telRegex.test(tel)) {
      setAlert({
        open: true,
        message: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก!",
        severity: "error",
      });
      return false;
    }
    if (!["admin", "tecnicain", "editor"].includes(role)) {
      setAlert({
        open: true,
        message: "กรุณาเลือกสิทธิ์ของผู้ใช้!",
        severity: "error",
      });
      return false;
    }
    return true;
  };

  const validateAdminPassword = async () => {
    try {
      const response = await API.post("/auth/validate-password", {
        email: "gotsmtdd@gmail.com",
        password: passwordConfirm,
      });

      if (!response.data.valid) {
        Swal.fire({
          title: "รหัสผ่านไม่ถูกต้อง!",
          text: "กรุณาลองใหม่",
          icon: "error",
          willOpen: () => {
            document.querySelector(".swal2-container").style.zIndex = 1500; // ดัน SweetAlert ให้อยู่ด้านหน้า
          },
          customClass: {
            popup: "swal2-front", // ใช้สำหรับ CSS กำหนดค่าเพิ่มเติม
          },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating admin password:", error);
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: "ไม่สามารถตรวจสอบรหัสผ่านได้",
        icon: "error",
        willOpen: () => {
          document.querySelector(".swal2-container").style.zIndex = 1500;
        },
        customClass: {
          popup: "swal2-front",
        },
      });
      return false;
    }
  };

  const handleOpenPasswordConfirmModal = () => {
    if (!validateForm()) return;
    setModalOpenPasswordConfirm(true); // เปิด Modal รหัสผ่าน Admin
  };
  const handleAddUser = async () => {
    const isPasswordValid = await validateAdminPassword();
    if (!isPasswordValid) {
      Swal.fire({
        title: "รหัสผ่านผิดพลาด!",
        text: "รหัสผ่านของคุณไม่ถูกต้อง",
        icon: "error",
        willOpen: () => {
          document.querySelector(".swal2-container").style.zIndex = 1500;
        },
        customClass: {
          popup: "swal2-front",
        },
      });
      return;
    }

    try {
      const requestData = {
        fname: newUserData.fname.trim(),
        lname: newUserData.lname.trim(),
        tel: newUserData.tel.trim(),
        email: newUserData.email.trim(),
        username: newUserData.username.trim(),
        password: newUserData.password.trim(),
        role: newUserData.role.trim(),
        rank: newUserData.rank.trim(),
      };

      const response = await API.post("/auth/signup", requestData);

      if (response.data) {
        setUsers((prevUsers) => [...prevUsers, response.data]);
        await fetchUsers();
        setModalOpenInsert(false);
        setModalOpenPasswordConfirm(false);
        setNewUserData({
          fname: "",
          lname: "",
          tel: "",
          email: "",
          username: "",
          password: "",
        });
        setPasswordConfirm("");

        Swal.fire({
          title: "สำเร็จ!",
          text: "เพิ่มผู้ใช้สำเร็จ!",
          icon: "success",
          willOpen: () => {
            document.querySelector(".swal2-container").style.zIndex = 1500;
          },
          customClass: {
            popup: "swal2-front",
          },
        });
      }
    } catch (error) {
      console.error("Error adding user:", error);
      let errorMessage = "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้!";

      if (error.response && error.response.data.err) {
        errorMessage = error.response.data.err;
      }

      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: errorMessage,
        icon: "error",
        willOpen: () => {
          document.querySelector(".swal2-container").style.zIndex = 1500;
        },
        customClass: {
          popup: "swal2-front",
        },
      });
    }
  };
  // เมื่อกดปุ่ม "แก้ไข" ใน DataTable
  const openEditModal = (user) => {
    setSelectedUser(user); // ✅ เก็บข้อมูลผู้ใช้ที่เลือก
    setEditedData({
      _id: user._id, // ✅ เพิ่ม _id ของ user เพื่อใช้ในการอัปเดต
      fname: user.fname,
      lname: user.lname,
      tel: user.tel,
      email: user.email,
      username: user.username,
    });
    setModalOpenEdit(true);
  };

  const handleChangeEdit = (e) => {
    const { name, value } = e.target;

    if (name === "tel") {
      // ✅ อนุญาตให้กรอกเฉพาะตัวเลขเท่านั้น
      const onlyNumbers = value.replace(/[^0-9]/g, "");
      setEditedData({ ...editedData, [name]: onlyNumbers });
    } else {
      setEditedData({ ...editedData, [name]: value });
    }
  };

  const handleEditUser = async () => {
    if (!validateEditForm()) return;

    if (!editedData._id) {
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: "ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข",
        icon: "error",
      });
      return;
    }

    try {
      const response = await API.put(
        `/auth/user/${editedData._id}`,
        editedData,
      );
      if (response.status === 200) {
        const updatedUser = response.data.user;

        // ✅ อัปเดตเฉพาะ user ที่ล็อกอินอยู่
 if (userData && updatedUser._id.toString() === userData._id.toString()) {
  updateUserData(updatedUser);
}

        // ✅ อัปเดต list ของ users ด้วยข้อมูลจาก API
        setUsers(
          users.map((user) =>
            user._id === updatedUser._id ? updatedUser : user,
          ),
        );

        setModalOpenEdit(false);
        setSelectedUser(null);
        setEditedData({});
        fetchUsers();

        Swal.fire({
          title: "สำเร็จ!",
          text: "อัปเดตข้อมูลผู้ใช้เรียบร้อย",
          icon: "success",
        });
      }
    } catch (error) {
      console.error("❌ Error updating user:", error);
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: "ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้",
        icon: "error",
      });
    }
  };

  const handleDeleteRow = async (userId) => {
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
          const response = await API.delete(`/auth/user/${userId}`);

          if (response.status === 200) {
            setUsers(users.filter((user) => user._id !== userId)); // ลบจาก state
            Swal.fire("ลบสำเร็จ!", "ผู้ใช้ถูกลบออกจากระบบแล้ว", "success");
          }
        } catch (error) {
          console.error("Error deleting user:", error);
          Swal.fire("เกิดข้อผิดพลาด!", "ไม่สามารถลบผู้ใช้ได้", "error");
        }
      }
    });
  };

  const filteredUsers = users.filter((user) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      user.fname?.toLowerCase().includes(lowerSearch) ||
      user.lname?.toLowerCase().includes(lowerSearch) ||
      user.email?.toLowerCase().includes(lowerSearch) ||
      user.tel?.toLowerCase().includes(lowerSearch)
    );
  });

  return (
    <>
      <Box
        className="mt-5"
        sx={{ display: "flex", flexDirection: "column", gap: 1 }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "30px",
          }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setModalOpenInsert(true)}
            sx={{
              fontSize: isSmallScreen ? "0.85rem" : "1rem",
              padding: isSmallScreen ? "6px 10px" : "8px 16px",
            }}
          >
            เพิ่มผู้ใช้ใหม่
          </Button>
        </Box>

        <TextField
          label="🔍🤵 ค้นหาสมาชิก"
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Box>

      <DataTableComponent
        columns={DataTableColumns({
          setSelectedRow,
          setEditedData,
          setModalOpenEdit,
          setSelectedFile,
          handleDeleteRow, // ✅ เพิ่มฟังก์ชันลบ
        })}
        data={filteredUsers}
        paginationPerPage={5}
        expandableRowsComponent={Expanded}
        expandableRowExpanded={(row) => expandedRows[row._id]}
      />

      {/* โมดอลเพิ่มผู้ใช้ */}
      <Modal open={modalOpenInsert} onClose={() => setModalOpenInsert(false)}>
        <Box sx={modalStyle}>
          <h2 style={{ textAlign: "center" }}>เพิ่มผู้ใช้ใหม่</h2>
          <TextField
            label="ชื่อ"
            name="fname"
            fullWidth
            margin="normal"
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="นามสกุล"
            name="lname"
            fullWidth
            margin="normal"
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="เบอร์โทร"
            name="tel"
            fullWidth
            margin="normal"
            value={newUserData.tel}
            onChange={handleChange}
            inputProps={{ maxLength: 10 }} // ✅ จำกัดให้กรอกได้แค่ 10 หลัก
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="อีเมล"
            name="email"
            fullWidth
            margin="normal"
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="ชื่อผู้ใช้"
            name="username"
            fullWidth
            margin="normal"
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircleIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="รหัสผ่าน"
            name="password"
            type="password"
            fullWidth
            margin="normal"
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* ✅ เพิ่ม Dropdown สำหรับเลือก Role */}
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-label">สิทธิ์ของผู้ใช้</InputLabel>
            <Select
              labelId="role-label"
              name="role"
              value={newUserData.role || ""}
              onChange={handleChange}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="tecnicain">Technician</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleOpenPasswordConfirmModal}
            sx={{ marginTop: 2 }}
          >
            บันทึก
          </Button>
        </Box>
      </Modal>

      {/* Modal แก้ไขผู้ใช้ */}
      <Modal open={modalOpenEdit} onClose={() => setModalOpenEdit(false)}>
        <Box sx={modalStyle}>
          <h2 style={{ textAlign: "center" }}>แก้ไขข้อมูลผู้ใช้</h2>
          <TextField
            label="ชื่อ"
            name="fname"
            fullWidth
            margin="normal"
            value={editedData.fname || ""}
            onChange={handleChangeEdit}
          />
          <TextField
            label="นามสกุล"
            name="lname"
            fullWidth
            margin="normal"
            value={editedData.lname || ""}
            onChange={handleChangeEdit}
          />

          {/* ✅ ช่องเบอร์โทร (แก้ไข) กรองให้กรอกเฉพาะตัวเลข */}
          <TextField
            label="เบอร์โทร"
            name="tel"
            fullWidth
            margin="normal"
            value={editedData.tel || ""}
            onChange={handleChangeEdit}
            inputProps={{ maxLength: 10 }} // ✅ จำกัดให้กรอกได้แค่ 10 หลัก
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="อีเมล"
            name="email"
            fullWidth
            margin="normal"
            value={editedData.email || ""}
            onChange={handleChangeEdit}
          />
          <TextField
            label="ชื่อผู้ใช้"
            name="username"
            fullWidth
            margin="normal"
            value={editedData.username || ""}
            onChange={handleChangeEdit}
          />

          {/* ✅ Dropdown สำหรับเลือก Role */}
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-label">สิทธิ์ของผู้ใช้</InputLabel>
            <Select
              labelId="role-label"
              name="role"
              value={editedData.role || ""}
              onChange={handleChangeEdit}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="tecnicain">Technician</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleEditUser}
            sx={{ marginTop: 2 }}
          >
            บันทึก
          </Button>
        </Box>
      </Modal>

      <Modal
        open={modalOpenPasswordConfirm}
        onClose={() => setModalOpenPasswordConfirm(false)}
      >
        <Box sx={modalStyle}>
          <h2 style={{ textAlign: "center" }}>ยืนยันรหัสผ่าน Admin</h2>
          <TextField
            label="รหัสผ่านของคุณ"
            name="passwordConfirm"
            type="password"
            fullWidth
            margin="normal"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleAddUser}
            sx={{ marginTop: 2 }}
          >
            ยืนยัน
          </Button>
        </Box>
      </Modal>

      {/* Alert แจ้งเตือน */}
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

export default Employee;
