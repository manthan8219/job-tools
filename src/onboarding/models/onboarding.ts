import { z } from "zod";

export const OnboardingStateSchema = z.object({
  userId: z.string(),
  isCompleted: z.boolean().default(false),
  completedAt: z.date().optional(),
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
