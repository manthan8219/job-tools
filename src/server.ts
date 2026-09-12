import { MCPServer } from "@mastra/mcp";
import { createUserTool, getUserTool } from "./tools/user/userTools.js";
import { loginTool, registerTool } from "./tools/auth/authTools.js";
import { createResumeTool, searchSimilarResumesTool } from "./tools/resume/resumeTools.js";
import { convertMdToPdfTool, convertLatexToPdfTool } from "./tools/utilities/converterTools.js";
import { checkOnboardingTool, markOnboardingCompletedTool } from "./tools/onboarding/onboardingTools.js";
import { passportLoginTool, passportLogoutTool } from "./tools/passport-auth/passportAuthTools.js";
import { getUserStatsTool } from "./tools/user-profile/userProfileTools.js";
import { getJobProfileTool, upsertJobProfileTool } from "./tools/user-job-profile/jobProfileTools.js";

export const server = new MCPServer({
  name: "job-applier-mcp",
  version: "0.1.0",
  tools: {
    createUser: createUserTool,
    getUser: getUserTool,
    login: loginTool,
    register: registerTool,
    createResume: createResumeTool,
    searchSimilarResumes: searchSimilarResumesTool,
    convertMdToPdf: convertMdToPdfTool,
    convertLatexToPdf: convertLatexToPdfTool,
    checkOnboardingCompleted: checkOnboardingTool,
    markOnboardingCompleted: markOnboardingCompletedTool,
    passportLogin: passportLoginTool,
    passportLogout: passportLogoutTool,
    getUserApplicationStats: getUserStatsTool,
    getJobProfile: getJobProfileTool,
    upsertJobProfile: upsertJobProfileTool,
  },
});
