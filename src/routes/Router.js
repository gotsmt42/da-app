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
const Customer = lazy(() => import("../views/ui/Customer.js"));
const Employee = lazy(() => import("../views/ui/Employee.js"));
const Forms = lazy(() => import("../views/ui/Forms"));
const Breadcrumbs = lazy(() => import("../views/ui/Breadcrumbs"));
const Account = lazy(() => import("../components/User/Employee/Account.js"));
const Product = lazy(() => import("../views/ui/Product"));
const StockProduct = lazy(() => import("../views/ui/StockProduct"));
const Files = lazy(() => import("../views/ui/Files"));
const FileUpload = lazy(() => import("../views/ui/FileUpload"));
const EventCalendar = lazy(() => import("../views/ui/EventCalendar.js"));
const Operate = lazy(() => import("../views/ui/Operation.js"));
const Tackstatus = lazy(() => import("../views/ui/Tackstatus.js"));
const Login = lazy(() => import("../auth/Login.js"));
const Register = lazy(() => import("../auth/Register.js"));

const PublicRoute = lazy(() => import("./PublicRoute.js"));
const CheckConnectionToast = lazy(() => import("./CheckConnectionToast.js"));

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
          <Suspense fallback={<div>Loading About...</div>}>
            <About />
          </Suspense>
        ),
        title: "About",
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
      {
        path: "customer",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Customers...</div>}>
              <Customer />
            </Suspense>
          </AdminRoute>
        ),
        title: "Customer",
      },
      {
        path: "employee",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Users...</div>}>
              <Employee />
            </Suspense>
          </AdminRoute>
        ),
        title: "Employee",
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
          <AdminRoute>
            <Suspense fallback={<div>Loading File Upload...</div>}>
              <FileUpload />
            </Suspense>
          </AdminRoute>
        ),
        title: "File Upload",
      },
      {
        path: "files",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Files...</div>}>
              <Files />
            </Suspense>
          </AdminRoute>
        ),
        title: "Files",
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
        path: "operation",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Operation...</div>}>
              <Operate />
            </Suspense>
          </AdminRoute>
        ),
        title: "Operation",
      },

      {
        path: "tackstatus",
        element: (
          <AdminRoute>
            <Suspense fallback={<div>Loading Tackstatus...</div>}>
              <Tackstatus />
            </Suspense>
          </AdminRoute>
        ),
        title: "Tackstatus",
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
