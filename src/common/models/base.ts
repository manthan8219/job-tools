import { z } from "zod";
import { AuditFieldsSchema } from "./audit.js";

export const BaseEntitySchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string(), // The user this entity belongs to
}).merge(AuditFieldsSchema);

export type BaseEntity = z.infer<typeof BaseEntitySchema>;
