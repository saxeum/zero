// Adapts the generated schemas to the names the app uses.
//
// Nothing here defines a shape: `openapi.yaml` does, and `npm run codegen` turns it
// into `shared/generated/`. If a field is wrong, the spec is wrong.
import type { Item, NewItem } from "./generated/models.ts";
import { CreateItemBody, CreateItemResponse, ListItemsResponse } from "./generated/api.ts";

export type { Item, NewItem };

/** A `GET /api/items` response. */
export const parseItems = (value: unknown): Item[] => ListItemsResponse.parse(value);

/** A `POST /api/items` response. */
export const parseItem = (value: unknown): Item => CreateItemResponse.parse(value);

/** A `POST /api/items` request body. */
export const parseNewItem = (value: unknown): NewItem => CreateItemBody.parse(value);
