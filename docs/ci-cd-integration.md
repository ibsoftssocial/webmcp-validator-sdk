# CI/CD Integration & Continuous Compliance Guide

Integrate the **WebMCP Validator** into your CI/CD pipelines to guarantee that every release maintains compliant AI tool registrations, safe mutation annotations, and valid discovery manifests.

---

## 🚀 GitHub Actions Integration

### 1. Using the Official WebMCP Action (`action.yml`)

The repository ships with an official composite action supporting fail thresholds, multi-format exports, and mobile emulation:

```yaml
name: WebMCP AI Readiness Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Start Local Development Server
        run: |
          npm ci
          npm run build
          npm run start &
          npx wait-on http://localhost:3000

      - name: Audit WebMCP Implementation
        uses: ibsoftssocial/webmcp-validator-sdk@main
        with:
          url: 'http://localhost:3000'
          fail-under: '80'
          format: 'pretty'
```

---

### 2. GitHub Code Scanning (SARIF Security Alerts)

Export findings in OASIS **SARIF 2.1.0** format to surface security warnings directly inside the GitHub **Security -> Code scanning** tab:

```yaml
name: WebMCP Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  sarif-scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run WebMCP Scan with SARIF Export
        run: |
          npx webmcp-validator-cli scan https://staging.example.com \
            --format sarif \
            -o results.sarif \
            --fail-under 80

      - name: Upload SARIF to GitHub Security Tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
```

---

### 3. Native Test Tab Integration (JUnit XML)

Generate JUnit XML reports to display test runs in GitHub Actions UI summaries:

```yaml
- name: Run WebMCP Audit (JUnit XML)
  run: |
    npx webmcp-validator-cli scan http://localhost:3000 \
      --format junit \
      -o reports/junit.xml \
      --fail-under 80

- name: Publish Test Report
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: 'reports/junit.xml'
```


---

## 🦊 GitLab CI Integration

Add WebMCP verification to `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - audit

webmcp_readiness:
  stage: audit
  image: node:20
  before_script:
    - npx playwright install-deps chromium
  script:
    - npx webmcp-validator-cli scan https://staging.example.com --fail-under 80 --format junit -o junit.xml
  artifacts:
    when: always
    reports:
      junit: junit.xml
```

---

## 🪣 Bitbucket Pipelines

Add WebMCP verification to `bitbucket-pipelines.yml`:

```yaml
pipelines:
  branches:
    main:
      - step:
          name: Audit WebMCP Readiness
          image: node:20
          script:
            - npx playwright install --with-deps chromium
            - npx webmcp-validator-cli scan https://example.com --fail-under 80 -o report.html
          artifacts:
            - report.html
```

---

## 🛡️ Failure Gating (`--fail-under`)

The `--fail-under` flag controls the strictness of CI gating:

- Exit Code `0`: Audit score is equal to or greater than the threshold (or passed).
- Exit Code `1`: Audit score is strictly lower than the threshold, breaking the pipeline.

```bash
# Permissive warning mode (score >= 60 passes)
npx webmcp-validator-cli scan https://example.com --fail-under 60

# Production readiness gate (score >= 80 passes)
npx webmcp-validator-cli scan https://example.com --fail-under 80

# Strict enterprise gate (requires Grade A, score >= 90)
npx webmcp-validator-cli scan https://example.com --fail-under 90
```
