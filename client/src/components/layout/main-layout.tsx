import { ReactNode } from "react";
import { Cart } from "@/components/ui/cart";
import { Footer } from "@/components/layout/footer";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 flex-col">
        <main className="flex-1 flex flex-col">
          <div className="flex-1 p-4 md:p-6 pt-16 md:pt-6">
            {children}
          </div>
          <Footer />
        </main>
      </div>
      <Cart />
    </div>
  );
} 