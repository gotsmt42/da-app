import React, { useEffect, useState } from "react";
import moment from "moment";
import { formatFileSize } from "../../functions/CustomFile";
import API from "../../API/axiosInstance";
import AuthService from "../../services/authService";

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
    <div className="card mb-3">
      <div className="card-body">
        <h5>{data.filename}</h5>
        <p>Size: {data.size ? formatFileSize(data.size) : "Unknown"}</p>
        <p>
          อัพโหลดโดย: {data.user?.fname} {data.user?.lname} ({data.user?.username})
        </p>
        <p>อัพโหลดเมื่อ {moment(data.createdAt).format("DD/MM/YYYY HH:mm:ss")}</p>

        {/* ✅ Preview */}
        <div className="mt-3">
          {previewUrl ? (
            <>
              {isImage && <img src={previewUrl} alt={data.filename} style={{ maxWidth: "100%", maxHeight: "400px" }} />}
              {isPDF && <iframe src={previewUrl} title="PDF Preview" style={{ width: "100%", height: "500px", border: "1px solid #ccc" }} />}
              {!isImage && !isPDF && <p className="text-muted">ไม่สามารถ preview ไฟล์นี้ได้</p>}
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
