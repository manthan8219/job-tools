import { z } from "zod";

export const AuditFieldsSchema = z.object({
  createdAt: z.date().optional().default(() => new Date()),
  updatedAt: z.date().optional().default(() => new Date()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  deletedAt: z.date().optional(),
  deletedBy: z.string().optional(),
});

export type AuditFields = z.infer<typeof AuditFieldsSchema>;
