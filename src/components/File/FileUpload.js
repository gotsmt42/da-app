import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faFileImport, faTimes } from "@fortawesome/free-solid-svg-icons";
import FileService from "../../services/FileService";
import Swal from "sweetalert2";
import { ThreeDots } from "react-loader-spinner";
import { getFileIcon, getFileIconColor } from "../../functions/CustomFile";

import CreatableSelect from "react-select/creatable";
const MAX_FILE_SIZE_MB = 500;
const MAX_UPLOAD_FILE = 500;

const FileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await FileService.getCategories();
        setCategories(res.categories.map((c) => c.name));
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (uploadedFiles.length > MAX_UPLOAD_FILE) {
      Swal.fire({
        icon: "warning",
        title: "แจ้งเตือน",
        text: "ไม่สามารถอัพโหลดไฟล์ได้เกิน 100 ไฟล์ / ครั้ง",
      });
      setUploadedFiles(uploadedFiles.slice(0, MAX_UPLOAD_FILE));
    }
  }, [uploadedFiles]);

  const onDrop = (acceptedFiles) => {
    setLoading(true);

    // ✅ ไม่ตัด image ออกแล้ว
    const oversizedFiles = acceptedFiles.filter(
      (file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024,
    );

    if (oversizedFiles.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "ไฟล์ใหญ่เกินไป",
        text: `ไม่สามารถอัพโหลดไฟล์ที่มีขนาดเกิน ${MAX_FILE_SIZE_MB}MB ได้`,
      });
    } else {
      let newFiles = [];
      const existingFileNames = uploadedFiles.map((file) => file.name);

      acceptedFiles.forEach((file) => {
        let newName = file.name;
        const fileNameParts = file.name.split(".");
        const fileName = fileNameParts.slice(0, -1).join(".");
        const fileExtension = fileNameParts.pop();
        let counter = 1;

        while (existingFileNames.includes(newName)) {
          newName = `${fileName} (${counter}).${fileExtension}`;
          counter++;
        }

        // ✅ เก็บทั้งไฟล์และชื่อที่แก้ไขได้
        newFiles.push({ file, name: newName });
        existingFileNames.push(newName);
      });

      setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
    setLoading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleUpload = async () => {
    if (uploadedFiles.length > 0) {
      // ✅ ตรวจสอบชื่อไฟล์ว่าง
      const invalidFiles = uploadedFiles.filter((item) => {
        const fileNameParts = item.name.split(".");
        const extension = fileNameParts.pop();
        const baseName = fileNameParts.join(".");
        return !baseName.trim(); // ❌ ถ้าไม่มีชื่อ
      });

      if (invalidFiles.length > 0) {
        Swal.fire({
          icon: "warning",
          title: "ชื่อไฟล์ไม่ถูกต้อง",
          text: "กรุณาตั้งชื่อไฟล์ให้ครบทุกไฟล์ก่อนอัพโหลด",
        });
        return; // ❌ ไม่ส่งไป backend
      }

      setLoading(true);
      try {
        const formData = new FormData();
        uploadedFiles.forEach((item) => {
          formData.append("files", item.file, item.name);
          formData.append("categories", item.category || "uncategorized"); // ✅ ใช้ categories
        });

        const config = {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgress(percentCompleted);
          },
        };

        const response = await FileService.uploadFiles(formData, config);

        Swal.fire({
          icon: "success",
          title: "อัพโหลดสำเร็จ",
          html: response.data.data
            .map((file) => `<a href="files">${file.filename}</a>`)
            .join("<br>"),
        });

        setUploadedFiles([]);
        setLoading(false);
        setUploadProgress(0);
      } catch (error) {
        console.error("Error uploading files:", error);
        Swal.fire({
          icon: "error",
          title: "Upload Failed",
          text: "เกิดข้อผิดพลาดในการอัพโหลด กรุณาลองใหม่อีกครั้ง",
        });
        setLoading(false);
        setUploadProgress(0);
      }
    } else {
      Swal.fire({
        icon: "warning",
        title: "ไม่มีไฟล์",
        text: "กรุณาเลือกไฟล์ก่อนอัพโหลด",
      });
    }
  };

  const categoryOptions = categories.map((cat) => ({
    value: cat,
    label: cat,
  }));
  return (
    <div className="container my-3">
      {/* พื้นที่ลากไฟล์ */}
      <div
        {...getRootProps()}
        className={`text-center upload-container ${
          isDragActive ? "shadow" : ""
        }`}
        style={{
          cursor: "pointer",
          padding: "2.5rem 2rem",
          maxWidth: "800px",
          margin: "0 auto",
          borderRadius: "16px",
          border: isDragActive ? "2px solid #0d6efd" : "2px dashed #cbd5e1",
          background: isDragActive ? "#eff6ff" : "#f8fafc",
          transition: "all .15s ease",
        }}
      >
        <input {...getInputProps()} accept="image/*,application/pdf" />
        <FontAwesomeIcon
          icon={faFileImport}
          size="3x"
          className="mb-3"
          style={{ color: "#0d6efd" }}
        />
        <p className="fs-5 fw-semibold mb-1">
          {isDragActive
            ? "ปล่อยไฟล์ที่นี่..."
            : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์"}
        </p>
        <p className="text-muted small mb-0">
          รองรับสูงสุด {MAX_UPLOAD_FILE} ไฟล์ / ครั้ง, ไม่เกิน {MAX_FILE_SIZE_MB}MB ต่อไฟล์
        </p>
      </div>

      {/* รายการไฟล์ */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">ไฟล์ที่เลือก ({uploadedFiles.length})</h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setUploadedFiles([])}
            >
              ล้างทั้งหมด
            </button>
          </div>
          <ul className="list-group">
            {uploadedFiles.map((item, index) => {
              const fileNameParts = item.name.split(".");
              const extension = fileNameParts.pop();
              const baseName = fileNameParts.join(".");

              return (
                <li key={index} className="list-group-item">
                  <div className="row align-items-center">
                    {/* Icon */}
                    <div className="col-12 col-md-1 d-flex flex-column align-items-center justify-content-center mb-2 mb-md-0">
                      <FontAwesomeIcon
                        icon={getFileIcon(item.name)}
                        style={{
                          color: getFileIconColor(item.name),
                          cursor: "pointer",
                          fontSize: "1.4rem",
                          marginBottom: "6px",
                        }}
                        onClick={() => {
                          const blobUrl = URL.createObjectURL(item.file);
                          window.open(blobUrl, "_blank");
                        }}
                      />
                      <small
                        className="text-primary"
                        style={{ cursor: "pointer" }}
                      >
                        Preview
                      </small>
                    </div>

                    {/* ช่องหมวดหมู่ */}
                    <div className="col-12 col-md-3 mb-2 mb-md-0">
                      <CreatableSelect
                        options={categoryOptions.slice(0, 5)} // ✅ จำกัดไม่เกิน 7 แถว
                        value={
                          item.category
                            ? { value: item.category, label: item.category }
                            : null
                        }
                        onChange={(selected) => {
                          const newFiles = [...uploadedFiles];
                          newFiles[index].category = selected
                            ? selected.value
                            : "";
                          setUploadedFiles(newFiles);
                        }}
                        isClearable
                        isSearchable
                        placeholder="เลือกหรือกรอกหมวดหมู่..."
                        styles={{
                          control: (base) => ({
                            ...base,
                            maxWidth: "260px",
                            backgroundColor: "#f0f8ff",
                            borderColor: "#0d6efd",
                            color: "#333",
                            fontSize: "0.85rem",
                          }),
                        }}
                      />
                    </div>

                    {/* ช่องแก้ชื่อไฟล์ */}
                    <div className="col-11 col-md-7 d-flex align-items-center">
                      <input
                        type="text"
                        value={baseName}
                        onChange={(e) => {
                          const newFiles = [...uploadedFiles];
                          newFiles[index].name =
                            `${e.target.value}.${extension}`;
                          setUploadedFiles(newFiles);
                        }}
                        className="form-control form-control-sm w-100"
                      />
                      <span className="text-muted ms-2">.{extension}</span>
                    </div>

                    {/* ปุ่มลบไฟล์นี้ออกจากรายการ (ก่อนกดอัพโหลด) */}
                    <div className="col-1 d-flex align-items-center justify-content-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-1"
                        title="เอาไฟล์นี้ออก"
                        onClick={() =>
                          setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Progress */}
      {loading && (
        <>
          <div className="progress mt-3">
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{ width: `${uploadProgress}%` }}
            >
              {uploadProgress}%
            </div>
          </div>
          <div className="d-flex justify-content-center mt-3">
            <ThreeDots color="#0d6efd" height={40} width={40} />
          </div>
        </>
      )}

      {/* ปุ่มอัพโหลด */}
      <button
        onClick={handleUpload}
        className="btn btn-primary btn-lg mt-4 w-100"
        disabled={loading}
        style={{ maxWidth: "800px", margin: "0 auto", display: "block" }}
      >
        <FontAwesomeIcon icon={faUpload} className="me-2" /> อัพโหลดไฟล์
      </button>
    </div>
  );
};

export default FileUpload;
