import moment from "moment";

import { formatFileSize } from "../../functions/CustomFile";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faFileDownload } from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ
import API from "../../API/axiosInstance";

const ExpandedFile = ({ data }) => {
  return (
    <div className="card mb-3">
      <div className="row g-0">
        <div className="col-md-8">
          <div className="card-body text">
            <h5 className="card-title">{data.filename}</h5>
            <p className="card-text">
              ( Size: {data.size ? formatFileSize(data.size) : "Unknown"} )
            </p>
            <p className="card-text">
              อัพโหลดโดย:{" "}
              <small className="text-body-secondary">
                {data.user.username},({data.user.fname} {data.user.lname}) (
                ตำแหน่ง {data.user.role} )
              </small>
            </p>
            <p className="card-text">
              อัพโหลดเมื่อ{" "}
              <small className="text-body-secondary">
                {moment(data.createdAt).format(" DD/MM/YYYY  HH:mm:ss ")}
              </small>
            </p>

            <p className="card-text">
             <a href={data.path} target="_blank" rel="noopener noreferrer" download>
              <FontAwesomeIcon icon={faFileDownload} />
            </a>

            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExpandedFile;
