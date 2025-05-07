import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Complaint, ComplaintMessage, UserRole } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComplaintChat } from "@/components/complaints/complaint-chat";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComplaintList } from "@/components/complaints/complaint-list";
import { CreateComplaintDialog } from "@/components/complaints/create-complaint-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// Define types for the API responses
interface Shop {
  id: number;
  name: string;
  // Add other properties as needed
}

interface ShopComplaint extends Complaint {
  shopId: number;
}

export default function ShopAppealPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Проверяем, является ли пользователь сотрудником магазина
  const userIsShopStaff = user && (
    user.role === UserRole.SHOP_OWNER || 
    user.role === UserRole.SHOP_MAIN || 
    user.role === UserRole.SHOP_STAFF
  );
  
  // Получаем список магазинов пользователя
  const { data: shops, isLoading: isLoadingShops } = useQuery<Shop[]>({
    queryKey: ["/api/user/shops"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/shops");
      return response.json();
    },
    enabled: !!user && !!userIsShopStaff
  });
  
  // Получаем список обращений в выбранный магазин
  const { data: complaints, isLoading: isLoadingComplaints } = useQuery<ShopComplaint[]>({
    queryKey: [`/api/shops/${selectedShopId}/complaints`],
    queryFn: async () => {
      if (!selectedShopId) return [];
      const response = await apiRequest("GET", `/api/shops/${selectedShopId}/complaints`);
      return response.json();
    },
    enabled: !!selectedShopId
  });
  
  // Получаем данные выбранного обращения
  const { data: selectedComplaint } = useQuery<ShopComplaint>({
    queryKey: [`/api/shops/${selectedShopId}/complaints`, selectedComplaintId],
    queryFn: async () => {
      if (!selectedShopId || !selectedComplaintId) return null;
      const response = await apiRequest("GET", `/api/shops/${selectedShopId}/complaints/${selectedComplaintId}`);
      return response.json();
    },
    enabled: !!selectedShopId && !!selectedComplaintId
  });
  
  // Получаем сообщения выбранного обращения
  const { data: messages } = useQuery<ComplaintMessage[]>({
    queryKey: [`/api/shops/${selectedShopId}/complaints`, selectedComplaintId, "messages"],
    queryFn: async () => {
      if (!selectedShopId || !selectedComplaintId) return [];
      const response = await apiRequest("GET", `/api/shops/${selectedShopId}/complaints/${selectedComplaintId}/messages`);
      return response.json();
    },
    enabled: !!selectedShopId && !!selectedComplaintId
  });
  
  // Получаем информацию о сотруднике, назначенном на обращение
  const { data: assignedStaff } = useQuery<{id: number; username: string; role: UserRole}>({
    queryKey: [`/api/shops/${selectedShopId}/complaints`, selectedComplaintId, "assigned-staff"],
    queryFn: async () => {
      if (!selectedShopId || !selectedComplaintId || !selectedComplaint?.assignedToId) return null;
      const response = await apiRequest("GET", `/api/users/${selectedComplaint.assignedToId}`);
      return response.json();
    },
    enabled: !!selectedShopId && !!selectedComplaintId && !!selectedComplaint?.assignedToId
  });
  
  // Автоматический выбор первого магазина, если список загружен и нет выбранного
  useEffect(() => {
    if (shops && shops.length > 0 && !selectedShopId) {
      setSelectedShopId(shops[0].id);
    }
  }, [shops, selectedShopId]);
  
  // Автоматический выбор первого обращения, если список загружен и нет выбранного
  useEffect(() => {
    if (complaints && complaints.length > 0 && !selectedComplaintId) {
      setSelectedComplaintId(complaints[0].id);
    } else if (complaints && complaints.length === 0) {
      setSelectedComplaintId(null);
    }
  }, [complaints, selectedComplaintId]);

  // Обновляем список обращений при закрытии диалога создания обращения
  useEffect(() => {
    if (!isCreateDialogOpen && selectedShopId) {
      // Небольшая задержка перед обновлением данных
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${selectedShopId}/complaints`] });
      }, 500);
    }
  }, [isCreateDialogOpen, queryClient, selectedShopId]);
  
  // Если пользователь загружается, показываем скелетон
  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="container mx-auto py-6 space-y-4">
            <Skeleton className="h-10 w-[250px]" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-[500px]" />
              <Skeleton className="h-[500px] md:col-span-2" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // Если пользователь не авторизован или не является сотрудником магазина
  if (!user || !userIsShopStaff) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="container mx-auto py-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('shopAppeals.noAccess') || "Нет доступа"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{t('shopAppeals.staffOnly') || "Только сотрудники магазина могут просматривать эту страницу"}</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  
  // Если у пользователя нет доступных магазинов
  if (shops && shops.length === 0) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="container mx-auto py-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('shopAppeals.noShops') || "Нет магазинов"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{t('shopAppeals.needToBeAssociated') || "Вы должны быть связаны с магазином, чтобы просматривать обращения"}</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="container mx-auto py-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">{t('shopAppeals.title') || "Обращения в магазин"}</h1>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('complaints.createNew') || "Создать обращение"}
              </Button>
            </div>
            
            {shops && shops.length > 0 && (
              <Select
                value={selectedShopId?.toString()}
                onValueChange={(value) => {
                  setSelectedShopId(parseInt(value));
                  setSelectedComplaintId(null);
                }}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder={t('shopAppeals.selectShop') || "Выберите магазин"} />
                </SelectTrigger>
                <SelectContent>
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id.toString()}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{t('shopAppeals.complaintsList') || "Список обращений"}</span>
                  {complaints && complaints.length > 0 && (
                    <Badge>{complaints.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingComplaints ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : complaints && complaints.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <ComplaintList
                      complaints={complaints}
                      selectedId={selectedComplaintId}
                      onSelect={(id) => setSelectedComplaintId(id)}
                    />
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <p className="text-center text-muted-foreground">
                      {t('shopAppeals.noComplaints') || "Нет обращений"}
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('complaints.createNew') || "Создать обращение"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedComplaint ? selectedComplaint.title : t('shopAppeals.selectComplaintToView') || "Выберите обращение для просмотра"}
                  {selectedComplaint && (
                    <Badge
                      variant={
                        selectedComplaint.status === "PENDING"
                          ? "outline"
                          : selectedComplaint.status === "IN_PROGRESS"
                          ? "default"
                          : selectedComplaint.status === "RESOLVED"
                          ? "secondary"
                          : "destructive"
                      }
                      className="ml-2"
                    >
                      {getStatusText(selectedComplaint.status)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedComplaint && messages && user ? (
                  <ComplaintChat
                    complaint={selectedComplaint}
                    messages={messages}
                    currentUser={user}
                    assignedStaff={assignedStaff as any}
                    isShopComplaint={true}
                    shopId={selectedShopId}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                    {selectedComplaintId ? (
                      <p>{t('shopAppeals.loadingChat') || "Загрузка чата..."}</p>
                    ) : (
                      <p>{t('shopAppeals.noComplaintSelected') || "Выберите обращение из списка"}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Диалог создания обращения */}
        <CreateComplaintDialog 
          open={isCreateDialogOpen} 
          onOpenChange={setIsCreateDialogOpen} 
        />
      </main>
    </div>
  );
}

// Функция для получения текста статуса обращения
function getStatusText(status: string): string {
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