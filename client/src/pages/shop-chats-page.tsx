import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, 
  MessageCircle, 
  Store, 
  Calendar, 
  Search, 
  UserIcon, 
  Clock, 
  MessagesSquare, 
  Filter,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShopChat, Shop } from "@shared/schema";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { isShopStaff } from "@/lib/role-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShopChatWithUser = ShopChat & { 
  userName: string;
  lastMessage: string | null;
  shopName?: string;
};

export default function ShopChatsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string>("all");
  const [allChats, setAllChats] = useState<ShopChatWithUser[]>([]);
  
  // Получаем все магазины, в которых пользователь является сотрудником
  const { data: shops, isLoading: isShopsLoading } = useQuery<Shop[]>({
    queryKey: ["shops", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/shops?ownerId=${user!.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shops");
      }
      return response.json();
    },
    enabled: !!user,
  });
  
  // Загружаем чаты для всех магазинов пользователя
  const { data: chatsData, isLoading: isChatsLoading, refetch: refetchChats } = useQuery<{
    shopId: number;
    chats: ShopChatWithUser[];
  }[]>({
    queryKey: ["shop-chats", user?.id],
    queryFn: async () => {
      if (!shops || shops.length === 0) return [];
      
      // Загружаем чаты из всех магазинов пользователя
      const chatsPromises = shops.map(async (shop) => {
        try {
          const response = await fetch(`/api/shops/${shop.id}/chats`);
          if (!response.ok) {
            console.error(`Failed to fetch chats for shop ${shop.id}`);
            return { shopId: shop.id, chats: [] };
          }
          const chats = await response.json();
          // Добавляем название магазина к каждому чату
          const chatsWithShopName = chats.map((chat: ShopChatWithUser) => ({
            ...chat,
            shopName: shop.name
          }));
          return { shopId: shop.id, chats: chatsWithShopName };
        } catch (error) {
          console.error(`Error fetching chats for shop ${shop.id}:`, error);
          return { shopId: shop.id, chats: [] };
        }
      });
      
      return Promise.all(chatsPromises);
    },
    enabled: !!shops && shops.length > 0,
  });
  
  // Объединяем чаты из всех магазинов в один массив
  useEffect(() => {
    if (chatsData) {
      const combined: ShopChatWithUser[] = [];
      chatsData.forEach(item => {
        combined.push(...item.chats);
      });
      setAllChats(combined);
    }
  }, [chatsData]);
  
  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!isAuthLoading && !user) {
    window.location.href = "/login";
    return null;
  }

  // Проверяем, имеет ли пользователь права для просмотра страницы
  if (!isAuthLoading && user && !isShopStaff(user)) {
    setLocation("/");
    return null;
  }
  
  // Если данные загружаются, показываем индикатор загрузки
  if (isAuthLoading || isShopsLoading || isChatsLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  // Если у пользователя нет магазинов, показываем сообщение
  if (!shops || shops.length === 0) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Нет магазинов</h1>
            <p className="text-muted-foreground mb-6">
              У вас нет магазинов для управления чатами
            </p>
            <Button asChild>
              <Link href="/create-shop">Создать магазин</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Фильтруем чаты по выбранному магазину и поисковому запросу
  const filteredChats = allChats
    .filter(chat => selectedShopId === "all" || chat.shopId.toString() === selectedShopId)
    .filter(chat => 
      chat.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (chat.shopName && chat.shopName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <MessageCircle className="h-7 w-7" />
                Чаты с клиентами
              </h1>
              <p className="text-muted-foreground">
                {selectedShopId === "all" 
                  ? "Все магазины" 
                  : `Магазин: ${shops.find(s => s.id.toString() === selectedShopId)?.name}`}
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              {shops.length > 1 && (
                <Select
                  value={selectedShopId}
                  onValueChange={setSelectedShopId}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Выберите магазин" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все магазины</SelectItem>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id.toString()}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Поиск чатов..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button variant="outline" size="icon" onClick={() => refetchChats()}>
                <Loader2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Сообщения клиентов</CardTitle>
            </CardHeader>
            
            <CardContent>
              {filteredChats.length > 0 ? (
                <div className="divide-y">
                  {filteredChats.map((chat) => (
                    <div 
                      key={chat.id} 
                      className="py-4 flex items-center justify-between hover:bg-muted/50 rounded-md -mx-2 px-2 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            <UserIcon className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="space-y-1">
                          <h3 className="font-medium leading-none">{chat.userName}</h3>
                          <div className="flex items-center gap-2">
                            {shops.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                <Store className="h-3 w-3 mr-1" />
                                {chat.shopName}
                              </Badge>
                            )}
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {chat.lastMessage || "Нет сообщений"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <div className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(chat.lastMessageAt), "HH:mm")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(chat.lastMessageAt), "dd.MM.yyyy")}
                          </div>
                        </div>
                        
                        <Button asChild size="sm">
                          <Link href={`/chats/${chat.id}`}>
                            <MessagesSquare className="h-4 w-4 mr-2" />
                            Открыть
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-12">
                  <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
                  {searchQuery ? (
                    <>
                      <h2 className="text-xl font-semibold mb-2">Нет результатов поиска</h2>
                      <p className="text-muted-foreground">
                        По запросу "{searchQuery}" ничего не найдено
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold mb-2">Нет чатов</h2>
                      <p className="text-muted-foreground">
                        {selectedShopId === "all" 
                          ? "У ваших магазинов пока нет чатов с клиентами" 
                          : "У этого магазина пока нет чатов с клиентами"}
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 