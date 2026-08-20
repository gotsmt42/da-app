import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./assets/scss/style.scss";
import { installTomSelectFixes } from "@/shared/utils/tomSelectFixes";
import Swal from "sweetalert2";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { getAddEvent } from "@/features/calendar/components/EventForms/AddEvent";

const customers = [{ _id: "c1", cSite: "โครงการ A", cCompany: "บริษัท ก", address: "กทม" }];
window.__openAddEvent = () => getAddEvent({
  arg: { dateStr: "2026-09-07" }, events: [], drafts: [],
  userData: { _id: "a1", username: "admin", role: "admin" },
  defaultTextColor: "#fff", defaultBackgroundColor: "#3f51b5",
  setDefaultTextColor: () => {}, setDefaultBackgroundColor: () => {}, setDefaultFontSize: () => {},
  saveEventToDB: async () => {}, fetchEventsFromDB: async () => {}, fetchLookupOptions: async () => {},
  sourceEvent: null,
  CustomerService: { getCustomers: async () => ({ userCustomers: customers }), AddCustomer: async () => ({}) },
  AuthService: { getAllUserData: async () => ({ users: [] }) },
  JobTypeService: { getAll: async () => ({ jobTypes: [] }), add: async () => ({}) },
  SystemTypeService: { getAll: async () => ({ systemTypes: [] }), add: async () => ({}) },
  EventService: { UpdateEvent: async () => ({}) }, Swal, TomSelect, moment,
});
function App() {
  const [v, setV] = useState("2026-08-11");
  return (<div style={{ padding: 20 }}>
    <div id="plain" style={{ width: 300 }}><ThaiDatePicker label="วันที่" value={v} onChange={setV} /></div>
    <div id="val">{v}</div>
    <button id="open-addevent" onClick={() => window.__openAddEvent()}>add</button>
  </div>);
}
installTomSelectFixes();
createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
