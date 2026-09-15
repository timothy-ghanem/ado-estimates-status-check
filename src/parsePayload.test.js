const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePrPayload,
  parsePullRequestArtifactUrl,
  parseWorkItemPrTargets,
  parseWorkItemId,
  hasEstimateFieldChanges,
  extractPrTargetsFromRelations
} = require('./parsePayload');

const PROJECT_ID = 'a7573007-bbb3-4341-b726-0c4148a07853';
const REPO_ID = '3411ebc1-d5aa-464f-9615-0b527bc66719';

function prTarget(pullRequestId = 22) {
  return {
    project: PROJECT_ID,
    repositoryId: REPO_ID,
    pullRequestId
  };
}

function artifactLink(url, rel = 'ArtifactLink') {
  return {
    rel,
    url,
    attributes: { name: 'Pull Request' }
  };
}

describe('parsePrPayload', () => {
  it('returns project, repository, and pull request id from a PR event', () => {
    const body = {
      resource: {
        pullRequestId: 9,
        repository: {
          id: REPO_ID,
          project: { name: 'Fabrikam' }
        }
      }
    };

    assert.deepEqual(parsePrPayload(body), {
      pullRequestId: 9,
      project: 'Fabrikam',
      repositoryId: REPO_ID
    });
  });

  it('falls back to resourceContainers project name', () => {
    const body = {
      resource: {
        pullRequestId: 3,
        repository: { id: REPO_ID }
      },
      resourceContainers: {
        project: { name: 'Contoso' }
      }
    };

    assert.equal(parsePrPayload(body).project, 'Contoso');
  });

  it('returns null for non-PR payloads', () => {
    assert.equal(parsePrPayload(null), null);
    assert.equal(parsePrPayload({ resource: { workItemId: 12 } }), null);
    assert.equal(parsePrPayload({ resource: { pullRequestId: 1 } }), null);
  });
});

describe('parsePullRequestArtifactUrl', () => {
  it('parses encoded vstfs Git/PullRequestId URLs', () => {
    const url = `vstfs:///Git/PullRequestId/${PROJECT_ID}%2f${REPO_ID}%2f22`;
    assert.deepEqual(parsePullRequestArtifactUrl(url), prTarget(22));
  });

  it('parses unencoded vstfs Git/PullRequestId URLs', () => {
    const url = `vstfs:///Git/PullRequestId/${PROJECT_ID}/${REPO_ID}/7`;
    assert.deepEqual(parsePullRequestArtifactUrl(url), prTarget(7));
  });

  it('returns null for non-PR artifact URLs', () => {
    assert.equal(parsePullRequestArtifactUrl('vstfs:///Git/Commit/abc'), null);
    assert.equal(parsePullRequestArtifactUrl('https://dev.azure.com/org/project/_git/repo/pullrequest/1'), null);
    assert.equal(parsePullRequestArtifactUrl(''), null);
    assert.equal(parsePullRequestArtifactUrl(null), null);
  });
});

describe('parseWorkItemPrTargets', () => {
  const encodedUrl = `vstfs:///Git/PullRequestId/${PROJECT_ID}%2F${REPO_ID}%2F22`;
  const otherUrl = `vstfs:///Git/PullRequestId/${PROJECT_ID}/${REPO_ID}/8`;

  it('returns PRs from added ArtifactLinks', () => {
    const body = {
      resource: {
        workItemId: 100,
        relations: {
          added: [artifactLink(encodedUrl)]
        }
      }
    };

    assert.deepEqual(parseWorkItemPrTargets(body), [prTarget(22)]);
  });

  it('returns PRs from removed ArtifactLinks so unlinking refreshes status', () => {
    const body = {
      resource: {
        workItemId: 100,
        relations: {
          removed: [artifactLink(otherUrl)]
        }
      }
    };

    assert.deepEqual(parseWorkItemPrTargets(body), [prTarget(8)]);
  });

  it('deduplicates added and removed targets for the same PR', () => {
    const body = {
      resource: {
        relations: {
          added: [artifactLink(encodedUrl)],
          removed: [artifactLink(encodedUrl)]
        }
      }
    };

    assert.deepEqual(parseWorkItemPrTargets(body), [prTarget(22)]);
  });

  it('ignores non-PR relations', () => {
    const body = {
      resource: {
        relations: {
          added: [
            { rel: 'System.LinkTypes.Hierarchy-Forward', url: 'https://dev.azure.com/org/_apis/wit/workItems/2' },
            artifactLink('vstfs:///Git/Commit/abc123'),
            { rel: 'ArtifactLink', url: `vstfs:///Git/PullRequestId/${PROJECT_ID}%2f${REPO_ID}%2f5` }
          ]
        }
      }
    };

    assert.deepEqual(parseWorkItemPrTargets(body), [prTarget(5)]);
  });

  it('returns an empty list when the work item update has no PR link changes', () => {
    assert.deepEqual(parseWorkItemPrTargets({ resource: { workItemId: 1, fields: { 'System.Title': {} } } }), []);
    assert.deepEqual(parseWorkItemPrTargets({ resource: { relations: { added: [] } } }), []);
  });
});

describe('hasEstimateFieldChanges', () => {
  it('is true when Custom.Days, Custom.RemainingDays, or Custom.CompletedDays changed', () => {
    assert.equal(
      hasEstimateFieldChanges({ resource: { fields: { 'Custom.Days': { newValue: 3 } } } }),
      true
    );
    assert.equal(
      hasEstimateFieldChanges({
        resource: { fields: { 'Custom.RemainingDays': { oldValue: 2, newValue: 0 } } }
      }),
      true
    );
    assert.equal(
      hasEstimateFieldChanges({ resource: { fields: { 'Custom.CompletedDays': { newValue: 1 } } } }),
      true
    );
  });

  it('is false for unrelated field updates', () => {
    assert.equal(hasEstimateFieldChanges({ resource: { fields: { 'System.Title': { newValue: 'x' } } } }), false);
    assert.equal(hasEstimateFieldChanges({ resource: {} }), false);
    assert.equal(hasEstimateFieldChanges({}), false);
  });
});

describe('parseWorkItemId', () => {
  it('uses workItemId, not the update record id', () => {
    assert.equal(parseWorkItemId({ resource: { id: 99, workItemId: 123 } }), 123);
  });

  it('falls back to revision.id', () => {
    assert.equal(parseWorkItemId({ resource: { revision: { id: 44 } } }), 44);
  });

  it('returns null when missing', () => {
    assert.equal(parseWorkItemId({ resource: { id: 99 } }), null);
    assert.equal(parseWorkItemId({}), null);
  });
});

describe('extractPrTargetsFromRelations', () => {
  it('extracts PR ArtifactLinks from a work item relations array', () => {
    const relations = [
      { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://dev.azure.com/org/_apis/wit/workItems/1' },
      artifactLink(`vstfs:///Git/PullRequestId/${PROJECT_ID}%2f${REPO_ID}%2f22`),
      artifactLink(`vstfs:///Git/PullRequestId/${PROJECT_ID}/${REPO_ID}/22`)
    ];

    assert.deepEqual(extractPrTargetsFromRelations(relations), [prTarget(22)]);
  });

  it('returns an empty list when there are no PR links', () => {
    assert.deepEqual(extractPrTargetsFromRelations([]), []);
    assert.deepEqual(extractPrTargetsFromRelations(null), []);
  });
});
