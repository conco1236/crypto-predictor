import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Backtest from "./pages/Backtest";
import NewsCenter from "./pages/NewsCenter";
import Glossary from "./pages/Glossary";
import TradingBot from "./pages/TradingBot";
import Operations from "./pages/Operations";
import FeedDiagnostics from "./pages/FeedDiagnostics";
import PlatformOverview from "./pages/PlatformOverview";
import QualityAlertSettings from "./pages/QualityAlertSettings";

function App() {
  const page = new URLSearchParams(window.location.search).get("page");
  return <ErrorBoundary><ThemeProvider defaultTheme="dark" switchable><TooltipProvider><Toaster />{page === "backtest" ? <Backtest /> : page === "news" ? <NewsCenter /> : page === "glossary" ? <Glossary /> : page === "trading-bot" ? <TradingBot /> : page === "operations" ? <Operations /> : page === "diagnostics" ? <FeedDiagnostics /> : page === "platform" ? <PlatformOverview /> : page === "quality-alerts" ? <QualityAlertSettings /> : <Home />}</TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
