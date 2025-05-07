import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/hooks/use-locale";
import * as z from "zod";

const formSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().min(1),
  role: z.nativeEnum(UserRole)
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateAccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLocale();

  const hasAccess = user && (
    user.role === UserRole.OWNER ||
    user.role === UserRole.SECURITY ||
    user.role === UserRole.HEADADMIN ||
    user.role === UserRole.ADMIN
  );

  const canCreateHighLevelRoles = user && (
    user.role === UserRole.OWNER ||
    user.role === UserRole.SECURITY
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      displayName: "",
      role: UserRole.USER
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.success'),
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t('status.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!hasAccess) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-6">{t('navigation.createAccount')}</h1>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t('navigation.createAccount')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((data) => createUserMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="username">{t('auth.username')}</Label>
                <Input
                  id="username"
                  {...form.register("username")}
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">{t('auth.displayName')}</Label>
                <Input
                  id="displayName"
                  {...form.register("displayName")}
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t('auth.role')}</Label>
                <Select
                  onValueChange={(value) => form.setValue("role", value as UserRole)}
                  value={form.watch("role")}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder={t('roles.user')} />
                  </SelectTrigger>
                  <SelectContent>
                    {canCreateHighLevelRoles && (
                      <>
                        <SelectItem value={UserRole.SECURITY}>{t('roles.security')}</SelectItem>
                        <SelectItem value={UserRole.HEADADMIN}>{t('roles.headadmin')}</SelectItem>
                        <SelectItem value={UserRole.ADMIN}>{t('roles.admin')}</SelectItem>
                      </>
                    )}
                    {hasAccess && (
                      <>
                        <SelectItem value={UserRole.MODERATOR}>{t('roles.moderator')}</SelectItem>
                        <SelectItem value={UserRole.SHOP_OWNER}>{t('roles.shop_owner')}</SelectItem>
                        <SelectItem value={UserRole.SHOP_MAIN}>{t('roles.shop_main')}</SelectItem>
                        <SelectItem value={UserRole.SHOP_STAFF}>{t('roles.shop_staff')}</SelectItem>
                        <SelectItem value={UserRole.USER}>{t('roles.user')}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="mt-4"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('navigation.createAccount')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}