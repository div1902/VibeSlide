export function detectEditor(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "canva.com" || url.hostname.endsWith(".canva.com"))
      return "canva";
    if (
      [
        "powerpoint.cloud.microsoft",
        "powerpoint.office.com",
        "powerpoint.officeapps.live.com",
      ].includes(url.hostname) ||
      (url.hostname === "onedrive.live.com" &&
        /\.pptx|powerpoint|\.ppt(?:&|$)/i.test(url.href)) ||
      (url.hostname.endsWith(".sharepoint.com") &&
        /powerpoint|\.pptx|Doc\.aspx/i.test(url.href))
    )
      return "powerpoint";
  } catch {
    /* Unsupported page; offer local file import. */
  }
  return null;
}
