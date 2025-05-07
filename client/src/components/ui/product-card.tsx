import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Product } from "@shared/schema";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Star } from "lucide-react";
import { useCart } from "@/hooks/use-cart";

interface ProductWithShopInfo extends Product {
  shopName?: string;
  shopIsVerified?: boolean;
  rating?: number;
}

export function ProductCard({ product }: { product: ProductWithShopInfo }) {
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem({
      id: product.id.toString(),
      name: product.name,
      price: parseFloat(product.price),
      avatarUrl: product.avatarUrl || undefined,
      shopId: product.shopId?.toString() || "0",
      shopName: product.shopName || `Магазин #${product.shopId || 0}`,
      shopIsVerified: product.shopIsVerified,
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-4">
        <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
          {product.avatarUrl ? (
            <img
              src={product.avatarUrl}
              alt={product.name}
              className="object-cover w-full h-full"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
              Нет изображения
            </div>
          )}
          {product.shopIsVerified && (
            <Badge variant="default" className="absolute top-2 right-2">
              Проверенный магазин
            </Badge>
          )}
        </div>
        <CardTitle className="mt-2 text-base md:text-lg line-clamp-2">
          {product.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1">
        <p className="text-sm md:text-base text-muted-foreground line-clamp-3">
          {product.description}
        </p>
        <div className="mt-2 text-sm text-muted-foreground">
          Магазин: {product.shopName || `Магазин #${product.shopId || 0}`}
        </div>
        {product.rating && (
          <div className="flex items-center mt-1">
            <Star className="h-4 w-4 text-yellow-400 mr-1" />
            <span className="text-sm">{product.rating}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col gap-2 md:flex-row md:justify-between">
        <p className="text-lg md:text-xl font-bold">
          {product.price} ₽
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/products/${product.id}`}>Подробнее</Link>
          </Button>
          <Button size="sm" onClick={handleAddToCart}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            В корзину
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
} 