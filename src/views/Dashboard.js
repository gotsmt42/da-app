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
  FaMapMarkerAlt,
  FaCogs,
  FaUserCog
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

  // 📅 งานวันนี้ — เดิมเทียบแค่ฟิลด์ date (=วันแรกที่สร้างงานเท่านั้น) ทำให้งานที่เริ่มเมื่อวาน
  // แต่ยังดำเนินอยู่ข้ามมาถึงวันนี้ (multi-day event, date ปักหมุดไว้ที่วันแรกแต่ start/end ยาวกว่านั้น)
  // ไม่ถูกนับว่าเป็น "งานวันนี้" เลย — ใช้ start/end ของช่วงงานจริงแทน (end เป็น exclusive
  // ตามธรรมเนียม FullCalendar ของระบบนี้ คือวันสุดท้ายจริง + 1 วัน)
  const getEventRange = (e) => {
    const start = moment(e.start || e.date).startOf("day");
    const end = e.end ? moment(e.end).startOf("day") : start.clone().add(1, "day");
    return { start, end };
  };

  const today = moment().startOf("day");
  const todayJobs = events
    .filter((e) => {
      if (!e.start && !e.date) return false;
      const { start, end } = getEventRange(e);
      return today.isSameOrAfter(start) && today.isBefore(end);
    })
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  // 👤 หาชื่อผู้รับผิดชอบงานจากรายชื่อพนักงานจริง (resPerson เก็บเป็น userId ไม่ใช่ชื่อ)
  // fallback ไปที่ team ถ้าไม่มี resPerson หรือหาไม่เจอในรายชื่อ
  const getAssignedName = (job) => {
    if (job.resPerson) {
      const u = users.find((u) => u._id === job.resPerson);
      if (u) return `${u.fname || ""} ${u.lname || ""}`.trim() || u.username;
    }
    return job.team || null;
  };

  // 🏆 โครงการที่มีงานมากที่สุด (Top 10) — จัดกลุ่มงานตาม บริษัท+โครงการ (company+site) เพราะ
  // Event ไม่มี customerId อ้างอิงตรงๆ (เทียบ pattern เดียวกับที่ Customer/index.js ใช้ผูกประวัติงาน)
  // ✅ events มาจาก getEventOp() ที่ scope ตาม role อยู่แล้ว — แอดมิน/manager เห็นทุกโครงการจริง
  // ส่วนช่างจะเห็นแค่โครงการที่ตัวเองเคยได้รับมอบหมาย จึงโชว์ section นี้เฉพาะแอดมิน/manager
  // ที่ข้อมูลมีความหมายเป็น "ภาพรวมทั้งบริษัท" จริงๆ
  const topProjects = (() => {
    const counts = {};
    events.forEach((e) => {
      if (!e.company && !e.site) return;
      // ✅ เก็บ company/site แยกไว้ (ไม่ใช่แค่รวมเป็นข้อความเดียว) เพื่อส่งเป็น query param
      // ไปกรองหน้า /customer ให้ตรงตัวเป๊ะๆ ตอนกดแถวโครงการ
      const key = `${e.company || ""} ${e.site || ""}`;
      if (!counts[key]) counts[key] = { company: e.company || "", site: e.site || "", count: 0 };
      counts[key].count += 1;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        name: p.company && p.site ? `${p.company} · ${p.site}` : (p.company || p.site),
      }));
  })();
  const maxProjectCount = topProjects[0]?.count || 1;

  // 👥 ภาพรวมทีมงานแยกตามสิทธิ์ (เฉพาะแอดมิน)
  const roleCounts = users.reduce((acc, u) => {
    const r = (u.role || "other").toLowerCase();
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const teamItems = [
    { key: "technician", label: "ช่างเทคนิค", color: "#0891b2" },
    { key: "admin", label: "ผู้ดูแลระบบ", color: "#dc2626" },
    { key: "manager", label: "ผู้จัดการ", color: "#f59e0b" },
  ];

  // 🚀 ทางลัดแบบไอคอน (คล้ายหน้าจอโฮมของแอปมือถือ) ปรับตามสิทธิ์ผู้ใช้
  const quickActions = [
    { title: "แผนงานทั้งหมด", icon: <FaCalendarAlt size={20} />, link: "/event", color: "#dc2626" },
    { title: "การดำเนินงาน", icon: <FaWrench size={20} />, link: "/operation", color: "#b91c1c" },
    { title: "เอกสารทั้งหมด", icon: <FaFileAlt size={20} />, link: "/files", color: "#475569", badge: files.length },
    ...(isTechnician ? [{ title: "งานของฉัน", icon: <FaClipboardList size={20} />, link: "/technician/jobs", color: "#0891b2" }] : []),
    ...(isAdmin ? [
      { title: "รายชื่อลูกค้าทั้งหมด", icon: <FaBuilding size={20} />, link: "/customer", color: "#3b82f6", badge: customers.length },
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

      {/* ─── SECTION 3: QUICK STATS STRIP (ลดความเด่นลง เอาไว้แค่ให้เห็นภาพรวมเร็วๆ) ─── */}
      <h5 style={styles.sectionTitle}>สรุปสถานะงาน</h5>
      <div style={styles.statsStrip} onClick={() => navigate("/operation")} className="metric-card-hover">
        {statItems.map((item, i) => {
          const meta = getStatusMeta(item.status);
          return (
            <div key={i} style={{ ...styles.statSegment, borderLeft: i === 0 ? "none" : "1px solid #eef1f5" }}>
              <span style={{ ...styles.statDot, backgroundColor: meta.color }} />
              {loading ? (
                <span style={styles.skeletonInline} className="skeleton-pulse" />
              ) : (
                <span style={styles.statNumberSm}>{item.count}</span>
              )}
              <span style={styles.statLabelSm}>{item.label}</span>
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
            const assignedName = getAssignedName(job);
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
                {job.docNo && <span style={styles.todayJobDocNo}>#{job.docNo}</span>}
                <h4 style={styles.todayJobTitle}>{job.title || job.company}</h4>
                <p style={styles.todayJobSite}>
                  <FaMapMarkerAlt size={10} style={{ marginRight: "4px", opacity: 0.6 }} />
                  {job.company} · {job.site}
                </p>
                {job.system && (
                  <p style={styles.todayJobDetail}>
                    <FaCogs size={10} style={{ marginRight: "4px", opacity: 0.6 }} />
                    {job.system}
                  </p>
                )}
                {assignedName && (
                  <p style={styles.todayJobDetail}>
                    <FaUserCog size={10} style={{ marginRight: "4px", opacity: 0.6 }} />
                    {assignedName}
                  </p>
                )}
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

      {/* ─── SECTION 6: TOP PROJECTS (เฉพาะแอดมิน/manager — events scope ตาม role มีความหมาย
          เป็น "ภาพรวมทั้งบริษัท" จริงๆ แค่กับสองสิทธิ์นี้เท่านั้น) ─── */}
      {isAdminOrManager && (
        <>
          <h5 style={styles.sectionTitle}>โครงการที่มีงานมากที่สุด</h5>
          <div style={styles.notiCard}>
            {loading ? (
              <div style={{ padding: "16px" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ ...styles.topProjectSkeletonRow }} className="skeleton-pulse" />
                ))}
              </div>
            ) : topProjects.length === 0 ? (
              <div style={styles.notiEmpty}>
                <FaBuilding size={22} style={{ opacity: 0.25, marginBottom: "6px" }} />
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>ยังไม่มีข้อมูลงานของโครงการ</p>
              </div>
            ) : (
              <div style={styles.topProjectList}>
                {topProjects.map((p, i) => (
                  <Link
                    key={p.name}
                    to={`/customer?company=${encodeURIComponent(p.company)}&site=${encodeURIComponent(p.site)}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div style={styles.topProjectRow} className="metric-card-hover">
                      <span style={{
                        ...styles.topProjectRank,
                        ...(i === 0 ? { backgroundColor: "#dc2626", color: "#fff" } : {}),
                      }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={styles.topProjectName}>{p.name}</p>
                        <div style={styles.topProjectTrack}>
                          <div style={{ ...styles.topProjectBar, width: `${Math.max((p.count / maxProjectCount) * 100, 6)}%` }} />
                        </div>
                      </div>
                      <span style={styles.topProjectCount}>{p.count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── SECTION 7: QUICK ACTIONS (ทางลัดคล้ายหน้าโฮมแอปมือถือ) ─── */}
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

      {/* ─── SECTION 8: TEAM OVERVIEW (เฉพาะแอดมิน) ─── */}
      {isAdmin && (
        <>
          <h5 style={styles.sectionTitle}>ภาพรวมทีมงาน</h5>
          <div style={styles.notiCard}>
            <div style={styles.teamRow}>
              {teamItems.map((item) => (
                <div key={item.key} style={styles.teamChip}>
                  <span style={{ ...styles.teamChipCount, color: item.color }}>
                    {loading ? "…" : (roleCounts[item.key] || 0)}
                  </span>
                  <span style={styles.teamChipLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
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
    background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "15px",
    boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)"
  },
  avatarImg: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    objectFit: "cover",
    boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)"
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
    background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "18px",
    padding: "16px",
    cursor: "pointer",
    boxShadow: "0 12px 24px -8px rgba(220, 38, 38, 0.35)",
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

  /* 📊 Quick Stats Strip — แถบบางเดียว ลดความเด่นลงจากการ์ดใหญ่แยกชิ้นเดิม แค่ให้เห็นภาพรวมเร็วๆ */
  statsStrip: {
    display: "flex",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #eef1f5",
    padding: "10px 4px",
    marginBottom: "20px",
    cursor: "pointer",
  },
  statSegment: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    padding: "0 4px",
  },
  statDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    marginBottom: "1px",
  },
  statNumberSm: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#334155",
    lineHeight: 1,
  },
  statLabelSm: {
    fontSize: "9.5px",
    fontWeight: "500",
    color: "#94a3b8",
    textAlign: "center",
  },
  skeletonInline: {
    display: "inline-block",
    width: "18px",
    height: "13px",
    borderRadius: "3px",
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
    minWidth: "240px",
    maxWidth: "240px",
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "12px 14px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
    flexShrink: 0,
    scrollSnapAlign: "start",
    minHeight: "88px",
  },
  todayJobDocNo: {
    display: "inline-block",
    fontSize: "9px",
    fontWeight: "700",
    color: "#dc2626",
    marginTop: "6px",
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
  todayJobDetail: {
    fontSize: "10.5px",
    color: "#94a3b8",
    margin: "3px 0 0 0",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  viewAllLink: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#dc2626",
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

  /* 🏆 Top Projects — แถบแนวนอน สีเดียว (แดงแบรนด์) ความยาวแปรตามสัดส่วนงาน
     เทียบ mark spec: หนา ≤24px, มุมโค้งฝั่งปลาย (data-end) เท่านั้น, ค่าตัวเลขอยู่นอกแท่ง
     ไม่ทับสี — อันดับ 1 เน้นด้วยสีแบรนด์ ที่เหลือเป็นกลาง (emphasis pattern) */
  topProjectList: {
    display: "flex",
    flexDirection: "column",
  },
  topProjectRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
  },
  topProjectRank: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "800",
    backgroundColor: "#f1f5f9",
    color: "#64748b",
  },
  topProjectName: {
    fontSize: "12.5px",
    fontWeight: "700",
    color: "#0f172a",
    margin: "0 0 5px 0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  topProjectTrack: {
    height: "8px",
    borderRadius: "4px",
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  topProjectBar: {
    height: "100%",
    borderRadius: "0 4px 4px 0",
    background: "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)",
    transition: "width 0.4s ease",
  },
  topProjectCount: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#334155",
    flexShrink: 0,
    minWidth: "20px",
    textAlign: "right",
  },
  topProjectSkeletonRow: {
    height: "36px",
    borderRadius: "8px",
    backgroundColor: "#f1f5f9",
    marginBottom: "8px",
  },

  /* 👥 Team Overview — เฉพาะแอดมิน */
  teamRow: {
    display: "flex",
    justifyContent: "space-around",
    padding: "16px 8px",
  },
  teamChip: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  teamChipCount: {
    fontSize: "20px",
    fontWeight: "800",
    lineHeight: 1,
  },
  teamChipLabel: {
    fontSize: "10.5px",
    fontWeight: "600",
    color: "#64748b",
  },
};

export default Dashboard;
