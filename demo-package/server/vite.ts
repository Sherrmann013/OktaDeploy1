import { ViteDevServer } from "vite";
import { Express } from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "http";

export function log(msg: string) {
  console.log(`${new Date().toLocaleTimeString()} [express] ${msg}`);
}

export async function setupVite(app: Express, server: Server): Promise<ViteDevServer> {
  const vite = await createViteServer({
    appType: "custom",
    server: { middlewareMode: true },
    root: process.cwd(),
    configFile: "./vite.config.ts",
  });

  app.use(vite.ssrLoadModule);
  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      if (url.startsWith("/api")) {
        return next();
      }

      let template = await vite.transformIndexHtml(url, `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Security Dashboard Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client/src/main.tsx"></script>
  </body>
</html>
      `);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    }
  });

  return vite;
}

export function serveStatic() {
  // No-op for demo version
}