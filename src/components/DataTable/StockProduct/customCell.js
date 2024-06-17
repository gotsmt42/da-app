import moment from "moment"; // Import moment library for date formatting

const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product">
      {/* แสดงชื่อผลิตภัณฑ์ */} 
      <div style={{ fontWeight: "bold" }}>[{row.productInfo.type}] {row.productInfo.name} </div>
      {/* หากหน้าจอขนาดเล็ก ให้แสดง updatedAt ด้านล่าง */}
      {isSmallScreen && (
        
        <span style={{ marginTop: "50px"  }}>{row.quantity} {row.countingUnit}</span>
        // <span style={{ marginTop: "20px"  }}>แก้ไขล่าสุด{moment(row.updatedAt).format(" DD/MM/YYYY HH:mm:ss")}</span>
      )}
    </div>
  );
};

export default customCell;
