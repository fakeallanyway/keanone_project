import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, Edit, Star, Store, ShieldCheck, AlertTriangle, BadgeCheck, ShoppingCart } from "lucide-react";
import { Product, Shop, Review } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

// Компонент для отображения рейтинга в виде звезд
const StarRating = ({ rating, maxRating = 5, size = "sm", interactive = false, onChange }: { 
  rating: number; 
  maxRating?: number; 
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeClass = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }[size];

  return (
    <div className="flex">
      {Array.from({ length: maxRating }).map((_, i) => {
        const starValue = i + 1;
        const filled = interactive 
          ? starValue <= (hoverRating || rating)
          : starValue <= rating;
        
        return (
          <Star
            key={i}
            className={`${sizeClass} ${filled ? "text-yellow-500 fill-yellow-500" : "text-gray-300"} ${interactive ? "cursor-pointer" : ""}`}
            onClick={() => interactive && onChange?.(starValue)}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            onMouseLeave={() => interactive && setHoverRating(0)}
          />
        );
      })}
    </div>
  );
};

// Helper function to translate role to user-friendly text
const getRoleText = (role: string) => {
  if (!role) return "";
  
  switch (role) {
    case UserRole.OWNER:
      return "Владелец Площадки";
    case UserRole.SECURITY:
      return "Служба Безопасности";
    case UserRole.ADMIN:
      return "Админ";
    case UserRole.HEADADMIN:
      return "Вице-Админ";
    case UserRole.MODERATOR:
      return "Модератор";
    case UserRole.SHOP_OWNER:
      return "Владелец Магазина";
    case UserRole.SHOP_MAIN:
      return "Управляющий Магазина";
    case UserRole.SHOP_STAFF:
      return "Сотрудник Магазина";
    default:
      return "Пользователь";
  }
};

