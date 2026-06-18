import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hola.climbing",
  appName: "올라",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
