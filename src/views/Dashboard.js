import { Col, Row } from "reactstrap";

import Feeds from "../components/dashboard/Feeds";

import Blog from "../components/dashboard/Blog";
import Chart from "../components/dashboard/SalesChart";

import {
  FaCube,
  FaCubes,
  FaCalendarAlt,
  FaFileAlt,
  FaUserAlt,
  FaFileImport,
  FaBoxOpen,
  FaBoxes,
  FaUsers,
  FaTimesCircle,
  FaTimes,
  FaClock,
} from "react-icons/fa"; // นำเข้าไอคอนต่างๆ จาก react-icons
import { useEffect, useState } from "react";
import FileService from "../services/FileService";
import ProductService from "../services/ProductService";
import AuthService from "../services/authService";
import EventService from "../services/EventService";
import StockProductService from "../services/StockProductService";
import moment from "moment";
import { faTimeline } from "@fortawesome/free-solid-svg-icons";

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState({});
  const [products, setProducts] = useState({});
  const [stocks, setStocks] = useState({});
  const [users, setUsers] = useState({});
  const [events, setEvents] = useState({});
  useEffect(() => {
    fetchFiles();
    fetchProducts();
    fetchStockProducts();
    fetchUsers();
    fetchEvents();
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
      icon: FaUsers,
      title: "จัดการสมาชิก",
      subtitle: loading ? "กำลังโหลด..." : Object.keys(users).length + " More",
      link: "/customer-employee",
      iconColor: "#795A47", // สีไอคอน
      iconBgColor: "rgba(121, 90, 71, 0.1)", // สีพื้นหลังไอคอน
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
    // {
    //   icon: FaClock,
    //   title: "การดำเนินงาน",
    //   subtitle: loading ? "กำลังโหลด..." : Object.keys(events).length + " more",
    //   link: "/operation",
    //   iconColor: "#f39c12", // สีไอคอน
    //   iconBgColor: "#fef5e7",
    // },
    
  ];
  const BlogData3 = [
    {
      icon: FaCalendarAlt,
      title: "แผนงาน",
      subtitle: loading ? "กำลังโหลด..." : Object.keys(events).length + " events",
      link: "/event",
      iconColor: "3498db", // สีไอคอน
      iconBgColor: "rgba(51, 105, 232, 0.1)", // สีพื้นหลังไอคอน

      subtitleStyle: { fontSize: "5px" }, // เพิ่ม style สำหรับ subtitle

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
    
      <Row
        className="flex-wrap"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        {/***Blog Cards***/}
        {BlogData.map((blg, index) => (
          <Col key={index} className="col col-md-3 col-lg-3 mb-4">
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
