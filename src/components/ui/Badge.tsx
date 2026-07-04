import { clsx } from "clsx";

type BadgeTone = "green" | "gray" | "red" | "gold";

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-800",
  gray: "bg-stone-light text-stone",
  red: "bg-red-100 text-red-700",
  gold: "bg-gold/20 text-gold-dark",
};

export default function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}
