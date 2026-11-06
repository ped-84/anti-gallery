const { execSync } = require('child_process');
const path = require('path');

function run(cmd, cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: cwd || process.cwd(), stdio: 'inherit' });
}

try {
  run('git add .');
  run('git commit -m "feat: replace native select with ClayDropdown and clean nbsp from addresses (v1.055)"');
  run('git push origin main');

  const distDir = path.join(process.cwd(), 'dist');
  run('git init', distDir);
  run('git add -A', distDir);
  run('git commit -m "deploy: v1.055"', distDir);
  run('git push -f https://github.com/ped-84/anti-gallery.git master:gh-pages', distDir);

  console.log('Successfully deployed to gh-pages!');
} catch (err) {
  console.error('Deployment error:', err.message);
  process.exit(1);
}
