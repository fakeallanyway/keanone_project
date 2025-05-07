import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Store, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShopChat } from "@/components/shop/shop-chat";
import { ShopChat as ShopChatType } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ShopChatPage() {
  const [, params] = useRoute<{ id: string }>("/chats/:id");
  const { user, isLoading: isAuthLoading } = useAuth();
  const [message, setMessage] = useState("");
  
  if (!params) return null;
  const chatId = parseInt(params.id);
  
  // Получаем информацию о чате
  const { data: chat, isLoading: isChatLoading } = useQuery<ShopChatType & { shopName: string }>({
    queryKey: [`/api/shop-chats/${chatId}`],
    queryFn: async () => {
      const response = await fetch(`/api/shop-chats/${chatId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch chat");
      }
      return response.json();
    },
    enabled: !!user,
  });
  
  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!isAuthLoading && !user) {
    window.location.href = "/login";
    return null;
  }
  
  // Если данные загружаются, показываем индикатор загрузки
  if (isAuthLoading || isChatLoading) {
    return (
      <div className="flex justify-center items-center h-full bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }
  
  // Проверяем доступ к чату
  const hasAccess = user && (
    // Пользователь является участником чата
    (chat && chat.userId === user.id) ||
    // Или пользователь является сотрудником магазина (это проверяется на сервере)
    true // Упрощенная проверка, основная проверка на сервере
  );
  
  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto text-center text-white bg-black h-full flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">Доступ запрещен</h1>
        <p className="text-gray-400 mb-6">
          У вас нет доступа к этому чату
        </p>
        <Button asChild variant="outline" className="text-white border-white/20 hover:bg-white/10">
          <Link href="/">Вернуться на главную</Link>
        </Button>
      </div>
    );
  }

  const handleSendMessage = () => {
    // Здесь будет логика отправки сообщения
    if (!message.trim()) return;
    console.log("Отправка сообщения:", message);
    setMessage("");
  };
  
  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Заголовок с информацией о чате */}
      <div className="border-b border-gray-800 flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-white hover:bg-gray-800">
            <Link href="/chats">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 border-2 border-gray-700">
              <AvatarFallback className="bg-gray-800 text-white">
                {chat?.shopName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold">{chat?.shopName}</h1>
              <p className="text-xs text-gray-400">Онлайн</p>
            </div>
          </div>
        </div>
        
        <div>
          <Button variant="ghost" size="sm" className="text-white border-gray-700 hover:bg-gray-800">
            Профиль
          </Button>
        </div>
      </div>
      
      {/* Область сообщений */}
      <div className="flex-1 bg-black overflow-y-auto px-4 py-2">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Пример системного сообщения */}
          <div className="text-center text-sm text-gray-500 py-1">
            <p>Чат создан. Вы можете начать общение с магазином.</p>
          </div>

          {/* Пример системных сообщений о присоединении сотрудников */}
          <div className="text-center text-sm text-gray-500 py-1">
            <p className="bg-gray-900/50 px-4 py-1 rounded-full inline-block">
              Сотрудник магазина Quero присоединился к чату.
            </p>
          </div>
          <div className="text-center text-sm text-gray-500 py-1">
            <p className="bg-gray-900/50 px-4 py-1 rounded-full inline-block">
              Сотрудник магазина Derboard присоединился к чату.
            </p>
          </div>
          <div className="text-center text-sm text-gray-500 py-1">
            <p className="bg-gray-900/50 px-4 py-1 rounded-full inline-block">
              Сотрудник магазина Katс присоединился к чату.
            </p>
          </div>
          
          {/* Здесь будет компонент чата, закомментирован для примера */}
          {/* <ShopChat chatId={chatId} currentUser={user} /> */}
        </div>
      </div>
      
      {/* Панель ввода сообщения */}
      <div className="border-t border-gray-800 p-3">
        <div className="max-w-screen-lg mx-auto flex gap-2 relative">
          <Input 
            placeholder="Введите сообщение..." 
            className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSendMessage}
          >
            Отправить
          </Button>
          <div className="absolute right-20 top-1/2 transform -translate-y-1/2 text-gray-500">
            <Send className="h-4 w-4 cursor-pointer hover:text-white" onClick={handleSendMessage} />
          </div>
        </div>
      </div>
    </div>
  );
} 