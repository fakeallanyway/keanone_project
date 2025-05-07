import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Package, Edit, Plus, MoreHorizontal, Store } from "lucide-react";
import { Link } from "wouter";
import { Product, Shop } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Расширяем тип Product для включения рейтинга, который может быть получен с сервера
interface ProductWithRating extends Product {
  rating?: number;
}

export default function ManageProductsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<string>("all");
  
  // Получаем список магазинов пользователя
  const { data: shops, isLoading: isShopsLoading } = useQuery<Shop[]>({
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

  // Получаем список товаров
  const { data: products, isLoading: isProductsLoading } = useQuery<ProductWithRating[]>({
    queryKey: ["products", user?.id, selectedShop, searchQuery],
    queryFn: async () => {
      let url = `/api/products?`;
      
      // Добавляем параметр владельца
      if (user?.id) {
        url += `ownerId=${user.id}`;
      }
      
      // Добавляем параметр магазина, если выбран конкретный магазин
      if (selectedShop !== "all") {
        url += `&shopId=${selectedShop}`;
      }
      
      // Добавляем параметр поиска
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Не удалось загрузить товары");
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Функция для форматирования цены
  const formatPrice = (price: string) => {
    if (!price) return "Не указана";
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) return "Не указана";
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(numericPrice);
  };

  const isLoading = isShopsLoading || isProductsLoading;

  return (
    <div className="flex h-screen">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Управление товарами</h1>
              <p className="text-muted-foreground">Управляйте всеми товарами в ваших магазинах</p>
            </div>
            <div className="flex gap-2">
              {shops && shops.length > 0 && (
                <Button asChild>
                  <Link href={`/shops/${selectedShop !== "all" ? selectedShop : shops[0].id}/products/create`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить товар
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск товаров..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Select
                value={selectedShop}
                onValueChange={setSelectedShop}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите магазин" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все магазины</SelectItem>
                  {shops?.map(shop => (
                    <SelectItem key={shop.id} value={shop.id.toString()}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader className="px-6 py-4">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium">
                <div className="col-span-4">Название</div>
                <div className="col-span-2">Магазин</div>
                <div className="col-span-2">Цена</div>
                <div className="col-span-2">Количество</div>
                <div className="col-span-1">Рейтинг</div>
                <div className="col-span-1">Действия</div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : products && products.length > 0 ? (
                <div className="divide-y">
                  {products.map((product: ProductWithRating) => {
                    const shop = shops?.find(s => s.id === product.shopId);
                    
                    return (
                      <div key={product.id} className="grid grid-cols-12 gap-4 items-center px-6 py-4">
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {product.avatarUrl ? (
                              <img
                                src={product.avatarUrl}
                                alt={product.name}
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                              {product.name}
                            </Link>
                            <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                              {product.description || "Нет описания"}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-2">
                          {shop ? (
                            <Link href={`/shops/${shop.id}`} className="flex items-center gap-2 hover:underline">
                              <Store className="h-4 w-4" />
                              <span>{shop.name}</span>
                            </Link>
                          ) : (
                            "Неизвестный магазин"
                          )}
                        </div>
                        <div className="col-span-2 font-medium dark:text-white text-black">
                          {formatPrice(product.price)}
                        </div>
                        <div className="col-span-2">
                          <Badge variant={(product.quantity && product.quantity > 0) ? "outline" : "destructive"}>
                            {(product.quantity && product.quantity > 0) ? `В наличии: ${product.quantity}` : "Нет в наличии"}
                          </Badge>
                        </div>
                        <div className="col-span-1 flex items-center">
                          {product.rating !== undefined ? (
                            <>
                              <span className="mr-1">{product.rating.toFixed(1)}</span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-4 h-4 text-yellow-500"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </>
                          ) : (
                            "Нет"
                          )}
                        </div>
                        <div className="col-span-1">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/products/${product.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery 
                    ? "Товары не найдены" 
                    : selectedShop !== "all" 
                      ? "В этом магазине пока нет товаров" 
                      : "У вас пока нет товаров"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 