import moment from "moment"; // Import moment library for date formatting

const customCellUnit = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product">
      {/* แสดงชื่อผลิตภัณฑ์ */} 
      <div style={{ fontWeight: "bold" }}>{row.quantity} {row.productInfo.countingUnit} </div>
      {/* หากหน้าจอขนาดเล็ก ให้แสดง updatedAt ด้านล่าง */}
 
    </div>
  );
};

export default customCellUnit;
