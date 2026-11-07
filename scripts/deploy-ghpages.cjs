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
run('git add -A', distDir);
run('git commit -m "deploy: v1.065 with multi-space venue aggregation and space tabs"', distDir);
run('git push -f https://github.com/ped-84/anti-gallery.git master:gh-pages', distDir);

console.log('Deployed successfully to gh-pages!');
