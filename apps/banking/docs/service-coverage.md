# All Services coverage

This audit covers the customer-facing entries published by the typed registry in `data/services-registry.ts`. “Demo” means the existing local/demo service boundary, not a live bank connection.

| Service ID | Display name | Destination | Resource / capability | State | Environment | Verification | External dependency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `my-accounts` | My accounts | Existing Accounts tab | None | Operational | Demo | Registry route + existing Accounts screen | Live account API for production |
| `account-details` | Account details | Existing account details | Account | Operational | Demo | Registry route + account selector | Account API |
| `transaction-history` | Transaction history | Existing account transactions tab | Account | Operational | Registry route + account selector | Registry/search tests + existing account details flow | Transaction API |
| `account-statements` | Account statements | Existing account documents tab | Account | Operational | Demo | Registry route + account selector | Official document API for bank-issued statements |
| `fixed-deposits` | Fixed deposits | Service-specific information view | None | Information-only | Demo | Registry validation | Deposit product API |
| `recurring-deposits` | Recurring deposits | Service-specific information view | None | Information-only | Demo | Registry validation | Deposit product API |
| `transfer-money` | Transfer money | Existing Transfers flow | None | Operational | Demo | Registry route + existing transfer tests | Authorised transfer provider/backend |
| `scan-qr` | Scan QR | Existing QR flow | None | Operational | Demo | Registry route + existing QR tests | Camera/PSP integration for production |
| `beneficiaries` | Manage beneficiaries | Existing Beneficiaries flow | None | Operational | Demo | Registry route + existing transfer tests | Beneficiary API |
| `transfer-history` | Transfer history | Existing transfer history | None | Operational | Demo | Registry route + existing transfer tests | Transfer history API |
| `my-cards` | My cards | Existing Cards overview | None | Operational | Demo | Registry route + existing card tests | Card API |
| `card-controls` | Card usage controls | Existing card controls | Card with usage controls | Operational | Demo | Registry route + capability resolver | Issuer card-control API |
| `card-limits` | Manage transaction limits | Existing card controls | Card with limit capability | Operational | Demo | Registry route + capability resolver | Issuer limits API |
| `lost-stolen-card` | Report lost or stolen card | Existing protected card controls | Card with hotlist capability | Operational | Demo | Registry route; opening does not block | Issuer hotlist workflow |
| `card-statements` | Credit-card statements | Existing card billing section | Credit card with billing capability | Operational | Demo | Registry route + capability resolver | Credit-card statement API |
| `ask-wealth-coach` | Ask Wealth Coach | Existing Coach conversation | None | Operational | Demo | Registry route + existing Coach flow | Authenticated Coach backend |
| `financial-goals` | Financial goals | Existing Coach dashboard | None | Operational | Demo | Registry route + existing Coach flow | Goals backend for production |
| `spending-insights` | Spending insights | Existing Coach dashboard | None | Operational | Demo | Registry route + existing Coach flow | Insights backend for production |
| `investments-overview` | Investments overview | Service-specific information view | None | Information-only | App-native | Registry validation | Approved investment provider |
| `financial-reports` | Financial reports | Service-specific information view | None | Information-only | App-native | Registry validation | Report/document backend |
| `loans` | Loans | Service-specific information view | None | Information-only | App-native | Registry validation | Loan servicing API |
| `insurance` | Insurance | Service-specific information view | None | Information-only | App-native | Registry validation | Insurance/policy provider |
| `tax-documents` | Tax & documents | Service-specific information view | None | Information-only | App-native | Registry validation | Official tax-document API |
| `service-requests` | Service requests | Service-specific information view | None | Information-only | App-native | Registry validation | Request-management API |
| `my-profile` | My profile | Existing authenticated Profile flow | None | Operational | App-native | Registry route | Clerk/profile configuration |
| `security-settings` | Security settings | Service-specific information view | None | Information-only | App-native | Registry validation | Bank security settings API |
| `privacy-consent` | Privacy & consent | Service-specific information view | None | Information-only | App-native | Registry validation | Bank consent-management API |
| `notification-preferences` | Notification preferences | Service-specific information view | None | Information-only | App-native | Registry validation | Notification preference API |
| `help-center` | Help center | Service-specific information view | None | Information-only | App-native | Registry validation | Maintained support content |
| `contact-support` | Contact support | Service-specific information view | None | Information-only | App-native | Registry validation | Approved support channel |
| `branch-atm-locator` | Branch / ATM information | Service-specific information view | None | Information-only | App-native | Registry validation | Approved locator feed |
| `offers` | Offers | Service-specific information view | None | Information-only | App-native | Registry validation | Approved offers source |

The directory stores only service IDs and timestamps for favourites and recents. It does not store resource IDs, account numbers, card credentials, transaction amounts, raw search queries, or external URLs in those preferences.
