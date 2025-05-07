import { User, UserRole } from "@shared/schema";

/**
 * Проверяет, является ли пользователь владельцем платформы
 */
export function isOwner(user: User | null) {
  if (!user) return false;
  return user.role === UserRole.OWNER || user.role === UserRole.SECURITY;
}

/**
 * Проверяет, является ли пользователь администратором
 */
export function isAdmin(user: User | null) {
  if (!user) return false;
  return isOwner(user) || user.role === UserRole.ADMIN;
}

/**
 * Проверяет, является ли пользователь вице-администратором
 */
export function isHeadAdmin(user: User | null) {
  if (!user) return false;
  return user.role === UserRole.HEADADMIN;
}

/**
 * Проверяет, является ли пользователь модератором
 */
export function isModerator(user: User | null) {
  if (!user) return false;
  return user.role === UserRole.MODERATOR;
}

/**
 * Проверяет, является ли пользователь сотрудником платформы
 */
export function isStaff(user: User | null) {
  if (!user) return false;
  return [
    UserRole.OWNER,
    UserRole.SECURITY,
    UserRole.ADMIN,
    UserRole.HEADADMIN,
    UserRole.MODERATOR
  ].includes(user.role as UserRole);
}

/**
 * Проверяет, является ли пользователь сотрудником магазина
 */
export function isShopStaff(user: User | null) {
  if (!user) return false;
  return [
    UserRole.SHOP_OWNER,
    UserRole.SHOP_MAIN,
    UserRole.SHOP_STAFF
  ].includes(user.role as UserRole);
}

/**
 * Проверяет, может ли пользователь управлять магазином
 */
export function canManageShop(user: User | null) {
  if (!user) return false;
  return isAdmin(user) || user.role === UserRole.SHOP_OWNER || user.role === UserRole.SHOP_MAIN;
}

/**
 * Проверяет, может ли пользователь управлять сотрудниками магазина
 */
export function canManageShopStaff(user: User | null) {
  if (!user) return false;
  return isAdmin(user) || user.role === UserRole.SHOP_OWNER || user.role === UserRole.SHOP_MAIN;
} 