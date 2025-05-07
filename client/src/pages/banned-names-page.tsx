import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BannedName {
  id: number;
  pattern: string;
  reason: string;
  createdAt: string;
}

export default function BannedNamesPage() {
  const { toast } = useToast();
  const [newPattern, setNewPattern] = useState("");
  const [newReason, setNewReason] = useState("");

  // Получение списка запрещенных названий
  const { data: bannedNames, isLoading } = useQuery<BannedName[]>({
    queryKey: ["/api/banned-names"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/banned-names");
      return response.json();
    },
  });

  // Мутация для добавления нового запрещенного названия
  const addBannedNameMutation = useMutation({
    mutationFn: async (data: { pattern: string; reason: string }) => {
      const response = await apiRequest("POST", "/api/banned-names", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banned-names"] });
      setNewPattern("");
      setNewReason("");
      toast({
        title: "Успешно",
        description: "Запрещенное название добавлено",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Мутация для удаления запрещенного названия
  const deleteBannedNameMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/banned-names/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banned-names"] });
      toast({
        title: "Успешно",
        description: "Запрещенное название удалено",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddBannedName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern || !newReason) return;

    addBannedNameMutation.mutate({
      pattern: newPattern,
      reason: newReason,
    });
  };

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            Запрещенные названия
          </h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Добавить новое правило</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBannedName} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Шаблон
                    </label>
                    <Input
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      placeholder="Например: *bad*word* или ^test$"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Причина
                    </label>
                    <Input
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder="Причина запрета"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={!newPattern || !newReason || addBannedNameMutation.isPending}
                >
                  {addBannedNameMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Список запрещенных названий</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : bannedNames && bannedNames.length > 0 ? (
                <div className="space-y-4">
                  {bannedNames.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{item.pattern}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {item.reason}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Добавлено: {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteBannedNameMutation.mutate(item.id)}
                        disabled={deleteBannedNameMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Запрещенные названия не найдены
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 