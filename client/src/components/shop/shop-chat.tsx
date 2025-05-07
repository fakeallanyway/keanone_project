import { useState, useEffect, useRef } from "react";
import { User, UserRole, ShopChat as ShopChatType, ShopChatMessage, ChatMessageType } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Send, Loader2, Store, MessageSquare, UserCheck, User as UserIcon, Plus, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ShopChatProps {
  chatId: number;
  currentUser: User;
}

export function ShopChat({ chatId, currentUser }: ShopChatProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Кэш пользователей и магазинов для отображения в чате
  const [userCache, setUserCache] = useState<Record<number, User>>({});
  const [shopCache, setShopCache] = useState<Record<number, any>>({});
  
  // Локальное хранение сообщений для мгновенных обновлений через веб-сокет
  const [localMessages, setLocalMessages] = useState<ShopChatMessage[]>([]);
  
  // Получаем информацию о чате
  const { data: chat, isLoading: isChatLoading } = useQuery<ShopChatType & { shopName: string }>({
    queryKey: [`/api/shop-chats/${chatId}`],
    queryFn: async () => {
      const response = await fetch(`/api/shop-chats/${chatId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }
      return response.json();
    },
  });
  
  // Получаем сообщения чата
  const { data: messages = [], isLoading: isMessagesLoading } = useQuery<ShopChatMessage[]>({
    queryKey: [`/api/shop-chats/${chatId}/messages`],
    queryFn: async () => {
      const response = await fetch(`/api/shop-chats/${chatId}/messages`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return response.json();
    },
    refetchInterval: 5000, // Обновляем каждые 5 секунд, если WebSocket недоступен
  });

  // Обновляем локальные сообщения при получении новых с сервера
  useEffect(() => {
    if (messages && messages.length > 0) {
      setLocalMessages(messages);
    }
  }, [messages]);
  
  // Настраиваем WebSocket подключение для чата
  useEffect(() => {
    // URL для WebSocket подключения (используем текущий хост)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/shop-chats`;
    
    // Создаем WebSocket соединение
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log('WebSocket connected for shop chat');
      setIsConnected(true);
      
      // Отправляем аутентификационные данные
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'auth',
          userId: currentUser.id
        }));
      }
    };
    
    // Обработчик входящих сообщений
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Обрабатываем новые сообщения
        if (data.type === 'new_message' && data.chatId === chatId && data.message) {
          console.log('Received new message via WebSocket:', data.message);
          
          // Добавляем новое сообщение к локальным сообщениям
          setLocalMessages(prev => [...prev, data.message]);
          
          // Проверяем, нужно ли получать информацию о новом пользователе
          if (data.message.senderId && !userCache[data.message.senderId]) {
            getUserInfo(data.message.senderId);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      toast({
        title: "Ошибка соединения",
        description: "Не удалось подключиться к серверу сообщений. Используется резервный режим с обновлением.",
        variant: "destructive"
      });
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
    };
    
    // Закрываем соединение при размонтировании компонента
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [chatId, currentUser.id, toast]);
  
  // Функция для получения информации о пользователе по ID
  const getUserInfo = async (userId: number) => {
    // Если пользователь уже в кэше, возвращаем его
    if (userCache[userId]) {
      return userCache[userId];
    }

    // Если это текущий пользователь, возвращаем его
    if (userId === currentUser.id) {
      setUserCache(prev => ({ ...prev, [userId]: currentUser }));
      return currentUser;
    }

    try {
      // Иначе запрашиваем информацию о пользователе с сервера
      const response = await fetch(`/api/users/${userId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      const user = await response.json();
      // Сохраняем пользователя в кэш
      setUserCache(prev => ({ ...prev, [userId]: user }));
      return user;
    } catch (error) {
      console.error("Error fetching user info:", error);
      // Возвращаем заглушку, если не удалось получить информацию
      return { 
        username: "Пользователь", 
        avatarUrl: "", 
        role: "USER", 
        isVerified: false,
        isPremium: false,
        displayName: "Неизвестный пользователь"
      };
    }
  };
  
  // Функция для получения информации о магазине
  const getShopInfo = async (shopId: number) => {
    // Если магазин уже в кэше, возвращаем его
    if (shopCache[shopId]) {
      return shopCache[shopId];
    }

    try {
      // Запрашиваем информацию о магазине с сервера
      const response = await fetch(`/api/shops/${shopId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch shop");
      }
      const shop = await response.json();
      // Сохраняем магазин в кэш
      setShopCache(prev => ({ ...prev, [shopId]: shop }));
      return shop;
    } catch (error) {
      console.error("Error fetching shop info:", error);
      // Возвращаем заглушку, если не удалось получить информацию
      return { 
        name: "Магазин", 
        avatarUrl: "", 
        isVerified: false,
      };
    }
  };
  
  // Загружаем информацию о пользователях при изменении сообщений
  useEffect(() => {
    if (!chat) return;
    
    const loadUserInfo = async () => {
      // Загружаем информацию о магазине
      if (chat.shopId) {
        await getShopInfo(chat.shopId);
      }
      
      // Загружаем информацию о пользователях из сообщений
      const userIds = Array.from(new Set(localMessages.map(msg => msg.senderId).filter(id => id !== 0)));
      for (const userId of userIds) {
        if (userId && !userCache[userId]) {
          await getUserInfo(userId);
        }
      }
    };
    
    loadUserInfo();
  }, [localMessages, userCache, shopCache, chat]);
  
  // Мутация для отправки сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/shop-chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ message: text })
      });
      
      if (!res.ok) {
        throw new Error("Failed to send message");
      }
      
      return res.json();
    },
    onSuccess: (newMessage) => {
      // Добавляем новое сообщение локально для мгновенного отображения
      setLocalMessages(prev => [...prev, newMessage]);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive"
      });
    }
  });
  
  // Прокручиваем к последнему сообщению при обновлении
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  // Обработчик отправки сообщения
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(message.trim());
    setMessage("");
  };
  
  // Если данные загружаются, показываем индикатор загрузки
  if (isChatLoading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <div className="flex items-center justify-center w-full">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }
  
  // Если чат не найден, показываем сообщение об ошибке
  if (!chat) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <div className="flex flex-col items-center justify-center w-full">
          <MessageSquare className="h-12 w-12 text-gray-500 mb-3" />
        <h3 className="font-semibold text-lg mb-2">Чат не найден</h3>
          <p className="text-gray-400">
          Запрашиваемый чат не существует или был удален
        </p>
        </div>
      </div>
    );
  }
  
  // Получаем информацию о магазине
  const shop = chat.shopId ? shopCache[chat.shopId] : null;
  
  // Используем локальные сообщения для отображения
  const displayMessages = isMessagesLoading && localMessages.length === 0 ? [] : localMessages;
  
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* Заголовок */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Заголовок</h1>
        <Button variant="outline" className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700">
          <Plus className="h-4 w-4 mr-2" />
          Создать обращение
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель - список обращений */}
        <div className="w-1/3 max-w-sm border-r border-gray-800 overflow-y-auto">
          <div className="p-4">
            <div className="rounded-md p-4 border border-gray-800 mb-4 cursor-pointer hover:bg-gray-900 transition-colors">
              <div className="flex justify-between items-center">
                <div className="font-medium">1</div>
                <div className="text-xs text-gray-400">В обработке</div>
              </div>
              <div className="text-sm text-gray-400">{chat.shopName || "123"}</div>
              <div className="flex items-center mt-2 text-xs text-gray-500">
                <Clock className="h-3 w-3 mr-1" />
                {format(new Date(chat.createdAt), "dd.MM.yyyy HH:mm")}
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-6 px-2 text-gray-400 hover:text-white hover:bg-transparent">
                  Открыть чат
                </Button>
              </div>
          </div>
        </div>
      </div>
      
        {/* Правая панель - текущий чат */}
        <div className="flex-1 flex flex-col overflow-hidden">
      {/* Область сообщений */}
          <div className="flex-1 p-4 overflow-y-auto">
            {isMessagesLoading && displayMessages.length === 0 ? (
          <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Нет сообщений</div>
          </div>
        ) : (
              <div className="space-y-6">
                {displayMessages.map((msg) => {
              const isCurrentUser = msg.senderId === currentUser.id;
              const isSystemMessage = msg.senderType === ChatMessageType.SYSTEM;
                  const sender = !isSystemMessage && msg.senderId ? userCache[msg.senderId] : null;
                  const isShopMessage = msg.senderType === ChatMessageType.SHOP;
              
              if (isSystemMessage) {
                return (
                      <div key={msg.id} className="flex justify-center text-center">
                        <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-md max-w-xs">
                          <div className="text-sm">{msg.message}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {format(new Date(msg.createdAt), "MMM dd, yyyy, h:mm a")}
                          </div>
                        </div>
                  </div>
                );
              }
              
              return (
                    <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  {!isCurrentUser && (
                        <Avatar className="h-8 w-8 mr-3 mt-1">
                      <AvatarImage 
                            src={isShopMessage && shop ? (shop.avatarUrl || "") : sender ? (sender.avatarUrl || "") : ""}
                            alt={isShopMessage && shop ? (shop.name || "Магазин") : sender ? (sender.displayName || sender.username || "Пользователь") : "Пользователь"}
                      />
                          <AvatarFallback className="bg-gray-700 text-white">
                            {isShopMessage && shop ? 
                              (shop.name?.charAt(0) || "М") : 
                              sender ? (sender.username?.charAt(0) || "П") : "П"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                      <div className="max-w-xs">
                        {!isCurrentUser && (
                          <div className="flex items-center mb-1">
                            <span className="text-sm font-medium mr-2">
                              {isShopMessage && shop ? 
                                (shop.name || "Магазин") : 
                                sender ? (sender.displayName || sender.username || "Пользователь") : "Пользователь"}
                            </span>
                            <Badge 
                              variant="outline" 
                              className="text-xs px-1.5 py-0 border-gray-700 bg-gray-800 text-gray-300"
                            >
                              {isShopMessage ? "Владелец магазина" : "Модератор"}
                            </Badge>
                          </div>
                        )}
                        
                        <div className={`px-4 py-2 rounded-md ${
                          isCurrentUser ? 
                            'bg-blue-900 text-white' : 
                            'bg-gray-800 text-white'
                    }`}>
                          <div className="text-sm">{msg.message}</div>
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-1">
                          {format(new Date(msg.createdAt), "MMM dd, yyyy, h:mm a")}
                        </div>
                    </div>
                      
                      {isCurrentUser && (
                        <Avatar className="h-8 w-8 ml-3 mt-1">
                          <AvatarImage src={currentUser.avatarUrl || ""} alt={currentUser.displayName || currentUser.username} />
                          <AvatarFallback className="bg-gray-700 text-white">
                            {currentUser.username?.charAt(0) || "П"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
              </div>
        )}
      </div>
      
      {/* Форма отправки сообщения */}
          <div className="p-4 border-t border-gray-800">
            <form onSubmit={handleSubmit} className="flex">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 bg-gray-800 border-gray-700 text-white focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            type="submit" 
                className="ml-2 bg-blue-600 hover:bg-blue-700"
            disabled={sendMessageMutation.isPending || !message.trim()}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 