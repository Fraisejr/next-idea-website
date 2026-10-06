# Inspiraeon SL website

A static company website presenting Inspiraeon SL’s management consulting, business process automation with AI agents, iOS apps, and Microsoft Power Apps services. There are no web app, authentication, CloudKit, or Google Calendar integrations.

## Development

```sh
npm install
npm run dev
```

## Checks and build

```sh
npm run lint
npm run build
```

The production build exports the website to `out/` for static hosting. `/privacy` and `/terms` provide website information. The legacy `/support` URL also shows company information. Removed web app, authentication, and tutorial URLs return 404.

No email addresses, product listings, or App Store links are published. The company name is Inspiraeon SL; no address or registration number has been invented.

## HostGator hosting

Upload the contents of `out/` to the document root assigned to `inspiraeon.com`. The build uses directory-style URLs so `/privacy/` and `/terms/` work on Apache without application routing. Preserve a backup of existing files and server configuration before replacing them.

The build includes `public/.htaccess`, which sets `index.html` as the directory index, uses the local `/404.html` error page, and returns HTTP 410 for the retired `nextapps.org` domain. Include hidden files when uploading. Apache must be able to read `.htaccess`: use file permissions `644` and directory permissions `755`. Keep the package outside the public document root after extraction.
