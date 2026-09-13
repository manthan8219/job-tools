import { MCPServer } from "@mastra/mcp";
import { createUserTool, getUserTool } from "./tools/user/userTools.js";
import { loginTool, registerTool } from "./tools/auth/authTools.js";
import { createResumeTool, searchSimilarResumesTool } from "./tools/resume/resumeTools.js";
import { convertMdToPdfTool, convertLatexToPdfTool } from "./tools/utilities/converterTools.js";
import { checkOnboardingTool, markOnboardingCompletedTool } from "./tools/onboarding/onboardingTools.js";
import { passportLoginTool, passportLogoutTool } from "./tools/passport-auth/passportAuthTools.js";
import { getUserStatsTool } from "./tools/user-profile/userProfileTools.js";
import { getJobProfileTool, upsertJobProfileTool } from "./tools/user-job-profile/jobProfileTools.js";
import { scrapeJobsTool } from "./tools/scrapers/scraperTools.js";
import { getScraperConfigTool } from "./tools/scrapers/scraperConfigTools.js";
import {
  searchJobsDatabaseTool,
  getJobDetailsTool,
} from "./tools/jobs/jobTools.js";
import {
  searchCompaniesTool,
  getCompanyDetailsTool,
} from "./tools/jobs/companyTools.js";
import {
  saveJobScoreTool,
  getJobScoreTool,
  getUserTopScoredJobsTool,
} from "./tools/job-scoring/jobScoringTools.js";

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
    scrapeJobs: scrapeJobsTool,
    getScraperConfig: getScraperConfigTool,
    searchJobsDatabase: searchJobsDatabaseTool,
    getJobDetails: getJobDetailsTool,
    searchCompanies: searchCompaniesTool,
    getCompanyDetails: getCompanyDetailsTool,
    saveJobScore: saveJobScoreTool,
    getJobScore: getJobScoreTool,
    getUserTopScoredJobs: getUserTopScoredJobsTool,
  },
});



