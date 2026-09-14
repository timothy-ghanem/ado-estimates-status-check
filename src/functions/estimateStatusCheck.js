const { app } = require('@azure/functions');
const { getConfig } = require('../config');
const {
  getPullRequestWorkItemIds,
  getWorkItems,
  postPullRequestStatus
} = require('../adoClient');
const { evaluateEstimates } = require('../evaluateEstimates');

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

app.http('estimateStatusCheck', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 200, jsonBody: { message: 'Ignored: body is not JSON' } };
    }

    const pr = parsePrPayload(body);
    if (!pr) {
      context.log('Ignored non-PR payload');
      return { status: 200, jsonBody: { message: 'Ignored: not a pull request event' } };
    }

    try {
      const config = getConfig();
      context.log(`Checking estimates for PR ${pr.pullRequestId} in ${pr.project}`);

      const ids = await getPullRequestWorkItemIds({ ...config, ...pr });
      const workItems = await getWorkItems({ ...config, ids });
      const result = evaluateEstimates(workItems);

      await postPullRequestStatus({
        ...config,
        ...pr,
        status: {
          state: result.state,
          description: result.description,
          context: {
            name: config.statusName,
            genre: config.statusGenre
          }
        }
      });

      return {
        status: 200,
        jsonBody: {
          state: result.state,
          description: result.description
        }
      };
    } catch (error) {
      context.error(error);
      return {
        status: 500,
        jsonBody: {
          message: error instanceof Error ? error.message : 'Failed to process pull request status check'
        }
      };
    }
  }
});
