const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, cwd) {
  console.log('>', cmd, cwd ? `(in ${cwd})` : '');
  execSync(cmd, { cwd: cwd || process.cwd(), stdio: 'inherit' });
}

const distDir = path.join(process.cwd(), 'dist');

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

run(`git push -f ${repoUrl} master:gh-pages`, distDir);

console.log('Deployed successfully to gh-pages!');
