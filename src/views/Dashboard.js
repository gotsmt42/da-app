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
  FaClipboardList,
  FaCog,
  FaMapMarkerAlt,
  FaCogs,
  FaUserCog,
  FaChevronLeft,
  FaUserFriends,
  FaCheckDouble,
  FaFileInvoiceDollar,
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
import {
  buildDaysPastDueMap,
  isFlaggedDays,
  isSevereDays,
  countFlaggedJobs,
  countDistinctJobs,
  resolveAssignedTechnician,
  resolveOperationGroup,
  getOverdueGroupKey,
} from "../utils/overdueJobs";
// ✅ ตรรกะ "เลยกำหนด/คงค้าง" เดียวกับหน้า "ภาพรวมงาน" (ContractOverview.js) เป๊ะๆ — ย้ายมารวมไว้ที่
// utils/contractOverdue.js แล้วตั้งแต่ก่อนหน้านี้ (ใช้ซ้ำที่ Header.js ด้วยสำหรับป้ายบนแถบเมนู) กันตรรกะ
// เพี้ยนไม่ตรงกันระหว่างจุดต่างๆ
import { groupEventsByContract, nextVisitOverdueInfo } from "../utils/contractOverdue";

// 🎨 สีและไอคอนประจำสถานะงาน — ใช้ร่วมกันทั้ง Quick Stats และการ์ดงานวันนี้
// ✅ เก็บเป็น "component" ไม่ใช่ element ที่ render ไว้แล้ว เพื่อให้เรียกใช้คนละขนาดได้ตามบริบท
// (เดิม FaClock/FaCheckCircle ถูกใช้ซ้ำข้ามความหมาย ทำให้แยกสถานะจากไอคอนอย่างเดียวไม่ออก
// เปลี่ยนให้แต่ละสถานะมีไอคอนเฉพาะตัวจริงๆ: เตือน → ติ๊กเดียว → เฟืองหมุน → ติ๊กคู่)
const STATUS_META = {
  กำลังรอยืนยัน: { color: "#f97316", bg: "#ffedd5", Icon: FaExclamationCircle },
  ยืนยันแล้ว: { color: "#3b82f6", bg: "#dbeafe", Icon: FaCheckCircle },
  กำลังดำเนินการ: { color: "#a78bfa", bg: "#ede9fe", Icon: FaCogs },
  ดำเนินการเสร็จสิ้น: { color: "#10b981", bg: "#d1fae5", Icon: FaCheckDouble },
};
const getStatusMeta = (status) =>
  STATUS_META[status] || { color: "#64748b", bg: "#f1f5f9", Icon: FaClock };

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
  // ✅ หน้า "ภาพรวมงาน" เปิดให้ช่างเข้าดูสัญญาของตัวเองได้แล้ว (ดู ContractOverview.js canView /
  // Header.js canViewContracts) — วิดเจ็ต "สัญญาที่เลยกำหนด/คงค้าง" ด้านล่างต้องเปิดให้ตรงกันด้วย
  const canViewContracts = ["admin", "manager", "technician"].includes(role);

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  // ✅ งานวางแผนล่วงหน้า (ยังไม่ลงตาราง) — เดิมไม่มีทางเห็นได้เลยนอกจากเข้าไปเปิดหน้า "แผนงาน"
  // เอง เอามาย่อโชว์เป็นแถบข้างแทนพื้นที่ว่างที่เหลือ (ดู .dashboard-side)
  const [drafts, setDrafts] = useState([]);
  // ✅ เก็บว่าช่างคนไหนถูกกดขยายดูรายชื่องานค้างอยู่ในแถบ "งานค้างของช่าง" (กดได้หลายคนพร้อมกัน)
  const [expandedOverdueTechIds, setExpandedOverdueTechIds] = useState(
    () => new Set(),
  );

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      setLoading(true);
      try {
        // ✅ ใช้ getEventOp() (scoped ตาม role) แทน getEvents() (คืนทุก event ของทุกคนเสมอ)
        // ไม่งั้นช่างจะเห็นสถิติงานของทั้งบริษัท ไม่ใช่งานของตัวเอง
        // ✅ ตัด WorkOrderService ออก — คอลเลกชัน workorders ว่างเปล่าจริงในระบบ (ไม่เคยถูกใช้งาน)
        // ระบบงานจริงคือ CalendarEvent ผ่านหน้า Operation ทั้งหมด
        const [resFiles, resUsers, resCustomers, resEvents, resDrafts] =
          await Promise.all([
            EventService.GetServiceReportFiles().catch(() => ({ files: [] })),
            AuthService.getAllUserData().catch(() => ({ allUser: [] })),
            CustomerService.getCustomers().catch(() => ({ userCustomers: [] })),
            EventService.getEventOp().catch(() => ({ userEvents: [] })),
            EventService.GetDraftEvents().catch(() => ({ drafts: [] })),
          ]);

        setFiles(resFiles?.files || []);
        setUsers(resUsers?.allUser || []);
        setCustomers(resCustomers?.userCustomers || []);
        setEvents(resEvents?.userEvents || []);
        setDrafts(resDrafts?.drafts || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllDashboardData();
  }, []);

  // ✅ นับแบบจัดกลุ่มก่อน (countDistinctJobs) ไม่ใช่นับทุกแถว event ดิบ — งานที่เข้าหลายวันไม่ติดกัน
  // (jobGroupId เดียวกัน) ต้องนับเป็น 1 งานเสมอ ไม่งั้นการ์ดสรุปสถานะจะขึ้นตัวเลขสูงเกินจริง
  const countStatus = (status) =>
    countDistinctJobs(events, (e) => e.status === status);

  // 📊 สถิติงานหลัก 4 สถานะ — การ์ดใหญ่แยกจากกัน แทนแถบเล็กๆ ฝังในปุ่มเดิม
  // ✅ เพิ่ม group ต่อรายการ — ให้ตรงกับแท็บ (StatusGroupCard) จริงในหน้า Operation เวลากดเข้าไป
  // (ดู resolveOperationGroup ใน utils/overdueJobs.js) "กำลังรอยืนยัน" ไม่มีแท็บไหนตรงกับสถานะนี้
  // โดยตรง เลยปล่อยว่างไว้ (ไม่มีแท็บติดสว่าง ดีกว่าให้แท็บผิดๆ ติดสว่างแทน)
  const statItems = [
    {
      label: "รอยืนยัน",
      status: "กำลังรอยืนยัน",
      count: countStatus("กำลังรอยืนยัน"),
      group: "",
    },
    {
      label: "ยืนยันแล้ว",
      status: "ยืนยันแล้ว",
      count: countStatus("ยืนยันแล้ว"),
      group: "active",
    },
    {
      label: "กำลังทำ",
      status: "กำลังดำเนินการ",
      count: countStatus("กำลังดำเนินการ"),
      group: "active",
    },
    {
      label: "เสร็จสิ้น",
      status: "ดำเนินการเสร็จสิ้น",
      count: countStatus("ดำเนินการเสร็จสิ้น"),
      group: "closed",
    },
  ];

  // 📅 งานวันนี้ — เดิมเทียบแค่ฟิลด์ date (=วันแรกที่สร้างงานเท่านั้น) ทำให้งานที่เริ่มเมื่อวาน
  // แต่ยังดำเนินอยู่ข้ามมาถึงวันนี้ (multi-day event, date ปักหมุดไว้ที่วันแรกแต่ start/end ยาวกว่านั้น)
  // ไม่ถูกนับว่าเป็น "งานวันนี้" เลย — ใช้ start/end ของช่วงงานจริงแทน (end เป็น exclusive
  // ตามธรรมเนียม FullCalendar ของระบบนี้ คือวันสุดท้ายจริง + 1 วัน)
  const getEventRange = (e) => {
    const start = moment(e.start || e.date).startOf("day");
    const end = e.end
      ? moment(e.end).startOf("day")
      : start.clone().add(1, "day");
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

  // 📅 งานที่กำลังจะถึงในอีก 7 วันข้างหน้า (เฉพาะแอดมิน/manager) — ไม่รวมงานที่ปิดแล้ว และไม่รวม
  // งานของ "วันนี้" (ตัดจาก start.isAfter(today) แทน isSameOrAfter) เพราะมีการ์ด "งานวันนี้"
  // แยกแสดงอยู่แล้วด้านบน ไม่ต้องซ้ำกัน — เรียงวันที่ใกล้สุดก่อน
  const weekAhead = moment().add(7, "days").endOf("day");
  const upcomingJobs = isAdminOrManager
    ? events
        .filter((e) => {
          if (!e.start && !e.date) return false;
          if (e.status === "ดำเนินการเสร็จสิ้น") return false;
          const { start } = getEventRange(e);
          return start.isAfter(today) && start.isSameOrBefore(weekAhead);
        })
        .sort((a, b) => moment(a.start || a.date) - moment(b.start || b.date))
    : [];

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
  // ✅ นับแบบจัดกลุ่มก่อน (ไม่ใช่นับทุกแถว) — งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) นับ
  // เป็น 1 งานเสมอ ไม่งั้นตัวเลขจะเพี้ยนสูงกว่าจำนวนงานจริง (เทียบเหตุผลเดียวกับหน้า Operation/MyJobs)
  // ✅ ใช้ util กลาง (src/utils/overdueJobs.js) แทนโค้ดจัดกลุ่ม/คิดค้างแบบ inline เดิม — ตรรกะ
  // เดียวกับที่หน้า Operation ใช้เป๊ะๆ (งานหลายวันไม่ติดกันนับเป็น 1 งาน คิดค้างจากวันสุดท้าย)
  // ✅ ต้องคำนวณก่อน myActiveJobsCount เพราะ "งานที่ต้องทำ" ต้องตัดงานที่ค้างออกไปแล้ว (ดูด้านล่าง)
  const daysPastDueMap = buildDaysPastDueMap(events);
  const myOverdueCount = countFlaggedJobs(
    events,
    daysPastDueMap,
    isFlaggedDays,
  );

  // ✅ ตามที่ผู้ใช้ยืนยัน — "งานที่ต้องทำ" นับรวมงานค้างเกินกำหนดไว้ด้วยเหมือนเดิม (ไม่ตัด
  // !isFlaggedDays ออกเหมือนที่เคยลองแก้) แม้จะไม่ mutually-exclusive กับ "ค้างเกินกำหนด" ก็ตาม
  const myActiveJobsCount = countDistinctJobs(
    events,
    (e) => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status) && !e.closeRequested,
  );
  const myPendingApprovalCount = countDistinctJobs(
    events,
    (e) => e.closeRequested && e.status !== "ดำเนินการเสร็จสิ้น",
  );
  // ✅ เพิ่มจำนวนงานที่เสร็จสิ้นแล้วเข้าไปในสรุปด้วย (เดิมมีแค่ ต้องทำ/รออนุมัติ/ค้างเกินกำหนด)
  const myClosedCount = countStatus("ดำเนินการเสร็จสิ้น");
  const myJobsSummary = (() => {
    const parts = [];
    if (myActiveJobsCount > 0) parts.push(`${myActiveJobsCount} งานที่ต้องทำ`);
    if (myPendingApprovalCount > 0)
      parts.push(`${myPendingApprovalCount} รอตรวจอนุมัติ`);
    if (myOverdueCount > 0) parts.push(`⚠️ ${myOverdueCount} ค้างเกินกำหนด`);
    if (myClosedCount > 0) parts.push(`✅ ${myClosedCount} เสร็จสิ้น`);
    return parts.length > 0 ? parts.join(" · ") : "ไม่มีงานค้างในตอนนี้ 🎉";
  })();

  // 👷 งานค้างของช่างแยกรายคน (เฉพาะแอดมิน/manager) — เดิมไม่มีทางเห็นภาพนี้ในหน้า Dashboard เลย
  // ต้องไปเปิดหน้า "ภาพรวมทีมช่าง" แยกต่างหาก ย่อมาแสดงเป็นแถบด้านข้างแทนพื้นที่ว่างที่เหลือ
  // จากการจำกัดความกว้างเนื้อหาหลัก — โชว์เฉพาะคนที่มีงานค้างจริง (ไม่โชว์แถวที่ 0 ให้รกตา)
  const overdueByTechnician = useMemo(() => {
    if (!isAdminOrManager) return [];
    const technicians = users.filter(
      (u) => (u.role || "").toLowerCase() === "technician",
    );
    const userById = new Map(users.map((u) => [u._id, u]));
    const userByFname = new Map(users.map((u) => [u.fname, u]));

    const bySignature = new Map();
    events.forEach((e) => {
      const entry = daysPastDueMap.get(e._id);
      if (!entry || !isFlaggedDays(entry.days)) return;
      if (!bySignature.has(entry.groupKey))
        bySignature.set(entry.groupKey, { sessions: [], days: entry.days });
      bySignature.get(entry.groupKey).sessions.push(e);
    });

    const counts = new Map(
      technicians.map((t) => [
        t._id,
        { tech: t, count: 0, severeCount: 0, jobs: [] },
      ]),
    );
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
      entry.jobs.push({
        id: head._id,
        title: head.title,
        company: head.company,
        site: head.site,
        days,
      });
    });

    return [...counts.values()]
      .filter((c) => c.count > 0)
      .map((c) => ({ ...c, jobs: c.jobs.sort((a, b) => b.days - a.days) }))
      .sort((a, b) => b.count - a.count);
  }, [isAdminOrManager, users, events, daysPastDueMap]);

  // ⚠️ ใบเสนอราคาที่ส่งลูกค้าไปแล้วเกิน 7 วัน ยังไม่มีผล (เฉพาะแอดมิน/manager) — เดิมไม่มีทางเห็น
  // ได้เลยจาก Dashboard ต้องเข้าไปเปิดหน้า /quotations เองแล้วไล่หาทีละใบ ย่อมาโชว์เป็นกล่องแจ้งเตือน
  // แทน (โชว์เฉพาะตอนมีจริงเท่านั้น ไม่มีก็ไม่ต้องมีกล่องว่างให้รกตา) — จัดกลุ่มงานหลายวันไม่ติดกันด้วย
  // getOverdueGroupKey เหมือนจุดอื่นๆ ในไฟล์นี้ กันนับซ้ำ (quotationSentAt ถูก propagate เท่ากันทั้ง
  // กลุ่มอยู่แล้วตอนกดจากหน้า /quotations จึงใช้ค่าจาก session ไหนของกลุ่มมาคิดก็ได้ผลลัพธ์เดียวกัน)
  const QUOTATION_FOLLOWUP_DAYS = 7;
  const staleQuotations = useMemo(() => {
    if (!isAdminOrManager) return [];
    const bySignature = new Map();
    events.forEach((e) => {
      if (e.quotationStatus !== "sent" || !e.quotationSentAt) return;
      const key = getOverdueGroupKey(e);
      if (!bySignature.has(key)) bySignature.set(key, e);
    });
    const today = moment().startOf("day");
    return [...bySignature.values()]
      .map((head) => ({
        id: head._id,
        title: head.title,
        company: head.company,
        site: head.site,
        days: today.diff(moment(head.quotationSentAt).startOf("day"), "days"),
      }))
      .filter((q) => q.days > QUOTATION_FOLLOWUP_DAYS)
      .sort((a, b) => b.days - a.days);
  }, [isAdminOrManager, events]);

  // 📌 งานวางแผนล่วงหน้า (เฉพาะแอดมิน/manager) — เรียงตามเดือนที่ตั้งใจใกล้สุดก่อน แบ่งหน้าแทน
  // การโชว์แค่ไม่กี่รายการตายตัว ให้เห็นได้ครบทุกใบจากตรงนี้เลยโดยไม่ต้องออกไปหน้า "แผนงาน"
  const DRAFTS_PAGE_SIZE = 5;
  const [draftsPage, setDraftsPage] = useState(1);
  // ⚠️ BUG ที่แก้: ต้องกรองฉบับร่างของ "สัญญา" (มี contractGroupId) ทิ้งให้ตรงกับแผงงานล่วงหน้าใน
  // ปฏิทิน (ดู visibleDrafts ใน EventCalendar/index.js ซึ่งกรองแบบเดียวกันอยู่แล้ว) — สัญญาที่เพิ่ง
  // สร้างแบบยังไม่ลงวันที่เป็น record unscheduled ที่ GET /drafts คืนมาด้วยเสมอ ทำให้สัญญาเปล่าโผล่ใน
  // วิดเจ็ตนี้เหมือนถูก "วางแผนไว้เดือนนั้น" ทั้งที่ผู้ใช้ยังไม่เคยระบุวันที่/เดือนอะไรเลย — สัญญาจัดการที่
  // หน้า "ภาพรวมงาน" ที่เดียว (ดู overdueContracts ด้านบนซึ่งยังใช้ drafts ดิบเต็มๆ ต่อไป เพราะการนับ
  // "เลยกำหนดรอบถัดไป" ต้องเห็นรอบที่จองล่วงหน้าไว้ด้วย ไม่งั้นจะนับเกินจริง)
  const generalDrafts = useMemo(
    () => drafts.filter((d) => !d.contractGroupId),
    [drafts],
  );
  const draftsSorted = useMemo(() => {
    if (!isAdminOrManager) return [];
    return [...generalDrafts].sort((a, b) =>
      (a.plannedMonth || "").localeCompare(b.plannedMonth || ""),
    );
  }, [isAdminOrManager, generalDrafts]);
  const draftsTotalPages = Math.max(
    1,
    Math.ceil(draftsSorted.length / DRAFTS_PAGE_SIZE),
  );
  // ✅ กันหน้าปัจจุบันเกินจำนวนหน้าจริง (เช่น ข้อมูลโหลดใหม่แล้วมีน้อยกว่าหน้าที่ค้างอยู่)
  const draftsSafePage = Math.min(draftsPage, draftsTotalPages);
  const draftsPreview = draftsSorted.slice(
    (draftsSafePage - 1) * DRAFTS_PAGE_SIZE,
    draftsSafePage * DRAFTS_PAGE_SIZE,
  );

  // ⏰ สัญญาที่ "เลยกำหนดเข้ารอบถัดไป/คงค้าง" — ดึงมาจากหน้า "ภาพรวมงาน" (ContractOverview.js) ตรงๆ
  // ใช้ groupEventsByContract + nextVisitOverdueInfo ตัวเดียวกันเป๊ะๆ (utils/contractOverdue.js) กัน
  // ตรรกะเพี้ยนไม่ตรงกัน — รวม drafts (แผนงานล่วงหน้า) เข้าไปด้วยเหมือนที่ ContractOverview.js เองทำ
  // เพราะ getEventOp() กรอง unscheduled ทิ้งเสมอ ไม่งั้นสัญญาที่จองรอบถัดไปไว้ล่วงหน้าแล้วจะถูกนับผิดว่า
  // ยังเลยกำหนดอยู่ — events/drafts ถูกกรองตาม role มาจาก backend แล้ว (แอดมิน/manager เห็นทั้งหมด
  // ช่างเห็นแค่ของตัวเอง) จึงคำนวณตรงๆ ได้เลยไม่ต้องแยกเงื่อนไข role ที่นี่อีก
  const overdueContracts = useMemo(() => {
    if (!canViewContracts) return [];
    return groupEventsByContract([...events, ...drafts])
      .filter((c) => c.isRealContract)
      .map((c) => {
        const info = nextVisitOverdueInfo(c);
        return info ? { ...c, overdueInfo: info } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.overdueInfo.monthsOverdue - a.overdueInfo.monthsOverdue);
  }, [canViewContracts, events, drafts]);

  // ✅ ดึง JSX ของบล็อก "สัญญาที่เลยกำหนด/คงค้าง" ออกมาเป็นตัวแปรเดียว ใช้ซ้ำได้ 2 จุด — จอกว้าง
  // (≥960px) วางไว้ในคอลัมน์หลักฝั่งซ้าย (เทียบ pattern เดียวกับ dashboard-desktop-only/
  // dashboard-mobile-only ใน <style> ด้านล่าง) ส่วนจอมือถือ (แอดมิน/manager) ย้ายไปแทรกอยู่เหนือ
  // "งานวางแผนล่วงหน้า" ในแถบข้างแทน (ดู sidebarContent) ตามที่ผู้ใช้ขอ — ไม่ใช้ตัวแปรเดียวกันซ้ำ
  // ตำแหน่งเดิมเพราะ sidebarContent ถูกใช้ render ทั้งจอมือถือ/จอกว้าง (คนละคอลัมน์กัน) ถ้าใส่ตรงๆ
  // ในนั้นจะไปโผล่ซ้ำที่แถบข้างฝั่งขวาของจอกว้างด้วย ทั้งที่ต้องการให้จอกว้างอยู่ฝั่งซ้ายเท่านั้น
  const overdueContractsBlock =
    canViewContracts && overdueContracts.length > 0 ? (
      <>
        <h5 style={styles.sectionTitle}>⏰ สัญญาที่เลยกำหนด / คงค้าง</h5>
        <div style={styles.contractOverdueCard}>
          <div style={{ padding: "6px 0" }}>
            {overdueContracts.slice(0, 5).map((c) => (
              <Link
                // ✅ ลิงก์เจาะจง — เด้งตรงไปแท็บ "เลยกำหนด/คงค้าง" พร้อมค้นหาชื่อบริษัท/
                // โครงการนั้นให้ทันที (ดู ?q= ใน ContractOverview.js) แทนที่จะเปิดมาเจอทั้ง
                // ลิสต์แล้วต้องมานั่งหาเอง
                key={c.key}
                to={`/contracts?view=overdue&q=${encodeURIComponent(c.company || c.site || "")}`}
                style={styles.sideJobRow}
                className="metric-card-hover"
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={styles.sideJobName}>
                    {[c.company, c.site].filter(Boolean).join(" · ") ||
                      c.title ||
                      "สัญญา"}
                  </span>
                  <span style={styles.sideJobDetail}>
                    {[c.title, c.system].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span style={styles.contractOverdueBadge}>
                  เกิน {c.overdueInfo.monthsOverdue} ด.
                </span>
              </Link>
            ))}
          </div>
        </div>
        {overdueContracts.length > 5 && (
          <Link
            to="/contracts?view=overdue"
            style={{
              ...styles.viewAllBtn,
              color: "#b91c1c",
              backgroundColor: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
            }}
            className="metric-card-hover"
          >
            ดูสัญญาที่เลยกำหนดทั้งหมด ({overdueContracts.length}){" "}
            <FaChevronRight size={9} />
          </Link>
        )}
      </>
    ) : null;

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
      if (!counts[key])
        counts[key] = {
          company: e.company || "",
          site: e.site || "",
          count: 0,
        };
      counts[key].count += 1;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .map((p) => ({
        ...p,
        name:
          p.company && p.site
            ? `${p.company} · ${p.site}`
            : p.company || p.site,
      }));
  })();
  const maxProjectCount = topProjects[0]?.count || 1;

  // 📄 แบ่งหน้ารายการโครงการ — แสดงหน้าละ 5 รายการ (รีเซ็ตกลับหน้า 1 เมื่อดึงข้อมูลใหม่)
  const PROJECTS_PER_PAGE = 5;
  const [projectPage, setProjectPage] = useState(1);
  useEffect(() => {
    setProjectPage(1);
  }, [events]);
  const totalProjectPages = Math.max(
    1,
    Math.ceil(topProjects.length / PROJECTS_PER_PAGE),
  );
  const pagedProjects = topProjects.slice(
    (projectPage - 1) * PROJECTS_PER_PAGE,
    projectPage * PROJECTS_PER_PAGE,
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
    {
      title: "แผนงานทั้งหมด",
      icon: <FaCalendarAlt size={20} />,
      link: "/event",
      color: "#dc2626",
    },
    {
      title: "การดำเนินงาน",
      icon: <FaWrench size={20} />,
      link: "/operation",
      color: "#b91c1c",
    },
    {
      title: "เอกสารทั้งหมด",
      icon: <FaFileAlt size={20} />,
      link: "/files",
      color: "#475569",
      badge: files.length,
    },
    // ✅ "ติดตามใบเสนอราคา" ย้ายขึ้นไปเป็นแบนเนอร์ hero ใหญ่เหนือ "สรุปสถานะงาน" แทนแล้ว (ตามที่ขอ)
    // ไม่ต้องมีซ้ำเป็นไอคอนเล็กๆ ที่นี่อีก (เทียบเหตุผลเดียวกับ "งานของฉัน" ด้านบน)
    // ✅ "งานของฉัน" ของช่างถูกย้ายขึ้นไปเป็นแบนเนอร์ hero เด่นๆ ด้านบนแทนแล้ว (ดู SECTION 2)
    // ไม่ต้องมีซ้ำเป็นไอคอนเล็กๆ ที่นี่อีก
    // ✅ ใช้ isAdminOrManager แทน isAdmin เพราะหน้า "ภาพรวมทีมช่าง" ตั้งใจให้ manager เข้าถึงได้ด้วย
    ...(isAdminOrManager
      ? [
          {
            title: "ภาพรวมทีมช่าง",
            icon: <FaUserFriends size={20} />,
            link: "/team-workload",
            color: "#0891b2",
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            title: "รายชื่อลูกค้าทั้งหมด",
            icon: <FaBuilding size={20} />,
            link: "/customer",
            color: "#3b82f6",
            badge: customers.length,
          },
          {
            title: "พนักงาน",
            icon: <FaUsers size={20} />,
            link: "/employee",
            color: "#f43f5e",
            badge: users.length,
          },
          {
            title: "ตั้งค่า",
            icon: <FaCog size={20} />,
            link: "/about",
            color: "#64748b",
          },
        ]
      : []),
  ];

  // ─── เนื้อหาแถบข้าง "งานค้างของช่าง" + "งานวางแผนล่วงหน้า" (เฉพาะแอดมิน/manager) — สร้างไว้
  // ตัวแปรเดียวแล้ว render 2 จุด (มือถือ/เดสก์ท็อป) แยกกันจริงๆ คนละ DOM element กันคนละ CSS
  // (ดู .dashboard-side--mobile / .dashboard-side--desktop) เพื่อไม่ให้ความสูงของแถบนี้ (ซึ่งขยับ
  // ขึ้นลงได้เวลากด dropdown) ไปกระทบ layout ของอีกฝั่งเลย — เดิมใช้ grid-row เดียวกันกับเนื้อหาหลัก
  // ทำให้กด dropdown ขยายแล้วทั้งหน้าสั่น/มีช่องว่างเกิดขึ้นเวลาแถบนี้สูงกว่าเนื้อหาหลักช่วงบน ───
  const sidebarContent = isAdminOrManager ? (
    <>
      {/* ─── งานที่กำลังจะถึงในอีก 7 วัน — ย้ายมาไว้บนสุด เหนือ "งานค้างของช่าง" ให้เห็นงานที่
      ใกล้ถึงกำหนดก่อนเป็นอันดับแรก (ไม่รวมงานวันนี้ เพราะการ์ด "งานวันนี้" ด้านบนแสดงอยู่แล้ว) ─── */}
      <h5 style={styles.sectionTitle}>🔔 งานที่กำลังจะถึง (7 วัน)</h5>
      <div style={styles.notiCard}>
        {loading ? (
          <div style={{ padding: "14px" }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{ ...styles.topProjectSkeletonRow }}
                className="skeleton-pulse"
              />
            ))}
          </div>
        ) : upcomingJobs.length === 0 ? (
          <div style={styles.notiEmpty}>
            <FaCalendarAlt
              size={20}
              style={{ opacity: 0.25, marginBottom: "6px" }}
            />
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              ไม่มีงานที่จะถึงใน 7 วันนี้
            </p>
          </div>
        ) : (
          <div style={{ padding: "6px 0" }}>
            {upcomingJobs.slice(0, 5).map((job) => {
              const jobStart = moment(job.start || job.date).startOf("day");
              const diffDays = jobStart.diff(today, "days");
              const badgeLabel =
                diffDays === 1 ? "พรุ่งนี้" : `อีก ${diffDays} วัน`;
              const jobGroup = resolveOperationGroup(job);
              return (
                <Link
                  key={job._id}
                  to={`/operation/${job._id}${jobGroup ? `?group=${jobGroup}` : ""}`}
                  style={styles.sideJobRow}
                  className="metric-card-hover"
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={styles.sideJobName}>{job.title || "งาน"}</span>
                    <span style={styles.sideJobDetail}>
                      {[job.company, job.site].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    style={{
                      ...styles.sideJobBadge,
                      ...(diffDays === 1
                        ? { backgroundColor: "#fef3c7", color: "#b45309" }
                        : {}),
                    }}
                  >
                    {badgeLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {upcomingJobs.length > 5 && (
        <Link
          to="/operation"
          style={styles.viewAllBtn}
          className="metric-card-hover"
        >
          ดูงานที่กำลังจะถึงทั้งหมด ({upcomingJobs.length}){" "}
          <FaChevronRight size={9} />
        </Link>
      )}

      <h5 style={{ ...styles.sectionTitle, marginTop: "16px" }}>
        งานค้างของช่าง
      </h5>
      <div style={styles.notiCard}>
        {loading ? (
          <div style={{ padding: "14px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ ...styles.topProjectSkeletonRow }}
                className="skeleton-pulse"
              />
            ))}
          </div>
        ) : overdueByTechnician.length === 0 ? (
          <div style={styles.notiEmpty}>
            <FaCheckDouble
              size={22}
              style={{ opacity: 0.25, marginBottom: "6px" }}
            />
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              ไม่มีงานค้างของช่างในตอนนี้ 🎉
            </p>
          </div>
        ) : (
          <div style={{ padding: "6px 0" }}>
            {overdueByTechnician.map(({ tech, count, severeCount, jobs }) => {
              const isExpanded = expandedOverdueTechIds.has(tech._id);
              return (
                <div key={tech._id}>
                  <div
                    onClick={() =>
                      setExpandedOverdueTechIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(tech._id)) next.delete(tech._id);
                        else next.add(tech._id);
                        return next;
                      })
                    }
                    style={styles.sideJobRow}
                    className="metric-card-hover"
                  >
                    <span style={styles.sideJobAvatar}>
                      {(tech.fname || tech.username || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={styles.sideJobName}>
                        {tech.fname || tech.username}
                      </span>
                      <span style={styles.sideJobDetail}>
                        {count} งานค้าง
                        {severeCount > 0
                          ? ` · ${severeCount} เกิน 2 สัปดาห์`
                          : ""}
                      </span>
                    </span>
                    <span
                      style={{
                        ...styles.sideJobBadge,
                        ...(severeCount > 0
                          ? {
                              backgroundColor: "#fee2e2",
                              color: "#ef4444",
                            }
                          : {}),
                      }}
                    >
                      {count}
                    </span>
                    <FaChevronRight
                      size={10}
                      style={{
                        marginLeft: "2px",
                        color: "#94a3b8",
                        flexShrink: 0,
                        transform: isExpanded ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>
                  {isExpanded && (
                    <div
                      style={styles.sideJobDropdown}
                      className="side-job-dropdown-enter"
                    >
                      {jobs.map((job) => (
                        <Link
                          key={job.id}
                          // ✅ เพิ่ม ?group=overdue — งานนี้เป็นงานค้างแน่ๆ (มาจากแถบ "งานค้าง
                          // ของช่าง") แต่ id เพียงอย่างเดียวไม่บอกหน้า Operation ว่าควรไฮไลต์
                          // แถบสถานะไหน ทำให้ขึ้นแถบผิด (เช่น "กำลังดำเนินการ") ทั้งที่งานที่
                          // เห็นจริงคืองานค้าง — ระบุ group ให้ตรงไปเลย
                          to={`/operation/${job.id}?group=overdue`}
                          style={styles.sideJobItem}
                          className="metric-card-hover"
                        >
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={styles.sideJobItemTitle}>
                              {job.title || "งาน"}
                            </span>
                            <span style={styles.sideJobItemSub}>
                              {[job.company, job.site]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <span
                            style={{
                              ...styles.sideJobItemDays,
                              ...(job.days >= 14 ? { color: "#ef4444" } : {}),
                            }}
                          >
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
      <Link
        to="/team-workload"
        style={styles.viewAllBtn}
        className="metric-card-hover"
      >
        ดูภาพรวมทีมช่างทั้งหมด <FaChevronRight size={9} />
      </Link>

      {/* ─── ใบเสนอราคาที่ต้องติดตาม (ส่งลูกค้าไปแล้วเกิน 7 วัน ยังไม่มีผล) — โชว์เฉพาะตอนมีจริง
      เป็นกล่องแจ้งเตือน (โทนส้ม/แดง) วางไว้เหนือ "งานวางแผนล่วงหน้า" ให้เห็นก่อน กดแต่ละแถวแล้วเด้ง
      เข้าไปที่หน้า /quotations พร้อมเปิดรายละเอียดงานนั้นให้เลยทันที (ดู ?jobId= ใน QuotationTracking.js) ─── */}
      {staleQuotations.length > 0 && (
        <>
          <h5 style={{ ...styles.sectionTitle, marginTop: "16px" }}>
            ⚠️ ใบเสนอราคาที่ต้องติดตาม
          </h5>
          <div style={styles.quotationAlertCard}>
            <div style={{ padding: "6px 0" }}>
              {staleQuotations.slice(0, 5).map((q) => (
                <Link
                  key={q.id}
                  to={`/quotations?jobId=${q.id}`}
                  style={styles.sideJobRow}
                  className="metric-card-hover"
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={styles.sideJobName}>{q.title || "งาน"}</span>
                    <span style={styles.sideJobDetail}>
                      {[q.company, q.site].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={styles.quotationAlertBadge}>
                    เกิน {q.days} วัน
                  </span>
                </Link>
              ))}
            </div>
          </div>
          {staleQuotations.length > 5 && (
            <Link
              to="/quotations"
              style={{
                ...styles.viewAllBtn,
                color: "#c2410c",
                backgroundColor: "rgba(249, 115, 22, 0.1)",
                border: "1px solid rgba(249, 115, 22, 0.25)",
              }}
              className="metric-card-hover"
            >
              ดูใบเสนอราคาที่ต้องติดตามทั้งหมด ({staleQuotations.length}){" "}
              <FaChevronRight size={9} />
            </Link>
          )}
        </>
      )}

      {/* ─── สัญญาที่เลยกำหนด/คงค้าง — สำเนาสำหรับจอมือถือเท่านั้น (ดู .dashboard-mobile-only ใน
      <style> ด้านล่าง) ตามที่ผู้ใช้ขอให้อยู่เหนือ "งานวางแผนล่วงหน้า" พอดี — sidebarContent ก้อนนี้
      render ซ้ำทั้งจอมือถือ/จอกว้าง (คนละคอลัมน์) ถ้าไม่ครอบด้วยคลาสนี้จะไปโผล่ซ้ำที่แถบข้างฝั่งขวา
      ของจอกว้างด้วย ทั้งที่จอกว้างต้องการให้อยู่ฝั่งซ้ายที่เดียว (ดู SECTION 5.5 ในคอลัมน์หลัก) ─── */}
      {overdueContractsBlock && (
        <div className="dashboard-mobile-only">{overdueContractsBlock}</div>
      )}

      {/* ─── งานวางแผนล่วงหน้า (drafts) — เดิมไม่มีทางเห็นได้เลยนอกจากเข้าไปเปิดหน้า "แผนงาน"
      เอง ย่อมาโชว์เป็นแถบข้างต่อจาก "งานค้างของช่าง" แทนพื้นที่ว่างที่เหลือด้านล่าง ─── */}
      <h5 style={{ ...styles.sectionTitle, marginTop: "16px" }}>
        📌 งานวางแผนล่วงหน้า
      </h5>
      <div style={styles.notiCard}>
        {loading ? (
          <div style={{ padding: "14px" }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{ ...styles.topProjectSkeletonRow }}
                className="skeleton-pulse"
              />
            ))}
          </div>
        ) : draftsPreview.length === 0 ? (
          <div style={styles.notiEmpty}>
            <FaCalendarAlt
              size={20}
              style={{ opacity: 0.25, marginBottom: "6px" }}
            />
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              ยังไม่มีงานวางแผนล่วงหน้า
            </p>
          </div>
        ) : (
          <div style={{ padding: "6px 0" }}>
            {draftsPreview.map((d) => (
              <Link
                key={d._id}
                to="/event"
                style={styles.sideJobRow}
                className="metric-card-hover"
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={styles.sideJobName}>[{d.title}]</span>
                  <span style={styles.sideJobDetail}>
                    {d.system ? `💻ระบบ : ${d.system}` : ""}
                  </span>
                  <span style={styles.sideJobDetail}>
                    🏢โครงการ : {[d.site].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span style={styles.sideJobBadge}>
                  {d.plannedMonth
                    ? moment(d.plannedMonth, "YYYY-MM")
                        .locale("th")
                        .format("MMM YYYY")
                    : "-"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ✅ แบ่งหน้าแทนโชว์แค่ไม่กี่ใบตายตัว — เห็นได้ครบทุกใบจากตรงนี้เลย 5 แถวต่อหน้า */}
      {draftsSorted.length > DRAFTS_PAGE_SIZE && (
        <div style={styles.draftsPagination}>
          <button
            type="button"
            style={{
              ...styles.draftsPageNav,
              ...(draftsSafePage <= 1 ? styles.draftsPageNavDisabled : {}),
            }}
            onClick={() => setDraftsPage((p) => Math.max(1, p - 1))}
            disabled={draftsSafePage <= 1}
            title="หน้าก่อนหน้า"
          >
            <FaChevronRight size={10} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span style={styles.draftsPageLabel}>
            หน้า {draftsSafePage} / {draftsTotalPages}
          </span>
          <button
            type="button"
            style={{
              ...styles.draftsPageNav,
              ...(draftsSafePage >= draftsTotalPages
                ? styles.draftsPageNavDisabled
                : {}),
            }}
            onClick={() =>
              setDraftsPage((p) => Math.min(draftsTotalPages, p + 1))
            }
            disabled={draftsSafePage >= draftsTotalPages}
            title="หน้าถัดไป"
          >
            <FaChevronRight size={10} />
          </button>
        </div>
      )}

      {/* ✅ ใช้ generalDrafts (ตัดฉบับร่างของสัญญาออกแล้ว) ให้ตัวเลขตรงกับรายการที่แสดงจริงด้านบน
          และตรงกับจำนวนที่จะเห็นจริงเมื่อกดไปหน้า "แผนงาน" (ซึ่งกรองแบบเดียวกัน — ดู visibleDrafts) */}
      {generalDrafts.length > 0 && (
        <Link
          to="/event"
          style={styles.viewAllBtn}
          className="metric-card-hover"
        >
          ดูงานวางแผนล่วงหน้าทั้งหมด ({generalDrafts.length}){" "}
          <FaChevronRight size={9} />
        </Link>
      )}
    </>
  ) : null;

  return (
    <Container fluid style={styles.container}>
      {/* ─── LAYOUT: จอกว้างพอ (≥960px) แบ่ง 2 คอลัมน์ เนื้อหาหลัก + แถบข้าง "งานค้างของช่าง"
        (เดิมจำกัด maxWidth ของ container ไว้แล้วเหลือพื้นที่ว่างข้างขวาเยอะบนจอกว้าง เอามาใช้ตรงนี้
        แทนที่จะปล่อยว่าง) — DOM แบ่งเนื้อหาหลักเป็น 2 ท่อน (บน/ล่าง) คั่นด้วยแถบข้างตรงกลาง เพื่อให้
        จอแคบ/มือถือ (คอลัมน์เดียว) แสดงแถบข้างแทรกอยู่ก่อน "โครงการที่มีงานมากที่สุด" ไม่ใช่ไปตกอยู่
        ท้ายสุดหลังทุกอย่างแบบเดิม ส่วนจอกว้าง (≥960px) ไม่ต้องพึ่ง DOM เดียวกันแบบนี้อีกต่อไป —
        render แถบข้างแยกเป็นคนละชุดจริงๆ สำหรับมือถือ/เดสก์ท็อป (ดู .dashboard-side--mobile /
        .dashboard-side--desktop) กันไม่ให้ความสูงที่ขยับได้ของแถบข้างไปกระทบ layout เนื้อหาหลัก ─── */}
      <div className="dashboard-layout">
        <div className="dashboard-main-group">
          <div className="dashboard-main">
            {/* ─── SECTION 1: TOP GREETING — ✅ เดิมมีทั้งรูปโปรไฟล์และปุ่มกระดิ่งซ้ำกับ Header.js
          (ซึ่งอยู่เหนือหน้านี้ตลอดเวลา แสดงพร้อมกันในจอเดียว) ตัดทั้งสองออก เหลือแค่ข้อความทักทาย
          + ชื่อ + badge สิทธิ์ ให้แถวนี้โล่งและกระชับที่สุด (แจ้งเตือนดูได้จากกระดิ่งบน Header
          หรือเลื่อนลงไปที่ส่วน "การแจ้งเตือนล่าสุด" ด้านล่างอยู่แล้ว ไม่จำเป็นต้องมีทางลัดซ้ำที่นี่) ─── */}
            <div style={styles.topAppBar}>
              <div>
                <span style={styles.welcomeSub}>
                  {getGreeting()} ·{" "}
                  {moment().locale("th").format("D MMMM YYYY")}
                </span>
                <h2 style={styles.welcomeTitle}>
                  {userData?.fname || "ผู้ใช้งาน"}
                </h2>
              </div>
              <span style={styles.roleBadge}>{userData?.role || "User"}</span>
            </div>

            {/* ─── SECTION 1.5: "งานของฉัน" HERO (เฉพาะช่าง) — ให้เด่นและละเอียดกว่าไอคอนเล็กๆ เดิม
          วางไว้บนสุด (ก่อนแบนเนอร์ปฏิทินทั่วไป) เพราะเป็นสิ่งที่ช่างต้องใช้งานทุกวันมากที่สุด ─── */}
            {isTechnician && (
              <div
                onClick={() => navigate("/technician/jobs")}
                style={styles.myJobsBanner}
                className="action-hero-btn"
              >
                <div style={styles.myJobsIconCircle}>
                  <FaClipboardList size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={styles.heroBtnTitle}>งานของฉัน</h3>
                  <p style={styles.heroBtnSub}>
                    {loading ? "กำลังโหลด..." : myJobsSummary}
                  </p>
                </div>
                {!loading && myActiveJobsCount + myPendingApprovalCount > 0 && (
                  <span style={styles.myJobsCountBadge}>
                    {myActiveJobsCount + myPendingApprovalCount}
                  </span>
                )}
                <FaArrowRight
                  size={13}
                  className="arrow-bounce"
                  style={{ opacity: 0.8, flexShrink: 0 }}
                />
              </div>
            )}

            {/* ─── SECTION 2: CTA BANNER PAIR — เดิมเป็นแบนเนอร์เต็มความกว้างแค่ปฏิทินอันเดียว ส่วนปุ่ม
          "ดูการดำเนินงานทั้งหมด" ไปหลบเป็นชิปเล็กๆ อยู่ข้างหัวข้อ "งานวันนี้" คนละจุดคนละน้ำหนัก
          แบ่งครึ่งเป็น 2 การ์ดเท่ากัน ให้ทั้งคู่เด่นเท่ากันและกดถึงจากจุดเดียวกันด้านบนสุด ─── */}
            <div style={styles.heroPairGrid}>
              <div
                onClick={() => navigate("/event")}
                style={styles.heroPairCard}
                className="action-hero-btn"
              >
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
                style={{
                  ...styles.heroPairCard,
                  background:
                    "linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)",
                  boxShadow: "0 8px 18px -8px rgba(37, 99, 235, 0.35)",
                }}
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

            {/* ─── SECTION 2.5: "ติดตามใบเสนอราคา" BIG BANNER — เดิมเป็นไอคอนเล็กๆ ในทางลัด ยกขึ้นมา
          เป็นแบนเนอร์เต็มความกว้างเหนือ "สรุปสถานะงาน" ให้เด่นตามที่ขอ ทุกสิทธิ์เข้าถึงได้
          (admin/manager/ช่าง เหมือนหน้า /quotations เอง) ใช้สีส้มแยกจากกลุ่มสีอื่นทั้งหมด ─── */}
            <div
              onClick={() => navigate("/quotations")}
              style={styles.quotationBanner}
              className="action-hero-btn"
            >
              <div style={styles.myJobsIconCircle}>
                <FaFileInvoiceDollar size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={styles.heroBtnTitle}>ติดตามใบเสนอราคา</h3>
                <p style={styles.heroBtnSub}>ดูสถานะ · อนุมัติ/ปฏิเสธ · ติดตามลูกค้า</p>
              </div>
              <FaArrowRight
                size={13}
                className="arrow-bounce"
                style={{ opacity: 0.8, flexShrink: 0 }}
              />
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
                    to={`/operation?status=${encodeURIComponent(item.status)}${item.group ? `&group=${item.group}` : ""}`}
                    style={styles.statTile}
                    className="metric-card-hover"
                  >
                    <div
                      style={{
                        ...styles.statTileIcon,
                        backgroundColor: meta.bg,
                        color: meta.color,
                      }}
                    >
                      <StatIcon size={11} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {loading ? (
                        <span
                          style={styles.skeletonInline}
                          className="skeleton-pulse"
                        />
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
            <h5 style={styles.sectionTitle}>
              งานวันนี้ · {moment().locale("th").format("D MMM")}
            </h5>
            {loading ? (
              <div style={styles.todayScrollRow}>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.todayJobCard,
                      ...styles.skeletonPulseBg,
                    }}
                    className="skeleton-pulse"
                  />
                ))}
              </div>
            ) : todayJobs.length === 0 ? (
              <div style={styles.notiCard}>
                <div style={styles.notiEmpty}>
                  <FaCalendarAlt
                    size={22}
                    style={{ opacity: 0.25, marginBottom: "6px" }}
                  />
                  <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                    ไม่มีงานที่นัดหมายไว้ในวันนี้
                  </p>
                </div>
              </div>
            ) : (
              <div style={styles.todayScrollRow}>
                {todayJobs.map((job) => {
                  const meta = getStatusMeta(job.status);
                  const assignedName = getAssignedName(job);
                  const jobGroup = resolveOperationGroup(job);
                  return (
                    <div
                      key={job._id}
                      style={styles.todayJobCard}
                      className="metric-card-hover"
                      onClick={() =>
                        navigate(
                          `/operation/${job._id}${jobGroup ? `?group=${jobGroup}` : ""}`,
                        )
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={styles.todayJobTime}>
                          <FaClock size={10} style={{ marginRight: "4px" }} />
                          {job.startTime && job.endTime
                            ? `${job.startTime}-${job.endTime}`
                            : "ทั้งวัน"}
                        </span>
                        <span
                          style={{
                            ...styles.todayJobStatusChip,
                            backgroundColor: meta.bg,
                            color: meta.color,
                          }}
                        >
                          {job.status}
                        </span>
                      </div>
                      {job.docNo && (
                        <span style={styles.todayJobDocNo}>#{job.docNo}</span>
                      )}

                      <h4 style={styles.todayJobTitle}>
                        [{job.title || job.company}]
                      </h4>
                    

                      {job.system && (
                        <p style={styles.todayJobDetail}>
                      
                          💻ระบบ : {job.system}
                        </p>
                      )}
                      <p style={styles.todayJobSite}>
                     
                        🏢โครงการ : {job.site}
                      </p>

                      {assignedName && (
                        <p style={styles.todayJobDetail}>
                          
                          👷ทีม : {assignedName}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── แถบข้าง: งานค้างของช่างแยกรายคน (เฉพาะแอดมิน/manager) — ✅ ย้ายมาไว้ตรงนี้ (แทรกระหว่าง
        เนื้อหาช่วงบน/ล่างของหลัก) แทนที่จะอยู่หลังเนื้อหาหลักทั้งหมด เพราะบนมือถือ (คอลัมน์เดียว)
        DOM มาก่อน = แสดงก่อน ถ้าอยู่ท้ายสุดจะไปโผล่ล่างสุดหลัง "ภาพรวมทีมงาน" ซึ่งไกลเกินไป — ย้าย
        มาอยู่ก่อน "โครงการที่มีงานมากที่สุด" แทน ส่วนจอกว้าง (≥960px) ใช้ grid-column/grid-row
        (ดู .dashboard-side ใน <style>) ดึงกลับไปเป็นคอลัมน์ข้างเหมือนเดิมโดยไม่ต้องย้าย DOM ซ้ำ ─── */}
          {isAdminOrManager && (
            <div className="dashboard-side dashboard-side--mobile">
              {sidebarContent}
            </div>
          )}

          <div className="dashboard-main">
            {/* ─── SECTION 5.5: สัญญาที่เลยกำหนด/คงค้าง (จากหน้า "ภาพรวมงาน") — เปิดให้ทุกสิทธิ์ที่
          เข้าหน้า "ภาพรวมงาน" ได้เห็น (แอดมิน/manager/ช่าง) เพราะช่างก็มีสัญญาที่ตัวเองรับผิดชอบ
          เลยกำหนดได้เหมือนกัน — ✅ ตามที่ผู้ใช้ขอ: จอกว้าง (แอดมิน/manager) วางไว้ตรงนี้ (คอลัมน์หลัก
          ฝั่งซ้าย) แต่จอมือถือย้ายไปแทรกอยู่เหนือ "งานวางแผนล่วงหน้า" ในแถบข้างแทน (ดู sidebarContent)
          เลยต้องซ่อนสำเนานี้บนจอมือถือด้วย .dashboard-desktop-only กันโชว์ซ้ำ 2 ที่ — ส่วนช่าง (ไม่มี
          sidebarContent ให้แทรกด้วย เพราะทั้งก้อนนั้นเฉพาะแอดมิน/manager) ยังคงเห็นสำเนานี้ตามปกติ
          ทั้งจอมือถือ/จอกว้างเหมือนเดิม ไม่ต้องซ่อน ─── */}
            {isAdminOrManager ? (
              <div className="dashboard-desktop-only">{overdueContractsBlock}</div>
            ) : (
              overdueContractsBlock
            )}

            {/* ─── SECTION 6: TOP PROJECTS (เฉพาะแอดมิน/manager — events scope ตาม role มีความหมาย
          เป็น "ภาพรวมทั้งบริษัท" จริงๆ แค่กับสองสิทธิ์นี้เท่านั้น) ─── */}
            {isAdminOrManager && (
              <>
                <h5 style={styles.sectionTitle}>โครงการที่มีงานมากที่สุด</h5>
                <div style={styles.notiCard}>
                  {loading ? (
                    <div style={{ padding: "16px" }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          style={{ ...styles.topProjectSkeletonRow }}
                          className="skeleton-pulse"
                        />
                      ))}
                    </div>
                  ) : topProjects.length === 0 ? (
                    <div style={styles.notiEmpty}>
                      <FaBuilding
                        size={22}
                        style={{ opacity: 0.25, marginBottom: "6px" }}
                      />
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "#94a3b8",
                        }}
                      >
                        ยังไม่มีข้อมูลงานของโครงการ
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={styles.topProjectList}>
                        {pagedProjects.map((p, i) => {
                          const rank =
                            (projectPage - 1) * PROJECTS_PER_PAGE + i + 1;
                          return (
                            <Link
                              key={p.name}
                              to={`/customer?company=${encodeURIComponent(p.company)}&site=${encodeURIComponent(p.site)}`}
                              style={{ textDecoration: "none" }}
                            >
                              <div
                                style={styles.topProjectRow}
                                className="metric-card-hover"
                              >
                                <span
                                  style={{
                                    ...styles.topProjectRank,
                                    ...(rank === 1
                                      ? {
                                          backgroundColor: "#dc2626",
                                          color: "#fff",
                                        }
                                      : {}),
                                  }}
                                >
                                  {rank}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={styles.topProjectName}>{p.name}</p>
                                  <div style={styles.topProjectTrack}>
                                    <div
                                      style={{
                                        ...styles.topProjectBar,
                                        width: `${Math.max((p.count / maxProjectCount) * 100, 6)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                <span style={styles.topProjectCount}>
                                  {p.count}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {totalProjectPages > 1 && (
                        <div style={styles.projectPagination}>
                          <button
                            type="button"
                            onClick={() =>
                              setProjectPage((p) => Math.max(1, p - 1))
                            }
                            disabled={projectPage === 1}
                            style={{
                              ...styles.projectPageBtn,
                              opacity: projectPage === 1 ? 0.35 : 1,
                            }}
                            className="metric-card-hover"
                          >
                            <FaChevronLeft size={10} />
                          </button>
                          <span style={styles.projectPageLabel}>
                            หน้า {projectPage} / {totalProjectPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setProjectPage((p) =>
                                Math.min(totalProjectPages, p + 1),
                              )
                            }
                            disabled={projectPage === totalProjectPages}
                            style={{
                              ...styles.projectPageBtn,
                              opacity:
                                projectPage === totalProjectPages ? 0.35 : 1,
                            }}
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
                <Link
                  key={idx}
                  to={action.link}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={styles.quickActionItem}
                    className="metric-card-hover"
                  >
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          ...styles.quickActionIcon,
                          backgroundColor: `${action.color}15`,
                          color: action.color,
                        }}
                      >
                        {action.icon}
                      </div>
                      {action.badge > 0 && (
                        <span style={styles.quickActionBadge}>
                          {action.badge > 99 ? "99+" : action.badge}
                        </span>
                      )}
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
                        <span
                          style={{ ...styles.teamChipCount, color: item.color }}
                        >
                          {loading ? "…" : roleCounts[item.key] || 0}
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

        {/* ✅ สำเนาแถบข้างสำหรับเดสก์ท็อปโดยเฉพาะ — คนละ DOM element กับฝั่งมือถือด้านบน ทำให้
            ความสูงที่ขยับได้ของแถบนี้ (กด dropdown งานค้างขยาย/หุบ) ไม่ไปกระทบความสูงของ
            .dashboard-main-group เลย เพราะเป็น sibling อิสระ ไม่ได้ใช้ grid row ร่วมกันอีกต่อไป */}
        {isAdminOrManager && (
          <div className="dashboard-side dashboard-side--desktop">
            {sidebarContent}
          </div>
        )}
      </div>

      {/* ─── INTERACTIVE EFFECTS FOR MOBILE ─── */}
      <style>{`
        /* ✅ เดิมใช้ CSS Grid เดียวกันทั้งเนื้อหาหลักและแถบข้าง (grid-row/grid-column ผสม sticky)
           เพื่อ "ย้าย" แถบข้างไปมาระหว่างมือถือ/เดสก์ท็อปโดยไม่ต้องมี DOM ซ้ำ — แต่ทุกครั้งที่แถบข้าง
           เปลี่ยนความสูง (เช่น กด dropdown งานค้างขยาย/หุบ, หรือมีวิดเจ็ตใหม่ยาวขึ้น) CSS Grid ต้อง
           คำนวณ row track ของทั้ง 2 คอลัมน์ใหม่ร่วมกัน ทำให้กระทบเนื้อหาหลักไปด้วย (ช่องว่างเกิน/
           กระตุก/หน้าเลื่อนเอง) — ตอนนี้แยกจริงๆ เป็นคนละ DOM element ต่างหากสำหรับมือถือ/เดสก์ท็อป
           (.dashboard-side--mobile / .dashboard-side--desktop, เนื้อหาเดียวกันจาก sidebarContent)
           ใช้ flexbox แทน grid ด้วย — flex item แต่ละตัวมีความสูงอิสระของตัวเอง ไม่มีแนวคิด
           "row track ร่วมกัน" แบบ grid จึงตัดปัญหานี้ได้เด็ดขาด ไม่ใช่แค่ลดผลกระทบ */
        .dashboard-layout {
          display: block;
        }
        .dashboard-main-group {
          min-width: 0;
        }
        .dashboard-side--mobile {
          margin: 20px 0;
        }
        .dashboard-side--desktop {
          display: none;
        }
        /* ✅ คู่คลาสสลับแสดง/ซ่อนตามความกว้างจอ — เทียบ pattern เดียวกับ dashboard-side--mobile/
           --desktop ด้านบน แต่ใช้กับ "เนื้อหาชิ้นเดียวที่ต้อง render ซ้ำ 2 จุดคนละตำแหน่ง" แทนทั้ง
           แถบข้าง (เช่น "สัญญาที่เลยกำหนด/คงค้าง" ที่จอมือถือให้อยู่เหนือ "งานวางแผนล่วงหน้า" ในแถบข้าง
           แต่จอกว้างให้อยู่คอลัมน์หลักฝั่งซ้ายแทน) ไม่ผูกกับ width/sticky ของแถบข้างเหมือนคู่บน เพื่อไม่ให้
           กระทบ layout ของจุดที่เอาไปใช้ */
        .dashboard-mobile-only {
          display: block;
        }
        .dashboard-desktop-only {
          display: none;
        }
        @media (min-width: 960px) {
          .dashboard-layout {
            display: flex;
            align-items: flex-start;
            gap: 20px;
          }
          .dashboard-main-group {
            flex: 1;
          }
          .dashboard-side--mobile {
            display: none;
          }
          .dashboard-mobile-only {
            display: none;
          }
          .dashboard-desktop-only {
            display: block;
          }
          .dashboard-side--desktop {
            display: block;
            width: 300px;
            flex-shrink: 0;
            position: sticky;
            top: 16px;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            /* ✅ ยังกันไว้เผื่อ browser scroll-anchoring พยายามชดเชยตอนแถบนี้เปลี่ยนความสูง —
               แม้ตอนนี้จะไม่กระทบเนื้อหาหลักแล้วก็ตาม (คนละ flex item กันแล้ว) แต่ยังกันตัวเอง
               กระโดดเองเวลาขยาย/หุบ dropdown ภายในตัวมันเองไว้ด้วย */
            overflow-anchor: none;
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
    minHeight: "100vh",
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
    lineHeight: 1.2,
  },
  welcomeSub: {
    fontSize: "11px",
    color: "#94a3b8",
    display: "block",
    marginBottom: "1px",
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
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
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
  // ✅ เดิม whiteSpace:nowrap + ellipsis ตัดข้อความ "แผนงานทั้งหมด"/"การดำเนินงาน" ให้เหลือ
  // "แผนงานที..." บนจอแคบ (การ์ดครึ่งจอ) — ลดขนาดตัวอักษรลงนิด + ปล่อยให้ตัดขึ้นบรรทัดใหม่ได้
  // แทน (ไม่ ellipsis อีกต่อไป) ให้เห็นข้อความเต็มเสมอทุกขนาดจอ
  heroPairTitle: {
    fontSize: "12px",
    fontWeight: "800",
    margin: 0,
    color: "#ffffff",
    letterSpacing: "-0.2px",
    lineHeight: 1.2,
  },
  heroPairSub: {
    fontSize: "9.5px",
    color: "rgba(255, 255, 255, 0.75)",
    margin: "2px 0 0 0",
    lineHeight: 1.2,
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
    letterSpacing: "-0.2px",
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

  /* 🟠 "ติดตามใบเสนอราคา" hero — โครงสไตล์เดียวกับ myJobsBanner (icon circle/title/sub/arrow)
     แค่เปลี่ยนเป็นโทนส้มให้แยกจากกลุ่มสีอื่น (แดง=แผนงาน, น้ำเงิน=การดำเนินงาน, ฟ้า=งานของฉัน) */
  quotationBanner: {
    width: "100%",
    background: "linear-gradient(135deg, #f97316 0%, #9a3412 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "16px",
    padding: "14px",
    cursor: "pointer",
    boxShadow: "0 8px 18px -8px rgba(249, 115, 22, 0.35)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
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

  /* 📄 แบ่งหน้างานวางแผนล่วงหน้า (Dashboard sidebar) */
  draftsPagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    margin: "8px 0",
  },
  draftsPageNav: {
    flexShrink: 0,
    width: "26px",
    height: "26px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    color: "#475569",
    cursor: "pointer",
  },
  draftsPageNavDisabled: {
    opacity: 0.35,
    cursor: "default",
  },
  draftsPageLabel: {
    fontSize: "11.5px",
    fontWeight: "600",
    color: "#475569",
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

  /* ⚠️ กล่องแจ้งเตือนใบเสนอราคาที่ต้องติดตาม (Dashboard sidebar) — โทนส้ม แยกจาก
     notiCard ปกติ (ขาว/เทา) ให้เด่นชัดว่าเป็นเรื่องด่วนที่ต้องรีบดู */
  quotationAlertCard: {
    backgroundColor: "#fff7ed",
    borderRadius: "14px",
    border: "1px solid rgba(249, 115, 22, 0.3)",
    marginBottom: "10px",
    overflow: "hidden",
  },
  quotationAlertBadge: {
    fontSize: "10.5px",
    fontWeight: "800",
    color: "#c2410c",
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    padding: "3px 9px",
    borderRadius: "11px",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  /* ⏰ กล่องแจ้งเตือนสัญญาที่เลยกำหนด/คงค้าง (Dashboard เนื้อหาหลัก) — โทนแดง แยกจาก
     quotationAlertCard (ส้ม) เทียบสีเดียวกับป้ายเตือน "เลยกำหนด" ในหน้า ContractOverview.js เอง
     (#dc2626) ให้เห็นชัดว่าเป็นคนละเรื่องกัน (ใบเสนอราคา vs รอบเข้างานสัญญา) */
  contractOverdueCard: {
    backgroundColor: "#fef2f2",
    borderRadius: "14px",
    border: "1px solid rgba(220, 38, 38, 0.3)",
    marginBottom: "10px",
    overflow: "hidden",
  },
  contractOverdueBadge: {
    fontSize: "10.5px",
    fontWeight: "800",
    color: "#b91c1c",
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    padding: "3px 9px",
    borderRadius: "11px",
    flexShrink: 0,
    whiteSpace: "nowrap",
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
