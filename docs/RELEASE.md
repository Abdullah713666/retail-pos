# How to make a Windows installer (simple guide)

The installer is built for you by GitHub. You do not need Windows to build it.

## One-time setup
1. Make a free account at github.com and sign in.
2. Click **New repository**. Name it `retail-pos`, choose **Private**, and click Create. Do not add a README.
3. In the terminal, inside the project folder, run (replace YOUR-NAME):
   ```
   git remote add origin https://github.com/YOUR-NAME/retail-pos.git
   git branch -M main
   git push -u origin main
   ```
   GitHub will ask you to sign in the first time.

## Make a release
1. Check `"version"` in `package.json` (for example `0.1.0`).
2. Run:
   ```
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. On GitHub open the **Actions** tab. Click the newest run "Build Windows Installer". It takes about 5-10 minutes. A green tick means success.
4. Scroll down to **Artifacts** and download `retail-pos-windows-installer`. Unzip it. Inside is `Retail-POS-Setup-0.1.0.exe`.
5. You can also run it by hand: Actions tab, "Build Windows Installer", **Run workflow**.

For the next release, change the version (for example `0.1.1`), commit, then tag `v0.1.1` and push the tag.

## Windows warning (normal)
The installer is not signed yet, so Windows shows a blue "Windows protected your PC" screen.
Click **More info**, then **Run anyway**. This is expected for now.

## Where the shop data lives
Data and backups are in the Windows user folder (`%APPDATA%\Retail POS`), not in the install folder.
Uninstalling or installing a new version does not delete the data.

## Test checklist (do this on a Windows 10 PC)
- [ ] Install the .exe (More info, Run anyway). Choose the folder. Desktop shortcut and Start menu entry appear.
- [ ] Open the app. The setup wizard appears. Finish it (shop name, owner PIN).
- [ ] Add a few items (or import `resources/sample-items.csv`).
- [ ] Make a sale. Check the stock goes down.
- [ ] Print a receipt on the real printer.
- [ ] Make a backup (Settings). Check the backup file exists.
- [ ] Close the app, open again. Your data is still there.
- [ ] Uninstall from Windows Settings, Apps.
- [ ] Install again. Open the app. The items and sales are still there (data kept).
- [ ] Write down anything slow or broken and send it to Claude.
