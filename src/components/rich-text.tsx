import type { ReactNode } from "react";

// Renders a plain-text body as safe React nodes (never dangerouslySetInnerHTML, so
// no HTML injection is possible). Supports a light, predictable convention:
//   "## "  -> h2        "### " -> h3
//   "- "   -> bullet list item (consecutive items group into one <ul>)
//   blank  -> paragraph break (spacing)
//   else   -> paragraph
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(<ul key={key}>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>);
  };
  text.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line.startsWith("- ")) { bullets.push(line.slice(2)); return; }
    flushBullets(`ul-${index}`);
    if (!line) return;
    if (line.startsWith("### ")) { blocks.push(<h3 key={index}>{line.slice(4)}</h3>); return; }
    if (line.startsWith("## ")) { blocks.push(<h2 key={index}>{line.slice(3)}</h2>); return; }
    blocks.push(<p key={index}>{line}</p>);
  });
  flushBullets("ul-end");
  return <div className={className}>{blocks}</div>;
}
