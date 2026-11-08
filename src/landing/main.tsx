// Landing entry: renders the VERBATIM original marketing implementation
// (src/landing-original/marketing.tsx, operator-authorized port). The
// module self-mounts into #marketing-experience-root and redirects to
// /app.html for app-entry query params, so this entry only guarantees the
// mount node exists and loads the port.

import '../shared/tokens.css';

if (!document.getElementById('marketing-experience-root')) {
  const host = document.createElement('div');
  host.id = 'marketing-experience-root';
  document.body.appendChild(host);
}

void import('../landing-original/marketing');
