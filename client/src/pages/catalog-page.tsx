import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProductsGrid } from "@/components/ui/products-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Product, Shop } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Search, Filter, SlidersHorizontal, ShoppingBag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ProductWithShopInfo extends Product {
  shopName?: string;
  shopIsVerified?: boolean;
}

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedShops, setSelectedShops] = useState<number[]>([]);
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortOption, setSortOption] = useState("newest");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all products
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["products", debouncedQuery],
    queryFn: async () => {
      const url = debouncedQuery
        ? `/api/products?search=${encodeURIComponent(debouncedQuery)}`
        : `/api/products`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  // Fetch all shops
  const { data: shops, isLoading: shopsLoading } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shops");
      return res.json();
    },
  });

  // Combine products with shop information
  const productsWithShopInfo: ProductWithShopInfo[] = products
    ? products.map((product) => {
        const shop = shops?.find((s) => s.id === product.shopId);
        return {
          ...product,
          shopName: shop?.name,
          shopIsVerified: shop?.status === "VERIFIED",
        };
      })
    : [];

  // Apply filters and sorting
  const filteredProducts = productsWithShopInfo
    .filter((product) => {
      // Filter by selected shops
      if (selectedShops.length > 0 && product.shopId && !selectedShops.includes(product.shopId)) {
        return false;
      }

      // Filter by price range
      const price = parseFloat(product.price);
      if (priceRange.min && price < parseFloat(priceRange.min)) {
        return false;
      }
      if (priceRange.max && price > parseFloat(priceRange.max)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by selected option
      switch (sortOption) {
        case "price-asc":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-desc":
          return parseFloat(b.price) - parseFloat(a.price);
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

  const handleShopToggle = (shopId: number) => {
    setSelectedShops((prev) =>
      prev.includes(shopId)
        ? prev.filter((id) => id !== shopId)
        : [...prev, shopId]
    );
  };

  const resetFilters = () => {
    setSelectedShops([]);
    setPriceRange({ min: "", max: "" });
    setSortOption("newest");
  };

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">Каталог товаров</h1>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Поиск товаров..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="flex-shrink-0"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Фильтры и сортировка
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div>
                    <h3 className="font-medium mb-3">Магазины</h3>
                    {shopsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {shops?.map((shop) => (
                          <div key={shop.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`shop-${shop.id}`}
                              checked={selectedShops.includes(shop.id)}
                              onCheckedChange={() => handleShopToggle(shop.id)}
                            />
                            <Label
                              htmlFor={`shop-${shop.id}`}
                              className="flex items-center cursor-pointer"
                            >
                              {shop.name}
                              {shop.status === "VERIFIED" && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Проверенный
                                </Badge>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Цена</h3>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        placeholder="От"
                        value={priceRange.min}
                        onChange={(e) =>
                          setPriceRange((prev) => ({ ...prev, min: e.target.value }))
                        }
                        className="w-24"
                      />
                      <span>—</span>
                      <Input
                        type="number"
                        placeholder="До"
                        value={priceRange.max}
                        onChange={(e) =>
                          setPriceRange((prev) => ({ ...prev, max: e.target.value }))
                        }
                        className="w-24"
                      />
                      <span>₽</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Сортировка</h3>
                    <Select
                      value={sortOption}
                      onValueChange={(value) => setSortOption(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите сортировку" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Сначала новые</SelectItem>
                        <SelectItem value="oldest">Сначала старые</SelectItem>
                        <SelectItem value="price-asc">Цена: по возрастанию</SelectItem>
                        <SelectItem value="price-desc">Цена: по убыванию</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={resetFilters}
                    >
                      Сбросить фильтры
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedShops.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedShops.map((shopId) => {
                const shop = shops?.find((s) => s.id === shopId);
                return (
                  <Badge key={shopId} variant="secondary" className="py-1 px-3">
                    {shop?.name}
                    <button
                      className="ml-1 rounded-full hover:bg-muted"
                      onClick={() => handleShopToggle(shopId)}
                    >
                      ✕
                    </button>
                  </Badge>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setSelectedShops([])}
              >
                Очистить
              </Button>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">
                {filteredProducts.length} {filteredProducts.length === 1 ? "товар" : "товаров"}
              </div>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="h-96">
                    <CardHeader className="p-4">
                      <Skeleton className="aspect-square rounded-lg" />
                      <Skeleton className="h-6 mt-2" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex-1">
                      <Skeleton className="h-4 w-full mt-2" />
                      <Skeleton className="h-4 w-3/4 mt-2" />
                      <Skeleton className="h-4 w-2/4 mt-2" />
                      <div className="mt-auto pt-4">
                        <Skeleton className="h-10 w-full mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <ProductsGrid products={filteredProducts} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium">Товары не найдены</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Попробуйте изменить параметры поиска или сбросить фильтры
                </p>
                <Button onClick={resetFilters}>Сбросить фильтры</Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 