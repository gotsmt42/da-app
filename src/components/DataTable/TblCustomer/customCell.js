import React from "react";
import API from "../../../API/axiosInstance";

const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product" style={{ display: "flex", alignItems: "center" }}>
    <div style={{ position: "relative" }}>
     
    </div>
      <div>
        <div style={{ fontWeight: "bold", padding:"10px"}}>
          TEST
        </div>
        {/* <div style={{padding:"10px"}}>PM Fire Alarm</div> */}
        
      </div>
    </div>
  );
};

export default customCell;
