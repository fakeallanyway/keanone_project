import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, comparePasswords } from "./auth";
import { storage } from "./storage";
import { UserRole, ShopStatus } from "@shared/schema";
import {hashPassword} from './auth';
import { WebSocketServer } from 'ws';
import * as WebSocket from 'ws';
import session from 'express-session';
import { 
  User, Session, 
  Complaint,
  ComplaintMessage,
  Shop,
  Product,
  Review,
  ShopChat,
  ShopChatMessage,
  ChatMessageType
} from "@shared/schema";
import { z } from "zod";
// Assuming sessionSettings is defined elsewhere
const sessionSettings = {/* ... your session settings ... */};

// Схема валидации настроек сайта
const siteSettingsSchema = z.object({
  siteName: z.string().min(1, "Название сайта обязательно"),
  siteDescription: z.string().optional(),
  contactEmail: z.string().email("Некорректный email"),
  maintenanceMode: z.boolean(),
  registrationEnabled: z.boolean(),
  maxShopsPerUser: z.number().min(1, "Минимум 1 магазин"),
  maxProductsPerShop: z.number().min(1, "Минимум 1 товар"),
  commissionRate: z.number().min(0, "Минимум 0%").max(100, "Максимум 100%"),
  termsAndConditions: z.string().optional(),
  privacyPolicy: z.string().optional(),
});

// Схема валидации для настроек
const settingsSchema = z.object({
  termsAndConditions: z.string(),
  privacyPolicy: z.string(),
  aboutUs: z.string(),
  // другие поля если есть
});

// Функции проверки ролей
function isOwner(req: Express.Request) {
  return req.user?.role === UserRole.OWNER || req.user?.role === UserRole.SECURITY;
}

function isAdmin(req: Express.Request) {
  return req.user?.role === UserRole.OWNER || 
         req.user?.role === UserRole.SECURITY || 
         req.user?.role === UserRole.ADMIN;
}

function isHeadAdmin(req: Express.Request) {
  return req.user?.role === UserRole.HEADADMIN;
}

function isModerator(req: Express.Request) {
  return req.user?.role === UserRole.MODERATOR;
}

// Проверка на принадлежность к администрации площадки
function isAdministration(req: Express.Request) {
  return isOwner(req) || isAdmin(req);
}

// Проверка на принадлежность к модерации
function isModeration(req: Express.Request) {
  return isAdministration(req) || isHeadAdmin(req) || isModerator(req);
}

function isStaff(req: Express.Request) {
  const staffRoles = [
    UserRole.OWNER,
    UserRole.SECURITY, 
    UserRole.ADMIN,
    UserRole.HEADADMIN,
    UserRole.MODERATOR
  ];
  return req.user && staffRoles.includes(req.user.role as UserRole);
}

function isShopStaff(req: Express.Request) {
  const shopStaffRoles = [
    UserRole.SHOP_OWNER,
    UserRole.SHOP_MAIN,
    UserRole.SHOP_STAFF
  ];
  return req.user && shopStaffRoles.includes(req.user.role as UserRole);
}

// Проверка, может ли пользователь изменять статус целевого пользователя
async function canModifyUser(req: Express.Request, targetUserId: number) {
  const targetUser = await storage.getUser(targetUserId);
  if (!targetUser) return false;

  // OWNER и SECURITY могут всё
  if (isOwner(req)) {
    return true;
  }

  // ADMIN может всё, кроме изменения OWNER и SECURITY
  if (req.user?.role === UserRole.ADMIN) {
    return targetUser.role !== UserRole.OWNER && 
           targetUser.role !== UserRole.SECURITY;
  }

  // HEADADMIN может изменять всех, кроме OWNER, SECURITY и ADMIN
  if (isHeadAdmin(req)) {
    return targetUser.role !== UserRole.OWNER && 
           targetUser.role !== UserRole.SECURITY && 
           targetUser.role !== UserRole.ADMIN;
  }

  // MODERATOR может изменять только обычных пользователей и сотрудников магазинов
  if (isModerator(req)) {
    return targetUser.role === UserRole.USER || 
           targetUser.role === UserRole.SHOP_OWNER || 
           targetUser.role === UserRole.SHOP_MAIN || 
           targetUser.role === UserRole.SHOP_STAFF;
  }

  return false;
}

// Проверка, может ли пользователь управлять обращениями
function canManageComplaints(req: Express.Request) {
  return isModeration(req); // Вся администрация и модерация могут управлять обращениями
}

// Проверка, может ли пользователь управлять магазином
async function canManageShop(req: Express.Request, shopId: number) {
  const shop = await storage.getShop(shopId);
  if (!shop) return false;

  // OWNER, SECURITY и администрация могут управлять всеми магазинами
  if (isAdministration(req)) return true;

  // Владелец магазина может управлять своим магазином
  return shop.ownerId === req.user?.id;
}

// Проверка, может ли пользователь управлять сотрудниками магазина
async function canManageShopStaff(req: Express.Request, shopId: number) {
  const shop = await storage.getShop(shopId);
  if (!shop) return false;
  
  // Роли с полным доступом (OWNER, SECURITY, ADMIN, HEADADMIN) могут управлять сотрудниками любого магазина
  if (req.user && (
    req.user.role === UserRole.OWNER || 
    req.user.role === UserRole.SECURITY || 
    req.user.role === UserRole.ADMIN || 
    req.user.role === UserRole.HEADADMIN
  )) return true;
  
  // SHOP_OWNER и SHOP_MAIN могут управлять сотрудниками своего магазина
  if (req.user && (
    req.user.role === UserRole.SHOP_OWNER || 
    req.user.role === UserRole.SHOP_MAIN
  )) {
    // Проверяем, привязан ли пользователь к этому магазину
    const userShops = await storage.getShopsByOwner(req.user.id);
    return userShops.some(s => s.id === shopId);
  }
  
  return false;
}

