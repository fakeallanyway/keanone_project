import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { 
  Loader2, 
  Store, 
  UserPlus, 
  User as UserIcon, 
  Search, 
  Shield, 
  UserCog, 
  XCircle,
  UserMinus
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Shop, User, UserRole } from "@shared/schema";

type ShopStaff = User & { roleName: string };

export default function StaffShopPage() {
  const [, params] = useRoute<{ id: string }>("/shops/:id/staff");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = useState(false);
  const [usernameToAdd, setUsernameToAdd] = useState("");
  const [roleToAssign, setRoleToAssign] = useState(UserRole.SHOP_STAFF);
  const [staffToRemove, setStaffToRemove] = useState<ShopStaff | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  
  if (!params) return null;
  const shopId = parseInt(params.id);

  // Получаем информацию о магазине
  const { data: shop, isLoading: isShopLoading } = useQuery<Shop>({
    queryKey: [`/api/shops/${shopId}`],
    queryFn: async () => {
      const response = await fetch(`/api/shops/${shopId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shop");
      }
      return response.json();
    },
  });

  // Получаем список сотрудников магазина
  const { data: staffList, isLoading: isStaffLoading } = useQuery<ShopStaff[]>({
    queryKey: [`/api/shops/${shopId}/staff`],
    queryFn: async () => {
      const response = await fetch(`/api/shops/${shopId}/staff`);
      if (!response.ok) {
        throw new Error("Failed to fetch shop staff");
      }
      return response.json();
    },
  });

  // Права доступа
  const canViewStaffPage = user && (
    user.role === UserRole.OWNER || 
    user.role === UserRole.SECURITY || 
    user.role === UserRole.ADMIN || 
    user.role === UserRole.HEADADMIN || 
    user.role === UserRole.SHOP_OWNER || 
    user.role === UserRole.SHOP_MAIN || 
    user.role === UserRole.SHOP_STAFF
  );

  // Права на редактирование сотрудников
  const canManageStaff = user && (
    user.role === UserRole.OWNER || 
    user.role === UserRole.SECURITY || 
    user.role === UserRole.ADMIN || 
    user.role === UserRole.HEADADMIN || 
    user.role === UserRole.SHOP_OWNER || 
    user.role === UserRole.SHOP_MAIN
  );

  // Полный админский доступ
  const hasFullAccess = user && (
    user.role === UserRole.OWNER || 
    user.role === UserRole.SECURITY
  );

  // Проверка, является ли пользователь владельцем или администратором магазина
  const isShopOwnerOrMain = user && shop && (
    user.id === shop.ownerId ||
    user.role === UserRole.SHOP_OWNER ||
    user.role === UserRole.SHOP_MAIN
  );

  // Мутация для добавления сотрудника
  const addStaffMutation = useMutation({
    mutationFn: async () => {
      // Дополнительная проверка данных
      if (!usernameToAdd.trim()) {
        throw new Error("Имя пользователя не может быть пустым");
      }
      if (!roleToAssign) {
        throw new Error("Необходимо выбрать роль");
      }
      
      console.log("Отправка запроса на добавление сотрудника:", {
        username: usernameToAdd.trim(),
        role: roleToAssign
      });
      
      const response = await fetch(`/api/shops/${shopId}/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usernameToAdd.trim(),
          role: roleToAssign
        }),
      });
      
      // Обработка ответа
      let errorData;
      try {
        if (!response.ok) {
          errorData = await response.json();
          console.error("Ошибка при добавлении сотрудника:", errorData);
          throw new Error(errorData.message || "Не удалось добавить сотрудника");
        }
        
        const result = await response.json();
        console.log("Успешно добавлен сотрудник:", result);
        return result;
      } catch (error) {
        console.error("Ошибка при обработке ответа:", error);
        if (errorData) {
          throw new Error(errorData.message || "Ошибка при добавлении сотрудника");
        }
        throw error;
      }
    },
    onSuccess: () => {
      console.log("onSuccess: Обновление списка сотрудников");
      queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/staff`] });
      toast({
        title: "Сотрудник добавлен",
        description: `Пользователь успешно добавлен в команду магазина`,
      });
      setIsAddStaffDialogOpen(false);
      setUsernameToAdd("");
      setRoleToAssign(UserRole.SHOP_STAFF); // Сбрасываем роль к значению по умолчанию
    },
    onError: (error: Error) => {
      console.error("onError: Ошибка при добавлении сотрудника:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Неизвестная ошибка при добавлении сотрудника",
        variant: "destructive",
      });
    },
  });

  // Мутация для удаления сотрудника
  const removeStaffMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/shops/${shopId}/staff/${userId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove staff member");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/staff`] });
      toast({
        title: "Сотрудник удален",
        description: `Пользователь удален из команды магазина`,
      });
      setIsRemoveDialogOpen(false);
      setStaffToRemove(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Мутация для изменения роли сотрудника
  const updateStaffRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: UserRole }) => {
      const response = await fetch(`/api/shops/${shopId}/staff/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update staff role");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/staff`] });
      toast({
        title: "Роль обновлена",
        description: "Роль сотрудника успешно обновлена",
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

  const handleAddStaff = () => {
    console.log("handleAddStaff вызван. Username:", usernameToAdd, "Role:", roleToAssign);
    
    // Проверяем выбранный метод добавления сотрудника
    const [addMethod, setAddMethod] = useState<'username' | 'select'>('username');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    
    // Переключатель между методами добавления сотрудника
    const toggleAddMethod = () => {
      setAddMethod(prev => prev === 'username' ? 'select' : 'username');
      // Сбрасываем значения при переключении
      setUsernameToAdd('');
      setSelectedUserId(null);
    };
    
    if (addMethod === 'username') {
      if (!usernameToAdd.trim()) {
        toast({
          title: "Ошибка",
          description: "Введите имя пользователя",
          variant: "destructive",
        });
        return;
      }
    } else if (addMethod === 'select') {
      if (!selectedUserId) {
        toast({
          title: "Ошибка",
          description: "Выберите пользователя из списка",
          variant: "destructive",
        });
        return;
      }
    } else {
      toast({
        title: "Ошибка",
        description: "Выберите метод добавления сотрудника",
        variant: "destructive",
      });
      return;
    }
    
    if (!roleToAssign) {
      toast({
        title: "Ошибка",
        description: "Выберите роль для сотрудника",
        variant: "destructive",
      });
      return;
    }
    
    // Явно вызываем мутацию для отправки запроса на сервер
    console.log("Вызываем addStaffMutation.mutate() с данными:", {
      username: usernameToAdd.trim(),
      role: roleToAssign
    });
    
    try {
      addStaffMutation.mutate();
    } catch (error) {
      console.error("Ошибка при вызове мутации:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить запрос",
        variant: "destructive",
      });
    }
  };

  const handleRemoveStaff = () => {
    if (staffToRemove) {
      removeStaffMutation.mutate(staffToRemove.id);
    }
  };

  // Фильтрация сотрудников по поисковому запросу
  const filteredStaff = staffList ? staffList.filter(staff => 
    staff.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (staff.displayName && staff.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    staff.roleName.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  // Функция для получения названия роли на русском
  const getRoleName = (role: string) => {
    switch (role) {
      case UserRole.SHOP_OWNER:
        return "Владелец Магазина";
      case UserRole.SHOP_MAIN:
        return "Управляющий Магазина";
      case UserRole.SHOP_STAFF:
        return "Сотрудник Магазина";
      default:
        return role;
    }
  };

  // Загрузка
  if (isShopLoading || isStaffLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // Магазин не найден
  if (!shop) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Магазин не найден</h1>
            <p className="text-muted-foreground mb-6">
              Запрашиваемый магазин не существует или был удален
            </p>
            <Button asChild>
              <Link href="/">Вернуться на главную</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Проверка прав доступа
  if (!canViewStaffPage) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Доступ запрещен</h1>
            <p className="text-muted-foreground mb-6">
              У вас нет прав для просмотра сотрудников этого магазина
            </p>
            <Button asChild>
              <Link href={`/shops/${shopId}`}>Вернуться к магазину</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold">Сотрудники магазина</h1>
              <p className="text-muted-foreground">{shop.name}</p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/shops/${shopId}`)}
              >
                <Store className="h-4 w-4 mr-2" />
                Вернуться к магазину
              </Button>
              
              {canManageStaff && (
                <Button 
                  onClick={() => setIsAddStaffDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Добавить сотрудника
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>Команда магазина</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Поиск сотрудников..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <CardDescription>
                Управляйте командой вашего магазина и назначайте роли сотрудникам
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {!staffList || staffList.length === 0 ? (
                <div className="text-center py-12">
                  <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">В магазине еще нет сотрудников</h3>
                  <p className="text-muted-foreground mb-6">
                    {canManageStaff 
                      ? "Добавьте первого сотрудника, чтобы начать формировать команду" 
                      : "В этом магазине пока не добавлены сотрудники"}
                  </p>
                  {canManageStaff && (
                    <Button onClick={() => setIsAddStaffDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Добавить сотрудника
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs border-b">
                          <th className="font-medium p-4 pb-3">Сотрудник</th>
                          <th className="font-medium p-4 pb-3">Роль</th>
                          <th className="font-medium p-4 pb-3">Дата добавления</th>
                          {canManageStaff && (
                            <th className="font-medium p-4 pb-3 text-right">Действия</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map((staff) => (
                          <tr key={staff.id} className="border-b last:border-none hover:bg-muted/50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={staff.avatarUrl || ""} alt={staff.username} />
                                  <AvatarFallback>
                                    <UserIcon className="h-5 w-5" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{staff.displayName || staff.username}</div>
                                  <div className="text-sm text-muted-foreground">@{staff.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className="font-normal">
                                {getRoleName(staff.role)}
                              </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {new Date(staff.createdAt).toLocaleDateString()}
                            </td>
                            {canManageStaff && (
                              <td className="p-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <UserCog className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {/* Изменение роли - только для определенных ролей */}
                                    {(hasFullAccess || isShopOwnerOrMain) && staff.role !== UserRole.SHOP_OWNER && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => updateStaffRoleMutation.mutate({ 
                                            userId: staff.id, 
                                            role: UserRole.SHOP_MAIN 
                                          })}
                                          disabled={staff.role === UserRole.SHOP_MAIN}
                                        >
                                          <Shield className="mr-2 h-4 w-4" />
                                          Назначить управляющим
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuItem
                                          onClick={() => updateStaffRoleMutation.mutate({ 
                                            userId: staff.id, 
                                            role: UserRole.SHOP_STAFF 
                                          })}
                                          disabled={staff.role === UserRole.SHOP_STAFF}
                                        >
                                          <UserIcon className="mr-2 h-4 w-4" />
                                          Назначить сотрудником
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    
                                    {/* Только полный доступ может менять роль SHOP_OWNER */}
                                    {hasFullAccess && (
                                      <DropdownMenuItem
                                        onClick={() => updateStaffRoleMutation.mutate({ 
                                          userId: staff.id, 
                                          role: UserRole.SHOP_OWNER 
                                        })}
                                        disabled={staff.role === UserRole.SHOP_OWNER}
                                      >
                                        <Shield className="mr-2 h-4 w-4" />
                                        Назначить владельцем
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {/* Удаление */}
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        setStaffToRemove(staff);
                                        setIsRemoveDialogOpen(true);
                                      }}
                                    >
                                      <UserMinus className="mr-2 h-4 w-4" />
                                      Удалить из команды
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredStaff.length === 0 && searchQuery && (
                    <div className="text-center py-8 text-muted-foreground">
                      Сотрудники не найдены по запросу "{searchQuery}"
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Диалог добавления сотрудника */}
      <Dialog open={isAddStaffDialogOpen} onOpenChange={setIsAddStaffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
            <DialogDescription>
              Введите имя пользователя и выберите роль для нового сотрудника магазина
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                placeholder="Введите имя пользователя"
                value={usernameToAdd}
                onChange={(e) => setUsernameToAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !addStaffMutation.isPending) {
                    e.preventDefault();
                    handleAddStaff();
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <Select
                value={roleToAssign}
                onValueChange={(value) => setRoleToAssign(value as UserRole)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  {hasFullAccess && (
                    <SelectItem value={UserRole.SHOP_OWNER}>
                      Владелец магазина
                    </SelectItem>
                  )}
                  <SelectItem value={UserRole.SHOP_MAIN}>
                    Управляющий магазина
                  </SelectItem>
                  <SelectItem value={UserRole.SHOP_STAFF}>
                    Сотрудник магазина
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddStaffDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                console.log("Кнопка Добавить нажата");
                handleAddStaff();
              }}
              disabled={addStaffMutation.isPending}
            >
              {addStaffMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить пользователя {staffToRemove?.username} из команды магазина?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveStaff}
              disabled={removeStaffMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {removeStaffMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 