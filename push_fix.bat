cd "c:\Users\MICHAEL\Scale AX W.Space1 (DOE)\webapp\church-projector"
git add .
git commit -m "fix(build): final fix for blank screen and v2.0.4"
git push origin main
git tag -d v2.0.4
git push origin :refs/tags/v2.0.4
git tag v2.0.4
git push origin v2.0.4
pause
