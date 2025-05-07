import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Store } from "lucide-react";
import { UserRole, Shop } from "@shared/schema";
import { useLocale } from "@/hooks/use-locale";
import { apiRequest } from "@/lib/queryClient";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";

interface CreateComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedShopId?: number | null; // Optional prop to pre-select a shop
}

// Расширяем схему жалобы для нашего интерфейса
const createComplaintFormSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен"),
  description: z.string().min(1, "Описание обязательно"),
  complaintType: z.enum(["platform", "shop"]),
  shopId: z.string().optional(),
});

type CreateComplaintFormValues = z.infer<typeof createComplaintFormSchema>;

export function CreateComplaintDialog({ open, onOpenChange, selectedShopId }: CreateComplaintDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Проверяем, является ли пользователь сотрудником магазина
  const isShopStaff = user && [
    UserRole.SHOP_OWNER,
    UserRole.SHOP_MAIN,
    UserRole.SHOP_STAFF
  ].includes(user.role as UserRole);

  // Запрашиваем список магазинов для выбора
  const { data: shops, isLoading: isShopsLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops");
      return response.json();
    },
    enabled: open // Запрашиваем только когда диалог открыт
  });

  // Запрашиваем список магазинов, связанных с пользователем
  const { data: userShops, isLoading: isUserShopsLoading } = useQuery<Shop[]>({
    queryKey: ["/api/user/shops"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/shops");
      return response.json();
    },
    enabled: open && isShopStaff
  });

  const form = useForm<CreateComplaintFormValues>({
    resolver: zodResolver(createComplaintFormSchema),
    defaultValues: {
      title: "",
      description: "",
      complaintType: selectedShopId ? "shop" : "platform",
      shopId: selectedShopId ? selectedShopId.toString() : "",
    },
  });

  // Сбрасываем форму при открытии диалога и устанавливаем значения по умолчанию
  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        complaintType: selectedShopId ? "shop" : "platform",
        shopId: selectedShopId ? selectedShopId.toString() : "",
      });
    }
  }, [open, form, selectedShopId]);

  // Если пользователь открыл диалог со страницы shop-appeal и уже выбран магазин,
  // автоматически устанавливаем тип жалобы "shop" и выбранный магазин
  useEffect(() => {
    if (selectedShopId) {
      form.setValue("complaintType", "shop");
      form.setValue("shopId", selectedShopId.toString());
    }
  }, [selectedShopId, form]);

  // Мутация для создания обращения в площадку
  const createPlatformComplaintMutation = useMutation({
    mutationFn: async (values: CreateComplaintFormValues) => {
      const response = await apiRequest("POST", "/api/complaints", {
        title: values.title,
        description: values.description,
      });
      return response.json();
    },
    onSuccess: () => handleSuccess("Обращение в площадку успешно создано"),
    onError: (error) => handleError(error),
  });

  // Мутация для создания обращения в магазин
  const createShopComplaintMutation = useMutation({
    mutationFn: async (values: CreateComplaintFormValues) => {
      if (!values.shopId) throw new Error("ID магазина не указан");
      
      console.log("Отправка обращения в магазин:", {
        shopId: values.shopId,
        title: values.title,
        description: values.description
      });
      
      const response = await apiRequest("POST", `/api/shops/${values.shopId}/complaints`, {
        title: values.title,
        description: values.description,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при создании обращения в магазин");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Обращение в магазин успешно создано:", data);
      handleSuccess("Обращение в магазин успешно создано");
    },
    onError: (error) => {
      console.error("Ошибка при создании обращения в магазин:", error);
      handleError(error);
    },
  });

  // Обработчик успешного создания обращения
  const handleSuccess = (message: string) => {
    toast({
      title: "Успешно",
      description: message,
    });
    form.reset();
    onOpenChange(false);
    setIsSubmitting(false);
    
    // Обновляем все связанные запросы
    queryClient.invalidateQueries({ queryKey: ["/api/complaints/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
    
    // Если это обращение в магазин, обновляем и жалобы магазина
    const shopId = form.getValues().shopId;
    if (shopId) {
      queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`] });
    }
    
    // Добавляем небольшую задержку перед обновлением данных
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      if (shopId) {
        queryClient.invalidateQueries({ queryKey: [`/api/shops/${shopId}/complaints`] });
      }
    }, 500);
  };

  // Обработчик ошибки
  const handleError = (error: any) => {
    toast({
      title: "Ошибка",
      description: error.message || "Не удалось создать обращение",
      variant: "destructive",
    });
    setIsSubmitting(false);
  };

  // Обработчик отправки формы
  const onSubmit = (values: CreateComplaintFormValues) => {
    setIsSubmitting(true);
    
    // В зависимости от типа обращения вызываем соответствующую мутацию
    if (values.complaintType === "platform") {
      createPlatformComplaintMutation.mutate(values);
    } else if (values.complaintType === "shop") {
      if (!values.shopId) {
        toast({
          title: "Ошибка",
          description: "Выберите магазин для обращения",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Проверка существования магазина
      const shopExists = shops?.some(shop => shop.id.toString() === values.shopId) ||
                      userShops?.some(shop => shop.id.toString() === values.shopId);
      
      if (!shopExists) {
        toast({
          title: "Ошибка",
          description: "Выбранный магазин не найден",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log("Отправка формы обращения в магазин:", {
        shopId: values.shopId,
        complaintType: values.complaintType,
        title: values.title,
        description: values.description,
      });
      
      createShopComplaintMutation.mutate(values);
    }
  };

  // Следим за изменением типа обращения
  const complaintType = form.watch("complaintType");
  
  // Получаем список магазинов для отображения в селекте
  const getShopsToDisplay = () => {
    // Если пользователь является сотрудником магазина и у нас есть список его магазинов,
    // показываем только магазины пользователя
    if (isShopStaff && userShops && userShops.length > 0) {
      return userShops;
    }
    // Иначе показываем все магазины
    return shops;
  };

  const shopsToDisplay = getShopsToDisplay();
  const isLoadingShopsData = isShopStaff ? isUserShopsLoading : isShopsLoading;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('complaints.createTitle') || "Создать обращение"}</DialogTitle>
          <DialogDescription>
            {t('complaints.createDescription') || "Заполните форму для создания нового обращения"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Скрываем выбор типа обращения если selectedShopId передан в компонент */}
            {!selectedShopId && (
              <FormField
                control={form.control}
                name="complaintType"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>{t('complaints.type') || "Тип обращения"}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="platform" id="platform" />
                          <label htmlFor="platform" className="text-sm font-medium">
                            {t('complaints.typePlatform') || "Обращение к площадке"}
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="shop" id="shop" />
                          <label htmlFor="shop" className="text-sm font-medium">
                            {t('complaints.typeShop') || "Обращение в магазин"}
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {(complaintType === "shop" || selectedShopId) && (
              <FormField
                control={form.control}
                name="shopId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('complaints.selectShop') || "Выберите магазин"}</FormLabel>
                    {/* Если передан selectedShopId, то показываем только этот магазин без возможности выбора */}
                    {selectedShopId && shopsToDisplay?.find(shop => shop.id === selectedShopId) ? (
                      <div className="flex items-center space-x-2 border p-2 rounded-md">
                        <Store className="h-4 w-4" />
                        <span>{shopsToDisplay.find(shop => shop.id === selectedShopId)?.name}</span>
                      </div>
                    ) : (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('complaints.selectShopPlaceholder') || "Выберите магазин"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingShopsData ? (
                            <div className="flex justify-center p-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : shopsToDisplay && shopsToDisplay.length > 0 ? (
                            shopsToDisplay.map((shop) => (
                              <SelectItem key={shop.id} value={shop.id.toString()}>
                                <div className="flex items-center">
                                  <Store className="h-4 w-4 mr-2" />
                                  {shop.name}
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <div className="text-center p-2 text-muted-foreground">
                              {t('complaints.noShopsAvailable') || "Нет доступных магазинов"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('complaints.title') || "Заголовок"}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('complaints.titlePlaceholder') || "Введите заголовок обращения"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('complaints.description') || "Описание"}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('complaints.descriptionPlaceholder') || "Опишите вашу проблему подробнее"}
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('actions.cancel') || "Отмена"}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('status.creating') || "Создание..."}
                  </>
                ) : (
                  t('actions.create') || "Создать"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}