const fs = require('fs');
const path = require('path');
const { generate } = require('./generator');
const { exportPrompt } = require('./exporters');

function printUsage() {
  console.log(`
Usage: prompt-architect [options]

Options:
  --agent <cursor|deepseek|kimi|claude|gpt|generic>   Target agent (default: generic)
  --domain <lab-build|code-review|security|feature-exploration|release-readiness>  Domain (default: general)
  --task <text>                                     Brief task description
  --context <text>                                  Additional context
  --constraints <text>                              Constraints to enforce
  --format <markdown|json|table|code|diagram>       Desired prompt output format (default: markdown)
  --tone <professional|casual|strict>               Tone (default: professional)
  --examples                                        Include examples
  --export <cursorrules|opencode|opencode-jsonc|vscode|antigravity|markdown>  Export format
  --name <filename>                               Output file name without extension
  --out <dir>                                       Output directory (default: ./out)
  --serve                                           Start the web UI server
  --help                                            Show this help

Examples:
  prompt-architect --agent cursor --domain security --task "Review API key handling" --export cursorrules --out ./
  prompt-architect --serve
`);
}

function parseArgs(argv) {
  const args = { outputFormat: 'markdown', agent: 'generic', domain: 'general', tone: 'professional', out: './out', name: 'generated-prompt' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--agent': args.agent = argv[++i]; break;
      case '--domain': args.domain = argv[++i]; break;
      case '--task': args.task = argv[++i]; break;
      case '--context': args.context = argv[++i]; break;
      case '--constraints': args.constraints = argv[++i]; break;
      case '--format': args.outputFormat = argv[++i]; break;
      case '--tone': args.tone = argv[++i]; break;
      case '--examples': args.includeExamples = true; break;
      case '--export': args.export = argv[++i]; break;
      case '--name': args.name = argv[++i]; break;
      case '--out': args.out = argv[++i]; break;
      case '--serve': args.serve = true; break;
      case '--help': args.help = true; break;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.serve) {
    require('./server');
    return;
  }

  const prompt = generate(args);

  if (args.export) {
    const { ext, content } = exportPrompt(prompt, args.export, args.name);
    const outDir = path.resolve(args.out);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const safeName = String(args.name || 'generated-prompt').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(outDir, `${safeName}${ext}`);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Generated ${args.export} file: ${filePath}`);
  }

  console.log('\n--- Generated Prompt ---\n');
  console.log(prompt);
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs, main };
