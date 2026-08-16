import { toPng } from "html-to-image";

export async function downloadReportPng(node: HTMLElement | null, filename: string) {
  if (!node) throw new Error("Không tìm thấy vùng báo cáo để xuất ảnh");
  const dataUrl = await toPng(node, {
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    cacheBust: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#ffffff",
  });
  const link = document.createElement("a");
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = dataUrl;
  link.click();
}

export function printReport(title: string) {
  const previousTitle = document.title;
  document.title = title;
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
