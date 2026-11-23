const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, cwd) {
  console.log('>', cmd, cwd ? `(in ${cwd})` : '');
  execSync(cmd, { cwd: cwd || process.cwd(), stdio: 'inherit' });
}

const distDir = path.join(process.cwd(), 'dist');

// Keep the frozen copies (e.g. v1.168) that live next to the preview on gh-pages.
// This script force-pushes a fresh gh-pages, which would otherwise delete them.
const KEEP_DIRS = ['v1.168'];
{
  const tmp = path.join(require('os').tmpdir(), 'ag-ghpages-keep');
  fs.rmSync(tmp, { recursive: true, force: true });
  try {
    execSync(`git clone --depth 1 --branch gh-pages https://github.com/ped-84/anti-gallery.git "${tmp}"`, { stdio: 'inherit' });
    for (const d of KEEP_DIRS) {
      const src = path.join(tmp, d);
      if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(distDir, d), { recursive: true });
        console.log('Preserved frozen copy:', d);
      }
    }
  } catch (e) {
    console.warn('Could not read existing gh-pages to preserve frozen copies:', e.message);
  }
}

// Ensure dist/.git is fresh to avoid dirty index or no-op commit errors
const gitDir = path.join(distDir, '.git');
if (fs.existsSync(gitDir)) {
  fs.rmSync(gitDir, { recursive: true, force: true });
}

// Ensure .nojekyll exists
const nojekyllPath = path.join(distDir, '.nojekyll');
if (!fs.existsSync(nojekyllPath)) {
  fs.writeFileSync(nojekyllPath, '');
  console.log('Created .nojekyll in dist');
}

run('git init', distDir);
run('git config user.email "deploy@artgasht.com"', distDir);
run('git config user.name "Artgasht Deploy Bot"', distDir);
run('git add -A', distDir);
run('git commit -m "deploy: update gh-pages build"', distDir);

const repoUrl = process.env.GITHUB_TOKEN
  ? `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/ped-84/anti-gallery.git`
  : 'https://github.com/ped-84/anti-gallery.git';

run(`git push -f ${repoUrl} HEAD:gh-pages`, distDir);

console.log('Deployed successfully to gh-pages!');
