export default function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card p-6">
      <p className="text-sm text-stone">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}
