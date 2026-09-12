import "dotenv/config";
import { server } from "./server.js";
import { resumeRepository } from "./resume/repositories/resumeRepository.js";
import { userProfileService } from "./user-profile/services/userProfileService.js";
import { logger } from "./utils/index.js";
import http from "node:http";

import express from "express";
import session from "express-session";
import passport from "./passport-auth/passport.js";
import jwt from "jsonwebtoken";

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
  app.get('/auth/login', (req, res, next) => {
    // Save the CLI redirect URI to the session if provided
    if (req.query.redirect_uri) {
      (req.session as any).cliRedirectUri = req.query.redirect_uri;
    }
    passport.authenticate('zitadel')(req, res, next);
  });

  app.get('/auth/callback', 
    passport.authenticate('zitadel', { failureRedirect: '/auth/login-failed' }),
    async (req, res) => {
      const user = req.user as any;
      const cliRedirectUri = (req.session as any).cliRedirectUri;
      
      // If the CLI provided a redirect URI, send the tokens back to the local CLI server
      if (cliRedirectUri && user) {
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        
        const redirectUrl = new URL(cliRedirectUri);
        redirectUrl.searchParams.set('accessToken', accessToken);
        redirectUrl.searchParams.set('refreshToken', refreshToken);
        redirectUrl.searchParams.set('userId', user.id);
        redirectUrl.searchParams.set('email', user.email);
        redirectUrl.searchParams.set('firstName', user.firstName || 'User');
        
        delete (req.session as any).cliRedirectUri;
        
        return res.redirect(redirectUrl.toString());
      }

      // Fallback if logged in via standard browser without CLI redirect
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
