import createClient from "openapi-fetch";
import type { paths } from "@shieldpass/shared/api";

const baseUrl = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/v1";

export const api = createClient<paths>({ baseUrl });

export type Api = typeof api;
