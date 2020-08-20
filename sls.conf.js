const config = {
  offline: {
    DD_FLUSH: false,
    DD_ENHANCED: false,
    DD_LOG_INJECT: false,
    DD_ENV: 'local',
    DD_LAYERS: false,
    DD_SERVICE: 'graphapi',
    DOMAIN: 'localhost',
    PROVISIONED: 0,
    GATEWAY: '',
  },

  online: {
    DD_FLUSH: true,
    DD_ENHANCED: true,
    DD_LOG_INJECT: true,
    DD_LAYERS: true,
  },

  dev: {
    DD_ENV: 'beta',
    DD_SERVICE: 'graphapi-dev-graphapi',
    DOMAIN: 'dev.graphapi.upframe.io',
    PROVISIONED: 0,
    GATEWAY: 'https://jwzd1gng5l.execute-api.eu-west-1.amazonaws.com/dev/',
  },

  prod: {
    DD_ENV: 'prod',
    DD_SERVICE: 'graphapi-prod-graphapi',
    DOMAIN: 'graphapi.upframe.io',
    PROVISIONED: 1,
    GATEWAY: 'https://2d9pap2m70.execute-api.eu-west-1.amazonaws.com/prod/',
  },
}

const get = field => sls => {
  const stage = sls.processedInput.options.stage || sls.service.provider.stage
  const val =
    field in config[stage] ? config[stage][field] : config.online[field]
  console.log(`${field}=${val}`)
  return val
}

module.exports = Object.fromEntries(
  Array.from(
    new Set(Object.values(config).flatMap(stage => Object.keys(stage)))
  ).map(field => [field, get(field)])
)
