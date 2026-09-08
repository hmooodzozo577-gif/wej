// Ports the quiz `.progress-track`/`.progress-fill` from wejhaty.html.
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
