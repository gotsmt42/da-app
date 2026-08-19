import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

// Layouts และ Pages (Lazy Loaded)
const FullLayout = lazy(() => import("../layouts/FullLayout.js"));
const PrivateRoute = lazy(() => import("./PrivateRoute.js"));
const AdminRoute = lazy(() => import("./AdminRoute.js"));

const Dashboard = lazy(() => import("../views/Dashboard.js"));
const NoConnection = lazy(() => import("../views/NoConnection.js"));
const About = lazy(() => import("../views/Settings.js"));
const Alerts = lazy(() => import("../views/ui/Alerts"));
const Badges = lazy(() => import("../views/ui/Badges"));
const Buttons = lazy(() => import("../views/ui/Buttons"));
const Cards = lazy(() => import("../views/ui/Cards"));
const Grid = lazy(() => import("../views/ui/Grid"));
const Forms = lazy(() => import("../views/ui/Forms"));
const Breadcrumbs = lazy(() => import("../views/ui/Breadcrumbs"));
const Account = lazy(() => import("../components/User/Employee/Account.js"));
const Product = lazy(() => import("../views/ui/Product"));
const StockProduct = lazy(() => import("../views/ui/StockProduct"));
const WorkTypeSystem = lazy(() => import("../views/ui/WorkTypeSystem.js"));
const ContractOverview = lazy(() => import("../views/ui/ContractOverview.js"));
const FileUpload = lazy(() => import("../views/ui/FileUpload"));
const EventCalendar = lazy(() => import("../views/ui/EventCalendar.js"));
const Operate = lazy(() => import("../views/ui/Operation.js"));
const Login = lazy(() => import("../auth/Login.js"));
const Register = lazy(() => import("../auth/Register.js"));

const PublicRoute = lazy(() => import("./PublicRoute.js"));
const CheckConnectionToast = lazy(() => import("./CheckConnectionToast.js"));

const MyJobs = lazy(() => import("../views/Technician/MyJobs.js"));

// ✅ หน้ารวม 4 หน้า — ยุบหน้าที่เป็นข้อมูลประเภทเดียวกันให้เหลือหน้าเดียวต่อเรื่อง แล้วแยกด้วยแท็บ
// (ดูเหตุผลของแต่ละการรวมในหัวไฟล์ของแต่ละตัว) URL เดิมทั้งหมดยัง redirect เข้ามาที่นี่ได้ ลิงก์เก่าไม่พัง
// ⚠️ Customer / Employee / TeamWorkload / CustomerOverview / BillingTracking / QuotationTracking /
// IssuedDocuments / Files ไม่ถูก import ที่นี่แล้ว — ย้ายไปโหลดแบบ lazy ภายใน Hub ที่เกี่ยวข้องแทน
// (Router รู้จักแค่หน้ารวม 4 หน้า ส่วนหน้าย่อยเป็นรายละเอียดภายในของ Hub นั้นๆ)
const CustomerHub = lazy(() => import("../views/ui/CustomerHub.js"));
const StaffHub = lazy(() => import("../views/ui/StaffHub.js"));
const DocumentsHub = lazy(() => import("../views/ui/DocumentsHub.js"));
const FinanceHub = lazy(() => import("../views/ui/FinanceHub.js"));


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
      {
        path: "alerts",
        element: (
          <Suspense fallback={<div>Loading Alerts...</div>}>
            <Alerts />
          </Suspense>
        ),
        title: "Alerts",
      },
      {
        path: "badges",
        element: (
          <Suspense fallback={<div>Loading Badges...</div>}>
            <Badges />
          </Suspense>
        ),
        title: "Badges",
      },
      {
        path: "buttons",
        element: (
          <Suspense fallback={<div>Loading Buttons...</div>}>
            <Buttons />
          </Suspense>
        ),
        title: "Buttons",
      },
      {
        path: "cards",
        element: (
          <Suspense fallback={<div>Loading Cards...</div>}>
            <Cards />
          </Suspense>
        ),
        title: "Cards",
      },
      {
        path: "grid",
        element: (
          <Suspense fallback={<div>Loading Grid...</div>}>
            <Grid />
          </Suspense>
        ),
        title: "Grid",
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
        element: <Navigate to="/customers?tab=registry" replace />,
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
        element: <Navigate to="/staff?tab=workload" replace />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "billing",
        element: <Navigate to="/finance?tab=billing" replace />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "customer-overview",
        element: <Navigate to="/customers?tab=overview" replace />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "quotations",
        element: <Navigate to="/finance?tab=quotations" replace />,
      },
      {
        // ✅ URL เดิม — ยังเข้าได้เหมือนเดิม แต่พาไปหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้เลย
        // (ลิงก์เก่า/บุ๊กมาร์ก/ลิงก์ในแอปที่ยังชี้มาที่นี่จึงไม่พังสักอัน)
        path: "issued-documents",
        element: <Navigate to="/documents?tab=issued" replace />,
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
        element: <Navigate to="/staff?tab=registry" replace />,
      },
      {
        path: "forms",
        element: (
          <Suspense fallback={<div>Loading Forms...</div>}>
            <Forms />
          </Suspense>
        ),
        title: "Forms",
      },
      {
        path: "breadcrumbs",
        element: (
          <Suspense fallback={<div>Loading Breadcrumbs...</div>}>
            <Breadcrumbs />
          </Suspense>
        ),
        title: "Breadcrumbs",
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
        element: <Navigate to="/documents?tab=files" replace />,
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
