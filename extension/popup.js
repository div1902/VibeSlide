(async () => {
  const { detectEditor } = await import("./detectEditor.js");
  let source = "";
  document.querySelector("#scan").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      source = detectEditor(tab?.url || "") || "";
      document.querySelector("#host").textContent = source
        ? `${source === "canva" ? "Canva" : "PowerPoint"} tab detected`
        : "Ready to import your presentation";
      document.querySelector("#guidance").textContent =
        source === "canva"
          ? "For a full-deck scan, open the registered VibeSlide app in Canva. Otherwise choose Share → Download → Microsoft PowerPoint, select all pages, then import the .pptx here."
          : source === "powerpoint"
            ? "For a full-deck scan, open the installed VibeSlide PowerPoint add-in. Otherwise use File → Save as / Download a copy, then import the .pptx here."
            : "Import a .pptx to preview new vibes. The extension cannot read a canvas or desktop application directly.";
      document.querySelector("#result").hidden = false;
    } catch {
      document.querySelector("#guidance").textContent =
        "This tab cannot be inspected. You can still import a .pptx locally.";
      document.querySelector("#result").hidden = false;
    }
  });
  document.querySelector("#open").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        `index.html?integration=extension&source=${source}`,
      ),
    });
  });
})();
