import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Settings, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { UserRole } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SiteSettings {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxShopsPerUser: number;
  maxProductsPerShop: number;
  commissionRate: number;
  termsAndConditions: string;
  privacyPolicy: string;
  aboutUs: string;
}

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  
  // Получаем настройки сайта
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
  });

  // Состояние формы
  const [formData, setFormData] = useState<SiteSettings>({
    siteName: "",
    siteDescription: "",
    contactEmail: "",
    maintenanceMode: false,
    registrationEnabled: true,
    maxShopsPerUser: 1,
    maxProductsPerShop: 100,
    commissionRate: 5,
    termsAndConditions: "",
    privacyPolicy: "",
    aboutUs: "",
  });

  // Обновляем состояние формы при загрузке данных
  useEffect(() => {
    if (currentSettings) {
      setFormData(currentSettings);
    }
  }, [currentSettings]);

  // Мутация для сохранения настроек
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // Добавляем заголовок для авторизации
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server response:", errorText);
        throw new Error(errorText);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Настройки сохранены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  const handleChange = useCallback((
    field: keyof SiteSettings,
    value: string | boolean | number
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await mutation.mutateAsync(formData);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }, [formData, mutation]);

  if (!user || user.role !== UserRole.OWNER) {
    return (
      <div className="flex h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Доступ запрещен</h1>
            <p className="text-muted-foreground">
              У вас нет прав для просмотра этой страницы
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 flex items-center gap-2">
            <Settings className="h-6 w-6 md:h-8 md:w-8" />
            Настройки сайта
          </h1>
          
          <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="general">Общие</TabsTrigger>
              <TabsTrigger value="limits">Ограничения</TabsTrigger>
              <TabsTrigger value="legal">Правовая информация</TabsTrigger>
            </TabsList>

        
            <TabsContent value="general">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Основная информация</CardTitle>
                    <CardDescription>
                      Настройте основную информацию о сайте
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="siteName">Название сайта</Label>
                      <Input
                        id="siteName"
                        name="siteName"
                        value={formData.siteName}
                        onChange={(e) => handleChange("siteName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="siteDescription">Описание сайта</Label>
                      <Textarea
                        id="siteDescription"
                        name="siteDescription"
                        value={formData.siteDescription}
                        onChange={(e) => handleChange("siteDescription", e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Контактный email</Label>
                      <Input
                        id="contactEmail"
                        name="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => handleChange("contactEmail", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Режим работы</CardTitle>
                    <CardDescription>
                      Настройте режим работы сайта
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="maintenanceMode">Режим обслуживания</Label>
                        <p className="text-sm text-muted-foreground">
                          Сайт будет доступен только администраторам
                        </p>
                      </div>
                      <Switch
                        id="maintenanceMode"
                        checked={formData.maintenanceMode}
                        onCheckedChange={(checked) => handleChange("maintenanceMode", checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="registrationEnabled">Регистрация пользователей</Label>
                        <p className="text-sm text-muted-foreground">
                          Разрешить новым пользователям регистрироваться
                        </p>
                      </div>
                      <Switch
                        id="registrationEnabled"
                        checked={formData.registrationEnabled}
                        onCheckedChange={(checked) => handleChange("registrationEnabled", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="limits">
              <Card>
                <CardHeader>
                  <CardTitle>Ограничения и лимиты</CardTitle>
                  <CardDescription>
                    Настройте ограничения для пользователей и магазинов
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="maxShopsPerUser">Максимальное количество магазинов на пользователя</Label>
                      <Input
                        id="maxShopsPerUser"
                        name="maxShopsPerUser"
                        type="number"
                        min="1"
                        value={formData.maxShopsPerUser}
                        onChange={(e) => handleChange("maxShopsPerUser", parseInt(e.target.value, 10))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="maxProductsPerShop">Максимальное количество товаров в магазине</Label>
                      <Input
                        id="maxProductsPerShop"
                        name="maxProductsPerShop"
                        type="number"
                        min="1"
                        value={formData.maxProductsPerShop}
                        onChange={(e) => handleChange("maxProductsPerShop", parseInt(e.target.value, 10))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="commissionRate">Комиссия платформы (%)</Label>
                      <Input
                        id="commissionRate"
                        name="commissionRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.commissionRate}
                        onChange={(e) => handleChange("commissionRate", parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="legal">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Правовые документы</CardTitle>
                    <CardDescription>
                      Настройте правовые документы сайта
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="termsAndConditions">
                        Условия использования
                      </Label>
                      <Textarea
                        id="termsAndConditions"
                        value={formData.termsAndConditions}
                        onChange={(e) => handleChange("termsAndConditions", e.target.value)}
                        className="min-h-[200px]"
                        placeholder="Введите текст условий использования..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="privacyPolicy">
                        Политика конфиденциальности
                      </Label>
                      <Textarea
                        id="privacyPolicy"
                        value={formData.privacyPolicy}
                        onChange={(e) => handleChange("privacyPolicy", e.target.value)}
                        className="min-h-[200px]"
                        placeholder="Введите текст политики конфиденциальности..."
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Информация о сайте</CardTitle>
                    <CardDescription>
                      Настройте информационные страницы сайта
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="aboutUs">О нас</Label>
                      <Textarea
                        id="aboutUs"
                        value={formData.aboutUs}
                        onChange={(e) => handleChange("aboutUs", e.target.value)}
                        className="min-h-[200px]"
                        placeholder="Введите информацию о вашем сайте..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
} 