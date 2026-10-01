import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { scanUrl } from 'webmcp-validator-sdk';

const program = new Command();

program
  .name('webmcp-validator')
  .description('Audit, scan, and validate WebMCP tools on websites')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan a website for WebMCP tools and evaluate agent readiness')
  .argument('<url>', 'Target website URL to scan (e.g., https://example.com or http://localhost:3000)')
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '15000')
  .option('-o, --output <file>', 'Save output report to file (json, md, or html)')
  .option('--format <type>', 'Output format: pretty, json, markdown, html', 'pretty')
  .option('--fail-under <score>', 'Exit with code 1 if score is below this threshold', '80')
  .action(async (url: string, options: any) => {
    const timeoutMs = parseInt(options.timeout, 10) || 15000;
    const spinner = ora(`Launching Chromium and scanning ${chalk.cyan(url)}...`).start();

    try {
      const result = await scanUrl({
        url,
        timeoutMs,
      });

      spinner.succeed(`Scan completed in ${chalk.yellow(result.durationMs + 'ms')}`);

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('\n' + chalk.bold.underline('WebMCP Discovery Results:'));
      console.log(`  ${chalk.bold('Target URL:')}                 ${result.url}`);
      console.log(`  ${chalk.bold('modelContext (Browser):')}      ${result.hasNavigatorModelContext ? chalk.green('✔ Found') : chalk.red('✖ Missing')}`);
      console.log(`  ${chalk.bold('Imperative Tools:')}           ${result.imperativeDetected ? chalk.green('✔ Detected') : chalk.gray('None')}`);
      console.log(`  ${chalk.bold('Declarative Markup:')}         ${result.declarativeDetected ? chalk.green('✔ Detected') : chalk.gray('None')}`);
      console.log(`  ${chalk.bold('MCP Manifest:')}               ${result.manifestDetails?.hasManifest ? chalk.green('✔ Found') + chalk.gray(` (${result.manifestDetails.manifestUrl})`) : chalk.gray('None')}`);
      console.log(`  ${chalk.bold('Agent Directives (llms.txt):')} ${result.hasLlmsTxt ? chalk.green('✔ Found') : chalk.gray('None')}`);
      if (result.agentDirectives?.hasRobotsTxt) {
        console.log(`  ${chalk.bold('AI Robots Crawler Policy:')}   ${result.agentDirectives.aiCrawlersAllowed ? chalk.green('✔ Permitted') : chalk.yellow('⚠ Blocked')}`);
      }
      console.log(`  ${chalk.bold('Total Tools Discovered:')}     ${chalk.bold(result.tools.length.toString())}`);

      if (result.tools.length > 0) {
        console.log('\n' + chalk.bold('Discovered Tools:'));
        const table = new Table({
          head: [
            chalk.cyan('Tool Name'),
            chalk.cyan('Source'),
            chalk.cyan('Description'),
            chalk.cyan('Read Only'),
            chalk.cyan('Confirm Hint'),
          ],
          colWidths: [22, 14, 40, 11, 14],
          wordWrap: true,
        });

        for (const tool of result.tools) {
          const sourceBadge = tool.source === 'manifest' ? chalk.magenta('manifest') : chalk.blue('imperative');
          table.push([
            chalk.bold(tool.name),
            sourceBadge,
            tool.description || chalk.gray('(No description)'),
            tool.annotations?.readOnlyHint ? chalk.green('Yes') : chalk.gray('No'),
            tool.annotations?.confirmationHint ? chalk.yellow('Yes') : chalk.gray('No'),
          ]);
        }

        console.log(table.toString());
      } else {
        console.log(chalk.yellow('\nℹ No WebMCP tools were discovered on this page.'));
      }

      if (result.scanErrors.length > 0) {
        console.log('\n' + chalk.red.bold('Scan Warnings / Errors:'));
        for (const err of result.scanErrors) {
          console.log(`  ${chalk.red('⚠')} ${err}`);
        }
      }

      console.log('');
    } catch (err: any) {
      spinner.fail(`Failed to scan ${url}`);
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program.parse(process.argv);
