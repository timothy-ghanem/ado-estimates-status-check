# Azure DevOps PR estimate status check

Node.js Azure Function (v4) that acts as an Azure DevOps pull request **Status check**. On PR created/updated, it loads every linked work item and posts `succeeded` or `failed` based on:

- `Days` greater than 0
- `RemainingDays` equal to 0
- `CompletedDays` greater than 0

A pull request with no linked work items fails. Missing, null, or non-numeric field values fail.

Status context (must match the branch policy unless you override the env vars):

- Genre: `pr-policy`
- Name: `work-item-estimates`

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- An Azure DevOps PAT with **Code (Read)**, **Code (Status)**, and **Work Items (Read)**

## Local setup

```bash
npm install
copy local.settings.json.example local.settings.json
```

Edit `local.settings.json` and set `ADO_ORGANIZATION_URL` and `ADO_PAT`. Then:

```bash
npm test
npm start
```

The HTTP function is `estimateStatusCheck` (POST, function-key auth). Copy the function URL from Core Tools or the Azure portal and use it as the service-hook URL.

## Environment variables

Use the same names in `local.settings.json` (`Values`) and in the Function App **Application settings**.

Project, repository, and pull request id are **not** environment variables. They come from the Azure DevOps service-hook payload.

### Required — Azure Functions host

| Variable | Value |
| --- | --- |
| `AzureWebJobsStorage` | Local: `UseDevelopmentStorage=true` (Azurite) or `""` for HTTP-only. Azure: the Function App storage connection string. |
| `FUNCTIONS_WORKER_RUNTIME` | `node` |
| `FUNCTIONS_EXTENSION_VERSION` | `~4` |
| `AzureWebJobsFeatureFlags` | `EnableWorkerIndexing` |

### Required — Azure DevOps

| Variable | Value |
| --- | --- |
| `ADO_ORGANIZATION_URL` | Organization base URL, no trailing slash. Example: `https://dev.azure.com/YourOrg` |
| `ADO_PAT` | PAT with Code (Read), Code (Status), and Work Items (Read). Sent as HTTP Basic with an empty username. |

### Optional — status context

Override these only if the branch policy uses different context strings.

| Variable | Default |
| --- | --- |
| `ADO_STATUS_GENRE` | `pr-policy` |
| `ADO_STATUS_NAME` | `work-item-estimates` |
| `ADO_API_VERSION` | `7.1` |

Do not commit a filled `ADO_PAT`. Portal-only settings such as `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` are created by Azure and are not in this repo.

## Azure DevOps configuration

### 1. Service hooks

In the Azure DevOps project: **Project settings → Service hooks → Web Hooks**. Create **two** subscriptions that POST to the function URL (include the function key):

1. **Pull request created**
2. **Pull request updated**

Non-PR payloads (including some “Test” notifications) return HTTP 200 and do not post a status.

### 2. Branch status policy

In **Repos → Policies** (or the branch policy for `main`):

1. Add a **Status check**.
2. Set **Status to check** to `pr-policy/work-item-estimates` (genre `/` name). If the optional env vars were changed, use those values instead.
3. Mark it **required** if the PR should not complete until estimates pass.

The function posts:

- `succeeded` — every linked work item satisfies the three field rules
- `failed` — no linked work items, or at least one item fails; the status description lists work item IDs and reasons

## Layout

- `src/functions/estimateStatusCheck.js` — HTTP trigger
- `src/adoClient.js` — Azure DevOps REST calls
- `src/evaluateEstimates.js` — pass/fail rules
- `src/evaluateEstimates.test.js` — unit tests (`npm test`)
- `local.settings.json.example` — full env var template
