import {
  AttachFile as AttachFileIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Description as DescriptionIcon,
  TableChart,
  Slideshow,
  TextSnippet,
  Image as ImageIcon,
} from "@mui/icons-material";

export const getFileIcon = (type = "") => {
  if (!type || typeof type !== "string")
    return <AttachFileIcon fontSize="small" sx={{ color: "#888" }} />;

  const lowerType = type.toLowerCase();

  if (lowerType.includes("pdf") || lowerType.endsWith(".pdf"))
    return <PictureAsPdfIcon fontSize="small" sx={{ color: "#d32f2f" }} />;

  if (
    lowerType.includes("word") ||
    lowerType.includes("doc") ||
    lowerType.includes("msword") ||
    lowerType.includes("officedocument.wordprocessingml.document") ||
    lowerType.endsWith(".doc") ||
    lowerType.endsWith(".docx")
  )
    return <DescriptionIcon fontSize="small" sx={{ color: "#1976d2" }} />;

  if (
    lowerType.includes("excel") ||
    lowerType.includes("spreadsheet") ||
    lowerType.includes("officedocument.spreadsheetml.sheet") ||
    lowerType.endsWith(".xls") ||
    lowerType.endsWith(".xlsx")
  )
    return <TableChart fontSize="small" sx={{ color: "#2e7d32" }} />;

  if (
    lowerType.includes("powerpoint") ||
    lowerType.includes("presentation") ||
    lowerType.includes("officedocument.presentationml.presentation") ||
    lowerType.endsWith(".ppt") ||
    lowerType.endsWith(".pptx")
  )
    return <Slideshow fontSize="small" sx={{ color: "#e65100" }} />;

  if (
    lowerType.includes("text") ||
    lowerType.includes("plain") ||
    lowerType.endsWith(".txt")
  )
    return <TextSnippet fontSize="small" sx={{ color: "#6d4c41" }} />;

  if (
    lowerType.includes("image") ||
    lowerType.endsWith(".jpg") ||
    lowerType.endsWith(".jpeg") ||
    lowerType.endsWith(".png") ||
    lowerType.endsWith(".webp")
  )
    return <ImageIcon fontSize="small" sx={{ color: "#388e3c" }} />;

  return <AttachFileIcon fontSize="small" sx={{ color: "#888" }} />;
};
