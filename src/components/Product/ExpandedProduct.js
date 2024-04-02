import React from "react";
import moment from "moment";
import API from "../../API/axiosInstance";


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
          <p className="card-text">ราคา: {data.price} - ฿</p>
          <strong>รายละเอียด: </strong>
          <p className="card-text mt-1 ">
            {data.description}, This is a wider card with supporting text below
            as a natural lead-in to additional content. This content is a little
            bit longer.
          </p>
          <p className="card-text">
            <small className="text-body-secondary">
              อัพโหลดโดย: {data.user.username},({data.user.fname}{" "}
              {data.user.lname}) ( {data.user.role}, {data.user.rank} )
            </small>
          </p>
          <p className="card-text">
            <small className="text-body-secondary">
              Last updated
              {moment(data.updatedAt).format("- DD/MM/YYYY  HH:mm:ss ")}
            </small>
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default ExpandedProduct;
