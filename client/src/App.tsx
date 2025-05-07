import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { LocaleProvider } from "@/hooks/use-locale";
import { CartProvider } from "@/hooks/use-cart";
import { queryClient } from "./lib/queryClient";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { FloatingCartButton } from "@/components/ui/floating-cart-button";
import { RootLayout } from "@/components/layout/root-layout";
import NotFoundPage from "@/pages/not-found-page";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import AdminPage from "@/pages/admin-page";
import CreateAccountPage from "@/pages/create-account-page";
import ProfilePage from "@/pages/profile-page";
import ComplaintsPage from "@/pages/complaints-page";
import { ProtectedRoute, StaffProtectedRoute, ShopOwnerProtectedRoute, OwnerProtectedRoute } from "./lib/protected-route";
import CreateShopPage from "@/pages/create-shop-page";
import ShopPage from "@/pages/shop-page";
import ShopsPage from "@/pages/shops-page";
import StaffShopPage from "@/pages/staff-shop-page";
import EditShopPage from "@/pages/edit-shop-page";
import CreateProductPage from "@/pages/create-product-page";
import ProductPage from "@/pages/product-page";
import EditProductPage from "@/pages/edit-product-page";
import ManageShopsPage from "@/pages/manage-shops-page";
import ManageProductsPage from "@/pages/manage-products-page";
import BannedNamesPage from "@/pages/banned-names-page";
import SiteSettingsPage from "@/pages/site-settings-page";
import UserProfilePage from "@/pages/user-profile-page";
import TermsPage from "@/pages/terms-page";
import PrivacyPage from "@/pages/privacy-page";
import ChatsPage from "@/pages/chats-page";
import ShopChatPage from "@/pages/shop-chat-page";
import ShopChatsPage from "@/pages/shop-chats-page";
import ShopAppealPage from "@/pages/shop-appeal-page";
import CatalogPage from "@/pages/catalog-page";
import UserEditPage from "@/pages/user-edit-page";
import NotificationsPage from "@/pages/notifications-page";

function Router() {
  return (
    <RootLayout>
      <Switch>
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/catalog" component={CatalogPage} />
        <Route path="/shops" component={ShopsPage} />
        <ProtectedRoute path="/" component={DashboardPage} />
        <StaffProtectedRoute path="/admin" component={AdminPage} />
        <StaffProtectedRoute path="/create-account" component={CreateAccountPage} />
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/complaints" component={ComplaintsPage} />
        <ShopOwnerProtectedRoute path="/shop-appeal" component={ShopAppealPage} />
        <ProtectedRoute path="/chats" component={ChatsPage} />
        <ProtectedRoute path="/chats/:id" component={ShopChatPage} />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
        <ShopOwnerProtectedRoute path="/shop-chats" component={ShopChatsPage} />
        <Route path="/auth" component={AuthPage} />
        <OwnerProtectedRoute path="/create-shop" component={CreateShopPage} />
        <Route path="/shops/:id" component={ShopPage} />
        <ProtectedRoute path="/shops/:id/staff" component={StaffShopPage} />
        <ShopOwnerProtectedRoute path="/shops/:id/edit" component={EditShopPage} />
        <ShopOwnerProtectedRoute path="/shops/:id/products/create" component={CreateProductPage} />
        <Route path="/products/:id" component={ProductPage} />
        <ShopOwnerProtectedRoute path="/products/:id/edit" component={EditProductPage} />
        <ShopOwnerProtectedRoute path="/manage-shops" component={ManageShopsPage} />
        <ShopOwnerProtectedRoute path="/manage-products" component={ManageProductsPage} />
        <StaffProtectedRoute path="/banned-names" component={BannedNamesPage} />
        <StaffProtectedRoute path="/site-settings" component={SiteSettingsPage} />
        <Route path="/users/:id" component={UserProfilePage} />
        <StaffProtectedRoute path="/users/:id/edit" component={UserEditPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </RootLayout>
  );
}

// Компонент с плавающей кнопкой корзины, который не отображается на странице авторизации
function FloatingCartWithLocation() {
  const [location] = useLocation();
  const isAuthPage = location === '/auth';
  
  if (isAuthPage) return null;
  
  return <FloatingCartButton />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <CartProvider>
            <Router />
            <FloatingCartWithLocation />
            <Toaster />
          </CartProvider>
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}