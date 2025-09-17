import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import API from "../API/axiosInstance";

import "./form.css";
import Google from "@mui/icons-material/Google";
import { Button } from "react-bootstrap";
import { Facebook } from "@mui/icons-material";

import { useAuth } from "./AuthContext";



const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});

const { login, isLoggedIn } = useAuth(); // ✅ เพิ่ม isLoggedIn

useEffect(() => {
  if (isLoggedIn) {
    navigate("/", { replace: true }); // หรือ "/dashboard"
  }
}, [isLoggedIn, navigate]);


  const handleValidation = () => {
    let formIsValid = true;
    let errors = {};

    // Validate Username
    if (!username) {
      formIsValid = false;
      errors["username"] = "Please enter your username or email.";
    }

    // Validate Password
    if (!password) {
      formIsValid = false;
      errors["password"] = "Please enter your password.";
    }

    setErrors(errors);
    return formIsValid;
  };
  // const handleLogin = async (e) => {
  //   e.preventDefault();
    
  //   if (handleValidation()) {
  //     try {
  //       const response = await API.post(`/auth/login`, { username, password });
  //       const { token, payload } = response.data;
  
  //       login(token, payload);
  //       Swal.fire({
  //         icon: "success",
  //         title: "เข้าสู่ระบบสำเร็จ!",
  //         text: `ยินดีต้อนรับ, ${payload.fname} ${payload.lname}`,
  //       });
  
  //       navigate("/dashboard");
  //     } catch (error) {
  //       console.error("🔴 Login failed", error);
  //       Swal.fire({
  //         icon: "error",
  //         title: "เข้าสู่ระบบล้มเหลว",
  //         text: error.response.data.err || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  //       });
  //     }
  //   }
  // };
  
  const handleLogin = async (e) => {
  e.preventDefault();

  if (handleValidation()) {
    try {
      const response = await API.post(`/auth/login`, { username, password });

      // ✅ ตรวจสอบว่ามี response และมี data
      if (response?.data?.token && response?.data?.payload) {
        const { token, payload } = response.data;

        login(token, payload);

        Swal.fire({
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ!",
          text: `ยินดีต้อนรับ, ${payload.fname} ${payload.lname}`,
        });

        navigate("/dashboard");
      } else {
        Swal.fire({
          icon: "error",
          title: "เข้าสู่ระบบล้มเหลว",
          text: "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่",
        });
      }
    } catch (error) {
      console.error("🔴 Login failed", error);

      const errMsg =
        error?.response?.data?.err ||
        error?.response?.data?.message ||
        error?.message ||
        "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

      Swal.fire({
        icon: "error",
        title: "เข้าสู่ระบบล้มเหลว",
        text: errMsg,
      });
    }
  }
};


  return (
    <div className="form-bg mt-5">
      <div className="container">
        <div className="row">
          <div className="col-md-offset-10 col-md-10 col-sm-offset-10 col-sm-12">
            <div className="form-container">
              <div className="left-content">
                <h2 className="title">Da App</h2>
                <h4 className="sub-title">
                  ระบบบริหารการจัดการส่วนต่างๆของหลังบ้าน
                </h4>
              </div>
              <div className="right-content">
                <h3 className="form-title">Login</h3>
                <form className="form-horizontal" onSubmit={handleLogin}>
                  <div className="form-group">
                    <label>Username / Email</label>
                    <input
                      type="text"
                      className="form-control"
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <span className="text-danger">{errors["username"]}</span>
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-control"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span className="text-danger">{errors["password"]}</span>
                  </div>
                  <button className="btn signin" type="submit">
                    Login
                  </button>
                  <div className="remember-me">
                    <input type="checkbox" className="checkbox" />
                    <span className="check-label">Remember Me</span>
                  </div>
                  <Link className="forgot">Forgot Password</Link>
                </form>
                {/* <span className="separator">OR</span> */}
                {/* <ul className="social-links">
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
                </ul> */}
                {/* <span className="signup-link">
                  Don't have an account? Sign up{" "}
                  <Link to={"/register"}>here</Link>
                </span> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
