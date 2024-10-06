import React from "react";
import moment from "moment";
import API from "../../../API/axiosInstance";
// Function to format salary as currency
const formatCurrency = (amount) => {
  // Check if amount is valid and numeric
  if (!amount || isNaN(amount)) {
    return ""; // Return empty string if amount is invalid
  }

  // Use Intl.NumberFormat to format amount as currency
  const formatter = new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency: "THB", // Change currency code as needed
    minimumFractionDigits: 2, // Minimum number of fractional digits
  });

  return formatter.format(amount); // Format amount as currency string
};

const Expanded = ({ data }) => (
  <div className="card mb-3">
    <div className="row g-0">
      <div className="col-md" style={{ display: "flex", alignItems: "center" }}>
        <img
          src={`${API.defaults.baseURL}/${data.imageUrl}`} // Construct the full URL for the image
          className="img-fluid img-thumbnail "
          alt="Avatar"
          width={400}

          
        />
      </div>

      <div className="col-md-8">
        <div className="card-body text">
          <h5 className="card-title">
            ชื่อโครงการ: TEST
          </h5>
          <p className="card-text">ที่อยู่ : </p>
          <p className="card-text">อีเมลล์ : test@test.com</p>

          
        </div>
      </div>
    </div>
  </div>
);

export default Expanded;
