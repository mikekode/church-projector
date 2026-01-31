@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "fix: resolve packaged white screen via relative path engineering (v2.1.3)"
git push origin main
git tag -d v2.1.3 2>nul
git push origin :refs/tags/v2.1.3 2>nul
git tag v2.1.3
git push origin v2.1.3
npx vercel --prod --yes
