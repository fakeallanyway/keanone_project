import { User, UserRole } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Unlock, Calendar, Clock, Shield } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/hooks/use-locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

interface BlockedUsersTableProps {
  users: User[];
  currentUser: User;
}

export function BlockedUsersTable({ users, currentUser }: BlockedUsersTableProps) {
  const { toast } = useToast();
  const { t } = useLocale();
  const isOwner = currentUser.role === UserRole.OWNER && UserRole.SECURITY;
  const isAdmin = currentUser.role === UserRole.ADMIN && UserRole.HEADADMIN;
  const isModerator = currentUser.role === UserRole.MODERATOR;
  const isStaff = isOwner || isAdmin || isModerator;
  
  // Фильтруем только заблокированных пользователей
  const blockedUsers = users.filter(user => user.isBlocked);

  // Функция для получения имени пользователя, заблокировавшего другого пользователя
  const getBlockedByUsername = (blockedById: number | null) => {
    if (!blockedById) return "Система";
    const blockedByUser = users.find(user => user.id === blockedById);
    return blockedByUser ? blockedByUser.username : "Неизвестно";
  };

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/unblock`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.userUnblocked'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('status.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (blockedUsers.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Нет заблокированных пользователей
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Пользователь</TableHead>
          <TableHead>Причина блокировки</TableHead>
          <TableHead>Дата блокировки</TableHead>
          <TableHead>Срок блокировки</TableHead>
          <TableHead>Кем заблокирован</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {blockedUsers.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
                  <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div>{user.username}</div>
                  <div className="text-xs text-muted-foreground">{user.displayName || ""}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-md break-words">
                {user.blockReason || "Причина не указана"}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {user.blockedAt 
                    ? format(new Date(user.blockedAt), 'dd.MM.yyyy HH:mm') 
                    : "Дата не указана"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {user.blockDuration || "Бессрочно"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>
                  {getBlockedByUsername(user.blockedById)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              {isStaff && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unblockUserMutation.mutate(user.id)}
                  disabled={unblockUserMutation.isPending}
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Разблокировать
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 