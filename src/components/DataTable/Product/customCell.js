import moment from "moment"; // Import moment library for date formatting

const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product">
      {/* แสดงชื่อผลิตภัณฑ์ */} 
      <div style={{ fontWeight: "bold" }}>[{row.type}] {row.name}</div>
      {/* หากหน้าจอขนาดเล็ก ให้แสดง updatedAt ด้านล่าง */}
      {isSmallScreen && (
        <span style={{ marginTop: "20px"  }}>{moment(row.createdAt).format("DD/MM/YYYY HH:mm:ss")}</span>
      )}
    </div>
  );
};

export default customCell;
