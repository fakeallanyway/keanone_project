import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, Upload, ShieldAlert } from "lucide-react";
import { User, UserRole } from "@shared/schema";

export default function CreateShopPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.role === UserRole.OWNER || user?.role === UserRole.SECURITY;

  // Перенаправляем пользователя, если он не владелец проекта
  useEffect(() => {
    if (user && !isOwner) {
      toast({
        title: "Доступ запрещен",
        description: "Только владелец проекта может создавать магазины",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, isOwner, navigate, toast]);

  // Загружаем список пользователей для выбора владельца
  const { data: users, isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });
  // Загружаем список пользователей для выбора сотрудника магазина
  const { data: staffUsers, isLoading: isStaffLoading } = useQuery<User[]>({
    queryKey: ["/api/users/shop-staff"],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch("/api/users/shop-staff");
      if (!response.ok) {
        throw new Error("Failed to fetch shop staff users");
      }
      return response.json();
    },
  });

  const [staffId, setStaffId] = useState<number | null>(null);
  const staffUser = staffUsers?.find(user => user.id === staffId);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название магазина обязательно",
        variant: "destructive",
      });
      return;
    }

    if (!staffUsers) {
      toast({
        variant: "destructive",
      });
      return;
    }

    if (!ownerId) {
      toast({
        title: "Ошибка",
        description: "Необходимо выбрать владельца магазина",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Создаем магазин
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          avatarUrl,
          staffId,
          ownerId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create shop");
      }

      const shop = await response.json();
      
      // Обновляем роль пользователя на SHOP_OWNER, если он еще не является владельцем магазина
      const selectedUser = users?.find(u => u.id === ownerId);
      if (selectedUser && selectedUser.role === UserRole.USER) {
        const updateRoleResponse = await fetch(`/api/users/${ownerId}/role`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: UserRole.SHOP_OWNER
          }),
        });
        
        if (!updateRoleResponse.ok) {
          console.error("Failed to update user role");
          // Продолжаем выполнение, даже если не удалось обновить роль
        }
      }
      
      toast({
        title: "Успех",
        description: "Магазин успешно создан",
      });
      
      navigate(`/shops/${shop.id}`);
    } catch (error) {
      console.error("Error creating shop:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать магазин",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center text-destructive">Доступ запрещен</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
              <p className="mb-4">Только владелец проекта может создавать магазины</p>
              <Button onClick={() => navigate("/")}>Вернуться на главную</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Создание магазина</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Информация о магазине</CardTitle>
              <CardDescription>
                Заполните информацию о новом магазине
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="avatar">Аватар магазина (URL)</Label>
                  <div className="flex gap-4 items-start">
                    <div className="relative w-24 h-24 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border">
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt="Shop avatar" 
                          className="w-full h-full object-cover"
                          onError={() => setAvatarUrl("")}
                        />
                      ) : (
                        <Store className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        id="avatar"
                        placeholder="https://example.com/image.jpg"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Введите URL изображения для аватара магазина
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="required">Название магазина</Label>
                  <Input
                    id="name"
                    placeholder="Введите название магазина"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    placeholder="Введите описание магазина"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner" className="required">Владелец Магазина</Label>
                  <Select
                    value={ownerId?.toString() || ""}
                    onValueChange={(value) => setOwnerId(parseInt(value))}
                  >
                    <SelectTrigger id="owner">
                      <SelectValue placeholder="Выберите владельца" />
                    </SelectTrigger>
                    <SelectContent>
                      {isUsersLoading ? (
                        <div className="flex justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        users?.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.username} {user.displayName ? `(${user.displayName})` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Создать магазин
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 