import { SupportedAtsProvider } from "./types.js";

export interface DetectedJobAts {
  provider: SupportedAtsProvider;
  board?: string;
  jobId?: string;
  normalizedUrl: string;
  isApiSupported: boolean;
}

/**
 * Inspects a job URL to determine the ATS provider and extracted parameters.
 */
export function detectJobAts(rawUrl: string): DetectedJobAts {
  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      provider: "unknown",
      normalizedUrl: trimmed,
      isApiSupported: false,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  // 1. Lever: https://jobs.lever.co/{board}/{jobId}
  if (hostname === "jobs.lever.co" || hostname.endsWith(".lever.co")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return {
        provider: "lever",
        board: parts[0],
        jobId: parts[1],
        normalizedUrl: `https://jobs.lever.co/${parts[0]}/${parts[1]}`,
        isApiSupported: true,
      };
    }
  }

  // 2. Ashby: https://jobs.ashbyhq.com/{board}/{jobId}
  if (hostname === "jobs.ashbyhq.com" || hostname.endsWith(".ashbyhq.com")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return {
        provider: "ashby",
        board: parts[0],
        jobId: parts[1],
        normalizedUrl: `https://jobs.ashbyhq.com/${parts[0]}/${parts[1]}`,
        isApiSupported: true,
      };
    }
  }

  // 3. Recruitee: https://{board}.recruitee.com/o/{slug} or /l/offers/{slug}
  if (hostname.endsWith(".recruitee.com")) {
    const board = hostname.split(".")[0];
    const parts = pathname.split("/").filter(Boolean);
    let slug = "";
    if (pathname.includes("/o/")) {
      const idx = parts.indexOf("o");
      if (idx !== -1 && idx + 1 < parts.length) slug = parts[idx + 1];
    } else if (pathname.includes("/l/offers/")) {
      const idx = parts.indexOf("offers");
      if (idx !== -1 && idx + 1 < parts.length) slug = parts[idx + 1];
    } else if (parts.length > 0) {
      slug = parts[parts.length - 1];
    }

    if (board && slug) {
      return {
        provider: "recruitee",
        board,
        jobId: slug,
        normalizedUrl: `https://${board}.recruitee.com/o/${slug}`,
        isApiSupported: true,
      };
    }
  }

  // 4. Workable: https://apply.workable.com/{board}/j/{shortcode}
  if (hostname === "apply.workable.com" || hostname.endsWith(".workable.com")) {
    const parts = pathname.split("/").filter(Boolean);
    // Format: /company/j/SHORTCODE or /j/SHORTCODE
    let board = "";
    let shortcode = "";

    const jIdx = parts.indexOf("j");
    if (jIdx > 0 && jIdx + 1 < parts.length) {
      board = parts[jIdx - 1];
      shortcode = parts[jIdx + 1];
    } else if (parts.length >= 2) {
      board = parts[0];
      shortcode = parts[parts.length - 1];
    }

    if (board && shortcode) {
      return {
        provider: "workable",
        board,
        jobId: shortcode,
        normalizedUrl: `https://apply.workable.com/${board}/j/${shortcode}`,
        isApiSupported: true,
      };
    }
  }

  // 5. Greenhouse: https://boards.greenhouse.io/{board}/jobs/{jobId} or boards-api.greenhouse.io
  if (hostname.includes("greenhouse.io")) {
    const parts = pathname.split("/").filter(Boolean);
    let board = "";
    let jobId = "";

    // /embed/job_app?for=board&token=id
    if (pathname.startsWith("/embed/job_app")) {
      board = parsed.searchParams.get("for") || "";
      jobId = parsed.searchParams.get("token") || "";
    } else {
      const jobsIdx = parts.indexOf("jobs");
      if (jobsIdx > 0 && jobsIdx + 1 < parts.length) {
        board = parts[jobsIdx - 1];
        jobId = parts[jobsIdx + 1];
      } else {
        const boardsIdx = parts.indexOf("boards");
        if (boardsIdx !== -1 && boardsIdx + 1 < parts.length) {
          board = parts[boardsIdx + 1];
        }
        if (jobsIdx !== -1 && jobsIdx + 1 < parts.length) {
          jobId = parts[jobsIdx + 1];
        }
      }
    }

    if (board && jobId) {
      return {
        provider: "greenhouse",
        board,
        jobId,
        normalizedUrl: `https://boards.greenhouse.io/${board}/jobs/${jobId}`,
        isApiSupported: true,
      };
    }
  }

  return {
    provider: "unknown",
    normalizedUrl: trimmed,
    isApiSupported: false,
  };
}
