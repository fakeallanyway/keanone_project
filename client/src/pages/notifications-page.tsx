import { useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Bell, Calendar, Store, ShoppingBag, MessageCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Типы уведомлений
enum NotificationType {
  MESSAGE = "MESSAGE",
  ORDER = "ORDER",
  COMPLAINT = "COMPLAINT",
  SYSTEM = "SYSTEM"
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  createdAt: string;
  read: boolean;
  link?: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function NotificationsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // Получаем уведомления пользователя
  const { data: notifications, isLoading: isNotificationsLoading } = useQuery<Notification[]>({
    queryKey: [`/api/users/${user?.id}/notifications`],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user!.id}/notifications`);
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
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
  if (isAuthLoading || isNotificationsLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Функция для получения иконки по типу уведомления
  const getIconByType = (type: NotificationType) => {
    switch (type) {
      case NotificationType.MESSAGE:
        return <MessageCircle className="h-5 w-5" />;
      case NotificationType.ORDER:
        return <ShoppingBag className="h-5 w-5" />;
      case NotificationType.COMPLAINT:
        return <AlertTriangle className="h-5 w-5" />;
      case NotificationType.SYSTEM:
        return <Bell className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Функция для получения цвета иконки по типу уведомления
  const getColorByType = (type: NotificationType) => {
    switch (type) {
      case NotificationType.MESSAGE:
        return "text-blue-500";
      case NotificationType.ORDER:
        return "text-green-500";
      case NotificationType.COMPLAINT:
        return "text-amber-500";
      case NotificationType.SYSTEM:
        return "text-purple-500";
      default:
        return "text-primary";
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Bell className="h-7 w-7" />
        Уведомления
      </h1>
      
      {notifications && notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all ${notification.read ? 'bg-background' : 'bg-primary/5 border-primary/10'}`}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Avatar className={`h-8 w-8 ${getColorByType(notification.type)} bg-${getColorByType(notification.type)}/10`}>
                      <AvatarFallback>
                        {getIconByType(notification.type)}
                      </AvatarFallback>
                      {notification.sender?.avatar && (
                        <AvatarImage src={notification.sender.avatar} alt={notification.sender.name} />
                      )}
                    </Avatar>
                    <div>
                      <CardTitle className="text-md">{notification.title}</CardTitle>
                      <CardDescription>
                        {notification.sender?.name && `От: ${notification.sender.name} • `}
                        {format(new Date(notification.createdAt), "dd.MM.yyyy HH:mm")}
                      </CardDescription>
                    </div>
                  </div>
                  {!notification.read && (
                    <Badge variant="default" className="text-xs">Новое</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {notification.content}
                </p>
              </CardContent>
              {notification.link && (
                <CardFooter className="pt-0">
                  <Button asChild variant="outline" size="sm">
                    <Link href={notification.link}>
                      Перейти
                    </Link>
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 bg-muted/50 rounded-lg">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
          <h2 className="text-xl font-semibold mb-2">У вас нет уведомлений</h2>
          <p className="text-muted-foreground mb-6">
            Здесь будут появляться уведомления о сообщениях, заказах и системных событиях
          </p>
        </div>
      )}
    </div>
  );
} 