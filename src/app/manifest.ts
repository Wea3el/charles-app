import type { MetadataRoute } from "next";

// Lets the store app install on the counter laptop with its own icon.
// TODO: add icon-192.png and icon-512.png to /public and list them here.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Charles Store",
    short_name: "Store",
    description: "Register, inventory and orders",
    start_url: "/store",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
  };
}
