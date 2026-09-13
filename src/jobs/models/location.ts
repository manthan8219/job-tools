import { z } from "zod";

export const LocationTypeSchema = z.enum([
  "global",
  "macro_region",
  "country",
  "state",
  "metro",
  "city",
]);

export type LocationType = z.infer<typeof LocationTypeSchema>;

export const LocationSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  type: LocationTypeSchema,
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  slug: z.string().min(1),
  path: z.string().min(1), // e.g. "world.europe.de.bavaria.munich"
  aliases: z.array(z.string()).default([]),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type Location = z.infer<typeof LocationSchema>;

export const CreateLocationInputSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: LocationTypeSchema,
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  slug: z.string().min(1),
  path: z.string().min(1),
  aliases: z.array(z.string()).default([]),
});

export type CreateLocationInput = z.infer<typeof CreateLocationInputSchema>;
