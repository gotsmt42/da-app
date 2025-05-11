import React from "react";

const CustomCell = ({ row }) => {
  return (
    <div key="cell-customer" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>{row.cName}</div>
      <div style={{ fontSize: 14 }}>{row.cCompany} | {row.cSite}</div>
      <div style={{ fontSize: 13, color: "gray" }}>{row.cEmail} | {row.tel}</div>
    </div>
  );
};

export default CustomCell;
