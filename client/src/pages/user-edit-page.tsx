import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, UserCog, Shield, CheckCircle, Crown, Ban, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export default function UserEditPage() {
  const [, params] = useRoute<{ id: string }>("/users/:id/edit");
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [blockReason, setBlockReason] = useState("");
  const [blockDuration, setBlockDuration] = useState("permanent");

  // State for user form
  const [formData, setFormData] = useState<{
    displayName: string;
    username: string;
    role: string;
    isPremium: boolean;
    isVerified: boolean;
    avatarUrl: string;
  }>({
    displayName: "",
    username: "",
    role: UserRole.USER,
    isPremium: false,
    isVerified: false,
    avatarUrl: "",
  });

  // Fetch user data
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["user", params?.id],
    queryFn: async () => {
      if (!params?.id) throw new Error("User ID is required");
      const response = await apiRequest("GET", `/api/users/${params.id}`);
      return response.json();
    },
    enabled: !!params?.id,
  });

  // Permissions check
  const canModifyRole = currentUser?.role === UserRole.OWNER || 
                         currentUser?.role === UserRole.SECURITY || 
                         currentUser?.role === UserRole.ADMIN;

  const canModifyUserStatus = canModifyRole || 
                             currentUser?.role === UserRole.HEADADMIN;

  // Set form data when user is loaded
  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || "",
        username: user.username,
        role: user.role,
        isPremium: user.isPremium || false,
        isVerified: user.isVerified || false,
        avatarUrl: user.avatarUrl || "",
      });
    }
  }, [user]);

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      if (!params?.id) throw new Error("User ID is required");
      const response = await apiRequest("PATCH", `/api/users/${params.id}/status`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Информация о пользователе обновлена",
      });
      queryClient.invalidateQueries({ queryKey: ["user", params?.id] });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при обновлении пользователя",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      if (!params?.id) throw new Error("User ID is required");
      const response = await apiRequest("PATCH", `/api/users/${params.id}/role`, {
        role
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Роль пользователя обновлена",
      });
      queryClient.invalidateQueries({ queryKey: ["user", params?.id] });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при обновлении роли",
        variant: "destructive",
      });
    },
  });

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { isPremium?: boolean; isVerified?: boolean }) => {
      if (!params?.id) throw new Error("User ID is required");
      const response = await apiRequest("PATCH", `/api/users/${params.id}/status`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Успех",
        description: "Статус пользователя обновлен",
      });
      queryClient.invalidateQueries({ queryKey: ["user", params?.id] });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при обновлении статуса",
        variant: "destructive",
      });
    },
  });

  // Block user mutation
  const blockUserMutation = useMutation({
    mutationFn: async ({ reason, duration }: { reason: string; duration?: string }) => {
      if (!params?.id) throw new Error("User ID is required");
      const response = await apiRequest("PATCH", `/api/users/${params.id}/block`, {
        reason,
        duration
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Пользователь заблокирован",
        description: "Пользователь был успешно заблокирован",
      });
      queryClient.invalidateQueries({ queryKey: ["user", params?.id] });
      setBlockReason("");
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при блокировке пользователя",
        variant: "destructive",
      });
    },
  });

  // Unblock user mutation
  const unblockUserMutation = useMutation({
    mutationFn: async () => {
      if (!params?.id) throw new Error("User ID is required");
      const response = await apiRequest("PATCH", `/api/users/${params.id}/unblock`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Пользователь разблокирован",
        description: "Пользователь был успешно разблокирован",
      });
      queryClient.invalidateQueries({ queryKey: ["user", params?.id] });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Произошла ошибка при разблокировке пользователя",
        variant: "destructive",
      });
    },
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle toggle switches
  const handleToggleChange = (name: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // For isPremium and isVerified, update the status immediately
    if (name === "isPremium" || name === "isVerified") {
      updateStatusMutation.mutate({ [name]: value });
    }
  };

  // Handle role change
  const handleRoleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      role: value
    }));
    updateRoleMutation.mutate(value);
  };

  // Handle general user data update
  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateUserMutation.mutate({
      displayName: formData.displayName,
      avatarUrl: formData.avatarUrl,
    });
  };

  // Handle blocking user
  const handleBlockUser = () => {
    if (!blockReason.trim()) {
      toast({
        title: "Ошибка",
        description: "Необходимо указать причину блокировки",
        variant: "destructive",
      });
      return;
    }

    blockUserMutation.mutate({
      reason: blockReason,
      duration: blockDuration !== "permanent" ? blockDuration : undefined
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Ошибка загрузки пользователя</h1>
            <p className="text-muted-foreground mb-6">
              Пользователь не найден или произошла ошибка при загрузке данных
            </p>
            <Button onClick={() => setLocation("/admin")}>Вернуться в панель администратора</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold flex items-center">
              <UserCog className="mr-2 h-7 w-7" />
              Редактирование пользователя
            </h1>
            <Button variant="outline" onClick={() => setLocation(`/users/${params?.id}`)}>
              Просмотр профиля
            </Button>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user.avatarUrl || ""} />
                  <AvatarFallback>{user.displayName?.charAt(0) || user.username.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{user.displayName || user.username}</CardTitle>
                  <CardDescription>ID: {user.id} • @{user.username}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="general">Основная информация</TabsTrigger>
              <TabsTrigger value="permissions">Права и статусы</TabsTrigger>
              <TabsTrigger value="security">Безопасность</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Основная информация</CardTitle>
                  <CardDescription>
                    Редактирование основной информации пользователя
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Имя пользователя</Label>
                      <Input
                        id="username"
                        name="username"
                        value={formData.username}
                        disabled
                      />
                      <p className="text-sm text-muted-foreground">
                        Имя пользователя нельзя изменить
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="displayName">Отображаемое имя</Label>
                      <Input
                        id="displayName"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avatarUrl">URL аватара</Label>
                      <Input
                        id="avatarUrl"
                        name="avatarUrl"
                        value={formData.avatarUrl}
                        onChange={handleInputChange}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="mt-4"
                      disabled={updateUserMutation.isPending}
                    >
                      {updateUserMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Save className="mr-2 h-4 w-4" />
                      Сохранить изменения
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="permissions">
              <Card>
                <CardHeader>
                  <CardTitle>Права и статусы</CardTitle>
                  <CardDescription>
                    Управление ролью и статусами пользователя
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="role">Роль пользователя</Label>
                    <Select
                      disabled={!canModifyRole}
                      value={formData.role}
                      onValueChange={handleRoleChange}
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Выберите роль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UserRole.USER}>Пользователь</SelectItem>
                        <SelectItem value={UserRole.MODERATOR}>Модератор</SelectItem>
                        {(currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.SECURITY) && (
                          <>
                            <SelectItem value={UserRole.ADMIN}>Админ</SelectItem>
                            <SelectItem value={UserRole.HEADADMIN}>Вице-Админ</SelectItem>
                          </>
                        )}
                        {currentUser?.role === UserRole.OWNER && (
                          <SelectItem value={UserRole.SECURITY}>Служба Безопасности</SelectItem>
                        )}
                        <SelectItem value={UserRole.SHOP_OWNER}>Владелец Магазина</SelectItem>
                        <SelectItem value={UserRole.SHOP_MAIN}>Управляющий Магазина</SelectItem>
                        <SelectItem value={UserRole.SHOP_STAFF}>Сотрудник Магазина</SelectItem>
                      </SelectContent>
                    </Select>
                    {!canModifyRole && (
                      <p className="text-sm text-muted-foreground">
                        У вас недостаточно прав для изменения роли пользователя
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center">
                        <Crown className="mr-2 h-4 w-4 text-amber-500" />
                        Премиум статус
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Даёт пользователю дополнительные возможности
                      </span>
                    </div>
                    <Switch
                      checked={formData.isPremium}
                      onCheckedChange={(checked) => handleToggleChange("isPremium", checked)}
                      disabled={!canModifyUserStatus || updateStatusMutation.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center">
                        <CheckCircle className="mr-2 h-4 w-4 text-blue-500" />
                        Верификация
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Подтверждает подлинность пользователя
                      </span>
                    </div>
                    <Switch
                      checked={formData.isVerified}
                      onCheckedChange={(checked) => handleToggleChange("isVerified", checked)}
                      disabled={!canModifyUserStatus || updateStatusMutation.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Безопасность</CardTitle>
                  <CardDescription>
                    Управление статусом блокировки пользователя
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-md border p-4">
                    <div className="flex items-center">
                      <div className={`h-3 w-3 rounded-full mr-2 ${user.isBlocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
                      <span className="font-medium">
                        Статус: {user.isBlocked ? 'Заблокирован' : 'Активен'}
                      </span>
                    </div>
                    
                    {user.isBlocked && user.blockReason && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">
                          Причина блокировки: {user.blockReason}
                        </p>
                        {user.blockExpiresAt && (
                          <p className="text-sm text-muted-foreground">
                            Дата окончания блокировки: {new Date(user.blockExpiresAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {user.isBlocked ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => unblockUserMutation.mutate()}
                      disabled={unblockUserMutation.isPending}
                    >
                      {unblockUserMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Shield className="mr-2 h-4 w-4" />
                      Разблокировать пользователя
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Заблокировать пользователя
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Блокировка пользователя</AlertDialogTitle>
                          <AlertDialogDescription>
                            Вы собираетесь заблокировать пользователя {user.displayName || user.username}.
                            Блокировка ограничит доступ пользователя к платформе.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="blockReason">Причина блокировки</Label>
                            <Textarea
                              id="blockReason"
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              placeholder="Укажите причину блокировки"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="blockDuration">Срок блокировки</Label>
                            <Select
                              value={blockDuration}
                              onValueChange={setBlockDuration}
                            >
                              <SelectTrigger id="blockDuration">
                                <SelectValue placeholder="Выберите срок блокировки" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="permanent">Навсегда</SelectItem>
                                <SelectItem value="1d">1 день</SelectItem>
                                <SelectItem value="7d">7 дней</SelectItem>
                                <SelectItem value="30d">30 дней</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleBlockUser}
                            disabled={blockUserMutation.isPending}
                          >
                            {blockUserMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Заблокировать
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
} 