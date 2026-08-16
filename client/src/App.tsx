import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Backtest from "./pages/Backtest";

function App() {
  const page = new URLSearchParams(window.location.search).get("page");
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster />{page === "backtest" ? <Backtest /> : <Home />}</TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
