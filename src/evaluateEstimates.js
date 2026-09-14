const DAYS_FIELD = 'Days';
const REMAINING_DAYS_FIELD = 'RemainingDays';
const COMPLETED_DAYS_FIELD = 'CompletedDays';

const DESCRIPTION_MAX_LENGTH = 400;

function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function fieldFailure(fieldName, value, predicate, expected) {
  if (value === null) {
    return `${fieldName} is missing`;
  }
  if (!predicate(value)) {
    return `${fieldName} is ${value} (${expected})`;
  }
  return null;
}

function evaluateWorkItem(item) {
  const fields = item?.fields ?? {};
  const id = item?.id ?? fields['System.Id'];
  const days = parseNumber(fields[DAYS_FIELD]);
  const remainingDays = parseNumber(fields[REMAINING_DAYS_FIELD]);
  const completedDays = parseNumber(fields[COMPLETED_DAYS_FIELD]);

  const failures = [
    fieldFailure(DAYS_FIELD, days, (n) => n > 0, 'must be greater than 0'),
    fieldFailure(REMAINING_DAYS_FIELD, remainingDays, (n) => n === 0, 'must be 0'),
    fieldFailure(COMPLETED_DAYS_FIELD, completedDays, (n) => n > 0, 'must be greater than 0')
  ].filter(Boolean);

  return { id, passed: failures.length === 0, failures };
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function evaluateEstimates(workItems) {
  if (!Array.isArray(workItems) || workItems.length === 0) {
    return {
      passed: false,
      state: 'failed',
      description: 'No linked work items.',
      results: []
    };
  }

  const results = workItems.map(evaluateWorkItem);
  const failed = results.filter((result) => !result.passed);
  const passed = failed.length === 0;

  let description;
  if (passed) {
    description = `Estimates OK: ${results.length} work item(s) have Days>0, RemainingDays=0, CompletedDays>0.`;
  } else {
    const details = failed
      .map((result) => `#${result.id}: ${result.failures.join('; ')}`)
      .join(' | ');
    description = truncate(`Failed: ${details}`, DESCRIPTION_MAX_LENGTH);
  }

  return {
    passed,
    state: passed ? 'succeeded' : 'failed',
    description,
    results
  };
}

module.exports = {
  DAYS_FIELD,
  REMAINING_DAYS_FIELD,
  COMPLETED_DAYS_FIELD,
  parseNumber,
  evaluateWorkItem,
  evaluateEstimates
};
