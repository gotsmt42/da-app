import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faFileImport } from "@fortawesome/free-solid-svg-icons";
import FileService from "../../services/FileService";
import Swal from "sweetalert2";
import { ThreeDots } from "react-loader-spinner";
import { getFileIcon, getFileIconColor } from "../../functions/CustomFile";

const MAX_FILE_SIZE_MB = 500 // ขนาดไฟล์สูงสุดที่อนุญาต (MB)
const MAX_UPLOAD_FILE = 500;

const FileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

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
  
    const nonImageFiles = acceptedFiles.filter(
      (file) => !file.type.startsWith("image")
    );
  
    const oversizedFiles = nonImageFiles.filter(
      (file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024
    );
  
    if (oversizedFiles.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "แจ้งเตือน",
        text: `ไม่สามารถอัพโหลดไฟล์ที่มีขนาดเกิน ${MAX_FILE_SIZE_MB}MB ได้ กรุณาตรวจสอบไฟล์และลองใหม่อีกครั้ง`,
      });
    } else {
      let newFiles = [];
      const existingFileNames = uploadedFiles.map(file => file.name);
      nonImageFiles.forEach((file) => {
        let newName = file.name;
        const fileNameParts = file.name.split('.');
        const fileName = fileNameParts.slice(0, -1).join('.');
        const fileExtension = fileNameParts.pop();
        let counter = 1;
        while (existingFileNames.includes(newName)) {
          newName = `${fileName} (${counter}).${fileExtension}`;
          counter++;
        }
        newFiles.push(new File([file], newName, { type: file.type }));
        existingFileNames.push(newName);
      });
  
      setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
  
    setLoading(false);
  };
  
  

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });
  const handleUpload = async () => {
    if (uploadedFiles.length > 0) {
      setLoading(true);
      try {
        const formData = new FormData();
        uploadedFiles.forEach((file) => {
          const utf8Name = encodeURIComponent(file.name);
          formData.append("files", file, utf8Name);
        });
  
        const config = {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        };
  
        await FileService.uploadFiles(formData, config);
  
        setUploadedFiles([]);
        setLoading(false);
        setUploadProgress(0);
  
        Swal.fire({
          icon: "success",
          title: "Upload Successful",
          text: "All files have been uploaded successfully!",
        });
      } catch (error) {
        console.error("Error uploading files:", error);
        Swal.fire({
          icon: "error",
          title: "Upload Failed",
          text: "An error occurred while uploading files. Please try again.",
        });
        setLoading(false);
        setUploadProgress(0);
      }
    } else {
      Swal.fire({
        icon: "warning",
        title: "No Files Selected",
        text: "Please upload files before proceeding.",
        confirmButtonColor: "#333",
      });
    }
  };
  
  

  return (
    <div className="container">
      <div
        {...getRootProps()}
        className={`border rounded p-5 text-center upload-container ${
          isDragActive ? "shadow" : ""
        }`}
      >
        <input {...getInputProps()} />
        <FontAwesomeIcon
          icon={faFileImport}
          size="3x"
          className="text-primary mb-3"
        />
        <p className="fs-4">Drag and drop files here or click to browse.</p>
        {uploadedFiles.length > 0 && (
          <div>
            <p className="fs-6">
              {uploadedFiles.length} / {MAX_UPLOAD_FILE} files selected
            </p>
            <ul className="list-group mt-3">
              {uploadedFiles.map((file, index) => (
                <li
                  key={index}
                  className="list-group-item d-flex align-items-center"
                >
                  <FontAwesomeIcon
                    icon={getFileIcon(file.name)}
                    className="me-2"
                    style={{ color: getFileIconColor(file.name) }}
                  />
                  {file.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {loading && (
        <div className="progress mt-3">
          <div
            className="progress-bar"
            role="progressbar"
            style={{ width: `${uploadProgress}%` }}
            aria-valuenow={uploadProgress}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            {uploadProgress}%
          </div>
        </div>
      )}

      {loading && (
        <div className="d-flex justify-content-center mt-3">
          <ThreeDots type="ThreeDots" color="#007bff" height={50} width={50} />
        </div>
      )}

      <button
        onClick={handleUpload}
        className="btn btn-success btn-lg mt-3"
        disabled={loading}
      >
        <FontAwesomeIcon icon={faUpload} className="me-2" /> Upload
      </button>
    </div>
  );
};

export default FileUpload;
