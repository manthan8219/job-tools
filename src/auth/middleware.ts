import { logger } from "../utils/index.js";

/**
 * Higher-Order Function (Middleware) for MCP Tools.
 * 
 * Since MCP tools over `stdio` don't have traditional HTTP headers, 
 * authentication is typically handled by passing a session token 
 * in the tool's input, or by relying on the client's established connection context.
 * 
 * This is a dummy middleware that wraps a tool's execute function.
 */
export const withAuth = <TInput, TOutput>(
  executeFn: (input: TInput) => Promise<TOutput>
) => {
  return async (input: TInput): Promise<TOutput | { success: false; error: string; message: string }> => {
    logger.info("[Auth Middleware] Intercepting request to verify authentication...");

    // DUMMY AUTH LOGIC
    // For now, we simulate that the request is authenticated.
    // In the future, we could verify `input.token` using jwt.verify()
    const isDummyAuthenticated = true; 

    if (!isDummyAuthenticated) {
      logger.warn("[Auth Middleware] Request rejected: Unauthorized");
      return {
        success: false,
        error: "Unauthorized",
        message: "You must provide a valid authentication token to use this tool.",
      };
    }

    logger.info("[Auth Middleware] Request authenticated successfully. Proceeding to tool execution.");
    
    // Inject the authenticated user ID into the tool input
    // In production, this comes from the decoded JWT token
    const authenticatedInput = {
      ...input,
      authUserId: "user-1234-5678", // Dummy authenticated user ID
    };

    // Proceed to actual tool logic
    return await executeFn(authenticatedInput as TInput & { authUserId: string });
  };
};
