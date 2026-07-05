import { Col, Row, Container, Spinner } from "reactstrap";
import {
  FaCalendarAlt,
  FaUsers,
  FaBuilding,
  FaFileAlt,
  FaWrench,
  FaChevronRight,
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
  FaArrowRight
} from "react-icons/fa";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FileService from "../services/FileService";
import WorkOrderService from "../services/workOrderService";
import AuthService from "../services/authService";
import CustomerService from "../services/CustomerService";
import EventService from "../services/EventService";
import { useAuth } from "../auth/AuthContext";

const Dashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userData?.role?.toLowerCase() === "admin";

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      setLoading(true);
      try {
        const [resFiles, resJobs, resUsers, resCustomers, resEvents] = await Promise.all([
          FileService.getUserFiles().catch(() => ({ userFiles: [] })),
          WorkOrderService.getMyJobs().catch(() => []),
          AuthService.getAllUserData().catch(() => ({ allUser: [] })),
          CustomerService.getCustomers().catch(() => ({ userCustomers: [] })),
          EventService.getEvents().catch(() => ({ userEvents: [] })),
        ]);

        setFiles(resFiles?.userFiles || []);
        setWorkOrders(resJobs || []);
        setUsers(resUsers?.allUser || []);
        setCustomers(resCustomers?.userCustomers || []);
        setEvents(resEvents?.userEvents || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllDashboardData();
  }, []);

  const countStatus = (status) => events.filter(e => e.status === status).length;

  // 🎨 แยกเฉดสีละมุน (ซอฟต์ลงสำหรับพื้นหลังเข้ม) และผูกไอคอนประจำสถานะ
  const statusItems = [
    { 
      label: "รอยืนยัน", 
      count: countStatus("กำลังรอยืนยัน"), 
      color: "#ffedd5", // ส้มพาสเทล
      icon: <FaExclamationCircle size={10} style={{ color: "#f97316" }} />, 
      bg: "rgba(139, 92, 246, 0.15)" 
    },
    { 
      label: "ยืนยันแล้ว", 
      count: countStatus("ยืนยันแล้ว"), 
      color: "#dbeafe", // ฟ้าพาสเทล
      icon: <FaCheckCircle size={10} style={{ color: "#3b82f6" }} />, 
      bg: "rgba(139, 92, 246, 0.15)" 
    },
    { 
      label: "กำลังทำ", 
      count: countStatus("กำลังดำเนินการ"), 
      color: "#ede9fe", // ม่วงพาสเทล
      icon: <FaClock size={10} style={{ color: "#a78bfa" }} />, 
      bg: "rgba(139, 92, 246, 0.15)" 
    },
    { 
      label: "เสร็จสิ้น", 
      count: countStatus("ดำเนินการเสร็จสิ้น"), 
      color: "#d1fae5", // เขียวพาสเทล
      icon: <FaCheckCircle size={10} style={{ color: "#10b981" }} />, 
      bg: "rgba(139, 92, 246, 0.15)" 
    }
  ];

  return (
    <Container fluid style={styles.container}>
      {/* ─── SECTION 1: TOP APP BAR PROFILE ─── */}
      <div style={styles.topAppBar}>
        <div style={styles.userInfo}>
          <div style={styles.avatarPlaceholder}>
            {userData?.fname ? userData.fname.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <span style={styles.welcomeSub}>ยินดีต้อนรับ</span>
            <h2 style={styles.welcomeTitle}>{userData?.fname || "ผู้ใช้งาน"}</h2>
          </div>
        </div>
        <span style={styles.roleBadge}>{userData?.role || "User"}</span>
      </div>

      {/* ─── SECTION 2: HERO ACTION CARD (ฝังป้ายสถานะแยกสีแบบสะอาดตา) ─── */}
      <div 
        onClick={() => navigate("/event")}
        style={styles.bigHeroButton}
        className="action-hero-btn"
      >
        <div style={styles.heroButtonContent}>
          <div style={styles.heroIconCircle}>
            <FaCalendarAlt size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={styles.heroBtnTitle}>ปฏิทินและแผนงานทั้งหมด</h3>
              <FaArrowRight size={13} className="arrow-bounce" style={{ opacity: 0.8 }} />
            </div>
            <p style={styles.heroBtnSub}>ตรวจสอบตารางนัดหมายและจัดการสถานะงานระบบกลาง</p>
          </div>
        </div>

        {/* 📊 บาร์สถานะงาน: แยกเฉดสี + มีไอคอนกำกับแบบ Mini ไม่แย่งซีน */}
        <div style={styles.heroStatusInlineGrid}>
          {statusItems.map((item, i) => (
            <div key={i} style={{ ...styles.inlineStatusBadge, backgroundColor: item.bg }}>
              <span style={styles.inlineStatusLabel}>{item.label}</span>
              <div style={styles.countWrapper}>
                {item.icon}
                <span style={{ ...styles.inlineStatusCount, color: item.color }}>
                  {loading ? "..." : item.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── SECTION 3: PERSONAL TASKS (Service Reports เด่นรองลงมา) ─── */}
      <h5 style={styles.sectionTitle}>การปฏิบัติงาน</h5>
      <Row className="g-2 mb-2">
        {[

            {
            title: "การดำเนินงาน",
            // count: EventService.getEventOp.length,
            desc: "การดำเนินงานทั้งหมด",
            link: "/operation",
            icon: <FaWrench size={18} />,
            theme: "#6366f1",
            isFeatured: true
          },
          {
            title: "เอกสารทั้งหมด",
            count: files.length,
            desc: "เอกสารรายงานการบริการในระบบ",
            link: "/files",
            icon: <FaFileAlt size={20} />,
            theme: "#475569",
            isFeatured: false
          },
    
        ].map((card, idx) => (
          <Col xs="12" key={idx}>
            <Link to={card.link} style={{ textDecoration: 'none' }}>
              <div 
                style={{ 
                  ...styles.metricCard, 
                  ...(card.isFeatured ? styles.featuredMetricCard : {}) 
                }} 
                className="metric-card-hover"
              >
                <div style={styles.cardContent}>
                  <div style={{ 
                    ...styles.iconContainer, 
                    backgroundColor: card.isFeatured ? "rgba(255,255,255,0.2)" : `${card.theme}15`, 
                    color: card.isFeatured ? "#ffffff" : card.theme 
                  }}>
                    {card.icon}
                  </div>
                  <div>
                    <h4 style={{ ...styles.cardTitle, color: card.isFeatured ? "#ffffff" : "#0f172a" }}>{card.title}</h4>
                    <p style={{ ...styles.cardDesc, color: card.isFeatured ? "rgba(255,255,255,0.8)" : "#64748b" }}>{card.desc}</p>
                  </div>
                </div>
                <div style={styles.cardRight}>
                  <span style={{ ...styles.bigNumber, color: card.isFeatured ? "#ffffff" : card.theme }}>
                    {loading ? <Spinner size="sm" color="secondary" /> : card.count}
                  </span>
                  <FaChevronRight style={{ ...styles.arrowIcon, color: card.isFeatured ? "rgba(255,255,255,0.6)" : "#94a3b8" }} />
                </div>
              </div>
            </Link>
          </Col>
        ))}
      </Row>

      {/* ─── SECTION 4: ADMIN CONTROLS ─── */}
      {isAdmin && (
        <>
          <h5 style={styles.sectionTitle}>การจัดการระบบสำหรับ Admin</h5>
          <Row className="g-2">
            {[
              {
                title: "ฐานข้อมูลลูกค้า",
                count: customers.length,
                desc: "พันธมิตรและคู่ค้าทั้งหมด",
                link: "/customer",
                icon: <FaBuilding size={18} />,
                theme: "#3b82f6",
                extra: "รายการทั้งหมด"
              },
              {
                title: "การจัดการสมาชิก",
                count: users.length,
                desc: "พนักงานและสิทธิ์ผู้ดูแลระบบ",
                link: "/employee",
                icon: <FaUsers size={18} />,
                theme: "#f43f5e",
                extra: `แอดมิน: ${users.filter(u => u.role === "admin").length} คน`
              }
            ].map((card, idx) => (
              <Col xs="12" key={idx}>
                <Link to={card.link} style={{ textDecoration: 'none' }}>
                  <div style={styles.metricCard} className="metric-card-hover">
                    <div style={styles.cardContent}>
                      <div style={{ ...styles.iconContainer, backgroundColor: `${card.theme}15`, color: card.theme }}>
                        {card.icon}
                      </div>
                      <div>
                        <h4 style={styles.cardTitle}>{card.title}</h4>
                        <p style={styles.cardDesc}>{card.desc}</p>
                        <span style={{ ...styles.extraTag, backgroundColor: `${card.theme}10`, color: card.theme }}>{card.extra}</span>
                      </div>
                    </div>
                    <div style={styles.cardRight}>
                      <span style={{ ...styles.bigNumber, color: card.theme }}>
                        {loading ? <Spinner size="sm" color="secondary" /> : card.count}
                      </span>
                      <FaChevronRight style={styles.arrowIcon} />
                    </div>
                  </div>
                </Link>
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* ─── INTERACTIVE EFFECTS FOR MOBILE ─── */}
      <style>{`
        .action-hero-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
        }
        .action-hero-btn:active {
          transform: scale(0.97);
          filter: brightness(0.95);
        }
        .metric-card-hover { 
          transition: all 0.15s ease; 
          touch-action: manipulation;
        }
        .metric-card-hover:active { 
          opacity: 0.9;
          transform: scale(0.99);
        }
        @keyframes bounceRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
        .action-hero-btn:hover .arrow-bounce {
          animation: bounceRight 1s infinite;
        }
      `}</style>
    </Container>
  );
};

// ─── STYLES OBJECT ───
const styles = {
  container: {
    padding: "12px 14px 30px 14px", 
    backgroundColor: "#f8fafc", 
    width: "100%",
    minHeight: "100vh"
  },
  topAppBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    padding: "4px 2px",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  avatarPlaceholder: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "15px",
    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)"
  },
  welcomeTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#0f172a",
    margin: 0,
    lineHeight: 1.2
  },
  welcomeSub: {
    fontSize: "11px",
    color: "#94a3b8",
    display: "block",
    marginBottom: "1px"
  },
  roleBadge: {
    padding: "4px 10px",
    backgroundColor: "#ffffff",
    color: "#475569",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    border: "1px solid #e2e8f0",
    textTransform: "uppercase",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
  },

  /* 🌟 ปุ่มหลักปฏิทินกลาง */
  bigHeroButton: {
    width: "100%",
    background: "linear-gradient(135deg, #4f46e5 0%, #2e2894 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "20px",
    padding: "22px 16px 16px 16px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 12px 24px -8px rgba(79, 70, 229, 0.4)",
    marginBottom: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  heroButtonContent: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  heroIconCircle: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroBtnTitle: {
    fontSize: "17px",
    fontWeight: "800",
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-0.3px"
  },
  heroBtnSub: {
    fontSize: "11.5px",
    color: "rgba(255, 255, 255, 0.75)",
    margin: "3px 0 0 0",
    lineHeight: "1.3",
  },

  /* 📊 โครงสร้างสถานะในปุ่มแบบ Minimal */
  heroStatusInlineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "6px",
    borderTop: "1px solid rgba(255, 255, 255, 0.12)",
    paddingTop: "12px"
  },
  inlineStatusBadge: {
    borderRadius: "8px",
    padding: "5px 2px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineStatusLabel: {
    fontSize: "10px",
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginBottom: "2px"
  },
  countWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.15)", // วงแหวนมืดซับแรงเงาไอคอน
    padding: "2px 6px",
    borderRadius: "6px",
  },
  inlineStatusCount: {
    fontSize: "12.5px",
    fontWeight: "700",
    lineHeight: "1"
  },

  /* 🧾 List Cards */
  sectionTitle: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
    paddingLeft: "2px",
  },
  metricCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "14px",
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
    marginBottom: "6px"
  },
  featuredMetricCard: {
    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    border: "none",
    boxShadow: "0 8px 16px -4px rgba(99, 102, 241, 0.3)",
  },
  cardContent: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  iconContainer: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "700",
    margin: 0,
  },
  cardDesc: {
    fontSize: "11px",
    margin: "2px 0 0 0",
    lineHeight: "1.3",
  },
  cardRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  bigNumber: {
    fontSize: "20px",
    fontWeight: "700",
  },
  arrowIcon: {
    fontSize: "11px",
  },
  extraTag: {
    display: "inline-block",
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "6px",
    marginTop: "6px",
    fontWeight: "600",
  }
};

export default Dashboard;