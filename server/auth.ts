import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, UserRole } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  if (!stored || !stored.includes(".")) return false;
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: "your-secret-key", // В реальном приложении использовать process.env.SESSION_SECRET
    resave: true, // Changed to true to ensure session is saved
    saveUninitialized: true, // Changed to true to ensure new sessions are saved
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to false for development
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }

        // Проверяем, не заблокирован ли пользователь
        if (user.isBlocked) {
          // Используем только доступные поля из схемы User
          const blockDate = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : new Date().toLocaleDateString();
          const blockInfo = `Account blocked. Reason: ${user.blockReason || 'Нарушение правил сайта'}, Date: ${blockDate}, Duration: Бессрочно`;
          return done(new Error(blockInfo), false);
        }

        // Update last login time
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(new Error('User not found'));
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Обработчик маршрута для регистрации
  app.post("/api/register", async (req, res) => {
    try {
      console.log("Регистрация пользователя:", {
        username: req.body.username,
        displayName: req.body.displayName,
        hasPassword: !!req.body.password
      });

      // Проверка наличия обязательных полей
      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ 
          error: "Имя пользователя и пароль обязательны" 
        });
      }

      // Проверка, существует ли пользователь с таким именем
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ 
          error: "Пользователь с таким именем уже существует" 
        });
      }

      // Хешируем пароль
      const hashedPassword = await hashPassword(req.body.password);

      // Создаем нового пользователя
      const newUser = await storage.createUser({
        username: req.body.username,
        password: hashedPassword,
        displayName: req.body.displayName || req.body.username,
        role: UserRole.USER // По умолчанию - обычный пользователь
      });

      // Логин пользователя после регистрации
      req.login(newUser, (loginErr) => {
        if (loginErr) {
          console.error("Ошибка при входе после регистрации:", loginErr);
          return res.status(500).json({ error: loginErr.message });
        }
        
        // Возвращаем данные пользователя без пароля
        const { password: _, ...userWithoutPassword } = newUser;
        console.log("Пользователь успешно зарегистрирован:", userWithoutPassword);
        return res.status(200).json(userWithoutPassword);
      });
    } catch (err) {
      console.error("Ошибка при регистрации:", err);
      return res.status(500).json({ 
        error: err instanceof Error ? err.message : "Ошибка при регистрации пользователя"
      });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        // Если ошибка связана с блокировкой пользователя
        if (err.message && err.message.includes('Account blocked')) {
          return res.status(403).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
      }
      
      if (!user) {
        return res.status(401).json({ error: "Неверное имя пользователя или пароль" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: loginErr.message });
        }
        
        // Возвращаем пользователя без пароля
        const { password: _, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}