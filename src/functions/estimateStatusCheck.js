const { app } = require('@azure/functions');
const { getConfig } = require('../config');
const { getWorkItemRelations } = require('../adoClient');
const { evaluateAndPostPrStatus } = require('../checkPrEstimates');
const {
  parsePrPayload,
  parseWorkItemPrTargets,
  parseWorkItemId,
  hasEstimateFieldChanges,
  extractPrTargetsFromRelations
} = require('../parsePayload');

function jsonBodyFromResults(results) {
  if (results.length === 1) {
    return {
      state: results[0].state,
      description: results[0].description
    };
  }

  return { results };
}

async function resolvePrTargets(body, context) {
  const pr = parsePrPayload(body);
  if (pr) {
    return [pr];
  }

  const linkTargets = parseWorkItemPrTargets(body);
  if (linkTargets.length > 0) {
    return linkTargets;
  }

  if (!hasEstimateFieldChanges(body)) {
    return [];
  }

  const workItemId = parseWorkItemId(body);
  if (!workItemId) {
    return [];
  }

  const config = getConfig();
  const relations = await getWorkItemRelations({ ...config, id: workItemId });
  const targets = extractPrTargetsFromRelations(relations);
  context.log(
    `Estimate fields changed on work item ${workItemId}; found ${targets.length} linked pull request(s)`
  );
  return targets;
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

    try {
      const targets = await resolvePrTargets(body, context);
      if (targets.length === 0) {
        context.log('Ignored payload with no pull request to check');
        return {
          status: 200,
          jsonBody: { message: 'Ignored: not a pull request event' }
        };
      }

      const config = getConfig();
      const results = [];
      for (const target of targets) {
        results.push(await evaluateAndPostPrStatus(config, target, context));
      }

      return {
        status: 200,
        jsonBody: jsonBodyFromResults(results)
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
