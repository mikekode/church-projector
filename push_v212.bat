@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "fix: resolve projector white screen, mic toggle latency, and mobile scaling (v2.1.2)"
git push origin main
git tag -d v2.1.2 2>nul
git push origin :refs/tags/v2.1.2 2>nul
git tag v2.1.2
git push origin v2.1.2
npx vercel --prod --yes
