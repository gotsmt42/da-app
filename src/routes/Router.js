import { lazy } from "react";
import { Outlet, useNavigate, Navigate } from "react-router-dom";
import { useEffect } from "react";
import CheckConnection from "../components/CheckConnection.js"; // นำเข้าคอมโพเนนต์ใหม่

// Layouts และ Pages
const FullLayout = lazy(() => import("../layouts/FullLayout.js"));
const PrivateRoute = lazy(() => import("./PrivateRoute.js"));

const Dashboard = lazy(() => import("../views/Dashboard.js"));
const NoConnection = lazy(() => import("../views/NoConnection.js"));
const About = lazy(() => import("../views/About.js"));
const Alerts = lazy(() => import("../views/ui/Alerts"));
const Badges = lazy(() => import("../views/ui/Badges"));
const Buttons = lazy(() => import("../views/ui/Buttons"));
const Cards = lazy(() => import("../views/ui/Cards"));
const Grid = lazy(() => import("../views/ui/Grid"));
const UserTable = lazy(() => import("../views/ui/UserTable.js"));
const Forms = lazy(() => import("../views/ui/Forms"));
const Breadcrumbs = lazy(() => import("../views/ui/Breadcrumbs"));
const Account = lazy(() => import("../components/User/Account.js"));
const Product = lazy(() => import("../views/ui/Product"));
const StockProduct = lazy(() => import("../views/ui/StockProduct"));
const Files = lazy(() => import("../views/ui/Files"));
const FileUpload = lazy(() => import("../views/ui/FileUpload"));
const EventCalendar = lazy(() => import("../views/ui/EventCalendar.js"));
const Login = lazy(() => import("../auth/Login.js"));
const Register = lazy(() => import("../auth/Register.js"));

const ThemeRoutes = [
  {
    path: "/",
    element: (
      <CheckConnection>
        <PrivateRoute>
          <FullLayout />
        </PrivateRoute>
      </CheckConnection>
    ),
    children: [
      {
        path: "/",
        element: <Navigate to="/dashboard" />,
      },
      {
        path: "/dashboard",
        element: <Dashboard />,
        title: "Dashboard",
      },
      { path: "/about", element: <About />, title: "About" },
      { path: "/account", element: <Account />, title: "Account" },
      { path: "/alerts", element: <Alerts />, title: "Alerts" },
      { path: "/badges", element: <Badges />, title: "Badges" },
      { path: "/buttons", element: <Buttons />, title: "Buttons" },
      { path: "/cards", element: <Cards />, title: "Cards" },
      { path: "/grid", element: <Grid />, title: "Grid" },
      { path: "/usertable", element: <UserTable />, title: "User Table" },
      { path: "/forms", element: <Forms />, title: "Forms" },
      { path: "/breadcrumbs", element: <Breadcrumbs />, title: "Breadcrumbs" },
      { path: "/product", element: <Product />, title: "Product" },
      {
        path: "/product/stock",
        element: <StockProduct />,
        title: "Stock Product",
      },
      { path: "/fileupload", element: <FileUpload />, title: "File Upload" },
      { path: "/files", element: <Files />, title: "Files" },
      { path: "/event", element: <EventCalendar />, title: "Event Calendar" },
    ],
  },
  { path: "/login", element: <Login />, title: "Login" },
  // { path: "/register", element: <Register />, title: "Register" },
  { path: "/noconnection", element: <NoConnection />, title: "No Connection" },
];

export default ThemeRoutes;
