# How to Push Creenly to GitHub

## Prerequisites
- You need a GitHub account.
- You should have `git` installed on your machine.

## Steps

1.  **Initialize Git Repository (if not already done)**
    Open your terminal in the `church-projector` folder:
    ```bash
    git init
    ```

2.  **Add Your Files**
    Stage all your changes:
    ```bash
    git add .
    ```

3.  **Commit Changes**
    Save the current state:
    ```bash
    git commit -m "feat: Add Stage Display, Motion Backgrounds, Digital Signage, and MIDI Control"
    ```

4.  **Create a New Repository on GitHub**
    - Go to [github.com/new](https://github.com/new).
    - Name your repository (e.g., `creenly-app`).
    - Choose Public or Private.
    - Do **not** initialize with README, .gitignore, or License (you already have them).
    - Click **Create repository**.

5.  **Connect Local Reposotory to GitHub**
    Copy the "HTTPS" URL provided by GitHub (e.g., `https://github.com/StartUpFounder/creenly-app.git`).
    Run this command (replace the URL):
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/creenly-app.git
    ```

6.  **Push to GitHub**
    Upload your code:
    ```bash
    git branch -M main
    git push -u origin main
    ```

## Future Updates
When you make more changes:
```bash
git add .
git commit -m "Description of changes"
git push
```
