import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { useAuth } from "../auth/AuthContext";
import './Header.css'
import {
  Navbar,
  Nav,
  NavItem,
  NavbarBrand,
  UncontrolledDropdown,
  DropdownToggle,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Button,
} from "reactstrap";
import { swalLogout } from "../functions/user";
import Swal from "sweetalert2";
import API from "../API/axiosInstance";

const Header = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // ตรวจสอบว่าเป็นมือถือหรือไม่

  useEffect(() => {
    const getUserData = async () => {
      try {
        const getUser = await AuthService.getUserData();
        // console.log(getUser); // เพิ่มบรรทัดนี้เพื่อตรวจสอบข้อมูลผู้ใช้
        setUser(getUser.user);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    
    getUserData();

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  const toggle = () => setDropdownOpen((prevState) => !prevState);
  const showMobileMenu = () => {
    const sidebar = document.getElementById("sidebarArea");
    console.log("Toggling sidebar:", sidebar.classList.contains("showSidebar"));
    sidebar.classList.toggle("showSidebar");
  };
  

  const handleLogout = async () => {
    const result = await swalLogout();
    if (result.isConfirmed) {
      logout();
      Swal.fire("Logout Success!", "", "success");
    }
  };

  return (
    <Navbar dark expand="md" className="fix-header">
      <div className="d-flex align-items-center justify-content-between w-100">
        <NavbarBrand tag={Link} to="/dashboard" className="m-0">
         <div className="d-flex align-items-center gradiant-bg" >
  <img src="logo-dark-2.png" alt="Logo" className="logo" />
  {/* <h2 className="ms-2" style={{ margin: 0 }}>System Service</h2> */}
</div>

        </NavbarBrand>

        <Nav className="navbar-nav mx-auto" navbar>
          <NavItem>
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
          </NavItem>
          <NavItem>
            <Link to="/event" className="nav-link">Event</Link>
          </NavItem>
          {/* <NavItem>
            <Link to="/about" className="nav-link">About</Link>
          </NavItem> */}
          {/* <UncontrolledDropdown inNavbar nav>
            <DropdownToggle caret nav>Menu</DropdownToggle>
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
          </UncontrolledDropdown> */}
        </Nav>

        {/* Conditional rendering of profile-img */}
        {!isMobile && ( // If not mobile, show profile-img
          <div className="profile-img">
            <Dropdown isOpen={dropdownOpen} toggle={toggle}>
              <DropdownToggle color="transparent">
                <img
                  src={user.imageUrl}
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
        )}

        <Button
          style={{ backgroundColor: "transparent", border: "none" }}
          className="d-lg-none hamburger-toggle" 
          onClick={showMobileMenu}
        >
          <i className="bi bi-list"></i>
        </Button>
      </div>
    </Navbar>
  );
};

export default Header;
