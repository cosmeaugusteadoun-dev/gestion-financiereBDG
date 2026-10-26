import webpush from "npm:web-push@3.6.7";
import { createPushHandler } from "./core.mjs";
Deno.serve(createPushHandler({
  env: (name: string) => Deno.env.get(name),
  fetch: globalThis.fetch,
  crypto: globalThis.crypto,
  sendPush: (subscription: object, payload: string, ttl: number) => webpush.sendNotification(subscription, payload, {
    TTL: ttl, urgency: "normal", topic: "bdj-anniversaires",
    timeout: 15000, vapidDetails: {
      subject: Deno.env.get("PUSH_VAPID_SUBJECT")!,
      publicKey: Deno.env.get("PUSH_VAPID_PUBLIC_KEY")!,
      privateKey: Deno.env.get("PUSH_VAPID_PRIVATE_KEY")!,
    },
  }),
}));
