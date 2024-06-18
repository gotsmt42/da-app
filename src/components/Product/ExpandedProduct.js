import React from "react";
import moment from "moment";
import API from "../../API/axiosInstance";


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


const ExpandedProduct = ({ data }) => (
  <div className="card mb-3">
    <div className="row g-0">
      <div className="col-md-4">
        <img
          src={`${API.defaults.baseURL}/${data.imageUrl}`} // Construct the full URL for the image
          className="img-fluid rounded-start img-thumbnail img-preview"
          alt="..."
        />
      </div>

      <div className="col-md-8">
        <div className="card-body text">
          <h5 className="card-title">{data.name}</h5>
          <p></p>
          <h5 className="card-title">
            ราคาล่าสุด : {formatCurrency(parseFloat(data.price.$numberDecimal))}{" "}
          </h5>
          <p></p>
          <strong>รายละเอียด: </strong>
          <p className="card-text mt-1 ">
            {data.description}
          </p>
          <p className="card-text">
            <small className="text-body-secondary">
              อัพโหลดโดย: {data.user.username},({data.user.fname}{" "}
              {data.user.lname}) ( {data.user.role}, {data.user.rank} )
            </small>
          </p>
          <p className="card-text">
            <small className="text-body-secondary">
              สร้างเมื่อ 
              {moment(data.createdAt).format("- DD/MM/YYYY  HH:mm:ss ")}
            </small>
          </p>
          <p className="card-text">
            <small className="text-body-secondary">
              แก้ไขล่าสุด
              {moment(data.updatedAt).format("- DD/MM/YYYY  HH:mm:ss ")}
            </small>
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default ExpandedProduct;
