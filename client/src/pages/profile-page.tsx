import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Complaint, UpdateUserProfile, UserRole } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserProfileSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon, CheckCircle, ShoppingBag, Upload, Package, Calendar, ExternalLink, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";

// Интерфейс для заказа
interface Order {
  id: number;
  createdAt: string;
  status: string;
  total: number;
  items: OrderItem[];
  shopId: number;
  shopName: string;
}

// Интерфейс для товара в заказе
interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(user?.avatarUrl || null);
  
  // Проверяем, является ли пользователь обычным пользователем
  const isRegularUser = user?.role === UserRole.USER;

  // Получаем данные о транзакциях пользователя (только для не обычных пользователей)
  const { data: transactionsData } = useQuery({
    queryKey: ["/api/user/transactions/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/transactions/stats");
      return res.json();
    },
    enabled: !isRegularUser, // Запрос выполняется только если пользователь не обычный
  });

  const { data: complaints } = useQuery<Complaint[]>({
    queryKey: ["/api/complaints/user"],
  });

  const updateProfileForm = useForm({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      avatarUrl: user?.avatarUrl || "",
    },
  });

  const updatePasswordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Успешно!",
        description: "Профиль успешно обновлен.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/user/password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Успешно!",
        description: "Пароль успешно обновлен.",
      });
      updatePasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Запрос истории покупок пользователя
  const { data: orders, isLoading: isOrdersLoading } = useQuery<Order[]>({
    queryKey: ["/api/user/orders"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user/orders");
        return res.json();
      } catch (error) {
        console.error("Ошибка при получении истории покупок:", error);
        return [];
      }
    }
  });

  // Функция для получения текста статуса заказа
  const getOrderStatusText = (status: string) => {
    switch (status) {
      case "PENDING":
        return "В обработке";
      case "CONFIRMED":
        return "Подтвержден";
      case "SHIPPED":
        return "Отправлен";
      case "DELIVERED":
        return "Доставлен";
      case "CANCELLED":
        return "Отменен";
      default:
        return status;
    }
  };

  // Функция для получения варианта бейджа в зависимости от статуса заказа
  const getOrderStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "CONFIRMED":
        return "outline";
      case "SHIPPED":
        return "default";
      case "DELIVERED":
        return "default";
      case "CANCELLED":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-6">Настройки профиля</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="security">Безопасность</TabsTrigger>
            <TabsTrigger value="buyhistory">История покупок</TabsTrigger>
            <TabsTrigger value="reports">Жалобы</TabsTrigger>
            <TabsTrigger value="bio">Прочее</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Информация профиля</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={updateProfileForm.handleSubmit((data) => {
                      updateProfileMutation.mutate(data);
                    })}
                    className="space-y-4"
                  >
                    <div className="flex flex-col items-center gap-4 mb-6">
                      <div className="relative">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={previewAvatar} />
                          <AvatarFallback>
                            <UserIcon className="h-12 w-12" />
                          </AvatarFallback>
                        </Avatar>
                        {user?.isVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-[3px]">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="w-full">
                        <Label htmlFor="avatarUrl">URL аватара</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="avatarUrl"
                            {...updateProfileForm.register("avatarUrl")}
                            onChange={(e) => {
                              updateProfileForm.setValue("avatarUrl", e.target.value);
                              setPreviewAvatar(e.target.value);
                            }}
                            placeholder="https://example.com/avatar.jpg"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Введите URL изображения для вашего аватара
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Имя пользователя (логин)</Label>
                      <Input value={user?.username} disabled />
                      <p className="text-sm text-muted-foreground">
                        Логин нельзя изменить
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="displayName">Отображаемое имя</Label>
                      <Input
                        id="displayName"
                        {...updateProfileForm.register("displayName")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Аккаунт создан</Label>
                      <p className="text-sm">
                        {user?.createdAt && format(new Date(user.createdAt), "PPpp")}
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Обновить профиль
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Статус аккаунта</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Статус:</span>
                        <Badge variant={user?.isPremium ? "secondary" : "outline"}>
                          {user?.isPremium ? "Премиум" : "Стандарт"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Верификация:</span>
                        <Badge variant={user?.isVerified ? "default" : "outline"} className={user?.isVerified ? "bg-green-100 text-green-800" : ""}>
                          {user?.isVerified ? "Верифицирован" : "Не верифицирован"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Роль:</span>
                        <Badge variant={user?.role === UserRole.OWNER ? "default" : "outline"}>
                          {user?.role}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {!isRegularUser && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Статистика сделок</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Всего сделок</p>
                            <p className="text-2xl font-bold">
                              {transactionsData?.total || 0}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Изменение пароля</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={updatePasswordForm.handleSubmit((data) => {
                    if (data.newPassword !== data.confirmPassword) {
                      toast({
                        title: "Ошибка",
                        description: "Пароли не совпадают",
                        variant: "destructive",
                      });
                      return;
                    }
                    updatePasswordMutation.mutate({
                      currentPassword: data.currentPassword,
                      newPassword: data.newPassword,
                    });
                  })}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Текущий пароль</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      {...updatePasswordForm.register("currentPassword")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Новый пароль</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      {...updatePasswordForm.register("newPassword")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      {...updatePasswordForm.register("confirmPassword")}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={updatePasswordMutation.isPending}
                  >
                    {updatePasswordMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Изменить пароль
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyhistory">
            <Card>
              <CardHeader>
                <CardTitle>История покупок</CardTitle>
                <CardDescription>
                  Здесь вы можете просмотреть историю ваших заказов на платформе
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isOrdersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : orders && orders.length > 0 ? (
                  <div className="space-y-6">
                    {orders.map((order) => (
                      <Card key={order.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Заказ #{order.id}
                              </CardTitle>
                              <CardDescription className="flex items-center mt-1">
                                <Calendar className="h-4 w-4 mr-1" />
                                {format(new Date(order.createdAt), "dd.MM.yyyy HH:mm")}
                              </CardDescription>
                            </div>
                            <Badge variant={getOrderStatusBadgeVariant(order.status)}>
                              {getOrderStatusText(order.status)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">
                              Магазин: {order.shopName}
                            </div>
                            <div className="border rounded-md">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Товар</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {order.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="px-4 py-2 text-sm">{item.productName}</td>
                                      <td className="px-4 py-2 text-sm">{item.quantity}</td>
                                      <td className="px-4 py-2 text-sm">{item.price} ₽</td>
                                      <td className="px-4 py-2 text-sm">{item.price * item.quantity} ₽</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={3} className="px-4 py-2 text-right font-medium">Итого:</td>
                                    <td className="px-4 py-2 font-bold">{order.total} ₽</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 flex justify-end py-2">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Подробнее
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                    <div className="text-center">
                      <h3 className="text-lg font-medium">У вас пока нет заказов</h3>
                      <p className="text-sm text-muted-foreground">
                        После совершения покупок ваши заказы появятся здесь
                      </p>
                    </div>
                    <Button onClick={() => window.location.href = '/catalog'}>
                      <Search className="h-4 w-4 mr-2" />
                      Перейти в каталог
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Мои жалобы</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complaints?.map((complaint) => (
                    <div
                      key={complaint.id}
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{complaint.title}</h3>
                        <Badge
                          variant={
                            complaint.status === "RESOLVED"
                              ? "outline"
                              : complaint.status === "PENDING"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {complaint.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {complaint.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Отправлено {format(new Date(complaint.createdAt), "PPp")}
                      </p>
                    </div>
                  ))}

                  {!complaints?.length && (
                    <p className="text-center text-muted-foreground">
                      Жалобы не найдены
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bio">
            <Card>
              <CardHeader>
                <CardTitle>Прочее</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="space-y-2">
                      <Label htmlFor="displayName">бля бля бля</Label>
                      <Input
                        placeholder="Когда-то тут что-то да будет...)"
                        {...updateProfileForm.register("displayName")}
                      />
                    </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
