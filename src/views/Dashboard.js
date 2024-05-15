import { Col, Row } from "reactstrap";

import Event from "../views/ui/EventCalendar";
// import SalesChart from "../components/dashboard/SalesChart";
import Feeds from "../components/dashboard/Feeds";

import Blog from "../components/dashboard/Blog";

import { FaImage, FaCoffee, FaApple, FaCarrot, FaCalendar, FaFile } from "react-icons/fa"; // นำเข้าไอคอนต่างๆ จาก react-icons

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
    icon: FaCalendar,
    title: "ตารางแผนงาน",
    subtitle: "อัพเดทเมื่อ...",
    link: "/event",
    iconColor: "3498db", // สีไอคอน
    iconBgColor: "#ecf0f1", // สีพื้นหลังไอคอน

  },
  {
    icon: FaFile,
    title: "รวมไฟล์",
    subtitle: "464 ไฟล์",
    link: "/files",
    iconColor: "#e74c3c",
    iconBgColor: "#fde3e3",

  },
  {
    icon: FaApple,
    title: "สินค้าทั้งหมด",
    subtitle: "521 EA",
    link: "/product",
    iconColor: "#2ecc71",
    iconBgColor: "#e8f5e9",
  },
  {
    icon: FaCarrot,
    title: "สต๊อกสินค้า",
    subtitle: "65 EA",
    link: "/event/4",
    iconColor: "#f39c12",
    iconBgColor: "#fef5e7",
  },
];
const BlogData2 = [
  {
    icon: FaCalendar,
    title: "ตารางผู้ใช้งาน",
    subtitle: "20 Users",
    link: "/usertable",
    iconColor: "#A02BFF", // สีไอคอน
    iconBgColor: "#ecf0f1", // สีพื้นหลังไอคอน

  },

];

const Dashboard = () => {
  return (
    <div>

      <Row>
        {/***Blog Cards***/}
        {BlogData.map((blg, index) => (
          <Col sm="6" lg="6" xl="3" key={index}>
            <Blog
              // image={blg.image}
              link={blg.link}
              icon={blg.icon}
              iconSize={100}
              iconColor={blg.iconColor} // ส่งสีของไอคอน
              // iconBgColor={blg.iconBgColor} // ส่งสีพื้นหลังของไอคอน
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

      <Row>
        {/***Blog Cards***/}
        {BlogData2.map((blg, index) => (
          <Col sm="6" lg="6" xl="3" key={index}>
            <Blog
              link={blg.link}
              icon={blg.icon}
              iconSize={100}
              iconColor={blg.iconColor} // ส่งสีของไอคอน
              // iconBgColor={blg.iconBgColor} // ส่งสีพื้นหลังของไอคอน
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
