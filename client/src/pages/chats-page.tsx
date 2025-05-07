import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Search, Flag, Store, Filter, User, ShoppingBag, Package, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShopChat, Complaint, UserRole, Shop } from "@shared/schema";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { isShopStaff } from "@/lib/role-utils";

// Типы для разных видов чатов
type UserChat = ShopChat & { 
  shopName: string;
  lastMessage: string | null;
};

// Тип для чатов сотрудников с клиентами
type StaffChat = ShopChat & {
  shopId: number;
  shopName: string;
  userName: string;
  userId: number;
  lastMessage: string | null;
};

// Расширяем интерфейс Complaint для обращений в магазины
interface ComplaintWithShopInfo extends Complaint {
  isShopComplaint?: boolean;
  shopName?: string;
  shopId?: number;
  lastMessage?: string | null;
  lastMessageAt?: string;
}

// Интерфейс для обращений в магазин
interface ShopAppeal {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  userId: number;
  userName: string;
  shopId: number;
  shopName: string;
  lastMessage?: string | null;
}

// Тип для результата запроса клиентских чатов
interface ShopClientChatsResult {
  shopId: number;
  chats: StaffChat[];
}

// Общий тип для всех видов чатов
type ChatItem = {
  id: number;
  type: 'shop' | 'complaint' | 'shopComplaint' | 'clientChat' | 'shopAppeal' | 'shopStaffChat';
  title: string;
  url: string;
  lastMessage: string | null;
  lastMessageAt: string;
  shopName?: string;
  shopId?: number;
  userName?: string;
  userId?: number;
  status?: string;
};

// Функция для безопасного форматирования даты
const formatDate = (dateStr?: string | Date): string => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), "dd.MM.yyyy");
  } catch (error) {
    console.error("Error formatting date:", error);
    return '';
  }
};

