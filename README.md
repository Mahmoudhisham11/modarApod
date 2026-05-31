# Project Structure

```
D:\Projects\cashat-abod\
│
├── .env.local
├── .firebaserc
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── eslint.config.mjs
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── jsconfig.json
├── middleware.js
├── next.config.js
├── package.json
├── postcss.config.mjs
├── README.md
│
├── app/
│   ├── firebase.js
│   ├── globals.css
│   ├── layout.js
│   ├── page.js
│   │
│   ├── (auth)/
│   │   ├── layout.js
│   │   ├── login/page.js
│   │   └── register/page.js
│   │
│   ├── (dashboard)/
│   │   ├── layout.js
│   │   ├── debts/page.js
│   │   ├── lines/page.js
│   │   ├── reports/page.js
│   │   └── settings/page.js
│   │
│   └── api/
│       ├── auth/ (login/, logout/, register/, reset-password/, send-otp/, session/)
│       ├── cloudinary/delete/route.js
│       └── invoice/[id]/route.js
│
├── components/
│   ├── auth/ (auth-form-inner.js, auth-form.js, subscription-guard.js)
│   ├── common/ (empty-state.js, lock-dialog.js, page-header.js, placeholder-card.js, status-pill.js)
│   ├── dashboard/ (dashboard-page-client.js, kpi-grid.js, operation-mobile-cards.js, use-shop-operations.js)
│   ├── debts/ (add-debt-dialog.js, debt-payment-dialog.js, debt-report-dialog.js, debts-page-client.js)
│   ├── layout/ (app-header.js, app-sidebar.js, auth-shell.js, dashboard-shell.js, limit-alerts-menu.js)
│   ├── lines/ (line-form-sheet.js, line-mobile-cards.js, lines-page-client.js)
│   ├── machines/ (machine-form-sheet.js)
│   ├── operations/ (execute-operation-form.js, operations-page-client.js)
│   ├── providers/ (app-providers.js)
│   ├── reports/ (capital-cards.js, cash-edit-dialog.js, report-breakdown-table.js, report-daily-chart.js, report-kpi-cards.js, report-period-toolbar.js, reports-list-cards.js, reports-list-table.js, reports-page-client.js, use-shop-reports.js)
│   ├── settings/ (settings-page-client.js)
│   └── ui/ (badge.js, button.js, card.js, checkbox.js, dialog.js, dropdown-menu.js, input.js, label.js, select.js, sheet.js, sonner.js, table.js)
│
├── contexts/
│   └── lock-dialog-context.js
│
├── hooks/
│   ├── use-debt-alerts.js
│   ├── use-feature-lock.js
│   ├── use-limit-alerts.js
│   └── use-subscription-guard.js
│
├── lib/
│   ├── utils.js
│   ├── auth/ (email.js, get-session.js, session.js, user-locks.js)
│   ├── cloudinary/ (upload.js)
│   ├── constants/ (navigation.js)
│   ├── dashboard/ (operation-aggregates.js, operation-display.js, print-operation-invoice.js)
│   ├── debts/ (debts-service.js)
│   ├── format/ (locale-numbers.js)
│   ├── instapay/ (instapay-lines-service.js)
│   ├── lines/ (channel-types.js, limit-alerts.js, line-payload.js, numbers-service.js, phone-normalize.js, reset-limits-client.js)
│   ├── machines/ (machines-service.js)
│   ├── operations/ (constants.js, eligibility.js, operations-service.js)
│   ├── reports/ (export-filename.js, export-report-excel.js, export-report-pdf.js, print-report-summary.js, report-aggregates.js, report-export-html.js, reports-service.js)
│   ├── shops/ (cash-service.js)
│   ├── sources/ (sources-cache.js)
│   └── ui/ (operation-type-theme.js)
│
├── functions/
│   └── ...
│
└── public/
    ├── apple-touch-icon.png
    ├── favicon-96x96.png
    ├── favicon.ico
    ├── favicon.svg
    ├── site.webmanifest
    ├── sw.js
    ├── web-app-manifest-192x192.png
    ├── web-app-manifest-512x512.png
    └── workbox-4754cb34.js
```
