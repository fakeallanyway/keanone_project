import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package } from "lucide-react";
import { Shop } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";

// Функция для форматирования цены
const formatPrice = (value: string) => {
  const numericValue = value.replace(/[^\d.]/g, '');
  if (!numericValue) return "";
  const number = parseFloat(numericValue);
  if (isNaN(number)) return "";
  return number.toLocaleString('ru-RU');
};

export default function CreateProductPage() {
  const [, params] = useRoute<{ id: string }>("/shops/:id/products/create");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Проверяем, имеет ли пользователь права на добавление товаров
  const canAddProducts = user && shop && (user.id === shop.ownerId || user.role === "OWNER" || user.role === "SECURITY" || user.role === "ADMIN" || user.role === "HEADADMIN");

  // Добавляем функцию для обработки изменения цены
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d.]/g, '');
    setPrice(value);
  };

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
      
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopId,
          name,
          description,
          avatarUrl,
          price,
          quantity: parseInt(quantity) || 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create product");
      }

      const product = await response.json();
      
      toast({
        title: "Успех",
        description: "Товар успешно добавлен",
      });
      
      navigate(`/products/${product.id}`);
    } catch (error) {
      console.error("Error creating product:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить товар",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

  if (!canAddProducts) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Доступ запрещен</h1>
            <p className="text-muted-foreground mb-6">
              У вас нет прав на добавление товаров в этот магазин
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
          <h1 className="text-3xl font-bold mb-6">Добавление товара</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Информация о товаре</CardTitle>
              <CardDescription>
                Заполните информацию о новом товаре для магазина "{shop.name}"
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
                    <div className="relative">
                      <Input
                        id="price"
                        placeholder="0"
                        value={formatPrice(price)}
                        onChange={handlePriceChange}
                        required
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">₽</span>
                    </div>
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

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/shops/${shopId}`)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Добавить товар
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