export default function ChatsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Проверяем, является ли пользователь сотрудником магазина
  const isStaff = user && (
    user.role === "SHOP_STAFF" || 
    user.role === "SHOP_ADMIN" || 
    user.role === "ADMIN" ||
    user.role === "SHOP_OWNER" || 
    user.role === "SHOP_MAIN"
  );
  
  // Получаем чаты пользователя с магазинами
  const { data: shopChats = [], isLoading: isShopChatsLoading } = useQuery(
    ["shop-chats", user?.id],
    async () => {
      if (!user) return [] as UserChat[];
      try {
        const response = await fetch(`/api/users/${user.id}/shop-chats`);
      if (!response.ok) {
          throw new Error("Failed to fetch shop chats");
        }
        return response.json() as Promise<UserChat[]>;
      } catch (error) {
        console.error("Ошибка при получении чатов:", error);
        return [] as UserChat[];
      }
    },
    { enabled: !!user }
  );
  
  // Получаем обращения пользователя (и к платформе, и к магазинам)
  const { data: complaints = [], isLoading: isComplaintsLoading, refetch: refetchComplaints } = useQuery(
    ["complaints-user"],
    async () => {
      try {
        const res = await apiRequest("GET", "/api/complaints/user");
        const data = await res.json();
        
        // Добавляем дополнительные поля для совместимости с чатами
        return data.map((complaint: ComplaintWithShopInfo) => ({
          ...complaint,
          lastMessage: complaint.description,
          lastMessageAt: complaint.createdAt,
        })) as ComplaintWithShopInfo[];
      } catch (error) {
        console.error("Ошибка при получении обращений:", error);
        return [] as ComplaintWithShopInfo[];
      }
    },
    { 
    enabled: !!user,
      refetchInterval: 10000, // Обновляем каждые 10 секунд
      staleTime: 5000, // Данные считаются устаревшими через 5 секунд
    }
  );
  
  // Получаем чаты с клиентами для сотрудников магазина
  const { data: staffChats = [], isLoading: isStaffChatsLoading } = useQuery(
    ["staff-chats"],
    async () => {
      try {
        const res = await apiRequest("GET", "/api/staff/chats");
        if (!res.ok) {
          throw new Error("Failed to fetch staff chats");
        }
        return res.json() as Promise<StaffChat[]>;
      } catch (error) {
        console.error("Ошибка при получении чатов для сотрудников:", error);
        return [] as StaffChat[];
      }
    },
    { enabled: !!user && isStaff }
  );
  
  // Получаем список магазинов пользователя (для сотрудников)
  const { data: shops = [], isLoading: isShopsLoading } = useQuery(
    ["user-shops"],
    async () => {
      try {
        const response = await apiRequest("GET", "/api/user/shops");
        return response.json() as Promise<Shop[]>;
      } catch (error) {
        console.error("Ошибка при получении магазинов:", error);
        return [] as Shop[];
      }
    },
    { enabled: !!user && !!isStaff }
  );
  
  // Получаем все обращения в магазины пользователя
  const { data: shopAppeals = [], isLoading: isShopAppealsLoading } = useQuery(
    ["shop-appeals"],
    async () => {
      try {
        if (!shops || shops.length === 0) return [] as ShopAppeal[];
        
        // Загружаем обращения из всех магазинов пользователя
        const appealsPromises = shops.map(async (shop) => {
          try {
            const response = await apiRequest("GET", `/api/shops/${shop.id}/complaints`);
            if (!response.ok) {
              return [] as ShopAppeal[];
            }
            const appeals = await response.json();
            // Добавляем название магазина к каждому обращению
            return appeals.map((appeal: any) => ({
              ...appeal,
              shopName: shop.name,
              lastMessage: appeal.description,
              lastMessageAt: appeal.createdAt
            })) as ShopAppeal[];
          } catch (error) {
            console.error(`Error fetching appeals for shop ${shop.id}:`, error);
            return [] as ShopAppeal[];
          }
        });
        
        const results = await Promise.all(appealsPromises);
        // Объединяем результаты
        return results.flat() as ShopAppeal[];
      } catch (error) {
        console.error("Ошибка при получении обращений в магазины:", error);
        return [] as ShopAppeal[];
      }
    },
    { enabled: !!user && !!isStaff && !!shops && shops.length > 0 }
  );
  
  // Получаем все чаты с клиентами для всех магазинов
  const { data: shopClientChats = [], isLoading: isShopClientChatsLoading } = useQuery(
    ["shop-client-chats"],
    async () => {
      try {
        if (!shops || shops.length === 0) return [] as ShopClientChatsResult[];
        
        // Загружаем чаты из всех магазинов пользователя
        const chatsPromises = shops.map(async (shop) => {
          try {
            const response = await fetch(`/api/shops/${shop.id}/chats`);
            if (!response.ok) {
              return { shopId: shop.id, chats: [] } as ShopClientChatsResult;
            }
            const chats = await response.json();
            // Добавляем название магазина к каждому чату
            const chatsWithShopName = chats.map((chat: any) => ({
              ...chat,
              shopName: shop.name
            }));
            return { shopId: shop.id, chats: chatsWithShopName } as ShopClientChatsResult;
          } catch (error) {
            console.error(`Error fetching chats for shop ${shop.id}:`, error);
            return { shopId: shop.id, chats: [] } as ShopClientChatsResult;
          }
        });
        
        return Promise.all(chatsPromises) as Promise<ShopClientChatsResult[]>;
      } catch (error) {
        console.error("Ошибка при получении чатов с клиентами:", error);
        return [] as ShopClientChatsResult[];
      }
    },
    { enabled: !!user && !!isStaff && !!shops && shops.length > 0 }
  );
  
  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!isAuthLoading && !user) {
    window.location.href = "/login";
    return null;
  }
  
  // Если данные загружаются, показываем индикатор загрузки
  if (isAuthLoading || isShopChatsLoading || isComplaintsLoading || 
      (isStaff && (isStaffChatsLoading || isShopsLoading || isShopAppealsLoading || isShopClientChatsLoading))) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Подготавливаем все чаты с клиентами из всех магазинов
  const allShopClientChats: StaffChat[] = [];
  if (shopClientChats && shopClientChats.length > 0) {
    shopClientChats.forEach(item => {
      allShopClientChats.push(...item.chats);
    });
  }

  // Получаем все чаты (магазины + обращения + чаты с клиентами для сотрудников)
  const allChats: ChatItem[] = [
    ...(shopChats || []).map(chat => ({
      id: chat.id,
      type: 'shop' as const,
      title: chat.shopName,
      url: `/chats/${chat.id}`,
      lastMessage: chat.lastMessage,
      lastMessageAt: typeof chat.lastMessageAt === 'string' 
        ? chat.lastMessageAt 
        : (chat.lastMessageAt instanceof Date 
            ? chat.lastMessageAt.toISOString() 
            : new Date().toISOString()),
    })),
    ...(complaints || []).filter(c => !c.isShopComplaint).map(complaint => ({
      id: complaint.id,
      type: 'complaint' as const,
      title: complaint.title,
      url: `/complaints?id=${complaint.id}`,
      lastMessage: complaint.description || null,
      lastMessageAt: typeof complaint.createdAt === 'string' 
        ? complaint.createdAt 
        : (complaint.createdAt instanceof Date 
            ? complaint.createdAt.toISOString() 
            : new Date().toISOString()),
    })),
    ...(complaints || []).filter(c => c.isShopComplaint).map(complaint => ({
      id: complaint.id,
      type: 'shopComplaint' as const,
      title: complaint.title,
      url: `/shop-appeal?shopId=${complaint.shopId || 0}&complaintId=${complaint.id}`,
      lastMessage: complaint.description || null,
      lastMessageAt: typeof complaint.createdAt === 'string' 
        ? complaint.createdAt 
        : (complaint.createdAt instanceof Date 
            ? complaint.createdAt.toISOString() 
            : new Date().toISOString()),
      shopId: complaint.shopId || 0,
      shopName: complaint.shopName || 'Неизвестный магазин',
    })),
    ...(staffChats || []).map(chat => ({
      id: chat.id,
      type: 'clientChat' as const,
      title: chat.userName || `Пользователь #${chat.userId}`,
      url: `/chats/${chat.id}`,
      lastMessage: chat.lastMessage,
      lastMessageAt: typeof chat.lastMessageAt === 'string' 
        ? chat.lastMessageAt 
        : (chat.lastMessageAt instanceof Date 
            ? chat.lastMessageAt.toISOString() 
            : new Date().toISOString()),
      shopId: chat.shopId,
      shopName: chat.shopName,
      userId: chat.userId
    })),
    ...(shopAppeals || []).map(appeal => ({
      id: appeal.id,
      type: 'shopAppeal' as const,
      title: appeal.title,
      url: `/shop-appeal?shopId=${appeal.shopId}&complaintId=${appeal.id}`,
      lastMessage: appeal.description || null,
      lastMessageAt: appeal.createdAt,
      shopId: appeal.shopId,
      shopName: appeal.shopName,
      userId: appeal.userId,
      userName: appeal.userName,
      status: appeal.status
    })),
    ...(allShopClientChats || []).map(chat => ({
      id: chat.id,
      type: 'shopStaffChat' as const,
      title: chat.userName || `Пользователь #${chat.userId}`,
      url: `/shop-chats/${chat.shopId}/${chat.id}`,
      lastMessage: chat.lastMessage,
      lastMessageAt: typeof chat.lastMessageAt === 'string' 
        ? chat.lastMessageAt 
        : (chat.lastMessageAt instanceof Date 
            ? chat.lastMessageAt.toISOString() 
            : new Date().toISOString()),
      shopId: chat.shopId,
      shopName: chat.shopName,
      userId: chat.userId
    }))
  ];
  
  // Сортируем чаты по дате (новые сверху)
  allChats.sort((a, b) => {
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  // Фильтрация чатов по поисковому запросу и активной вкладке
  const filteredChats = allChats.filter(chat => {
    const matchesSearch = chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'shops') {
      if (isStaff) {
        return (chat.type === 'shop' || chat.type === 'clientChat' || 
                chat.type === 'shopStaffChat') && matchesSearch;
      } else {
        return chat.type === 'shop' && matchesSearch;
      }
    }
    if (activeTab === 'complaints') {
      if (isStaff) {
        return (chat.type === 'complaint' || chat.type === 'shopComplaint' || 
                chat.type === 'shopAppeal') && matchesSearch;
      } else {
        return (chat.type === 'complaint' || chat.type === 'shopComplaint') && matchesSearch;
      }
    }
    
    return matchesSearch;
  });
  
  return (
    <div className="max-w-4xl mx-auto p-4 bg-black text-white">
      <h1 className="text-2xl font-bold mb-4">Все чаты и обращения</h1>
      
      <div className="mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
          <div className="relative w-full">
            <Input
              type="text"
              placeholder="Поиск чатов и обращений..."
              className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-gray-900">
            <TabsTrigger value="all" className="data-[state=active]:bg-gray-800">Все</TabsTrigger>
            <TabsTrigger value="shops" className="data-[state=active]:bg-gray-800">
              {isStaff ? "Чаты магазинов" : "Чаты с магазинами"}
            </TabsTrigger>
            <TabsTrigger value="complaints" className="data-[state=active]:bg-gray-800">Обращения</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2 border-b border-gray-800">
          <CardTitle className="text-white">
            {activeTab === 'all' && 'Все чаты и обращения'}
            {activeTab === 'shops' && (isStaff ? 'Чаты магазинов' : 'Чаты с магазинами')}
            {activeTab === 'complaints' && 'Обращения'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {filteredChats.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {filteredChats.map((chat) => (
                <Link key={`${chat.type}-${chat.id}`} href={chat.url}>
                  <div className="flex items-center gap-4 py-3 px-4 hover:bg-gray-800 transition-colors cursor-pointer">
                    <Avatar className="h-10 w-10 border-2 border-gray-700">
                      {chat.type === 'shop' && (
                        <AvatarFallback className="bg-gray-800 text-white">
                          <Store className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                      {chat.type === 'complaint' && (
                        <AvatarFallback className="bg-gray-800 text-yellow-500">
                          <Flag className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                      {chat.type === 'shopComplaint' && (
                        <AvatarFallback className="bg-gray-800 text-orange-500">
                          <Store className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                      {chat.type === 'clientChat' && (
                        <AvatarFallback className="bg-gray-800 text-blue-500">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                      {chat.type === 'shopAppeal' && (
                        <AvatarFallback className="bg-gray-800 text-purple-500">
                          <Flag className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                      {chat.type === 'shopStaffChat' && (
                        <AvatarFallback className="bg-gray-800 text-green-500">
                          <MessagesSquare className="h-5 w-5" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium leading-none text-white">{chat.title}</h3>
                        <span className="text-xs text-gray-400">
                          {formatDate(chat.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {chat.type === 'shop' && (
                          <Badge variant="outline" className="text-xs border-gray-700 text-gray-300">Магазин</Badge>
                        )}
                        {chat.type === 'complaint' && (
                          <Badge variant="outline" className="text-xs border-yellow-800 text-yellow-500">Обращение к площадке</Badge>
                        )}
                        {chat.type === 'shopComplaint' && (
                          <Badge variant="outline" className="text-xs border-orange-800 text-orange-500">
                            Обращение к магазину
                            {chat.shopName && `: ${chat.shopName}`}
                          </Badge>
                        )}
                        {chat.type === 'clientChat' && (
                          <Badge variant="outline" className="text-xs border-blue-800 text-blue-500">
                            {chat.shopName ? `Клиент магазина ${chat.shopName}` : 'Клиент'}
                          </Badge>
                        )}
                        {chat.type === 'shopAppeal' && (
                          <Badge variant="outline" className="text-xs border-purple-800 text-purple-500">
                            Обращение от клиента
                            {chat.status && (
                              <span className="ml-1">
                                • {chat.status === "PENDING" ? "Ожидает" : 
                                   chat.status === "IN_PROGRESS" ? "В работе" : 
                                   chat.status === "RESOLVED" ? "Решено" : "Закрыто"}
                              </span>
                            )}
                          </Badge>
                        )}
                        {chat.type === 'shopStaffChat' && (
                          <Badge variant="outline" className="text-xs border-green-800 text-green-500">
                            {chat.shopName ? `Чат магазина ${chat.shopName}` : 'Чат магазина'}
                          </Badge>
                        )}
                        <p className="text-sm text-gray-400 line-clamp-1">
                          {chat.lastMessage || "Нет сообщений"}
                        </p>
                      </div>
                    </div>
                  </div>
                      </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white">Чаты не найдены</h3>
              <p className="text-gray-400 text-center max-w-sm mt-1">
                {searchQuery 
                  ? "Попробуйте изменить поисковый запрос" 
                  : "У вас пока нет активных чатов или обращений"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 