// Проверка, может ли пользователь просматривать сотрудников магазина
async function canViewShopStaff(req: Express.Request, shopId: number) {
  const shop = await storage.getShop(shopId);
  if (!shop) return false;

  // Администрация может просматривать всех сотрудников
  if (isAdministration(req)) return true;

  // Сотрудники магазина могут просматривать своих коллег
  if (req.user && (
    req.user.role === UserRole.SHOP_OWNER || 
    req.user.role === UserRole.SHOP_MAIN || 
    req.user.role === UserRole.SHOP_STAFF
  )) {
    // Проверяем, привязан ли пользователь к этому магазину
    const userShops = await storage.getShopsByOwner(req.user.id);
    return userShops.some(s => s.id === shopId);
  }

  return false;
}

// Проверка, может ли пользователь просматривать обращение
async function canAccessComplaint(req: Express.Request, complaintId: number) {
  const complaint = await storage.getComplaint(complaintId);
  if (!complaint) return false;

  // OWNER, SECURITY и администрация всегда имеют доступ
  if (isAdministration(req)) return true;

  // HEADADMIN и MODERATOR имеют доступ
  if (isHeadAdmin(req) || isModerator(req)) return true;

  // Создатель обращения имеет доступ
  return complaint.userId === req.user?.id;
}

// Permission check functions for shop complaints
async function canViewShopComplaints(req: Express.Request, shopId: number) {
  // Admin and shop staff can view shop complaints
  if (isAdministration(req)) return true;
  
  if (req.user && (
    req.user.role === UserRole.SHOP_OWNER || 
    req.user.role === UserRole.SHOP_MAIN || 
    req.user.role === UserRole.SHOP_STAFF
  )) {
    // Check if user is associated with this shop
    const userShops = await storage.getShopsByOwner(req.user.id);
    return userShops.some(s => s.id === shopId);
  }
  
  return false;
}

async function canAccessShopComplaint(req: Express.Request, shopId: number, complaintId: number) {
  // Admin and shop staff can access shop complaints
  if (isAdministration(req)) return true;
  
  // Shop staff can access complaints for their shop
  if (req.user && (
    req.user.role === UserRole.SHOP_OWNER || 
    req.user.role === UserRole.SHOP_MAIN || 
    req.user.role === UserRole.SHOP_STAFF
  )) {
    // Check if user is associated with this shop
    const userShops = await storage.getShopsByOwner(req.user.id);
    if (userShops.some(s => s.id === shopId)) return true;
  }
  
  // Creator of the complaint can access it
  try {
    const complaint = await storage.getShopComplaint(shopId, complaintId);
    return complaint && complaint.userId === req.user?.id;
  } catch (error) {
    return false;
  }
}

async function canManageShopComplaints(req: Express.Request, shopId: number) {
  // Admin and shop management can manage shop complaints
  if (isAdministration(req)) return true;
  
  if (req.user && (
    req.user.role === UserRole.SHOP_OWNER || 
    req.user.role === UserRole.SHOP_MAIN
  )) {
    // Check if user is associated with this shop
    const userShops = await storage.getShopsByOwner(req.user.id);
    return userShops.some(s => s.id === shopId);
  }
  
  return false;
}

