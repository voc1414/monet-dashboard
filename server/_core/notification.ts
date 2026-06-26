import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Owner notification.
 *
 * The original implementation dispatched through the Manus Forge notification
 * service. That dependency has been removed (B-1). This is now a no-op that only
 * logs to the server console and returns `true`.
 *
 * NOTE: real delivery (email / LINE / Notion) for new-store detection and data
 * gaps is intentionally deferred to a later phase. Railway console logs are not
 * visible to the operator, so the business notification function is currently
 * inert by design.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  if (!isNonEmptyString(payload.title) || !isNonEmptyString(payload.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title and content are required.",
    });
  }

  console.log(
    `[Notification:no-op] ${payload.title.trim()}\n${payload.content.trim()}`
  );
  return true;
}
