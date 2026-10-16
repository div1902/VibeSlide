/** Generate a manifest for the actual deployed origin, never a guessed domain. */
export function powerPointManifest(appUrl: string): string {
  const url = new URL(appUrl);
  if (url.protocol !== "https:")
    throw new Error(
      "Deploy VibeSlide to an HTTPS website first, then download its PowerPoint manifest.",
    );
  url.search = "?integration=powerpoint";
  url.hash = "";
  const xml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="TaskPaneApp">
<Id>9808d95e-302b-4b8e-a31d-94549240892e</Id><Version>1.0.0.0</Version><ProviderName>VibeSlide</ProviderName><DefaultLocale>en-US</DefaultLocale>
<DisplayName DefaultValue="VibeSlide"/><Description DefaultValue="Read your open deck, preview a new vibe, and download a separate PowerPoint."/>
<Hosts><Host Name="Presentation"/></Hosts>
<DefaultSettings><SourceLocation DefaultValue="${xml(url.href)}"/></DefaultSettings>
<Permissions>ReadAllDocument</Permissions>
</OfficeApp>`;
}
