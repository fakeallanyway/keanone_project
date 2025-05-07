import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, ShieldCheck, Star, Store, Edit, Plus, Package, AlertTriangle, Users, MessageCircle } from "lucide-react";
import { Shop, Product, ShopStatus, User, UserRole } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ShopPage() {
  const [, params] = useRoute<{ id: string }>("/shops/:id");
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  if (!params) return null;
  const shopId = parseInt(params.id);

  // Получаем информацию о магазине
  const { data: shop, isLoading: isShopLoading } = useQuery<Shop>({
    queryKey: [`/api/shops/${shopId}`],
    queryFn: async () => {
      const response = await fetch(`/api/shops/${shopId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shop");
      }
      return response.json();
    },
  });

  // Получаем информацию о владельце магазина
  const { data: owner } = useQuery<User>({
    queryKey: [`/api/users/${shop?.ownerId}`],
    queryFn: async () => {
      const response = await fetch(`/api/users/${shop?.ownerId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shop owner");
      }
      return response.json();
    },
    enabled: !!shop?.ownerId,
  });

  // Получаем товары магазина
  const { data: products, isLoading: isProductsLoading } = useQuery<Product[]>({
    queryKey: [`/api/shops/${shopId}/products`, searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/shops/${shopId}/products?search=${encodeURIComponent(searchQuery)}` 
        : `/api/shops/${shopId}/products`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      return response.json();
    },
  });

  // Проверяем, является ли текущий пользователь владельцем магазина
  const isShopOwner = user && shop && user.id === shop.ownerId;
  
  // Проверяем, является ли пользователь администратором
  const isAdmin = user && (
    user.role === UserRole.OWNER ||
    user.role === UserRole.SECURITY ||
    user.role === UserRole.HEADADMIN ||
    user.role === UserRole.ADMIN
  );

  // Может ли пользователь управлять магазином
  const canManageShop = isAdmin || isShopOwner;

  // Может ли пользователь просматривать сотрудников
  const canViewStaff = user && (
    user.role === UserRole.OWNER || 
    user.role === UserRole.SECURITY || 
    user.role === UserRole.ADMIN || 
    user.role === UserRole.HEADADMIN || 
    user.role === UserRole.SHOP_OWNER || 
    user.role === UserRole.SHOP_MAIN || 
    user.role === UserRole.SHOP_STAFF
  );

  // Статус магазина
  const getStatusBadge = (status: string) => {
    switch (status) {
      case ShopStatus.ACTIVE:
        return <Badge variant="default" className="bg-green-100 text-green-800">Активен</Badge>;
      case ShopStatus.BLOCKED:
        return <Badge variant="destructive">Заблокирован</Badge>;
      case ShopStatus.PENDING:
        return <Badge variant="outline">На проверке</Badge>;
      default:
        return null;
    }
  };

  // Добавим функцию для создания чата
  const { toast } = useToast();
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleCreateChat = async () => {
    if (!user) return;
    
    try {
      setIsChatLoading(true);
      const response = await fetch(`/api/shops/${shopId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Не удалось создать чат');
      }
      
      const chatData = await response.json();
      setIsChatLoading(false);
      
      // Перенаправляем на страницу чата
      window.location.href = `/chats/${chatData.id}`;
    } catch (error) {
      setIsChatLoading(false);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать чат с магазином',
        variant: 'destructive'
      });
      console.error(error);
    }
  };

  if (isShopLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Магазин не найден</h1>
            <p className="text-muted-foreground mb-6">
              Запрашиваемый магазин не существует или был удален
            </p>
            <Button asChild>
              <Link href="/">Вернуться на главную</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Шапка магазина */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Avatar className="h-24 w-24 rounded-lg">
                  <AvatarImage src={shop.avatarUrl || ""} alt={shop.name} />
                  <AvatarFallback className="rounded-lg">
                    <Store className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold">{shop.name}</h1>
                    {shop.isVerified && (
                      <div className="bg-primary rounded-full p-[3px]">
                        <ShieldCheck className="h-5 w-5 text-white" />
                      </div>
                    )}
                    {getStatusBadge(shop.status)}
                  </div>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center">
                      <Star className="h-5 w-5 text-yellow-500 mr-1" />
                      <span className="font-medium">{shop.rating || 0}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Сделок: {shop.transactionsCount || 0}
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-4">
                    {shop.description || "Нет описания"}
                  </p>
                  
                  <div className="grid gap-3 mt-4 md:flex md:items-center">
                    {canManageShop && (
                      <Button asChild variant="outline">
                        <Link href={`/shops/${shop.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Редактировать
                        </Link>
                      </Button>
                    )}
                    
                    {canViewStaff && (
                      <Button asChild variant="outline">
                        <Link href={`/shops/${shop.id}/staff`}>
                          <Users className="mr-2 h-4 w-4" />
                          Сотрудники
                        </Link>
                      </Button>
                    )}
                    
                    {canManageShop && (
                      <Button asChild variant="outline">
                        <Link href={`/shops/${shop.id}/products/create`}>
                          <Plus className="mr-2 h-4 w-4" />
                          Добавить товар
                        </Link>
                      </Button>
                    )}
                    
                    {/* Кнопка чата с магазином */}
                    {user && !isShopOwner && shop.status === ShopStatus.ACTIVE && (
                      <Button 
                        variant="default" 
                        onClick={handleCreateChat}
                        disabled={isChatLoading}
                      >
                        {isChatLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="mr-2 h-4 w-4" />
                        )}
                        Связаться с магазином
                      </Button>
                    )}

                    {shop.status === ShopStatus.BLOCKED && (
                      <div className="inline-flex items-center border p-2 rounded-md bg-destructive/10 text-destructive">
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Магазин заблокирован: {shop.blockReason || "Нарушение правил"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Вкладки с товарами и информацией */}
          <Tabs defaultValue="products">
            <TabsList className="mb-6">
              <TabsTrigger value="products">Товары</TabsTrigger>
              <TabsTrigger value="info">Информация</TabsTrigger>
            </TabsList>
            
            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Товары магазина</CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Поиск товаров..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  {shop.status === ShopStatus.BLOCKED && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <Card className="w-4/5 max-w-md border-destructive">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Магазин заблокирован
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground">
                            Причина блокировки: <span className="font-medium">{shop.blockReason || "Не указана"}</span>
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  {isProductsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : products && products.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {products.map((product) => (
                        <Link key={product.id} href={`/products/${product.id}`}>
                          <Card className="cursor-pointer hover:bg-secondary/50 transition-colors h-full">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3 mb-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={product.avatarUrl || ""} alt={product.name} />
                                  <AvatarFallback>
                                    <Package className="h-6 w-6" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold truncate">{product.name}</h3>
                                  <div className="font-medium dark:text-white text-black">
                                    {parseFloat(product.price).toLocaleString("ru-RU")} ₽
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {product.description || "Нет описания"}
                              </p>
                            </CardContent>
                            <CardFooter className="p-4 pt-0 flex justify-between text-sm text-muted-foreground">
                              <span>Кол-во: {product.quantity || 0}</span>
                            </CardFooter>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Товары не найдены" : "В магазине пока нет товаров"}
                      {canManageShop && (
                        <div className="mt-4">
                          <Button asChild>
                            <Link href={`/shops/${shop.id}/products/create`}>
                              <Plus className="h-4 w-4 mr-2" />
                              Добавить товар
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Информация о магазине</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">Дата создания</h3>
                    <p className="text-muted-foreground">
                      {new Date(shop.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-1">Владелец</h3>
                    <p className="text-muted-foreground">
                      {owner ? (owner.displayName || owner.username) : "Загрузка..."}
                    </p>
                  </div>
                  
                  {shop.status === ShopStatus.BLOCKED && shop.blockReason && (
                    <div>
                      <h3 className="font-medium mb-1 text-destructive">Причина блокировки</h3>
                      <p className="text-muted-foreground">{shop.blockReason}</p>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-medium mb-1">Статистика</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex justify-between">
                        <span>Рейтинг:</span>
                        <span className="font-medium">{shop.rating || 0}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Количество сделок:</span>
                        <span className="font-medium">{shop.transactionsCount || 0}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Статус верификации:</span>
                        <span className="font-medium">{shop.isVerified ? "Верифицирован" : "Не верифицирован"}</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
} 