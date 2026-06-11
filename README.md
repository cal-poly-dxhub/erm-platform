# Cal Poly ERM Platform

Cal Poly ERM Platform is a Next.js application for Enterprise Risk Management. It lets authenticated Cal Poly users submit, review, approve, analyze, and track organizational risks across academic colleges and administrative units.

The app is a frontend plus backend-for-frontend layer. The UI is built in Next.js/React, while the Next.js API routes proxy authenticated requests to external AWS/Cognito/API Gateway/Lambda services for persistence, assessment, gap analysis, approvals, user profiles, and admin management.

## What the App Does

The platform supports these main workflows:

- **Risk Register**: view enterprise risks, search/filter risks, switch between card and table layouts, submit new risks, and edit risks when authorized.
- **Risk Submission**: capture organization scope, owner, risk description, risk analysis, controls, likelihood, impact, mitigation, residual scores, status, tolerance, resources, comments, and privacy flags.
- **AI-Assisted Risk Assessment**: call a backend risk-assessment Lambda to suggest risk category, likelihood, impact, notes, and potentially similar risks.
- **Mitigation Strategy Generation**: call a backend mitigation Lambda to suggest mitigation strategies and residual likelihood/impact scores.
- **Gap Analysis**: select a college or administrative unit and optionally a department, then request suggested missing risk areas from a backend gap-analysis service. Suggestions can prefill a new risk form.
- **ERM Dashboard**: analyze approved risks by residual exposure, category, status, unit, workflow stage, and risk matrix.
- **Admin Review**: admins can review pending, approved, and rejected risks; approve/reject risks; bulk approve selected pending risks; and delete risks.
- **User Management**: super admins can invite admins, list admins, and remove admin access through the Cognito admin backend.
- **Profile and Onboarding**: users complete a profile with organizational scope, department, and expertise. Users without a profile are redirected to onboarding.

## Tech Stack

- **Framework**: Next.js App Router
- **UI**: React, TypeScript, Tailwind CSS loaded from CDN in `app/layout.tsx`
- **Icons**: `lucide-react`
- **Authentication**: Amazon Cognito OIDC authorization-code flow with PKCE
- **Session**: signed HTTP-only cookie named `erm_session`
- **Backend integrations**: API Gateway/Lambda endpoints configured through environment variables

## Project Structure

```text
frontend/
  app/
    api/                    Next.js API routes that proxy backend services
    dashboard/              ERM analytics dashboard and admin pages
    login/                  Cognito login entry page
    onboarding/             first-run profile form
    profile/                user profile and user activity
    page.tsx                risk register and gap analysis main page
  components/               shared UI components
  lib/
    api/                    Lambda response/profile parsing helpers
    auth/                   Cognito, session, role, group, and guard helpers
  types/                    shared TypeScript types
  utils/                    risk calculations, constants, API clients, labels
  proxy.ts                  authentication gate for pages and API routes
```

## User Roles

Roles are derived from Cognito groups in the access token. The group names must match these values:

| Cognito group | App role | Capabilities |
| --- | --- | --- |
| `user` | User | Sign in, complete profile, submit risks, view risks, edit risks they own |
| `admin` | Admin | User capabilities plus risk review, approve/reject, delete, admin review navigation |
| `super_admin` | Super admin | Admin capabilities plus user/admin management |

The frontend uses route guards and UI checks for navigation and editing behavior. Backend APIs must still enforce authorization through Cognito/API Gateway/AVP or equivalent policy controls.

## Core User Flows

### Sign In

1. A protected route redirects unauthenticated users to `/login?returnTo=...`.
2. The login page links to `/api/auth/login`.
3. `/api/auth/login` starts the Cognito OIDC authorization-code flow with PKCE.
4. Cognito redirects back to `/api/auth/callback`.
5. The callback validates state/nonce/PKCE, fetches user info, reads Cognito groups from the access token, and sets the `erm_session` cookie.
6. If the user profile does not exist, the user is sent to `/onboarding`; otherwise they are sent to the requested route.

### Complete Profile

After login, the app checks `/api/users/profile`. If no profile exists, the user is redirected to `/onboarding`.

Profile fields include:

- academic college or administrative unit
- optional department
- optional expertise list

Users can later edit this from `/onboarding?edit=1`, linked from the profile page.

### Submit or Edit a Risk

Use **Submit Risk** in the sidebar or the floating **Add New Risk** button on the register.

The risk form captures:

