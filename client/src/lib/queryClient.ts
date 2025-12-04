import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";

// Store for master view partner ID - set by MasterViewContext
let masterViewPartnerId: string | null = null;

export function setMasterViewPartnerId(partnerId: string | null) {
  masterViewPartnerId = partnerId;
}

export function getMasterViewPartnerId(): string | null {
  return masterViewPartnerId;
}

// Helper to append viewingPartnerId to URLs for master view
function appendMasterViewParam(url: string): string {
  if (!masterViewPartnerId) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}viewingPartnerId=${encodeURIComponent(masterViewPartnerId)}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Add auth header if user is authenticated
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  
  // Add content type for requests with data
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  // Append master view partner ID to URL if set
  const finalUrl = appendMasterViewParam(url);

  const res = await fetch(finalUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    // Add auth header if user is authenticated
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }

    // Build URL from query key and append master view parameter
    const baseUrl = queryKey.join("/") as string;
    const url = appendMasterViewParam(baseUrl);

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
