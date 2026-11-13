# Custody Calendar

Custody Calendar is a browser-based calendar for tracking parenting schedules, handoffs, holidays, and days off. It opens in a full-month view on phones and desktops, with week and day views for more detail.

## Features

- **Regular schedules.** Set a weekly rotation or alternate between two weekly templates. Give each child their own schedule and handoff time.
- **Holidays and schedule changes.** Assign holidays by year and time, and enter one-time swaps or trips. One-time changes take priority over holidays, followed by the regular schedule.
- **Days off.** Mark school closures, work days off, and vacations without changing custody assignments. Add a single day or a range, repeat it annually, and apply it to selected children or all children.
- **Printable months.** Print the selected child's month or save it as a PDF from the browser print dialog.
- **Backups.** Export selected children's schedules as a PNG backup and restore from a Custody Calendar PNG or JSON backup.
- **Offline use.** The app can work offline after its files have been cached. Browsers that support web app installation can add it to the home screen or desktop.

- ## Try it now
- [Open Custody Calendar](https://cs06.github.io/custody-calendar/)
- Install it from your browser using the install instructions below.

## Run locally

The app uses plain HTML, CSS, and JavaScript. It needs a static web server and has no build step. If Python is installed, run this command from the project folder:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open [http://localhost:8000](http://localhost:8000) and follow the setup prompts. Use **Settings → Help** for guidance on rotations, exceptions, days off, printing, and backups. For deployment, serve the project files from an HTTPS static host.

## Install the app

Open the published app on GitHub Pages or another HTTPS host.

- **Chrome or Edge:** Use the browser's install option in the address bar or menu, when available.
- **iPhone or iPad:** Open the app in Safari, tap **Share**, then choose **Add to Home Screen**. If you see **Open as Web App**, leave it on.

If you've already set up a schedule, export a PNG backup before installing. The iPhone or iPad Home Screen app can use separate storage from Safari. If the installed app opens at setup, import the backup there to bring over your schedule.

## Data and backups

Schedules are stored in the browser and do not sync across devices. Export a backup before clearing browser data or moving to another device. Keep exported PNGs private because they contain schedule data beyond the visible image.

When restoring schedules, **Merge** adds the backup's children as new entries and keeps existing ones. **Replace all** replaces the existing children and their schedules.

## Regression checks

With Node.js installed, run:

```sh
node tests/regression.cjs
```

## License

The Custody Calendar app code is licensed under [Zero-Clause BSD (0BSD)](LICENSE).
The bundled meta-png library is licensed separately under the ISC License. See [Third-Party Licenses](LICENSES.md).
