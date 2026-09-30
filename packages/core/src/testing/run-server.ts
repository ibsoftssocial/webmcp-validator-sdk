import { startMockServer } from './mock-server.js';

const PORT = parseInt(process.env.PORT || '3456', 10);

async function main() {
  const server = await startMockServer({ port: PORT, host: '127.0.0.1' });

  console.log('\n======================================================');
  console.log(`🚀 WebMCP Mock Test Server is running at: ${server.url}`);
  console.log('======================================================');
  console.log(`  - Perfect WebMCP:     ${server.getUrl('/perfect')}`);
  console.log(`  - Malformed WebMCP:   ${server.getUrl('/malformed')}`);
  console.log(`  - Declarative WebMCP: ${server.getUrl('/declarative')}`);
  console.log(`  - Legacy Site:        ${server.getUrl('/legacy')}`);
  console.log(`  - Delayed SPA:        ${server.getUrl('/delayed')}`);
  console.log(`  - llms.txt:           ${server.getUrl('/llms.txt')}`);
  console.log(`  - MCP Manifest:       ${server.getUrl('/.well-known/mcp.json')}`);
  console.log('======================================================');
  console.log('Press Ctrl + C to stop the server.\n');

  process.on('SIGINT', async () => {
    console.log('\nStopping WebMCP Mock Server...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start mock server:', err);
  process.exit(1);
});
