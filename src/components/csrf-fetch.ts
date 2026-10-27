"use client";

let cachedToken: string | null = null;

export async function csrfFetch(input: string, init: RequestInit = {}) {
  const csrfResponse = await fetch("/api/csrf", { cache: "no-store", credentials: "same-origin" });
  if (!csrfResponse.ok) throw new Error("Could not initialize a secure request.");
  cachedToken = ((await csrfResponse.json()) as { csrfToken: string }).csrfToken;
  return fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      "X-CSRF-Token": cachedToken,
    },
  });
}

export async function responseMessage(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string } | null;
  return body?.message ?? "The request could not be completed.";
}
