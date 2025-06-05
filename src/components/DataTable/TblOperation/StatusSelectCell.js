import React, { useState } from "react";
import Select from "react-select";
import EventService from "../../../services/EventService";

const statusColorMap = {
  // ยกเลิก: "#d33",
  กำลังรอยืนยัน: "#888888",
  ยืนยันแล้ว: "#0c49ac",
  กำลังดำเนินการ: "#a1b50b",
  //   ดำเนินการเสร็จสิ้น: "#18b007",
  //   เสนอราคาแก้ไขแล้ว: "#f39c12",
  //   วางบิลแล้วรอเก็บเงิน: "#9b59b6",
  ดำเนินการเสร็จสิ้น: "#18b007",
};

// สร้าง options
const options = Object.entries(statusColorMap).map(([label, color]) => ({
  value: label,
  label: label,
  color: color,
}));

const StatusSelectCell = ({ row, onStatusUpdate }) => {
  const [localStatus, setLocalStatus] = useState(row.status);

  // ✅ ปรับ style ของ react-select ให้กว้าง 100% และสวยงาม
 const customStyles = {
  container: (provided) => ({
    ...provided,
    width: "100%",
  }),
  control: (provided) => ({
    ...provided,
    backgroundColor: statusColorMap[localStatus] || "#ccc",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    boxShadow: "none",
    minHeight: "32px",
    paddingLeft: "4px",
    fontSize: "0.75rem", // ✅ ขนาดตัวอักษรเล็กลง
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#fff",
    fontWeight: "bold",
    fontSize: "0.75rem", // ✅ ขนาดตัวอักษรเล็กลง
  }),
  option: (provided) => ({
    ...provided,
    fontWeight: "bold",
    fontSize: "0.75rem", // ✅ ขนาดตัวอักษรเล็กลง
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    color: "#fff",
    padding: "4px",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  menu: (provided) => ({
    ...provided,
    borderRadius: "8px",
    overflow: "hidden",
    zIndex: 9999,
  }),
};


  const handleChange = async (selectedOption) => {
    const newStatus = selectedOption.value;
    const updatedEvent = { ...row, status: newStatus };

    try {
      await EventService.UpdateEvent(row.id, updatedEvent);
      setLocalStatus(newStatus);
      if (onStatusUpdate) {
        onStatusUpdate(updatedEvent);
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาด:", error);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <Select
        value={options.find((opt) => opt.value === localStatus)}
        onChange={handleChange}
        options={options}
        styles={customStyles}
        isSearchable={false}
        menuPosition="fixed"
        //   menuPlacement="auto"
        //   menuPortalTarget={document.body}
        menuShouldBlockScroll={true}
      />
    </div>
  );
};

export default StatusSelectCell;
