import "dotenv/config";
import { server } from "./server.js";
import { resumeRepository } from "./resume/repositories/resumeRepository.js";
import { userProfileService } from "./user-profile/services/userProfileService.js";
import { logger } from "./utils/index.js";
import http from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/server-legacy/sse";

import express from "express";
import session from "express-session";
import passport from "./passport-auth/passport.js";
import jwt from "jsonwebtoken";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function main() {
  logger.info("Starting up MCP server and checking databases...");
  
  // Programmatically create Atlas Search Indexes
  await resumeRepository.setupIndexes();
  
  // Initialize core users table first
  const { userRepository } = await import("./user/repositories/userRepository.js");
  await userRepository.init();

  // Initialize Postgres tables for user profile (job applications)
  await userProfileService.init();
  
  // Initialize Postgres tables for user job profile (search preferences)
  const { jobProfileService } = await import("./user-job-profile/services/jobProfileService.js");
  await jobProfileService.init();

  const app = express();

  // Setup session for Passport OIDC state and redirects
  app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-mcp-session',
    resave: false,
    saveUninitialized: false
  }));

  // Initialize Passport and restore authentication state, if any, from the session
  app.use(passport.initialize());
  app.use(passport.session());

  // Zitadel OAuth Routes
  app.get('/auth/login', (req, res, next) => {
    // Save the CLI redirect URI to the session if provided
    if (req.query.redirect_uri) {
      (req.session as any).cliRedirectUri = req.query.redirect_uri;
    }
    passport.authenticate('zitadel')(req, res, next);
  });

  app.get('/auth/callback', (req, res, next) => {
    passport.authenticate('zitadel', async (err: any, user: any, info: any) => {
      if (err) {
        console.error("Passport Internal Error:", err);
        return res.status(500).send(`Passport Internal Error: ${err.message || err}`);
      }
      if (!user) {
        console.error("Zitadel Authentication Failed. Info:", info);
        return res.status(401).send(`Authentication Failed! Zitadel rejected the login.<br><br>Reason: ${JSON.stringify(info)}`);
      }
      
      // If successful, establish the session
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          return res.status(500).send(`Session Login Error: ${loginErr.message}`);
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        
        const tokenQuery = `accessToken=${accessToken}&refreshToken=${refreshToken}&userId=${user.id}&email=${encodeURIComponent(user.email)}&firstName=${encodeURIComponent(user.firstName || 'User')}`;

        const cliRedirectUri = (req.session as any).cliRedirectUri;
        
        // If session was maintained perfectly, do a fast server-side redirect
        if (cliRedirectUri) {
          delete (req.session as any).cliRedirectUri;
          return res.redirect(`${cliRedirectUri}?${tokenQuery}`);
        }

        // Fallback: If session cookies were dropped (common on Render proxies without 'trust proxy'),
        // we use a client-side JavaScript redirect to force the browser to hand the tokens to the CLI.
        res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
              <h1>✅ Login Successful!</h1>
              <p>Passing secure tokens to your CLI...</p>
              <p>If nothing happens, <a href="http://localhost:4132/callback?${tokenQuery}">click here</a>.</p>
              <script>
                // Auto-redirect to the local CLI agent
                window.location.href = "http://localhost:4132/callback?${tokenQuery}";
              </script>
            </body>
          </html>
        `);
      });
    })(req, res, next);
  });

  app.get('/auth/login-failed', (req, res) => {
    res.status(401).send("Authentication with Zitadel failed.");
  });

  // Provide a visible endpoint for browsers
  app.get('/', (req, res) => {
    res.json({
      server: "job-applier-mcp",
      status: "online",
      message: "This is an MCP (Model Context Protocol) Server. Connect an MCP client using the SSE URL: /sse",
      sseEndpoint: "https://job-tools.onrender.com/sse",
      toolsAvailable: Object.keys((server as any).originalTools || {})
    });
  });

  // Multi-session SSE Transports Map to support concurrent and reconnecting MCP clients
  const sseTransports = new Map<string, { transport: SSEServerTransport; serverInstance: any }>();

  // GET /sse - Establishes the SSE stream
  app.get('/sse', async (req: express.Request, res: express.Response) => {
    try {
      logger.info(`Established new SSE connection on ${req.originalUrl}`);
      const transport = new SSEServerTransport('/message', res);
      const serverInstance = (server as any).createServerInstance();
      await serverInstance.connect(transport);

      const sessionId = transport.sessionId;
      sseTransports.set(sessionId, { transport, serverInstance });

      res.on('close', () => {
        logger.info(`SSE connection closed for session: ${sessionId}`);
        sseTransports.delete(sessionId);
      });
    } catch (err: any) {
      logger.error('Error establishing SSE connection:', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  // POST handler for MCP JSON-RPC messages (handles both /message and /sse)
  const handlePostMessage = async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.query.sessionId as string;
      logger.info(`Received POST message on ${req.originalUrl} (sessionId: ${sessionId || 'none'})`);

      // Find session by ID, or fall back to the most recent active session
      let session = sessionId ? sseTransports.get(sessionId) : undefined;
      if (!session && sseTransports.size > 0) {
        session = Array.from(sseTransports.values()).pop();
      }

      if (!session) {
        logger.warn(`No active SSE session found for message on ${req.originalUrl}`);
        res.status(503).send("SSE connection not established");
        return;
      }

      await session.transport.handlePostMessage(req, res);
    } catch (err: any) {
      logger.error(`Error handling POST message on ${req.originalUrl}:`, err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  };

  // Support POST /message (standard MCP SSE) and POST /sse (direct message)
  app.post('/message', handlePostMessage);
  app.post('/sse', handlePostMessage);

  const httpServer = http.createServer(app);

  httpServer.listen(PORT, () => {
    logger.info(`✅ MCP Server running over SSE!`);
    logger.info(`SSE URL: http://localhost:${PORT}/sse`);
    logger.info(`Message URL: http://localhost:${PORT}/message`);
    logger.info(`Zitadel Login URL: http://localhost:${PORT}/auth/login`);
  });
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error("Fatal error running MCP server:", error);
    process.exit(1);
  });
}
