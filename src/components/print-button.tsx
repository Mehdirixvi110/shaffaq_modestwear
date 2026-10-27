"use client";

export function PrintButton() {
  return <button className="button button--dark print-hide" type="button" onClick={() => window.print()}>Print</button>;
}