export default function ProductPage() {
  const [, params] = useRoute<{ id: string }>("/products/:id");
  const { user } = useAuth();
  const { addItem } = useCart();
  const queryClient = useQueryClient();
  
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
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

  // Получаем отзывы о товаре
  const { data: reviews, isLoading: isReviewsLoading } = useQuery<Review[]>({
    queryKey: [`/api/products/${productId}/reviews`],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/reviews`);
      if (!response.ok) {
        throw new Error("Failed to fetch reviews");
      }
      return response.json();
    },
  });

  // Проверяем, является ли текущий пользователь владельцем магазина
  const isOwner = user && shop && (user.id === shop.ownerId || user.role === "OWNER" || user.role === "ADMIN");

  // Проверяем, оставил ли пользователь уже отзыв
  const hasReviewed = user && reviews?.some(review => review.userId === user.id);
  // Получаем историю покупок пользователя для этого товара
  const { data: purchases } = useQuery<{ id: number; productId: number; userId: number; }[]>({
    queryKey: [`/api/users/${user?.id}/purchases`, productId],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/users/${user.id}/purchases?productId=${productId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch purchase history");
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Проверяем, покупал ли пользователь этот товар
  const hasPurchased = purchases && purchases.length > 0;

  // Проверяем возможность оставить отзыв:
  // Пользователь должен быть авторизован, купить товар и еще не оставлять отзыв
  const canReview = user && hasPurchased && !hasReviewed;

  // Мутация для добавления отзыва
  const addReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add review");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/reviews`] });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/shops/${product?.shopId}`] });
      
      setReviewComment("");
      setReviewRating(5);
      
      toast({
        title: "Успех",
        description: "Ваш отзыв успешно добавлен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить отзыв",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Ошибка",
        description: "Вы должны войти в систему, чтобы оставить отзыв",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmittingReview(true);
      await addReviewMutation.mutateAsync();
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = () => {
    if (!product || !shop) return;
    
    addItem({
      id: product.id.toString(),
      name: product.name,
      price: parseFloat(product.price),
      avatarUrl: product.avatarUrl || undefined,
      shopId: shop.id.toString(),
      shopName: shop.name,
      shopIsVerified: shop.isVerified,
    });
    
    toast({
      title: "Товар добавлен в корзину",
      description: `${product.name} успешно добавлен в корзину`,
    });
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
              <Link href="/">Вернуться на главную</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Вычисляем средний рейтинг
  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Хлебные крошки */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Главная
            </Link>
            <span className="text-muted-foreground">/</span>
            {shop && (
              <>
                <Link href={`/shops/${shop.id}`} className="text-muted-foreground hover:text-foreground">
                  {shop.name}
                </Link>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            <span className="truncate max-w-[200px]">{product.name}</span>
          </div>
          
          {/* Информация о товаре */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3">
                  <div className="aspect-square rounded-lg bg-secondary flex items-center justify-center overflow-hidden border">
                    {product.avatarUrl ? (
                      <img 
                        src={product.avatarUrl} 
                        alt={product.name} 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="h-24 w-24 text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold">{product.name}</h1>
                  </div>
                  
                  <div className="text-2xl font-bold dark:text-white text-black mb-4">
                    {parseFloat(product.price).toLocaleString("ru-RU")} ₽
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <StarRating rating={Math.round(averageRating)} />
                    <span className="text-sm text-muted-foreground">
                      {reviews?.length || 0} отзывов
                    </span>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="font-medium mb-2">Описание</h3>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {product.description || "Нет описания"}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <Badge variant={product.quantity && product.quantity > 0 ? "outline" : "destructive"}>
                      {product.quantity && product.quantity > 0 ? `В наличии: ${product.quantity}` : "Нет в наличии"}
                    </Badge>
                    
                    {shop && (
                      <Link href={`/shops/${shop.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <Store className="h-4 w-4" />
                        <span>{shop.name}</span>
                        {shop.isVerified && <ShieldCheck className="h-4 w-4 text-blue-500" />}
                      </Link>
                    )}
                    
                    <div className="flex gap-2">
                      {product.quantity && product.quantity > 0 && (
                        <Button 
                          className="flex-1"
                          onClick={handleAddToCart}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Добавить в корзину
                        </Button>
                      )}
                      
                      {isOwner && (
                        <Button asChild variant="outline" className="flex-1">
                          <Link href={`/products/${product.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Редактировать
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Отзывы */}
          <Card>
            <CardHeader>
              <CardTitle>Отзывы о товаре</CardTitle>
            </CardHeader>
            <CardContent>
              {isReviewsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Форма добавления отзыва */}
                  {user && !hasReviewed && (
                    <Card className="border border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">Оставить отзыв</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSubmitReview} className="space-y-4">
                          <div className="space-y-2">
                            <label className="font-medium">Ваша оценка</label>
                            <StarRating 
                              rating={reviewRating} 
                              size="lg" 
                              interactive 
                              onChange={setReviewRating} 
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="font-medium">Комментарий</label>
                            <Textarea
                              placeholder="Поделитесь своим мнением о товаре"
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              rows={3}
                            />
                          </div>
                          
                          <div className="flex justify-end">
                            <Button type="submit" disabled={isSubmittingReview}>
                              {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Отправить отзыв
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Список отзывов */}
                  {reviews && reviews.length > 0 ? (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <Card key={review.id} className="border border-border">
                          <CardContent className="p-4">
                            <div className="flex justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={(review as any).userAvatarUrl} />
                                  <AvatarFallback>
                                    {(review as any).userDisplayName 
                                      ? (review as any).userDisplayName.substring(0, 2) 
                                      : (review.userId ? review.userId.toString().substring(0, 2) : "??")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  {review.userId ? (
                                    <div className="flex items-center gap-1">
                                      <Link href={`/users/${review.userId}`} className="font-medium hover:underline">
                                        {(review as any).userDisplayName || `Пользователь #${review.userId}`}
                                      </Link>
                                      {(review as any).userIsVerified && (
                                        <BadgeCheck className="h-3 w-3 text-blue-500" />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="font-medium">Неизвестный пользователь</div>
                                  )}
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <span>{format(new Date(review.createdAt), "dd.MM.yyyy")}</span>
                                    {(review as any).userRole && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1">
                                        {getRoleText((review as any).userRole)}
                                      </Badge>
                                    )}
                                    {(review as any).userIsPremium && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1 border-amber-500 text-amber-500">
                                        Premium
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <StarRating rating={review.rating} />
                            </div>
                            {review.comment && (
                              <p className="text-sm mt-2">{review.comment}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Пока нет отзывов о товаре
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}