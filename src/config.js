function requiredEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name, fallback) {
  const value = (process.env[name] || '').trim();
  return value || fallback;
}

function getConfig() {
  return {
    organizationUrl: requiredEnv('ADO_ORGANIZATION_URL').replace(/\/+$/, ''),
    pat: requiredEnv('ADO_PAT'),
    apiVersion: optionalEnv('ADO_API_VERSION', '7.1'),
    statusGenre: optionalEnv('ADO_STATUS_GENRE', 'pr-policy'),
    statusName: optionalEnv('ADO_STATUS_NAME', 'work-item-estimates')
  };
}

module.exports = { getConfig };
