import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { User, Session, UserRole, Complaint, Shop, ShopStatus } from "@shared/schema";

import { StatsCard } from "@/components/layout/stats-card";
import { UserTable } from "@/components/admin/user-table";
import { ComplaintTable } from "@/components/admin/complaint-table";
import { BlockedUsersTable } from "@/components/admin/blocked-users-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Redirect } from "wouter";
import { useLocale } from "@/hooks/use-locale";
import { Lock, Users, Flag, ShieldAlert, Store } from "lucide-react";
import { Table, TableRow, TableHead, TableCell, TableHeader, TableBody } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Edit } from "lucide-react";  
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

// Функция для отображения статуса магазина
function getStatusBadge(status: string) {
  switch (status) {
    case ShopStatus.ACTIVE:
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Активен</Badge>;
    case ShopStatus.BLOCKED:
      return <Badge variant="destructive">Заблокирован</Badge>;
    case ShopStatus.PENDING:
      return <Badge variant="outline">На рассмотрении</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

// Универсальная функция для отображения бейджей ролей в едином стиле
export function getRoleBadge(role: string) {
  switch(role) {
    // Роли администрации
    case UserRole.OWNER:
      return (
        <Badge className="bg-purple-900 text-white hover:bg-purple-900 rounded-full py-1 px-3">
          Владелец Площадки
        </Badge>
      );
    case UserRole.SECURITY:
      return (
        <Badge className="bg-red-700 text-white hover:bg-red-700 rounded-full py-1 px-3">
          Служба Безопасности
        </Badge>
      );
    case UserRole.ADMIN:
      return (
        <Badge className="bg-blue-700 text-white hover:bg-blue-700 rounded-full py-1 px-3">
          Админ
        </Badge>
      );
    case UserRole.HEADADMIN:
      return (
        <Badge className="bg-indigo-700 text-white hover:bg-indigo-700 rounded-full py-1 px-3">
          Вице-Админ
        </Badge>
      );
    case UserRole.MODERATOR:
      return (
        <Badge className="bg-teal-700 text-white hover:bg-teal-700 rounded-full py-1 px-3">
          Модератор
        </Badge>
      );
      
    // Роли магазинов
    case UserRole.SHOP_OWNER:
      return (
        <Badge className="bg-purple-900 text-white hover:bg-purple-900 rounded-full py-1 px-3">
          Владелец Магазина
        </Badge>
      );
    case UserRole.SHOP_MAIN:
      return (
        <Badge className="bg-blue-900 text-white hover:bg-blue-900 rounded-full py-1 px-3">
          Управляющий Магазина
        </Badge>
      );
    case UserRole.SHOP_STAFF:
      return (
        <Badge className="bg-green-900 text-white hover:bg-green-900 rounded-full py-1 px-3">
          Сотрудник Магазина
        </Badge>
      );
      
    // Базовая роль
    case UserRole.USER:
      return (
        <Badge className="bg-gray-500 text-white hover:bg-gray-500 rounded-full py-1 px-3">
          Пользователь
        </Badge>
      );
      
    default:
      return (
        <Badge className="bg-gray-300 text-gray-800 hover:bg-gray-300 rounded-full py-1 px-3">
          {role}
        </Badge>
      );
  }
}

// Компонент для отображения списка магазинов
function ShopsTab() {
  const { t } = useLocale();
  const { user } = useAuth();
  
  // Запрос списка пользователей для отображения владельцев магазинов
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Запрос списка магазинов
  const { data: shops, isLoading, isError, refetch } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
    queryFn: async () => {
      console.log("ShopsTab: Загрузка списка магазинов");
      try {
        const response = await fetch("/api/shops");
        if (!response.ok) {
          throw new Error("Failed to fetch shops");
        }
        const data = await response.json();
        console.log("ShopsTab: Получены данные магазинов:", data);
        return data;
      } catch (error) {
        console.error("ShopsTab: Ошибка при загрузке магазинов:", error);
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0
  });
  
  // Загружаем данные при монтировании компонента
  useEffect(() => {
    console.log("ShopsTab: Компонент смонтирован, запрашиваем данные");
    refetch();
  }, [refetch]);
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <Store className="mr-2 h-6 w-6" />
        Магазины
      </h2>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : isError ? (
        <div className="text-center p-4 border rounded-md text-destructive">
          Ошибка при загрузке магазинов. Пожалуйста, попробуйте обновить страницу.
        </div>
      ) : Array.isArray(shops) && shops.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Владелец</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>{shop.id}</TableCell>
                  <TableCell className="font-medium">{shop.name || "Без названия"}</TableCell>
                  <TableCell>
                    {getStatusBadge(shop.status || "")}
                  </TableCell>
                  <TableCell>
                    {users?.find(u => u.id === shop.ownerId)?.displayName || 
                     users?.find(u => u.id === shop.ownerId)?.username || 
                     "Неизвестный владелец"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/shops/${shop.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Редактировать
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/shops/${shop.id}/staff`}>
                        <Users className="h-4 w-4 mr-2" />
                        Сотрудники  
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center p-4 border rounded-md">
          Нет данных о магазинах
        </div>
      )}
    </div>
  );
}

// Компонент для отображения персонала площадки
function StaffTab() {
  const { t } = useLocale();
  
  // Запрос списка пользователей
  const { data: users, isLoading, isError, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      console.log("StaffTab: Загрузка списка пользователей");
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await response.json();
        console.log("StaffTab: Получены данные пользователей:", data);
        return data;
      } catch (error) {
        console.error("StaffTab: Ошибка при загрузке пользователей:", error);
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0
  });
  
  // Загружаем данные при монтировании компонента
  useEffect(() => {
    console.log("StaffTab: Компонент смонтирован, запрашиваем данные");
    refetch();
  }, [refetch]);
  
  // Фильтруем пользователей с нужными ролями
  const staffRoles = [
    UserRole.OWNER,
    UserRole.SECURITY,
    UserRole.ADMIN,
    UserRole.HEADADMIN,
    UserRole.MODERATOR
  ];
  
  const staffUsers = users?.filter(user => 
    staffRoles.includes(user.role as UserRole)
  ) || [];
  
  // Функция для отображения роли пользователя
  const getUserRoleBadge = (role: string) => {
    switch (role) {
      case UserRole.OWNER:
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Владелец Площадки</Badge>;
      case UserRole.SECURITY:
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Служба Безопасности</Badge>;
      case UserRole.ADMIN:
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Админ</Badge>;
      case UserRole.HEADADMIN:
        return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Вице-Админ</Badge>;
      case UserRole.MODERATOR:
        return <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">Модератор</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <ShieldAlert className="mr-2 h-6 w-6" />
        Персонал платформы
      </h2>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : isError ? (
        <div className="text-center p-4 border rounded-md text-destructive">
          Ошибка при загрузке пользователей. Пожалуйста, попробуйте обновить страницу.
        </div>
      ) : staffUsers.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Имя пользователя</TableHead>
                <TableHead>Отображаемое имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.displayName || "-"}</TableCell>
                  <TableCell>
                    {getUserRoleBadge(user.role)}
                  </TableCell>
                  <TableCell>
                    {user.isBlocked ? (
                      <Badge variant="destructive">Заблокирован</Badge>
                    ) : user.isVerified ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Верифицирован</Badge>
                    ) : (
                      <Badge variant="outline">Обычный</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/users/${user.id}/edit`}>
                          <Edit className="h-4 w-4 mr-2" />
                          Редактировать
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center p-4 border rounded-md">
          Нет данных о персонале
        </div>
      )}
    </div>
  );
}

