import { ApplyRequest, ApplyResult, JobApplierAdapter, SupportedAtsProvider } from "./types.js";
import { logger } from "../utils/index.js";

export abstract class BaseJobApplierAdapter implements JobApplierAdapter {
  abstract readonly name: string;
  abstract readonly provider: SupportedAtsProvider;

  abstract matches(jobUrl: string): boolean;

  async apply(request: ApplyRequest): Promise<ApplyResult> {
    logger.info(`[${this.name}] Initiating application to ${request.jobUrl}`);
    try {
      const result = await this.executeApply(request);
      logger.info(`[${this.name}] Application finished with status: ${result.status}`);
      return result;
    } catch (err: any) {
      logger.error(`[${this.name}] Application failed: ${err.message}`);
      return {
        success: false,
        status: "failed",
        provider: this.provider,
        jobUrl: request.jobUrl,
        reason: err.message || String(err),
        submittedAt: new Date(),
      };
    }
  }

  protected abstract executeApply(request: ApplyRequest): Promise<ApplyResult>;
}
