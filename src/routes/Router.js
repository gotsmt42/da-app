import { lazy } from "react";
import { Outlet, useNavigate, Navigate } from "react-router-dom";
import { useEffect } from "react";

/****Layouts*****/
const FullLayout = lazy(() => import("../layouts/FullLayout.js"));
const PrivateRoute = lazy(() => import("./PrivateRoute.js"));

/***** Pages ****/
const Dashboard = lazy(() => import("../views/Dashboard.js"));
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

const PrivateRouteContent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Navigate to the dashboard route when the component mounts
    navigate("/dashboard");
  }, [navigate]);

  // Return null as the component doesn't render anything
  return null;
};

const ThemeRoutes = [
  {
    path: "/",
    element: (
      <PrivateRoute>
        <FullLayout />

      </PrivateRoute>
    ),
    children: [
      {
        path: "/",
        element: <Navigate to="/dashboard" />,
      },
      {
        
        path: "/dashboard",
        exact: true,
        element: <Dashboard />,
        title: "Dashboard",
      },
      { path: "/about", exact: true, element: <About />, title: "About" },
      { path: "/account", exact: true, element: <Account />, title: "Account" },
      { path: "/alerts", exact: true, element: <Alerts />, title: "Alerts" },
      { path: "/badges", exact: true, element: <Badges />, title: "Badges" },
      { path: "/buttons", exact: true, element: <Buttons />, title: "Buttons" },
      { path: "/cards", exact: true, element: <Cards />, title: "Cards" },
      { path: "/grid", exact: true, element: <Grid />, title: "Grid" },
      { path: "/usertable", exact: true, element: <UserTable />, title: "User Table" },
      { path: "/forms", exact: true, element: <Forms />, title: "Forms" },
      {
        path: "/breadcrumbs",
        exact: true,
        element: <Breadcrumbs />,
        title: "Breadcrumbs",
      },
      { path: "/product", exact: true, element: <Product />, title: "Product" },
      { path: "/product/stock", exact: true, element: <StockProduct />, title: "Stock Product" },
      {
        path: "/fileupload",
        exact: true,
        element: <FileUpload />,
        title: "File Upload",
      },
      { path: "/files", exact: true, element: <Files />, title: "Files" },
      {
        path: "/event",
        exact: true,
        element: <EventCalendar />,
        title: "Event Calendar",
      },
    ],
  },
  { path: "/login", element: <Login />, title: "Login" },
  // { path: "/register", element: <Register />, title: "Register" },
];

export default ThemeRoutes;
