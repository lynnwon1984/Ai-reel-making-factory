import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiMiddleware } from "./server/dev-api.mjs";

// 仅开发期生效：把 /api/chat 交给本地代理，API Key 留在服务端
function devApi() {
  return {
    name: "deepseek-dev-api",
    configureServer(server) {
      server.middlewares.use(apiMiddleware(server.config.root));
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    // 沙箱里 fs 事件监听不生效，改用轮询：改代码不再需要重启服务
    watch: { usePolling: true, interval: 400 },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), devApi()],
});
