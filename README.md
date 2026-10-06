# Inspiraeon SL website

A static company website presenting Inspiraeon SL and the native Next Idea app. There are no web app, authentication, CloudKit, or Google Calendar integrations.

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

The production build exports the website to `out/` for static hosting. Existing `/support`, `/tutorials`, `/privacy`, and `/terms` URLs are retained. Removed `/app` and authentication URLs return 404.

## Company information

The public contact email is currently the existing Next Idea support address. Before submitting the website to Apple, confirm the company name and email, and add any registered company details you want to publish to the contact section in `src/app/page.tsx`. No address or registration number has been invented.
