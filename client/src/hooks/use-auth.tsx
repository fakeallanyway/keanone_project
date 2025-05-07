import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser, UserRole } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginData = {
  username: string;
  password: string;
};

type AuthContextType = {
  user: (SelectUser & { shopId?: number; shopName?: string }) | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [userWithShop, setUserWithShop] = useState<(SelectUser & { shopId?: number; shopName?: string }) | null>(null);
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Получаем информацию о магазине пользователя, если у него есть роль связанная с магазином
  const { data: shop } = useQuery({
    queryKey: ["/api/user/shop"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/shop");
      return res.json();
    },
    enabled: !!user && [
      UserRole.SHOP_OWNER, 
      UserRole.SHOP_MAIN, 
      UserRole.SHOP_STAFF
    ].includes(user.role as UserRole),
  });

  // Объединяем данные пользователя и его магазина
  useEffect(() => {
    if (user) {
      if ([UserRole.SHOP_OWNER, UserRole.SHOP_MAIN, UserRole.SHOP_STAFF].includes(user.role as UserRole) && shop) {
        setUserWithShop({ 
          ...user, 
          shopId: shop.id,
          shopName: shop.name 
        });
      } else {
        setUserWithShop(user);
      }
    } else {
      setUserWithShop(null);
    }
  }, [user, shop]);

  useEffect(() => {
    if (user && user.role === UserRole.OWNER) {
      if (!user.isPremium || !user.isVerified) {
        const updatedUser = {
          ...user,
          isPremium: true,
          isVerified: true
        };
        
        queryClient.setQueryData(["/api/user"], updatedUser);
        
        apiRequest("PATCH", "/api/user/status", {
          isPremium: true,
          isVerified: true
        }).catch(error => {
          console.error("Ошибка при обновлении статуса пользователя:", error);
        });
      }
    }
  }, [user]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Автоматически устанавливаем Premium и Verified статусы для OWNER, SECURITY и ADMIN
      if ([UserRole.OWNER, UserRole.SECURITY, UserRole.ADMIN].includes(user.role as UserRole)) {
        const updatedUser = {
          ...user,
          isPremium: true,
          isVerified: true
        };
        
        // Обновляем статус на сервере
        apiRequest("PATCH", "/api/user/status", {
          isPremium: true,
          isVerified: true
        }).catch(error => {
          console.error("Ошибка при обновлении статуса пользователя:", error);
        });
        
        return updatedUser;
      }
      if (user.role === UserRole.OWNER) {
        const updatedUser = {
          ...user,
          isPremium: true,
          isVerified: true
        };
        queryClient.setQueryData(["/api/user"], updatedUser);
      } else {
        queryClient.setQueryData(["/api/user"], user);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      try {
      const res = await apiRequest("POST", "/api/register", credentials);
        
        // Проверяем заголовок Content-Type
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
      return await res.json();
        } else {
          // Если ответ не в формате JSON, обрабатываем как ошибку
          const text = await res.text();
          throw new Error(text.substring(0, 100) || "Неверный формат ответа от сервера");
        }
      } catch (error) {
        // Перехватываем все ошибки и передаем их выше
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Произошла ошибка при регистрации");
      }
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Регистрация успешна",
        description: "Вы успешно зарегистрировались в системе",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: userWithShop,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
