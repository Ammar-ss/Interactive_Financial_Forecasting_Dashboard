import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Badge } from "./components/ui/badge";

const queryClient = new QueryClient();

function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_50%_-10%,hsl(var(--primary)/0.15),transparent)]" />
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/90 shadow-sm shadow-primary/40" />
            <span className="font-extrabold tracking-tight text-xl">AstraStocks</span>
            <Badge variant="secondary" className="ml-2">ML</Badge>
          </div>
          <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
            <span>End-to-end stock price prediction</span>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t mt-12">
        <div className="container py-6 text-sm text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} AstraStocks</span>
          <span>Educational use only — not financial advice</span>
        </div>
      </footer>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