- college/unit scope and department
- owner
- risk title/description and analysis
- current controls
- baseline likelihood and impact
- risk category
- mitigation/additional controls
- updated/residual likelihood and impact
- status, tolerance, and point of contact
- internal/external/funding resources
- leadership, ERM, and EHS comments
- private and attorney-client privilege flags

When saving, `/api/store-risk` maps frontend form fields to backend/RDS-style field names and sends the request to `STORE_RISK_LAMBDA_API_URL`.

### Review and Approve Risks

Admins use `/dashboard/admin/review`.

The page loads:

- pending risks from `/api/admin/pending-risks`
- rejected risks from `/api/admin/rejected-risks`
- approved risks from `/api/admin/approved-risks`

Admins can:

- view a risk in detail
- approve one risk
- bulk approve selected pending risks
- reject with a rejection reason
- delete a risk

Approvals and rejections are sent to `RISK_APPROVAL_API_URL`. Deletes are sent to `STORE_RISK_LAMBDA_API_URL` with `action: "delete"`.

### Analyze Approved Risks

The dashboard at `/dashboard` reads risk data from `/api/erm-dashboard-results`.

It focuses on approved risks for analytics and includes:

- residual risk summary metrics
- highest residual risks
- status/category/unit distributions
- residual score bins
- workflow board
- category drilldown
- risk matrix heatmap
- CSV export for approved risks

The dashboard request supports filters, result limits, semantic query text, and CSV export depending on what the backend endpoint supports.

### Run Gap Analysis

Use **Gap Analysis** from the sidebar or `/#gap`.

The user selects:

- academic college or administrative unit
- optional department

The app calls `/api/gap-analysis`, which forwards to `GAP_ANALYSIS_API_URL`. Returned suggested risk areas can be added to the register, pre-filling organization scope, department, risk title, and risk analysis.

### Manage Admin Users

Super admins use `/dashboard/admin/users`.

Actions are sent through `/api/admin/cognito-admin` to the configured Cognito admin backend:

- `list_admins`
- `invite_user`
- `remove_admin`

The endpoint URL is read from `COGNITO_ADMIN_API_URL` or `ERM_COGNITO_ADMIN_URL`.

## Risk Scoring

Risk scoring is handled on the frontend by `utils/riskCalculations.ts` and constants in `utils/constants.ts`.

Baseline and residual scores are calculated as:

```text
score = likelihood * impact
```

Likelihood and impact values use a 1-5 scale. The score is mapped through a qualitative matrix:

- `Low`
- `Low Med`
- `Medium`
- `Med Hi`
- `High`

Those ratings map to leadership responses:

- `Tolerable`
- `More Treatment Needed`
- `Treatment Required`
- `Urgent Action Required`

## Local Development

### Prerequisites

- Node.js compatible with Next.js 16
- npm
- Cognito app client and user pool configured for the callback URL
- Backend API Gateway/Lambda endpoints for the features you want to exercise

### Install Dependencies

```bash
cd frontend
npm install
```

### Configure Environment

Create `frontend/.env.local` with the values for your environment.

```bash
AUTH_SESSION_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

COGNITO_REGION="us-west-2"
COGNITO_USER_POOL_ID="us-west-2_example"
COGNITO_CLIENT_ID="example-client-id"
COGNITO_CLIENT_SECRET="example-client-secret"
COGNITO_DOMAIN="https://example.auth.us-west-2.amazoncognito.com"
COGNITO_REDIRECT_URI="http://localhost:3000/api/auth/callback"
COGNITO_LOGOUT_REDIRECT_URI="http://localhost:3000/"
COGNITO_SCOPES="openid profile email"

ERM_DASHBOARD_RESULTS_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/erm-dashboard-results"
STORE_RISK_LAMBDA_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/store-risk"
LAMBDA_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/risk-assessment"
MITIGATION_LAMBDA_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/mitigation-strategies"
GAP_ANALYSIS_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/gap-analysis"
RISK_APPROVAL_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/risk-approval"
USER_PROFILE_LAMBDA_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/user-profile"
COGNITO_ADMIN_API_URL="https://example.execute-api.us-west-2.amazonaws.com/prod/erm-cognito-admin"
```

### Run the App

```bash
npm run dev
```

Open `http://localhost:3000`.

Because all non-login routes are protected, a working Cognito configuration is required for normal use.

### Build for Production

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

