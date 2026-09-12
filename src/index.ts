import "dotenv/config";
import { server } from "./server.js";
import { resumeRepository } from "./resume/repositories/resumeRepository.js";
import { userProfileService } from "./user-profile/services/userProfileService.js";
import { logger } from "./utils/index.js";
import http from "node:http";

import express from "express";
import session from "express-session";
import passport from "./passport-auth/passport.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function main() {
  logger.info("Starting up MCP server and checking databases...");
  
  // Programmatically create Atlas Search Indexes
  await resumeRepository.setupIndexes();
  
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
  app.get('/auth/login', passport.authenticate('zitadel'));

  app.get('/auth/callback', 
    passport.authenticate('zitadel', { failureRedirect: '/auth/login-failed' }),
    (req, res) => {
      // Upon successful login, close the popup/tab so the user returns to the CLI
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h1>✅ Login Successful!</h1>
            <p>You can close this window and return to your CLI or Agent.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }
  );

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

  // Mastra SSE and Message Handling
  const handleMastra = async (req: express.Request, res: express.Response) => {
    try {
      const url = new URL(req.originalUrl || "", `http://localhost:${PORT}`);
      await server.startSSE({
        url,
        ssePath: "/sse",
        messagePath: "/message",
        req,
        res,
      });
    } catch (err: any) {
      logger.error("SSE handling error", err);
      if (!res.headersSent) {
        res.status(500).send("Internal Server Error");
      }
    }
  };

  app.get('/sse', handleMastra);
  app.post('/message', handleMastra);

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
