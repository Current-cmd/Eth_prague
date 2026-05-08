interface EnsNameProps {
  name: string;
  className?: string;
}

export function EnsName({ name, className = "" }: EnsNameProps) {
  // The leaf label sits in paper, the rest in paper3 — matches the visual treatment used in
  // existing card layouts (e.g. PublicView's report cards: "anon-7x3k.arcadia.eth").
  const dot = name.indexOf(".");
  if (dot < 0) return <span className={`font-mono text-paper ${className}`}>{name}</span>;
  return (
    <span className={`font-mono ${className}`}>
      <span className="text-paper">{name.slice(0, dot)}</span>
      <span className="text-paper3">{name.slice(dot)}</span>
    </span>
  );
}
