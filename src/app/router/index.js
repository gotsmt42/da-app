import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

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

const MyJobs = lazy(() => import("@/features/technician/pages/MyJobs.js"));

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
