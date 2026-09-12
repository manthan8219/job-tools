import { z } from "zod";


import { BaseEntitySchema } from "../../common/models/base.js";

export const UserStatsSchema = z.object({
  totalApplications: z.number(),
  interviewing: z.number(),
  offers: z.number(),
  rejected: z.number(),
  referralsAsked: z.number(),
  emailsSent: z.number(),
}).merge(BaseEntitySchema);

export type UserStats = z.infer<typeof UserStatsSchema>;
