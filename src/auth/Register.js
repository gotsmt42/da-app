import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Button } from "react-bootstrap";
import Google from "@mui/icons-material/Google";
import Facebook from "@mui/icons-material/Facebook";

import "./form.css";
import API from "../API/axiosInstance";

const Register = () => {
  const [formData, setFormData] = useState({
    fname: "",
    lname: "",
    email: "",
    tel: "",
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleValidation = () => {
    let formIsValid = true;
    let errors = {};

    if (!formData.fname.trim()) {
      formIsValid = false;
      errors.fname = "Please enter your first name.";
    }

    if (!formData.lname.trim()) {
      formIsValid = false;
      errors.lname = "Please enter your last name.";
    }

    if (!formData.email.trim()) {
      formIsValid = false;
      errors.email = "Please enter your email.";
    } else {
      let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.email)) {
        formIsValid = false;
        errors.email = "Please enter a valid email address.";
      }
    }

    if (!formData.tel.trim()) {
      formIsValid = false;
      errors.tel = "Please enter your telephone number.";
    }

    if (!formData.username.trim()) {
      formIsValid = false;
      errors.username = "Please enter your username.";
    }

    if (!formData.password.trim()) {
      formIsValid = false;
      errors.password = "Please enter your password.";
    } else if (formData.password.length < 4) {
      formIsValid = false;
      errors.password = "Password must be at least 4 characters long.";
    }

    setErrors(errors);
    return formIsValid;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!handleValidation()) return;

    setLoading(true);
    try {
      await API.post("/auth/signup", formData);
      Swal.fire({
        icon: "success",
        title: "สมัครสมาชิกสำเร็จ",
        text: "คุณสามารถเข้าสู่ระบบได้ทันที",
        timer: 2000,
      });
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Registration failed", error);
      const errorMessage = error.response?.data?.err || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
      Swal.fire({
        icon: "error",
        title: "Registration failed",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-bg mt-5">
      <div className="container">
        <div className="row">
          <div className="col-md-offset-10 col-md-10 col-sm-offset-10 col-sm-12">
            <div className="form-container">
              <div className="left-content">
                <h3 className="title">Site Name</h3>
                <h4 className="sub-title">Lorem ipsum dolor sit amet.</h4>
              </div>
              <div className="right-content">
                <h3 className="form-title">Register</h3>
                <form className="form-horizontal" onSubmit={handleRegister}>
                  <div className="row">
                    <div className="col">
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          className="form-control"
                          name="fname"
                          value={formData.fname}
                          onChange={handleChange}
                        />
                        <span className="text-danger">{errors.fname}</span>
                      </div>
                    </div>
                    <div className="col">
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          className="form-control"
                          name="lname"
                          value={formData.lname}
                          onChange={handleChange}
                        />
                        <span className="text-danger">{errors.lname}</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-control"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                    <span className="text-danger">{errors.email}</span>
                  </div>

                  <div className="form-group">
                    <label>Tel.</label>
                    <input
                      type="number"
                      className="form-control"
                      name="tel"
                      value={formData.tel}
                      onChange={handleChange}
                    />
                    <span className="text-danger">{errors.tel}</span>
                  </div>

                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      className="form-control"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                    />
                    <span className="text-danger">{errors.username}</span>
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-control"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                    <span className="text-danger">{errors.password}</span>
                  </div>

                  <button className="btn signup" type="submit" disabled={loading}>
                    {loading ? "Signing up..." : "Signup"}
                  </button>
                </form>

                <span className="separator">OR</span>
                <ul className="social-links">
                  <li>
                    <Button variant="danger">
                      <Google /> Login with Google
                    </Button>
                  </li>
                  <li>
                    <Button variant="primary">
                      <Facebook /> Login with Facebook
                    </Button>
                  </li>
                </ul>

                <span className="signup-link">
                  Already have an account? Sign in <Link to={"/login"}>here</Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
