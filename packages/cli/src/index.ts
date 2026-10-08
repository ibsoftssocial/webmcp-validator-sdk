import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import {
  scanUrl,
  lintWebMCP,
  calculateReadinessScore,
  GradeRating,
  generateReport,
  saveReportToFile,
  inferReportFormat,
  ReportFormat,
  batchAudit,
  generateBatchReport,
  saveBatchReportToFile,
} from 'webmcp-validator-sdk';

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
  .option('-o, --output <file>', 'Save output report to file (json, md, html, sarif, or xml)')
  .option('--format <type>', 'Output format: pretty, json, markdown, html, sarif, junit', 'pretty')
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

      // Save report to file if -o / --output specified
      if (options.output) {
        if (readinessReport) {
          const outFormat: ReportFormat =
            options.format && options.format !== 'pretty'
              ? (options.format as ReportFormat)
              : inferReportFormat(options.output);
          await saveReportToFile(readinessReport, options.output, { format: outFormat });
        } else {
          const resolvedPath = path.resolve(options.output);
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, JSON.stringify(result, null, 2), 'utf8');
        }
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

      if (options.format === 'markdown' || options.format === 'md') {
        if (readinessReport) {
          console.log(generateReport(readinessReport, 'markdown'));
        }
        if (
          failUnderThreshold !== undefined &&
          readinessReport &&
          readinessReport.overallScore < failUnderThreshold
        ) {
          process.exit(1);
        }
        return;
      }

      if (options.format === 'html') {
        if (readinessReport) {
          console.log(generateReport(readinessReport, 'html'));
        }
        if (
          failUnderThreshold !== undefined &&
          readinessReport &&
          readinessReport.overallScore < failUnderThreshold
        ) {
          process.exit(1);
        }
        return;
      }

      if (options.format === 'sarif') {
        if (readinessReport) {
          console.log(generateReport(readinessReport, 'sarif'));
        }
        if (
          failUnderThreshold !== undefined &&
          readinessReport &&
          readinessReport.overallScore < failUnderThreshold
        ) {
          process.exit(1);
        }
        return;
      }

      if (options.format === 'junit' || options.format === 'xml') {
        if (readinessReport) {
          console.log(generateReport(readinessReport, 'junit'));
        }
        if (
          failUnderThreshold !== undefined &&
          readinessReport &&
          readinessReport.overallScore < failUnderThreshold
        ) {
          process.exit(1);
        }
        return;
      }

      // If running inside GitHub Actions CI, automatically export Markdown summary to GITHUB_STEP_SUMMARY
      if (process.env.GITHUB_STEP_SUMMARY && readinessReport) {
        try {
          const stepSummaryMarkdown = generateReport(readinessReport, 'markdown');
          await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummaryMarkdown + '\n', 'utf8');
        } catch {}
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
      const countableTools = result.tools.filter(
        (t) => t.source === 'imperative' || t.source === 'declarative'
      );
      console.log(`  ${chalk.bold('Total Tools Discovered:')}     ${chalk.bold(countableTools.length.toString())}`);

      if (countableTools.length > 0) {
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

        for (const tool of countableTools) {
          let sourceBadge = chalk.blue('imperative');
          if (tool.source === 'declarative') {
            sourceBadge = chalk.yellow('declarative');
          }
          table.push([
            chalk.bold(tool.name),
            sourceBadge,
            tool.description || chalk.gray('(No description)'),
            tool.annotations?.readOnlyHint ? chalk.green('Yes') : chalk.gray('No'),
            (tool.annotations?.consequentialHint || tool.annotations?.confirmationHint) ? chalk.yellow('Yes') : chalk.gray('No'),
          ]);
        }

        console.log(table.toString());
      } else {
        console.log(chalk.yellow('\nℹ No imperative or declarative WebMCP tools were discovered on this page.'));
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

        console.log('\n' + chalk.bold.underline('AI Readiness Checklist Breakdown:'));
        for (const [catName, cat] of Object.entries(readinessReport.categories) as [string, any][]) {
          if (cat.checklist && cat.checklist.length > 0) {
            const catTitle =
              cat.title ||
              catName
                .split('-')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            console.log(`\n  ${chalk.bold(catTitle)} ${chalk.cyan(`(${cat.weightedScore.toFixed(0)}/${cat.weight} pts)`)}:`);
            for (const item of cat.checklist) {
              const checkMark = item.passed ? chalk.green('✔') : chalk.red('✖');
              const pointsBadge = item.passed
                ? chalk.green(`[+${item.points} pts]`)
                : chalk.red(`[0/${item.maxPoints} pts]`);
              const detailStr = item.details ? chalk.gray(` (${item.details})`) : '';
              console.log(`    ${checkMark} ${item.name.padEnd(32)} ${pointsBadge}${detailStr}`);
            }
          }
        }
      }

      if (options.output) {
        console.log(chalk.green(`\n✔ Audit report saved to ${chalk.bold(options.output)}`));
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

program
  .command('batch')
  .description('Audit multiple websites or an entire sitemap concurrently with aggregated scoring')
  .argument('[urls...]', 'Target website URLs to scan')
  .option('--sitemap <url>', 'Sitemap XML URL to crawl and audit discovered page URLs')
  .option('-f, --file <path>', 'Read URLs from a text file (one URL per line)')
  .option('-c, --concurrency <number>', 'Concurrent browser workers (default: 3)', '3')
  .option('-l, --limit <number>', 'Maximum number of pages to audit (default: 25)', '25')
  .option('-t, --timeout <ms>', 'Timeout per page in milliseconds', '15000')
  .option('-m, --mobile', 'Emulate mobile device viewport and user-agent')
  .option('--block-media', 'Block images, media, and fonts to accelerate scans')
  .option('-o, --output <file>', 'Save output report to file (json, md, sarif, or xml)')
  .option('--format <type>', 'Output format: pretty, json, markdown, sarif, junit', 'pretty')
  .option('--fail-under <score>', 'Exit with code 1 if site-wide average score is below threshold')
  .action(async (cliUrls: string[], options: any) => {
    const urls: string[] = [...cliUrls];

    if (options.file) {
      try {
        const fileContent = await fs.readFile(path.resolve(options.file), 'utf8');
        const lines = fileContent
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('#'));
        urls.push(...lines);
      } catch (err: any) {
        console.error(chalk.red(`Error reading URLs file ${options.file}: ${err.message}`));
        process.exit(1);
      }
    }

    if (urls.length === 0 && !options.sitemap) {
      console.error(chalk.red('Error: No target URLs provided. Specify URLs as arguments, via --file <path>, or via --sitemap <url>.'));
      process.exit(1);
    }

    const concurrency = parseInt(options.concurrency, 10) || 3;
    const limit = parseInt(options.limit, 10) || 25;
    const timeoutMs = parseInt(options.timeout, 10) || 15000;
    const failUnderThreshold = options.failUnder ? parseInt(options.failUnder, 10) : undefined;
    const isPretty = !options.format || options.format === 'pretty';

    const spinner = isPretty ? ora('Starting WebMCP batch audit...').start() : null;

    try {
      const result = await batchAudit({
        urls,
        sitemapUrl: options.sitemap,
        concurrency,
        limit,
        failUnder: failUnderThreshold,
        scannerOptions: {
          timeoutMs,
          isMobile: !!options.mobile,
          blockMedia: !!options.blockMedia,
        },
        onProgress: (p) => {
          if (!spinner) return;
          if (p.status === 'scanning') {
            spinner.text = `[${p.completed}/${p.total}] Scanning ${chalk.cyan(p.currentUrl)}...`;
          } else if (p.status === 'passed') {
            spinner.text = `[${p.completed}/${p.total}] ✔ ${chalk.green(p.currentUrl)} (${p.score}/100)`;
          } else if (p.status === 'failed') {
            spinner.text = `[${p.completed}/${p.total}] ⚠ ${chalk.yellow(p.currentUrl)} (${p.score}/100)`;
          } else {
            spinner.text = `[${p.completed}/${p.total}] ✖ ${chalk.red(p.currentUrl)}`;
          }
        },
      });

      if (spinner) {
        spinner.succeed(`Batch audit completed: ${result.successfulAudits} of ${result.totalUrls} pages scanned in ${(result.durationMs / 1000).toFixed(2)}s`);
      }

      // Save report to file if -o / --output specified
      if (options.output) {
        const outFormat: ReportFormat =
          options.format && options.format !== 'pretty'
            ? (options.format as ReportFormat)
            : inferReportFormat(options.output);
        await saveBatchReportToFile(result, options.output, { format: outFormat });
      }

      // If running inside GitHub Actions, append markdown report to GITHUB_STEP_SUMMARY
      if (process.env.GITHUB_STEP_SUMMARY) {
        try {
          const stepSummaryMarkdown = generateBatchReport(result, 'markdown');
          await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummaryMarkdown + '\n', 'utf8');
        } catch {}
      }

      // Format stdout output
      if (options.format === 'json') {
        console.log(generateBatchReport(result, 'json'));
      } else if (options.format === 'markdown' || options.format === 'md') {
        console.log(generateBatchReport(result, 'markdown'));
      } else if (options.format === 'html') {
        console.log(generateBatchReport(result, 'html'));
      } else if (options.format === 'sarif') {
        console.log(generateBatchReport(result, 'sarif'));
      } else if (options.format === 'junit' || options.format === 'xml') {
        console.log(generateBatchReport(result, 'junit'));
      } else {
        console.log(generateBatchReport(result, 'pretty'));
      }

      if (options.output && isPretty) {
        console.log(chalk.green(`\n✔ Batch audit report saved to ${chalk.bold(options.output)}`));
      }

      if (
        failUnderThreshold !== undefined &&
        result.averageScore < failUnderThreshold
      ) {
        console.log(
          chalk.red.bold(
            `\n✖ Site-wide average score (${result.averageScore}) is below threshold (--fail-under ${failUnderThreshold}). Exiting with code 1.`
          )
        );
        process.exit(1);
      }

      process.exit(0);
    } catch (err: any) {
      if (spinner) {
        spinner.fail('Batch audit failed');
      }
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program.parse(process.argv);
