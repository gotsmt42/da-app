import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

import { Link } from "react-router-dom";

import Facebook from "@mui/icons-material/Facebook";
import { Instagram, Twitter } from "@mui/icons-material";

import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";

import EditModal from "../../Modal/users/EditModal";

import AuthService from "../../../services/authService";
import API from "../../../API/axiosInstance";

const Account = () => {
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [user, setUser] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  //useEffect for get data
  useEffect(() => {
    getUserData();
  }, []);

  //ฟังชั่น get ข้อมูล User ที่ login ตาม jwt
  const getUserData = async () => {
    const getUser = await AuthService.getUserData();
    setUser(getUser.user);
  };

  //ฟังชั่นแก้ไข File Image
  const handleEditFileChange = (e) => {
    const file = e.target.files[0];

    setSelectedFile(file);
  };

  //ฟังชั่นแก้ไขข้อมูล
  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const userId = user._id;
      const formData = new FormData();
      for (const [key, value] of Object.entries(editedData)) {
        formData.append(key, value);
      }
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      const updatedUser = await AuthService.UpdateUser(userId, formData);
      setUser(updatedUser); // อัพเดทข้อมูลผู้ใช้
      
      setModalOpenEdit(false);
      setSelectedFile(null);
      Swal.fire("Updated Success!", "", "success");

    } catch (error) {
      console.error("Error updating data:", error);
    }
  };
  
  
  const handleCloseModalEdit = () => {
    setModalOpenEdit(false);
  };


  return (
    <section className="vh-100" style={{ backgroundColor: "#f4f5f7" }}>
      <div className="container py-5 h-100">
        <div className="row d-flex justify-content-center align-items-center h-100">
          <div className="col col-lg-6 mb-4 mb-lg-0">
            <div className="card mb-3" style={{ borderRadius: ".5rem" }}>
              <div className="row g-0">
                <div
                  className="col-md-4 gradient-custom text-center text-white"
                  style={{
                    borderTopLeftRadius: ".5rem",
                    borderBottomLeftRadius: ".5rem",
                  }}
                >
                  <img
                    src={user.imageUrl} // จะได้ path เช่น uploads/images/xxx.jpg
                    alt="Avatar"
                    className="img-fluid my-5 rounded-circle"
                    style={{ width: "120px", height:"120px"}}
                  />
                  <p>
                    <b>{user.fname} {user.lname}</b>
                  </p>
                  <p>สถานะ: {user.role}</p>
                  <p>ตำแหน่ง: {user.rank}</p>
                  <Link
                    onClick={() => {
                      setEditedData(user);
                      setModalOpenEdit(true);
                    }}
                  >
                    <ManageAccountsRoundedIcon
                      className="mb-5"
                      style={{ color: "white" }}
                    ></ManageAccountsRoundedIcon>
                  </Link>
                </div>
                <div className="col-md-8">
                  <div className="card-body p-4">
                    <h6>Information</h6>
                    <hr className="mt-0 mb-4" />
                    <div className="row pt-1">
                      <div className="col-6 mb-3">
                        <h6>Email</h6>
                        <p className="text-muted">{user.email}</p>
                      </div>
                      <div className="col-6 mb-3">
                        <h6>Phone</h6>
                        <p className="text-muted">{user.tel}</p>
                      </div>
                    </div>
                    <h6>Projects</h6>
                    <hr className="mt-0 mb-4" />
                    <div className="row pt-1">
                      <div className="col-6 mb-3">
                        <h6>Recent</h6>
                        <p className="text-muted">Lorem ipsum</p>
                      </div>
                      <div className="col-6 mb-3">
                        <h6>Most Viewed</h6>
                        <p className="text-muted">Dolor sit amet</p>
                      </div>
                    </div>
                    <div className="d-flex justify-content-start">
                      <Link to={"#!"}>
                        <Facebook className="me-3"></Facebook>
                      </Link>
                      <Link to={"#!"}>
                        <Twitter className="me-3"></Twitter>
                      </Link>
                      <Link to={"#!"}>
                        <Instagram></Instagram>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditModal
        show={modalOpenEdit}
        handleClose={handleCloseModalEdit}
        handleSubmit={handleEdit}
        handleEditFileChange={handleEditFileChange}
        editedData={editedData}
        selectedFile={selectedFile}
        setEditedData={setEditedData}
        setSelectedFile={setSelectedFile}
        setModalOpenEdit={setModalOpenEdit}
      />
    </section>
  );
};

export default Account;
