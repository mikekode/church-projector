@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "fix(build): fix next/font assetPrefix error and improve relative pathing for v2.0.7"
git push origin main
git tag -d v2.0.4 2>nul
git tag -d v2.0.5 2>nul
git tag -d v2.0.6 2>nul
git tag -d v2.0.7 2>nul
git push origin :refs/tags/v2.0.4 2>nul
git push origin :refs/tags/v2.0.5 2>nul
git push origin :refs/tags/v2.0.6 2>nul
git push origin :refs/tags/v2.0.7 2>nul
git tag v2.0.7
git push origin v2.0.7
npx vercel --prod --yes
