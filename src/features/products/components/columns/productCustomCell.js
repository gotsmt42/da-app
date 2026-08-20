import moment from "moment"; // Import moment library for date formatting
import { formatThai } from "@/shared/utils/thaiDate";

const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product">
      {/* แสดงชื่อผลิตภัณฑ์ */} 
      <div style={{ fontWeight: "bold" }}>[{row.type}] {row.name}</div>
      {/* หากหน้าจอขนาดเล็ก ให้แสดง updatedAt ด้านล่าง */}
      {isSmallScreen && (
        <span style={{ marginTop: "20px"  }}>แก้ไขล่าสุด{formatThai(moment(row.updatedAt), " DD/MM/YYYY HH:mm:ss")}</span>
      )}
    </div>
  );
};

export default customCell;
