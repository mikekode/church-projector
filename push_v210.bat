@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "security: implement hardware binding and production lockdown (v2.1.0)"
git push origin main
git tag -d v2.1.0 2>nul
git push origin :refs/tags/v2.1.0 2>nul
git tag v2.1.0
git push origin v2.1.0
npx vercel --prod --yes
