import { Col, Row } from "reactstrap";

import Feeds from "../components/dashboard/Feeds";

import Blog from "../components/dashboard/Blog";
import Chart from "../components/dashboard/SalesChart";

import {
  FaCalendarAlt,
  FaUsers,
  FaClock,
  FaHourglass,
  FaHourglassStart,
  FaBuilding,
} from "react-icons/fa"; // นำเข้าไอคอนต่างๆ จาก react-icons
import { useEffect, useState } from "react";
import FileService from "../services/FileService";
import ProductService from "../services/ProductService";
import AuthService from "../services/authService";
import CustomerService from "../services/CustomerService";
import EventService from "../services/EventService";
import StockProductService from "../services/StockProductService";
import moment from "moment";
import { faTimeline } from "@fortawesome/free-solid-svg-icons";

import { useAuth } from "../auth/AuthContext";

const Dashboard = () => {
  const { userData } = useAuth();

  const isAdmin = userData?.role?.toLowerCase() === "admin"; // ✅ รองรับ case-insensitive

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState({});
  const [products, setProducts] = useState({});
  const [stocks, setStocks] = useState({});
  const [customers, setCustomers] = useState({});
  const [users, setUsers] = useState({});
  const [events, setEvents] = useState({});
  useEffect(() => {
    fetchFiles();
    fetchProducts();
    fetchStockProducts();
    fetchUsers();
    fetchEvents();
    fetchCustomers();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await FileService.getUserFiles();
      const files = res.userFiles;

      setFiles(files);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching files:", error);
      setLoading(false);
    }
  };
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await ProductService.getUserProducts();
      const products = res.userProducts;

      setProducts(products);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching files:", error);
      setLoading(false);
    }
  };
  const fetchStockProducts = async () => {
    setLoading(true);
    try {
      const res = await StockProductService.getUserProductStock();
      const stocks = res.userStock;

      setStocks(stocks);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching files:", error);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await AuthService.getAllUserData();
      const users = res.allUser;

      setUsers(users);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching files:", error);
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await CustomerService.getCustomers();
      const customers = res.userCustomers;

      setCustomers(customers);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await EventService.getEvents();
      const events = res.userEvents;

      setEvents(events);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching files:", error);
      setLoading(false);
    }
  };

  const latestEvent = events.length > 0 ? events[0] : null;

  const BlogData = [
    // {
    //   image: bg1,
    //   title: "This is simple blog",
    //   subtitle: "2 comments, 1 Like",
    //   description: "This is a wider card with supporting text below as a natural lead-in to additional content.",
    //   btnbg: "primary",
    //   link: "/event",
    // },

    // {
    //   icon: FaFileAlt,
    //   title: "รวมไฟล์",
    //   subtitle: loading ? "กำลังโหลด..." : Object.keys(files).length + " files",
    //   link: "/files",
    //   iconColor: "#e74c3c",
    //   iconBgColor: "#fde3e3",
    // },
    // {
    //   icon: FaCube,
    //   title: "สินค้า",
    //   subtitle: loading ? "กำลังโหลด..." : Object.keys(products).length + " Row",
    //   link: "/product",
    //   iconColor: "#2ecc71",
    //   iconBgColor: "rgba(22, 160, 133, 0.1)",
    // },
    // {
    //   icon: FaCubes,
    //   title: "สต๊อกสินค้า",
    //   subtitle: loading ? "กำลังโหลด..." : Object.keys(stocks).length + " Row",
    //   link: "/product/stock",
    //   iconColor: "#f39c12",
    //   iconBgColor: "#fef5e7",
    // },
 {
      icon: FaBuilding,
      title: "ลูกค้า",
      subtitle: loading
        ? "กำลังโหลด..."
        : (() => {
            const customerCount = Object.values(customers).length;
      

            return `ลูกค้า: ${customerCount} รายการ`;
          })(),
      link: "/customer",
      iconColor: "#795A47",
      iconBgColor: "rgba(121, 90, 71, 0.1)",
    },
    {
      icon: FaUsers,
      title: "สมาชิก",
      subtitle: loading
        ? "กำลังโหลด..."
        : (() => {
            const employeeCount = Object.values(users).length;
            const adminCount = Object.values(users).filter(
              (u) => u.role === "admin"
            ).length;

            return `พนักงาน: ${employeeCount} | ผู้ดูแล: ${adminCount}`;
          })(),
      link: "/employee",
      iconColor: "#2ecc71",
      iconBgColor: "rgba(22, 160, 133, 0.1)",
    },
   
  ];
  const BlogData2 = [
    // {
    //   icon: FaFileImport,
    //   title: "จัดเก็บไฟล์",
    //   // subtitle: "....",
    //   link: "/fileupload",
    //   iconColor: "#e74c3c", // สีไอคอน
    //   iconBgColor: "#fde3e3",
    // },

    // {
    //   icon: FaBoxOpen,
    //   title: "เพิ่มสินค้า",
    //   // subtitle: "....",
    //   link: "/product",
    //   iconColor: "#2ecc71",
    //   iconBgColor: "rgba(22, 160, 133, 0.1)",
    // },
    {
      icon: FaClock,
      title: "การดำเนินงาน",
      subtitle: loading
        ? "กำลังโหลด..."
        : Object.values(events).length + " รายการ",

      link: "/operation",
      iconColor: "#f39c12",
      iconBgColor: "#fef5e7",
    },
    {
      icon: FaHourglassStart,
      title: "ติดตามงาน",
      subtitle: loading
        ? "กำลังโหลด..."
        : Object.values(events).filter((e) => Boolean(e.quotationFileUrl))
            .length + " รายการ",
      link: "/tackstatus",
      iconColor: "#e74c3c",
      iconBgColor: "#fde3e3",
    },
  ];
  const BlogData3 = [
    {
      icon: FaCalendarAlt,
      title: "แผนงาน",
      subtitle: loading
        ? "กำลังโหลด..."
        : `กำลังรอยืนยัน: ${
            Object.values(events).filter((e) => e.status === "กำลังรอยืนยัน")
              .length
          } | ยืนยันแล้ว: ${
            Object.values(events).filter((e) => e.status === "ยืนยันแล้ว")
              .length
          } | กำลังดำเนินการ: ${
            Object.values(events).filter((e) => e.status === "กำลังดำเนินการ")
              .length
          } | เสร็จสิ้นแล้ว: ${
            Object.values(events).filter(
              (e) => e.status === "ดำเนินการเสร็จสิ้น"
            ).length
          }`,
      link: "/event",
      iconColor: "#3498db",
      iconBgColor: "rgba(51, 105, 232, 0.1)",
    },
  ];

  return (
    <div>
      <Row
        className="flex-wrap"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        {BlogData3.map((blg, index) => (
          <Col key={index} className="col mb-4">
            <Blog
              // image={blg.image}
              link={blg.link}
              icon={blg.icon}
              iconSize={100}
              iconColor={blg.iconColor} // ส่งสีของไอคอน
              iconBgColor={blg.iconBgColor} // ส่งสีพื้นหลังของไอคอน
              title={blg.title}
              subtitle={blg.subtitle}
              // text={blg.description}
              color={blg.btnbg}
            />
          </Col>
        ))}
      </Row>
      {isAdmin && (
        <Row
          className="flex-wrap"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          {BlogData2.map((blg, index) => (
            <Col key={index} className="col mb-4">
              <Blog
                // image={blg.image}
                link={blg.link}
                icon={blg.icon}
                iconSize={100}
                iconColor={blg.iconColor} // ส่งสีของไอคอน
                iconBgColor={blg.iconBgColor} // ส่งสีพื้นหลังของไอคอน
                title={blg.title}
                subtitle={blg.subtitle}
                // text={blg.description}
                color={blg.btnbg}
              />
            </Col>
          ))}
        </Row>
      )}

      {isAdmin && (
        <Row
          className="flex-wrap"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          {/***Blog Cards***/}
          {BlogData.map((blg, index) => (
            <Col key={index} className="col mb-4">
            {/* <Col key={index} className="col col-md-3 col-lg-3 mb-4"> */}
              <Blog
                // image={blg.image}
                link={blg.link}
                icon={blg.icon}
                iconSize={100}
                iconColor={blg.iconColor} // ส่งสีของไอคอน
                iconBgColor={blg.iconBgColor} // ส่งสีพื้นหลังของไอคอน
                title={blg.title}
                subtitle={blg.subtitle}
                // text={blg.description}
                color={blg.btnbg}
                subtitleStyle={blg.subtitleStyle} // ใช้ style ที่กำหนดใน BlogData
              />
            </Col>
          ))}
        </Row>
      )}

      {/* 
      <Row
        className="flex-wrap mt-5"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <Col className="col">
          <Feeds />
        </Col>
        <Col className="col">
          <Chart />
        </Col>
      </Row> */}
    </div>
  );
};

export default Dashboard;
