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
  FaUserCog,
  FaChevronLeft,
  FaUserFriends,
  FaCheckDouble
} from "react-icons/fa";
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import AuthService from "../services/authService";
import CustomerService from "../services/CustomerService";
import EventService from "../services/EventService";
import { useAuth } from "../auth/AuthContext";
import useEventNotifications from "../hooks/useEventNotifications";
import { buildDaysPastDueMap, isFlaggedDays, isSevereDays, countFlaggedJobs, resolveAssignedTechnician } from "../utils/overdueJobs";

// 🔔 ไอคอน/สีของแจ้งเตือนแต่ละประเภท (คู่กับ NotificationBell แต่ใช้ react-icons ให้เข้าธีมมือถือของหน้านี้)
const NOTI_META = {
  new_job: { icon: <FaClipboardList size={13} />, color: "#6366f1" },
  close_requested: { icon: <FaHourglassHalf size={13} />, color: "#f59e0b" },
  close_approved: { icon: <FaCheckCircle size={13} />, color: "#10b981" },
  close_rejected: { icon: <FaTimesCircle size={13} />, color: "#ef4444" },
  comment: { icon: <FaCommentDots size={13} />, color: "#3b82f6" },
};

// 🎨 สีและไอคอนประจำสถานะงาน — ใช้ร่วมกันทั้ง Quick Stats และการ์ดงานวันนี้
// ✅ เก็บเป็น "component" ไม่ใช่ element ที่ render ไว้แล้ว เพื่อให้เรียกใช้คนละขนาดได้ตามบริบท
// (เดิม FaClock/FaCheckCircle ถูกใช้ซ้ำข้ามความหมาย ทำให้แยกสถานะจากไอคอนอย่างเดียวไม่ออก
// เปลี่ยนให้แต่ละสถานะมีไอคอนเฉพาะตัวจริงๆ: เตือน → ติ๊กเดียว → เฟืองหมุน → ติ๊กคู่)
const STATUS_META = {
  "กำลังรอยืนยัน": { color: "#f97316", bg: "#ffedd5", Icon: FaExclamationCircle },
  "ยืนยันแล้ว": { color: "#3b82f6", bg: "#dbeafe", Icon: FaCheckCircle },
  "กำลังดำเนินการ": { color: "#a78bfa", bg: "#ede9fe", Icon: FaCogs },
  "ดำเนินการเสร็จสิ้น": { color: "#10b981", bg: "#d1fae5", Icon: FaCheckDouble },
};
const getStatusMeta = (status) => STATUS_META[status] || { color: "#64748b", bg: "#f1f5f9", Icon: FaClock };

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
  // ✅ เก็บว่าช่างคนไหนถูกกดขยายดูรายชื่องานค้างอยู่ในแถบ "งานค้างของช่าง" (กดได้หลายคนพร้อมกัน)
  const [expandedOverdueTechIds, setExpandedOverdueTechIds] = useState(() => new Set());

  const { notifications, unread, markRead, markAllRead } = useEventNotifications(
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

  // 🔧 สรุปงานของฉัน (เฉพาะช่าง) — ใช้ทำให้ปุ่ม "งานของฉัน" เด่นและละเอียดขึ้น (มีตัวเลขจริง ไม่ใช่แค่ไอคอนลอยๆ)
  // นับจาก events ที่มาจาก getEventOp() ซึ่ง backend scope ตาม role ให้แล้ว (ช่างเห็นแค่งานตัวเอง)
  // เกณฑ์เดียวกับที่ใช้แบ่งกลุ่มในหน้า Operation/งานของฉัน (active/pending/overdue) — "ค้างเกินกำหนด"
  // ที่นี่นับด้วยเกณฑ์เดียวกับแท็บ "ค้างงาน" ของ Operation (เลย 1 สัปดาห์ขึ้นไป) ตัวเลขจะได้ตรงกัน
  // ไม่ใช่นับแค่ 1 วันหลังกำหนดแบบเดิมซึ่งจะเห็นตัวเลขไม่ตรงกับที่ไปเปิดหน้า Operation จริง
  const myActiveJobsCount = events.filter((e) => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status) && !e.closeRequested).length;
  const myPendingApprovalCount = events.filter((e) => e.closeRequested && e.status !== "ดำเนินการเสร็จสิ้น").length;

  // ✅ ใช้ util กลาง (src/utils/overdueJobs.js) แทนโค้ดจัดกลุ่ม/คิดค้างแบบ inline เดิม — ตรรกะ
  // เดียวกับที่หน้า Operation ใช้เป๊ะๆ (งานหลายวันไม่ติดกันนับเป็น 1 งาน คิดค้างจากวันสุดท้าย)
  const daysPastDueMap = buildDaysPastDueMap(events);
  const myOverdueCount = countFlaggedJobs(events, daysPastDueMap, isFlaggedDays);
  const myJobsSummary = (() => {
    const parts = [];
    if (myActiveJobsCount > 0) parts.push(`${myActiveJobsCount} งานที่ต้องทำ`);
    if (myPendingApprovalCount > 0) parts.push(`${myPendingApprovalCount} รอตรวจอนุมัติ`);
    if (myOverdueCount > 0) parts.push(`⚠️ ${myOverdueCount} ค้างเกินกำหนด`);
    return parts.length > 0 ? parts.join(" · ") : "ไม่มีงานค้างในตอนนี้ 🎉";
  })();

  // 👷 งานค้างของช่างแยกรายคน (เฉพาะแอดมิน/manager) — เดิมไม่มีทางเห็นภาพนี้ในหน้า Dashboard เลย
  // ต้องไปเปิดหน้า "ภาพรวมทีมช่าง" แยกต่างหาก ย่อมาแสดงเป็นแถบด้านข้างแทนพื้นที่ว่างที่เหลือ
  // จากการจำกัดความกว้างเนื้อหาหลัก — โชว์เฉพาะคนที่มีงานค้างจริง (ไม่โชว์แถวที่ 0 ให้รกตา)
  const overdueByTechnician = useMemo(() => {
    if (!isAdminOrManager) return [];
    const technicians = users.filter((u) => (u.role || "").toLowerCase() === "technician");
    const userById = new Map(users.map((u) => [u._id, u]));
    const userByFname = new Map(users.map((u) => [u.fname, u]));

    const bySignature = new Map();
    events.forEach((e) => {
      const entry = daysPastDueMap.get(e._id);
      if (!entry || !isFlaggedDays(entry.days)) return;
      if (!bySignature.has(entry.groupKey)) bySignature.set(entry.groupKey, { sessions: [], days: entry.days });
      bySignature.get(entry.groupKey).sessions.push(e);
    });

    const counts = new Map(technicians.map((t) => [t._id, { tech: t, count: 0, severeCount: 0, jobs: [] }]));
    bySignature.forEach(({ sessions, days }) => {
      const tech = resolveAssignedTechnician(sessions, userById, userByFname);
      if (!tech || (tech.role || "").toLowerCase() !== "technician") return;
      const entry = counts.get(tech._id);
      if (!entry) return;
      entry.count += 1;
      if (isSevereDays(days)) entry.severeCount += 1;
      // ✅ เก็บรายละเอียดงานค้างแต่ละงานไว้ด้วย (ไม่ใช่แค่ตัวเลขสรุป) เพื่อให้กด dropdown
      // ดูรายชื่องานค้างจริงๆ ของคนนั้นได้ทันทีในหน้า Dashboard เอง ไม่ต้องเปิดหน้าอื่น
      const head = sessions[0];
      entry.jobs.push({ id: head._id, title: head.title, company: head.company, site: head.site, days });
    });

    return [...counts.values()]
      .filter((c) => c.count > 0)
      .map((c) => ({ ...c, jobs: c.jobs.sort((a, b) => b.days - a.days) }))
      .sort((a, b) => b.count - a.count);
  }, [isAdminOrManager, users, events, daysPastDueMap]);

  // 🏆 โครงการที่มีงานมากที่สุด (ทั้งหมด แบ่งหน้า) — จัดกลุ่มงานตาม บริษัท+โครงการ (company+site) เพราะ
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
      .map((p) => ({
        ...p,
        name: p.company && p.site ? `${p.company} · ${p.site}` : (p.company || p.site),
      }));
  })();
  const maxProjectCount = topProjects[0]?.count || 1;

  // 📄 แบ่งหน้ารายการโครงการ — แสดงหน้าละ 5 รายการ (รีเซ็ตกลับหน้า 1 เมื่อดึงข้อมูลใหม่)
  const PROJECTS_PER_PAGE = 5;
  const [projectPage, setProjectPage] = useState(1);
  useEffect(() => { setProjectPage(1); }, [events]);
  const totalProjectPages = Math.max(1, Math.ceil(topProjects.length / PROJECTS_PER_PAGE));
  const pagedProjects = topProjects.slice(
    (projectPage - 1) * PROJECTS_PER_PAGE,
    projectPage * PROJECTS_PER_PAGE
  );

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
    // ✅ "งานของฉัน" ของช่างถูกย้ายขึ้นไปเป็นแบนเนอร์ hero เด่นๆ ด้านบนแทนแล้ว (ดู SECTION 2)
    // ไม่ต้องมีซ้ำเป็นไอคอนเล็กๆ ที่นี่อีก
    // ✅ ใช้ isAdminOrManager แทน isAdmin เพราะหน้า "ภาพรวมทีมช่าง" ตั้งใจให้ manager เข้าถึงได้ด้วย
    ...(isAdminOrManager ? [
      { title: "ภาพรวมทีมช่าง", icon: <FaUserFriends size={20} />, link: "/team-workload", color: "#0891b2" },
    ] : []),
    ...(isAdmin ? [
      { title: "รายชื่อลูกค้าทั้งหมด", icon: <FaBuilding size={20} />, link: "/customer", color: "#3b82f6", badge: customers.length },
      { title: "พนักงาน", icon: <FaUsers size={20} />, link: "/employee", color: "#f43f5e", badge: users.length },
      { title: "ตั้งค่า", icon: <FaCog size={20} />, link: "/about", color: "#64748b" },
    ] : []),
  ];

  return (
    <Container fluid style={styles.container}>
    {/* ─── LAYOUT: จอกว้างพอ (≥960px) แบ่ง 2 คอลัมน์ เนื้อหาหลัก + แถบข้าง "งานค้างของช่าง"
        (เดิมจำกัด maxWidth ของ container ไว้แล้วเหลือพื้นที่ว่างข้างขวาเยอะบนจอกว้าง เอามาใช้ตรงนี้
        แทนที่จะปล่อยว่าง) — DOM แบ่งเนื้อหาหลักเป็น 2 ท่อน (บน/ล่าง) คั่นด้วยแถบข้างตรงกลาง เพื่อให้
        จอแคบ/มือถือ (คอลัมน์เดียว) แสดงแถบข้างแทรกอยู่ก่อน "โครงการที่มีงานมากที่สุด" ไม่ใช่ไปตกอยู่
        ท้ายสุดหลังทุกอย่างแบบเดิม ส่วนจอกว้างใช้ grid-column/grid-row ดึงกลับไปเป็นคอลัมน์ข้างตามปกติ ─── */}
    <div className="dashboard-layout">
    <div className="dashboard-main">
      {/* ─── SECTION 1: TOP GREETING — ✅ เดิมมีทั้งรูปโปรไฟล์และปุ่มกระดิ่งซ้ำกับ Header.js
          (ซึ่งอยู่เหนือหน้านี้ตลอดเวลา แสดงพร้อมกันในจอเดียว) ตัดทั้งสองออก เหลือแค่ข้อความทักทาย
          + ชื่อ + badge สิทธิ์ ให้แถวนี้โล่งและกระชับที่สุด (แจ้งเตือนดูได้จากกระดิ่งบน Header
          หรือเลื่อนลงไปที่ส่วน "การแจ้งเตือนล่าสุด" ด้านล่างอยู่แล้ว ไม่จำเป็นต้องมีทางลัดซ้ำที่นี่) ─── */}
      <div style={styles.topAppBar}>
        <div>
          <span style={styles.welcomeSub}>{getGreeting()} · {moment().locale("th").format("D MMMM YYYY")}</span>
          <h2 style={styles.welcomeTitle}>{userData?.fname || "ผู้ใช้งาน"}</h2>
        </div>
        <span style={styles.roleBadge}>{userData?.role || "User"}</span>
      </div>

      {/* ─── SECTION 1.5: "งานของฉัน" HERO (เฉพาะช่าง) — ให้เด่นและละเอียดกว่าไอคอนเล็กๆ เดิม
          วางไว้บนสุด (ก่อนแบนเนอร์ปฏิทินทั่วไป) เพราะเป็นสิ่งที่ช่างต้องใช้งานทุกวันมากที่สุด ─── */}
      {isTechnician && (
        <div onClick={() => navigate("/technician/jobs")} style={styles.myJobsBanner} className="action-hero-btn">
          <div style={styles.myJobsIconCircle}>
            <FaClipboardList size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={styles.heroBtnTitle}>งานของฉัน</h3>
            <p style={styles.heroBtnSub}>{loading ? "กำลังโหลด..." : myJobsSummary}</p>
          </div>
          {!loading && (myActiveJobsCount + myPendingApprovalCount) > 0 && (
            <span style={styles.myJobsCountBadge}>{myActiveJobsCount + myPendingApprovalCount}</span>
          )}
          <FaArrowRight size={13} className="arrow-bounce" style={{ opacity: 0.8, flexShrink: 0 }} />
        </div>
      )}

      {/* ─── SECTION 2: CTA BANNER PAIR — เดิมเป็นแบนเนอร์เต็มความกว้างแค่ปฏิทินอันเดียว ส่วนปุ่ม
          "ดูการดำเนินงานทั้งหมด" ไปหลบเป็นชิปเล็กๆ อยู่ข้างหัวข้อ "งานวันนี้" คนละจุดคนละน้ำหนัก
          แบ่งครึ่งเป็น 2 การ์ดเท่ากัน ให้ทั้งคู่เด่นเท่ากันและกดถึงจากจุดเดียวกันด้านบนสุด ─── */}
      <div style={styles.heroPairGrid}>
        <div onClick={() => navigate("/event")} style={styles.heroPairCard} className="action-hero-btn">
          <div style={styles.heroIconCircle}>
            <FaCalendarAlt size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={styles.heroPairTitle}>แผนงานทั้งหมด</h3>
            <p style={styles.heroPairSub}>ปฏิทินนัดหมาย</p>
          </div>
        </div>
        <div
          onClick={() => navigate("/operation")}
          // ✅ เดิมเป็นเฉดแดงเข้มใกล้เคียงกับการ์ด "แผนงานทั้งหมด" มากจนแยกไม่ออกในแวบแรก
          // เปลี่ยนเป็นน้ำเงินไปเลย ให้ตัดกันชัดเจน (แดง = แผนงาน, น้ำเงิน = การดำเนินงาน)
          style={{ ...styles.heroPairCard, background: "linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)", boxShadow: "0 8px 18px -8px rgba(37, 99, 235, 0.35)" }}
          className="action-hero-btn"
        >
          <div style={styles.heroIconCircle}>
            <FaWrench size={15} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={styles.heroPairTitle}>การดำเนินงาน</h3>
            <p style={styles.heroPairSub}>ดูทั้งหมด</p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: QUICK STATS — การ์ด 4 ใบแถวเดียว (ไอคอนบน ตัวเลข/label ล่าง จัดกึ่งกลาง)
          แต่ละใบมีไอคอนเฉพาะของสถานะนั้นจริงๆ (ไม่ใช่จุดสีลอยๆ แบบเดิม) — ยังลิงก์ไปกรองหน้า
          Operation ตรงสถานะเหมือนเดิมผ่าน ?status=... ─── */}
      <h5 style={styles.sectionTitle}>สรุปสถานะงาน</h5>
      <div style={styles.statsGrid}>
        {statItems.map((item, i) => {
          const meta = getStatusMeta(item.status);
          const StatIcon = meta.Icon;
          return (
            <Link
              key={i}
              to={`/operation?status=${encodeURIComponent(item.status)}`}
              style={styles.statTile}
              className="metric-card-hover"
            >
              <div style={{ ...styles.statTileIcon, backgroundColor: meta.bg, color: meta.color }}>
                <StatIcon size={11} />
              </div>
              <div style={{ minWidth: 0 }}>
                {loading ? (
                  <span style={styles.skeletonInline} className="skeleton-pulse" />
                ) : (
                  <div style={styles.statTileNumber}>{item.count}</div>
                )}
                <div style={styles.statTileLabel}>{item.label}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─── SECTION 4: TODAY'S JOBS (ข้อมูลจริงจาก CalendarEvent ของวันนี้) ─── */}
      {/* ✅ ปุ่ม "ดูการดำเนินงานทั้งหมด" ย้ายขึ้นไปเป็นการ์ดครึ่งหนึ่งของ SECTION 2 ด้านบนแล้ว
          (เด่นกว่าเดิมมาก) ไม่ต้องมีชิปเล็กๆ ซ้ำอีกจุดที่นี่ */}
      <h5 style={styles.sectionTitle}>งานวันนี้ · {moment().locale("th").format("D MMM")}</h5>
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
        {/* ✅ ระบุให้ชัดว่าคือ "ยังไม่ได้อ่าน" (ไม่ใช่ตัวเลขลึกลับ) และ cap ไว้ที่ 99+ กันเลขบวมล้นบรรทัด
            ถ้าเคยเจอบั๊กแจ้งเตือนย้อนหลังจำนวนมากพร้อมกัน (แก้ต้นตอที่ useEventNotifications แล้ว) */}
        {unread > 0 && <span style={styles.notiUnreadBadge}>{unread > 99 ? "99+" : unread} รายการยังไม่ได้อ่าน</span>}
      </div>
      {/* ✅ เดิมโชว์แค่ 4 รายการล่าสุดแบบตัดทิ้ง เลื่อนดูรายการเก่ากว่านั้นไม่ได้เลย — เปลี่ยนเป็น
          กล่องเลื่อนดูได้ตลอด (scroll) แสดงครบทุกรายการ พร้อม onScroll ที่ถือว่า "เลื่อนดูแล้ว = อ่านแล้ว"
          เคลียร์ badge ให้อัตโนมัติโดยไม่ต้องกดเข้าไปทีละอัน (รายการที่อ่านแล้วยังอยู่ต่ออีก 7 วันก่อนถูกลบ) */}
      <div style={{ ...styles.notiCard, maxHeight: "340px", overflowY: "auto" }} onScroll={markAllRead}>
        {notifications.length === 0 ? (
          <div style={styles.notiEmpty}>
            <FaBell size={22} style={{ opacity: 0.25, marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>ยังไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          notifications.map((n, i) => {
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
                  borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none",
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
    </div>

    {/* ─── แถบข้าง: งานค้างของช่างแยกรายคน (เฉพาะแอดมิน/manager) — ✅ ย้ายมาไว้ตรงนี้ (แทรกระหว่าง
        เนื้อหาช่วงบน/ล่างของหลัก) แทนที่จะอยู่หลังเนื้อหาหลักทั้งหมด เพราะบนมือถือ (คอลัมน์เดียว)
        DOM มาก่อน = แสดงก่อน ถ้าอยู่ท้ายสุดจะไปโผล่ล่างสุดหลัง "ภาพรวมทีมงาน" ซึ่งไกลเกินไป — ย้าย
        มาอยู่ก่อน "โครงการที่มีงานมากที่สุด" แทน ส่วนจอกว้าง (≥960px) ใช้ grid-column/grid-row
        (ดู .dashboard-side ใน <style>) ดึงกลับไปเป็นคอลัมน์ข้างเหมือนเดิมโดยไม่ต้องย้าย DOM ซ้ำ ─── */}
    {isAdminOrManager && (
      <div className="dashboard-side">
        <h5 style={styles.sectionTitle}>งานค้างของช่าง</h5>
        <div style={styles.notiCard}>
          {loading ? (
            <div style={{ padding: "14px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ ...styles.topProjectSkeletonRow }} className="skeleton-pulse" />
              ))}
            </div>
          ) : overdueByTechnician.length === 0 ? (
            <div style={styles.notiEmpty}>
              <FaCheckDouble size={22} style={{ opacity: 0.25, marginBottom: "6px" }} />
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>ไม่มีงานค้างของช่างในตอนนี้ 🎉</p>
            </div>
          ) : (
            <div style={{ padding: "6px 0" }}>
              {overdueByTechnician.map(({ tech, count, severeCount, jobs }) => {
                const isExpanded = expandedOverdueTechIds.has(tech._id);
                return (
                  <div key={tech._id}>
                    <div
                      onClick={() => setExpandedOverdueTechIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(tech._id)) next.delete(tech._id); else next.add(tech._id);
                        return next;
                      })}
                      style={styles.sideJobRow}
                      className="metric-card-hover"
                    >
                      <span style={styles.sideJobAvatar}>
                        {(tech.fname || tech.username || "?").charAt(0).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={styles.sideJobName}>{tech.fname || tech.username}</span>
                        <span style={styles.sideJobDetail}>
                          {count} งานค้าง{severeCount > 0 ? ` · ${severeCount} เกิน 2 สัปดาห์` : ""}
                        </span>
                      </span>
                      <span style={{ ...styles.sideJobBadge, ...(severeCount > 0 ? { backgroundColor: "#fee2e2", color: "#ef4444" } : {}) }}>
                        {count}
                      </span>
                      <FaChevronRight size={10} style={{
                        marginLeft: "2px", color: "#94a3b8", flexShrink: 0,
                        transform: isExpanded ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s ease",
                      }} />
                    </div>
                    {isExpanded && (
                      <div style={styles.sideJobDropdown} className="side-job-dropdown-enter">
                        {jobs.map((job) => (
                          <Link key={job.id} to={`/operation/${job.id}`} style={styles.sideJobItem} className="metric-card-hover">
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={styles.sideJobItemTitle}>{job.title || "งาน"}</span>
                              <span style={styles.sideJobItemSub}>{[job.company, job.site].filter(Boolean).join(" · ")}</span>
                            </span>
                            <span style={{ ...styles.sideJobItemDays, ...(job.days >= 14 ? { color: "#ef4444" } : {}) }}>
                              {job.days} วัน
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Link to="/team-workload" style={styles.viewAllBtn} className="metric-card-hover">
          ดูภาพรวมทีมช่างทั้งหมด <FaChevronRight size={9} />
        </Link>
      </div>
    )}

    <div className="dashboard-main">
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
              <>
                <div style={styles.topProjectList}>
                  {pagedProjects.map((p, i) => {
                    const rank = (projectPage - 1) * PROJECTS_PER_PAGE + i + 1;
                    return (
                      <Link
                        key={p.name}
                        to={`/customer?company=${encodeURIComponent(p.company)}&site=${encodeURIComponent(p.site)}`}
                        style={{ textDecoration: "none" }}
                      >
                        <div style={styles.topProjectRow} className="metric-card-hover">
                          <span style={{
                            ...styles.topProjectRank,
                            ...(rank === 1 ? { backgroundColor: "#dc2626", color: "#fff" } : {}),
                          }}>{rank}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.topProjectName}>{p.name}</p>
                            <div style={styles.topProjectTrack}>
                              <div style={{ ...styles.topProjectBar, width: `${Math.max((p.count / maxProjectCount) * 100, 6)}%` }} />
                            </div>
                          </div>
                          <span style={styles.topProjectCount}>{p.count}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {totalProjectPages > 1 && (
                  <div style={styles.projectPagination}>
                    <button
                      type="button"
                      onClick={() => setProjectPage((p) => Math.max(1, p - 1))}
                      disabled={projectPage === 1}
                      style={{ ...styles.projectPageBtn, opacity: projectPage === 1 ? 0.35 : 1 }}
                      className="metric-card-hover"
                    >
                      <FaChevronLeft size={10} />
                    </button>
                    <span style={styles.projectPageLabel}>หน้า {projectPage} / {totalProjectPages}</span>
                    <button
                      type="button"
                      onClick={() => setProjectPage((p) => Math.min(totalProjectPages, p + 1))}
                      disabled={projectPage === totalProjectPages}
                      style={{ ...styles.projectPageBtn, opacity: projectPage === totalProjectPages ? 0.35 : 1 }}
                      className="metric-card-hover"
                    >
                      <FaChevronRight size={10} />
                    </button>
                  </div>
                )}
              </>
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
    </div>
    </div>

      {/* ─── INTERACTIVE EFFECTS FOR MOBILE ─── */}
      <style>{`
        /* ✅ .dashboard-layout เป็น grid เสมอ (ไม่ใช่แค่จอกว้าง) เพื่อให้ควบคุม grid-column/grid-row
           ของ .dashboard-side ได้ — มือถือ/จอแคบ: คอลัมน์เดียว รายการเรียงตามลำดับ DOM จริง
           (เนื้อหาบน → งานค้างของช่าง → เนื้อหาล่าง) จอกว้าง ≥960px: ค่อยดึง .dashboard-side ไปเป็น
           คอลัมน์ขวาคลุมทั้งความสูง โดยไม่ต้องย้าย DOM ซ้ำสองที่ */
        .dashboard-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }
        .dashboard-main {
          min-width: 0;
        }
        .dashboard-side {
          margin: 20px 0;
        }
        @media (min-width: 960px) {
          .dashboard-layout {
            grid-template-columns: 1fr 300px;
            gap: 20px;
            align-items: start;
          }
          .dashboard-main {
            grid-column: 1;
          }
          .dashboard-side {
            /* ✅ เดิม grid-row: 1 / -1 (span ข้าม 2 แถวของ .dashboard-main บน/ล่าง) ผสมกับ
               position: sticky คือต้นตอที่ทำให้กดเปิด/ปิด dropdown แล้วรู้สึกเด้ง/กระตุกไม่สมูท —
               ทุกครั้งที่ความสูงการ์ดนี้เปลี่ยน กริดต้องคำนวณ track ทั้ง 2 แถวใหม่ทันที (reflow ทั้งระบบ)
               ตัดการ span ออก ให้เป็นแค่ไอเทมปกติในแถวเดียวกับ .dashboard-main แถวบน (คอลัมน์ 2)
               กริดจะโตแค่ "แถวเดียว" ที่มันอยู่ ไม่กระทบแถวล่าง ไม่มีการ reflow ข้ามแถวอีกต่อไป
               (ผลคือ sticky จะทำงานแค่ช่วงที่เลื่อนอยู่ในแถวบน ซึ่งเป็นพฤติกรรมที่คาดเดาได้และเรียบร้อยกว่า) */
            grid-column: 2;
            margin: 0;
            position: sticky;
            top: 16px;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
          }
        }
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
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }
        .skeleton-pulse {
          animation: skeletonPulse 1.1s ease-in-out infinite;
        }
        /* ✅ เดิม dropdown "งานค้างของช่าง" โผล่ขึ้นมาทันทีแบบไม่มี transition เลย (pop เฉยๆ)
           ทำให้ความรู้สึกกดเปิด/ปิดดูกระตุกไม่สมูท — ใส่ fade + เลื่อนลงเบาๆ ตอนโผล่ขึ้นมาแทน */
        @keyframes sideJobDropdownEnter {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .side-job-dropdown-enter {
          animation: sideJobDropdownEnter 0.18s ease-out;
        }
      `}</style>
    </Container>
  );
};

// ─── STYLES OBJECT ───
const styles = {
  // ✅ เดิมไม่มี maxWidth เลย พอเปิดจอกว้าง (เดสก์ท็อป) ทุกอย่างเลยยืดเต็มจนดูเทอะทะเกินจริง
  // (แบนเนอร์/การ์ดสถิติกว้างเป็น 1900px) จำกัดความกว้างและกึ่งกลางไว้ ยังคง fluid เต็มจอบนมือถือ
  // ✅ ขยับ maxWidth ขึ้นจาก 720 → 1040 เพื่อเผื่อที่ให้แถบข้าง "งานค้างของช่าง" (320px) วางคู่กับ
  // เนื้อหาหลัก (720px) บนจอกว้าง — ดูสัดส่วน .dashboard-layout ในบล็อก <style> ด้านล่าง
  container: {
    padding: "12px 14px 30px 14px",
    backgroundColor: "#f8fafc",
    width: "100%",
    maxWidth: "1040px",
    margin: "0 auto",
    minHeight: "100vh"
  },
  topAppBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    padding: "4px 2px",
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
  /* 🌟 CTA banner คู่ — เดิมเป็นแบนเนอร์เต็มความกว้างอันเดียว (ปฏิทิน) แยกกับปุ่ม
     "ดูการดำเนินงานทั้งหมด" ที่เป็นชิปเล็กๆ อยู่คนละจุด แบ่งครึ่งเป็น 2 การ์ดเท่ากันในกริดเดียว
     ให้ทั้งคู่เด่นเท่ากัน เนื้อหาในการ์ดจึงต้องกระชับกว่าเดิม (ตัดซับไตเติลยาวออก) ให้พอดีครึ่งจอมือถือ */
  heroPairGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "16px",
  },
  heroPairCard: {
    background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "16px",
    padding: "14px 12px",
    cursor: "pointer",
    boxShadow: "0 8px 18px -8px rgba(220, 38, 38, 0.35)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  heroPairTitle: {
    fontSize: "12.5px",
    fontWeight: "800",
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-0.2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  heroPairSub: {
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.75)",
    margin: "2px 0 0 0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  heroIconCircle: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroBtnTitle: {
    fontSize: "14px",
    fontWeight: "800",
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-0.2px"
  },
  heroBtnSub: {
    fontSize: "10.5px",
    color: "rgba(255, 255, 255, 0.75)",
    margin: "2px 0 0 0",
    lineHeight: "1.3",
  },

  /* 🔧 "งานของฉัน" hero (เฉพาะช่าง) — สีต่างจาก ctaBanner (cyan แทนแดง) เพื่อแยกให้เห็นชัดว่า
     เป็นคนละปุ่มกัน แต่ใช้โครงสไตล์เดียวกัน (icon circle/title/sub/arrow) ให้ดูเป็นชุดเดียวกัน */
  myJobsBanner: {
    width: "100%",
    background: "linear-gradient(135deg, #0891b2 0%, #164e63 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "16px",
    padding: "14px",
    cursor: "pointer",
    boxShadow: "0 8px 18px -8px rgba(8, 145, 178, 0.35)",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  myJobsIconCircle: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  myJobsCountBadge: {
    minWidth: "26px",
    height: "26px",
    padding: "0 8px",
    borderRadius: "13px",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "800",
    flexShrink: 0,
  },

  /* 📊 Quick Stats — เดิมแบ่ง 2x2 (2 แถว) ตามที่ขอให้เหลือ "แถวเดียวพอ" เปลี่ยนเป็น 4 คอลัมน์
     แถวเดียว และสลับ layout ภายในการ์ดจากแนวนอน (ไอคอนซ้าย-ตัวเลขขวา) เป็นแนวตั้ง (ไอคอนบน
     ตัวเลข/label ล่าง จัดกึ่งกลาง) ให้พอดีกับพื้นที่แคบลงต่อใบบนมือถือ ไม่ต้องบีบจนอ่านยาก */
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "6px",
    marginBottom: "14px",
  },
  statTile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "3px",
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    padding: "7px 3px",
    textDecoration: "none",
    boxShadow: "0 2px 4px rgba(0,0,0,0.015)",
  },
  statTileIcon: {
    width: "22px",
    height: "22px",
    borderRadius: "7px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statTileNumber: {
    fontSize: "13px",
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 1,
  },
  statTileLabel: {
    fontSize: "8.5px",
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: "1px",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
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
    marginBottom: "16px",
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
  viewAllBtn: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#dc2626",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    border: "1px solid rgba(220, 38, 38, 0.18)",
    borderRadius: "20px",
    padding: "6px 12px",
    flexShrink: 0,
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
    marginBottom: "18px",
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
  projectPagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    padding: "10px 14px",
    borderTop: "1px solid #f1f5f9",
  },
  projectPageBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  projectPageLabel: {
    fontSize: "11.5px",
    fontWeight: "600",
    color: "#64748b",
  },

  /* 👷 แถบข้าง "งานค้างของช่าง" — เฉพาะแอดมิน/manager, จอกว้างเท่านั้น (ดู .dashboard-side) */
  sideJobRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    textDecoration: "none",
  },
  sideJobAvatar: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    fontWeight: "700",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sideJobName: {
    display: "block",
    fontSize: "12.5px",
    fontWeight: "700",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sideJobDetail: {
    display: "block",
    fontSize: "10.5px",
    color: "#94a3b8",
    marginTop: "1px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sideJobBadge: {
    minWidth: "22px",
    height: "22px",
    padding: "0 6px",
    borderRadius: "11px",
    backgroundColor: "#f1f5f9",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  // ✅ กางออกมาแสดงรายชื่องานค้างจริงของช่างคนนั้น เมื่อกดที่แถวชื่อ — พื้นหลังจางกว่าแถวหลัก
  // ให้เห็นว่าเป็นรายการย่อยที่ซ้อนอยู่ข้างใน ไม่ใช่แถวระดับเดียวกัน
  sideJobDropdown: {
    backgroundColor: "#f8fafc",
    padding: "2px 10px 6px 46px",
  },
  sideJobItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 4px",
    textDecoration: "none",
    borderTop: "1px solid #eef1f5",
  },
  sideJobItemTitle: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: "700",
    color: "#334155",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sideJobItemSub: {
    display: "block",
    fontSize: "10px",
    color: "#94a3b8",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sideJobItemDays: {
    fontSize: "10.5px",
    fontWeight: "700",
    color: "#f59e0b",
    flexShrink: 0,
    whiteSpace: "nowrap",
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
