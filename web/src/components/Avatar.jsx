import { initials } from '../lib/format.js';

export function Avatar({ user, size }) {
  const cls = 'avatar' + (size === 'lg' ? ' lg' : '') + (user?.avatar ? ' emoji' : '');
  return <span className={cls}>{user?.avatar || initials(user?.display_name)}</span>;
}
