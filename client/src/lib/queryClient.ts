import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Пробуем прочитать как JSON
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        throw new Error(`${res.status}: ${errorData.error || errorData.message || res.statusText}`);
      } else {
        // Если не JSON, просто используем текст ответа или статус
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      // Если произошла ошибка при чтении ответа, используем статус
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
  } catch (error) {
    // Перехватываем все неожиданные ошибки (включая ошибки сети)
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Ошибка при ${method} запросе к ${url}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
      
      // Проверяем заголовок Content-Type перед попыткой парсинга JSON
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
    return await res.json();
      } else {
        // Если ответ не в формате JSON, возвращаем текст как есть
        const text = await res.text();
        return text;
      }
    } catch (error) {
      // Перехватываем все ошибки
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ошибка при запросе к ${queryKey[0]}`);
    }
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