// Shop Complaints API endpoints
export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdministration(req)) return res.sendStatus(403);

    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/users/staff", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdministration(req)) return res.sendStatus(403);

    const staff = await storage.getStaffUsers();
    res.json(staff);
  });

  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isOwner(req)) return res.sendStatus(403);

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });
    res.status(201).json(user);
  });

  app.patch("/api/users/:id/role", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const targetId = parseInt(req.params.id);
    if (!await canModifyUser(req, targetId)) {
      return res.sendStatus(403);
    }

    try {
      const user = await storage.updateUserRole(targetId, req.body.role);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/users/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const targetId = parseInt(req.params.id);
    if (!await canModifyUser(req, targetId)) {
      return res.sendStatus(403);
    }

    const user = await storage.updateUserStatus(targetId, req.body);
    res.json(user);
  });

  app.patch("/api/users/:id/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdministration(req)) return res.sendStatus(403);

    const targetId = parseInt(req.params.id);
    if (!await canModifyUser(req, targetId)) {
      return res.sendStatus(403);
    }

    const user = await storage.verifyUser(targetId);
    res.json(user);
  });

  // Bulk update users with specific roles to premium and verified status
  app.post("/api/users/bulk-update-status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isOwner(req)) return res.sendStatus(403);

    const { roles, isPremium, isVerified } = req.body;
    
    if (!roles || !Array.isArray(roles)) {
      return res.status(400).json({ message: "Roles must be provided as an array" });
    }

    try {
      const allUsers = await storage.getAllUsers();
      const usersToUpdate = allUsers.filter(user => roles.includes(user.role));
      
      const updatedUsers = [];
      for (const user of usersToUpdate) {
        const updatedUser = await storage.updateUser(user.id, {
          isPremium: isPremium !== undefined ? isPremium : user.isPremium,
          isVerified: isVerified !== undefined ? isVerified : user.isVerified,
        });
        updatedUsers.push(updatedUser);
      }
      
      res.json({ 
        message: `Updated ${updatedUsers.length} users`, 
        updatedUsers 
      });
    } catch (error) {
      console.error("Error updating users:", error);
      res.status(500).json({ message: "Error updating users" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isOwner(req)) return res.sendStatus(403);

    await storage.deleteUser(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Profile management routes
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.updateUser(req.user!.id, req.body);
    res.json(user);
  });

  app.patch("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { currentPassword, newPassword } = req.body;
    const user = await storage.getUser(req.user!.id);

    if (!user || !(await comparePasswords(currentPassword, user.password))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const updatedUser = await storage.updateUser(req.user!.id, {
      password: await hashPassword(newPassword),
    });
    res.json(updatedUser);
  });

  // Session management routes
  app.get("/api/sessions/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const sessions = await storage.getActiveSessions();
    res.json(sessions);
  });

  app.get("/api/sessions/expired", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const sessions = await storage.getExpiredSessions();
    res.json(sessions);
  });

  app.get("/api/sessions/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const sessions = await storage.getUserSessions(req.user!.id);
    res.json(sessions);
  });

  // Complaint management routes
  app.post("/api/complaints", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      console.log("Создание обращения:", req.body);
      const complaint = await storage.createComplaint(req.user!.id, req.body);
      console.log("Обращение создано:", complaint);
      res.status(201).json(complaint);
    } catch (error) {
      console.error("Ошибка при создании обращения:", error);
      res.status(500).json({ message: "Ошибка при создании обращения" });
    }
  });

  app.get("/api/complaints", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    if (!isStaff(req)) {
      // Для обычных пользователей возвращаем только их обращения
        const complaints = await storage.getUserComplaints(req.user!.id);
      return res.json(complaints);
    }

    try {
      // Для администрации возвращаем все обращения + обращения в магазины
      // Сначала получаем все обычные жалобы
      const platformComplaints = await storage.getAllComplaints();

      // Получаем все магазины
      const allShops = await storage.getAllShops();
      const shopIds = allShops.map(shop => shop.id);
      
      // Собираем все жалобы в магазины
      let shopComplaints = [];
      for (const shopId of shopIds) {
        const shopComplaintsData = await storage.getShopComplaints(shopId);
        
        if (shopComplaintsData.length > 0) {
          // Добавляем информацию о магазине к каждой жалобе
          const shopData = allShops.find(shop => shop.id === shopId);
          shopComplaints.push(...shopComplaintsData.map(complaint => ({
            ...complaint,
            isShopComplaint: true,
            shopName: shopData?.name || 'Неизвестный магазин',
            shopId: shopId
          })));
        }
      }
      
      // Объединяем обычные жалобы с жалобами в магазины
      const allComplaints = [
        ...platformComplaints.map(complaint => ({ ...complaint, isShopComplaint: false })),
        ...shopComplaints
      ];
      
      // Сортируем по дате создания (новые в начале)
      allComplaints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`Администратор получил все жалобы:`, allComplaints.length);
      res.json(allComplaints);
    } catch (error) {
      console.error("Ошибка при получении всех жалоб:", error);
      res.status(500).json({ message: "Ошибка при получении жалоб" });
    }
  });

  app.get("/api/complaints/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Получаем обычные жалобы пользователя
      const platformComplaints = await storage.getUserComplaints(req.user!.id);
      
      // Получаем все магазины (для последующей фильтрации)
      const allShops = await storage.getAllShops();
      const shopIds = allShops.map(shop => shop.id);
      
      // Собираем все жалобы пользователя в магазины
      let shopComplaints = [];
      for (const shopId of shopIds) {
        const shopComplaintsForUser = (await storage.getShopComplaints(shopId))
          .filter(complaint => complaint.userId === req.user!.id);
          
        if (shopComplaintsForUser.length > 0) {
          // Добавляем информацию о магазине к каждой жалобе
          const shopData = allShops.find(shop => shop.id === shopId);
          shopComplaints.push(...shopComplaintsForUser.map(complaint => ({
            ...complaint,
            isShopComplaint: true,
            shopName: shopData?.name || 'Неизвестный магазин',
            shopId: shopId
          })));
        }
      }
      
      // Объединяем обычные жалобы с жалобами в магазины
      const allComplaints = [
        ...platformComplaints.map(complaint => ({ ...complaint, isShopComplaint: false })),
        ...shopComplaints
      ];
      
      // Сортируем по дате создания (новые в начале)
      allComplaints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`Получены жалобы пользователя ${req.user!.id}:`, allComplaints.length);
      res.json(allComplaints);
    } catch (error) {
      console.error("Ошибка при получении жалоб пользователя:", error);
      res.status(500).json({ message: "Ошибка при получении жалоб" });
    }
  });

  // Получение конкретного тикета по ID
  app.get("/api/complaints/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const complaintId = parseInt(req.params.id);
    if (!await canAccessComplaint(req, complaintId)) {
      return res.sendStatus(403);
    }

    const complaint = await storage.getComplaint(complaintId);
    if (!complaint) return res.sendStatus(404);
    
    res.json(complaint);
  });
  
  // Получение сообщений тикета
  app.get("/api/complaints/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const complaintId = parseInt(req.params.id);
    if (!await canAccessComplaint(req, complaintId)) {
      return res.sendStatus(403);
    }

    const messages = await storage.getComplaintMessages(complaintId);
    res.json(messages);
  });

  // Отправка сообщения в тикет через REST API
  app.post("/api/complaints/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const complaintId = parseInt(req.params.id);
    if (!await canAccessComplaint(req, complaintId)) {
      return res.sendStatus(403);
    }

    const message = await storage.createComplaintMessage({
      complaintId,
      userId: req.user!.id,
      message: req.body.message,
    });
    res.status(201).json(message);
  });

  app.patch("/api/complaints/:id/assign", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!canManageComplaints(req)) return res.sendStatus(403);

    const complaint = await storage.assignComplaint(
      parseInt(req.params.id),
      req.user!.id
    );
    res.json(complaint);
  });

  app.patch("/api/complaints/:id/resolve", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!canManageComplaints(req)) return res.sendStatus(403);

    const complaint = await storage.resolveComplaint(parseInt(req.params.id));
    res.json(complaint);
  });

  // Маршрут для отклонения жалобы
  app.patch("/api/complaints/:id/reject", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!canManageComplaints(req)) return res.sendStatus(403);

    const { reason } = req.body;
    const complaint = await storage.rejectComplaint(parseInt(req.params.id), reason);
    res.json(complaint);
  });

  // Shop management routes
  app.get("/api/shops", async (req, res) => {
    const query = req.query.search as string | undefined;
    const ownerId = req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined;
    let shops;
    
    if (ownerId) {
      shops = await storage.getShopsByOwner(ownerId);
    } else if (query) {
      shops = await storage.searchShops(query);
    } else {
      shops = await storage.getAllShops();
    }
    
    res.json(shops);
  });

  app.get("/api/shops/:id", async (req, res) => {
    const shop = await storage.getShop(parseInt(req.params.id));
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(shop);
  });

  // API для работы с сотрудниками магазина
  app.get("/api/shops/:id/staff", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    if (!await canViewShopStaff(req, shopId)) {
      return res.sendStatus(403);
    }

    // Получаем сотрудников магазина
    const staff = await storage.getShopStaff(shopId);
    res.json(staff);
  });

  app.post("/api/shops", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Только определенные роли могут создавать магазины
    if (!isAdmin(req) && !isShopStaff(req)) {
      return res.sendStatus(403);
    }
    
    const shop = await storage.createShop({
      ...req.body,
      ownerId: req.body.ownerId || req.user!.id,
    });
    res.status(201).json(shop);
  });

  app.post("/api/shops/:id/staff", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    console.log("POST /api/shops/:id/staff - Запрос на добавление сотрудника:", {
      shopId,
      body: req.body,
      user: req.user ? { id: req.user.id, role: req.user.role } : null
    });
    
    if (!await canManageShopStaff(req, shopId)) {
      console.log("Отказано в доступе - пользователь не может управлять сотрудниками магазина");
      return res.sendStatus(403);
    }

    try {
      const { username, role } = req.body;
      
      if (!username || !role) {
        return res.status(400).json({ message: "Отсутствуют обязательные параметры: username, role" });
      }
      
      console.log("Данные для добавления:", { username, role });
      
      // Проверяем существование пользователя
      const userToAdd = await storage.getUserByUsername(username);
      if (!userToAdd) {
        console.log("Пользователь не найден:", username);
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      console.log("Найден пользователь:", { id: userToAdd.id, username: userToAdd.username });

      // Проверяем, можно ли назначить эту роль
      const canAssignShopOwner = req.user && (req.user.role === UserRole.OWNER || req.user.role === UserRole.SECURITY);
      
      if (role === UserRole.SHOP_OWNER && !canAssignShopOwner) {
        console.log("Недостаточно прав для назначения роли SHOP_OWNER");
        return res.status(403).json({ message: "Недостаточно прав для назначения этой роли" });
      }

      // Проверяем валидность роли
      const validShopRoles = [UserRole.SHOP_OWNER, UserRole.SHOP_MAIN, UserRole.SHOP_STAFF];
      if (!validShopRoles.includes(role)) {
        console.error(`Недопустимая роль для сотрудника магазина: ${role}`);
        return res.status(400).json({ message: "Недопустимая роль для сотрудника магазина" });
      }

      // Добавляем пользователя в сотрудники магазина
      console.log("Добавляем пользователя в сотрудники магазина");
      const staffMember = await storage.addShopStaffMember(shopId, userToAdd.id, role);
      console.log("Сотрудник успешно добавлен:", staffMember);
      res.status(201).json(staffMember);
    } catch (error) {
      console.error("Ошибка при добавлении сотрудника:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/shops/:id/staff/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    if (!await canManageShopStaff(req, shopId)) {
      return res.sendStatus(403);
    }

    try {
      const { role } = req.body;
      
      // Проверяем, можно ли назначить эту роль
      const canAssignShopOwner = req.user && (req.user.role === UserRole.OWNER || req.user.role === UserRole.SECURITY);
      
      if (role === UserRole.SHOP_OWNER && !canAssignShopOwner) {
        return res.status(403).json({ message: "Недостаточно прав для назначения этой роли" });
      }

      // Обновляем роль сотрудника
      const staffMember = await storage.updateShopStaffRole(shopId, userId, role);
      res.json(staffMember);
    } catch (error) {
      console.error("Error updating shop staff role:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/shops/:id/staff/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    
    if (!await canManageShopStaff(req, shopId)) {
      return res.sendStatus(403);
    }

    try {
      // Удаляем сотрудника из магазина
      await storage.removeShopStaffMember(shopId, userId);
      res.sendStatus(200);
    } catch (error) {
      console.error("Error removing shop staff:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/shops/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    if (!await canManageShop(req, shopId)) {
      return res.sendStatus(403);
    }
    
    const shop = await storage.updateShop(shopId, req.body);
    res.json(shop);
  });

  app.patch("/api/shops/:id/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdmin(req)) return res.sendStatus(403);
    
    const shop = await storage.verifyShop(parseInt(req.params.id));
    res.json(shop);
  });

  app.patch("/api/shops/:id/block", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdmin(req)) return res.sendStatus(403);
    
    const { reason } = req.body;
    const shop = await storage.blockShop(parseInt(req.params.id), reason);
    res.json(shop);
  });

  app.delete("/api/shops/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    if (!await canManageShop(req, shopId)) {
      return res.sendStatus(403);
    }
    
    await storage.deleteShop(shopId);
    res.sendStatus(200);
  });

  app.get("/api/shops/:id/products", async (req, res) => {
    const shopId = parseInt(req.params.id);
    const products = await storage.getProductsByShop(shopId);
    res.json(products);
  });

  // Product management routes
  app.get("/api/products", async (req, res) => {
    const query = req.query.search as string | undefined;
    const ownerId = req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined;
    const shopId = req.query.shopId ? parseInt(req.query.shopId as string) : undefined;
    let products: Product[] = [];
    
    // Если указан ID магазина, получаем товары этого магазина
    if (shopId) {
      products = await storage.getProductsByShop(shopId);
    } 
    // Если указан ID владельца, получаем все магазины владельца и их товары
    else if (ownerId) {
      const shops = await storage.getShopsByOwner(ownerId);
      for (const shop of shops) {
        const shopProducts = await storage.getProductsByShop(shop.id);
        products = [...products, ...shopProducts];
      }
    } 
    // Если указан поисковый запрос, ищем товары по названию
    else if (query) {
      products = await storage.searchProducts(query);
    }
    // Если не указаны никакие параметры, получаем все товары
    else {
      products = await storage.getAllProducts();
    }
    
    // Если есть поисковый запрос, фильтруем результаты
    if (query && query.trim() !== "") {
      const lowerQuery = query.toLowerCase();
      products = products.filter(product => 
        product.name.toLowerCase().includes(lowerQuery) || 
        (product.description && product.description.toLowerCase().includes(lowerQuery))
      );
    }
    
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(parseInt(req.params.id));
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = req.body.shopId;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required" });
    }
    
    if (!await canManageShop(req, shopId)) {
      return res.sendStatus(403);
    }
    
    const product = await storage.createProduct(req.body);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const productId = parseInt(req.params.id);
    const product = await storage.getProduct(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    if (!await canManageShop(req, product.shopId)) {
      return res.sendStatus(403);
    }
    
    const updatedProduct = await storage.updateProduct(productId, req.body);
    res.json(updatedProduct);
  });

  app.delete("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const productId = parseInt(req.params.id);
    const product = await storage.getProduct(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    if (!await canManageShop(req, product.shopId)) {
      return res.sendStatus(403);
    }
    
    await storage.deleteProduct(productId);
    res.sendStatus(200);
  });

  // Review management routes
  app.get("/api/products/:id/reviews", async (req, res) => {
    const productId = parseInt(req.params.id);
    const reviews = await storage.getReviewsByProduct(productId);
    
    // Добавляем информацию о пользователях к отзывам
    const reviewsWithUserInfo = await Promise.all(reviews.map(async (review) => {
      const user = await storage.getUser(review.userId);
      return {
        ...review,
        userDisplayName: user?.displayName || user?.username || `Пользователь #${review.userId}`,
        userAvatarUrl: user?.avatarUrl || null,
        userRole: user?.role || "USER",
        userIsVerified: user?.isVerified || false,
        userIsPremium: user?.isPremium || false
      };
    }));
    
    res.json(reviewsWithUserInfo);
  });

  app.post("/api/products/:id/reviews", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const productId = parseInt(req.params.id);
    const product = await storage.getProduct(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    const review = await storage.createReview(req.user!.id, {
      productId,
      rating: req.body.rating,
      comment: req.body.comment,
    });
    
    res.status(201).json(review);
  });

  app.get("/api/user/shop", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Получаем магазины пользователя
    const shops = await storage.getShopsByOwner(req.user!.id);
    
    // Если у пользователя есть магазин, возвращаем первый (предполагаем, что у пользователя один магазин)
    if (shops && shops.length > 0) {
      res.json(shops[0]);
    } else {
      res.json(null);
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Скрываем пароль и другие чувствительные данные
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  app.get("/api/users/staff/online", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Получаем активные сессии
    const activeSessions = await storage.getActiveSessions();
    
    // Получаем ID пользователей с активными сессиями
    const userIds = activeSessions.map(session => session.userId);
    
    // Получаем всех сотрудников
    const allStaff = await storage.getStaffUsers();
    
    // Фильтруем только тех сотрудников, которые онлайн
    const onlineStaff = allStaff.filter(user => userIds.includes(user.id));
    
    // Скрываем пароли и другие чувствительные данные
    const safeUsers = onlineStaff.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    
    res.json(safeUsers);
  });

  // Блокировка пользователя
  app.patch("/api/users/:id/block", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const targetId = parseInt(req.params.id);
    if (!await canModifyUser(req, targetId)) {
      return res.sendStatus(403);
    }

    try {
      const user = await storage.blockUser(targetId, req.body.reason, req.body.duration, req.user!.id);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Разблокировка пользователя
  app.patch("/api/users/:id/unblock", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const targetId = parseInt(req.params.id);
    if (!await canModifyUser(req, targetId)) {
      return res.sendStatus(403);
    }

    try {
      const user = await storage.unblockUser(targetId);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Получение статистики заказов пользователя
  app.get("/api/users/:id/orders/stats", async (req, res) => {
    const userId = parseInt(req.params.id);
    
    // Заглушка для демонстрации
    // В реальном приложении здесь будет запрос к базе данных
    const stats = {
      total: Math.floor(Math.random() * 50),
      completed: Math.floor(Math.random() * 30),
      cancelled: Math.floor(Math.random() * 10)
    };
    
    res.json(stats);
  });

  // Получение статистики транзакций пользователя
  app.get("/api/users/:id/transactions/stats", async (req, res) => {
    const userId = parseInt(req.params.id);
    
    // Заглушка для демонстрации
    // В реальном приложении здесь будет запрос к базе данных
    const stats = {
      purchases: Math.floor(Math.random() * 100),
      sales: Math.floor(Math.random() * 50)
    };
    
    res.json(stats);
  });

  // Запрещенные названия
  app.get("/api/banned-names", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdmin(req)) return res.sendStatus(403);

    const bannedNames = await storage.getBannedNames();
    res.json(bannedNames);
  });

  app.post("/api/banned-names", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdmin(req)) return res.sendStatus(403);

    const bannedName = await storage.createBannedName(req.body);
    res.status(201).json(bannedName);
  });

  app.delete("/api/banned-names/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!isAdmin(req)) return res.sendStatus(403);

    await storage.deleteBannedName(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Настройки сайта
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      console.log("Fetched settings:", settings); // Для отладки
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Ошибка при получении настроек" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      // Добавим логирование для отладки
      console.log("Received settings update request:", req.body);

      // Проверяем наличие данных
      if (!req.body) {
        return res.status(400).json({ message: "No data provided" });
      }

      const updatedSettings = await storage.updateSettings(req.body);
      
      // Логируем успешное обновление
      console.log("Settings updated successfully:", updatedSettings);
      
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({
        message: "Failed to update settings",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Публичный доступ к настройкам (только для чтения определенных полей)
  app.get("/api/settings/public", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      res.json({
        termsAndConditions: settings.terms_and_conditions,
        privacyPolicy: settings.privacy_policy,
        aboutUs: settings.about_us
      });
    } catch (error) {
      console.error("Error fetching public settings:", error);
      res.status(500).json({ message: "Ошибка при получении публичных настроек" });
    }
  });

  const httpServer = createServer(app);

  // Создаем WebSocket сервер для чата в репортах
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/complaints' });

  // Создаем WebSocket сервер для чатов магазинов
  const shopChatWss = new WebSocketServer({ server: httpServer, path: '/ws/shop-chats' });

  // Сохраняем соединения пользователей для отправки сообщений магазинов
  const shopChatClients = new Map<number, WebSocket>();

  shopChatWss.on('connection', (ws, req) => {
    console.log('Новое WebSocket подключение для чата магазина');
    
    // При подключении идентифицируем пользователя
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth' && data.userId) {
          // Сохраняем соединение с пользователем
          shopChatClients.set(data.userId, ws);
          console.log(`Пользователь ${data.userId} авторизован в WebSocket чате магазинов`);
        }
        
        // Обрабатываем сообщения
        if (data.type === 'message' && data.chatId && data.message) {
          // Здесь можно добавить обработку сообщений через WebSocket
          console.log(`Получено сообщение в чат ${data.chatId}: ${data.message}`);
        }
      } catch (error) {
        console.error('Ошибка обработки WebSocket сообщения:', error);
      }
    });
    
    // Обработка отключения
    ws.on('close', () => {
      // Поиск и удаление отключившегося клиента
      for (const [userId, client] of shopChatClients.entries()) {
        if (client === ws) {
          shopChatClients.delete(userId);
          console.log(`Пользователь ${userId} отключился от WebSocket чата магазинов`);
          break;
        }
      }
    });
  });

  // API маршруты для чатов магазинов
  app.post("/api/shops/:id/chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const shopId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Создаем или получаем существующий чат
      const chat = await storage.createShopChat(shopId, userId);
      
      res.status(201).json(chat);
    } catch (error) {
      console.error("Ошибка при создании чата с магазином:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/shop-chats/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const chatId = parseInt(req.params.id);
      
      // Получаем информацию о чате
      const chat = await storage.getShopChatById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Чат не найден" });
      }
      
      // Проверяем права доступа
      if (chat.userId !== req.user!.id && !(await canManageShop(req, chat.shopId))) {
        return res.sendStatus(403);
      }
      
      // Если это чат пользователя, получаем имя магазина
      const shop = await storage.getShop(chat.shopId);
      
      res.json({
        ...chat,
        shopName: shop ? shop.name : "Неизвестный магазин"
      });
      
    } catch (error) {
      console.error("Ошибка при получении информации о чате:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/users/:id/shop-chats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = parseInt(req.params.id);
      
      // Проверяем, что пользователь запрашивает свои чаты или имеет права администратора
      if (userId !== req.user!.id && !isAdmin(req)) {
        return res.sendStatus(403);
      }
      
      const chats = await storage.getUserShopChats(userId);
      res.json(chats);
        } catch (error) {
      console.error("Ошибка при получении чатов пользователя:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/shops/:id/chats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const shopId = parseInt(req.params.id);
      
      // Проверяем, что пользователь имеет доступ к магазину
      if (!await canManageShop(req, shopId)) {
        return res.sendStatus(403);
      }
      
      const chats = await storage.getShopChats(shopId);
      res.json(chats);
    } catch (error) {
      console.error("Ошибка при получении чатов магазина:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get("/api/shop-chats/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const chatId = parseInt(req.params.id);
      
      // Получаем информацию о чате
      const chat = await storage.getShopChatById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Чат не найден" });
      }
      
      // Проверяем права доступа
      if (chat.userId !== req.user!.id && !(await canManageShop(req, chat.shopId))) {
        return res.sendStatus(403);
      }
      
      // Получаем сообщения
      const messages = await storage.getShopChatMessages(chatId);
      
      // Отмечаем сообщения как прочитанные
      await storage.markShopChatMessagesAsRead(chatId, req.user!.id);
      
      res.json(messages);
    } catch (error) {
      console.error("Ошибка при получении сообщений чата:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.post("/api/shop-chats/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const chatId = parseInt(req.params.id);
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Отсутствует текст сообщения" });
      }
      
      // Получаем информацию о чате
      const chat = await storage.getShopChatById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Чат не найден" });
      }
      
      // Определяем тип отправителя
      let senderType: string;
      
      // Проверяем доступ и определяем тип отправителя
      if (chat.userId === req.user!.id) {
        // Пользователь отправляет сообщение
        senderType = ChatMessageType.USER;
      } else if (await canManageShop(req, chat.shopId)) {
        // Сотрудник магазина отправляет сообщение
        senderType = ChatMessageType.SHOP;
      } else {
        return res.sendStatus(403);
      }
      
      // Создаем сообщение
      const chatMessage = await storage.createShopChatMessage(
        chatId,
        req.user!.id,
        senderType,
        message
      );
      
      // Отправляем уведомление через WebSocket
      // Для пользователя
      if (senderType === ChatMessageType.SHOP && shopChatClients.has(chat.userId)) {
        const userWs = shopChatClients.get(chat.userId);
        userWs?.send(JSON.stringify({
          type: 'new_message',
          chatId,
          message: chatMessage
        }));
      }
      
      // Для сотрудников магазина
      if (senderType === ChatMessageType.USER) {
        // Здесь можно отправить уведомление сотрудникам магазина
        // (требуется дополнительная логика для определения сотрудников)
      }
      
      res.status(201).json(chatMessage);
    } catch (error) {
      console.error("Ошибка при отправке сообщения:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Shop Complaints API endpoints
  app.get("/api/shops/:id/complaints", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    
    // Check if user can view shop complaints
    if (!await canViewShopComplaints(req, shopId)) {
      return res.sendStatus(403);
    }

    try {
      const complaints = await storage.getShopComplaints(shopId);
      res.json(complaints);
    } catch (error) {
      console.error("Error getting shop complaints:", error);
      res.status(500).json({ message: "Error getting shop complaints" });
    }
  });

  app.get("/api/shops/:id/complaints/:complaintId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const complaintId = parseInt(req.params.complaintId);
    
    if (!await canAccessShopComplaint(req, shopId, complaintId)) {
      return res.sendStatus(403);
    }
    
    const complaint = await storage.getShopComplaint(shopId, complaintId);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });
    
    res.json(complaint);
  });

  app.post("/api/shops/:id/complaints", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    
    try {
      // Проверка существования магазина
      const shop = await storage.getShop(shopId);
      if (!shop) {
        console.error(`Магазин с ID ${shopId} не найден`);
        return res.status(404).json({ message: "Магазин не найден" });
      }
      
      console.log(`Создаем обращение в магазин ${shopId} от пользователя ${req.user!.id}`, req.body);
      
      const complaint = await storage.createShopComplaint({
        shopId,
        userId: req.user!.id,
        title: req.body.title,
        description: req.body.description,
      });
      
      console.log(`Обращение успешно создано:`, complaint);
      res.status(201).json(complaint);
    } catch (error) {
      console.error("Error creating shop complaint:", error);
      res.status(500).json({ message: (error as Error).message || "Error creating shop complaint" });
    }
  });

  app.get("/api/shops/:id/complaints/:complaintId/messages", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const complaintId = parseInt(req.params.complaintId);
    
    // Check if user can access this shop complaint
    if (!await canAccessShopComplaint(req, shopId, complaintId)) {
      return res.sendStatus(403);
    }

    try {
      const messages = await storage.getShopComplaintMessages(shopId, complaintId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting shop complaint messages:", error);
      res.status(500).json({ message: "Error getting shop complaint messages" });
    }
  });

  app.post("/api/shops/:id/complaints/:complaintId/messages", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const complaintId = parseInt(req.params.complaintId);
    
    // Check if user can access this shop complaint
    if (!await canAccessShopComplaint(req, shopId, complaintId)) {
      return res.sendStatus(403);
    }

    try {
      const message = await storage.createShopComplaintMessage({
        shopId,
            complaintId,
        userId: req.user!.id,
        message: req.body.message,
        isSystemMessage: req.body.isSystemMessage || false,
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating shop complaint message:", error);
      res.status(500).json({ message: "Error creating shop complaint message" });
    }
  });

  app.patch("/api/shops/:id/complaints/:complaintId/assign", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const complaintId = parseInt(req.params.complaintId);
    
    // Check if user can manage shop complaints
    if (!await canManageShopComplaints(req, shopId)) {
      return res.sendStatus(403);
    }

    try {
      const complaint = await storage.assignShopComplaint(shopId, complaintId, req.user!.id);
      res.json(complaint);
        } catch (error) {
      console.error("Error assigning shop complaint:", error);
      res.status(500).json({ message: "Error assigning shop complaint" });
    }
  });

  app.patch("/api/shops/:id/complaints/:complaintId/resolve", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const complaintId = parseInt(req.params.complaintId);
    
    // Check if user can manage shop complaints
    if (!await canManageShopComplaints(req, shopId)) {
      return res.sendStatus(403);
    }

    try {
      const complaint = await storage.resolveShopComplaint(shopId, complaintId);
      res.json(complaint);
    } catch (error) {
      console.error("Error resolving shop complaint:", error);
      res.status(500).json({ message: "Error resolving shop complaint" });
    }
  });

  app.patch("/api/shops/:id/complaints/:complaintId/reject", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.id);
    const complaintId = parseInt(req.params.complaintId);
    
    // Check if user can manage shop complaints
    if (!await canManageShopComplaints(req, shopId)) {
      return res.sendStatus(403);
    }

    try {
      const { reason } = req.body;
      const complaint = await storage.rejectShopComplaint(shopId, complaintId, reason);
      res.json(complaint);
    } catch (error) {
      console.error("Error rejecting shop complaint:", error);
      res.status(500).json({ message: "Error rejecting shop complaint" });
    }
  });

  app.get("/api/user/shops", async (req: Express.Request, res: Express.Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Get shops associated with the user
    try {
      const shops = await storage.getShopsByOwner(req.user!.id);
      res.json(shops);
    } catch (error) {
      console.error("Error getting user shops:", error);
      res.status(500).json({ message: "Error getting user shops" });
    }
  });

  // Shop complaint methods
  app.get("/api/shops/:shopId/complaints", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.shopId);
    if (!await canViewShopComplaints(req, shopId)) {
      return res.sendStatus(403);
    }
    
    const complaints = await storage.getShopComplaints(shopId);
    res.json(complaints);
  });

  // Special endpoint to update SECURITY and ADMIN users to premium and verified status
  app.post("/api/admin/update-staff-status", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const staffUsers = allUsers.filter(user => 
        user.role === UserRole.SECURITY || user.role === UserRole.ADMIN
      );
      
      const updatedUsers = [];
      for (const user of staffUsers) {
        const updatedUser = await storage.updateUser(user.id, {
          isPremium: true,
          isVerified: true,
        });
        updatedUsers.push({
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isPremium: updatedUser.isPremium,
          isVerified: updatedUser.isVerified
        });
      }
      
      res.json({ 
        message: `Updated ${updatedUsers.length} staff users with premium and verified status`, 
        updatedUsers 
      });
    } catch (error) {
      console.error("Error updating staff users:", error);
      res.status(500).json({ message: "Error updating staff users" });
    }
  });

  app.get("/api/shops/:shopId/complaints/:complaintId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const shopId = parseInt(req.params.shopId);
    const complaintId = parseInt(req.params.complaintId);
    
    if (!await canAccessShopComplaint(req, shopId, complaintId)) {
      return res.sendStatus(403);
    }
    
    const complaint = await storage.getShopComplaint(shopId, complaintId);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });
    
    res.json(complaint);
  });

  // Endpoint for getting notification counts
  app.get("/api/notifications/counts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = req.user!.id;
      const counts = {
        complaints: 0,
        chats: 0,
        shopComplaints: 0,
        shopChats: 0
      };
      
      // Get unread counts for regular complaints
      const userComplaints = await storage.getUserComplaints(userId);
      if (userComplaints.length > 0) {
        for (const complaint of userComplaints) {
          // Check for unread messages in each complaint
          const messages = await storage.getComplaintMessages(complaint.id);
          const unreadMessages = messages.filter(msg => 
            msg.userId !== userId && 
            new Date(msg.createdAt) > new Date(complaint.lastViewedAt || complaint.createdAt)
          );
          if (unreadMessages.length > 0) {
            counts.complaints += unreadMessages.length;
          }
        }
      }
      
      // Get unread counts for user's chats with shops
      const userChats = await storage.getUserShopChats(userId);
      if (userChats.length > 0) {
        for (const chat of userChats) {
          const messages = await storage.getShopChatMessages(chat.id);
          const unreadMessages = messages.filter(msg => 
            !msg.isRead && 
            msg.senderId !== userId
          );
          counts.chats += unreadMessages.length;
        }
      }
      
      // For shop owners/staff, get unread shop-related notifications
      if (isShopStaff(req)) {
        // Get the shops this user has access to
        const userShops = await storage.getShopsByOwner(userId);
        const shopStaffMemberships = await storage.getShopStaffFromUser(userId);
        
        const allShopIds = new Set([
          ...userShops.map(shop => shop.id),
          ...shopStaffMemberships.map(staff => staff.shopId)
        ]);
        
        // Check each shop for complaints and chats
        for (const shopId of allShopIds) {
          // Shop complaints
          const shopComplaints = await storage.getShopComplaints(shopId);
          for (const complaint of shopComplaints) {
            if (complaint && complaint.id) {
              const messages = await storage.getShopComplaintMessages(shopId, complaint.id);
              const unreadMessages = messages.filter(msg => 
                msg.userId !== userId && 
                new Date(msg.createdAt) > new Date(complaint.lastViewedAt || complaint.createdAt)
              );
              counts.shopComplaints += unreadMessages.length;
            }
          }
          
          // Shop chats
          const shopChats = await storage.getShopChats(shopId);
          for (const chat of shopChats) {
            if (chat && chat.id) {
              const messages = await storage.getShopChatMessages(chat.id);
              const unreadMessages = messages.filter(msg => 
                !msg.isRead && 
                msg.senderId !== userId && 
                msg.senderType !== "SHOP"  // Only count messages from users, not from other shop staff
              );
              counts.shopChats += unreadMessages.length;
            }
          }
        }
      }
      
      // For admins, include all notifications
      if (isAdmin(req)) {
        // Add pending complaints count
        const pendingComplaints = await storage.getPendingComplaints();
        counts.complaints += pendingComplaints.length;
        
        // For simplicity, we won't count all shop complaints for admins
        // as it could be too many; instead we'll show a badge for unassigned ones
        const allShops = await storage.getAllShops();
        for (const shop of allShops) {
          if (shop && shop.id) {
            const shopComplaints = await storage.getShopComplaints(shop.id);
            const unassignedComplaints = shopComplaints.filter(c => !c.assignedToId);
            counts.shopComplaints += unassignedComplaints.length;
          }
        }
      }
      
      res.json(counts);
    } catch (error) {
      console.error("Error getting notification counts:", error);
      res.status(500).json({ message: "Error getting notification counts" });
    }
  });

  return httpServer;
}