const {
  DAYS_FIELD,
  REMAINING_DAYS_FIELD,
  COMPLETED_DAYS_FIELD
} = require('./evaluateEstimates');

const ESTIMATE_FIELDS = [DAYS_FIELD, REMAINING_DAYS_FIELD, COMPLETED_DAYS_FIELD];
const PULL_REQUEST_ARTIFACT = /^vstfs:\/\/\/Git\/PullRequestId\/(.+)$/i;

function parsePrPayload(body) {
  const resource = body?.resource;
  if (!resource || typeof resource !== 'object') {
    return null;
  }

  const pullRequestId = Number(resource.pullRequestId);
  const repository = resource.repository;
  if (!Number.isInteger(pullRequestId) || pullRequestId < 1 || !repository) {
    return null;
  }

  const project =
    repository.project?.name ||
    repository.project?.id ||
    body.resourceContainers?.project?.name ||
    null;
  const repositoryId = repository.id;

  if (!project || !repositoryId) {
    return null;
  }

  return { pullRequestId, project, repositoryId };
}

function parsePullRequestArtifactUrl(url) {
  if (typeof url !== 'string' || !url) {
    return null;
  }

  const match = url.match(PULL_REQUEST_ARTIFACT);
  if (!match) {
    return null;
  }

  let rest = match[1];
  try {
    rest = decodeURIComponent(rest);
  } catch {
    // Keep the unmatched-decoded path and try to split it as-is.
  }

  const parts = rest.split('/').filter(Boolean);
  if (parts.length !== 3) {
    return null;
  }

  const [project, repositoryId, pullRequestIdRaw] = parts;
  const pullRequestId = Number(pullRequestIdRaw);
  if (!project || !repositoryId || !Number.isInteger(pullRequestId) || pullRequestId < 1) {
    return null;
  }

  return { project, repositoryId, pullRequestId };
}

function relationToTarget(relation) {
  if (!relation || typeof relation !== 'object') {
    return null;
  }

  if (relation.rel && relation.rel !== 'ArtifactLink') {
    return null;
  }

  return parsePullRequestArtifactUrl(relation.url);
}

function uniqueTargets(targets) {
  const seen = new Set();
  const result = [];
  for (const target of targets) {
    const key = `${target.project}|${target.repositoryId}|${target.pullRequestId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(target);
  }
  return result;
}

function extractPrTargetsFromRelations(relations) {
  if (!Array.isArray(relations)) {
    return [];
  }

  return uniqueTargets(relations.map(relationToTarget).filter(Boolean));
}

function parseWorkItemPrTargets(body) {
  const relations = body?.resource?.relations;
  if (!relations || typeof relations !== 'object') {
    return [];
  }

  const added = Array.isArray(relations.added) ? relations.added : [];
  const removed = Array.isArray(relations.removed) ? relations.removed : [];
  return uniqueTargets([...added, ...removed].map(relationToTarget).filter(Boolean));
}

function hasEstimateFieldChanges(body) {
  const fields = body?.resource?.fields;
  if (!fields || typeof fields !== 'object') {
    return false;
  }

  return ESTIMATE_FIELDS.some((name) => Object.prototype.hasOwnProperty.call(fields, name));
}

function parseWorkItemId(body) {
  const resource = body?.resource;
  const id = Number(resource?.workItemId ?? resource?.revision?.id);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }
  return id;
}

module.exports = {
  ESTIMATE_FIELDS,
  parsePrPayload,
  parsePullRequestArtifactUrl,
  parseWorkItemPrTargets,
  parseWorkItemId,
  hasEstimateFieldChanges,
  extractPrTargetsFromRelations
};
