@echo off
cd /d "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "seo: implement rich metadata, software schema, robots.txt, and sitemaps (v2.1.1)"
git push origin main
git tag -d v2.1.1 2>nul
git push origin :refs/tags/v2.1.1 2>nul
git tag v2.1.1
git push origin v2.1.1
npx vercel --prod --yes
