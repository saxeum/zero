import * as z from "zod/mini";

export const ItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export type Item = z.infer<typeof ItemSchema>;

/** Runtime check at the trust boundary: anything off-shape throws. */
export const parseItem = (value: unknown): Item => z.parse(ItemSchema, value);

export const parseItems = (value: unknown): Item[] =>
  z.parse(z.array(ItemSchema), value);
