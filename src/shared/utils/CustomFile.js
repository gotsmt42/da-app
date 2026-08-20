import {
    faFileImage,
    faFilePdf,
    faFileWord,
    faFileExcel,
    faFilePowerpoint,
    faFileUpload,
    faThList,
    
  } from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

// FileHelpers.js
export const getFileIcon = (fileName) => {
    if (fileName) {
      const extension = fileName.split(".").pop().toLowerCase();
      switch (extension) {
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
          return faFileImage;
        case "pdf":
          return faFilePdf;
        case "doc":
        case "docx":
          return faFileWord;
        case "csv":
        case "xls":
        case "xlsx":
          return faFileExcel;
        case "ppt":
        case "pptx":
          return faFilePowerpoint;
        case "rar":
          return faThList
        default:
          return faFileUpload;
      }
    }
  };
  
  export const getFileIconColor = (fileName) => {
    if (fileName) {
      const extension = fileName.split(".").pop().toLowerCase();
      switch (extension) {
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
          return "blue"; // สีของไฟล์รูปภาพ
        case "pdf":
          return "red"; // สีของไฟล์ PDF
        case "doc":
        case "docx":
          return "blue"; // สีของไฟล์ Word
        case "csv":
        case "xls":
        case "xlsx":
          return "green"; // สีของไฟล์ Excel
        case "ppt":
        case "pptx":
          return "orange"; // สีของไฟล์ PowerPoint
        case "rar":
          return "purple"
        default:
          return "black"; // สีของไอคอนอื่น ๆ
      }
    }
  };
  

  export const formatFileSize = (size) => {
    if (size) {
      const KB = 1024;
      const MB = KB * 1024;
      const GB = MB * 1024;
  
      if (size >= GB) {
        return `${(size / GB).toFixed(2)} GB`;
      } else if (size >= MB) {
        return `${(size / MB).toFixed(2)} MB`;
      } else if (size >= KB) {
        return `${(size / KB).toFixed(2)} KB`;
      } else {
        return `${size} bytes`;
      }
    } else {
      return "Unknown";
    }
  };