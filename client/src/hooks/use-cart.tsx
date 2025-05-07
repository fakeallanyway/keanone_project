import * as React from "react"
import { useToast } from "@/hooks/use-toast"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  avatarUrl?: string
  shopId: string
  shopName: string
  shopIsVerified?: boolean
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "quantity">) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  getShopItems: (shopId: string) => CartItem[]
}

const CartContext = React.createContext<CartState | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [items, setItems] = React.useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cart")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          return []
        }
      }
    }
    return []
  })

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cart", JSON.stringify(items))
    }
  }, [items])

  const addItem = React.useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.id === item.id)
      
      if (existingItem) {
        // Если товар уже есть в корзине, увеличиваем количество
        const updatedItems = prevItems.map((i) => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
        
        toast({
          title: "Товар в корзине",
          description: `Количество "${item.name}" увеличено`,
        })
        
        return updatedItems
      } else {
        // Если товара нет в корзине, добавляем с количеством 1
        toast({
          title: "Товар добавлен в корзину",
          description: `"${item.name}" добавлен в корзину`,
        })
        
        return [...prevItems, { ...item, quantity: 1 }]
      }
    })
  }, [toast])

  const removeItem = React.useCallback((id: string) => {
    setItems((prevItems) => {
      const item = prevItems.find((i) => i.id === id)
      if (item) {
        toast({
          title: "Товар удален",
          description: `"${item.name}" удален из корзины`,
        })
      }
      return prevItems.filter((i) => i.id !== id)
    })
  }, [toast])

  const updateQuantity = React.useCallback((id: string, quantity: number) => {
    setItems((prevItems) => 
      prevItems.map((item) => 
        item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
      ).filter((item) => item.quantity > 0)
    )
  }, [])

  const clearCart = React.useCallback(() => {
    setItems([])
    toast({
      title: "Корзина очищена",
      description: "Все товары удалены из корзины",
    })
  }, [toast])

  const getTotalItems = React.useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }, [items])

  const getTotalPrice = React.useCallback(() => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0)
  }, [items])

  const getShopItems = React.useCallback((shopId: string) => {
    return items.filter((item) => item.shopId === shopId)
  }, [items])

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotalItems,
      getTotalPrice,
      getShopItems
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = React.useContext(CartContext)
  
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  
  return context
} 