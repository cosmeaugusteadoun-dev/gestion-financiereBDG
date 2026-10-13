import { createWhatsAppHandler } from "./handler.mjs";

Deno.serve(createWhatsAppHandler({
  env: (name: string) => Deno.env.get(name),
  fetch: globalThis.fetch,
  crypto: globalThis.crypto,
}));
