import { ReactNode } from "react";
import { FloatingCart } from "@/components/ui/floating-cart";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      {children}
      <FloatingCart />
    </>
  );
} 