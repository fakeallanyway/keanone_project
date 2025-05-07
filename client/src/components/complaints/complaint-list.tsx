import { Complaint } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, Store } from "lucide-react";
import { format } from "date-fns";
import { useLocale } from "@/hooks/use-locale";

// Расширяем интерфейс Complaint для обращений в магазины
interface ComplaintWithShopInfo extends Complaint {
  isShopComplaint?: boolean;
  shopName?: string;
  shopId?: number;
}

interface ComplaintListProps {
  complaints: ComplaintWithShopInfo[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ComplaintList({ complaints, selectedId, onSelect }: ComplaintListProps) {
  const { t } = useLocale();

  // Функция для получения текста статуса
  const getStatusText = (status: string) => {
    switch (status) {
      case "PENDING":
        return t('complaints.pending');
      case "IN_PROGRESS":
        return t('complaints.inProgress');
      case "RESOLVED":
        return t('complaints.resolved');
      case "REJECTED":
        return t('complaints.rejected');
      default:
        return status;
    }
  };

  // Функция для получения варианта бейджа в зависимости от статуса
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "IN_PROGRESS":
        return "outline";
      case "RESOLVED":
        return "default";
      case "REJECTED":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Обработчик клика на кнопку "Открыть чат"
  const handleOpenChat = (e: React.MouseEvent, complaintId: number) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(complaintId);
  };

  return (
    <div className="space-y-4">
      {complaints.map((complaint) => (
        <Card
          key={complaint.id}
          className={`p-4 cursor-pointer transition-all hover:shadow-md ${
            selectedId === complaint.id ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => onSelect(complaint.id)}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              {complaint.isShopComplaint && (
                <Store className="h-4 w-4 text-muted-foreground" />
              )}
              <h3 className="font-medium">{complaint.title}</h3>
            </div>
            <Badge variant={getStatusBadgeVariant(complaint.status)}>
              {getStatusText(complaint.status)}
            </Badge>
          </div>

          {complaint.isShopComplaint && complaint.shopName && (
            <p className="text-xs text-muted-foreground mb-1">
              Магазин: {complaint.shopName}
            </p>
          )}

          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {complaint.description}
          </p>

          <div className="flex justify-between items-center">
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(complaint.createdAt), "dd.MM.yyyy HH:mm")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleOpenChat(e, complaint.id)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('complaints.openChat')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}