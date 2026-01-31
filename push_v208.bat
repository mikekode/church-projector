@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "fix: resolve blank secondary screens, missing logo, and incorrect taskbar icons (v2.0.8)"
git push origin main
git tag -d v2.0.8 2>nul
git push origin :refs/tags/v2.0.8 2>nul
git tag v2.0.8
git push origin v2.0.8
npx vercel --prod --yes
