import { Col, Row } from "reactstrap";

import Event from "../views/ui/EventCalendar";
// import SalesChart from "../components/dashboard/SalesChart";
import Feeds from "../components/dashboard/Feeds";

import Blog from "../components/dashboard/Blog";

import { FaImage, FaCoffee, FaApple, FaCarrot, FaCalendar, FaFile, FaCube, FaCubes, FaUser, FaProductHunt, FaCalendarAlt, FaFileAlt, FaUserAlt } from "react-icons/fa"; // นำเข้าไอคอนต่างๆ จาก react-icons
import { faBoxes, faCubesStacked } from "@fortawesome/free-solid-svg-icons";

const BlogData = [
  // {
  //   image: bg1,
  //   title: "This is simple blog",
  //   subtitle: "2 comments, 1 Like",
  //   description: "This is a wider card with supporting text below as a natural lead-in to additional content.",
  //   btnbg: "primary",
  //   link: "/event",
  // },
  {
    icon: FaCalendarAlt,
    title: "ตารางแผนงาน",
    subtitle: "อัพเดทเมื่อ...",
    link: "/event",
    iconColor: "3498db", // สีไอคอน
    iconBgColor: "rgba(51, 105, 232, 0.1)", // สีพื้นหลังไอคอน

  },
  {
    icon: FaFileAlt,
    title: "รวมไฟล์",
    subtitle: "464 ไฟล์",
    link: "/files",
    iconColor: "#e74c3c",
    iconBgColor: "#fde3e3",

  },
  {
    icon: FaProductHunt,
    title: "สินค้าทั้งหมด",
    subtitle: "521 EA",
    link: "/product",
    iconColor: "#2ecc71",
    iconBgColor: "rgba(22, 160, 133, 0.1)",
  },
  {
    icon: FaCubes,
    title: "สต๊อกสินค้า",
    subtitle: "65 EA",
    link: "/product/stock",
    iconColor: "#f39c12",
    iconBgColor: "#fef5e7",
  },
];
const BlogData2 = [
  {
    icon: FaUserAlt,
    title: "ตารางผู้ใช้งาน",
    subtitle: "20 Users",
    link: "/usertable",
    iconColor: "#795A47", // สีไอคอน
    iconBgColor: "rgba(121, 90, 71, 0.1)", // สีพื้นหลังไอคอน

  },

];

const Dashboard = () => {
  return (
    <div>

<Row className="flex-wrap" style={{ display: 'flex', justifyContent: 'space-between' }}>
        {/***Blog Cards***/}
        {BlogData.map((blg, index) => (
          <Col key={index} className="col-12 col-md-6 col-lg-4 col-xl-2.4 mb-4">
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
        {/* <Col sm="6" lg="6" xl="5" xxl="4" style={{ marginTop: "2rem" }}>
          <Feeds />
        </Col> */}
      </Row>

      <p></p>
      <p></p>

      <Row className="flex-wrap" style={{ display: 'flex', justifyContent: 'space-between' }}>
        {/***Blog Cards***/}
        {BlogData2.map((blg, index) => (
          <Col key={index} className="col-12 col-md-6 col-lg-4 col-xl-2.4 mb-4">
          <Blog
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
        {/* <Col sm="6" lg="6" xl="5" xxl="4" style={{ marginTop: "2rem" }}>
          <Feeds />
        </Col> */}
      </Row>
    
    </div>
  );
};

export default Dashboard;
