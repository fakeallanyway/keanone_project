import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Расширяем схему для формы регистрации
const extendedRegisterSchema = z.object({
  username: z.string().min(3, "Логин должен содержать минимум 3 символа"),
  displayName: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  confirmPassword: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof extendedRegisterSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [_, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Проверяем системную тему при загрузке страницы
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, [setTheme]);

  // Используем типизацию для формы
  const loginForm = useForm<{
    username: string;
    password: string;
  }>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(extendedRegisterSchema),
    defaultValues: {
      username: "",
      displayName: "",
      password: "",
      confirmPassword: "",
    }
  });

  const handleLogin = async (data: any) => {
    try {
      setLoginError(null);
      await loginMutation.mutateAsync(data);
    } catch (error: any) {
      if (error.message.includes("blocked")) {
        setLoginError(error.message);
      }
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    try {
      setRegisterError(null);
      // Отправляем только нужные поля без confirmPassword
      await registerMutation.mutateAsync({
        username: data.username,
        displayName: data.displayName,
        password: data.password,
      });
    } catch (error: any) {
      setRegisterError(error.message);
    }
  };

  if (user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Re-Market Auth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          
          {loginError && (
            <div className="mb-4 p-4 border border-destructive rounded-md bg-destructive/10 text-destructive">
              <h3 className="font-bold mb-2">Ваш аккаунт был заблокирован!</h3>
              <p className="text-sm mb-1">
                <span className="font-semibold">Причина:</span> {loginError.includes("Reason:") 
                  ? loginError.split("Reason:")[1].split(",")[0].trim() 
                  : "Нарушение правил сайта"}
              </p>
              <p className="text-sm mb-1">
                <span className="font-semibold">Дата блокировки:</span> {loginError.includes("Date:") 
                  ? loginError.split("Date:")[1].split(",")[0].trim() 
                  : new Date().toLocaleDateString()}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Время бана:</span> {loginError.includes("Duration:") 
                  ? loginError.split("Duration:")[1].trim() 
                  : "Бессрочно"}
              </p>
            </div>
          )}
          
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Логин</Label>
                  <Input
                    id="username"
                    {...loginForm.register("username")}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    {...loginForm.register("password")}
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isLoading}
                  onClick={() => {
                    if (!loginMutation.isLoading && loginForm.formState.isValid) {
                      // Redirect to homepage after successful login
                      setTimeout(() => {
                        window.location.href = '/';
                      }, 500);
                    }
                  }}
                >
                  {loginMutation.isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Войти
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form
                onSubmit={registerForm.handleSubmit(handleRegister)}
                className="space-y-4"
              >
                {registerError && (
                  <div className="p-3 border border-destructive rounded-md bg-destructive/10 text-destructive text-sm">
                    {registerError}
                  </div>
                )}
              
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Желаемый логин</Label>
                  <Input
                    id="reg-username"
                    {...registerForm.register("username")}
                    autoComplete="username"
                  />
                  {registerForm.formState.errors.username && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.username.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reg-displayName">Отображаемое имя</Label>
                  <Input
                    id="reg-displayName"
                    {...registerForm.register("displayName")}
                  />
                  {registerForm.formState.errors.displayName && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.displayName.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Пароль</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    {...registerForm.register("password")}
                    autoComplete="new-password"
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reg-confirmPassword">Повторите пароль</Label>
                  <Input
                    id="reg-confirmPassword"
                    type="password"
                    {...registerForm.register("confirmPassword")}
                    autoComplete="new-password"
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-destructive text-xs mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isLoading}
                >
                  {registerMutation.isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Зарегистрироваться
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
