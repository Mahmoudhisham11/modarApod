const CLOUD_NAME = "drtdv4iyr";
const UPLOAD_PRESET = "cashat_abod";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/**
 * @param {File} file
 * @returns {Promise<string>} uploaded image URL
 */
export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${errBody}`);
  }
  const json = await res.json();
  return /** @type {string} */ (json.secure_url);
}
