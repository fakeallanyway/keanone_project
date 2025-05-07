import { Cart } from "./cart"

export function FloatingCart() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Cart />
    </div>
  )
} 