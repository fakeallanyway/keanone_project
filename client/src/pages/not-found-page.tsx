import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold">404 - Страница не найдена</h1>
          </div>

          <p className="mt-4 text-muted-foreground mb-6">
            Запрашиваемая страница не существует.
          </p>
          
          <Button asChild>
            <Link href="/">Вернуться на главную</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 