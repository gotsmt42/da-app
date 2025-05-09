import React from "react";
import API from "../../../API/axiosInstance";

const customCell = ({ row, isSmallScreen }) => {
  return (
    <div key="cell-product" style={{ display: "flex", alignItems: "center" }}>
    <div style={{ position: "relative" }}>
      <img
        src={row.imageUrl} // Construct the full URL for the image
        width={40}
        height={40}
        alt="Avatar"
        style={{ marginRight: "10px", borderRadius: "50%" }}
      />
      <span
        style={{
          position: "absolute",
          bottom: 0,
          right: 10,
          backgroundColor:
            row.status === "offline" ? "red" : row.status === "online" ? "green" : "transparent",
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: "2px solid white",
        }}
      />
    </div>
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
