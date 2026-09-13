import {
  ApplyRequest,
  ApplyResult,
  JobApplierAdapter,
  SupportedAtsProvider,
} from "./types.js";
import {
  LeverJobApplierAdapter,
  RecruiteeJobApplierAdapter,
  AshbyJobApplierAdapter,
  WorkableJobApplierAdapter,
  GreenhouseJobApplierAdapter,
} from "./adapters/index.js";
import { detectJobAts } from "./detector.js";
import { logger } from "../utils/index.js";

export class JobApplierRegistry {
  private readonly adapters: Map<SupportedAtsProvider, JobApplierAdapter> = new Map();

  constructor() {
    this.register(new LeverJobApplierAdapter());
    this.register(new RecruiteeJobApplierAdapter());
    this.register(new AshbyJobApplierAdapter());
    this.register(new WorkableJobApplierAdapter());
    this.register(new GreenhouseJobApplierAdapter());
  }

  register(adapter: JobApplierAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider: SupportedAtsProvider): JobApplierAdapter | undefined {
    return this.adapters.get(provider);
  }

  getRegisteredProviders(): SupportedAtsProvider[] {
    return Array.from(this.adapters.keys());
  }

  async applyToJob(request: ApplyRequest): Promise<ApplyResult> {
    const detected = detectJobAts(request.jobUrl);

    if (detected.provider === "unknown" || !detected.isApiSupported) {
      logger.warn(`[JobApplierRegistry] No direct API applier for URL: ${request.jobUrl}`);
      return {
        success: false,
        status: "skipped",
        provider: "unknown",
        jobUrl: request.jobUrl,
        reason: `This job platform (${detected.provider}) does not support unauthenticated direct API application. Please apply manually at: ${request.jobUrl}`,
      };
    }

    const adapter = this.adapters.get(detected.provider);
    if (!adapter) {
      return {
        success: false,
        status: "failed",
        provider: detected.provider,
        jobUrl: request.jobUrl,
        reason: `No applier adapter registered for detected provider '${detected.provider}'`,
      };
    }

    return adapter.apply({
      ...request,
      jobId: request.jobId || detected.jobId,
      companyBoard: request.companyBoard || detected.board,
    });
  }
}

export const defaultApplierRegistry = new JobApplierRegistry();
