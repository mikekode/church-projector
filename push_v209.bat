@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "security: implement CSP and session-based license validation (v2.0.9)"
git push origin main
git tag -d v2.0.9 2>nul
git push origin :refs/tags/v2.0.9 2>nul
git tag v2.0.9
git push origin v2.0.9
npx vercel --prod --yes
