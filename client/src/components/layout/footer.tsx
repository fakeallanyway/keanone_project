import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t py-4 md:py-0 mt-auto">
      <div className="container flex flex-col items-center gap-4 md:h-16 md:flex-row md:justify-between px-4 md:px-6">
        <p className="text-xs md:text-sm text-center md:text-left text-muted-foreground">
          &copy; {new Date().getFullYear()} Lie Store. Все права защищены.
        </p>
        <nav className="flex flex-wrap justify-center gap-3 md:gap-4">
          <Link href="/terms">
            <a className="text-xs md:text-sm text-muted-foreground hover:text-foreground">
              Условия использования
            </a>
          </Link>
          <Link href="/privacy">
            <a className="text-xs md:text-sm text-muted-foreground hover:text-foreground">
              Политика конфиденциальности
            </a>
          </Link>
          <Link href="/about">
            <a className="text-xs md:text-sm text-muted-foreground hover:text-foreground">
              Информация о нас
            </a>
          </Link>
        </nav>
      </div>
    </footer>
  );
} 