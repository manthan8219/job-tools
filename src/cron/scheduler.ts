import { CronTask, CronTaskResult } from "./types.js";
import { logger } from "../utils/index.js";

export class CronScheduler {
  private tasks: Map<string, CronTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  /**
   * Register a cron task with the scheduler
   */
  registerTask(task: CronTask): void {
    if (this.tasks.has(task.name)) {
      logger.warn(`[CronScheduler] Task '${task.name}' is already registered. Overwriting.`);
    }
    this.tasks.set(task.name, task);
    logger.info(`[CronScheduler] Registered task '${task.name}' with interval ${task.intervalMs}ms`);

    // If scheduler is already running, schedule this task immediately
    if (this.isRunning && task.enabled) {
      this.scheduleTask(task);
    }
  }

  /**
   * Start all registered and enabled cron tasks
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("[CronScheduler] Scheduler is already running.");
      return;
    }

    this.isRunning = true;
    logger.info("[CronScheduler] Starting cron scheduler...");

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  /**
   * Stop all active cron tasks
   */
  stop(): void {
    logger.info("[CronScheduler] Stopping cron scheduler...");
    for (const [name, timer] of this.timers.entries()) {
      clearInterval(timer);
      logger.info(`[CronScheduler] Cleared timer for task '${name}'`);
    }
    this.timers.clear();
    this.isRunning = false;
  }

  /**
   * Manually trigger a specific task on demand
   */
  async runTaskNow(taskName: string): Promise<CronTaskResult> {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`[CronScheduler] Task '${taskName}' not found`);
    }

    logger.info(`[CronScheduler] Manually triggering task '${taskName}'`);
    return await task.execute();
  }

  private scheduleTask(task: CronTask): void {
    if (this.timers.has(task.name)) {
      clearInterval(this.timers.get(task.name)!);
    }

    const timer = setInterval(async () => {
      try {
        await task.execute();
      } catch (err: any) {
        logger.error(`[CronScheduler] Unhandled error during execution of '${task.name}': ${err?.message || err}`);
      }
    }, task.intervalMs);

    this.timers.set(task.name, timer);
  }
}

export const cronScheduler = new CronScheduler();
