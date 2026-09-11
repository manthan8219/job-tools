import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { onboardingService } from "../../onboarding/services/onboardingService.js";
import { withAuth } from "../../auth/middleware.js";

export const checkOnboardingTool = createTool({
  id: "check-onboarding-completed",
  description: "Check if the current authenticated user has completed their onboarding process.",
  inputSchema: z.object({}),
  execute: withAuth(async (input: { authUserId?: string }) => {
    // The authUserId is injected by the withAuth middleware
    const userId = input.authUserId!;
    
    const isCompleted = await onboardingService.checkStatus(userId);
    
    return { 
      success: true, 
      isCompleted,
      message: isCompleted 
        ? "Onboarding is complete for this user." 
        : "Onboarding is NOT complete for this user."
    };
  }),
});

export const markOnboardingCompletedTool = createTool({
  id: "mark-onboarding-completed",
  description: "Marks the onboarding process as completed for the current authenticated user.",
  inputSchema: z.object({}),
  execute: withAuth(async (input: { authUserId?: string }) => {
    const userId = input.authUserId!;
    
    await onboardingService.completeOnboarding(userId);
    
    return { 
      success: true, 
      message: "Onboarding successfully marked as completed." 
    };
  }),
});
