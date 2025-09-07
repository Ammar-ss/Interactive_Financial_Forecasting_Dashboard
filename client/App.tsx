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
import { DatasetProvider, useDataset } from "./context/DatasetContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const queryClient = new QueryClient();

function HeaderInner() {
  const { dataset, setDataset, company, setCompany } = useDataset();
  const companies = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
  return (
    <div className="container flex h-16 items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="https://cdn.builder.io/api/v1/image/assets%2F54f8588728e94fb0b8646e3f37922df0%2Fcd48fb1260514aca9d84f9c0d2f57891?format=webp&width=800" alt="Ammar_Predicts logo" className="h-8 w-8 rounded-md object-cover" />
        <span className="font-extrabold tracking-tight text-xl">Ammar_Predicts</span>
        <Badge variant="secondary" className="ml-2">ML</Badge>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <Select value={company} onValueChange={(v) => setCompany(v)}>
          <SelectTrigger className="w-[120px]"> <SelectValue /> </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dataset} onValueChange={(v) => setDataset(v as any)}>
          <SelectTrigger className="w-[220px]"> <SelectValue /> </SelectTrigger>
          <SelectContent>
            <SelectItem value="yahoo">Yahoo Finance — S&P 500</SelectItem>
            <SelectItem value="kaggle_crypto">Kaggle — Crypto</SelectItem>
            <SelectItem value="fred">FRED — Treasury Yields</SelectItem>
            <SelectItem value="worldbank">World Bank — Global Finance</SelectItem>
            <SelectItem value="alpha_vantage">Alpha Vantage — Forex</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
        <span>End-to-end stock & dataset prediction</span>
      </div>
    </div>
  );
}

function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_50%_-10%,hsl(var(--primary)/0.15),transparent)]" />
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
        <HeaderInner />
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t mt-12">
        <div className="container py-6 text-sm text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} Ammar_Predicts</span>
          <div className="flex flex-col items-end text-right">
            <span className="text-xs text-muted-foreground">Dataset: Yahoo Finance (historical OHLC chart API)</span>
            <span className="">Educational use only — not financial advice</span>
          </div>
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
      <DatasetProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DatasetProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
