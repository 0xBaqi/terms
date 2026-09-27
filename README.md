This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


### Local pre-verification checkpoint

Evaluation is free; only the explicit VERIFY WITH SERV click requests paid verification. Each server-issued evaluation ticket binds the complete mandate, evidence, decision and wallet, expires after 15 minutes, and permits one attempt (including failures). Re-evaluate after expiry, restart or a failed attempt. Tickets are stored in this local server process; multiple server instances require a shared atomic ticket store before deployment.

Free validation: `npx tsc --noEmit`, `npx vitest run src/lib/__tests__ --exclude "**/terms-serv-live.test.ts"`, and `npm run build`. Never enable RUN_LIVE_SERV without explicit approval. On Windows environments requiring system certificate trust, set NODE_OPTIONS=--use-system-ca; do not disable TLS verification.

Manual proof: select Permitted, click EVALUATE PROPOSAL, confirm EXECUTE and 7/7, then scroll to Permission is only the beginning and click VERIFY WITH SERV once. IXS may legitimately return BLOCKED (including a zero vault limit) or READY. Only calldataReleased=true exposes transaction data. This flow constructs data; it does not broadcast a transaction.
