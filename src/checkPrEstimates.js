const {
  getPullRequestWorkItemIds,
  getWorkItems,
  postPullRequestStatus
} = require('./adoClient');
const { evaluateEstimates } = require('./evaluateEstimates');

async function evaluateAndPostPrStatus(config, pr, context) {
  context?.log?.(`Checking estimates for PR ${pr.pullRequestId} in ${pr.project}`);

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
    pullRequestId: pr.pullRequestId,
    project: pr.project,
    repositoryId: pr.repositoryId,
    state: result.state,
    description: result.description
  };
}

module.exports = { evaluateAndPostPrStatus };
