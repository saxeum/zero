import * as z from "zod/mini";

const ItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export type Item = z.infer<typeof ItemSchema>;

/** Runtime check at the trust boundary: anything off-shape throws. */
export const parseItem = (value: unknown): Item => ItemSchema.parse(value);

export const parseItems = (value: unknown): Item[] => z.array(ItemSchema).parse(value);

/** Request body for POST /api/items. Unknown keys are rejected, not silently dropped. */
const NewItemSchema = z.strictObject({ text: z.string() });

export const parseNewItem = (value: unknown): { text: string } => NewItemSchema.parse(value);
