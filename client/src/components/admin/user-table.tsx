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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  Star,
  Trash2,
  UserX,
  Crown,
  Lock,
  Unlock,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/hooks/use-locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface UserTableProps {
  users: User[];
  currentUser: User;
}

export function UserTable({ users, currentUser }: UserTableProps) {
  const { toast } = useToast();
  const { t } = useLocale();
  
  // Правильные проверки ролей
  const isOwner = currentUser.role === UserRole.OWNER;
  const isSecurity = currentUser.role === UserRole.SECURITY;
  const isHeadAdmin = currentUser.role === UserRole.HEADADMIN;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isModerator = currentUser.role === UserRole.MODERATOR;
  
  // Группировка прав
  const hasFullAccess = isOwner || isSecurity;
  const hasAdminAccess = hasFullAccess || isHeadAdmin || isAdmin;
  const hasModeratorAccess = hasAdminAccess || isModerator;

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockDuration, setBlockDuration] = useState("permanent");
  const [customDuration, setCustomDuration] = useState("");

  // Helper function to check if a user can be promoted/demoted to a role
  const canChangeRole = (user: User, targetRole: UserRole) => {
    // Нельзя изменять роль самому себе
    if (user.id === currentUser.id) return false;
    
    // Нельзя изменять роль владельца
    if (user.role === UserRole.OWNER) return false;
    
    // Только OWNER и SECURITY могут управлять ролями SECURITY, HEADADMIN и ADMIN
    if ([UserRole.SECURITY, UserRole.HEADADMIN, UserRole.ADMIN].includes(targetRole)) {
      return hasFullAccess;
    }
    
    // HEADADMIN и ADMIN могут управлять ролями MODERATOR и ниже
    if (targetRole === UserRole.MODERATOR) {
      return hasAdminAccess;
    }
    
    // Модераторы могут управлять только обычными пользователями
    if (isModerator) {
      return targetRole === UserRole.USER;
    }
    
    return false;
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: number;
      role: UserRole;
    }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.success'),
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: number;
      updates: Partial<User>;
    }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/status`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.success'),
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

  const blockUserMutation = useMutation({
    mutationFn: async ({
      userId,
      reason,
      duration,
    }: {
      userId: number;
      reason: string;
      duration?: string;
    }) => {
      try {
        console.log('Отправка запроса на блокировку:', { userId, reason, duration });
        const response = await fetch(`/api/users/${userId}/block`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason, duration }),
          credentials: 'include',
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.message || response.statusText);
          } else {
            const text = await response.text();
            throw new Error(`${response.status}: ${text.substring(0, 100)}`);
          }
        }

        return await response.json();
      } catch (error) {
        console.error('Ошибка при блокировке пользователя:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.userBlocked'),
      });
      setBlockDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error('Ошибка в мутации блокировки:', error);
      toast({
        title: t('status.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      try {
        console.log('Отправка запроса на разблокировку:', userId);
        const response = await fetch(`/api/users/${userId}/unblock`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.message || response.statusText);
          } else {
            const text = await response.text();
            throw new Error(`${response.status}: ${text.substring(0, 100)}`);
          }
        }

        return await response.json();
      } catch (error) {
        console.error('Ошибка при разблокировке пользователя:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.userUnblocked'),
      });
    },
    onError: (error: Error) => {
      console.error('Ошибка в мутации разблокировки:', error);
      toast({
        title: t('status.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/verify`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.success'),
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('status.success'),
        description: t('status.success'),
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

  const handleBlockUser = () => {
    if (!selectedUser) return;
    
    let finalDuration = undefined;
    if (blockDuration === "custom" && customDuration) {
      finalDuration = customDuration;
    } else if (blockDuration !== "permanent") {
      finalDuration = blockDuration;
    }
    
    blockUserMutation.mutate({
      userId: selectedUser.id,
      reason: blockReason,
      duration: finalDuration
    });
  };

  const openBlockDialog = (user: User) => {
    setSelectedUser(user);
    setBlockReason("");
    setBlockDuration("permanent");
    setCustomDuration("");
    setBlockDialogOpen(true);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('auth.username')}</TableHead>
            <TableHead>{t('auth.displayName')}</TableHead>
            <TableHead>{t('auth.role')}</TableHead>
            <TableHead>{t('status.title')}</TableHead>
            <TableHead className="text-right">{t('actions.title')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
                      <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {user.isVerified && (
                      <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-[2px]">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <span>{user.username}</span>
                </div>
              </TableCell>
              <TableCell>{user.displayName || user.username}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    user.role === UserRole.OWNER
                      ? "border-yellow-500 text-yellow-500"
                      : undefined
                  }
                >
                  {t(`roles.${user.role.toLowerCase()}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {user.isPremium && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      {t('status.premium')}
                    </Badge>
                  )}
                  {user.isBlocked && (
                    <Badge variant="destructive">{t('status.blocked')}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {user.id !== currentUser.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Управление верификацией */}
                      {hasAdminAccess && (
                        <DropdownMenuItem
                          onClick={() => verifyUserMutation.mutate(user.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {user.isVerified ? t('actions.removeVerification') : t('actions.verify')}
                        </DropdownMenuItem>
                      )}

                      {/* Управление ролями администраторов */}
                      {hasFullAccess && user.role !== UserRole.OWNER && (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                userId: user.id,
                                role: user.role === UserRole.HEADADMIN ? UserRole.ADMIN : UserRole.HEADADMIN,
                              })
                            }
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {user.role === UserRole.HEADADMIN ? t('actions.removeHeadAdmin') : t('actions.makeHeadAdmin')}
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                userId: user.id,
                                role: user.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN,
                              })
                            }
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {user.role === UserRole.ADMIN ? t('actions.removeAdmin') : t('actions.makeAdmin')}
                          </DropdownMenuItem>
                        </>
                      )}

                      {/* Управление модераторами */}
                      {hasAdminAccess && user.role !== UserRole.OWNER && user.role !== UserRole.SECURITY && user.role !== UserRole.HEADADMIN && (
                        <DropdownMenuItem
                          onClick={() =>
                            updateRoleMutation.mutate({
                              userId: user.id,
                              role: user.role === UserRole.MODERATOR ? UserRole.USER : UserRole.MODERATOR,
                            })
                          }
                        >
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          {user.role === UserRole.MODERATOR ? t('actions.removeModerator') : t('actions.makeModerator')}
                        </DropdownMenuItem>
                      )}

                      {/* Управление премиум статусом */}
                      {hasAdminAccess && (
                        <DropdownMenuItem
                          onClick={() =>
                            updateStatusMutation.mutate({
                              userId: user.id,
                              updates: { isPremium: !user.isPremium },
                            })
                          }
                        >
                          <Crown className="mr-2 h-4 w-4" />
                          {user.isPremium ? t('actions.removePremium') : t('actions.makePremium')}
                        </DropdownMenuItem>
                      )}

                      {/* Блокировка пользователей */}
                      {hasModeratorAccess && user.role !== UserRole.OWNER && user.role !== UserRole.SECURITY && (
                        <>
                          {user.isBlocked ? (
                            <DropdownMenuItem
                              onClick={() => unblockUserMutation.mutate(user.id)}
                            >
                              <Unlock className="mr-2 h-4 w-4" />
                              {t('actions.unblock')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => openBlockDialog(user)}
                            >
                              <Lock className="mr-2 h-4 w-4" />
                              {t('actions.block')}
                            </DropdownMenuItem>
                          )}
                        </>
                      )}

                      {/* Удаление пользователей */}
                      {hasFullAccess && user.role !== UserRole.OWNER && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('actions.delete')}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('actions.deleteUser')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('actions.deleteUserConfirm')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteUserMutation.mutate(user.id)}
                              >
                                {t('actions.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Блокировка пользователя</DialogTitle>
            <DialogDescription>
              Укажите причину и срок блокировки пользователя {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="block-reason">Причина блокировки</Label>
              <Textarea 
                id="block-reason" 
                placeholder="Укажите причину блокировки" 
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="block-duration">Срок блокировки</Label>
              <Select value={blockDuration} onValueChange={setBlockDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите срок блокировки" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Бессрочно</SelectItem>
                  <SelectItem value="1 день">1 день</SelectItem>
                  <SelectItem value="3 дня">3 дня</SelectItem>
                  <SelectItem value="7 дней">7 дней</SelectItem>
                  <SelectItem value="14 дней">14 дней</SelectItem>
                  <SelectItem value="30 дней">30 дней</SelectItem>
                  <SelectItem value="custom">Указать вручную</SelectItem>
                </SelectContent>
              </Select>
              
              {blockDuration === "custom" && (
                <div className="mt-2">
                  <Input 
                    placeholder="Например: 5 дней, 2 недели, 1 месяц" 
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleBlockUser} 
              disabled={!blockReason || (blockDuration === "custom" && !customDuration)}
            >
              Заблокировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}