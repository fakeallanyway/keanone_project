import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Store, Edit, Plus, MoreHorizontal } from "lucide-react";
import { Link } from "wouter";
import { Shop, ShopStatus, User } from "@shared/schema";

export default function ManageShopsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [shopOwners, setShopOwners] = useState<Record<number, string>>({});
  
  // Получаем список магазинов пользователя
  const { data: shops, isLoading } = useQuery<Shop[]>({
    queryKey: ["shops", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/shops?ownerId=${user?.id}`);
      if (!response.ok) {
        throw new Error("Не удалось загрузить магазины");
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Получаем список всех пользователей для отображения владельцев магазинов
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Не удалось загрузить пользователей");
      }
      return response.json();
    },
    enabled: !!user && (user.role === "OWNER" || user.role === "SECURITY" || user.role === "ADMIN" || user.role === "HEADADMIN"),
  });

  // Создаем словарь владельцев магазинов
  useEffect(() => {
    if (users && shops) {
      const ownersMap: Record<number, string> = {};
      shops.forEach(shop => {
        if (shop.ownerId) {
          const owner = users.find(u => u.id === shop.ownerId);
          ownersMap[shop.ownerId] = owner ? (owner.displayName || owner.username) : "Не указан";
        }
      });
      setShopOwners(ownersMap);
    }
  }, [users, shops]);

  // Фильтрация магазинов по поисковому запросу
  const filteredShops = shops?.filter(shop => 
    shop.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Функция для отображения статуса магазина
  const getStatusBadge = (status: string) => {
    switch (status) {
      case ShopStatus.ACTIVE:
        return <Badge className="bg-green-500">Активен</Badge>;
      case ShopStatus.PENDING:
        return <Badge variant="outline">На проверке</Badge>;
      case ShopStatus.BLOCKED:
        return <Badge variant="destructive">Заблокирован</Badge>;
      default:
        return <Badge variant="secondary">Неизвестно</Badge>;
    }
  };

  // Функция для получения имени владельца магазина
  const getOwnerName = (ownerId: number | null) => {
    if (!ownerId) return "Не указан";
    return shopOwners[ownerId] || "Не указан";
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Управление магазинами</h1>
              <p className="text-muted-foreground">Управляйте всеми магазинами на платформе</p>
            </div>
            <Button asChild>
              <Link href="/create-shop">
                <Plus className="mr-2 h-4 w-4" />
                Создать магазин
              </Link>
            </Button>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск магазинов..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardHeader className="px-6 py-4">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium">
                <div className="col-span-4">Название</div>
                <div className="col-span-2">Владелец</div>
                <div className="col-span-2">Статус</div>
                <div className="col-span-2">Товары</div>
                <div className="col-span-1">Сделки</div>
                <div className="col-span-1">Действия</div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredShops && filteredShops.length > 0 ? (
                <div className="divide-y">
                  {filteredShops.map((shop) => (
                    <div key={shop.id} className="grid grid-cols-12 gap-4 items-center px-6 py-4">
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {shop.avatarUrl ? (
                            <img
                              src={shop.avatarUrl}
                              alt={shop.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <Store className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div>
                          <Link href={`/shops/${shop.id}`} className="font-medium hover:underline">
                            {shop.name}
                          </Link>
                          <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                            {shop.description || "Нет описания"}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        {getOwnerName(shop.ownerId)}
                      </div>
                      <div className="col-span-2">
                        {getStatusBadge(shop.status)}
                      </div>
                      <div className="col-span-2">
                        {0}
                      </div>
                      <div className="col-span-1">
                        {shop.transactionsCount || 0}
                      </div>
                      <div className="col-span-1">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/shops/${shop.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Магазины не найдены" : "У вас пока нет магазинов"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 