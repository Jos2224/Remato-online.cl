import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { AuctionPage } from "./pages/AuctionPage";
import { AuthPage } from "./pages/AuthPage";
import { EditAuctionPage } from "./pages/EditAuctionPage";
import { HomePage } from "./pages/HomePage";
import { MatchesPage } from "./pages/MatchesPage";
import { MyAuctionsPage } from "./pages/MyAuctionsPage";
import { MyBidsPage } from "./pages/MyBidsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublishPage } from "./pages/PublishPage";

const protect = (element, userOnly = false) => (
  <ProtectedRoute userOnly={userOnly}>{element}</ProtectedRoute>
);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="subastas/:id" element={<AuctionPage />} />
        <Route path="ingresar" element={<AuthPage mode="login" />} />
        <Route path="registro" element={<AuthPage mode="register" />} />
        <Route path="publicar" element={protect(<PublishPage />, true)} />
        <Route path="subastas/:id/editar" element={protect(<EditAuctionPage />, true)} />
        <Route path="cuenta" element={protect(<AccountPage />)} />
        <Route path="mis-subastas" element={protect(<MyAuctionsPage />, true)} />
        <Route path="mis-pujas" element={protect(<MyBidsPage />, true)} />
        <Route path="posta" element={protect(<MatchesPage />, true)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
