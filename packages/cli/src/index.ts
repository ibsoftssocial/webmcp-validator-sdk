import { Command } from 'commander';

const program = new Command();

program
  .name('webmcp')
  .description('Audit, scan, and manage WebMCP tools on websites')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan a website for WebMCP tools and evaluate agent readiness')
  .argument('<url>', 'Target website URL to scan (e.g., https://example.com or http://localhost:3000)')
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '15000')
  .option('-o, --output <file>', 'Save output report to file (json, md, or html)')
  .option('--format <type>', 'Output format: pretty, json, markdown, html', 'pretty')
  .option('--fail-under <score>', 'Exit with code 1 if score is below this threshold', '80')
  .action(async (url, _options) => {
    console.log(`Scanning ${url} for WebMCP...`);
  });

program.parse(process.argv);
