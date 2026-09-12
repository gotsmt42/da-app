import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter, useLocation } from "react-router-dom";

/**
 * พา URL เดิมไปหน้ารวม "พร้อมพาต่อไปให้ถึงจุดที่เจาะจงมา"
 *
 * 🐛 BUG ที่แก้ (แจ้งเตือนกดแล้วไปไม่ถึงรายการที่แจ้ง): เดิมใช้ <Navigate to="/finance?tab=billing">
 * ซึ่งเขียนปลายทางตายตัว — query ที่ติดมากับลิงก์เดิมถูกทิ้งทั้งหมด ทั้งที่หน้าปลายทางรองรับอยู่แล้ว
 *   • /quotations?jobId=xxx  (แจ้งเตือน "ใบเสนอราคาค้างนาน" ของงานใบนั้น) → jobId หายไป
 *     กลายเป็นเปิดรายการรวมเฉยๆ ผู้ใช้ต้องไปไล่หางานเองทั้งที่ระบบรู้อยู่แล้วว่างานไหน
 *   • /billing?status=overdue (แจ้งเตือน "บิลเลยกำหนดชำระ") → ตัวกรองหายไป
 * ✅ คงพารามิเตอร์เดิมไว้ทุกตัว แล้วเติม/ทับเฉพาะ tab ของหน้ารวม
 * ⚠️ ต้องทับ tab เสมอ — ชื่อพารามิเตอร์ชนกันพอดี (หน้ารวมใช้ tab เลือกแท็บ) ถ้าปล่อยค่าเดิมไว้
 * จะเปิดผิดแท็บ พารามิเตอร์ย่อยของแต่ละแท็บจึงต้องใช้ชื่ออื่น (เช่น status, jobId)
 */
const LegacyTabRedirect = ({ to, tab }) => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  return <Navigate to={`${to}?${params.toString()}`} replace />;
};

// Layouts และ Pages (Lazy Loaded)
const FullLayout = lazy(() => import("@/layouts/FullLayout.js"));
const PrivateRoute = lazy(() => import("./PrivateRoute.js"));
const AdminRoute = lazy(() => import("./AdminRoute.js"));

const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard.js"));
const NoConnection = lazy(() => import("../NoConnection.js"));
const About = lazy(() => import("@/features/settings/pages/Settings.js"));
// ⚠️ ลบหน้า demo ของ template MaterialPro ออกแล้ว (Alerts/Badges/Buttons/Cards/Grid/Forms/
// Breadcrumbs) — เป็นหน้าตัวอย่างที่ติดมากับ template ตั้งแต่ตอนสร้างโปรเจกต์ ไม่เกี่ยวกับธุรกิจ
// ไม่มีลิงก์จากเมนูไหนเลย และไม่มีใคร import ต่อ
const Account = lazy(() => import("@/features/staff/pages/Account.js"));
const Product = lazy(() => import("@/features/products/pages/Product"));
const StockProduct = lazy(() => import("@/features/products/pages/StockProduct"));
const WorkTypeSystem = lazy(() => import("@/features/settings/pages/WorkTypeSystem.js"));
const ContractOverview = lazy(() => import("@/features/contracts/pages/ContractOverview.js"));
const FileUpload = lazy(() => import("@/features/documents/pages/FileUploadPage"));
const EventCalendar = lazy(() => import("@/features/calendar/pages/EventCalendar.js"));
const Operate = lazy(() => import("@/features/operation/pages/Operation.js"));
const Login = lazy(() => import("@/features/auth/pages/Login.js"));
const Register = lazy(() => import("@/features/auth/pages/Register.js"));

const PublicRoute = lazy(() => import("./PublicRoute.js"));
const CheckConnectionToast = lazy(() => import("./CheckConnectionToast.js"));

// ✅ "งานของฉัน" ของช่าง = งานตามตารางอย่างเดียว
// 🧹 เคยห่อด้วยแท็บเพื่อเพิ่ม "งานที่ได้รับมอบหมาย" (ใบ Dispatch) — ตัดออกตามที่ผู้ใช้สั่ง
// เพราะใบที่อนุมัติแล้วถูกสร้างเป็นงานบนปฏิทินจริงอยู่แล้ว จึงโผล่ในงานตามตารางตั้งแต่แรก
// แท็บที่สองเลยเป็นรายการเดียวกันซ้ำอีกที่ ในรูปแบบที่ปิดงานไม่ได้
const MyJobs = lazy(() => import("@/features/technician/pages/MyJobs.js"));
// ✅ งานฝ่ายขาย (ท่อขาย / ปฏิทินนัดหมาย / งานที่ส่งให้ช่าง) — คนละสายงานกับปฏิทินช่างโดยสิ้นเชิง
const JobRequests = lazy(() => import("@/features/dispatch/pages/JobRequests.js"));
// ✅ คิวจ่ายงานของแอดมิน — ใบมอบหมายงานข้ามแผนก
const JobRequestQueue = lazy(() => import("@/features/dispatch/pages/JobRequestQueue.js"));

