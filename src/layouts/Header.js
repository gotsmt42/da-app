import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { useAuth } from "../auth/AuthContext";

import './็Header.css'
import {
  Navbar,
  Collapse,
  Nav,
  NavItem,
  NavbarBrand,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Dropdown,
  Button,
} from "reactstrap";
// import Logo from "./Logo";
// import { ReactComponent as LogoWhite } from "../assets/images/logos/materialprowhite.svg";
import { swalLogout } from "../functions/user";
import Swal from "sweetalert2";

import API from "../API/axiosInstance";

const Header = () => {
  const navigate = useNavigate();

  const { logout } = useAuth();
  const [user, setUser] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const getUserData = async () => {
      try {
        const getUser = await AuthService.getUserData();
        setUser(getUser.user);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    getUserData();
  }, []);

  const toggle = () => setDropdownOpen((prevState) => !prevState);
  const Handletoggle = () => setIsOpen(!isOpen);
  const showMobilemenu = () => {
    document.getElementById("sidebarArea").classList.toggle("showSidebar");
  };

  const handleClickOutside = (e) => {
    if (!e.target.closest(".navbar")) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await swalLogout().then((result) => {
      if (result.isConfirmed) {
        logout();
        Swal.fire("Logout Success!", "", "success");
      }
    });
  };

  return (
    <Navbar dark expand="md" className="fix-header">
  <div className="d-flex align-items-center justify-content-between w-100">
    <div className="d-lg-block d-none me-2 pe-3">{/* <Logo /> */}</div>

    <NavbarBrand tag={Link} to="/dashboard" className="m-0">
      <div className="d-flex align-items-center gradiant-bg">
        <img 
          src="logo512.png" 
          alt="Logo" 
          className="logo"
        />
        <h2 className="ms-2">System Service </h2> {/* เพิ่มข้อความถัดจากโลโก้ */}
      </div>
    </NavbarBrand>

        <Nav className="navbar-nav mx-auto" navbar> {/* จัดกลาง */}
          <NavItem>
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
          </NavItem>
          <NavItem>
            <Link to="/event" className="nav-link">
              Event
            </Link>
          </NavItem>
          <NavItem>
            <Link to="/about" className="nav-link">
              About
            </Link>
          </NavItem>
          <UncontrolledDropdown inNavbar nav>
            <DropdownToggle caret nav>
              Menu
            </DropdownToggle>
            <DropdownMenu end>
              <Link to="/files" style={{ textDecoration: "none" }}>
                <DropdownItem>Files</DropdownItem>
              </Link>
              <Link to="/product" style={{ textDecoration: "none" }}>
                <DropdownItem>Product</DropdownItem>
              </Link>
              <DropdownItem divider />
              <Link to="/dashboard" style={{ textDecoration: "none" }}>
                <DropdownItem>Reset</DropdownItem>
              </Link>
            </DropdownMenu>
          </UncontrolledDropdown>
        </Nav>

        <div className="profile-img"> {/* เพิ่ม div สำหรับรูปโปรไฟล์ */}
          <Dropdown isOpen={dropdownOpen} toggle={toggle}>
            <DropdownToggle color="transparent">
              <img
                src={`${API.defaults.baseURL}/${user.imageUrl}`}
                alt="profile"
                className="rounded-circle"
                width="30"
                height="30"
              />
            </DropdownToggle>
            <DropdownMenu>
              <DropdownItem header>Info</DropdownItem>
              <Link to={"/account"} style={{ textDecoration: "none" }}>
                <DropdownItem>My Account</DropdownItem>
              </Link>
              <DropdownItem divider />
              <DropdownItem onClick={handleLogout}>Logout</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <Button
          style={{
            backgroundColor: "transparent",
            border: "none",
          }}
          className="d-lg-none"
          onClick={() => showMobilemenu()}
        >
          <i className="bi bi-list"></i>
        </Button>
      </div>

   

    </Navbar>
  );
};

export default Header;