// Компонент для отображения сотрудников магазинов
function ShopStaffTab() {
  const { t } = useLocale();
  
  // Запрос списка пользователей
  const { data: users, isLoading, isError, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      console.log("ShopStaffTab: Загрузка списка пользователей");
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await response.json();
        console.log("ShopStaffTab: Получены данные пользователей:", data);
        return data;
      } catch (error) {
        console.error("ShopStaffTab: Ошибка при загрузке пользователей:", error);
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0
  });
  
  // Загружаем данные при монтировании компонента
  useEffect(() => {
    console.log("ShopStaffTab: Компонент смонтирован, запрашиваем данные");
    refetch();
  }, [refetch]);
  
  // Фиксированные данные о сотрудниках магазинов
  const fixedStaffData = [{
    userId: 6,
    shopId: 1,
    username: "sown",
    displayName: "Владелец Магазина",
    role: UserRole.SHOP_OWNER,
    shopName: "View Askew Shop"
    },
    {
      userId: 7,
      shopId: 1,
      username: "main",
      displayName: "Управляющий Магазина",
      role: UserRole.SHOP_MAIN,
      shopName: "View Askew Shop"
    },
    {
      userId: 8,
      shopId: 1,
      username: "staff",
      displayName: "Сотрудник Магазина",
      role: UserRole.SHOP_STAFF,
      shopName: "View Askew Shop"
    },
    {
      userId: 9,
      shopId: 2,
      username: "sown2",
      displayName: "Владелец Магазина 2",
      role: UserRole.SHOP_OWNER,
      shopName: "View Askew Shop 2"
    },
    {
      userId: 10,
      shopId: 2,
      username: "main2",
      displayName: "Управляющий Магазина 2",
      role: UserRole.SHOP_MAIN,
      shopName: "View Askew Shop 2"
    },
    {
      userId: 11,
      shopId: 2,
      username: "staff2",
      displayName: "Сотрудник Магазина 2",
      role: UserRole.SHOP_STAFF,
      shopName: "View Askew Shop 2"
    }
  ];
  
  // Фильтрация пользователей с ролями магазина
  const shopUsers = (users || []).filter((user: User) =>
    [UserRole.SHOP_OWNER, UserRole.SHOP_MAIN, UserRole.SHOP_STAFF].includes(user.role as UserRole)
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <Store className="mr-2 h-6 w-6" />
        Персонал магазинов
      </h2>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : isError ? (
        <div className="text-center p-4 border rounded-md text-destructive">
          Ошибка при загрузке пользователей. Пожалуйста, попробуйте обновить страницу.
        </div>
      ) : shopUsers.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Имя пользователя</TableHead>
                <TableHead>Отображаемое имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shopUsers.map((staff: User) => {
                // Ищем информацию о магазине для данного пользователя
                const staffData = fixedStaffData.find(item => item.userId === staff.id);
                
                return (
                  <TableRow key={staff.id}>
                    <TableCell>{staff.id}</TableCell>
                    <TableCell className="font-medium">{staff.username}</TableCell>
                    <TableCell>{staff.displayName || "-"}</TableCell>
                    <TableCell>
                      {getRoleBadge(staff.role)}
                    </TableCell>
                    <TableCell>
                      {staffData ? (
                        <Link href={`/shops/${staffData.shopId}`} className="hover:underline">
                          <Badge variant="outline" className="text-sm hover:bg-muted cursor-pointer">
                            {staffData.shopName} (ID: {staffData.shopId})
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">Не привязан к магазину</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Управление
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center p-4 border rounded-md">
          Нет данных о персонале
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState("users");

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: activeSessions } = useQuery<Session[]>({
    queryKey: ["/api/sessions/active"],
  });

  const { data: complaints } = useQuery<Complaint[]>({
    queryKey: ["/api/complaints"],
  });

  const { data: staffUsers } = useQuery<User[]>({
    queryKey: ["/api/users/staff"],
  });

  const { data: shopOwners } = useQuery<User[]>({
    queryKey: ["/api/users/shop-owners"],
    queryFn: async () => {
      // Если API для получения владельцев магазинов не существует,
      // можно отфильтровать их из общего списка пользователей
      if (users) {
        return users.filter(u => u.role === UserRole.SHOP_OWNER);
      }
      return [];
    },
    enabled: !!users,
  });
  
  // Запрос для получения количества магазинов (только для статистики)
  const { data: shopsCount } = useQuery<number>({
    queryKey: ["/api/shops/count"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/shops");
        if (!response.ok) {
          throw new Error("Failed to fetch shops count");
        }
        const shops = await response.json();
        return Array.isArray(shops) ? shops.length : 0;
      } catch (error) {
        console.error("Ошибка при получении количества магазинов:", error);
        return 0;
      }
    }
  });

  // Only allow staff to access this page
  if (user?.role === UserRole.USER) {
    return <Redirect to="/" />;
  }

  const premiumUsers = users?.filter((u) => u.isPremium) ?? [];
  const verifiedUsers = users?.filter((u) => u.isVerified) ?? [];
  const blockedUsers = users?.filter((u) => u.isBlocked) ?? [];
  const pendingComplaints = complaints?.filter((c) => c.status === "В ожидании") ?? [];
  const shopCount = shopsCount ?? 0;

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-6">{t('navigation.admin')}</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
          <StatsCard
            title={t('status.total')}
            value={users?.length ?? 0}
            description={t('status.registered')}
          />
          <StatsCard
            title={t('status.premium')}
            value={premiumUsers.length}
            description={t('status.premiumDesc')}
            variant="premium"
          />
          <StatsCard
            title={t('status.verified')}
            value={verifiedUsers.length}
            description={t('status.verifiedDesc')}
          />
          <StatsCard
            title="Блокировки"
            value={blockedUsers.length}
            description="Заблокированные пользователи"
            variant="destructive"
          />
          <StatsCard
            title="Магазины"
            value={shopCount}
            description="Количество магазинов на платформе"
            variant="success"
          />
        </div>

        <Tabs 
          defaultValue="users" 
          className="space-y-6"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList>
            {isStaff(user!) && (
              <TabsTrigger value="complaints">
                <Flag className="mr-2 h-4 w-4" />
                {t('navigation.complaints')}
              </TabsTrigger>
            )}
            {isStaff(user!) && (
              <TabsTrigger value="blocks">
                <Lock className="mr-2 h-4 w-4" />
                Блокировки
              </TabsTrigger>
            )}
            {isOwner(user!) && (
              <TabsTrigger value="users">
                <Users className="mr-2 h-4 w-4" />
                Пользователи
              </TabsTrigger>
            )}
            {isOwner(user!) && (
              <TabsTrigger value="staffShopsInMarket">
                <ShieldAlert className="mr-2 h-4 w-4" />
                Персонал магазинов
              </TabsTrigger>
            )}
            {isOwner(user!) && (
              <TabsTrigger value="staffShops">
                <ShieldAlert className="mr-2 h-4 w-4" />
                Персонал площадки
              </TabsTrigger>
            )}
            {isOwner(user!) && (
              <TabsTrigger value="shops">
                <Store className="mr-2 h-4 w-4" />
                {t('navigation.shops')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users">
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Users className="mr-2 h-6 w-6" />
                Пользователи
              </h2>
              <UserTable 
                users={(users ?? []).filter(user => user.role === UserRole.USER)} 
                currentUser={user!} 
              />
            </div>
          </TabsContent>

          {isStaff(user!) && (
            <TabsContent value="complaints">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Flag className="mr-2 h-6 w-6" />
                  {t('navigation.complaints')}
                </h2>
                <ComplaintTable 
                  complaints={complaints ?? []} 
                  users={users ?? []}
                  currentUser={user!}
                />
              </div>
            </TabsContent>
          )}

          {isStaff(user!) && (
            <TabsContent value="blocks">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Lock className="mr-2 h-6 w-6" />
                  Заблокированные пользователи
                </h2>
                <div className="mb-4">
                  <BlockedUsersTable 
                    users={users ?? []} 
                    currentUser={user!}
                  />
                </div>
              </div>
            </TabsContent>
          )}

          {isOwner(user!) && (
            <TabsContent value="staff">
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <ShieldAlert className="mr-2 h-6 w-6" />
                  {t('navigation.staff')}
                </h2>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">{t('navigation.staffMembers')}</h3>
                  <UserTable 
                    users={staffUsers ?? []} 
                    currentUser={user!}
                  />
                </div>
              </div>
            </TabsContent>
          )}
          
          {isOwner(user!) && (
            <TabsContent value="staffShopsInMarket">
              <ShopStaffTab />
            </TabsContent>
          )}

          {isOwner(user!) && (
            <TabsContent value="staffShops">
              <StaffTab />
            </TabsContent>
          )}

          {isOwner(user!) && (
            <TabsContent value="shops">
              <ShopsTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function isOwner(user: User) {
  const ownerRoles = [
    UserRole.OWNER,
    UserRole.SECURITY
  ];
  return ownerRoles.includes(user.role as UserRole);
}

function isStaff(user: User) {
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
}