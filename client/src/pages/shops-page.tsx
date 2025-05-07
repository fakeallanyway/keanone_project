import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Store, Star, Clock, ShoppingBag, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Shop {
  id: number;
  name: string;
  description: string;
  logo?: string;
  rating: number;
  reviewsCount: number;
  isVerified: boolean;
  isPromoted: boolean;
  isNew: boolean;
  dealCount: number;
  categories: string[];
  createdAt: string;
}

export default function ShopsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  
  // Получаем список магазинов
  const { data: shops, isLoading: isShopsLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
    queryFn: async () => {
      const response = await fetch("/api/shops");
      if (!response.ok) {
        throw new Error("Failed to fetch shops");
      }
      return response.json();
    },
  });
  
  // Если данные загружаются, показываем индикатор загрузки
  if (isShopsLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Фильтрация магазинов
  const filteredShops = shops?.filter(shop => {
    // Поиск по названию или описанию
    const matchesQuery = 
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Фильтр по категории
    const matchesCategory = !filterCategory || shop.categories.includes(filterCategory);
    
    return matchesQuery && matchesCategory;
  }) || [];

  // Получение уникальных категорий для фильтрации
  const categories = shops?.flatMap(shop => shop.categories)
    .filter((category, index, self) => self.indexOf(category) === index) || [];
  
  return (
    <div className="max-w-6xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6">Магазины</h1>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Поиск и фильтры */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:max-w-md">
            <Input
              type="text"
              placeholder="Поиск магазинов..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          
          <div className="flex gap-2 overflow-x-auto">
            <Button 
              variant={!filterCategory ? "default" : "outline"} 
              onClick={() => setFilterCategory(null)}
            >
              Все
            </Button>
            
            {categories.map(category => (
              <Button 
                key={category}
                variant={filterCategory === category ? "default" : "outline"}
                onClick={() => setFilterCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Список магазинов */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShops.map((shop) => (
            <Link key={shop.id} href={`/shops/${shop.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                {/* Верхняя плашка с определением типа магазина */}
                {(shop.isPromoted || shop.isNew) && (
                  <div className={`py-1 px-3 text-xs font-medium text-center text-white ${shop.isPromoted ? 'bg-amber-600' : 'bg-blue-600'} rounded-t-lg`}>
                    {shop.isPromoted && "Топ продаж"}
                    {shop.isNew && !shop.isPromoted && "Новый магазин"}
                  </div>
                )}
                
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="h-12 w-12 rounded-md">
                      <AvatarFallback className="rounded-md">
                        {shop.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                      {shop.logo && (
                        <AvatarImage src={shop.logo} alt={shop.name} />
                      )}
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <h2 className="font-bold">{shop.name}</h2>
                        {shop.isVerified && (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {shop.description}
                      </p>
                      
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <span className="text-sm">{shop.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({shop.reviewsCount} отзывов)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {shop.categories.map((category) => (
                      <Badge key={category} variant="outline" className="bg-accent/50">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-3 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ShoppingBag className="h-4 w-4" />
                      <span>Сделок: {shop.dealCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>C {new Date(shop.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        
        {/* Если магазинов не найдено */}
        {filteredShops.length === 0 && (
          <Card>
            <CardContent className="text-center p-12">
              <Store className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <h2 className="text-xl font-semibold mb-2">Магазины не найдены</h2>
              <p className="text-muted-foreground mb-6">
                Попробуйте изменить параметры поиска или фильтрации
              </p>
              <Button onClick={() => {
                setSearchQuery("");
                setFilterCategory(null);
              }}>
                Сбросить фильтры
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 