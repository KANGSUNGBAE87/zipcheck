import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const skipDist = args.has('--skip-dist');
const maxBundleBytes = 100 * 1024 * 1024;

const requiredFiles = [
  'docs/apps-in-toss-release-readiness.md',
  'docs/privacy-and-data-retention.md',
  'docs/supabase-toss-setup.md',
  'granite.config.ts',
  'platform.md',
  'test.md',
  'supabase/functions/zipcheck-toss-login/index.ts',
];

const forbiddenDistTokens = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'TOSS_LOGIN_TOKEN_EXCHANGE_URL',
  'TOSS_DISCONNECT_CALLBACK_SECRET',
  'APPS_IN_TOSS_CONSOLE_API_KEY',
  'DEEPSEEK_API_KEY',
];

const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const exists = (path) => existsSync(resolve(root, path));

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`missing required file: ${file}`);
}

const packageJson = JSON.parse(read('package.json'));
for (const scriptName of ['typecheck', 'test', 'build', 'preflight:apps-in-toss']) {
  if (!packageJson.scripts?.[scriptName]) failures.push(`missing package script: ${scriptName}`);
}

if (packageJson.scripts?.['preflight:apps-in-toss'] !== 'node scripts/apps-in-toss-preflight.mjs') {
  failures.push('preflight:apps-in-toss must run node scripts/apps-in-toss-preflight.mjs');
}

const browserEnv = read('.env.example');
for (const forbidden of forbiddenDistTokens) {
  if (new RegExp(`^${forbidden}=`, 'm').test(browserEnv)) {
    failures.push(`browser env example must not define server-only secret: ${forbidden}`);
  }
}

if (exists('.env.server.example')) {
  const serverEnv = read('.env.server.example');
  for (const expected of [
    'TOSS_LOGIN_TOKEN_EXCHANGE_URL=',
    'TOSS_DISCONNECT_CALLBACK_SECRET=',
    'TOSS_DISCONNECT_CALLBACK_BASIC_USERNAME=',
    'TOSS_DISCONNECT_CALLBACK_BASIC_PASSWORD=',
    'TOSS_USER_KEY_HASH_SECRET=',
    'ZIPCHECK_ALLOWED_ORIGINS=',
    'APPS_IN_TOSS_CONSOLE_API_KEY=',
  ]) {
    if (!serverEnv.includes(expected)) failures.push(`server env example missing ${expected}`);
  }
}

if (exists('granite.config.ts')) {
  const graniteConfig = read('granite.config.ts');
  if (/icon:\s*['"]\s*['"]/.test(graniteConfig)) failures.push('granite.config.ts brand.icon must not be empty');
  if (/host:\s*['"]localhost['"]/.test(graniteConfig)) failures.push('granite.config.ts web.host must not be hard-coded to localhost');
  for (const token of ['APPS_IN_TOSS_WEB_HOST', 'APPS_IN_TOSS_ICON_URL', 'zipcheck-icon.svg']) {
    if (!graniteConfig.includes(token)) failures.push(`granite.config.ts missing release config token: ${token}`);
  }
}

if (exists('docs/apps-in-toss-release-readiness.md')) {
  const releaseDoc = read('docs/apps-in-toss-release-readiness.md');
  for (const token of ['repo-complete', 'Owner-gated', 'hard gate for upload', 'TOSS_LOGIN_TOKEN_EXCHANGE_URL', '.ait', 'QR']) {
    if (!releaseDoc.includes(token)) failures.push(`release readiness doc missing token: ${token}`);
  }
}

if (exists('supabase/functions/zipcheck-toss-login/index.ts')) {
  const edgeFunction = read('supabase/functions/zipcheck-toss-login/index.ts');
  for (const token of [
    'TossDisconnectReason',
    'UNLINK',
    'WITHDRAWAL_TERMS',
    'WITHDRAWAL_TOSS',
    'TOSS_DISCONNECT_CALLBACK_SECRET',
    'TOSS_DISCONNECT_CALLBACK_BASIC_USERNAME',
    'TOSS_DISCONNECT_CALLBACK_BASIC_PASSWORD',
    'TOSS_USER_KEY_HASH_SECRET',
    'userKey',
    'providerSubjectHash',
    'existingProviderMetadata',
    '...existingProviderMetadata',
    'clearZipcheckUserData',
  ]) {
    if (!edgeFunction.includes(token)) failures.push(`Edge Function missing disconnect guardrail: ${token}`);
  }
  if (/provider_subject:\s*userKey/.test(edgeFunction)) {
    failures.push('Edge Function must not store raw Toss userKey as provider_subject');
  }
}

const walkFiles = (dir) => {
  const entries = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walkFiles(path));
    else entries.push({ path, size: stat.size });
  }
  return entries;
};

if (!skipDist) {
  const distDir = resolve(root, 'dist');
  if (!existsSync(distDir)) {
    failures.push('dist/ is missing; run npm run build before release preflight');
  } else {
    const distFiles = walkFiles(distDir);
    const totalBytes = distFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxBundleBytes) {
      failures.push(`dist/ size ${totalBytes} exceeds Apps in Toss unpacked 100MB limit`);
    }
    const textFilePattern = /\.(html|js|css|json|txt|map|svg)$/i;
    for (const file of distFiles.filter((entry) => textFilePattern.test(entry.path))) {
      const content = readFileSync(file.path, 'utf8');
      for (const token of forbiddenDistTokens) {
        if (content.includes(token)) failures.push(`dist leak candidate ${token} in ${file.path}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Apps in Toss preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Apps in Toss preflight passed');
