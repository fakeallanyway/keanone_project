import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Store, ShieldCheck, User } from "lucide-react";
import { Shop, ShopStatus, UserRole } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function EditShopPage() {
  const [, params] = useRoute<{ id: string }>("/shops/:id/edit");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [status, setStatus] = useState<string>(ShopStatus.ACTIVE);
  const [blockReason, setBlockReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!params) return null;
  const shopId = parseInt(params.id);

  // Получаем информацию о магазине
  const { data: shop, isLoading } = useQuery<Shop>({
    queryKey: [`/api/shops/${shopId}`],
    queryFn: async () => {
      const response = await fetch(`/api/shops/${shopId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shop");
      }
      return response.json();
    },
  });

  // Заполняем форму данными магазина
  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setDescription(shop.description || "");
      setAvatarUrl(shop.avatarUrl || "");
      setIsVerified(shop.isVerified);
      setStatus(shop.status);
      setBlockReason(shop.blockReason || "");
    }
  }, [shop]);

  // Проверяем, имеет ли пользователь права на редактирование
  const canEdit = user && shop && (
    user.id === shop.ownerId || 
    user.role === UserRole.OWNER || 
    user.role === UserRole.SECURITY || 
    user.role === UserRole.ADMIN || 
    user.role === UserRole.HEADADMIN || 
    user.role === UserRole.SHOP_OWNER || 
    user.role === UserRole.SHOP_MAIN
  );
  
  // Права администраторов высшего уровня (полный доступ)
  const hasFullAccess = user && (
    user.role === UserRole.OWNER || 
    user.role === UserRole.SECURITY
  );
  
  // Права на администрирование (но не полный доступ)
  const hasAdminAccess = !hasFullAccess && user && (
    user.role === UserRole.ADMIN ||
    user.role === UserRole.HEADADMIN
  );

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

    try {
      setIsSubmitting(true);
      
      const updates: any = {
        name,
        description,
        avatarUrl,
      };

      // Только администраторы могут менять статус верификации и блокировки
      if (hasFullAccess || hasAdminAccess) {
        updates.isVerified = isVerified;
        updates.status = status;
        if (status === ShopStatus.BLOCKED) {
          updates.blockReason = blockReason;
        }
      }
      
      const response = await fetch(`/api/shops/${shopId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update shop");
      }

      toast({
        title: "Успех",
        description: "Магазин успешно обновлен",
      });
      
      navigate(`/shops/${shopId}`);
    } catch (error) {
      console.error("Error updating shop:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить магазин",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/shops/${shopId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete shop");
      }

      toast({
        title: "Успех",
        description: "Магазин успешно удален",
      });
      
      navigate("/");
    } catch (error) {
      console.error("Error deleting shop:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить магазин",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
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
              <a href="/">Вернуться на главную</a>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Доступ запрещен</h1>
            <p className="text-muted-foreground mb-6">
              У вас нет прав на редактирование этого магазина
            </p>
            <Button asChild>
              <a href={`/shops/${shopId}`}>Вернуться к магазину</a>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Редактирование магазина</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Информация о магазине</CardTitle>
              <CardDescription>
                Измените информацию о вашем магазине
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

                {(hasFullAccess || hasAdminAccess) && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="verified"
                        checked={isVerified}
                        onCheckedChange={setIsVerified}
                      />
                      <Label htmlFor="verified" className="flex items-center gap-1">
                        Верифицированный магазин
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Статус магазина</Label>
                      <Select
                        value={status}
                        onValueChange={setStatus}
                      >
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ShopStatus.ACTIVE}>Активен</SelectItem>
                          <SelectItem value={ShopStatus.BLOCKED}>Заблокирован</SelectItem>
                          <SelectItem value={ShopStatus.PENDING}>На проверке</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {status === ShopStatus.BLOCKED && (
                      <div className="space-y-2">
                        <Label htmlFor="blockReason">Причина блокировки</Label>
                        <Textarea
                          id="blockReason"
                          placeholder="Укажите причину блокировки"
                          value={blockReason}
                          onChange={(e) => setBlockReason(e.target.value)}
                          rows={2}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between pt-4">
                  {hasFullAccess && (
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive">
                          Удалить магазин
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Это действие нельзя отменить. Магазин и все его товары будут удалены навсегда.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {!hasFullAccess && <div></div>}

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/shops/${shopId}`)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Сохранить
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 