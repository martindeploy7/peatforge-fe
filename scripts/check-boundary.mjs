import assert from 'node:assert/strict';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const withinRoot = (target) => target === root.slice(0, -1) || target.startsWith(root);
const sourceExtensions = /\.(?:[cm]?[jt]sx?|css|html|json)$/;

export function validateSpecifier(specifier, filename) {
  assert(!specifier.includes('netlify-decision-chain'), `${filename}: forbidden source reference`);
  assert(!/(?:^|[\\/])web(?:[\\/]|$)/.test(specifier), `${filename}: forbidden source reference`);
  if (specifier.startsWith('.')) {
    assert(withinRoot(path.resolve(path.dirname(filename), specifier)), `${filename}: import escapes project`);
  }
  assert(!path.isAbsolute(specifier) && !specifier.startsWith('file:'), `${filename}: absolute source reference`);
}

export async function checkBoundary() {
  let filesChecked = 0;
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git', 'evidence', 'playwright-report', 'test-results'].includes(entry.name)) continue;
      const filename = path.join(directory, entry.name);
      assert(!(await lstat(filename)).isSymbolicLink(), `${filename}: symlinks are forbidden`);
      assert(withinRoot(await realpath(filename)), `${filename}: path escapes project`);
      if (entry.isDirectory()) await walk(filename);
      else if (sourceExtensions.test(entry.name) && !filename.endsWith('package-lock.json')) {
        filesChecked += 1;
        const source = await readFile(filename, 'utf8');
        if (/\.[cm]?[jt]sx?$/.test(filename)) {
          const syntax = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
          const visit = (node) => {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
              validateSpecifier(node.moduleSpecifier.text, filename);
            }
            if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
              const argument = node.arguments[0];
              assert(argument && ts.isStringLiteral(argument), `${filename}: computed source import cannot be audited`);
              validateSpecifier(argument.text, filename);
            }
            ts.forEachChild(node, visit);
          };
          visit(syntax);
        }
        if (/\.css$/.test(filename)) {
          for (const match of source.matchAll(/(?:@import\s+|url\(\s*)["']?([^\s"')]+)/g)) {
            if (!/^(?:https?:|data:|#)/.test(match[1])) validateSpecifier(match[1], filename);
          }
        }
      }
    }
  };
  await walk(root);
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const [name, version] of Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
    assert(!/^(?:file:|link:|workspace:|\.\.?\/|\/)/.test(version), `${name}: dependencies must be independently registry-installed`);
  }
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  for (const [name, dependency] of Object.entries(lock.packages)) {
    assert(!dependency.link, `${name}: linked dependencies are forbidden`);
    if (dependency.resolved) assert(dependency.resolved.startsWith('https://registry.npmjs.org/'), `${name}: non-registry dependency`);
  }
  return filesChecked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Source boundary passed: ${await checkBoundary()} project files, registry dependencies only.`);
}
