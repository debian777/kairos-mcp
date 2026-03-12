import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { KairosPage } from "./pages/KairosPage";
import { ProtocolDetailPage } from "./pages/ProtocolDetailPage";
import { ProtocolEditPage } from "./pages/ProtocolEditPage";
import { RunGuidedPage } from "./pages/RunGuidedPage";
import { RunsPage } from "./pages/RunsPage";
import { AccountPage } from "./pages/AccountPage";
import { NotFoundPage } from "./pages/NotFoundPage";

/** Route tree; use with any Router (BrowserRouter in app, MemoryRouter in tests). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="kairos" element={<KairosPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="protocols/new" element={<ProtocolEditPage />} />
        <Route path="protocols/:uri/edit" element={<ProtocolEditPage />} />
        <Route path="protocols/:uri/run" element={<RunGuidedPage />} />
        <Route path="protocols/:uri" element={<ProtocolDetailPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/ui">
      <AppRoutes />
    </BrowserRouter>
  );
}
