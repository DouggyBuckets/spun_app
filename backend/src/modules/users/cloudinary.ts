import crypto from "crypto";
import { config } from "../../config";
import { AppError } from "../../errors";

interface CloudinaryUploadResponse {
    secure_url: string;
}

export async function uploadAvatar(dataUri: string, publicId: string): Promise<string> {
    if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
        throw new AppError(503, "Avatar upload is not configured yet");
    }

    const params: Record<string, string> = {
        folder: "avatars",
        public_id: publicId,
        overwrite: "true",
        timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const paramsToSign = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    const signature = crypto
        .createHash("sha1")
        .update(paramsToSign + config.cloudinaryApiSecret)
        .digest("hex");

    const formData = new FormData();
    formData.append("file", dataUri);
    formData.append("api_key", config.cloudinaryApiKey);
    formData.append("signature", signature);
    for (const [key, value] of Object.entries(params)) {
        formData.append(key, value);
    }

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`,
        { method: "POST", body: formData }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new AppError(502, `Image upload failed: ${errorBody}`);
    }

    const data = (await response.json()) as CloudinaryUploadResponse;
    return data.secure_url;
}
