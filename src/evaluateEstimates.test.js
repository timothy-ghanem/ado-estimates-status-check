const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateEstimates, evaluateWorkItem, parseNumber } = require('./evaluateEstimates');

function workItem(id, days, remainingDays, completedDays) {
  const fields = {
    'System.Id': id
  };
  if (days !== undefined) {
    fields.Days = days;
  }
  if (remainingDays !== undefined) {
    fields.RemainingDays = remainingDays;
  }
  if (completedDays !== undefined) {
    fields.CompletedDays = completedDays;
  }
  return { id, fields };
}

describe('parseNumber', () => {
  it('returns null for missing values', () => {
    assert.equal(parseNumber(null), null);
    assert.equal(parseNumber(undefined), null);
    assert.equal(parseNumber(''), null);
    assert.equal(parseNumber('  '), null);
  });

  it('parses finite numbers and numeric strings', () => {
    assert.equal(parseNumber(3), 3);
    assert.equal(parseNumber(0), 0);
    assert.equal(parseNumber('4.5'), 4.5);
  });

  it('returns null for non-numeric values', () => {
    assert.equal(parseNumber('abc'), null);
    assert.equal(parseNumber(Number.NaN), null);
  });
});

describe('evaluateWorkItem', () => {
  it('passes when Days>0, RemainingDays=0, CompletedDays>0', () => {
    const result = evaluateWorkItem(workItem(12, 5, 0, 5));
    assert.equal(result.passed, true);
    assert.deepEqual(result.failures, []);
  });

  it('fails when Days is missing or not greater than 0', () => {
    assert.match(evaluateWorkItem(workItem(1, undefined, 0, 1)).failures[0], /Days is missing/);
    assert.match(evaluateWorkItem(workItem(1, 0, 0, 1)).failures[0], /Days is 0/);
  });

  it('fails when RemainingDays is missing or not 0', () => {
    assert.match(evaluateWorkItem(workItem(2, 3, undefined, 3)).failures[0], /RemainingDays is missing/);
    assert.match(evaluateWorkItem(workItem(2, 3, 2, 1)).failures[0], /RemainingDays is 2/);
  });

  it('fails when CompletedDays is missing or not greater than 0', () => {
    assert.match(evaluateWorkItem(workItem(3, 3, 0, undefined)).failures[0], /CompletedDays is missing/);
    assert.match(evaluateWorkItem(workItem(3, 3, 0, 0)).failures[0], /CompletedDays is 0/);
  });
});

describe('evaluateEstimates', () => {
  it('fails when no work items are linked', () => {
    const empty = evaluateEstimates([]);
    assert.equal(empty.passed, false);
    assert.equal(empty.state, 'failed');
    assert.equal(empty.description, 'No linked work items.');

    const missing = evaluateEstimates(null);
    assert.equal(missing.passed, false);
    assert.equal(missing.description, 'No linked work items.');
  });

  it('succeeds when every linked work item meets the estimate rule', () => {
    const result = evaluateEstimates([
      workItem(10, 2, 0, 2),
      workItem(11, 8, 0, 3)
    ]);
    assert.equal(result.passed, true);
    assert.equal(result.state, 'succeeded');
    assert.match(result.description, /Estimates OK: 2 work item/);
  });

  it('fails and lists each violating work item', () => {
    const result = evaluateEstimates([
      workItem(10, 2, 0, 2),
      workItem(123, 5, 3, 2),
      workItem(456)
    ]);
    assert.equal(result.passed, false);
    assert.equal(result.state, 'failed');
    assert.match(result.description, /#123: RemainingDays is 3/);
    assert.match(result.description, /#456: Days is missing/);
    assert.doesNotMatch(result.description, /#10:/);
  });
});
