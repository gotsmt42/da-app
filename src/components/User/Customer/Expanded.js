import React from "react";
import API from "../../../API/axiosInstance";

const Expanded = ({ data }) => {
  if (!data) return <div>ไม่พบข้อมูลลูกค้า</div>;

  return (
    <div className="card mb-3">
      <div className="row g-0">
        <div className="col-md-4" style={{ display: "flex", alignItems: "center", justifyContent: "start" }}>
          <img
            src={
              data.imageUrl
                ? `${API.defaults.baseURL}/${data.imageUrl}`
                : "/placeholder.png"
            }
            className="img-fluid img-thumbnail"
            alt="Customer Avatar"
            width={250}
          />
        </div>

        <div className="col-md-8">
          <div className="card-body text">
            <h5 className="card-title">บริษัทหรือนิติบุคล: {data.cCompany || "ไม่ระบุ"}</h5>
            <p></p>
            <p className="card-text">โครงการ: {data.cSite || "ไม่ระบุ"}</p>
            <p className="card-text">อีเมล: {data.cEmail || "ไม่ระบุ"}</p>
            <p className="card-text">ชื่อผู้ติดต่อ: {data.cName || "ไม่ระบุ"}</p>
            <p className="card-text">เบอร์โทรศัพท์: {data.tel || "ไม่ระบุ"}</p>
            <p className="card-text">เลขประจำตัวผู้เสียภาษี: {data.tax || "ไม่ระบุ"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expanded;
