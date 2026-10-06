# Inspiraeon SL website

A static company website presenting Inspiraeon SL’s consulting services and iOS app development. There are no web app, authentication, CloudKit, or Google Calendar integrations.

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
