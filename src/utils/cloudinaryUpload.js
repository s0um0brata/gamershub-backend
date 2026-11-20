import { fileTypeFromBuffer } from "file-type";
import cloudinary from "../config/cloudinary.js";
import ApiError from "./ApiError.js";

// Allowed image formats and their MIME types
const allowedImageTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

// Upload image buffer to Cloudinary
const uploadToCloudinary = async (fileBuffer, folder = "pc-game-store") => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new ApiError(400, "Valid image file is required");
  }

  // Detect actual file format from its contents
  const detectedType = await fileTypeFromBuffer(fileBuffer);

  if (
    !detectedType ||
    allowedImageTypes[detectedType.ext] !== detectedType.mime
  ) {
    throw new ApiError(
      400,
      "Invalid image. Only JPEG, PNG, WEBP and AVIF images are allowed",
    );
  }

  try {
    // Upload buffer directly to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          allowed_formats: ["jpg", "png", "webp", "avif"],
        },
        (error, uploadResult) => {
          if (error) {
            return reject(error);
          }

          resolve(uploadResult);
        },
      );

      uploadStream.end(fileBuffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error.message);

    throw new ApiError(500, "Image upload failed");
  }
};

export default uploadToCloudinary;
