import React, { useState } from "react";
import Select from "react-select";
import Swal from "sweetalert2";
import EventService from "../../../services/EventService";

const statusColorMap = {
  เสนอราคาแก้ไขแล้ว: "#f39c12",
  วางบิลแล้วรอเก็บเงิน: "#9b59b6",
  เก็บเงินแล้ว: "#18b007",
};

// ✅ เพิ่ม option ว่างไว้ข้างบนสุด
const options = [
  { value: "", label: "— ไม่มีสถานะ —", color: "#ccc" },
  ...Object.entries(statusColorMap).map(([label, color]) => ({
    value: label,
    label: label,
    color: color,
  })),
];

const StatusThreeSelectCell = ({ row, onStatusUpdate }) => {
  const [localStatus, setLocalStatus] = useState(row.status_three || "");

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
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "#fff",
      fontWeight: "bold",
    }),
    option: (provided) => ({
      ...provided,
      fontWeight: "bold",
      boxShadow: "none",
      outline: "none",
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

    const confirmText = newStatus
      ? `คุณต้องการเปลี่ยนสถานะเป็น "${newStatus}" หรือไม่?`
      : "คุณต้องการล้างสถานะหรือไม่?";

    const result = await Swal.fire({
      title: "ยืนยันการเปลี่ยนสถานะ?",
      text: confirmText,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช่, ดำเนินการ",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      const updatedEvent = { ...row, status_three: newStatus };
      try {
        await EventService.UpdateEvent(row.id, updatedEvent);
        setLocalStatus(newStatus);
        if (onStatusUpdate) {
          onStatusUpdate(updatedEvent);
        }
        // Swal.fire("อัปเดตสถานะสำเร็จ", "", "success");
      } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        Swal.fire("เกิดข้อผิดพลาดในการบันทึก", "", "error");
      }
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
        menuShouldBlockScroll={true}
      />
    </div>
  );
};

export default StatusThreeSelectCell;
