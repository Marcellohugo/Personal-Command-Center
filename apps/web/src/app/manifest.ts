import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Marco Life OS",
    short_name: "Life OS",
    description: "Workspace pribadi untuk arah, aktivitas, progres, dan refleksi.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fc",
    theme_color: "#2563eb",
    lang: "id-ID",
    categories: ["productivity", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Buka dashboard",
        short_name: "Dashboard",
        url: "/dashboard"
      }
    ]
  };
}
