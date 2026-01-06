import { useState, useEffect } from "react";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

const ResPersonCell = ({ row, employee = [], onInputUpdate, currentUserRole }) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!Array.isArray(employee)) return;

    const matchById = employee.find(emp => emp._id === row.resPerson);
    if (matchById) return setValue(matchById._id);

    const matchByName = employee.find(emp => emp.username === row.resPerson);
    if (matchByName) return setValue(matchByName._id);

    setValue("");
  }, [row.resPerson, employee]);

  const handleChange = async (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    await onInputUpdate(row._id, { resPerson: newValue });
  };

  const isAdmin = currentUserRole === "admin";

  return (
    <Select
  value={value}
  onChange={handleChange}
  size="small"
  disabled={!isAdmin}
  sx={{
    minWidth: 140,
    backgroundColor: !isAdmin ? "#e9ecef" : "white", // เทาอ่อนสำหรับ non-admin
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0d6efd", // ✅ Bootstrap primary
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0b5ed7", // ✅ Bootstrap primary hover (#0b5ed7)
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0d6efd", // ✅ Bootstrap primary เมื่อ focus
      borderWidth: "2px",
    },
  }}
>
  {Array.isArray(employee) &&
    employee.map((emp) => (
      <MenuItem key={emp._id} value={emp._id}>
        {emp.username}
      </MenuItem>
    ))}
</Select>

  );
};

export default ResPersonCell;
