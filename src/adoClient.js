const WORK_ITEM_FIELDS = [
  'System.Id',
  'System.Title',
  'System.WorkItemType',
  'Days',
  'RemainingDays',
  'CompletedDays'
];

const WORK_ITEMS_BATCH_SIZE = 200;

function authHeader(pat) {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
}

function apiUrl(organizationUrl, path, apiVersion) {
  const separator = path.includes('?') ? '&' : '?';
  return `${organizationUrl}${path}${separator}api-version=${apiVersion}`;
}

async function adoFetch(url, pat, options = {}) {
  const headers = {
    Accept: 'application/json',
    Authorization: authHeader(pat),
    ...options.headers
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ADO request failed ${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getPullRequestWorkItemIds({
  organizationUrl,
  project,
  repositoryId,
  pullRequestId,
  pat,
  apiVersion
}) {
  const path = `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    String(repositoryId)
  )}/pullRequests/${pullRequestId}/workitems`;
  const data = await adoFetch(apiUrl(organizationUrl, path, apiVersion), pat);
  return (data.value || [])
    .map((item) => Number(item.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function getWorkItems({ organizationUrl, ids, pat, apiVersion }) {
  if (!ids.length) {
    return [];
  }

  const items = [];
  for (let offset = 0; offset < ids.length; offset += WORK_ITEMS_BATCH_SIZE) {
    const batchIds = ids.slice(offset, offset + WORK_ITEMS_BATCH_SIZE);
    const data = await adoFetch(
      apiUrl(organizationUrl, '/_apis/wit/workitemsbatch', apiVersion),
      pat,
      {
        method: 'POST',
        body: JSON.stringify({
          ids: batchIds,
          fields: WORK_ITEM_FIELDS
        })
      }
    );
    items.push(...(data.value || []));
  }

  return items;
}

async function postPullRequestStatus({
  organizationUrl,
  project,
  repositoryId,
  pullRequestId,
  pat,
  apiVersion,
  status
}) {
  const path = `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    String(repositoryId)
  )}/pullRequests/${pullRequestId}/statuses`;
  return adoFetch(apiUrl(organizationUrl, path, apiVersion), pat, {
    method: 'POST',
    body: JSON.stringify(status)
  });
}

module.exports = {
  WORK_ITEM_FIELDS,
  getPullRequestWorkItemIds,
  getWorkItems,
  postPullRequestStatus
};
