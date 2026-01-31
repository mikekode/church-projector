@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "feat: release v2.1.6 with trust-builder and path hardening"
git push origin main
git tag -d v2.1.6 2>nul
git push origin :refs/tags/v2.1.6 2>nul
git tag v2.1.6
git push origin v2.1.6
npx vercel --prod --yes
