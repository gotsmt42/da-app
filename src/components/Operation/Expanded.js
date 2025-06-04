

const Expanded = ({ data }) => {
  if (!data) return <div>ไม่พบข้อมูล</div>;

  return (
    <div className="card mb-3">
      <div className="row g-0">
        {/* <div className="col-md-4" style={{ display: "flex", alignItems: "center", justifyContent: "start" }}>
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
        </div> */}

        <div className="col-md-8">
          <div className="card-body text">
            <h5 className="card-title">อ้างอิงเอกสารเลขที่ : {"QT2025060215" || "ไม่ระบุ"}</h5>
            <p></p>
            <p className="card-text">บริษัท / นิติบุคล : {data.company || "ไม่ระบุ"} </p>
            <p></p>
            <p className="card-text">งาน / โครงการ : [{data.title}] {data.system} ครั้งที่ {data.time || "ไม่ระบุ"} - {data.site} </p>


          </div>
        </div>
      </div>
    </div>
  );
};

export default Expanded;
