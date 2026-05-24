import moment from "moment"; // Import moment library for date formatting
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; // Import FontAwesomeIcon component
import { getFileIcon, getFileIconColor } from "../../../functions/CustomFile";

import { formatFileSize } from "../../../functions/CustomFile";


const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key={row._id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      {/* แสดงชื่อผลิตภัณฑ์ */}
<div style={{ display: "flex", alignItems: "center" }}>
  {/* แสดง icon ตามสกุลไฟล์ */}
  <FontAwesomeIcon
    icon={getFileIcon(row.filename)}
    style={{ color: getFileIconColor(row.filename), marginRight: "5px" }}
  />

  {/* ✅ แสดงชื่อไฟล์ พร้อมหมวดหมู่ (ถ้าไม่ใช่ uncategorized และไม่ว่าง) */}
  <div style={{ fontWeight: "bold" }}>
    {row.category && row.category !== "uncategorized" ? (
      <>
        <span style={{ color: "red" }}>({row.category})</span> {row.filename}
      </>
    ) : (
      row.filename
    )}
  </div>
</div>


      {/* แสดง size ของไฟล์ */}
      <div style={{ fontSize: "12px", color: "gray" }}>
      Size: {row.size ? formatFileSize(row.size) : "Unknown"}
      </div>
      {/* แสดง updatedAt */}
      {isSmallScreen && (
        <div style={{ fontSize: "11px" }}>
          {moment(row.updatedAt).format("DD/MM/YYYY HH:mm:ss")}
        </div>
      )}
    </div>
  );
};

export default customCell;
