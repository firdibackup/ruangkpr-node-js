# Calculator handoff v1

Receiver: `/from-calculator?source=maxi-calculator&v=1&mode=primary|takeover|topup`.

Required shared query fields: `bankId`, `productId`, `productVersion`, `price` (IDR), `months`, `income` (IDR/month, 0 means unknown), `otherDebt`, `additionalCosts` (IDR).

- Primary: `downPayment`. Maps to property price, DP, principal = price − DP, tenor and employment income/debt.
- Takeover: `outstanding`, `remainingMonths`, `currentRate` (annual percent), `currentPayment` (0 = annuity estimate), `fixedMonthsLeft`, `currentFloatingRate` (annual percent), `penaltyRate` (percent), `exitAdmin`.
- Topup: same as takeover plus `requestedCash` (NET desired cash in IDR), `purpose` (`renovation`, `education`, `business`, `debt_consolidation`, `other`). Stored as productType `takeover`, optimizationMode `topup`.

Receiver validates and allowlists data, retains the query in sessionStorage through login/OTP/onboarding/OAuth, removes it from the address bar, and creates a bank-first draft through the existing API. Primary opens the supplied product at `/apply/primary/5/:productId`; Takeover/Top-up opens `/optimize/programs/:productId`. A mismatched bank/product opens the program list instead. Retrying the same import resumes its next incomplete stage; another active application is never overwritten. After confirming the bank, users fill missing KPR/property details, then identity and employment, then documents and review. The supplied bank ID is the proposed NEW bank, not the current bank.

Product ID/version and the bank-first marker are stored under `data.calculator`. The selected product opens directly using the latest catalog version, with a notice when its version changed. Income 0 means unknown: payment estimates remain available, but DTI/capacity stay null and no affordability recommendation is shown. Completing data automatically refreshes the quote for the confirmed bank without clearing that choice or requiring another bank-selection step. Once required data is complete, the next stage is documents, followed by review and submission. A bank choice is an application preference, not an eligibility approval. Final submission validates required data, documents, and catalog availability/version.

Exact calculator inputs remain in `data.calculator`. `exitAdmin` and `additionalCosts` are preserved as source estimates, not fed into the existing destination pricing engine (which has its own cost policy). Fixed end date is an estimate from import date + remaining fixed months, to be reviewed with the contract. Until the contractual payment day is entered, the simulation uses the import/current calculation day as an estimate without filling a fictitious contractual day in the form. Destination calculations can differ because of current catalog data, fee policy, and principal rounding.

Deploy both applications. Configure the website's `NEXT_PUBLIC_KPR_APPLICATION_URL` to this application's HTTPS base URL and rebuild. Query values are visible in URL history/hosting logs; do not add identity documents, passwords, or tokens to this contract.
