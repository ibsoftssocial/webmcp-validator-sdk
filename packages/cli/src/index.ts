import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { scanUrl, lintWebMCP, calculateReadinessScore, GradeRating } from 'webmcp-validator-sdk';

const program = new Command();

program
  .name('webmcp-validator')
  .description('Audit, scan, and validate WebMCP tools on websites')
  .version('0.1.0');

function getGradeBadge(grade: GradeRating): string {
  switch (grade) {
    case 'A':
      return chalk.bgGreen.black.bold(' A ');
    case 'B':
      return chalk.bgBlue.white.bold(' B ');
    case 'C':
      return chalk.bgYellow.black.bold(' C ');
    case 'D':
      return chalk.bgMagenta.white.bold(' D ');
    case 'F':
      return chalk.bgRed.white.bold(' F ');
  }
}

function collectHeaders(value: string, previous: Record<string, string> = {}): Record<string, string> {
  const colonIdx = value.indexOf(':');
  if (colonIdx !== -1) {
    const key = value.slice(0, colonIdx).trim();
    const val = value.slice(colonIdx + 1).trim();
    return { ...previous, [key]: val };
  }
  return previous;
}

program
  .command('scan')
  .description('Scan a website for WebMCP tools and evaluate agent readiness')
  .argument('<url>', 'Target website URL to scan (e.g., https://example.com or http://localhost:3000)')
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '15000')
  .option('-m, --mobile', 'Emulate mobile device viewport and user-agent')
  .option('--block-media', 'Block images, media, and fonts to accelerate scan')
  .option('-c, --cookie <string>', 'Custom session cookie string (e.g. "auth_token=xyz; session=123")')
  .option('-H, --header <string>', 'Custom HTTP header (Key: Value)', collectHeaders, {})
  .option('--no-stealth', 'Disable anti-bot stealth emulation')
  .option('--wait-network-idle', 'Wait for network idle before evaluating tools')
  .option('--no-lint', 'Do not run linter rules on discovered tools')
  .option('--min-severity <level>', 'Minimum finding severity: error, warning, info')
  .option('--category <category>', 'Filter lint findings by category')
  .option('--rules <ids>', 'Comma-separated list of rule IDs to evaluate')
  .option('--skip-rules <ids>', 'Comma-separated list of rule IDs to skip')
  .option('-o, --output <file>', 'Save output report to file (json, md, or html)')
  .option('--format <type>', 'Output format: pretty, json, markdown, html', 'pretty')
  .option('--fail-under <score>', 'Exit with code 1 if score is below this threshold')
  .action(async (url: string, options: any) => {
    const timeoutMs = parseInt(options.timeout, 10) || 15000;
    const spinner = ora(`Launching Chromium and scanning ${chalk.cyan(url)}...`).start();

    try {
      const result = await scanUrl({
        url,
        timeoutMs,
        isMobile: !!options.mobile,
        blockMedia: !!options.blockMedia,
        cookies: options.cookie,
        headers: options.header,
        stealth: options.stealth,
        waitForNetworkIdle: !!options.waitNetworkIdle,
      });

      spinner.succeed(`Scan completed in ${chalk.yellow(result.durationMs + 'ms')}`);

      let lintResult: any = null;
      let readinessReport: any = null;
      const failUnderThreshold = options.failUnder ? parseInt(options.failUnder, 10) : undefined;

      if (options.lint !== false) {
        lintResult = await lintWebMCP(result, {
          minSeverity: options.minSeverity,
          categories: options.category ? [options.category] : undefined,
          includeRules: options.rules ? options.rules.split(',').map((s: string) => s.trim()) : undefined,
          excludeRules: options.skipRules ? options.skipRules.split(',').map((s: string) => s.trim()) : undefined,
        });

        readinessReport = calculateReadinessScore(result, lintResult, {
          passingScore: failUnderThreshold ?? 80,
        });
      }

      if (options.format === 'json') {
        const jsonOutput = lintResult
          ? { ...result, lint: lintResult, readiness: readinessReport }
          : result;
        console.log(JSON.stringify(jsonOutput, null, 2));
        if (
          failUnderThreshold !== undefined &&
          readinessReport &&
          readinessReport.overallScore < failUnderThreshold
        ) {
          process.exit(1);
        }
        return;
      }

      console.log('\n' + chalk.bold.underline('WebMCP Discovery Results:'));
      console.log(`  ${chalk.bold('Target URL:')}                 ${result.url}`);
      if (result.httpStatus) {
        const statusBadge =
          result.httpStatus === 200
            ? chalk.green(`✔ ${result.httpStatus} OK`)
            : result.httpStatus >= 400
            ? chalk.red(`✖ ${result.httpStatus}`)
            : chalk.yellow(`⚠ ${result.httpStatus}`);
        console.log(`  ${chalk.bold('HTTP Status:')}                 ${statusBadge}`);
      }
      if (result.redirectChain && result.redirectChain.length > 0) {
        console.log(`  ${chalk.bold('Redirect Chain:')}           ${chalk.gray(result.redirectChain.join(' ➔ ') + ' ➔ ') + chalk.cyan(result.finalUrl)}`);
      } else if (result.finalUrl && result.finalUrl !== result.url) {
        console.log(`  ${chalk.bold('Final URL:')}                  ${result.finalUrl}`);
      }
      if (options.mobile) {
        console.log(`  ${chalk.bold('Device Emulation:')}          ${chalk.cyan('📱 Mobile (390x844, Touch)')}`);
      }
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
          let sourceBadge = chalk.blue('imperative');
          if (tool.source === 'declarative') {
            sourceBadge = chalk.yellow('declarative');
          } else if (tool.source === 'manifest') {
            sourceBadge = chalk.magenta('manifest');
          } else if (tool.source === 'llms-txt') {
            sourceBadge = chalk.cyan('llms.txt');
          }
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

      if (lintResult) {
        console.log('\n' + chalk.bold.underline('Linter Audit Findings:'));
        console.log(`  ${chalk.bold('Rules Evaluated:')}           ${lintResult.rulesExecuted}`);
        console.log(
          `  ${chalk.bold('Findings Summary:')}          ${chalk.red(
            `${lintResult.errorCount} Errors`
          )}, ${chalk.yellow(`${lintResult.warningCount} Warnings`)}, ${chalk.cyan(
            `${lintResult.infoCount} Info`
          )}`
        );

        if (lintResult.findings.length > 0) {
          const findingsTable = new Table({
            head: [
              chalk.cyan('Severity'),
              chalk.cyan('Rule'),
              chalk.cyan('Target'),
              chalk.cyan('Finding & Remediation'),
            ],
            colWidths: [12, 12, 24, 52],
            wordWrap: true,
          });

          for (const f of lintResult.findings) {
            const sevBadge =
              f.severity === 'error'
                ? chalk.red.bold('ERROR')
                : f.severity === 'warning'
                ? chalk.yellow.bold('WARN')
                : chalk.cyan('INFO');
            const target = f.toolName ? chalk.bold(f.toolName) : chalk.gray('(page)');
            const messageText = `${f.message}${
              f.suggestion ? '\n' + chalk.gray('↳ ' + f.suggestion) : ''
            }`;
            findingsTable.push([sevBadge, chalk.bold(f.ruleId), target, messageText]);
          }

          console.log(findingsTable.toString());
        } else {
          console.log(chalk.green('\n✔ No lint findings or rule violations detected!'));
        }
      }

      if (readinessReport) {
        console.log('\n' + chalk.bold.underline('WebMCP AI Readiness Score:'));
        console.log(
          `  ${chalk.bold('Overall Score:')}           ${chalk.bold(
            readinessReport.overallScore.toString() + '/100'
          )}  [Grade ${getGradeBadge(readinessReport.grade)}]  ${
            readinessReport.passed ? chalk.green.bold('✔ PASSED') : chalk.red.bold('✖ FAILED')
          }`
        );
        console.log(
          `  ${chalk.bold('Pass Threshold:')}          Score ≥ ${
            failUnderThreshold !== undefined ? chalk.bold(failUnderThreshold.toString()) : '80 (default)'
          }`
        );

        const scoreTable = new Table({
          head: [
            chalk.cyan('Category'),
            chalk.cyan('Weight'),
            chalk.cyan('Raw Score'),
            chalk.cyan('Weighted'),
            chalk.cyan('Errors'),
            chalk.cyan('Warnings'),
            chalk.cyan('Info'),
          ],
          colWidths: [20, 10, 13, 13, 10, 11, 8],
        });

        for (const [cat, data] of Object.entries(readinessReport.categories) as [string, any][]) {
          const catLabel = cat
            .split('-')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          scoreTable.push([
            catLabel,
            `${data.weight}%`,
            `${data.score}/100`,
            `${data.weightedScore.toFixed(1)} / ${data.weight}`,
            data.findingsCount.errors > 0 ? chalk.red(data.findingsCount.errors) : chalk.gray('0'),
            data.findingsCount.warnings > 0 ? chalk.yellow(data.findingsCount.warnings) : chalk.gray('0'),
            data.findingsCount.info > 0 ? chalk.cyan(data.findingsCount.info) : chalk.gray('0'),
          ]);
        }

        console.log(scoreTable.toString());
      }

      if (result.scanErrors.length > 0) {
        console.log('\n' + chalk.red.bold('Scan Warnings / Errors:'));
        for (const err of result.scanErrors) {
          console.log(`  ${chalk.red('⚠')} ${err}`);
        }
      }

      if (
        failUnderThreshold !== undefined &&
        readinessReport &&
        readinessReport.overallScore < failUnderThreshold
      ) {
        console.log(
          chalk.red.bold(
            `\n✖ Readiness score (${readinessReport.overallScore}) is below threshold (--fail-under ${failUnderThreshold}). Exiting with code 1.`
          )
        );
        process.exit(1);
      }

      console.log('');
    } catch (err: any) {
      spinner.fail(`Failed to scan ${url}`);
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program.parse(process.argv);
