export function Skeleton({ width = "100%", height = 16, radius = 8, style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />
  );
}

export function ChamadoCardSkeleton() {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 16,
      border: "1px solid #e5e0db", marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <Skeleton width={60} height={10} />
        <Skeleton width={70} height={18} radius={20} />
      </div>
      <Skeleton width="80%" height={13} style={{ marginBottom: 8 }} />
      <Skeleton width="55%" height={11} style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <Skeleton width={80} height={10} />
        <Skeleton width={60} height={10} />
      </div>
    </div>
  );
}

export function KanbanColumnSkeleton({ count = 3 }) {
  return (
    <div style={{
      minWidth: 260, maxWidth: 280, background: "#f5f3f0",
      borderRadius: 14, padding: 14, border: "1px solid #e5e0db",
    }}>
      <Skeleton width={120} height={14} style={{ marginBottom: 16 }} />
      {Array.from({ length: count }).map((_, i) => (
        <ChamadoCardSkeleton key={i} />
      ))}
    </div>
  );
}
