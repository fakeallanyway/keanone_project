import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package } from "lucide-react";
import { Product, Shop } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function EditProductPage() {
  const [, params] = useRoute<{ id: string }>("/products/:id/edit");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!params) return null;
  const productId = parseInt(params.id);

  // Получаем информацию о товаре
  const { data: product, isLoading: isProductLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch product");
      }
      return response.json();
    },
  });

  // Получаем информацию о магазине
  const { data: shop, isLoading: isShopLoading } = useQuery<Shop>({
    queryKey: [`/api/shops/${product?.shopId}`],
    queryFn: async () => {
      if (!product) return null;
      const response = await fetch(`/api/shops/${product.shopId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch shop");
      }
      return response.json();
    },
    enabled: !!product,
  });

  // Заполняем форму данными товара
  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || "");
      setAvatarUrl(product.avatarUrl || "");
      setPrice(product.price);
      setQuantity(product.quantity?.toString() || "0");
    }
  }, [product]);

  // Проверяем, имеет ли пользователь права на редактирование
  const canEdit = user && shop && (user.id === shop.ownerId || user.role === "OWNER" || user.role === "SECURITY" || user.role === "ADMIN" || user.role === "HEADADMIN");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название товара обязательно",
        variant: "destructive",
      });
      return;
    }

    if (!price.trim()) {
      toast({
        title: "Ошибка",
        description: "Цена товара обязательна",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          avatarUrl,
          price,
          quantity: parseInt(quantity) || 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update product");
      }

      toast({
        title: "Успех",
        description: "Товар успешно обновлен",
      });
      
      navigate(`/products/${productId}`);
    } catch (error) {
      console.error("Error updating product:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить товар",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      toast({
        title: "Успех",
        description: "Товар успешно удален",
      });
      
      navigate(`/shops/${product?.shopId}`);
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить товар",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isProductLoading || (product && isShopLoading)) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Товар не найден</h1>
            <p className="text-muted-foreground mb-6">
              Запрашиваемый товар не существует или был удален
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
              У вас нет прав на редактирование этого товара
            </p>
            <Button asChild>
              <a href={`/products/${productId}`}>Вернуться к товару</a>
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
          <h1 className="text-3xl font-bold mb-6">Редактирование товара</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Информация о товаре</CardTitle>
              <CardDescription>
                Измените информацию о товаре в магазине "{shop?.name}"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="avatar">Изображение товара (URL)</Label>
                  <div className="flex gap-4 items-start">
                    <div className="relative w-24 h-24 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border">
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt="Product image" 
                          className="w-full h-full object-cover"
                          onError={() => setAvatarUrl("")}
                        />
                      ) : (
                        <Package className="h-12 w-12 text-muted-foreground" />
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
                        Введите URL изображения для товара
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="required">Название товара</Label>
                  <Input
                    id="name"
                    placeholder="Введите название товара"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    placeholder="Введите описание товара"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="required">Цена</Label>
                    <Input
                      id="price"
                      placeholder="Введите цену"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Количество</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      placeholder="Введите количество"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive">
                        Удалить товар
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Это действие нельзя отменить. Товар будет удален навсегда.
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

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/products/${productId}`)}
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