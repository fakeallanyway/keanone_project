import { ShoppingCart } from "lucide-react";
import { Button } from "./button";
import { Badge } from "./badge";
import { useCart } from "@/hooks/use-cart";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetPortal, SheetOverlay, SheetClose } from "./sheet";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import { Store, Package, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";

export function FloatingCartButton() {
  const { items, removeItem, updateQuantity, clearCart } = useCart();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Группируем товары по магазинам
  const itemsByShop = items.reduce((acc, item) => {
    const shopItems = acc.get(item.shopId) || [];
    acc.set(item.shopId, [...shopItems, item]);
    return acc;
  }, new Map<string, typeof items>());

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {itemCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetPortal>
          <SheetOverlay className="fixed inset-0 z-50 bg-black/80" />
          <SheetContent side="right" className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background p-6 shadow-lg sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Корзина</SheetTitle>
              <SheetDescription>
                {itemCount === 0 
                  ? "Ваша корзина пуста" 
                  : `В корзине ${itemCount} ${itemCount === 1 ? "товар" : itemCount < 5 ? "товара" : "товаров"}`
                }
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-12rem)] py-4">
              {Array.from(itemsByShop.entries()).map(([shopId, shopItems]) => {
                const firstItem = shopItems[0];
                return (
                  <div key={shopId} className="mb-6">
                    <Link href={`/shops/${shopId}`} className="flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground">
                      <Store className="h-4 w-4" />
                      <span>{firstItem.shopName}</span>
                      {firstItem.shopIsVerified && (
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                      )}
                    </Link>
                    <div className="space-y-4">
                      {shopItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-4">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border bg-secondary flex-shrink-0">
                            {item.avatarUrl ? (
                              <img 
                                src={item.avatarUrl} 
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/products/${item.id}`} className="font-medium hover:underline truncate block">
                              {item.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {item.price.toLocaleString("ru-RU")} ₽
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              +
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                );
              })}
            </ScrollArea>
            {itemCount > 0 && (
              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Итого:</span>
                  <span className="text-lg font-bold">
                    {total.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearCart} className="flex-1">
                    Очистить
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1">
                      Оформить заказ
                    </Button>
                  </SheetClose>
                </div>
              </SheetFooter>
            )}
          </SheetContent>
        </SheetPortal>
      </Sheet>
    </div>
  );
} 