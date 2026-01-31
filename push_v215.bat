@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "fix: resolve packaged UI white screen via Javascript path hardening (v2.1.5)"
git push origin main
git tag -d v2.1.5 2>nul
git push origin :refs/tags/v2.1.5 2>nul
git tag v2.1.5
git push origin v2.1.5
npx vercel --prod --yes
