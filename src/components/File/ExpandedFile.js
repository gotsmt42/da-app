import React, { useEffect, useState } from "react";
import moment from "moment";
import { formatFileSize } from "../../functions/CustomFile";
import API from "../../API/axiosInstance";
import AuthService from "../../services/authService";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile, faFolder, faUser, faCalendarAlt, faFilePdf, faImage } from "@fortawesome/free-solid-svg-icons";

const ExpandedFile = ({ data }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const userData = await AuthService.getUserData();
        const downloadUrl = data.url.startsWith("http")
          ? data.url
          : `${API.defaults.baseURL.replace(/\/api$/, "")}${data.url}`;

        const response = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${userData.token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch file");

        const blob = await response.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (error) {
        console.error("Error fetching file:", error);
      }
    };
    if (data.url) fetchFile();
  }, [data.url]);

  const isImage = /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(data.filename);
  const isPDF = /\.pdf$/i.test(data.filename);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <FontAwesomeIcon icon={faFolder} className="me-2 text-danger" />
        หมวดหมู่: {data.category || "ไม่ระบุ"}
      </div>
      <div className="card-body">
        <p>
          <FontAwesomeIcon icon={faFile} className="me-2 text-secondary" />
          <strong>ชื่อไฟล์:</strong> {data.filename}
        </p>
        <p>
          <FontAwesomeIcon icon={faFile} className="me-2 text-secondary" />
          <strong>ขนาด:</strong> {data.size ? formatFileSize(data.size) : "Unknown"}
        </p>
        <p>
          <FontAwesomeIcon icon={faUser} className="me-2 text-secondary" />
          <strong>อัพโหลดโดย:</strong> {data.user?.fname} {data.user?.lname} ({data.user?.username})
        </p>
        <p>
          <FontAwesomeIcon icon={faCalendarAlt} className="me-2 text-secondary" />
          <strong>อัพโหลดเมื่อ:</strong> {moment(data.createdAt).format("DD/MM/YYYY HH:mm:ss")}
        </p>

        {/* ✅ Preview */}
        <div className="mt-3 text-center">
          {previewUrl ? (
            <>
              {isImage && (
                <>
                  <FontAwesomeIcon icon={faImage} className="mb-2 text-info" size="2x" />
                  <img
                    src={previewUrl}
                    alt={data.filename}
                    className="img-fluid rounded shadow"
                    style={{ maxHeight: "400px" }}
                  />
                </>
              )}
              {isPDF && (
                <>
                  <FontAwesomeIcon icon={faFilePdf} className="mb-2 text-danger" size="2x" />
                  <object
                    data={previewUrl}
                    type="application/pdf"
                    width="100%"
                    height="500px"
                    style={{ border: "1px solid #ccc", borderRadius: "6px" }}
                  >
                    <p>
                      ไม่สามารถ preview PDF ได้{" "}
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                        เปิดไฟล์
                      </a>
                    </p>
                  </object>
                </>
              )}
              {!isImage && !isPDF && (
                <p className="text-muted">ไม่สามารถ preview ไฟล์นี้ได้</p>
              )}
            </>
          ) : (
            <p className="text-muted">กำลังโหลด preview...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpandedFile;