The current package script uses `next lint`. Depending on the installed Next.js version, this may require adjusting the lint command or adding ESLint configuration.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SESSION_SECRET` | Yes | HMAC secret used to sign auth-flow and session cookies |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public app origin used for Cognito redirects and logout URLs |
| `COGNITO_REGION` | Yes | AWS region for the Cognito user pool |
| `COGNITO_USER_POOL_ID` | Yes | Cognito user pool ID |
| `COGNITO_CLIENT_ID` | Yes | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Yes | Cognito app client secret |
| `COGNITO_DOMAIN` | Recommended | Cognito hosted UI domain used for logout URL construction |
| `COGNITO_REDIRECT_URI` | Recommended | Explicit callback URL; defaults to `{appOrigin}/api/auth/callback` |
| `COGNITO_LOGOUT_REDIRECT_URI` | Recommended | Explicit logout redirect; defaults to `{appOrigin}/` |
| `COGNITO_SCOPES` | Optional | OIDC scopes; defaults to `openid profile email` |
| `ERM_DASHBOARD_RESULTS_URL` | Yes | Backend endpoint for listing/querying/exporting risk records |
| `STORE_RISK_LAMBDA_API_URL` | Yes | Backend endpoint for create/update/delete risk actions |
| `LAMBDA_API_URL` | Yes for suggestions | Backend risk-assessment endpoint |
| `MITIGATION_LAMBDA_API_URL` | Yes for mitigation | Backend mitigation strategy endpoint |
| `GAP_ANALYSIS_API_URL` | Yes for gap analysis | Backend gap-analysis endpoint |
| `RISK_APPROVAL_API_URL` | Yes for admin review | Backend approve/reject endpoint |
| `USER_PROFILE_LAMBDA_API_URL` | Yes | Backend user profile get/upsert endpoint |
| `USER_PROFILE_API_URL` | Alternative | Fallback if `USER_PROFILE_LAMBDA_API_URL` is not set |
| `COGNITO_ADMIN_API_URL` | Yes for super admins | Backend Cognito admin endpoint |
| `ERM_COGNITO_ADMIN_URL` | Alternative | Fallback if `COGNITO_ADMIN_API_URL` is not set |
| `AVP_APPLICATION_ENTITY_ID` | Optional | Used only for AVP request debug logging |

## API Routes

All non-auth API routes require a valid `erm_session` cookie. Most routes forward the Cognito access token as a Bearer token to the upstream service.

### Auth

| Route | Method | Description |
| --- | --- | --- |
| `/api/auth/login` | `GET` | Starts Cognito authorization-code login |
| `/api/auth/callback` | `GET` | Handles Cognito callback and creates app session |
| `/api/auth/logout` | `GET` | Clears session and redirects to Cognito logout when configured |
| `/api/auth/me` | `GET` | Returns current session user, role, and groups |

### User Profile

| Route | Method | Description |
| --- | --- | --- |
| `/api/users/profile` | `GET` | Checks whether a profile exists and returns it |
| `/api/users/profile` | `POST` | Upserts current user's profile |

### Risk Register and Dashboard

| Route | Method | Description |
| --- | --- | --- |
| `/api/erm-dashboard-results` | `POST` | Lists, filters, semantically queries, or exports risk records |
| `/api/store-risk` | `POST` | Creates or updates a risk |
| `/api/risk-assessment` | `POST` | Gets category/likelihood/impact suggestions |
| `/api/mitigation-strategies` | `POST` | Gets mitigation strategies and updated scores |
| `/api/gap-analysis` | `POST` | Gets suggested missing risks for a selected college/unit |

### Admin

| Route | Method | Description |
| --- | --- | --- |
| `/api/admin/pending-risks` | `GET` | Lists pending risks |
| `/api/admin/rejected-risks` | `GET` | Lists rejected risks |
| `/api/admin/approved-risks` | `GET` | Lists approved risks |
| `/api/admin/approve-risk` | `POST` | Approves a risk by database ID |
| `/api/admin/reject-risk` | `POST` | Rejects a risk by database ID, with optional reason |
| `/api/admin/delete-risk` | `POST` | Deletes a risk by database ID |
| `/api/admin/cognito-admin` | `POST` | Proxies super-admin user management actions |

## Important Data Fields

The frontend `Risk` type lives in `types/index.ts`. When risks are stored, `/api/store-risk` maps form fields to backend field names.

| Frontend field | Backend field |
| --- | --- |
| `college` or `unit` | `unit` |
| `department` | `department` |
| `owner` | `owner` |
| `risk` | `risk_description` |
| `riskAnalysis` | `risk_analysis` |
| `riskCategory` | `category` |
| `currentControls` | `current_controls` |
| `likelihood` | `baseline_likelihood` |
| `impact` | `baseline_impact` |
| calculated baseline score | `baseline_risk_rating` |
| `additionalControls` | `mitigation_strategies` |
| `updatedLikelihood` | `updated_likelihood` |
| `updatedImpact` | `updated_impact` |
| `status` | `status` |
| `resourceInternalFTE` | `internal_resources` |
| `resourceExternal` | `external_resources` |
| `resourceFunding` | `funding_required` |
| `departmentRiskTolerance` | `risk_tolerance` |
| `isCollegeWide` | `is_college_wide` |
| `statusPoc` | `status_poc` |
| `isPrivate` | `is_private` |
| `isAttorneyClientPrivilege` | `is_attorney_client_privilege` |
| `ermComments` | `erm_comments` |
| `ehsComments` | `ehs_comments` |
| `leadershipComments` | `leadership_comments` |
| `statusTolerance` | `status_tolerance` |
| `approvalStatus` | `approval_status` |

## Routing and Access Control

`proxy.ts` protects the application:

- `/login`, `/api/auth/*`, `/_next/*`, and `/favicon.ico` are public.
- All other page routes require the `erm_session` cookie.
- Unauthenticated API requests return `401`.
- Unauthenticated page requests redirect to `/login?returnTo=...`.

Client-side guards additionally redirect non-admin users away from admin pages and non-super-admin users away from user management.

## Backend Expectations

The app expects upstream API responses in either direct JSON form or Lambda proxy form:

```json
{
  "statusCode": 200,
  "body": "{\"results\": []}"
}
```

Many parsers also accept direct objects:

```json
{
  "results": []
}
```

Important endpoint expectations:

- dashboard endpoints return either an array or an object with `results`
- gap analysis returns `gap_risks.risks`
- risk assessment returns `likelihood`, `impact`, `category`, optional `notes`, optional `similar`
- mitigation returns `mitigation_strategies` and `updated_scores` or compatible alternatives
- profile get/upsert supports `action: "get"` and `action: "upsert"`
- approval endpoint accepts `action: "approve"` or `action: "reject"`
- store-risk endpoint accepts `action: "create"`, `action: "update"`, and for delete calls `action: "delete"`

## Deployment Notes

For production:

1. Set all required environment variables in the hosting environment.
2. Configure Cognito callback URL to match the deployed app:

   ```text
   https://your-domain.example/api/auth/callback
   ```

3. Configure Cognito logout URL to match the deployed app.
4. Ensure the Cognito app client allows the required scopes.
5. Ensure Cognito access tokens include the `cognito:groups` claim.
6. Ensure API Gateway/Lambda authorizers or AVP policies allow the expected roles and actions.
7. Use a strong `AUTH_SESSION_SECRET`.
8. Serve the app over HTTPS so secure cookies work in production.

## Troubleshooting

### Login initialization fails

Check these variables:

- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET`
- `COGNITO_REDIRECT_URI`

Also verify the redirect URI is registered in the Cognito app client.

### User is redirected to onboarding repeatedly

Check `USER_PROFILE_LAMBDA_API_URL` and confirm the profile backend returns a response that includes an existing user profile or `exists: true`.

### API route returns `Unauthorized. Missing access token in session.`

The session cookie exists, but the Cognito callback did not store an access token. Recheck the OIDC callback flow and Cognito client configuration.

### Dashboard or admin APIs return 403

Check Cognito group membership and backend authorization policies. The app expects access-token groups named `user`, `admin`, and `super_admin`.

### Risk edit says the record is missing a valid database ID

Edits require a numeric database `id`, not only a display `risk_id`. The frontend intentionally refuses update/delete/approval actions without a valid numeric ID to avoid accidental creates or invalid mutations.

### AI suggestions do not appear

Check:

- `LAMBDA_API_URL`
- `MITIGATION_LAMBDA_API_URL`
- browser network errors for `/api/risk-assessment` or `/api/mitigation-strategies`
- required fields in the modal before suggestions are requested

## Development Notes

- Path alias `@/*` points to the `frontend/` directory.
- Tailwind is loaded from CDN in `app/layout.tsx`; there is no local Tailwind build pipeline in this repo.
- The session cookie lifetime is 8 hours.
- The temporary OIDC auth-flow cookie lifetime is 10 minutes.
- Normal users can edit risks only when the risk owner matches their email, name, username, or Cognito subject.
- Admin and super-admin UI visibility is based on Cognito groups read from the access token.
