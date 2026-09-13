import { z } from "zod";

export const CronTaskStatusSchema = z.enum(["idle", "running", "success", "failed"]);
export type CronTaskStatus = z.infer<typeof CronTaskStatusSchema>;

export const CronTaskResultSchema = z.object({
  taskName: z.string(),
  startedAt: z.date(),
  completedAt: z.date(),
  status: CronTaskStatusSchema,
  message: z.string().optional(),
  itemsProcessed: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
});
export type CronTaskResult = z.infer<typeof CronTaskResultSchema>;

export interface CronTask {
  readonly name: string;
  readonly intervalMs: number;
  readonly enabled: boolean;
  execute(): Promise<CronTaskResult>;
}
