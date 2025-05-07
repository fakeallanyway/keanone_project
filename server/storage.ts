import { 
  User, Session, InsertUser, UserRole, 
  Complaint, InsertComplaint,
  ComplaintMessage, InsertComplaintMessage,
  Shop, InsertShop, UpdateShop, ShopStatus,
  Product, InsertProduct, UpdateProduct,
  Review, InsertReview,
  ShopChat, ShopChatMessage, ChatMessageType
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const MemoryStore = createMemoryStore(session);
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: UserRole }): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  updateUserRole(id: number, role: UserRole): Promise<User>;
  updateUserStatus(id: number, updates: Partial<User>): Promise<User>;
  verifyUser(id: number): Promise<User>;
  blockUser(id: number, reason: string, duration?: string, blockedById?: number): Promise<User>;
  unblockUser(id: number): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getStaffUsers(): Promise<User[]>;

  // Shop staff methods
  getShopStaff(shopId: number): Promise<(User & { roleName: string })[]>;
  getShopStaffFromUser(userId: number): Promise<{ userId: number; shopId: number; role: UserRole; addedAt: Date }[]>;
  addShopStaffMember(shopId: number, userId: number, role: UserRole): Promise<User & { roleName: string }>;
  updateShopStaffRole(shopId: number, userId: number, role: UserRole): Promise<User & { roleName: string }>;
  removeShopStaffMember(shopId: number, userId: number): Promise<void>;

  // Session methods
  createSession(userId: number): Promise<Session>;
  endSession(id: number): Promise<Session>;
  getUserSessions(userId: number): Promise<Session[]>;
  getActiveSessions(): Promise<Session[]>;
  getExpiredSessions(): Promise<Session[]>;

  // Complaint methods
  getComplaint(id: number): Promise<Complaint | undefined>;
  createComplaint(userId: number, complaint: InsertComplaint): Promise<Complaint>;
  assignComplaint(complaintId: number, staffId: number): Promise<Complaint>;
  resolveComplaint(complaintId: number): Promise<Complaint>;
  rejectComplaint(complaintId: number, reason?: string): Promise<Complaint>;
  getUserComplaints(userId: number): Promise<Complaint[]>;
  getAllComplaints(): Promise<Complaint[]>;
  getPendingComplaints(): Promise<Complaint[]>;

  // Complaint messages methods
  getComplaintMessages(complaintId: number): Promise<ComplaintMessage[]>;
  createComplaintMessage(message: {
    complaintId: number;
    userId: number;
    message: string;
    isSystemMessage?: boolean;
  }): Promise<ComplaintMessage>;

  // Shop methods
  getShop(id: number): Promise<Shop | undefined>;
  getShopsByOwner(ownerId: number): Promise<Shop[]>;
  getAllShops(): Promise<Shop[]>;
  searchShops(query: string): Promise<Shop[]>;
  createShop(shop: InsertShop): Promise<Shop>;
  updateShop(id: number, updates: UpdateShop): Promise<Shop>;
  verifyShop(id: number): Promise<Shop>;
  blockShop(id: number, reason: string): Promise<Shop>;
  deleteShop(id: number): Promise<void>;

  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getProductsByShop(shopId: number): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: UpdateProduct): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Review methods
  getReviewsByProduct(productId: number): Promise<Review[]>;
  createReview(userId: number, review: InsertReview): Promise<Review>;

  sessionStore: session.Store;

  getSettings(): Promise<any>;
  updateSettings(settings: any): Promise<any>;

  // Banned names methods
  getBannedNames(): Promise<{ id: number; name: string }[]>;
  createBannedName(data: { name: string }): Promise<{ id: number; name: string }>;
  deleteBannedName(id: number): Promise<void>;

  // Методы для чатов магазинов
  createShopChat(shopId: number, userId: number): Promise<ShopChat>;
  getShopChatById(chatId: number): Promise<ShopChat | null>;
  getUserShopChats(userId: number): Promise<(ShopChat & { shopName: string, lastMessage: string | null })[]>;
  getShopChats(shopId: number): Promise<(ShopChat & { userName: string, lastMessage: string | null })[]>;
  
  // Методы для сообщений в чатах магазинов
  createShopChatMessage(chatId: number, senderId: number, senderType: string, message: string): Promise<ShopChatMessage>;
  getShopChatMessages(chatId: number): Promise<ShopChatMessage[]>;
  markShopChatMessagesAsRead(chatId: number, userId: number): Promise<void>;

  // Shop complaint methods
  getShopComplaints(shopId: number): Promise<Complaint[]>;
  getShopComplaint(shopId: number, complaintId: number): Promise<Complaint | undefined>;
  createShopComplaint(complaintData: { shopId: number; userId: number; title: string; description: string }): Promise<Complaint>;
  assignShopComplaint(shopId: number, complaintId: number, staffId: number): Promise<Complaint>;
  resolveShopComplaint(shopId: number, complaintId: number): Promise<Complaint>;
  rejectShopComplaint(shopId: number, complaintId: number, reason?: string): Promise<Complaint>;
  getShopComplaintMessages(shopId: number, complaintId: number): Promise<ComplaintMessage[]>;
  createShopComplaintMessage(message: {
    shopId: number;
    complaintId: number;
    userId: number;
    message: string;
    isSystemMessage?: boolean;
  }): Promise<ComplaintMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private sessions: Map<number, Session>;
  private complaints: Map<number, Complaint>;
  private complaintMessages: Map<number, ComplaintMessage>;
  private shops: Map<number, Shop>;
  private products: Map<number, Product>;
  private reviews: Map<number, Review>;
  private shopStaff: Map<number, { userId: number; shopId: number; role: UserRole; addedAt: Date }>;
  private bannedNames: Map<number, { id: number; name: string }>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentComplaintId: number;
  private currentComplaintMessageId: number;
  private currentShopId: number;
  private currentProductId: number;
  private currentReviewId: number;
  private currentShopStaffId: number;
  private currentBannedNameId: number;
  private shopChats: Map<number, ShopChat>;
  private shopChatMessages: Map<number, ShopChatMessage>;
  private currentShopChatId: number;
  private currentShopChatMessageId: number;
  private shopComplaints: Map<number, Complaint & { shopId: number }>;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.complaints = new Map();
    this.complaintMessages = new Map();
    this.shops = new Map();
    this.products = new Map();
    this.reviews = new Map();
    this.shopStaff = new Map();
    this.bannedNames = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentComplaintId = 1;
    this.currentComplaintMessageId = 1;
    this.currentShopId = 1;
    this.currentProductId = 1;
    this.currentReviewId = 1;
    this.currentShopStaffId = 1;
    this.currentBannedNameId = 1;
    this.shopChats = new Map();
    this.shopChatMessages = new Map();
    this.currentShopChatId = 1;
    this.currentShopChatMessageId = 1;
    this.shopComplaints = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    this.initialize();
  }

  private async initialize() {
    await this.createUser({
      username: "owner",
      password: await hashPassword("1"),
      displayName: "интернет псих.",
      role: UserRole.OWNER,
      isPremium: true,
      isVerified: true,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "secuser",
      password: await hashPassword("1"),
      displayName: "ИнтерКасп",
      role: UserRole.SECURITY,
      isPremium: true,
      isVerified: true,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "adm",
      password: await hashPassword("1"),
      displayName: "await",
      role: UserRole.ADMIN,
      isPremium: true,
      isVerified: true,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "hdadm",
      password: await hashPassword("1"),
      displayName: "сranberry/ass",
      role: UserRole.HEADADMIN,
      isPremium: true,
      isVerified: true,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "mod",
      password: await hashPassword("1"),
      displayName: "qwi))",
      role: UserRole.MODERATOR,
      isPremium: true,
      isVerified: true,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "sown",
      password: await hashPassword("1"),
      displayName: "Quero",
      role: UserRole.SHOP_OWNER,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "main",
      password: await hashPassword("1"),
      displayName: "Derfoard",
      role: UserRole.SHOP_MAIN,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "staff",
      password: await hashPassword("1"),
      displayName: "Kats",
      role: UserRole.SHOP_STAFF,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "sown2",
      password: await hashPassword("1"),
      displayName: "Freedie",
      role: UserRole.SHOP_OWNER,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "main2",
      password: await hashPassword("1"),
      displayName: "Lemon",
      role: UserRole.SHOP_MAIN,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "staff2",
      password: await hashPassword("1"),
      displayName: "Hearly",
      role: UserRole.SHOP_STAFF,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    await this.createUser({
      username: "user",
      password: await hashPassword("1"),
      displayName: "#4mmcволочь",
      role: UserRole.USER,
    }).then(user => this.updateUser(user.id, {
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg"
    }));
    // Create first shop
    const shop1 = await this.createShop({
      name: "View Askew Shop",
      description: "гений на магазе)",
      avatarUrl: "https://media.discordapp.net/attachments/1186577799239192646/1360511552628981951/IMG_3520.jpg?ex=67fb629f&is=67fa111f&hm=09a87df3a87e7c16c67b9be303317edfa4ad41c283676598fb6210a3b3e0ce74&",
      ownerId: 6, // ID of "sown" user who has SHOP_OWNER role
      isVerified: true,
    });
    
    // Create second shop
    const shop2 = await this.createShop({
      name: "View Askew Shop 2",
      description: "гений на магазе) 2",
      avatarUrl: "https://media.discordapp.net/attachments/1186577799239192646/1360511552628981951/IMG_3520.jpg?ex=67fb629f&is=67fa111f&hm=09a87df3a87e7c16c67b9be303317edfa4ad41c283676598fb6210a3b3e0ce74&",
      ownerId: 9, // ID of "sown2" user who has SHOP_OWNER role
      isVerified: true,
    });
    // Set shop as verified
    await this.verifyShop(1);
    await this.verifyShop(2);
    await this.addShopStaffMember(1, 6, UserRole.SHOP_OWNER);
    await this.addShopStaffMember(1, 7, UserRole.SHOP_MAIN);
    await this.addShopStaffMember(1, 8, UserRole.SHOP_STAFF);
    await this.addShopStaffMember(2, 9, UserRole.SHOP_OWNER);
    await this.addShopStaffMember(2, 10, UserRole.SHOP_MAIN);
    await this.addShopStaffMember(2, 11, UserRole.SHOP_STAFF);

    await this.createProduct({
      name: "Мефедрон Кристалл",
      description: "Кристаллы мефедрона",
      price: "3699",
      shopId: 1,
      categoryId: 1,
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg",
      isActive: true,
      isFeatured: true,
      isNew: true,
      isSale: false,
      isDiscounted: false,
      quantity: 100,
    });
    
    await this.createProduct({
      name: "Альфа PVP",
      description: "Кристаллы альфы высокого качества",
      price: "2999",
      shopId: 1,
      categoryId: 1,
      avatarUrl: "https://i.pinimg.com/236x/36/cc/80/36cc80011b7c3e6e49b0fa0e1d4d1ba6.jpg",
      isActive: true,
      isFeatured: true,
      isNew: true,
      isSale: false,
      isDiscounted: false,
      quantity: 50,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser & { role?: UserRole }): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      ...insertUser,
      role: insertUser.role || UserRole.USER,
      isPremium: false,
      isVerified: false,
      isBlocked: false,
      displayName: insertUser.displayName || null,
      avatarUrl: null,
      createdAt: new Date(),
      lastLoginAt: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async verifyUser(id: number): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, isVerified: !user.isVerified };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Функция для проверки прав доступа
  private hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    // Владелец площадки имеет все права
    if (userRole === UserRole.OWNER) {
      return true;
    }

    // Служба Безопасности имеет те же права, что и Владелец площадки
    if (userRole === UserRole.SECURITY) {
      return true;
    }

    // Вице-Админ имеет те же права, что и Админ
    if (userRole === UserRole.HEADADMIN && 
       (requiredRole === UserRole.ADMIN || 
        requiredRole === UserRole.MODERATOR || 
        requiredRole === UserRole.SHOP_OWNER || 
        requiredRole === UserRole.SHOP_MAIN || 
        requiredRole === UserRole.SHOP_STAFF || 
        requiredRole === UserRole.USER)) {
      return true;
    }

    // Админ имеет права на управление всеми ролями ниже
    if (userRole === UserRole.ADMIN && 
       (requiredRole === UserRole.MODERATOR || 
        requiredRole === UserRole.SHOP_OWNER || 
        requiredRole === UserRole.SHOP_MAIN || 
        requiredRole === UserRole.SHOP_STAFF || 
        requiredRole === UserRole.USER)) {
      return true;
    }

    // Модератор имеет права на управление магазинами и пользователями
    if (userRole === UserRole.MODERATOR && 
       (requiredRole === UserRole.SHOP_STAFF || 
        requiredRole === UserRole.USER)) {
      return true;
    }

    // Владелец магазина имеет полные права на управление своим магазином
    if (userRole === UserRole.SHOP_OWNER && 
       (requiredRole === UserRole.SHOP_MAIN || 
        requiredRole === UserRole.SHOP_STAFF)) {
      return true;
    }

    // Управляющий магазина имеет те же права, что и Владелец магазина
    if (userRole === UserRole.SHOP_MAIN && 
       (requiredRole === UserRole.SHOP_STAFF)) {
      return true;
    }

    // Проверка на равенство ролей
    return userRole === requiredRole;
  }

  // Вспомогательная функция для проверки высших прав
  private hasHighestPermission(userRole: UserRole): boolean {
    return userRole === UserRole.OWNER || userRole === UserRole.SECURITY;
  }

  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("Пользователь не найден");
    
    // Только владелец площадки и служба безопасности могут менять роли
    if (!this.hasHighestPermission(user.role)) {
      throw new Error("Недостаточно прав для изменения ролей");
    }
    
    const updatedUser = { ...user, role };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserStatus(id: number, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async blockUser(id: number, reason: string, duration?: string, blockedById?: number): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { 
      ...user, 
      isBlocked: true, 
      blockReason: reason, 
      blockedAt: new Date(),
      blockDuration: duration || null,
      blockedById: blockedById || null
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async unblockUser(id: number): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { 
      ...user, 
      isBlocked: false, 
      blockReason: null, 
      blockedAt: null,
      blockDuration: null 
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getStaffUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role !== UserRole.USER,
    );
  }

  // Session methods
  async createSession(userId: number): Promise<Session> {
    const id = this.currentSessionId++;
    const session: Session = {
      id,
      userId,
      startTime: new Date(),
      endTime: null,
      isActive: true,
    };
    this.sessions.set(id, session);
    return session;
  }

  async endSession(id: number): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) throw new Error("Session not found");
    const updatedSession = {
      ...session,
      endTime: new Date(),
      isActive: false,
    };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async getUserSessions(userId: number): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId,
    );
  }

  async getActiveSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.isActive,
    );
  }

  async getExpiredSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => !session.isActive,
    );
  }

  // Complaint methods
  async getComplaint(id: number): Promise<Complaint | undefined> {
    return this.complaints.get(id);
  }

  async createComplaint(userId: number, complaint: InsertComplaint): Promise<Complaint> {
    const id = this.currentComplaintId++;
    const newComplaint: Complaint = {
      id,
      userId,
      ...complaint,
      status: "В ожидании.",
      assignedToId: null,
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.complaints.set(id, newComplaint);

    // Create system message about complaint creation
    await this.createComplaintMessage({
      complaintId: id,
      userId,
      message: "Обращение создано!",
      isSystemMessage: true,
    });

    return newComplaint;
  }

  async assignComplaint(complaintId: number, staffId: number): Promise<Complaint> {
    const complaint = this.complaints.get(complaintId);
    if (!complaint) throw new Error("Обращений нету!");
    
    const staffUser = this.users.get(staffId);
    const roleText = staffUser?.role === UserRole.OWNER ? "Владелец Площадки" :
                    staffUser?.role === UserRole.SECURITY ? "Служба Безопасности" :
                    staffUser?.role === UserRole.ADMIN ? "Админ" :
                    staffUser?.role === UserRole.HEADADMIN ? "Вице-Админ" :
                    staffUser?.role === UserRole.MODERATOR ? "Модератор" :
                    staffUser?.role === UserRole.SHOP_OWNER ? "Владелец магазина" :
                    staffUser?.role === UserRole.SHOP_MAIN ? "Управляющий магазина" :
                    staffUser?.role === UserRole.SHOP_STAFF ? "Сотрудник магазина" :
                    "Пользователь";

    const updatedComplaint = {
      ...complaint,
      assignedToId: staffId,
      status: `Обращение в работе сотрудником: ${roleText} ${staffUser?.displayName || staffUser?.username}`,
    };
    this.complaints.set(complaintId, updatedComplaint);

    // Create system message about assignment
    await this.createComplaintMessage({
      complaintId,
      userId: staffId,
      message: `${roleText} ${staffUser?.displayName || staffUser?.username} взял обращение в работу.`,
      isSystemMessage: true,
    });

    return updatedComplaint;
  }

  async resolveComplaint(complaintId: number): Promise<Complaint> {
    const complaint = this.complaints.get(complaintId);
    if (!complaint) throw new Error("Обращений нету!");
    
    const staffUser = this.users.get(complaint.assignedToId!);
    const roleText = staffUser?.role === UserRole.OWNER ? "Владелец Площадки" :
                    staffUser?.role === UserRole.SECURITY ? "Служба Безопасности" :
                    staffUser?.role === UserRole.ADMIN ? "Админ" :
                    staffUser?.role === UserRole.HEADADMIN ? "Вице-Админ" :
                    staffUser?.role === UserRole.MODERATOR ? "Модератор" :
                    staffUser?.role === UserRole.SHOP_OWNER ? "Владелец магазина" :
                    staffUser?.role === UserRole.SHOP_MAIN ? "Управляющий магазина" :
                    staffUser?.role === UserRole.SHOP_STAFF ? "Сотрудник магазина" :
                    "Пользователь";

    const updatedComplaint = {
      ...complaint,
      status: `${roleText} ${staffUser?.displayName || staffUser?.username} решил обращение.`,
      resolvedAt: new Date(),
    };
    this.complaints.set(complaintId, updatedComplaint);

    // Create system message about resolution
    await this.createComplaintMessage({
      complaintId,
      userId: complaint.assignedToId!,
      message: `${roleText} ${staffUser?.displayName || staffUser?.username} закрыл обращение.`,
      isSystemMessage: true,
    });

    return updatedComplaint;
  }

  async rejectComplaint(complaintId: number, reason?: string): Promise<Complaint> {
    const complaint = this.complaints.get(complaintId);
    if (!complaint) throw new Error("Обращений нету!");
    const updatedComplaint = {
      ...complaint,
      status: "Отклонено",
      resolvedAt: new Date(),
    };
    this.complaints.set(complaintId, updatedComplaint);

    // Create system message about rejection with reason if provided
    const rejectMessage = reason 
      ? `Обращение было отклонено по причине: ${reason}`
      : "В обращении отказано.";
      
    await this.createComplaintMessage({
      complaintId,
      userId: complaint.assignedToId!,
      message: rejectMessage,
      isSystemMessage: true,
    });

    return updatedComplaint;
  }

  async getUserComplaints(userId: number): Promise<Complaint[]> {
    return Array.from(this.complaints.values()).filter(
      (complaint) => complaint.userId === userId || complaint.assignedToId === userId
    );
  }

  async getAllComplaints(): Promise<Complaint[]> {
    return Array.from(this.complaints.values());
  }

  async getPendingComplaints(): Promise<Complaint[]> {
    return Array.from(this.complaints.values()).filter(
      (complaint) => complaint.status === "В ожидании."
    );
  }

  // Complaint messages methods
  async getComplaintMessages(complaintId: number): Promise<ComplaintMessage[]> {
    return Array.from(this.complaintMessages.values())
      .filter(msg => msg.complaintId === complaintId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createComplaintMessage(message: {
    complaintId: number;
    userId: number;
    message: string;
    isSystemMessage?: boolean;
  }): Promise<ComplaintMessage> {
    const id = this.currentComplaintMessageId++;
    const newMessage: ComplaintMessage = {
      id,
      ...message,
      isSystemMessage: message.isSystemMessage || false,
      createdAt: new Date(),
    };
    this.complaintMessages.set(id, newMessage);
    return newMessage;
  }

  // Shop methods
  async getShop(id: number): Promise<Shop | undefined> {
    return this.shops.get(id);
  }

  async getShopsByOwner(ownerId: number): Promise<Shop[]> {
    return Array.from(this.shops.values()).filter(
      (shop) => shop.ownerId === ownerId
    );
  }

  async getAllShops(): Promise<Shop[]> {
    return Array.from(this.shops.values());
  }

  async searchShops(query: string): Promise<Shop[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.shops.values()).filter(
      (shop) => shop.name.toLowerCase().includes(lowerQuery)
    );
  }

  async createShop(shop: InsertShop): Promise<Shop> {
    const id = this.currentShopId++;
    const now = new Date();
    const newShop: Shop = {
      id,
      name: shop.name,
      description: shop.description || "",
      avatarUrl: shop.avatarUrl || "",
      ownerId: shop.ownerId,
      isVerified: false,
      status: ShopStatus.ACTIVE,
      blockReason: null,
      rating: 0,
      transactionsCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.shops.set(id, newShop);
    return newShop;
  }

  async updateShop(id: number, updates: UpdateShop): Promise<Shop> {
    const shop = this.shops.get(id);
    if (!shop) {
      throw new Error(`Shop with id ${id} not found`);
    }

    const updatedShop = {
      ...shop,
      ...updates,
      updatedAt: new Date(),
    };
    this.shops.set(id, updatedShop);
    return updatedShop;
  }

  async verifyShop(id: number): Promise<Shop> {
    const shop = this.shops.get(id);
    if (!shop) {
      throw new Error(`Shop with id ${id} not found`);
    }

    const updatedShop = {
      ...shop,
      isVerified: true,
      updatedAt: new Date(),
    };
    this.shops.set(id, updatedShop);
    return updatedShop;
  }

  async blockShop(id: number, reason: string): Promise<Shop> {
    const shop = this.shops.get(id);
    if (!shop) {
      throw new Error(`Shop with id ${id} not found`);
    }

    const updatedShop = {
      ...shop,
      status: ShopStatus.BLOCKED,
      blockReason: reason,
      updatedAt: new Date(),
    };
    this.shops.set(id, updatedShop);
    return updatedShop;
  }

  async deleteShop(id: number): Promise<void> {
    // Удаляем все товары магазина
    const shopProducts = await this.getProductsByShop(id);
    for (const product of shopProducts) {
      await this.deleteProduct(product.id);
    }
    this.shops.delete(id);
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductsByShop(shopId: number): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.shopId === shopId
    );
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async searchProducts(query: string): Promise<Product[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.products.values()).filter(
      (product) => product.name.toLowerCase().includes(lowerQuery)
    );
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const now = new Date();
    const newProduct: Product = {
      id,
      shopId: product.shopId,
      name: product.name,
      description: product.description || "",
      avatarUrl: product.avatarUrl || "",
      price: product.price,
      quantity: product.quantity || 0,
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, updates: UpdateProduct): Promise<Product> {
    const product = this.products.get(id);
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }

    const updatedProduct = {
      ...product,
      ...updates,
      updatedAt: new Date(),
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    // Удаляем все отзывы о товаре
    const productReviews = await this.getReviewsByProduct(id);
    for (const review of productReviews) {
      this.reviews.delete(review.id);
    }
    this.products.delete(id);
  }

  // Review methods
  async getReviewsByProduct(productId: number): Promise<Review[]> {
    const reviews = Array.from(this.reviews.values()).filter(
      (review) => review.productId === productId
    );
    
    // Добавляем информацию о пользователях
    for (const review of reviews) {
      const user = await this.getUser(review.userId);
      if (user) {
        (review as any).userDisplayName = user.displayName || user.username;
        (review as any).userAvatarUrl = user.avatarUrl;
      }
    }
    
    return reviews;
  }

  async createReview(userId: number, review: InsertReview): Promise<Review> {
    const id = this.currentReviewId++;
    const newReview: Review = {
      id,
      productId: review.productId,
      userId,
      rating: review.rating,
      comment: review.comment || "",
      createdAt: new Date(),
    };
    this.reviews.set(id, newReview);

    // Обновляем рейтинг товара
    const product = await this.getProduct(review.productId);
    if (product) {
      const productReviews = await this.getReviewsByProduct(product.id);
      const totalRating = productReviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = Math.round(totalRating / productReviews.length);
      
      // Обновляем рейтинг магазина
      const shop = await this.getShop(product.shopId);
      if (shop) {
        const shopProducts = await this.getProductsByShop(shop.id);
        let shopTotalRating = 0;
        let ratedProductsCount = 0;
        
        for (const p of shopProducts) {
          const pReviews = await this.getReviewsByProduct(p.id);
          if (pReviews.length > 0) {
            const pTotalRating = pReviews.reduce((sum, r) => sum + r.rating, 0);
            shopTotalRating += pTotalRating;
            ratedProductsCount += pReviews.length;
          }
        }
        
        if (ratedProductsCount > 0) {
          const shopAverageRating = Math.round(shopTotalRating / ratedProductsCount);
          await this.updateShop(shop.id, { rating: shopAverageRating });
        }
      }
    }

    return newReview;
  }

  async getSettings() {
    try {
      const result = await this.db.query(`
        SELECT * FROM site_settings 
        ORDER BY id DESC 
        LIMIT 1
      `);
      
      // Если настройки еще не созданы, возвращаем пустые значения
      if (result.rows.length === 0) {
        return {
          terms_and_conditions: "",
          privacy_policy: "",
          // другие поля по умолчанию
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error("Error getting settings:", error);
      throw error;
    }
  }

  async updateSettings(settings: {
    termsAndConditions: string;
    privacyPolicy: string;
    // другие поля
  }) {
    try {
      const result = await this.db.query(`
        INSERT INTO site_settings (
          terms_and_conditions,
          privacy_policy,
          updated_at
        ) VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
          terms_and_conditions = EXCLUDED.terms_and_conditions,
          privacy_policy = EXCLUDED.privacy_policy,
          updated_at = NOW()
        RETURNING *;
      `, [
        settings.termsAndConditions,
        settings.privacyPolicy
      ]);

      return result.rows[0];
    } catch (error) {
      console.error("Database error:", error);
      throw error;
    }
  }

  // Banned names methods
  async getBannedNames(): Promise<{ id: number; name: string }[]> {
    return Array.from(this.bannedNames.values());
  }

  async createBannedName(data: { name: string }): Promise<{ id: number; name: string }> {
    const id = this.currentBannedNameId++;
    const bannedName = { id, name: data.name };
    this.bannedNames.set(id, bannedName);
    return bannedName;
  }

  async deleteBannedName(id: number): Promise<void> {
    this.bannedNames.delete(id);
  }

  // Shop staff methods
  async getShopStaff(shopId: number): Promise<(User & { roleName: string })[]> {
    const staffMembers: (User & { roleName: string })[] = [];
    
    // Получаем всех сотрудников магазина
    const shopStaffEntries = Array.from(this.shopStaff.values())
      .filter(entry => entry.shopId === shopId);
      
    // Получаем информацию о каждом сотруднике
    for (const staffEntry of shopStaffEntries) {
      const user = this.users.get(staffEntry.userId);
      if (user) {
        // Удаляем пароль из данных пользователя
        const { password, ...safeUser } = user;
        
        // Добавляем пользователя в список с информацией о его роли
        staffMembers.push({
          ...safeUser,
          roleName: staffEntry.role
        });
      }
    }
    
    return staffMembers;
  }
  
  async getShopStaffFromUser(userId: number): Promise<{ userId: number; shopId: number; role: UserRole; addedAt: Date }[]> {
    // Find all shop staff entries for this user
    return Array.from(this.shopStaff.values())
      .filter(entry => entry.userId === userId);
  }

  async addShopStaffMember(shopId: number, userId: number, role: UserRole): Promise<User & { roleName: string }> {
    console.log("Storage: Добавление сотрудника магазина:", { shopId, userId, role });
    
    // Проверяем существование магазина
    const shop = this.shops.get(shopId);
    if (!shop) {
      console.error(`Магазин с id ${shopId} не найден`);
      throw new Error(`Shop with id ${shopId} not found`);
    }
    
    // Проверяем существование пользователя
    const user = this.users.get(userId);
    if (!user) {
      console.error(`Пользователь с id ${userId} не найден`);
      throw new Error(`User with id ${userId} not found`);
    }
    
    // Проверяем, не является ли пользователь уже сотрудником этого магазина
    const existingStaff = Array.from(this.shopStaff.values())
      .find(entry => entry.shopId === shopId && entry.userId === userId);
      
    if (existingStaff) {
      console.error("Пользователь уже является сотрудником этого магазина");
      throw new Error("Пользователь уже является сотрудником этого магазина");
    }
    
    // Проверяем валидность роли (переместили эту проверку в routes.ts)
    
    // Добавляем пользователя в сотрудники магазина
    const staffId = this.currentShopStaffId++;
    const staffEntry = {
      id: staffId,
      userId,
      shopId,
      role,
      addedAt: new Date()
    };
    
    console.log("Создание записи сотрудника:", staffEntry);
    this.shopStaff.set(staffId, staffEntry);
    
    // Возвращаем данные пользователя с информацией о его роли
    // Создаем объект без пароля
    const { password, ...safeUser } = user;
    console.log("Успешно добавлен сотрудник:", { id: userId, role });
    
    // Создаем новый объект с информацией о пользователе и его роли
    return {
      ...safeUser,
      roleName: role
    };
  }

  async updateShopStaffRole(shopId: number, userId: number, role: UserRole): Promise<User & { roleName: string }> {
    // Проверяем существование магазина
    const shop = this.shops.get(shopId);
    if (!shop) {
      throw new Error(`Shop with id ${shopId} not found`);
    }
    
    // Проверяем существование пользователя
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    
    // Находим запись о сотруднике
    const staffEntryArray = Array.from(this.shopStaff.entries())
      .find(([, entry]) => entry.shopId === shopId && entry.userId === userId);
      
    if (!staffEntryArray) {
      throw new Error("Пользователь не является сотрудником этого магазина");
    }
    
    const [staffId, staffEntry] = staffEntryArray;
    
    // Обновляем роль сотрудника
    const updatedStaffEntry = {
      ...staffEntry,
      role
    };
    
    this.shopStaff.set(staffId, updatedStaffEntry);
    
    // Возвращаем данные пользователя с информацией о его новой роли
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      roleName: role
    };
  }

  async removeShopStaffMember(shopId: number, userId: number): Promise<void> {
    // Проверяем существование магазина
    const shop = this.shops.get(shopId);
    if (!shop) {
      throw new Error(`Shop with id ${shopId} not found`);
    }
    
    // Находим запись о сотруднике
    const staffEntryArray = Array.from(this.shopStaff.entries())
      .find(([, entry]) => entry.shopId === shopId && entry.userId === userId);
      
    if (!staffEntryArray) {
      throw new Error("Пользователь не является сотрудником этого магазина");
    }
    
    const [staffId] = staffEntryArray;
    
    // Удаляем запись о сотруднике
    this.shopStaff.delete(staffId);
  }

  // Методы для чатов магазинов
  async createShopChat(shopId: number, userId: number): Promise<ShopChat> {
    console.log("Создание чата с магазином:", { shopId, userId });
    
    // Проверяем существование магазина
    const shop = await this.getShop(shopId);
    if (!shop) {
      throw new Error(`Магазин с id ${shopId} не найден`);
    }
    
    // Проверяем существование пользователя
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`Пользователь с id ${userId} не найден`);
    }
    
    // Проверяем, нет ли уже чата между этим пользователем и магазином
    const existingChat = Array.from(this.shopChats.values())
      .find(chat => chat.shopId === shopId && chat.userId === userId);
      
    if (existingChat) {
      return existingChat;
    }
    
    // Создаем новый чат
    const chatId = this.currentShopChatId++;
    const now = new Date();
    const chat: ShopChat = {
      id: chatId,
      shopId,
      userId,
      lastMessageAt: now,
      createdAt: now
    };
    
    this.shopChats.set(chatId, chat);
    console.log("Чат создан:", chat);
    
    // Создаем системное сообщение о создании чата
    await this.createShopChatMessage(
      chatId, 
      0, // Системный ID
      ChatMessageType.SYSTEM, 
      "Чат создан. Вы можете начать общение с магазином."
    );
    
    // Проверяем, есть ли сотрудники магазина и отправляем уведомление о них
    const shopStaffMembers = Array.from(this.shopStaff.values())
      .filter(staff => staff.shopId === shopId);
      
    for (const staff of shopStaffMembers) {
      const staffUser = await this.getUser(staff.userId);
      if (staffUser) {
        let roleText = "Сотрудник";
        if (staffUser.role === "SHOP_OWNER") roleText = "Владелец";
        if (staffUser.role === "SHOP_MAIN") roleText = "Управляющий";
        
        // Отправляем уведомление о присоединении сотрудника к чату
        await this.createShopChatMessage(
          chatId,
          0, // Системный ID
          ChatMessageType.SYSTEM,
          `${roleText} магазина ${staffUser.displayName || staffUser.username} присоединился к чату.`
        );
        
        // Добавляем обработчик для отслеживания выхода сотрудника из чата
        const staffOnlineStatus = { isOnline: true, userId: staffUser.id };
        
        // Имитируем отслеживание статуса подключения
        setTimeout(async () => {
          if (staffOnlineStatus.isOnline) {
            staffOnlineStatus.isOnline = false;
            await this.createShopChatMessage(
              chatId,
              0, // Системный ID
              ChatMessageType.SYSTEM,
              `${roleText} магазина ${staffUser.displayName || staffUser.username} покинул чат.`
            );
          }
        }, 3600000); // Пример: уведомление о выходе через час неактивности
      }
    }
    
    // Добавляем обработчик для отслеживания входа сотрудников магазина в чат
    this.shopChatMessages.forEach(async (message) => {
      if (message.chatId === chatId && message.senderType !== ChatMessageType.USER) {
        const sender = await this.getUser(message.senderId);
        if (sender) {
          // Проверяем, является ли отправитель частью команды магазина
          const isShopStaff = Array.from(this.shopStaff.values())
            .some(staff => staff.shopId === shopId && staff.userId === sender.id);
          
          if (isShopStaff) {
            let roleText = "Сотрудник";
            if (sender.role === "SHOP_OWNER") roleText = "Владелец";
            if (sender.role === "SHOP_MAIN") roleText = "Управляющий";
            
            // Создаем системное сообщение о входе сотрудника магазина
            await this.createShopChatMessage(
              chatId,
              0, // Системный ID
              ChatMessageType.SYSTEM,
              `${roleText} магазина ${sender.displayName || sender.username} присоединился к чату.`
            );
          }
        }
      }
    });
    
    return chat;
  }
  
  async getShopChatById(chatId: number): Promise<ShopChat | null> {
    console.log("Получение чата по ID:", chatId);
    return this.shopChats.get(chatId) || null;
  }
  
  async getUserShopChats(userId: number): Promise<(ShopChat & { shopName: string, lastMessage: string | null })[]> {
    console.log("Получение чатов пользователя:", userId);
    const userChats = Array.from(this.shopChats.values())
      .filter(chat => chat.userId === userId);
      
    return Promise.all(userChats.map(async chat => {
      const shop = await this.getShop(chat.shopId);
      const messages = Array.from(this.shopChatMessages.values())
        .filter(msg => msg.chatId === chat.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return {
        ...chat,
        shopName: shop ? shop.name : "Неизвестный магазин",
        lastMessage: messages.length > 0 ? messages[0].message : null
      };
    }));
  }
  
  async getShopChats(shopId: number): Promise<(ShopChat & { userName: string, lastMessage: string | null })[]> {
    console.log("Получение чатов магазина:", shopId);
    const shopChats = Array.from(this.shopChats.values())
      .filter(chat => chat.shopId === shopId);
      
    return Promise.all(shopChats.map(async chat => {
      const user = await this.getUser(chat.userId);
      const messages = Array.from(this.shopChatMessages.values())
        .filter(msg => msg.chatId === chat.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return {
        ...chat,
        userName: user ? (user.displayName || user.username) : "Неизвестный пользователь",
        lastMessage: messages.length > 0 ? messages[0].message : null
      };
    }));
  }
  
  async createShopChatMessage(chatId: number, senderId: number, senderType: string, message: string): Promise<ShopChatMessage> {
    console.log("Создание сообщения в чате:", { chatId, senderId, senderType, message });
    
    // Проверяем существование чата
    const chat = this.shopChats.get(chatId);
    if (!chat) {
      throw new Error(`Чат с id ${chatId} не найден`);
    }
    
    // Если отправитель не система, проверяем его существование
    if (senderId !== 0) {
      const sender = await this.getUser(senderId);
      if (!sender) {
        throw new Error(`Пользователь с id ${senderId} не найден`);
      }
    }
    
    // Создаем новое сообщение
    const messageId = this.currentShopChatMessageId++;
    const now = new Date();
    const chatMessage: ShopChatMessage = {
      id: messageId,
      chatId,
      senderId,
      senderType,
      message,
      createdAt: now,
      isRead: false
    };
    
    this.shopChatMessages.set(messageId, chatMessage);
    console.log("Сообщение создано:", chatMessage);
    
    // Обновляем время последнего сообщения в чате
    this.shopChats.set(chatId, {
      ...chat,
      lastMessageAt: now
    });
    
    return chatMessage;
  }
  
  async getShopChatMessages(chatId: number): Promise<ShopChatMessage[]> {
    console.log("Получение сообщений чата:", chatId);
    
    // Проверяем существование чата
    const chat = this.shopChats.get(chatId);
    if (!chat) {
      throw new Error(`Чат с id ${chatId} не найден`);
    }
    
    // Получаем все сообщения чата, сортируем по дате создания
    return Array.from(this.shopChatMessages.values())
      .filter(msg => msg.chatId === chatId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  
  async markShopChatMessagesAsRead(chatId: number, userId: number): Promise<void> {
    console.log("Отметка сообщений как прочитанных:", { chatId, userId });
    
    // Проверяем существование чата
    const chat = this.shopChats.get(chatId);
    if (!chat) {
      throw new Error(`Чат с id ${chatId} не найден`);
    }
    
    // Получаем все непрочитанные сообщения
    const messages = Array.from(this.shopChatMessages.entries())
      .filter(([, msg]) => 
        msg.chatId === chatId && 
        !msg.isRead && 
        // Пользователь не должен видеть как прочитанные свои сообщения
        msg.senderId !== userId
      );
    
    console.log(`Найдено ${messages.length} непрочитанных сообщений`);
    
    // Отмечаем сообщения как прочитанные
    for (const [id, message] of messages) {
      this.shopChatMessages.set(id, {
        ...message,
        isRead: true
      });
    }
  }

  // Shop complaint methods
  async getShopComplaints(shopId: number): Promise<Complaint[]> {
    return Array.from(this.shopComplaints.values())
      .filter(complaint => complaint.shopId === shopId);
  }

  async getShopComplaint(shopId: number, complaintId: number): Promise<Complaint | undefined> {
    const complaint = this.shopComplaints.get(complaintId);
    if (!complaint || complaint.shopId !== shopId) return undefined;
    return complaint;
  }

  async createShopComplaint(complaintData: { shopId: number; userId: number; title: string; description: string }): Promise<Complaint> {
    // Проверяем существование магазина
    const shop = this.shops.get(complaintData.shopId);
    if (!shop) {
      throw new Error("Магазин не найден");
    }
    
    const id = this.currentComplaintId++;
    const newComplaint: Complaint & { shopId: number } = {
      id,
      userId: complaintData.userId,
      title: complaintData.title,
      description: complaintData.description,
      status: "PENDING",
      assignedToId: null,
      createdAt: new Date(),
      resolvedAt: null,
      shopId: complaintData.shopId,
    };
    this.shopComplaints.set(id, newComplaint);

    // Create system message about complaint creation
    await this.createShopComplaintMessage({
      shopId: complaintData.shopId,
      complaintId: id,
      userId: complaintData.userId,
      message: "Обращение в магазин создано!",
      isSystemMessage: true,
    });

    return newComplaint;
  }

  async assignShopComplaint(shopId: number, complaintId: number, staffId: number): Promise<Complaint> {
    const complaint = this.shopComplaints.get(complaintId);
    if (!complaint || complaint.shopId !== shopId) throw new Error("Обращение не найдено!");
    
    const staffUser = this.users.get(staffId);
    const roleText = staffUser?.role === UserRole.OWNER ? "Владелец Площадки" :
                    staffUser?.role === UserRole.SECURITY ? "Служба Безопасности" :
                    staffUser?.role === UserRole.ADMIN ? "Админ" :
                    staffUser?.role === UserRole.HEADADMIN ? "Вице-Админ" :
                    staffUser?.role === UserRole.MODERATOR ? "Модератор" :
                    staffUser?.role === UserRole.SHOP_OWNER ? "Владелец магазина" :
                    staffUser?.role === UserRole.SHOP_MAIN ? "Управляющий магазина" :
                    staffUser?.role === UserRole.SHOP_STAFF ? "Сотрудник магазина" :
                    "Пользователь";

    const updatedComplaint = {
      ...complaint,
      assignedToId: staffId,
      status: "IN_PROGRESS",
    };
    this.shopComplaints.set(complaintId, updatedComplaint);

    // Create system message about assignment
    await this.createShopComplaintMessage({
      shopId,
      complaintId,
      userId: staffId,
      message: `${roleText} ${staffUser?.displayName || staffUser?.username} взял обращение в работу.`,
      isSystemMessage: true,
    });

    return updatedComplaint;
  }

  async resolveShopComplaint(shopId: number, complaintId: number): Promise<Complaint> {
    const complaint = this.shopComplaints.get(complaintId);
    if (!complaint || complaint.shopId !== shopId) throw new Error("Обращение не найдено!");
    
    const staffUser = this.users.get(complaint.assignedToId!);
    const roleText = staffUser?.role === UserRole.OWNER ? "Владелец Площадки" :
                    staffUser?.role === UserRole.SECURITY ? "Служба Безопасности" :
                    staffUser?.role === UserRole.ADMIN ? "Админ" :
                    staffUser?.role === UserRole.HEADADMIN ? "Вице-Админ" :
                    staffUser?.role === UserRole.MODERATOR ? "Модератор" :
                    staffUser?.role === UserRole.SHOP_OWNER ? "Владелец магазина" :
                    staffUser?.role === UserRole.SHOP_MAIN ? "Управляющий магазина" :
                    staffUser?.role === UserRole.SHOP_STAFF ? "Сотрудник магазина" :
                    "Пользователь";

    const updatedComplaint = {
      ...complaint,
      status: "RESOLVED",
      resolvedAt: new Date(),
    };
    this.shopComplaints.set(complaintId, updatedComplaint);

    // Create system message about resolution
    await this.createShopComplaintMessage({
      shopId,
      complaintId,
      userId: complaint.assignedToId!,
      message: `${roleText} ${staffUser?.displayName || staffUser?.username} закрыл обращение.`,
      isSystemMessage: true,
    });

    return updatedComplaint;
  }

  async rejectShopComplaint(shopId: number, complaintId: number, reason?: string): Promise<Complaint> {
    const complaint = this.shopComplaints.get(complaintId);
    if (!complaint || complaint.shopId !== shopId) throw new Error("Обращение не найдено!");
    
    const updatedComplaint = {
      ...complaint,
      status: "REJECTED",
      resolvedAt: new Date(),
    };
    this.shopComplaints.set(complaintId, updatedComplaint);

    // Create system message about rejection with reason if provided
    const rejectMessage = reason 
      ? `Обращение было отклонено по причине: ${reason}`
      : "В обращении отказано.";
      
    await this.createShopComplaintMessage({
      shopId,
      complaintId,
      userId: complaint.assignedToId || complaint.userId, // Use the assigned staff if available, otherwise use the creator
      message: rejectMessage,
      isSystemMessage: true,
    });

    return updatedComplaint;
  }

  async getShopComplaintMessages(shopId: number, complaintId: number): Promise<ComplaintMessage[]> {
    return Array.from(this.complaintMessages.values())
      .filter(msg => msg.complaintId === complaintId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createShopComplaintMessage(message: {
    shopId: number;
    complaintId: number;
    userId: number;
    message: string;
    isSystemMessage?: boolean;
  }): Promise<ComplaintMessage> {
    const id = this.currentComplaintMessageId++;
    const newMessage: ComplaintMessage = {
      id,
      complaintId: message.complaintId,
      userId: message.userId,
      message: message.message,
      isSystemMessage: message.isSystemMessage || false,
      createdAt: new Date(),
    };
    this.complaintMessages.set(id, newMessage);
    return newMessage;
  }
}

export const storage = new MemStorage();