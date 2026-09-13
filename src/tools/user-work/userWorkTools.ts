import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { userWorkService } from "../../user-work/services/userWorkService.js";
import {
  SaveUserWorkInputSchema,
  TierEnum,
} from "../../user-work/models/userWork.js";
import { withAuth } from "../../auth/middleware.js";

const SaveUserWorkToolInput = SaveUserWorkInputSchema.extend({
  userId: z.string().uuid().optional().describe("User ID. If omitted, defaults to authenticated user"),
  authUserId: z.string().optional(),
});

export const saveUserWorkTool = createTool({
  id: "save-user-work",
  description:
    "Saves or updates a candidate's repository work, git forensics, commit activity, architecture summaries, and Google XYZ impact bullet points in PostgreSQL and Redis.",
  inputSchema: SaveUserWorkToolInput,
  execute: withAuth(async (input: z.infer<typeof SaveUserWorkToolInput>) => {
    try {
      const effectiveUserId = input.userId || (input.authUserId as string);
      if (!effectiveUserId) {
        return { success: false, error: "Missing required userId" };
      }

      const saved = await userWorkService.saveWork({
        ...input,
        userId: effectiveUserId,
      });

      return {
        success: true,
        work: saved,
        message: `Successfully saved work for repository '${saved.repositoryName}' (${saved.id})`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }),
});

const GetUserWorkToolInput = z.object({
  idOrName: z.string().describe("Repository record UUID or repository name (e.g. 'job-tools')"),
  userId: z.string().uuid().optional().describe("User ID. Defaults to authenticated user"),
  authUserId: z.string().optional(),
});

export const getUserWorkTool = createTool({
  id: "get-user-work",
  description:
    "Retrieves a candidate's specific repository work item by UUID or repository name, querying Redis cache first for sub-millisecond retrieval.",
  inputSchema: GetUserWorkToolInput,
  execute: withAuth(async (input: z.infer<typeof GetUserWorkToolInput>) => {
    try {
      const effectiveUserId = input.userId || (input.authUserId as string);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idOrName);

      let work;
      if (isUuid) {
        work = await userWorkService.getWorkById(input.idOrName, effectiveUserId);
      } else {
        work = await userWorkService.getWorkByRepo(effectiveUserId, input.idOrName);
      }

      if (!work) {
        return {
          success: false,
          work: null,
          message: `Repository work '${input.idOrName}' not found`,
        };
      }

      return {
        success: true,
        work,
        message: `Successfully retrieved work for '${work.repositoryName}'`,
      };
    } catch (error: any) {
      return { success: false, work: null, error: error.message };
    }
  }),
});

const GetUserWorkListToolInput = z.object({
  userId: z.string().uuid().optional().describe("User ID. Defaults to authenticated user"),
  tier: TierEnum.optional().describe("Filter by tier ('flagship', 'contributing', 'spike')"),
  isFeatured: z.boolean().optional().describe("Filter by featured flag"),
  primaryLanguage: z.string().optional().describe("Filter by primary programming language (e.g. 'TypeScript')"),
  limit: z.number().int().positive().max(100).default(50).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
  authUserId: z.string().optional(),
});

export const getUserWorkListTool = createTool({
  id: "get-user-work-list",
  description:
    "Retrieves all repository portfolio items for a candidate with optional filtering by tier, language, or featured status, utilizing Redis caching.",
  inputSchema: GetUserWorkListToolInput,
  execute: withAuth(async (input: z.infer<typeof GetUserWorkListToolInput>) => {
    try {
      const effectiveUserId = input.userId || (input.authUserId as string);
      const result = await userWorkService.getUserWorkList({
        userId: effectiveUserId,
        tier: input.tier,
        isFeatured: input.isFeatured,
        primaryLanguage: input.primaryLanguage,
        limit: input.limit,
        offset: input.offset,
      });

      return {
        success: true,
        totalFound: result.totalFound,
        returned: result.repositories.length,
        repositories: result.repositories,
      };
    } catch (error: any) {
      return {
        success: false,
        totalFound: 0,
        returned: 0,
        repositories: [],
        error: error.message,
      };
    }
  }),
});

const GetFeaturedUserWorkToolInput = z.object({
  userId: z.string().uuid().optional().describe("User ID. Defaults to authenticated user"),
  authUserId: z.string().optional(),
});

export const getFeaturedUserWorkTool = createTool({
  id: "get-featured-user-work",
  description:
    "Retrieves a candidate's top featured flagship projects and high-impact accomplishments, served directly from Redis cache.",
  inputSchema: GetFeaturedUserWorkToolInput,
  execute: withAuth(async (input: z.infer<typeof GetFeaturedUserWorkToolInput>) => {
    try {
      const effectiveUserId = input.userId || (input.authUserId as string);
      const featured = await userWorkService.getFeaturedWork(effectiveUserId);

      return {
        success: true,
        totalFound: featured.length,
        featuredProjects: featured,
      };
    } catch (error: any) {
      return {
        success: false,
        totalFound: 0,
        featuredProjects: [],
        error: error.message,
      };
    }
  }),
});
