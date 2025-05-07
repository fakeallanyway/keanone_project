import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function AboutPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings/public");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
  });

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
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>О нас</CardTitle>
            </CardHeader>
            <CardContent>
              {settings?.aboutUs ? (
                <div className="prose dark:prose-invert max-w-none">
                  {settings.aboutUs.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Информация о нас еще не добавлена.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 