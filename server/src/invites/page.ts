import { Router } from "express";
import { inviteCodeSchema } from "@tsili/shared";
import { HttpError } from "../errors.js";

export const APP_SCHEME = "tsili";

/**
 * A plain web page for an invite link. Messengers make http links tappable but not custom schemes,
 * so this page is what people open; its button hands off to the app. It deliberately reads nothing
 * from the database: the code is the only secret, and the app verifies it when joining.
 */
export function invitePageRouter(): Router {
  const router = Router();
  router.get("/i/:code", (req, res) => {
    const parsed = inviteCodeSchema.safeParse(String(req.params.code).toUpperCase());
    if (!parsed.success) throw new HttpError(404, "INVITE_NOT_FOUND", "no group with this invite code");
    res.type("html").send(renderInvitePage(parsed.data));
  });
  return router;
}

export function inviteDeepLink(code: string): string {
  return `${APP_SCHEME}://join?code=${encodeURIComponent(code)}`;
}

function renderInvitePage(code: string): string {
  const deepLink = inviteDeepLink(code);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Join a group in Tsili</title>
<style>
  :root { color-scheme: light dark; --bg: #F2F4F7; --fg: #171A21; --muted: #667085; --accent: #7A1F3F; --card: #FFFFFF; --border: #DDE2EA; }
  @media (prefers-color-scheme: dark) { :root { --bg: #121318; --fg: #F3F4F6; --muted: #98A2B3; --accent: #8E2A4E; --card: #1B1D24; --border: #2C303A; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; box-sizing: border-box; }
  main { width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px 24px; display: grid; gap: 16px; text-align: center; }
  h1 { font-size: 20px; margin: 0; }
  .code { font-size: 36px; font-weight: 800; letter-spacing: 6px; color: var(--accent); font-variant-numeric: tabular-nums; user-select: all; }
  a.button { display: block; background: var(--accent); color: #fff; text-decoration: none; font-weight: 600; padding: 14px; border-radius: 999px; }
  p { margin: 0; color: var(--muted); font-size: 15px; }
</style>
</head>
<body>
<main>
  <h1>You're invited to a group in Tsili</h1>
  <div class="code">${code}</div>
  <a class="button" href="${deepLink}">Open in Tsili</a>
  <p>If nothing opens, install Tsili, choose “Join with code”, and enter the code above.</p>
</main>
</body>
</html>
`;
}