// ✅ หน้ารวม 4 หน้า — ยุบหน้าที่เป็นข้อมูลประเภทเดียวกันให้เหลือหน้าเดียวต่อเรื่อง แล้วแยกด้วยแท็บ
// (ดูเหตุผลของแต่ละการรวมในหัวไฟล์ของแต่ละตัว) URL เดิมทั้งหมดยัง redirect เข้ามาที่นี่ได้ ลิงก์เก่าไม่พัง
// ⚠️ Customer / Employee / TeamWorkload / CustomerOverview / BillingTracking / QuotationTracking /
// IssuedDocuments / Files ไม่ถูก import ที่นี่แล้ว — ย้ายไปโหลดแบบ lazy ภายใน Hub ที่เกี่ยวข้องแทน
// (Router รู้จักแค่หน้ารวม 4 หน้า ส่วนหน้าย่อยเป็นรายละเอียดภายในของ Hub นั้นๆ)
const CustomerHub = lazy(() => import("@/features/customers/pages/CustomerHub.js"));
const StaffHub = lazy(() => import("@/features/staff/pages/StaffHub.js"));
const DocumentsHub = lazy(() => import("@/features/documents/pages/DocumentsHub.js"));
const FinanceHub = lazy(() => import("@/features/finance/pages/FinanceHub.js"));


