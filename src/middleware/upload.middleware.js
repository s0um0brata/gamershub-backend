import multer from "multer";
import ApiError from "../utils/ApiError.js";

// Allow only image files
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only JPEG, PNG, WEBP and AVIF images are allowed"));
  }
};

// Store uploaded files in memory
const storage = multer.memoryStorage();

// Configure Multer
const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per image
    files: 6, // Maximum 6 images per request
  },
});

export default upload;
