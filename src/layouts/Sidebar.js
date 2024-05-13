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

const navigation = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "bi-speedometer2",
  },
  {
    title: "ตารางแผนงาน",
    href: "/event",
    icon: "bi-calendar-event",
  },

  {
    title: "File",
    icon: <IoFileTrayFullOutline />,
    items: [
      {
        title: "File Upload",
        href: "/fileupload",
        icon: BiUpload,
      },
      {
        title: "All Files",
        href: "/files",
        icon: LuFileStack,
      },
    ],
  },
  {
    title: "Product",
    icon: <FaProductHunt />,
    items: [
      {
        title: "List Product",
        href: "/product",
        icon: CiBoxList,
      },
      {
        title: "Stock Product",
        href: "/stock",
        icon: BiOutline,
      },
    ],
  },

  {
    title: "About",
    href: "/about",
    icon: "bi-people",
  },
];

const Sidebar = ({handleMenuClick}) => {
  
  const [collapsedMenu, setCollapsedMenu] = useState({});
  const location = useLocation();

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
  


  }, []); // เมื่อ user เปลี่ยนแปลงให้เรียกใช้ useEffect ใหม่

  // const getUserData = async () => {
  //   const getUser = await AuthService.getUserData();
  //   setUser(getUser.user);
  // };

  const toggleNavbar = (index) => {
    setCollapsedMenu({
      ...collapsedMenu,
      [index]: !collapsedMenu[index],
    });
  };

  return (
    <div>
      <div
        className="profilebg"
        style={{ background: `url(${probg}) no-repeat` }}
      >
        <div className="p-3 d-flex">
          <Link to={"/account"}>
            <img
              src={`${API.defaults.baseURL}/${user.imageUrl}`}
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
      <div className="p-3 mt-2 ">
        <Nav vertical className="sidebarNav">
          {navigation.map((navi, index) => (
            <NavItem key={index} className="sidenav-bg ">
              {navi.items ? (
                <>
                  <button
                    color="link"
                    className="nav-link py-3 "
                    onClick={() => toggleNavbar(index)} // นี่คือส่วนที่เรียกใช้ toggleNavbar
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    {navi.icon}
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
                        to={item.href} // นี่คือส่วนที่ให้ลิงก์ไปยังหน้าต่าง ๆ
                        style={{ textDecoration: "none" }}
                        onClick={handleMenuClick} // เรียกใช้ handleMenuClick เมื่อคลิกที่ลิงก์

                      >
                        {item.icon && <item.icon />}{" "}
                        {/* Render icon component */}
                        {item.title}
                      </Link>
                    ))}
                  </Collapse>
                </>
              ) : (
                <Link
                  to={navi.href} // นี่คือส่วนที่ให้ลิงก์ไปยังหน้าต่าง ๆ
                  className={`nav-link py-3 ${
                    location.pathname === navi.href ? "active" : ""
                  }`}

                  onClick={handleMenuClick} // เรียกใช้ handleMenuClick เมื่อคลิกที่ลิงก์

                >
                  <i className={`bi ${navi.icon}`}></i>
                  <span className="ms-2">{navi.title}</span>
                </Link>
              )}
            </NavItem>
          ))}
        </Nav>
      </div>
    </div>
  );
};

export default Sidebar;
