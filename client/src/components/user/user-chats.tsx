import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShopChat } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, MessageSquare, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// Определяем тип UserChat на основе ShopChat
type UserChat = ShopChat & { 
  shopName: string;
  lastMessage: string | null;
};

export function UserChats() {
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [_, navigate] = useLocation();

  // Получаем список чатов пользователя
  const { data: chats = [], isLoading } = useQuery<UserChat[]>({
    queryKey: ["/api/user/chats"],
    queryFn: async () => {
      const response = await fetch("/api/user/chats", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch chats");
      }
      return response.json();
    },
  });

  // Переход к выбранному чату
  const handleChatSelect = (chatId: number) => {
    setSelectedChat(chatId);
    navigate(`/chats/${chatId}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <div className="flex items-center justify-center w-full">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <div className="flex flex-col items-center justify-center w-full">
          <MessageSquare className="h-12 w-12 text-gray-500 mb-3" />
          <h3 className="font-semibold text-lg mb-2">У вас нет чатов</h3>
          <p className="text-gray-400 mb-4">
            Вы еще не начали ни одного обращения
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Создать обращение
          </Button>
        </div>
      </div>
    );
  }

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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              "rounded-md p-4 border border-gray-800 cursor-pointer hover:bg-gray-900 transition-colors",
              selectedChat === chat.id && "border-blue-600 bg-gray-900"
            )}
            onClick={() => handleChatSelect(chat.id)}
          >
            <div className="flex justify-between items-center">
              <div className="font-medium">{chat.id}</div>
              <div className="text-xs text-gray-400">В обработке</div>
            </div>
            <div className="text-sm text-gray-400">{chat.shopName || "Магазин"}</div>
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(chat.createdAt), "dd.MM.yyyy HH:mm")}
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto text-xs h-6 px-2 text-gray-400 hover:text-white hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  handleChatSelect(chat.id);
                }}
              >
                Открыть чат
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 