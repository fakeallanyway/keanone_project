import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Complaint, ComplaintMessage, User, UserRole } from "@shared/schema";

import { ComplaintList } from "@/components/complaints/complaint-list";
import { ComplaintChat } from "@/components/complaints/complaint-chat";
import { CreateComplaintDialog } from "@/components/complaints/create-complaint-dialog";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";
import { apiRequest } from "@/lib/queryClient";

// Расширяем интерфейс Complaint для обращений в магазины
interface ComplaintWithShopInfo extends Complaint {
  isShopComplaint?: boolean;
  shopName?: string;
  shopId?: number;
}

export default function ComplaintsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Проверяем, является ли пользователь администратором или другим сотрудником
  const isStaff = user && (
    user.role === UserRole.OWNER ||
    user.role === UserRole.SECURITY ||
    user.role === UserRole.ADMIN || 
    user.role === UserRole.HEADADMIN ||
    user.role === UserRole.MODERATOR 
  );

  // Получаем список жалоб в зависимости от роли пользователя
  const { data: complaints, isLoading: isComplaintsLoading, refetch: refetchComplaints } = useQuery<ComplaintWithShopInfo[]>({
    queryKey: [isStaff ? "/api/complaints" : "/api/complaints/user"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", isStaff ? "/api/complaints" : "/api/complaints/user");
        const data = await res.json();
        console.log("Получены жалобы:", data);
        return data;
      } catch (error) {
        console.error("Ошибка при получении жалоб:", error);
        return [];
      }
    },
    refetchInterval: 10000, // Обновляем каждые 10 секунд
    staleTime: 5000, // Данные считаются устаревшими через 5 секунд
  });

  // Получаем выбранное обращение
  const { data: selectedComplaint, isLoading: isComplaintLoading } = useQuery<ComplaintWithShopInfo>({
    queryKey: ["/api/complaints", selectedComplaintId],
    queryFn: async () => {
      if (!selectedComplaintId) return null;
      
      // Найдем жалобу в уже загруженном списке
      const foundComplaint = complaints?.find(c => c.id === selectedComplaintId);
      
      // Если это обращение в магазин, получаем его из конкретного API для магазинов
      if (foundComplaint?.isShopComplaint && foundComplaint.shopId) {
        const res = await apiRequest("GET", `/api/shops/${foundComplaint.shopId}/complaints/${selectedComplaintId}`);
        const shopComplaint = await res.json();
        return {
          ...shopComplaint,
          isShopComplaint: true,
          shopId: foundComplaint.shopId,
          shopName: foundComplaint.shopName
        };
      } else {
        // Если это обычное обращение, получаем его из API для обычных обращений
        const res = await apiRequest("GET", `/api/complaints/${selectedComplaintId}`);
        const complaint = await res.json();
        return { ...complaint, isShopComplaint: false };
      }
    },
    enabled: !!selectedComplaintId && !!complaints,
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  // Получаем сообщения для выбранной жалобы
  const { data: messages, isLoading: isMessagesLoading } = useQuery<ComplaintMessage[]>({
    queryKey: ["/api/complaints", selectedComplaintId, "messages", selectedComplaint?.isShopComplaint],
    queryFn: async () => {
      if (!selectedComplaintId || !selectedComplaint) return [];
      
      // Для обращений в магазины используем другой API-эндпоинт
      if (selectedComplaint.isShopComplaint && selectedComplaint.shopId) {
        const res = await apiRequest("GET", `/api/shops/${selectedComplaint.shopId}/complaints/${selectedComplaintId}/messages`);
        return res.json();
      } else {
        // Для обычных обращений используем стандартный API-эндпоинт
        const res = await apiRequest("GET", `/api/complaints/${selectedComplaintId}/messages`);
        return res.json();
      }
    },
    enabled: !!selectedComplaintId && !!selectedComplaint,
    refetchInterval: 3000, // Обновляем каждые 3 секунды
  });

  // Получаем информацию о сотруднике, назначенном на жалобу
  const { data: assignedStaff } = useQuery<User>({
    queryKey: ["/api/users", selectedComplaint?.assignedToId],
    queryFn: async () => {
      if (!selectedComplaint?.assignedToId) return null;
      const res = await apiRequest("GET", `/api/users/${selectedComplaint.assignedToId}`);
      return res.json();
    },
    enabled: !!selectedComplaint?.assignedToId,
  });

  // Автоматически выбираем первую жалобу, если ни одна не выбрана
  useEffect(() => {
    if (!selectedComplaintId && complaints && complaints.length > 0) {
      setSelectedComplaintId(complaints[0].id);
    }
  }, [complaints, selectedComplaintId]);

  // Обновляем список жалоб при открытии/закрытии диалога создания жалобы
  useEffect(() => {
    if (!isCreateDialogOpen) {
      // Обновляем список жалоб после закрытия диалога
      setTimeout(() => {
        refetchComplaints();
      }, 500);
    }
  }, [isCreateDialogOpen, refetchComplaints]);

  // Проверяем, загружены ли все необходимые данные
  const isLoading = isComplaintsLoading || (selectedComplaintId && (isComplaintLoading || isMessagesLoading));

  // Обработчик выбора жалобы
  const handleSelectComplaint = (complaintId: number) => {
    setSelectedComplaintId(complaintId);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t('complaints.title')}</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('Создать обращение')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : complaints && complaints.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <ComplaintList
                complaints={complaints}
                selectedId={selectedComplaintId}
                onSelect={handleSelectComplaint}
              />
            </div>
            <div className="md:col-span-2">
              {selectedComplaint && messages && (
                <ComplaintChat
                  complaint={selectedComplaint}
                  messages={messages}
                  currentUser={user}
                  assignedStaff={assignedStaff}
                  isShopComplaint={selectedComplaint.isShopComplaint}
                  shopId={selectedComplaint.shopId}
                />
              )}
            </div>
          </div>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('complaints.noComplaints')}</h2>
            <p className="text-muted-foreground text-center mb-4">
              {t('Имеются вопросы/жалобы? Создайте обращение в службу поддержки!')}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('Создать обращение')}
            </Button>
          </Card>
        )}

        <CreateComplaintDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </main>
    </div>
  );
}