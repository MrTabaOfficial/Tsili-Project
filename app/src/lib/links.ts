import { API_URL } from "../api/client";

/** The web page people tap in a chat; it hands off to the app. Served by the API server. */
export function inviteLink(code: string): string {
  return `${API_URL}/i/${code}`;
}
