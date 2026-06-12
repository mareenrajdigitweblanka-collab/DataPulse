"use client";

export const EMPTY = "—";

export const TH = "px-4 py-3 font-semibold";
export const TD = "px-4 py-3 align-top";

export function formatPrice(
  price: number | null | undefined,
  currency?: string | null
): string {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return EMPTY;
  }

  const formatted = price.toFixed(2);

  return currency ? `${currency} ${formatted}` : formatted;
}

export function ResultImageCell({
  src,
  alt,
}: {
  src: string | null | undefined;
  alt: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-12 w-12 rounded-lg object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-lg text-xs"
      style={{ background: "var(--bg-primary)", color: "var(--text-tertiary)" }}
    >
      {EMPTY}
    </div>
  );
}

export function ResultLinkCell({
  href,
}: {
  href: string | null | undefined;
}) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold hover:opacity-80"
        style={{ color: "var(--accent-primary)" }}
      >
        Open
      </a>
    );
  }

  return <span style={{ color: "var(--text-tertiary)" }}>{EMPTY}</span>;
}
