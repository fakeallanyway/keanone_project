import { Complaint, User, UserRole } from "@shared/schema";
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
  UserCheck,
  Flag,
  User as UserIcon,
  UserX,
  Clock,
  Calendar,
  MessageSquare
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useLocale } from "@/hooks/use-locale";

interface ComplaintTableProps {
  complaints: Complaint[];
  users: User[];
  currentUser: User;
}

export function ComplaintTable({ complaints, users, currentUser }: ComplaintTableProps) {
  const { t } = useLocale();
  
  const assignComplaintMutation = useMutation({
    mutationFn: async (complaintId: number) => {
      const res = await apiRequest(
        "PATCH",
        `/api/complaints/${complaintId}/assign`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
    },
  });

  const resolveComplaintMutation = useMutation({
    mutationFn: async (complaintId: number) => {
      const res = await apiRequest(
        "PATCH",
        `/api/complaints/${complaintId}/resolve`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
    },
  });

  function getUserName(userId: number | null) {
    if (userId === null) return t('complaints.unknownUser');
    return users.find((u) => u.id === userId)?.username ?? t('complaints.unknownUser');
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t('complaints.pending')}
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            {t('complaints.inProgress')}
          </Badge>
        );
      case "RESOLVED":
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3" />
            {t('complaints.resolved')}
          </Badge>
        );
      default:
        return null;
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {t('complaints.title')}
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <UserIcon className="h-4 w-4" />
              {t('complaints.reportedBy')}
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <UserX className="h-4 w-4" />
              {t('complaints.against')}
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <Flag className="h-4 w-4" />
              {t('status.title')}
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              {t('complaints.assignedTo')}
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {t('complaints.createdAt')}
            </div>
          </TableHead>
          <TableHead className="text-right">{t('actions.title')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {complaints.map((complaint) => (
          <TableRow key={complaint.id}>
            <TableCell className="font-medium">{complaint.title}</TableCell>
            <TableCell>{getUserName(complaint.userId)}</TableCell>
            <TableCell>{getUserName(complaint.targetUserId)}</TableCell>
            <TableCell>{getStatusBadge(complaint.status)}</TableCell>
            <TableCell>
              {complaint.assignedToId
                ? getUserName(complaint.assignedToId)
                : t('complaints.unassigned')}
            </TableCell>
            <TableCell>
              {format(new Date(complaint.createdAt), "dd.MM.yyyy HH:mm")}
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {complaint.status === "PENDING" && (
                    <DropdownMenuItem
                      onClick={() => assignComplaintMutation.mutate(complaint.id)}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      {t('complaints.assign')}
                    </DropdownMenuItem>
                  )}
                  {complaint.status === "IN_PROGRESS" && (
                    <DropdownMenuItem
                      onClick={() => resolveComplaintMutation.mutate(complaint.id)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t('complaints.resolve')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
