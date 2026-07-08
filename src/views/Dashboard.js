import { Container } from "reactstrap";
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
  FaArrowRight,
  FaBell,
  FaHourglassHalf,
  FaTimesCircle,
  FaCommentDots,
  FaClipboardList,
  FaCog,
  FaMapMarkerAlt
} from "react-icons/fa";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import AuthService from "../services/authService";
import CustomerService from "../services/CustomerService";
import EventService from "../services/EventService";
import { useAuth } from "../auth/AuthContext";
import useEventNotifications from "../hooks/useEventNotifications";

// 🔔 ไอคอน/สีของแจ้งเตือนแต่ละประเภท (คู่กับ NotificationBell แต่ใช้ react-icons ให้เข้าธีมมือถือของหน้านี้)
const NOTI_META = {
  close_requested: { icon: <FaHourglassHalf size={13} />, color: "#f59e0b" },
  close_approved: { icon: <FaCheckCircle size={13} />, color: "#10b981" },
  close_rejected: { icon: <FaTimesCircle size={13} />, color: "#ef4444" },
  comment: { icon: <FaCommentDots size={13} />, color: "#3b82f6" },
};

// 🎨 สีประจำสถานะงาน — ใช้ร่วมกันทั้ง Quick Stats และการ์ดงานวันนี้
const STATUS_META = {
  "กำลังรอยืนยัน": { color: "#f97316", bg: "#ffedd5", icon: <FaExclamationCircle size={11} /> },
  "ยืนยันแล้ว": { color: "#3b82f6", bg: "#dbeafe", icon: <FaCheckCircle size={11} /> },
  "กำลังดำเนินการ": { color: "#a78bfa", bg: "#ede9fe", icon: <FaClock size={11} /> },
  "ดำเนินการเสร็จสิ้น": { color: "#10b981", bg: "#d1fae5", icon: <FaCheckCircle size={11} /> },
};
const getStatusMeta = (status) => STATUS_META[status] || { color: "#64748b", bg: "#f1f5f9", icon: <FaClock size={11} /> };

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
};

const Dashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const role = userData?.role?.toLowerCase();
  const isAdmin = role === "admin";
  const isAdminOrManager = ["admin", "manager"].includes(role);
  const isTechnician = role === "technician";

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);

  const { notifications, unread, markRead } = useEventNotifications(
    events,
    isAdminOrManager ? "admin" : "technician"
  );

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      setLoading(true);
      try {
        // ✅ ใช้ getEventOp() (scoped ตาม role) แทน getEvents() (คืนทุก event ของทุกคนเสมอ)
        // ไม่งั้นช่างจะเห็นสถิติงานของทั้งบริษัท ไม่ใช่งานของตัวเอง
        // ✅ ตัด WorkOrderService ออก — คอลเลกชัน workorders ว่างเปล่าจริงในระบบ (ไม่เคยถูกใช้งาน)
        // ระบบงานจริงคือ CalendarEvent ผ่านหน้า Operation ทั้งหมด
        const [resFiles, resUsers, resCustomers, resEvents] = await Promise.all([
          EventService.GetServiceReportFiles().catch(() => ({ files: [] })),
          AuthService.getAllUserData().catch(() => ({ allUser: [] })),
          CustomerService.getCustomers().catch(() => ({ userCustomers: [] })),
          EventService.getEventOp().catch(() => ({ userEvents: [] })),
        ]);

        setFiles(resFiles?.files || []);
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

  // 📊 สถิติงานหลัก 4 สถานะ — การ์ดใหญ่แยกจากกัน แทนแถบเล็กๆ ฝังในปุ่มเดิม
  const statItems = [
    { label: "รอยืนยัน", status: "กำลังรอยืนยัน", count: countStatus("กำลังรอยืนยัน") },
    { label: "ยืนยันแล้ว", status: "ยืนยันแล้ว", count: countStatus("ยืนยันแล้ว") },
    { label: "กำลังทำ", status: "กำลังดำเนินการ", count: countStatus("กำลังดำเนินการ") },
    { label: "เสร็จสิ้น", status: "ดำเนินการเสร็จสิ้น", count: countStatus("ดำเนินการเสร็จสิ้น") },
  ];

  // 📅 งานวันนี้ (เทียบฟิลด์ date จริงของ CalendarEvent) เรียงตามเวลาเริ่ม
  const todayJobs = events
    .filter((e) => e.date && moment(e.date).isSame(moment(), "day"))
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  // 🚀 ทางลัดแบบไอคอน (คล้ายหน้าจอโฮมของแอปมือถือ) ปรับตามสิทธิ์ผู้ใช้
  const quickActions = [
    { title: "ปฏิทิน", icon: <FaCalendarAlt size={20} />, link: "/event", color: "#4f46e5" },
    { title: "การดำเนินงาน", icon: <FaWrench size={20} />, link: "/operation", color: "#6366f1" },
    { title: "เอกสารทั้งหมด", icon: <FaFileAlt size={20} />, link: "/files", color: "#475569", badge: files.length },
    ...(isTechnician ? [{ title: "งานของฉัน", icon: <FaClipboardList size={20} />, link: "/technician/jobs", color: "#0ea5e9" }] : []),
    ...(isAdmin ? [
      { title: "ลูกค้า", icon: <FaBuilding size={20} />, link: "/customer", color: "#3b82f6", badge: customers.length },
      { title: "พนักงาน", icon: <FaUsers size={20} />, link: "/employee", color: "#f43f5e", badge: users.length },
      { title: "ตั้งค่า", icon: <FaCog size={20} />, link: "/about", color: "#64748b" },
    ] : []),
  ];

  return (
    <Container fluid style={styles.container}>
      {/* ─── SECTION 1: TOP APP BAR PROFILE ─── */}
      <div style={styles.topAppBar}>
        <div style={styles.userInfo}>
          {userData?.imageUrl ? (
            <img src={userData.imageUrl} alt="profile" style={styles.avatarImg} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {userData?.fname ? userData.fname.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <div>
            <span style={styles.welcomeSub}>{getGreeting()} · {moment().locale("th").format("D MMMM YYYY")}</span>
            <h2 style={styles.welcomeTitle}>{userData?.fname || "ผู้ใช้งาน"}</h2>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={styles.roleBadge}>{userData?.role || "User"}</span>
          <div
            style={styles.bellButton}
            onClick={() => document.getElementById("noti-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="bell-btn-hover"
          >
            <FaBell size={16} color="#475569" />
            {unread > 0 && <span style={styles.bellDot}>{unread > 9 ? "9+" : unread}</span>}
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: COMPACT CTA BANNER ─── */}
      <div onClick={() => navigate("/event")} style={styles.ctaBanner} className="action-hero-btn">
        <div style={styles.heroIconCircle}>
          <FaCalendarAlt size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={styles.heroBtnTitle}>ปฏิทินและแผนงานทั้งหมด</h3>
          <p style={styles.heroBtnSub}>ตรวจสอบตารางนัดหมายและจัดการสถานะงานระบบกลาง</p>
        </div>
        <FaArrowRight size={13} className="arrow-bounce" style={{ opacity: 0.8, flexShrink: 0 }} />
      </div>

      {/* ─── SECTION 3: QUICK STATS GRID ─── */}
      <h5 style={styles.sectionTitle}>สรุปสถานะงาน</h5>
      <div style={styles.statsGrid}>
        {statItems.map((item, i) => {
          const meta = getStatusMeta(item.status);
          return (
            <div key={i} style={styles.statCard} className="metric-card-hover" onClick={() => navigate("/operation")}>
              <div style={{ ...styles.statIconCircle, backgroundColor: meta.bg, color: meta.color }}>
                {meta.icon}
              </div>
              {loading ? (
                <span style={styles.skeletonBlock} className="skeleton-pulse" />
              ) : (
                <span style={styles.statNumber}>{item.count}</span>
              )}
              <span style={styles.statLabel}>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* ─── SECTION 4: TODAY'S JOBS (ข้อมูลจริงจาก CalendarEvent ของวันนี้) ─── */}
      <div style={styles.notiHeaderRow}>
        <h5 style={{ ...styles.sectionTitle, marginBottom: 0 }}>งานวันนี้ · {moment().locale("th").format("D MMM")}</h5>
        <Link to="/operation" style={styles.viewAllLink}>ดูทั้งหมด <FaChevronRight size={9} /></Link>
      </div>
      {loading ? (
        <div style={styles.todayScrollRow}>
          {[1, 2].map((i) => (
            <div key={i} style={{ ...styles.todayJobCard, ...styles.skeletonPulseBg }} className="skeleton-pulse" />
          ))}
        </div>
      ) : todayJobs.length === 0 ? (
        <div style={styles.notiCard}>
          <div style={styles.notiEmpty}>
            <FaCalendarAlt size={22} style={{ opacity: 0.25, marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>ไม่มีงานที่นัดหมายไว้ในวันนี้</p>
          </div>
        </div>
      ) : (
        <div style={styles.todayScrollRow}>
          {todayJobs.map((job) => {
            const meta = getStatusMeta(job.status);
            return (
              <div
                key={job._id}
                style={styles.todayJobCard}
                className="metric-card-hover"
                onClick={() => navigate(`/operation/${job._id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={styles.todayJobTime}>
                    <FaClock size={10} style={{ marginRight: "4px" }} />
                    {job.startTime && job.endTime ? `${job.startTime}-${job.endTime}` : "ทั้งวัน"}
                  </span>
                  <span style={{ ...styles.todayJobStatusChip, backgroundColor: meta.bg, color: meta.color }}>
                    {job.status}
                  </span>
                </div>
                <h4 style={styles.todayJobTitle}>{job.title || job.company}</h4>
                <p style={styles.todayJobSite}>
                  <FaMapMarkerAlt size={10} style={{ marginRight: "4px", opacity: 0.6 }} />
                  {job.company} · {job.site}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── SECTION 5: NOTIFICATIONS WIDGET ─── */}
      <div id="noti-section" style={styles.notiHeaderRow}>
        <h5 style={{ ...styles.sectionTitle, marginBottom: 0 }}>การแจ้งเตือนล่าสุด</h5>
        {unread > 0 && <span style={styles.notiUnreadBadge}>{unread} ใหม่</span>}
      </div>
      <div style={styles.notiCard}>
        {notifications.length === 0 ? (
          <div style={styles.notiEmpty}>
            <FaBell size={22} style={{ opacity: 0.25, marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>ยังไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          notifications.slice(0, 4).map((n, i) => {
            const meta = NOTI_META[n.type] || NOTI_META.close_requested;
            return (
              <div
                key={n.id}
                onClick={() => {
                  markRead(n.id);
                  if (n.eventId) navigate(`/operation/${n.eventId}`);
                }}
                className="noti-row-hover"
                style={{
                  ...styles.notiRow,
                  borderBottom: i < Math.min(notifications.length, 4) - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: n.read ? 0.55 : 1
                }}
              >
                <div style={{ ...styles.notiIconCircle, backgroundColor: `${meta.color}18`, color: meta.color }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={styles.notiMessage}>{n.message}</p>
                  <p style={styles.notiDetail}>{n.detail}</p>
                </div>
                <span style={styles.notiTime}>{moment(n.time).locale("th").fromNow(true)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* ─── SECTION 6: QUICK ACTIONS (ทางลัดคล้ายหน้าโฮมแอปมือถือ) ─── */}
      <h5 style={styles.sectionTitle}>ทางลัด</h5>
      <div style={styles.quickActionsGrid}>
        {quickActions.map((action, idx) => (
          <Link key={idx} to={action.link} style={{ textDecoration: "none" }}>
            <div style={styles.quickActionItem} className="metric-card-hover">
              <div style={{ position: "relative" }}>
                <div style={{ ...styles.quickActionIcon, backgroundColor: `${action.color}15`, color: action.color }}>
                  {action.icon}
                </div>
                {action.badge > 0 && <span style={styles.quickActionBadge}>{action.badge > 99 ? "99+" : action.badge}</span>}
              </div>
              <span style={styles.quickActionLabel}>{action.title}</span>
            </div>
          </Link>
        ))}
      </div>

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
          cursor: pointer;
        }
        .metric-card-hover:active {
          opacity: 0.9;
          transform: scale(0.97);
        }
        @keyframes bounceRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
        .action-hero-btn:hover .arrow-bounce {
          animation: bounceRight 1s infinite;
        }
        .noti-row-hover:hover {
          background-color: #f8fafc;
        }
        .noti-row-hover:active {
          background-color: #f1f5f9;
        }
        .bell-btn-hover:active {
          transform: scale(0.92);
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }
        .skeleton-pulse {
          animation: skeletonPulse 1.1s ease-in-out infinite;
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
  avatarImg: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    objectFit: "cover",
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
  bellButton: {
    position: "relative",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    transition: "transform 0.15s ease",
  },
  bellDot: {
    position: "absolute",
    top: "-4px",
    right: "-4px",
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: "9px",
    fontWeight: "700",
    minWidth: "16px",
    height: "16px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
    border: "2px solid #f8fafc",
  },

  /* 🌟 CTA banner แบบกระชับ (ไม่ฝังสถิติแล้ว ย้ายไป Quick Stats แยกเป็นสัดส่วน) */
  ctaBanner: {
    width: "100%",
    background: "linear-gradient(135deg, #4f46e5 0%, #2e2894 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "18px",
    padding: "16px",
    cursor: "pointer",
    boxShadow: "0 12px 24px -8px rgba(79, 70, 229, 0.4)",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  heroIconCircle: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroBtnTitle: {
    fontSize: "15px",
    fontWeight: "800",
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-0.2px"
  },
  heroBtnSub: {
    fontSize: "11px",
    color: "rgba(255, 255, 255, 0.75)",
    margin: "2px 0 0 0",
    lineHeight: "1.3",
  },

  /* 📊 Quick Stats Grid — การ์ดสถิติจริงแยกเป็นสัดส่วน แทนแถบเล็กในปุ่มเดิม */
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    marginBottom: "20px",
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "12px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
  },
  statIconCircle: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: "17px",
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "10px",
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
  skeletonBlock: {
    display: "inline-block",
    width: "24px",
    height: "17px",
    borderRadius: "4px",
    backgroundColor: "#e2e8f0",
  },
  skeletonPulseBg: {
    backgroundColor: "#e2e8f0",
    border: "none",
  },

  /* 📅 Today's Jobs — เลื่อนแนวนอนแบบฟีดในแอปมือถือ */
  todayScrollRow: {
    display: "flex",
    gap: "10px",
    overflowX: "auto",
    paddingBottom: "6px",
    marginBottom: "20px",
    scrollSnapType: "x mandatory",
  },
  todayJobCard: {
    minWidth: "220px",
    maxWidth: "220px",
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "12px 14px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
    flexShrink: 0,
    scrollSnapAlign: "start",
    minHeight: "88px",
  },
  todayJobTime: {
    fontSize: "10.5px",
    fontWeight: "700",
    color: "#475569",
    display: "flex",
    alignItems: "center",
  },
  todayJobStatusChip: {
    fontSize: "9px",
    fontWeight: "700",
    padding: "2px 7px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
  },
  todayJobTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#0f172a",
    margin: "8px 0 2px 0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  todayJobSite: {
    fontSize: "10.5px",
    color: "#94a3b8",
    margin: 0,
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  viewAllLink: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#4f46e5",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "3px",
  },

  /* 🔔 Notifications Widget */
  notiHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
    paddingLeft: "2px",
    paddingRight: "2px",
  },
  notiUnreadBadge: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  notiCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
    marginBottom: "22px",
    overflow: "hidden",
  },
  notiEmpty: {
    padding: "24px 12px",
    textAlign: "center",
  },
  notiRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  notiIconCircle: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notiMessage: {
    margin: 0,
    fontSize: "12.5px",
    fontWeight: "700",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  notiDetail: {
    margin: "1px 0 0 0",
    fontSize: "11px",
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  notiTime: {
    fontSize: "10px",
    color: "#94a3b8",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  /* 🧾 Section Titles */
  sectionTitle: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
    paddingLeft: "2px",
  },

  /* 🚀 Quick Actions Grid — ทางลัดคล้ายหน้าโฮมแอปมือถือ พร้อม badge จำนวน */
  quickActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
    marginBottom: "10px",
  },
  quickActionItem: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "12px 4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
  },
  quickActionIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionBadge: {
    position: "absolute",
    top: "-5px",
    right: "-5px",
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: "9px",
    fontWeight: "700",
    minWidth: "16px",
    height: "16px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
    border: "2px solid #ffffff",
  },
  quickActionLabel: {
    fontSize: "10.5px",
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
  },
};

export default Dashboard;
