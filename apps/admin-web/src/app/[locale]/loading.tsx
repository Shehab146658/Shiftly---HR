export default function GlobalLoading() {
  return <div aria-label="Loading" aria-live="polite" className="global-loader" role="status">
    <span className="global-loader-ring" />
    <span className="global-loader-mark">S</span>
  </div>;
}
