import { useState, useEffect } from "react";
import { Nav, NavItem, Collapse } from "reactstrap";
import { Link, useLocation } from "react-router-dom";
import {
  BiChevronDown,
  BiChevronRight,
  BiUpload,
  BiFile,
  BiLogoProductHunt,
  BiOutline,
  BiBox,
} from "react-icons/bi"; // Import icons from React Icons

import { LuFileStack } from "react-icons/lu";

import { IoFileTrayFullOutline } from "react-icons/io5";

import { FaProductHunt } from "react-icons/fa";

import { CiBoxList } from "react-icons/ci";

import probg from "../assets/images/bg/download.jpg";

import AuthService from "../services/authService";
import API from "../API/axiosInstance";

import "./Sidebar.css";

import Swal from "sweetalert2";
import { swalLogout } from "../functions/user";
import { useAuth } from "../auth/AuthContext";



const Sidebar = ({ handleMenuClick }) => {
  const [collapsedMenu, setCollapsedMenu] = useState({});
  const location = useLocation();

  const { userData, logout } = useAuth();

  const isAdmin = userData?.role?.toLowerCase() === "admin"; // ✅ รองรับ case-insensitive

  const [user, setUser] = useState({});
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


  const navigation = [
  {
    title: "DASHBOARD",
    href: "/dashboard",
    icon: "bi-speedometer2",
  },
  {
    title: "แผนงาน",
    href: "/event",
    icon: "bi-calendar-event-fill",
  },
    {
    title: "การดำเนินงาน",
    href: "/operation",
    icon: "bi-clock-fill",
  },
  ]
    const navigation2= [

  {
    title: "ติดตามงาน",
    href: "/tackstatus",
    icon: "bi-hourglass-top",
  },
    ]
  // {
  //   title: "File",
  //   icon: <IoFileTrayFullOutline />,
  //   items: [
  //     {
  //       title: "File Upload",
  //       href: "/fileupload",
  //       icon: BiUpload,
  //     },
  //     {
  //       title: "All Files",
  //       href: "/files",
  //       icon: LuFileStack,
  //     },
  //   ],
  // },
  // {
  //   title: "Product",
  //   icon: <FaProductHunt />,
  //   items: [
  //     {
  //       title: "List Product",
  //       href: "/product",
  //       icon: CiBoxList,
  //     },
  //     {
  //       title: "Stock Product",
  //       href: "/product/stock",
  //       icon: BiOutline,
  //     },
  //   ],
  // },


  const toggleNavbar = (index) => {
    setCollapsedMenu({
      ...collapsedMenu,
      [index]: !collapsedMenu[index],
    });
  };

  const handleLogout = async () => {
    await swalLogout().then((result) => {
      if (result.isConfirmed) {
        logout();
        Swal.fire("Logout Success!", "", "success");
      }
    });
  };

  return (
    <div className="sidebar-container">
      <div
        className="profilebg"
        style={{ background: `url(${probg}) no-repeat` }}
      >
        <div className="p-3 d-flex">
          <Link to={"/account"}>
            <img
              src={user.imageUrl}
              alt="user"
              width="50"
              height="50"
              className="rounded-circle"
            />
          </Link>
        </div>
        <div className="bg-dark text-white p-2 opacity-75">
          {user.fname} {user.lname} ({user.role})
        </div>
      </div>

      {/* เนื้อหา Sidebar */}
      <div className="p-3 mt-2 sidebar-content">
        <Nav vertical className="sidebarNav">
          {navigation.map((navi, index) => (
            <NavItem key={index} className="sidenav-bg ">
              {navi.items ? (
                <>
                  <button
                    color="link"
                    className="nav-link py-3"
                    onClick={() => toggleNavbar(index)}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <i className={`bi ${navi.icon}`}></i>
                    <span className="ms-2 me-1">{navi.title}</span>
                    {collapsedMenu[index] ? (
                      <BiChevronDown />
                    ) : (
                      <BiChevronRight />
                    )}
                  </button>

                  <Collapse
                    isOpen={collapsedMenu[index]}
                    style={{ paddingLeft: "21px" }}
                  >
                    {navi.items.map((item, idx) => (
                      <Link
                        key={idx}
                        className={`mt-0 my-1 nav-link ${
                          location.pathname === item.href ? "active" : ""
                        }`}
                        to={item.href}
                        style={{ textDecoration: "none" }}
                        onClick={handleMenuClick}
                      >
                        {item.icon && <item.icon />} {item.title}
                      </Link>
                    ))}
                  </Collapse>
                </>
              ) : (
                <Link
                  to={navi.href}
                  className={`nav-link py-3 ${
                    location.pathname === navi.href ? "active" : ""
                  }`}
                  onClick={handleMenuClick}
                >
                  <i className={`bi ${navi.icon}`}></i>
                  <span className="ms-2">{navi.title}</span>
                </Link>
              )}
            </NavItem>
          ))}
{isAdmin && navigation2.map((navi, index) => (
            <NavItem key={index} className="sidenav-bg ">
              {navi.items ? (
                <>
                  <button
                    color="link"
                    className="nav-link py-3"
                    onClick={() => toggleNavbar(index)}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <i className={`bi ${navi.icon}`}></i>
                    <span className="ms-2 me-1">{navi.title}</span>
                    {collapsedMenu[index] ? (
                      <BiChevronDown />
                    ) : (
                      <BiChevronRight />
                    )}
                  </button>

                  <Collapse
                    isOpen={collapsedMenu[index]}
                    style={{ paddingLeft: "21px" }}
                  >
                    {navi.items.map((item, idx) => (
                      <Link
                        key={idx}
                        className={`mt-0 my-1 nav-link ${
                          location.pathname === item.href ? "active" : ""
                        }`}
                        to={item.href}
                        style={{ textDecoration: "none" }}
                        onClick={handleMenuClick}
                      >
                        {item.icon && <item.icon />} {item.title}
                      </Link>
                    ))}
                  </Collapse>
                </>
              ) : (
                <Link
                  to={navi.href}
                  className={`nav-link py-3 ${
                    location.pathname === navi.href ? "active" : ""
                  }`}
                  onClick={handleMenuClick}
                >
                  <i className={`bi ${navi.icon}`}></i>
                  <span className="ms-2">{navi.title}</span>
                </Link>
              )}
            </NavItem>

            
          ))}
        </Nav>
      </div>
        
      {/* ส่วนที่ fixed ด้านล่าง */}
      {isAdmin && (
        <div className="sidebar-fixed-bottom p-3 mt-2">
          <NavItem className="sidenav-bg ">
            <Link
              to="/customer"
              // className={`centered-button nav-link py-3 ${
              className={`nav-link py-3 ${
                location.pathname === "/customer" ? "active" : ""
              }`}
              onClick={handleMenuClick}
            >
              <i className="bi bi-building-fill ms-3"></i>
              <span className="ms-2">Customer</span>
            </Link>
          </NavItem>
          <NavItem className="sidenav-bg ">
            <Link
              to="/employee"
              className={`nav-link py-3 ${
                location.pathname === "/employee" ? "active" : ""
              }`}
              onClick={handleMenuClick}
            >
              <i className="bi bi-people-fill ms-3"></i>
              <span className="ms-2">EMPLOYEE</span>
            </Link>
          </NavItem>

          <NavItem className="sidenav-bg">
            <Link
              to="/about"
              className={`nav-link py-3 ${
                location.pathname === "/about" ? "active" : ""
              }`}
              onClick={handleMenuClick}
            >
              <i className="bi bi-gear-fill ms-3"></i>
              <span className="ms-2">SETTINGS</span>
            </Link>
          </NavItem>
        </div>
      )}

      <div className="sidebar-fixed-bottom  text-lg-start p-3 mt-2">
        <NavItem className="sidenav-bg">
          <Link className="nav-link py-3" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right ms-3"></i>
            <span className="ms-2">LOGOUT</span>
          </Link>
        </NavItem>
      </div>
    </div>
  );
};

export default Sidebar;
