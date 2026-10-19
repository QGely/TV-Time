import { Link } from 'react-router-dom';

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Chargement" />;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-box row wrap">
      <span className="grow">{error.message || String(error)}</span>
      {onRetry ? <button className="btn btn-sm" onClick={onRetry}>Réessayer</button> : null}
    </div>
  );
}

export function Empty({ icon = '📺', title, text, action, to }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      {title ? <h3>{title}</h3> : null}
      {text ? <p>{text}</p> : null}
      {action && to ? <Link to={to} className="btn btn-primary">{action}</Link> : null}
    </div>
  );
}

export function SectionHead({ title, count, to, linkText = 'Tout voir', right }) {
  return (
    <div className="section-head">
      <h2>{title} {count !== undefined ? <span className="count">{count}</span> : null}</h2>
      {right ? right : to ? <Link to={to}>{linkText}</Link> : null}
    </div>
  );
}
