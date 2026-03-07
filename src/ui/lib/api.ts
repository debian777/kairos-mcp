const API_BASE = "";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "same-origin",
  });
}
