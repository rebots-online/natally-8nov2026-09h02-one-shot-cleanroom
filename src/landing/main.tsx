// Landing entry: renders the VERBATIM original marketing implementation
// (src/landing-original/marketing.tsx, operator-authorized port of the
// deployed original v1.42). The module self-mounts into
// #marketing-experience-root (provided by landing.html together with the
// site header and #marketing-account-root) and redirects app-entry query
// params to /app.html, so this entry only loads the port.

export {};

void import('../landing-original/marketing');
