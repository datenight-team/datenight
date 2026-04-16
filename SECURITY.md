# Security Policy

## Supported Versions

This is a personal home-lab project. Only the latest version on `main` receives fixes.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use [GitHub's private vulnerability reporting](https://github.com/datenight-team/datenight/security/advisories/new) to submit a report. If you're unsure whether something qualifies, err on the side of reporting privately.

Include as much of the following as you can:

- Description of the vulnerability and its potential impact
- Steps to reproduce
- Any proof-of-concept code or screenshots

I'll acknowledge the report within a few days and keep you updated as I work toward a fix.

## Scope

Things worth reporting:

- Secrets or credentials exposed via the API or UI
- Authentication/authorization bypasses (there is no auth by design — but unintended exposure of rating data across users counts)
- Injection vulnerabilities (SQL, command, etc.)
- Dependencies with known CVEs that affect this app's threat model

Out of scope:

- Issues that require physical access to the host machine
- Denial of service against a self-hosted instance
- Missing security headers on a local network deployment
- Vulnerabilities in transitive dependencies that have no practical exploit path in this app