const ThemeRoutes = [
  {
    path: "/",
    element: (
      <CheckConnectionToast>
        <PrivateRoute>
          <Suspense fallback={<div>Loading Layout...</div>}>
            <FullLayout />
          </Suspense>
        </PrivateRoute>
      </CheckConnectionToast>
    ),
    children: [
      { path: "/", element: <Navigate to="/dashboard" /> },
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<div>Loading Dashboard...</div>}>
            <Dashboard />
          </Suspense>
        ),
        title: "Dashboard",
      },
      {
        path: "about",
        element: (
          <Suspense fallback={<div>Loading Settings...</div>}>
            <About />
          </Suspense>
        ),
        title: "Settings",
      },
      {
        path: "account",
        element: (
          <Suspense fallback={<div>Loading Account...</div>}>
            <Account />
          </Suspense>
        ),
        title: "Account",
      },
      // ── หน้ารวม (ยุบหน้าที่เป็นข้อมูลประเภทเดียวกันให้เหลือหน้าเดียวต่อเรื่อง) ──────────
      // ⚠️ ไม่ห่อด้วย AdminRoute — แต่ละ Hub เช็ค role เองและ "ไม่สร้างแท็บ" ที่ผู้ใช้ไม่มีสิทธิ์เห็น
      // (manager ต้องเข้าได้ด้วย ซึ่ง AdminRoute เดิมรับแค่ admin) ดูเหตุผลเต็มในหัวไฟล์ของแต่ละ Hub
      {
        path: "customers",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <CustomerHub />
          </Suspense>
        ),
        title: "Customers",
      },
      {
        path: "staff",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <StaffHub />
          </Suspense>
        ),
        title: "Staff",
      },
      {
        path: "documents",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <DocumentsHub />
          </Suspense>
        ),
        title: "Documents",
      },
      {
        path: "finance",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <FinanceHub />
          </Suspense>
        ),
        title: "Finance",
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "customer",
        element: <LegacyTabRedirect to="/customers" tab="registry" />,
      },
      {
        path: "worktype",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading...</div>}>
              <WorkTypeSystem />
            </Suspense>
          </AdminRoute>
        ),
        title: "Work Type",
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "team-workload",
        element: <LegacyTabRedirect to="/staff" tab="workload" />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "billing",
        element: <LegacyTabRedirect to="/finance" tab="billing" />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "customer-overview",
        element: <LegacyTabRedirect to="/customers" tab="overview" />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "quotations",
        element: <LegacyTabRedirect to="/finance" tab="quotations" />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "issued-documents",
        element: <LegacyTabRedirect to="/documents" tab="issued" />,
      },
      {
        // ✅ ไม่ห่อด้วย AdminRoute เพราะ manager ต้องเข้าได้ด้วย เหมือน team-workload/quotations ด้านบน —
        // ตัวคอมโพเนนต์เองเช็ค role แล้ว redirect กลับ /dashboard ถ้าไม่ใช่ admin/manager
        path: "contracts",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <ContractOverview />
          </Suspense>
        ),
        title: "Job Overview",
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "employee",
        element: <LegacyTabRedirect to="/staff" tab="registry" />,
      },
      {
        path: "product",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Product...</div>}>
              <Product />
            </Suspense>
          </AdminRoute>
        ),
        title: "Product",
      },
      {
        path: "product/stock",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Stock Product...</div>}>
              <StockProduct />
            </Suspense>
          </AdminRoute>
        ),
        title: "Stock Product",
      },
      {
        path: "fileupload",
        element: (

            <Suspense fallback={<div>Loading File Upload...</div>}>
              <FileUpload />
            </Suspense>

        ),
        title: "File Upload",
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "files",
        element: <LegacyTabRedirect to="/documents" tab="files" />,
      },
      {
        path: "event",
        element: (
          <Suspense fallback={<div>Loading Event Calendar...</div>}>
            <EventCalendar />
          </Suspense>
        ),
        title: "Event Calendar",
      },
     {
  // ✅ รวม "operation" กับ "operation/:id" เป็น route เดียวด้วย ":id?" (optional segment)
  // เดิมแยกเป็น 2 route object ทำให้ React Router unmount/remount <Operate/> ใหม่ทั้งหมด
  // ทุกครั้งที่สลับไปมาระหว่างสองเส้นทางนี้ (เช่น กดแจ้งเตือนแล้วเด้งไปงานเฉพาะ) หน้าเลย
  // กระพริบ/โหลดใหม่ทั้งหน้า ให้ความรู้สึกเหมือนรีเฟรช — รวมเป็น route เดียวกันคง state
  // ของ component ไว้ได้ระหว่างเปลี่ยนแค่ :id param
  path: "operation/:id?",
  element: (
      <Suspense fallback={<div>Loading Operation...</div>}>
        <Operate />
      </Suspense>
  ),
  title: "Operation",
},

      {
        path: "register",
        element: (
          <Suspense fallback={<div>Loading Register...</div>}>
            <Register />
          </Suspense>
        ),
        title: "Register",
      },


      {
        path: "technician/jobs",
        element: (
          <Suspense fallback={<div>Loading Jobs...</div>}>
            <MyJobs />
          </Suspense>
        ),
        title: "My Jobs",
      },
      {
        // ⚠️ ไม่ห่อด้วย AdminRoute — ตัวหน้าเช็คสิทธิ์เอง (requestDispatch)
        // ✅ URL เดิม /sales ยังใช้ได้ ไม่ให้ลิงก์/บุ๊กมาร์กเก่าพัง แต่ตอนนี้ชี้ไปหน้า "แจ้งงานให้ช่าง"
        // ซึ่งเป็นสิ่งเดียวที่เหลือจากหมวดนี้หลังตัดระบบ CRM ออกตามที่ผู้ใช้สั่ง
        // ⚠️ :id? เหมือน /dispatch — ผู้แจ้งกดแจ้งเตือน "ใบถูกตีกลับ/อนุมัติแล้ว" ต้องเปิดใบนั้นได้เลย
        path: "sales/:id?",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <JobRequests />
          </Suspense>
        ),
        title: "Job Requests",
      },
      {
        // ⚠️ :id? เป็น optional segment — แจ้งเตือนส่งลิงก์มาเป็น /dispatch/<id> เพื่อเปิดใบนั้นเลย
        // 🐛 ที่แก้: เดิม path เป็น "dispatch" เฉยๆ กดแจ้งเตือนแล้วได้
        // "No routes matched location" = หน้าว่าง
        path: "dispatch/:id?",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <JobRequestQueue />
          </Suspense>
        ),
        title: "Dispatch",
      },

    ],
  },

  {
    path: "/login",
    element: (
      <Suspense fallback={<div>Loading Login...</div>}>
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Suspense>
    ),
    title: "Login",
  },

  // {
  //   path: "/login",
  //   element: (

  //     <Suspense fallback={<div>Loading Login...</div>}>
  //       <Login />
  //     </Suspense>
  //   ),
  //   title: "Login",
  // },

  {
    path: "/noconnection",
    element: (
      <Suspense fallback={<div>Loading No Connection...</div>}>
        <NoConnection />
      </Suspense>
    ),
    title: "No Connection",
  },
];

createBrowserRouter(ThemeRoutes, {
  future: {
    v7_skipActionErrorRevalidation: true,
  },
});

export default ThemeRoutes;
