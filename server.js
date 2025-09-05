/* eslint-env node */
import { createRequestHandler } from "@remix-run/express";
import { broadcastDevReady } from "@remix-run/node";
import express from "express";
import crypto from "node:crypto";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

// Don't use app.use with the build import

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" })
  );
  app.use(express.static("build/client", { maxAge: "1h" }));
}
app.use(express.static("public", { maxAge: "1h" }));

// handle SSR requests
const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
  : await import("./build/server/index.js");

// Nonce generation logic (copied from nonce.server.ts)
const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
const DEV_FIXED_NONCE = 'dev-fixed-nonce';
const NONCE_SECRET = process.env.NONCE_SECRET ? 
    Buffer.from(process.env.NONCE_SECRET, 'hex') : 
    crypto.createHash('sha256').update(process.env.NODE_ENV + (process.env.SESSION_SECRET || 'default-fallback')).digest();

function deriveNonceForRequest(request) {
    // if (STRICT_DEV) return DEV_FIXED_NONCE;
    
    // For production, generate nonce based on session-level data, not request-specific URL
    // This ensures the same nonce is used for the main page and all its assets
    const ua = request.headers['user-agent'] || '';
    const al = request.headers['accept-language'] || '';
    const xfwdHost = request.headers['x-forwarded-host'] || '';
    const xfwdProto = request.headers['x-forwarded-proto'] || '';
    
    // Extract base URL without path/query to ensure consistency across asset requests
    const protocol = xfwdProto || (request.secure ? 'https' : 'http');
    const host = xfwdHost || request.headers.host || 'localhost';
    const baseUrl = `${protocol}://${host}`;
    
    const data = `${baseUrl}|${ua}|${al}|${xfwdHost}|${xfwdProto}`;
    console.log('server.js nonce data:', { baseUrl, ua: ua.substring(0, 50), al, xfwdHost, xfwdProto, data: data.substring(0, 100) });
    const digest = crypto.createHmac('sha256', NONCE_SECRET).update(data).digest('base64');
    return digest.slice(0, 22);
}

// Define getLoadContext function
function getLoadContext(args) {
  console.log('getLoadContext called with:', typeof args, Object.keys(args || {}));
  console.log('getLoadContext full args:', args);
  
  // Try different patterns for getting the request
  let request = args?.request || args;
  
  // If args is the request itself (Express request object)
  if (args && args.headers && args.method && args.url) {
    request = args;
    console.log('Using args as request directly');
  }
  
  if (!request || !request.headers) {
    console.log('No valid request found, using fallback nonce');
    return { nonce: 'fallback-no-request' };
  }
  
  const nonce = deriveNonceForRequest(request);
  console.log('server.js getLoadContext nonce:', nonce, 'length:', nonce?.length);
  return { nonce };
}

app.all(
  "*",
  createRequestHandler({
    build,
    getLoadContext,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);

  if (process.env.NODE_ENV === "development" && !viteDevServer) {
    broadcastDevReady(await import("./build/server/index.js"));
  }
});