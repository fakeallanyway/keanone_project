import { FC, ReactNode, useEffect, useState } from 'react'
import { Cart } from '@/components/ui/cart'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { useLocation } from 'wouter'

export interface RootLayoutProps {
  children: ReactNode
}

export const RootLayout: FC<RootLayoutProps> = ({
  children,
}) => {
  const [isMounted, setIsMounted] = useState(false)
  const [openMobileMenu, setOpenMobileMenu] = useState(false)
  const [location] = useLocation()

  // Проверяем, находимся ли мы на странице авторизации
  const isAuthPage = location === '/auth'

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Отображаем навбар только если не на странице авторизации */}
      {!isAuthPage && <Navbar />}
      
      <div className="flex flex-1 flex-col">
        <Sheet open={openMobileMenu} onOpenChange={setOpenMobileMenu}>
          <SheetTrigger asChild className="absolute top-4 left-4 z-50 md:hidden">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOpenMobileMenu(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] md:hidden">
            <div className="py-4">
              {/* Mobile menu content */}
            </div>
          </SheetContent>
        </Sheet>
        <main className="flex-1 flex flex-col">
          <div className="flex-1 p-4 md:p-6 pt-16 md:pt-6">
            {children}
          </div>
          {!isAuthPage && <Footer />}
        </main>
      </div>
      {!isAuthPage && <Cart />}
    </div>
  )
} 