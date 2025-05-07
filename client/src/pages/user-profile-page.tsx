import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, User as UserIcon, ShieldCheck, BadgeCheck, Crown, ShoppingBag, Facebook, Twitter, Instagram, Globe, Edit } from "lucide-react";
import { User, UserRole, SocialLinks } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

interface OrderStats {
  total: number;
  completed: number;
  cancelled: number;
}

interface TransactionStats {
  purchases: number;
  sales: number;
}

// Кэш для хранения данных пользователей
const userCache = new Map<number, { data: User; timestamp: number }>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 минут

export default function UserProfilePage() {
  const [, params] = useRoute<{ id: string }>("/users/:id");
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [transactionStats, setTransactionStats] = useState<TransactionStats>({ purchases: 0, sales: 0 });
  const previousUserId = useRef<number | null>(null);

  useEffect(() => {
    async function fetchUser() {
      if (!params) return;
      
      try {
        const userId = parseInt(params.id);
        
        // Если ID не изменился, не делаем повторный запрос
        if (previousUserId.current === userId && user) {
          return;
        }
        
        previousUserId.current = userId;
        setIsLoading(true);
        
        // Проверяем, не запрашиваем ли мы профиль текущего пользователя
        if (currentUser && userId === currentUser.id) {
          setUser(currentUser);
          setIsLoading(false);
          return;
        }
        
        // Проверяем кэш
        const cachedUser = userCache.get(userId);
        const now = Date.now();
        
        if (cachedUser && (now - cachedUser.timestamp) < CACHE_EXPIRY) {
          setUser(cachedUser.data);
          setIsLoading(false);
          return;
        }
        
        // Делаем запрос через apiRequest для единообразия
        try {
          const response = await apiRequest("GET", `/api/users/${userId}`);
          
          if (response.ok) {
            const userData = await response.json();
            // Сохраняем в кэш
            userCache.set(userId, { data: userData, timestamp: now });
            setUser(userData);
          } else {
            console.error("Failed to fetch user");
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user:", error);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchUser();
  }, [params, currentUser?.id]);

  useEffect(() => {
    async function fetchOrderStats() {
      if (!params) return;
      
      try {
        const response = await apiRequest("GET", `/api/users/${params.id}/orders/stats`);
        if (response.ok) {
          const stats = await response.json();
          setOrderStats(stats);
        }
      } catch (error) {
        console.error("Error fetching order stats:", error);
      }
    }

    fetchOrderStats();
  }, [params]);

  useEffect(() => {
    async function fetchTransactionStats() {
      if (!params) return;
      
      try {
        const response = await apiRequest("GET", `/api/users/${params.id}/transactions/stats`);
        if (response.ok) {
          const stats = await response.json();
          setTransactionStats(stats);
        }
      } catch (error) {
        console.error("Error fetching transaction stats:", error);
      }
    }

    fetchTransactionStats();
  }, [params]);

  // Функция для отображения роли пользователя
  const getRoleBadge = (role: string) => {
    switch (role) {
      case UserRole.OWNER:
        return <Badge className="bg-purple-500">Владелец Площадки</Badge>;
      case UserRole.SECURITY:
        return <Badge className="bg-purple-500">Служба Безопасности</Badge>;
      case UserRole.ADMIN:
        return <Badge className="bg-red-500">Админ</Badge>;
      case UserRole.HEADADMIN:
        return <Badge className="bg-red-500">Вице-Админ</Badge>;
      case UserRole.MODERATOR:
        return <Badge className="bg-blue-500">Модератор</Badge>;
      case UserRole.SHOP_OWNER:
        return <Badge className="bg-amber-500">Владелец Магазина</Badge>;
      case UserRole.SHOP_MAIN:
        return <Badge className="bg-purple-500">Управляющий Магазина</Badge>;
      case UserRole.SHOP_STAFF:
        return <Badge className="bg-purple-500">Сотрудник Магазина</Badge>;
      default:
        return <Badge variant="outline">Пользователь</Badge>;
    }
  };

  // Функция для проверки, является ли текущий пользователь сотрудником
  const isStaff = currentUser && [
    UserRole.OWNER,
    UserRole.SECURITY,
    UserRole.ADMIN,
    UserRole.HEADADMIN,
    UserRole.MODERATOR
  ].includes(currentUser.role as UserRole);

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Пользователь не найден</h1>
            <p className="text-muted-foreground mb-6">
              Запрашиваемый пользователь не существует или был удален
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>Профиль пользователя</CardTitle>
                {isStaff && (
                  <Link href={`/users/${user.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Редактировать
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Avatar className="h-24 w-24 rounded-lg">
                  <AvatarImage src={user?.avatarUrl || ""} alt={user?.displayName || user?.username} />
                  <AvatarFallback className="rounded-lg">
                    <UserIcon className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{user.displayName || user.username}</h2>
                    {getRoleBadge(user.role)}
                    {user.isPremium && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Crown className="h-3 w-3 text-amber-500" />
                        Premium
                      </Badge>
                    )}
                    {user.isVerified && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <BadgeCheck className="h-3 w-3 text-blue-500" />
                        Проверенный
                      </Badge>
                    )}
                    {user.isBlocked && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        Ban
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-muted-foreground">
                      @{user?.username}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Дата регистрации:</span>{" "}
                      {user?.createdAt && format(new Date(user.createdAt), "dd.MM.yyyy")}
                    </div>
                    {user?.lastLoginAt && (
                      <div>
                        <span className="font-medium">Последний вход:</span>{" "}
                        {format(new Date(user.lastLoginAt), "dd.MM.yyyy HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {user?.isBlocked && (
            <Card className="mt-6 border-destructive">
              <CardContent className="p-4">
                <div className="font-medium text-destructive">Пользователь заблокирован</div>
                {user.blockReason && (
                  <div className="text-destructive">Причина: {user.blockReason}</div>
                )}
                {user.blockExpiresAt && (
                  <div className="text-destructive">
                    Блокировка до: {format(new Date(user.blockExpiresAt), "dd.MM.yyyy HH:mm")}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
} 