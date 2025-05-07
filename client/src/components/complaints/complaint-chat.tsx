import { useState, useEffect, useRef } from "react";
import { Complaint, ComplaintMessage, User, UserRole } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Send, AlertCircle, Users, CheckCircle, XCircle, UserCheck, Loader2, MessageSquare, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocale } from "@/hooks/use-locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ComplaintChatProps {
  complaint: Complaint;
  messages: ComplaintMessage[];
  currentUser: User;
  assignedStaff?: User;
  isShopComplaint?: boolean;
  shopId?: number | null;
}

export function ComplaintChat({
  complaint,
  messages,
  currentUser,
  assignedStaff,
  isShopComplaint = false,
  shopId = null
}: ComplaintChatProps) {
  const [message, setMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useLocale();
  const { toast } = useToast();

  // Кэш пользователей для отображения в чате
  const [userCache, setUserCache] = useState<Record<number, User>>({});

  // Fetch all staff members who are currently online
  const { data: onlineStaff } = useQuery<User[]>({
    queryKey: ["/api/users/staff/online"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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

    // Если это назначенный сотрудник, возвращаем его
    if (assignedStaff && userId === assignedStaff.id) {
      setUserCache(prev => ({ ...prev, [userId]: assignedStaff }));
      return assignedStaff;
    }

    try {
      // Иначе запрашиваем информацию о пользователе с сервера
      const res = await apiRequest("GET", `/api/users/${userId}`);
      const user = await res.json();
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

  // Загружаем информацию о пользователях при изменении сообщений
  useEffect(() => {
    const loadUserInfo = async () => {
      // Загружаем информацию о создателе тикета
      if (complaint.userId && !userCache[complaint.userId]) {
        await getUserInfo(complaint.userId);
      }
      
      // Загружаем информацию о пользователях из сообщений
      const userIds = Array.from(new Set(messages.map(msg => msg.userId)));
      for (const userId of userIds) {
        if (userId && !userCache[userId]) {
          await getUserInfo(userId);
        }
      }
    };
    
    loadUserInfo();
  }, [messages, userCache, complaint.userId]);

  // Мутация для отправки сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (isShopComplaint && shopId) {
        // Если это обращение в магазин, используем другой API
        const res = await apiRequest("POST", `/api/shops/${shopId}/complaints/${complaint.id}/messages`, {
          message: text,
          isSystemMessage: false
        });
        return res.json();
      } else {
        // Обычное обращение в площадку
        const res = await apiRequest("POST", `/api/complaints/${complaint.id}/messages`, {
          message: text,
          isSystemMessage: false
        });
        return res.json();
      }
    },
    onSuccess: () => {
      // Инвалидируем запросы в зависимости от типа обращения
      if (isShopComplaint && shopId) {
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`, complaint.id, "messages"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/complaints", complaint.id, "messages"] });
      }
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Ошибка",
        description: t('complaints.sendMessageError'),
        variant: "destructive"
      });
    }
  });

  // Мутация для назначения жалобы
  const assignComplaintMutation = useMutation({
    mutationFn: async (complaintId: number) => {
      if (isShopComplaint && shopId) {
        const res = await apiRequest("PATCH", `/api/shops/${shopId}/complaints/${complaintId}/assign`);
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/complaints/${complaintId}/assign`);
        return res.json();
      }
    },
    onSuccess: () => {
      if (isShopComplaint && shopId) {
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`] });
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`, complaint.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/complaints", complaint.id] });
      }
      toast({
        title: "Успешно",
        description: t('complaints.assignSuccess'),
      });
    },
    onError: (error) => {
      console.error("Error assigning complaint:", error);
      toast({
        title: "Ошибка",
        description: t('complaints.assignError'),
        variant: "destructive"
      });
    }
  });

  // Мутация для разрешения жалобы
  const resolveComplaintMutation = useMutation({
    mutationFn: async () => {
      if (isShopComplaint && shopId) {
        const res = await apiRequest("PATCH", `/api/shops/${shopId}/complaints/${complaint.id}/resolve`);
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/complaints/${complaint.id}/resolve`);
        return res.json();
      }
    },
    onSuccess: () => {
      if (isShopComplaint && shopId) {
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`] });
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`, complaint.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/complaints", complaint.id] });
      }
      toast({
        title: "Успешно",
        description: t('complaints.resolveSuccess'),
      });
    },
    onError: (error) => {
      console.error("Error resolving complaint:", error);
      toast({
        title: "Ошибка",
        description: t('complaints.resolveError'),
        variant: "destructive"
      });
    }
  });

  // Мутация для отклонения жалобы
  const rejectComplaintMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (isShopComplaint && shopId) {
        const res = await apiRequest("PATCH", `/api/shops/${shopId}/complaints/${complaint.id}/reject`, {
          reason
        });
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/complaints/${complaint.id}/reject`, {
          reason
        });
        return res.json();
      }
    },
    onSuccess: () => {
      if (isShopComplaint && shopId) {
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`] });
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`, complaint.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
        queryClient.invalidateQueries({ queryKey: ["/api/complaints", complaint.id] });
      }
      setIsRejectDialogOpen(false);
      toast({
        title: "Успешно",
        description: t('complaints.rejectSuccess'),
      });
    },
    onError: (error) => {
      console.error("Error rejecting complaint:", error);
      toast({
        title: "Ошибка",
        description: t('complaints.rejectError'),
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(message.trim());
    setMessage("");
  };

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) {
      toast({
        title: "Ошибка",
        description: "Укажите причину отклонения",
        variant: "destructive"
      });
      return;
    }
    
    rejectComplaintMutation.mutate(rejectReason.trim());
  };

  const isStaff = (user: User) => {
    const staffRoles = [
      UserRole.OWNER,
      UserRole.SECURITY,
      UserRole.ADMIN,
      UserRole.HEADADMIN,
      UserRole.MODERATOR,
      UserRole.SHOP_OWNER,
      UserRole.SHOP_MAIN,
      UserRole.SHOP_STAFF
    ];
    return staffRoles.includes(user.role as any);
  };

  // Проверяем, что все необходимые данные загружены
  if (!complaint || !messages || !currentUser) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <p className="text-muted-foreground">{t('status.loading')}</p>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <div className="p-4 border-b">
        <div className="flex justify-between items-start mb-2">
          <h2 className="font-semibold">{complaint.title}</h2>
          <Badge variant={complaint.status === "RESOLVED" ? "default" : "secondary"}>
            {getStatusText(complaint.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{complaint.description}</p>

        {/* Кнопки действий для сотрудников */}
        {isStaff(currentUser) && complaint.status === "IN_PROGRESS" && (
          <div className="mt-4 flex gap-2">
            <Button 
              size="sm" 
              onClick={() => resolveComplaintMutation.mutate()}
              disabled={resolveComplaintMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('complaints.resolve')}
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsRejectDialogOpen(true)}
              disabled={rejectComplaintMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t('complaints.rejectButton')}
            </Button>
          </div>
        )}

        {/* Кнопка для назначения жалобы на себя (для сотрудников) */}
        {isStaff(currentUser) && complaint.status === "PENDING" && (
          <div className="mt-4">
            <Button 
              size="sm" 
              onClick={() => assignComplaintMutation.mutate(complaint.id)}
              disabled={assignComplaintMutation.isPending}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {t('complaints.assign')}
            </Button>
          </div>
        )}

        {/* Online Staff Section */}
        {isStaff(currentUser) && onlineStaff && onlineStaff.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6">
                  {onlineStaff.length} {onlineStaff.length === 1 ? "сотрудник" : "сотрудников"} онлайн
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-64">
                <div className="space-y-2">
                  {onlineStaff.map((staff) => (
                    <div key={staff.id} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={staff.avatarUrl || ""} />
                        <AvatarFallback>{staff.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{staff.displayName || staff.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {getRoleText(staff.role)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">{t('complaints.noMessages')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('complaints.startConversation')}
            </p>
          </div>
        ) : (
          <>
            {/* Initial complaint message */}
            <div className="flex gap-3 justify-start">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={complaint.userId && userCache[complaint.userId] ? userCache[complaint.userId].avatarUrl || "" : ""} />
                    <AvatarFallback>
                      {complaint.userId && userCache[complaint.userId] 
                        ? (userCache[complaint.userId].username || "").charAt(0).toUpperCase() 
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                </HoverCardTrigger>
                <HoverCardContent className="w-64">
                  <div className="flex justify-between space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={complaint.userId && userCache[complaint.userId] ? userCache[complaint.userId].avatarUrl || "" : ""} />
                      <AvatarFallback>
                        {complaint.userId && userCache[complaint.userId] 
                          ? (userCache[complaint.userId].username || "").charAt(0).toUpperCase() 
                          : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <h4 className="text-sm font-semibold">
                          {complaint.userId && userCache[complaint.userId] 
                            ? userCache[complaint.userId].username 
                            : "Пользователь"}
                        </h4>
                        {complaint.userId && userCache[complaint.userId] && userCache[complaint.userId].isVerified && (
                          <BadgeCheck className="h-4 w-4 text-blue-500 ml-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getRoleText(complaint.userId && userCache[complaint.userId] 
                            ? userCache[complaint.userId].role 
                            : "USER")}
                        </Badge>
                        {complaint.userId && userCache[complaint.userId] && userCache[complaint.userId].isPremium && (
                          <Badge variant="outline" className="text-xs bg-amber-100">
                            Premium
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <div className="rounded-lg p-3 max-w-[70%] bg-muted">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-xs font-semibold">
                    {complaint.userId && userCache[complaint.userId] 
                      ? userCache[complaint.userId].username 
                      : "Пользователь"}
                  </p>
                  {complaint.userId && userCache[complaint.userId] && userCache[complaint.userId].isVerified && (
                    <BadgeCheck className="h-3 w-3 text-blue-500" />
                  )}
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1">
                    {getRoleText(complaint.userId && userCache[complaint.userId] 
                      ? userCache[complaint.userId].role 
                      : "USER")}
                  </Badge>
                </div>
                <p className="text-sm">{complaint.description}</p>
                <p className="text-xs opacity-70 mt-1">
                  {format(new Date(complaint.createdAt), "PPp")}
                </p>
              </div>
            </div>

            {messages.map((msg) => {
              // Определяем, является ли сообщение от текущего пользователя
              const isCurrentUser = msg.userId === currentUser.id;
              // Получаем пользователя из кэша или используем заглушку
              const messageUser = msg.userId && userCache[msg.userId] 
                ? userCache[msg.userId] 
                : { username: "Пользователь", avatarUrl: "", role: "USER", isVerified: false };
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    isCurrentUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isCurrentUser && (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Avatar className="h-8 w-8 cursor-pointer">
                          <AvatarImage src={messageUser.avatarUrl || ""} />
                          <AvatarFallback>
                            {messageUser.username?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64">
                        <div className="flex justify-between space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={messageUser.avatarUrl || ""} />
                            <AvatarFallback>
                              {messageUser.username?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <h4 className="text-sm font-semibold">{messageUser.username}</h4>
                              {messageUser.isVerified && (
                                <BadgeCheck className="h-4 w-4 text-blue-500 ml-1" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {getRoleText(messageUser.role)}
                              </Badge>
                              {messageUser.isPremium && (
                                <Badge variant="outline" className="text-xs bg-amber-100">
                                  Premium
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                  <div
                    className={`rounded-lg p-3 max-w-[70%] ${
                      msg.isSystemMessage
                        ? "bg-muted text-center w-full"
                        : isCurrentUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    {!msg.isSystemMessage && (
                      <div className="flex items-center gap-1 mb-1">
                        <p className="text-xs font-semibold">
                          {messageUser.username}
                        </p>
                        {messageUser.isVerified && (
                          <BadgeCheck className="h-3 w-3 text-blue-500" />
                        )}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1">
                          {getRoleText(messageUser.role)}
                        </Badge>
                      </div>
                    )}
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {format(new Date(msg.createdAt), "PPp")}
                    </p>
                  </div>
                  {isCurrentUser && (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Avatar className="h-8 w-8 cursor-pointer">
                          <AvatarImage src={currentUser.avatarUrl || ""} />
                          <AvatarFallback>{currentUser.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64">
                        <div className="flex justify-between space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={currentUser.avatarUrl || ""} />
                            <AvatarFallback>{currentUser.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <h4 className="text-sm font-semibold">{currentUser.username}</h4>
                              {currentUser.isVerified && (
                                <BadgeCheck className="h-4 w-4 text-blue-500 ml-1" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {getRoleText(currentUser.role)}
                              </Badge>
                              {currentUser.isPremium && (
                                <Badge variant="outline" className="text-xs bg-amber-100">
                                  Premium
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('complaints.typePlaceholder')}
            className="flex-1"
            disabled={
              sendMessageMutation.isPending || 
              complaint.status === "RESOLVED" || 
              complaint.status === "REJECTED"
            }
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={
              !message.trim() || 
              sendMessageMutation.isPending || 
              complaint.status === "RESOLVED" || 
              complaint.status === "REJECTED"
            }
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {(complaint.status === "RESOLVED" || complaint.status === "REJECTED") && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Этот тикет закрыт и больше не принимает сообщения
          </p>
        )}
      </form>

      {/* Диалог отклонения жалобы */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('complaints.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('complaints.rejectDescription')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('complaints.rejectPlaceholder')}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button 
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || rejectComplaintMutation.isPending}
            >
              {rejectComplaintMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('complaints.rejectButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Добавляем функцию для получения текста статуса
function getStatusText(status: string) {
  switch (status) {
    case "PENDING":
      return "В ожидании";
    case "IN_PROGRESS":
      return "В обработке";
    case "RESOLVED":
      return "Решено";
    case "REJECTED":
      return "Отклонено";
    default:
      return status;
  }
}

// Добавляем функцию для получения текста роли
function getRoleText(role: string) {
  switch (role) {
    case "OWNER":
      return "Владелец Площадки";
    case "SECURITY":
      return "Служба Безопасности";
    case "ADMIN":
      return "Админ";
    case "HEADADMIN":
      return "Вице-Админ";
    case "MODERATOR":
      return "Модератор";
    case "SHOP_OWNER":
      return "Владелец Магазина";
    case "SHOP_MAIN":
      return "Управляющий Магазина";
    case "SHOP_STAFF":
      return "Сотрудник Магазина";
    case "USER":
      return "Пользователь";
    default:
      return role;
  }
}

// Helper function to get a user-friendly role name
const getRoleName = (role: string) => {
  if (!role) return "";
  
  switch (role) {
    case UserRole.OWNER:
      return "Владелец Площадки";
    case UserRole.SECURITY:
      return "Служба Безопасности";
    case UserRole.ADMIN:
      return "Админ";
    case UserRole.HEADADMIN:
      return "Вице-Админ";
    case UserRole.MODERATOR:
      return "Модератор";
    case UserRole.SHOP_OWNER:
      return "Владелец Магазина";
    case UserRole.SHOP_MAIN:
      return "Управляющий Магазина";
    case UserRole.SHOP_STAFF:
      return "Сотрудник Магазина";
    default:
      return "Пользователь";
  }
};