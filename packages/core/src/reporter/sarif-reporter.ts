import { WebMCPReadinessReport, ReporterOptions, FindingSeverity } from '../types/index.js';

/**
 * Maps WebMCP finding severity to official OASIS SARIF v2.1.0 levels
 */
function severityToSarifLevel(severity: FindingSeverity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'note';
    default:
      return 'warning';
  }
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note';
  };
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
  };
  message?: { text: string };
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: SarifLocation[];
}

export interface SarifLog {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
  }>;
}

/**
 * Formats a WebMCP Readiness Report as an OASIS SARIF v2.1.0 JSON document
 * for integration with GitHub Code Scanning, VS Code SARIF viewers, and CI security gates.
 */
export function renderSarifReport(
  report: WebMCPReadinessReport,
  options?: ReporterOptions
): string {
  const rulesMap = new Map<string, SarifRule>();

  for (const f of report.findings) {
    if (!rulesMap.has(f.ruleId)) {
      rulesMap.set(f.ruleId, {
        id: f.ruleId,
        name: f.title || f.ruleId,
        shortDescription: { text: f.title || f.ruleId },
        fullDescription: { text: f.message },
        helpUri: f.docsUrl || 'https://github.com/ibsoftssocial/webmcp-validator-sdk',
        defaultConfiguration: {
          level: severityToSarifLevel(f.severity),
        },
      });
    }
  }

  const results: SarifResult[] = report.findings.map((f) => {
    const loc: SarifLocation = {
      physicalLocation: {
        artifactLocation: {
          uri: report.url,
        },
      },
    };

    if (f.toolName) {
      loc.message = { text: `Target tool: ${f.toolName}` };
    }

    const messageText = f.suggestion
      ? `${f.message}\nRemediation: ${f.suggestion}`
      : f.message;

    return {
      ruleId: f.ruleId,
      level: severityToSarifLevel(f.severity),
      message: { text: messageText },
      locations: [loc],
    };
  });

  const sarifLog: SarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'webmcp-validator',
            version: '0.1.0',
            informationUri: 'https://github.com/ibsoftssocial/webmcp-validator-sdk',
            rules: Array.from(rulesMap.values()),
          },
        },
        results,
      },
    ],
  };

  const indent = options?.jsonIndent ?? 2;
  return JSON.stringify(sarifLog, null, indent);
}
