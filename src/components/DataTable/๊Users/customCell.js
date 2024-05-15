import React from "react";
import API from "../../../API/axiosInstance";

const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product" style={{ display: "flex", alignItems: "center" }}>
      <img
        src={`${API.defaults.baseURL}/${row.imageUrl}`} // Construct the full URL for the image
        width={40}
        height={40}
        alt="Avatar"
        style={{ marginRight: "10px", borderRadius: "50%" }}
      />
      <div>
        <div style={{ fontWeight: "bold" }}>
          {row.fname} {row.lname} ({row.rank})
        </div>
        <div>{row.email}</div>
      </div>
    </div>
  );
};

export default customCell;
