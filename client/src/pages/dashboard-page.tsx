import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Shop, users } from "@shared/schema";

import { StatsCard } from "@/components/layout/stats-card";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, Search, Star, Store, ShieldCheck, Lock, Users, MessageSquare, Shield, Settings } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: shops, isLoading: isShopsLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops", searchQuery],
    queryFn: async () => {
      const url = searchQuery 
        ? `/api/shops?search=${encodeURIComponent(searchQuery)}` 
        : "/api/shops";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch shops");
      }
      return response.json();
    },
  });

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">Предложения</CardTitle>
          </CardHeader>
          <CardContent>
            {/* я потом сделаю таблицу с топ продавцами */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Link href="/users">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Топ продаж</h3>
                        <p className="text-sm text-muted-foreground">Лидеры продаж!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/shops/new">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Новые магазины</h3>
                        <p className="text-sm text-muted-foreground">Недавно открытые!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/shops/verified">
                <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Проверенные продавцы</h3>
                        <p className="text-sm text-muted-foreground">Надежные партнеры!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </CardContent>
          <CardHeader>
            <CardTitle className="text-2xl">Список магазинов</CardTitle>
            <p className="text-muted-foreground">Список всех магазинов на платформе</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
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

            {isShopsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : shops && shops.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shops.map((shop) => (
                  <Link key={shop.id} href={`/shops/${shop.id}`}>
                    <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={shop.avatarUrl || ""} alt={shop.name} />
                            <AvatarFallback>{shop.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h3 className="font-semibold truncate">{shop.name}</h3>
                              {shop.isVerified && (
                                <ShieldCheck className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                            <div className="flex items-center text-muted-foreground text-sm">
                              <Star className="h-3 w-3 mr-1 text-yellow-500" />
                              <span>{shop.rating || 0}</span>
                            </div>
                          </div>
                          {shop.status === "BLOCKED" && (
                            <Badge variant="destructive">Заблокирован</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {shop.description || "Нет описания"}
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between text-sm text-muted-foreground">
                        <span>Сделок: {shop.transactionsCount || 0}</span>
                        <span>
                          {format(new Date(shop.createdAt), "dd.MM.yyyy")}
                        </span>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Магазины не найдены" : "Нет доступных магазинов"}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
