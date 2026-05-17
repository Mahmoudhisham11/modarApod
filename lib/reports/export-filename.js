/** @param {string} s */
function slugify(s) {
  return s
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** @param {string} s */
function asciiSlugify(s) {
  const slug = slugify(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "branch";
}

/**
 * @param {{ branchLabel: string; extension: string; asciiOnly?: boolean }} input
 */
export function buildReportExportFilename({ branchLabel, extension, asciiOnly = false }) {
  const slug = asciiOnly ? asciiSlugify(branchLabel) : slugify(branchLabel) || "فرع";
  const date = new Date().toISOString().slice(0, 10);
  const ext = extension.replace(/^\./, "");
  if (asciiOnly) {
    return `report-${slug}-${date}.${ext}`;
  }
  return `تقرير-${slug}-${date}.${ext}`;
}
