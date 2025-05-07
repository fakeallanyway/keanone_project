import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export enum UserRole {
  OWNER = "Владелец площадки",
  SECURITY = "Служба Безопасности",
  ADMIN = "Админ",
  HEADADMIN = "Вице-Админ",
  MODERATOR = "Модератор",
  SHOP_OWNER = "Владелец магазина",
  SHOP_MAIN = "Управляющий магазина",
  SHOP_STAFF = "Сотрудник магазина",
  USER = "Пользователь"
}

const ComplaintStatus = {
  PENDING: "В ожидании",
  IN_PROGRESS: "В работе",
  RESOLVED: "Завершён",
  REJECTED: "Отклонён",
} as const;

type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];

// Статус магазина
export const ShopStatus = {
  ACTIVE: "Активен",
  BLOCKED: "Заблокирован",
  PENDING: "На рассмотрении",
} as const;

export type ShopStatus = (typeof ShopStatus)[keyof typeof ShopStatus];

// Тип сообщения в чате магазина
export const ChatMessageType = {
  USER: "Пользователь",
  SHOP: "Магазин",
  SYSTEM: "Система",
} as const;

export type ChatMessageType = (typeof ChatMessageType)[keyof typeof ChatMessageType];

export const socialLinksSchema = z.object({
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  website: z.string().optional(),
});

export type SocialLinks = z.infer<typeof socialLinksSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  socialLinks: jsonb("social_links").$type<SocialLinks | null>(),
  role: text("role").notNull().default(UserRole.USER),
  isPremium: boolean("is_premium").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockReason: text("block_reason"),
  blockExpiresAt: timestamp("block_expires_at"),
  lastLoginAt: timestamp("last_login_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").notNull().default(true),
});

export const complaints = pgTable("complaints", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  targetUserId: integer("target_user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default(ComplaintStatus.PENDING),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Добавляем таблицу для сообщений в чате репортов
export const complaintMessages = pgTable("complaint_messages", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id").references(() => complaints.id),
  userId: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isSystemMessage: boolean("is_system_message").notNull().default(false),
});

// Таблица магазинов
export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  status: text("status").notNull().default(ShopStatus.PENDING),
  ownerId: integer("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Таблица товаров
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  price: text("price").notNull(),
  quantity: integer("quantity").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Таблица отзывов о товарах
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  userId: integer("user_id").references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  role: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  avatarUrl: true,
});

export const insertSessionSchema = createInsertSchema(sessions);

export const insertComplaintSchema = createInsertSchema(complaints).pick({
  title: true,
  description: true,
  targetUserId: true,
});

export const insertComplaintMessageSchema = createInsertSchema(complaintMessages).pick({
  message: true,
});

// Схемы для магазинов
export const insertShopSchema = createInsertSchema(shops).pick({
  name: true,
  description: true,
  avatarUrl: true,
  ownerId: true,
});

export const updateShopSchema = createInsertSchema(shops).pick({
  name: true,
  description: true,
  avatarUrl: true,
  isVerified: true,
  status: true,
  blockReason: true,
});

// Схемы для товаров
export const insertProductSchema = createInsertSchema(products).pick({
  shopId: true,
  name: true,
  description: true,
  avatarUrl: true,
  price: true,
  quantity: true,
});

export const updateProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  avatarUrl: true,
  price: true,
  quantity: true,
});

// Схема для отзывов
export const insertReviewSchema = createInsertSchema(reviews).pick({
  productId: true,
  rating: true,
  comment: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type ComplaintMessage = typeof complaintMessages.$inferSelect;
export type InsertComplaintMessage = z.infer<typeof insertComplaintMessageSchema>;

// Типы для магазинов и товаров
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
export type UpdateShop = z.infer<typeof updateShopSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

// Добавляем таблицу для чатов магазинов
export const shopChats = pgTable("shop_chats", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id),
  userId: integer("user_id").references(() => users.id),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Добавляем таблицу для сообщений в чатах магазинов
export const shopChatMessages = pgTable("shop_chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").references(() => shopChats.id),
  senderId: integer("sender_id").references(() => users.id),
  senderType: text("sender_type").notNull(), // USER, SHOP, SYSTEM
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
});

export const insertShopChatSchema = createInsertSchema(shopChats).pick({
  shopId: true,
  userId: true,
});

export const insertShopChatMessageSchema = createInsertSchema(shopChatMessages).pick({
  message: true,
  senderType: true,
});

export type ShopChat = typeof shopChats.$inferSelect;
export type ShopChatMessage = typeof shopChatMessages.$inferSelect;
export type InsertShopChat = z.infer<typeof insertShopChatSchema>;
export type InsertShopChatMessage = z.infer<typeof insertShopChatMessageSchema>;